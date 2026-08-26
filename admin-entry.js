(() => {
  const cfg=window.APP_CONFIG||{}; const $=id=>document.getElementById(id);
  const ADMIN_TOKEN='filaments_admin_token';
  const ADMIN_EXPIRES='filaments_admin_expires';

  function clearAdminSession(){
    sessionStorage.removeItem(ADMIN_TOKEN);
    sessionStorage.removeItem(ADMIN_EXPIRES);
    localStorage.removeItem(ADMIN_TOKEN);
    localStorage.removeItem(ADMIN_EXPIRES);
  }

  function saveAdminSession(token,expiresAt){
    sessionStorage.setItem(ADMIN_TOKEN,token);
    localStorage.setItem(ADMIN_TOKEN,token);
    if(expiresAt){
      sessionStorage.setItem(ADMIN_EXPIRES,expiresAt);
      localStorage.setItem(ADMIN_EXPIRES,expiresAt);
    }
  }

  async function validateSavedAdminSession(){
    const token=localStorage.getItem(ADMIN_TOKEN)||'';
    const expiresAt=localStorage.getItem(ADMIN_EXPIRES)||'';
    if(!token) return false;

    if(expiresAt){
      const expiresMs=new Date(expiresAt).getTime();
      if(Number.isFinite(expiresMs)&&expiresMs<=Date.now()){
        clearAdminSession();
        return false;
      }
    }

    try{
      const r=await fetch(`${cfg.SUPABASE_URL}/functions/v1/admin-api`,{
        method:'POST',
        headers:{'Content-Type':'application/json','apikey':cfg.SUPABASE_ANON_KEY,'x-admin-token':token},
        body:JSON.stringify({action:'dashboard'})
      });
      if(!r.ok){
        clearAdminSession();
        return false;
      }
      saveAdminSession(token,expiresAt);
      return true;
    }catch(_){
      // Keep the saved session on temporary network errors; the admin page
      // will verify it again when it loads.
      saveAdminSession(token,expiresAt);
      return true;
    }
  }

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
    saveAdminSession(data.token,data.expires_at);
    location.href='/admin.html';
  }

  async function init(){
    const email=$('email'),login=$('loginBtn'),status=$('authStatus'); if(!email||!login)return;

    if(await validateSavedAdminSession()){
      location.replace('/admin.html');
      return;
    }

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