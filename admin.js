(() => {
  const URL='https://fljoowkjmvqijqiaimpp.supabase.co';
  const KEY='sb_publishable_YdE-PNM_SrerYvKjBn68BQ_8YCpuKR9';
  const API=`${URL}/functions/v1/admin-api`;
  const $=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let users=[],feedback=[];
  function token(){return sessionStorage.getItem('filaments_admin_token')||''}
  async function call(action,body={}){
    const r=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json','apikey':KEY,'x-admin-token':token()},body:JSON.stringify({action,...body})});
    const d=await r.json(); if(!r.ok)throw new Error(d.error||'Request failed'); return d;
  }
  function fmtDate(v){if(!v)return'—';try{return new Date(v).toLocaleString('en-US')}catch{return v}}
  function grams(v){const n=Number(v||0);return n>=1000?`${(n/1000).toFixed(2)}kg`:`${Math.round(n)}g`}
  function showAdmin(){ $('loginView').classList.add('hidden');$('adminView').classList.remove('hidden'); }
  function showLogin(){ $('adminView').classList.add('hidden');$('loginView').classList.remove('hidden'); }
  async function login(){
    const s=$('loginStatus');try{s.textContent='Signing in…';const r=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json','apikey':KEY},body:JSON.stringify({action:'login',username:$('adminUser').value.trim(),password:$('adminPass').value})});const d=await r.json();if(!r.ok)throw new Error(d.error==='temporarily_locked'?'Too many attempts. Try again later.':'Invalid credentials');sessionStorage.setItem('filaments_admin_token',d.token);sessionStorage.setItem('filaments_admin_expires',d.expires_at);showAdmin();await refresh();}catch(e){s.textContent=e.message}}
  async function refresh(){
    try{const d=await call('dashboard');users=d.users||[];feedback=d.feedback||[];const s=d.stats||{};$('kTotal').textContent=s.total_users||0;$('kActive').textContent=s.active_users||0;$('kIdle').textContent=s.idle_users||0;$('kFeedback').textContent=s.feedback_new||0;$('kSpools').textContent=s.total_spools||0;$('kPrinters').textContent=s.total_printers||0;$('kGrams').textContent=grams(s.total_remaining_grams);$('kUsage').textContent=grams(s.usage_30d_grams);renderUsers();renderFeedback();}catch(e){if(e.message==='unauthorized'){sessionStorage.removeItem('filaments_admin_token');showLogin();}else alert(e.message)}}
  function renderUsers(){
    const q=($('userSearch').value||'').toLowerCase(),state=$('userState').value;let rows=users.filter(u=>(!q||String(u.email).toLowerCase().includes(q)||String(u.id).toLowerCase().includes(q))&&(state==='all'||(state==='active'&&u.active)||(state==='idle'&&!u.active)));
    $('usersBody').innerHTML=rows.map(u=>`<tr><td><span class="dot ${u.active?'active':'idle'}"></span>${u.active?'Active':'Idle'}</td><td>${esc(u.email||'—')}</td><td>${fmtDate(u.created_at)}</td><td>${fmtDate(u.last_seen)}</td><td>${esc(u.current_page||'—')}</td><td>${u.spools}</td><td>${grams(u.remaining_grams)}</td><td>${u.printers}</td><td>${u.printing}</td><td>${grams(u.usage_grams)}</td><td>${u.backups}</td><td>${u.feedback}</td></tr>`).join('')||'<tr><td colspan="12" class="muted">No users found.</td></tr>';
  }
  function renderFeedback(){
    const f=$('feedbackFilter').value;let rows=feedback.filter(x=>f==='all'||x.status===f||x.kind===f);
    $('feedbackList').innerHTML=rows.map(x=>{const at=Array.isArray(x.attachments)?x.attachments:[];return `<div class="fitem"><div class="fhead"><b>${esc(x.contact_email)}</b><span class="tag">${esc(x.kind)}</span><span class="tag">${esc(x.status)}</span><span class="muted">${fmtDate(x.created_at)}</span></div><div class="msg">${esc(x.message)}</div><div class="actions">${at.map((a,i)=>`<button class="btn secondary open-att" data-id="${x.id}" data-index="${i}">${esc(a.name||'Attachment')}</button>`).join('')}<button class="btn secondary mark-read" data-id="${x.id}">Mark read</button><button class="btn secondary mark-resolved" data-id="${x.id}">Resolve</button></div></div>`}).join('')||'<div class="muted">No feedback found.</div>';
    document.querySelectorAll('.mark-read').forEach(b=>b.onclick=()=>setStatus(b.dataset.id,'read'));
    document.querySelectorAll('.mark-resolved').forEach(b=>b.onclick=()=>setStatus(b.dataset.id,'resolved'));
    document.querySelectorAll('.open-att').forEach(b=>b.onclick=()=>openAttachment(b.dataset.id,Number(b.dataset.index)));
  }
  async function setStatus(id,status){await call('feedback_status',{id,status});await refresh()}
  async function openAttachment(id,index){const item=feedback.find(x=>x.id===id),a=item?.attachments?.[index];if(!a?.path)return;const d=await call('attachment_url',{path:a.path});window.open(d.url,'_blank','noopener')}
  async function logout(){try{await call('logout')}catch{}sessionStorage.removeItem('filaments_admin_token');showLogin()}
  function init(){
    $('adminLogin').onclick=login;$('adminPass').addEventListener('keydown',e=>{if(e.key==='Enter')login()});$('refreshBtn').onclick=refresh;$('logoutBtn').onclick=logout;$('userSearch').oninput=renderUsers;$('userState').onchange=renderUsers;$('feedbackFilter').onchange=renderFeedback;
    if(token()){showAdmin();refresh()}else showLogin();
    setInterval(()=>{if(token()&&!document.hidden)refresh()},60000);
  }
  init();
})();