(() => {
  const cfg=window.APP_CONFIG||{}; const $=id=>document.getElementById(id);
  async function adminLogin(username,password){
    const r=await fetch(`${cfg.SUPABASE_URL}/functions/v1/admin-api`,{method:'POST',headers:{'Content-Type':'application/json','apikey':cfg.SUPABASE_ANON_KEY},body:JSON.stringify({action:'login',username,password})});
    let data={};
    try{ data=await r.json(); }catch(_){ data={}; }
    if(!r.ok){
      if(data.error==='temporarily_locked') throw new Error('Too many attempts. Try again in 15 minutes.');
      if(data.error==='invalid_credentials') throw new Error('Invalid admin credentials');
      if(data.error==='server_error') throw new Error(`Admin server error${data.message?`: ${data.message}`:''}`);
      throw new Error(`Admin login failed (${r.status})`);
    }
    sessionStorage.setItem('filaments_admin_token',data.token);
    sessionStorage.setItem('filaments_admin_expires',data.expires_at);
    location.href='/admin.html';
  }
  function init(){
    const email=$('email'),login=$('loginBtn'),status=$('authStatus'); if(!email||!login)return;
    email.type='text'; email.autocomplete='username';
    login.addEventListener('click',async e=>{
      if(String(email.value||'').trim().toLowerCase()!=='admin')return;
      e.preventDefault();e.stopImmediatePropagation();
      try{
        login.disabled=true;
        status.textContent='Signing in to Admin…';
        await adminLogin('Admin',String($('password')?.value||'').trim());
      }catch(err){status.textContent=err.message;}finally{login.disabled=false;}
    },true);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();