let loading;
function loadTurnstile(){
  if(window.turnstile)return Promise.resolve(window.turnstile);
  if(!loading)loading=new Promise((resolve,reject)=>{
    const script=document.createElement('script');script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';script.async=true;
    const timer=setTimeout(()=>{script.remove();loading=null;reject(Error('The security check could not load. Reload this page to try again.'));},15000);
    script.onload=()=>{clearTimeout(timer);if(window.turnstile)resolve(window.turnstile);else{loading=null;reject(Error('The security check could not load.'));}};
    script.onerror=()=>{clearTimeout(timer);script.remove();loading=null;reject(Error('The security check could not load. Reload this page to try again.'));};
    document.head.append(script);
  });
  return loading;
}
export class AccountChallenge{
  constructor(container,onChange){this.container=container;this.onChange=onChange;this.token='';this.widget=null;}
  async mount(config){
    if(this.widget!==null)return;
    this.api=await loadTurnstile();
    this.widget=this.api.render(this.container,{sitekey:config.siteKey,action:config.action,theme:'auto',size:'flexible',
      callback:token=>{this.token=token;this.onChange('');},
      'expired-callback':()=>{this.token='';this.onChange('Complete the security check again.');},
      'error-callback':()=>{this.token='';this.onChange('The security check needs another try.');return true;},
      'timeout-callback':()=>{this.token='';this.onChange('The security check timed out. Please try again.');}});
  }
  reset(){this.token='';if(this.widget!==null)this.api.reset(this.widget);}
}

