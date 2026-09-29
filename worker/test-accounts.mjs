import {AccountError} from './account-policy.mjs';

export const TEST_ACCOUNT_DOMAIN='test-accounts.harmonious.invalid';
const USERNAME=/^[a-z0-9][a-z0-9_-]{2,31}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const testEmail=username=>`${username}@${TEST_ACCOUNT_DOMAIN}`;
export function testUsername(value){return typeof value==='string'?value.trim().toLowerCase():'';}
export function isTestUser(user){const meta=user?.app_metadata;return meta?.harmonious_test_account===true&&USERNAME.test(meta.test_username)&&UUID.test(meta.created_by)&&user.email===testEmail(meta.test_username);}
export function canManageTestAccounts(env,actor){return UUID.test(env.TEST_ACCOUNT_ADMIN_ID||'')&&actor?.id===env.TEST_ACCOUNT_ADMIN_ID&&!actor.testAccount;}
export function requireTestManager(env,actor){if(!canManageTestAccounts(env,actor))throw new AccountError('Only the test organizer can manage test accounts.',403);}
export function testCredentials(input){
 const username=testUsername(input?.username),password=input?.password;
 if(!USERNAME.test(username)||typeof password!=='string'||!password||password.length>256)throw new AccountError('Enter your test username and password.');
 return {username,password};
}
function newPassword(value){if(typeof value!=='string'||!/^HT-[a-f0-9]{32}$/.test(value))throw new AccountError('Generate a new test password before continuing.');return value;}
export class TestAccounts{
 constructor(auth){this.auth=auth;this.env=auth.env;}
 async call(path,method='GET',body){
  const key=this.env.SUPABASE_SECRET_KEY,headers={apikey:key,'content-type':'application/json'};
  if(!key.startsWith('sb_secret_'))headers.authorization=`Bearer ${key}`;
  let response;try{response=await this.auth.fetcher(`${this.env.SUPABASE_URL}/auth/v1/admin/${path}`,{method,headers,...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(10000)});}catch{throw new AccountError('The account service did not respond. Keep these login details and try again.',503);}
  const data=await response.json().catch(()=>({}));
  if(!response.ok){if(['email_exists','user_already_exists'].includes(data.code)||response.status===422)throw new AccountError('That username is already in use. Choose another, or reset its password from the list.',409);throw new AccountError(response.status===429?'Please wait before trying again.':'Test accounts are temporarily unavailable.',response.status===429?429:503);}
  return data;
 }
 summary(user){return {id:user.id,username:user.app_metadata.test_username,name:typeof user.user_metadata?.display_name==='string'?user.user_metadata.display_name:'Test participant',createdAt:user.created_at};}
 async list(actor,page=1){
  requireTestManager(this.env,actor);if(!Number.isSafeInteger(page)||page<1||page>10000)throw new AccountError('Invalid account page.');
  const data=await this.call(`users?page=${page}&per_page=100`),users=data.users||[];
  return {accounts:users.filter(isTestUser).map(user=>this.summary(user)),nextPage:users.length===100?page+1:null};
 }
 async create(actor,input){
  requireTestManager(this.env,actor);const username=testUsername(input?.username),name=typeof input?.name==='string'?input.name.trim():'';
  if(!USERNAME.test(username)||!name||name.length>100)throw new AccountError('Use a display name and a 3–32 character username containing letters, numbers, underscores or hyphens.');
  const password=newPassword(input.password),user=await this.call('users','POST',{email:testEmail(username),password,email_confirm:true,user_metadata:{display_name:name},app_metadata:{harmonious_test_account:true,test_username:username,created_by:actor.id}});
  if(!isTestUser(user)||!user.email_confirmed_at)throw new AccountError('The test account could not be confirmed. Keep these details and check the account list.',503);
  return {account:this.summary(user)};
 }
 async reset(actor,input){
  requireTestManager(this.env,actor);if(!UUID.test(input?.id||''))throw new AccountError('Choose a test account.');
  const password=newPassword(input.password),user=await this.call(`users/${input.id}`);
  if(!isTestUser(user))throw new AccountError('Only test-account passwords can be reset here.',403);
  await this.call(`users/${input.id}`,'PUT',{password});return {account:this.summary(user)};
 }
}
