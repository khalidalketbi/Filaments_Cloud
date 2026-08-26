(() => {
  const cfg=window.APP_CONFIG||{}; const $=id=>document.getElementById(id);
  async function adminLogin(username,password){
    const r=await fetch(`${cfg.SUPABASE_URL}/functions/v1/admin-api`,{method:'POST',headers:{'Content-Type':'application/json','apikey':cfg.SUPABASE_ANON_KEY},body:JSON.stringify({action:'login',username,password})});
    const data=await r.json(); if(!r.ok)throw new Error(data.error==='temporarily_locked'?'Too many attempts. Try again later.':'Invalid admin credentials');
    sessionStorage.setItem('filaments_admin_token',data.token);sessionStorage.setItem('filaments_admin_expires',data.expires_at);location.href='/admin.html';
  }
  function init(){
    const email=$('email'),login=$('loginBtn'),status=$('authStatus'); if(!email||!login)return;
    email.type='text'; email.autocomplete='username';
    login.addEventListener('click',async e=>{
      if(String(email.value||'').trim().toLowerCase()!=='admin')return;
      e.preventDefault();e.stopImmediatePropagation();
      try{login.disabled=true;status.textContent='Signing in to Admin…';await adminLogin('Admin',$('password')?.value||'');}
      catch(err){status.textContent=err.message;}finally{login.disabled=false;}
    },true);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();