import {AccountError} from './account-policy.mjs';
const EMAIL=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function accountConfiguration(env){
  if(!env.APP_ORIGIN||!env.SUPABASE_URL||!env.SUPABASE_PUBLISHABLE_KEY||!env.SUPABASE_SECRET_KEY)return false;
  const mode=env.SIGNUP_MODE||'invite';
  if(mode==='public'){
    if(!env.TURNSTILE_SITE_KEY?.trim()||!env.TURNSTILE_SECRET_KEY?.trim())return false;
  }else if(mode!=='invite'||!env.BETA_INVITE_EMAILS?.split(/[\n,]/).some(email=>EMAIL.test(email.trim())))return false;
  try{const origin=new URL(env.APP_ORIGIN),db=new URL(env.SUPABASE_URL);return origin.origin===env.APP_ORIGIN&&(origin.protocol==='https:'||origin.protocol==='http:'&&['localhost','127.0.0.1'].includes(origin.hostname))&&db.protocol==='https:'&&db.origin===env.SUPABASE_URL;}catch{return false;}
}
export function accountSignupConfiguration(env){
  return env.SIGNUP_MODE==='public'?{mode:'public',turnstile:{siteKey:env.TURNSTILE_SITE_KEY,action:'signup'}}:{mode:'invite'};
}
export function requireAccountOrigin(request,env){
  if(new URL(request.url).origin!==env.APP_ORIGIN||request.headers.get('origin')!==env.APP_ORIGIN)throw new AccountError('Open Harmonious at its own address before making changes.',403);
  if(!request.headers.get('content-type')?.startsWith('application/json'))throw new AccountError('Expected a JSON request.',415);
}
export async function accountBody(request,limit=2_000_000){
  const reader=request.body?.getReader();if(!reader)throw new AccountError('Missing request.',400);
  const chunks=[];let size=0;while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>limit){await reader.cancel();throw new AccountError('This save is too large. Download a backup and save smaller changes.',413);}chunks.push(value);}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  try{return JSON.parse(new TextDecoder().decode(bytes));}catch{throw new AccountError('Invalid JSON request.');}
}
export class AccountAuth{
  constructor(env,fetcher=(...args)=>fetch(...args)){this.env=env;this.fetcher=fetcher;}
  invited(email){return typeof email==='string'&&(this.env.BETA_INVITE_EMAILS||'').split(/[\n,]/).map(s=>s.trim().toLowerCase()).includes(email.toLowerCase());}
  allowed(email){return typeof email==='string'&&email.length<=254&&EMAIL.test(email)&&(this.env.SIGNUP_MODE==='public'||this.invited(email));}
  async verifyChallenge(token,request){
    if(typeof token!=='string'||!token.trim()||token.length>2048)throw new AccountError('Complete the security check before requesting a code.',400);
    const body={secret:this.env.TURNSTILE_SECRET_KEY,response:token};const remoteip=request?.headers.get('cf-connecting-ip');if(remoteip)body.remoteip=remoteip;
    let result;try{const response=await this.fetcher('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(10000)});if(!response.ok)throw Error();result=await response.json();}catch{throw new AccountError('The security check is temporarily unavailable. Please try again.',503);}
    if(result?.success!==true||result.hostname!==new URL(this.env.APP_ORIGIN).hostname||result.action!=='signup')throw new AccountError('The security check expired or could not be verified. Please try again.',400);
  }
  async call(path,body,token=null){
    const headers={apikey:this.env.SUPABASE_PUBLISHABLE_KEY,'content-type':'application/json'};if(token)headers.authorization=`Bearer ${token}`;
    return this.fetcher(`${this.env.SUPABASE_URL}/auth/v1/${path}`,{method:body===undefined?'GET':'POST',headers,body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(10000)});
  }
  cookieNames(){return this.env.APP_ORIGIN.startsWith('https:')?['__Host-harmonious-access','__Host-harmonious-refresh']:['harmonious-access','harmonious-refresh'];}
  cookies(session=null){
    const secure=this.env.APP_ORIGIN.startsWith('https:')?'; Secure':'';
    return this.cookieNames().map((name,index)=>`${name}=${session?encodeURIComponent(index?session.refresh_token:session.access_token):''}; Path=/; HttpOnly; SameSite=Lax${secure}; Max-Age=${session?(index?2592000:Math.min(session.expires_in||3600,3600)):0}`);
  }
  tokens(request){const cookies=new Map((request.headers.get('cookie')||'').split(';').map(s=>{const i=s.indexOf('=');return [s.slice(0,i).trim(),s.slice(i+1)];}));return this.cookieNames().map(name=>{try{return decodeURIComponent(cookies.get(name)||'');}catch{return '';}});}
  actor(user){
    if(!user?.id||!user.email_confirmed_at||!this.allowed(user.email))throw new AccountError(this.env.SIGNUP_MODE==='public'?'Confirm your email address to open your account.':'This beta is available to invited email addresses.',403);
    return {id:user.id,name:(user.user_metadata?.display_name||'Mapper').slice(0,100),email:user.email};
  }
  async identify(request){
    const [access,refresh]=this.tokens(request);let response;
    if(access){response=await this.call('user',undefined,access);if(response.ok)return {actor:this.actor(await response.json()),cookies:[]};if(response.status!==401&&response.status!==403)throw new AccountError('Sign-in is temporarily unavailable.',503);}
    if(!refresh)return {actor:null,cookies:[]};
    response=await this.call('token?grant_type=refresh_token',{refresh_token:refresh});
    if(!response.ok){if(response.status>=500||response.status===429)throw new AccountError('Sign-in is temporarily unavailable.',503);return {actor:null,cookies:this.cookies()};}
    const session=await response.json();return {actor:this.actor(session.user),cookies:this.cookies(session)};
  }
  async requestCode(input,request){
    const email=String(input.email||'').trim().toLowerCase(),name=String(input.name||'').trim();
    if(!EMAIL.test(email)||email.length>254||!name||name.length>100)throw new AccountError('Enter your email address and a display name.');
    if(!this.allowed(email))throw new AccountError('This beta is available to invited email addresses.',403);
    if(this.env.SIGNUP_MODE==='public')await this.verifyChallenge(input.captchaToken,request);
    const response=await this.call('otp',{email,create_user:true,data:{display_name:name}});
    if(!response.ok){
      const error=await response.json().catch(()=>({}));
      if(error.code==='captcha_failed'||error.error_code==='captcha_failed')throw new AccountError('The security check expired or could not be verified. Please try again.',400);
      throw new AccountError(response.status===429?'Please wait before requesting another code.':'The sign-in email could not be sent. Please try again later.',response.status===429?429:503);
    }
    return {message:'Check your email for a sign-in code.'};
  }
  async verifyCode(input){
    const email=String(input.email||'').trim().toLowerCase(),token=String(input.code||'').trim();
    if(!EMAIL.test(email)||email.length>254)throw new AccountError('Enter your email address.');
    if(!this.allowed(email))throw new AccountError('This beta is available to invited email addresses.',403);
    if(!/^[0-9]{6,10}$/.test(token))throw new AccountError('Enter the code from your sign-in email.');
    const response=await this.call('verify',{email,token,type:'email'});
    if(!response.ok)throw new AccountError(response.status===429?'Please wait before trying another code.':'This code is invalid or expired. Request another code.',response.status===429?429:400);
    const session=await response.json();return {actor:this.actor(session.user),cookies:this.cookies(session)};
  }
  async logout(request){const [access]=this.tokens(request);if(access)await this.call('logout?scope=local',{},access);return this.cookies();}
}

