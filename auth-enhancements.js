(() => {
  const cfg = window.APP_CONFIG || {};
  if (!window.supabase || !cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) return;
  const db = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  const $ = id => document.getElementById(id);
  const REMEMBER_EMAIL='fm_remembered_email';
  const REMEMBER_SESSION='fm_remember_session';
  const TAB_SESSION='fm_tab_session';

  const isEn=()=>document.documentElement.lang==='en';
  const t=(ar,en)=>isEn()?en:ar;

  function style(){
    if($('authEnhanceStyle')) return;
    const s=document.createElement('style'); s.id='authEnhanceStyle';
    s.textContent=`
      .auth-password-wrap{position:relative}.auth-password-wrap input{padding-inline-end:48px}.auth-eye{position:absolute;inset-inline-end:7px;top:50%;transform:translateY(-50%);width:36px;height:36px;min-height:36px;border:0;background:transparent;color:var(--muted);border-radius:9px;font-size:18px;display:grid;place-items:center}.auth-eye:hover{background:var(--card2);color:var(--text)}
      .auth-extras{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-top:11px}.auth-remember{display:flex;align-items:center;gap:7px;color:var(--muted);font-size:12px;cursor:pointer}.auth-remember input{width:auto;min-height:auto;margin:0}.auth-links{display:flex;gap:12px;flex-wrap:wrap}.auth-link{border:0;background:none;color:var(--accent);padding:0;font-size:12px;text-decoration:none}.auth-link:hover{text-decoration:underline}
      .auth-recovery-overlay{position:fixed;inset:0;background:#000a;z-index:9999;display:none;align-items:center;justify-content:center;padding:16px}.auth-recovery-overlay.show{display:flex}.auth-recovery-card{width:min(430px,100%);background:var(--panel);border:1px solid var(--line);border-radius:18px;padding:20px;box-shadow:var(--shadow)}.auth-recovery-card h2{margin:0 0 8px}.auth-recovery-card p{color:var(--muted);font-size:13px}.auth-recovery-actions{display:flex;gap:8px;margin-top:12px}.auth-recovery-status{font-size:12px;min-height:18px;margin-top:8px}
    `; document.head.appendChild(s);
  }

  function build(){
    const pass=$('password'); const email=$('email'); const login=$('loginBtn');
    if(!pass||!email||!login||$('rememberMe')) return;
    style();

    const wrap=document.createElement('div'); wrap.className='auth-password-wrap';
    pass.parentNode.insertBefore(wrap,pass); wrap.appendChild(pass);
    const eye=document.createElement('button'); eye.type='button'; eye.className='auth-eye'; eye.setAttribute('aria-label',t('إظهار كلمة المرور','Show password')); eye.textContent='👁';
    eye.onclick=()=>{const show=pass.type==='password';pass.type=show?'text':'password';eye.textContent=show?'🙈':'👁';eye.setAttribute('aria-label',show?t('إخفاء كلمة المرور','Hide password'):t('إظهار كلمة المرور','Show password'));};
    wrap.appendChild(eye);

    const extras=document.createElement('div'); extras.className='auth-extras';
    extras.innerHTML=`<label class="auth-remember"><input id="rememberMe" type="checkbox"><span>${t('تذكرني','Remember me')}</span></label><div class="auth-links"><button type="button" id="forgotLogin" class="auth-link">${t('نسيت البريد/اسم الدخول؟','Forgot email/login?')}</button><button type="button" id="forgotPassword" class="auth-link">${t('نسيت كلمة المرور؟','Forgot password?')}</button></div>`;
    const status=$('authStatus'); login.parentNode.insertBefore(extras,status||login.nextSibling);

    const remembered=localStorage.getItem(REMEMBER_EMAIL)||'';
    if(remembered){ email.value=remembered; $('rememberMe').checked=true; }

    login.addEventListener('click',()=>{
      const remember=$('rememberMe').checked;
      if(remember){localStorage.setItem(REMEMBER_EMAIL,email.value.trim());localStorage.setItem(REMEMBER_SESSION,'1');}
      else{localStorage.removeItem(REMEMBER_EMAIL);localStorage.setItem(REMEMBER_SESSION,'0');sessionStorage.setItem(TAB_SESSION,'1');}
    },true);

    $('forgotLogin').onclick=()=>{
      const saved=localStorage.getItem(REMEMBER_EMAIL);
      if(saved){email.value=saved; if(status) status.textContent=t(`البريد المحفوظ على هذا الجهاز: ${saved}`,`Saved login on this device: ${saved}`);}
      else if(status) status.textContent=t('ما عندي بريد محفوظ على هذا الجهاز. إذا ما تتذكر بريد الحساب، تحتاج تبحث في رسائل Filaments Manger في بريدك.','No login is saved on this device. If you do not remember the account email, search your inboxes for Filaments Manger messages.');
    };

    $('forgotPassword').onclick=async()=>{
      const value=email.value.trim()||localStorage.getItem(REMEMBER_EMAIL)||'';
      if(!value){if(status)status.textContent=t('اكتب بريد الحساب أولًا.','Enter your account email first.');return;}
      if(status)status.textContent=t('جاري إرسال رابط إعادة التعيين...','Sending reset link…');
      const redirectTo=`${location.origin}${location.pathname}?password_reset=1`;
      const {error}=await db.auth.resetPasswordForEmail(value,{redirectTo});
      if(error){if(status)status.textContent=error.message;return;}
      if(status)status.textContent=t('تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك.','Password reset link sent. Check your email.');
    };
  }

  function recoveryUI(){
    if($('passwordRecoveryOverlay')) return;
    const o=document.createElement('div');o.id='passwordRecoveryOverlay';o.className='auth-recovery-overlay';
    o.innerHTML=`<div class="auth-recovery-card"><h2>${t('تعيين كلمة مرور جديدة','Set a new password')}</h2><p>${t('اكتب كلمة مرور جديدة للحساب.','Enter a new password for your account.')}</p><label>${t('كلمة المرور الجديدة','New password')}<div class="auth-password-wrap"><input id="newPassword" type="password" minlength="6" autocomplete="new-password"><button type="button" id="newPasswordEye" class="auth-eye">👁</button></div></label><div id="recoveryStatus" class="auth-recovery-status"></div><div class="auth-recovery-actions"><button id="saveNewPassword" class="btn">${t('حفظ كلمة المرور','Save password')}</button><button id="cancelRecovery" class="btn secondary">${t('إلغاء','Cancel')}</button></div></div>`;
    document.body.appendChild(o);
    $('newPasswordEye').onclick=()=>{const p=$('newPassword');const show=p.type==='password';p.type=show?'text':'password';$('newPasswordEye').textContent=show?'🙈':'👁';};
    $('cancelRecovery').onclick=()=>o.classList.remove('show');
    $('saveNewPassword').onclick=async()=>{
      const p=$('newPassword').value;
      if(p.length<6){$('recoveryStatus').textContent=t('كلمة المرور لازم تكون 6 أحرف على الأقل.','Password must be at least 6 characters.');return;}
      $('recoveryStatus').textContent=t('جاري الحفظ...','Saving…');
      const {error}=await db.auth.updateUser({password:p});
      if(error){$('recoveryStatus').textContent=error.message;return;}
      $('recoveryStatus').textContent=t('تم تغيير كلمة المرور بنجاح.','Password changed successfully.');
      setTimeout(()=>{o.classList.remove('show');history.replaceState({},'',location.pathname);},900);
    };
  }

  async function enforceRememberChoice(){
    if(localStorage.getItem(REMEMBER_SESSION)==='0' && !sessionStorage.getItem(TAB_SESSION)){
      const {data:{session}}=await db.auth.getSession();
      if(session) await db.auth.signOut();
    }
  }

  function init(){
    build(); recoveryUI(); enforceRememberChoice();
    db.auth.onAuthStateChange((event)=>{
      if(event==='PASSWORD_RECOVERY') $('passwordRecoveryOverlay')?.classList.add('show');
      if(event==='SIGNED_IN' && localStorage.getItem(REMEMBER_SESSION)==='0') sessionStorage.setItem(TAB_SESSION,'1');
    });
    if(new URLSearchParams(location.search).get('password_reset')==='1') setTimeout(()=>$('passwordRecoveryOverlay')?.classList.add('show'),500);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();