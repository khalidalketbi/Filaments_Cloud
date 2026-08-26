(() => {
  const cfg=window.APP_CONFIG||{};
  if(!window.supabase||!cfg.SUPABASE_URL||!cfg.SUPABASE_ANON_KEY)return;
  const db=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  const $=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const MAX=10*1024*1024;
  const isEn=()=>document.documentElement.lang==='en';
  const t=(ar,en)=>isEn()?en:ar;
  async function me(){const {data:{session}}=await db.auth.getSession();return session?.user||null}
  async function upload(files,id){const u=await me(),out=[];for(const f of files){if(f.size>MAX)throw new Error(`${f.name}: ${t('الحد الأقصى 10MB','maximum 10MB')}`);const safe=f.name.replace(/[^a-zA-Z0-9._-]/g,'_');const path=`${u.id}/${id}/${Date.now()}_${safe}`;const {error}=await db.storage.from('feedback-attachments').upload(path,f,{upsert:false,contentType:f.type||'application/octet-stream'});if(error)throw error;out.push({name:f.name,path,size:f.size,type:f.type})}return out}
  function statusText(s){return({new:t('جديدة','New'),read:t('تمت القراءة','Read'),in_progress:t('قيد المعالجة','In Progress'),resolved:t('تم الحل','Resolved')})[s]||s}
  async function submit(e){
    if(e)e.preventDefault();
    const btn=$('feedbackSubmit'),st=$('feedbackStatus');if(!btn||!st)return;
    try{
      btn.disabled=true;st.textContent=t('جاري فتح التذكرة...','Opening ticket…');
      const u=await me();if(!u)throw new Error(t('سجل الدخول أولاً','Please sign in first'));
      const email=$('feedbackEmail')?.value.trim()||u.email||'';
      const message=$('feedbackMessage')?.value.trim()||'';
      const kind=$('feedbackKind')?.value||'suggestion';
      if(!message)throw new Error(t('اكتب رسالتك.','Write your message.'));
      const id=crypto.randomUUID();const files=[...($('feedbackFiles')?.files||[])];const attachments=await upload(files,id);
      const {data,error}=await db.from('feedback_submissions').insert({id,user_id:u.id,contact_email:email,kind,message,attachments,status:'new'}).select('id,ticket_no,status,created_at').single();
      if(error)throw error;
      st.innerHTML=`<div class="ticket-thanks"><b>${t('شكراً لك 🌟','Thank you 🌟')}</b><br>${t('نشكرك على تواصلك معنا، ونسعى دائماً لتحسين تجربتك. تم فتح تذكرة لك وسنراجعها في أقرب وقت.','Thank you for contacting us. We are always working to improve your experience. A ticket has been opened and we will review it as soon as possible.')}<br><strong>${t('رقم التذكرة','Ticket')}: #${data.ticket_no}</strong></div>`;
      if($('feedbackMessage'))$('feedbackMessage').value='';if($('feedbackFiles'))$('feedbackFiles').value='';
      await loadTickets();
    }catch(err){console.error(err);st.textContent=t('تعذر فتح التذكرة: ','Could not open ticket: ')+(err.message||err)}finally{btn.disabled=false}
  }
  async function loadTickets(){
    const box=$('myTicketsList');if(!box)return;
    const {data,error}=await db.from('feedback_submissions').select('id,ticket_no,kind,message,status,created_at,updated_at').order('created_at',{ascending:false}).limit(50);
    if(error){box.innerHTML=`<div class="muted">${t('تعذر تحميل التذاكر.','Could not load tickets.')}</div>`;return}
    if(!data?.length){box.innerHTML=`<div class="muted">${t('لا توجد تذاكر بعد.','No tickets yet.')}</div>`;return}
    box.innerHTML=data.map(x=>`<button class="ticket-row" data-ticket="${x.id}" type="button"><span><b>#${x.ticket_no}</b> · ${esc(x.kind)}</span><span class="ticket-state ${esc(x.status)}">${statusText(x.status)}</span><small>${esc(x.message.slice(0,90))}${x.message.length>90?'…':''}</small><small class="muted">${new Date(x.updated_at||x.created_at).toLocaleString(isEn()?'en-US':'ar-AE')}</small></button>`).join('');
    box.querySelectorAll('[data-ticket]').forEach(b=>b.onclick=()=>openTicket(b.dataset.ticket));
  }
  async function openTicket(id){
    const modal=$('ticketModal'),body=$('ticketModalBody');if(!modal||!body)return;
    body.innerHTML=`<div class="muted">${t('جاري التحميل...','Loading…')}</div>`;modal.classList.add('show');
    const [tr,mr]=await Promise.all([db.from('feedback_submissions').select('*').eq('id',id).single(),db.from('ticket_messages').select('*').eq('ticket_id',id).order('created_at')]);
    if(tr.error||mr.error){body.textContent=(tr.error||mr.error).message;return}
    const x=tr.data,msgs=mr.data||[];
    body.innerHTML=`<div class="ticket-head"><div><h3>${t('تذكرة','Ticket')} #${x.ticket_no}</h3><div class="muted">${esc(x.kind)} · ${statusText(x.status)}</div></div></div><div class="ticket-thread"><div class="ticket-bubble user"><b>${t('أنت','You')}</b><div>${esc(x.message)}</div><small>${new Date(x.created_at).toLocaleString(isEn()?'en-US':'ar-AE')}</small></div>${msgs.map(m=>`<div class="ticket-bubble ${m.sender}"><b>${m.sender==='admin'?t('فريق الدعم','Support'):t('أنت','You')}</b><div>${esc(m.message)}</div><small>${new Date(m.created_at).toLocaleString(isEn()?'en-US':'ar-AE')}</small></div>`).join('')}</div>${x.status==='resolved'?`<div class="resolved-note">✅ ${t('تم تحديد هذه التذكرة كمحلولة.','This ticket is marked as resolved.')}</div>`:`<form id="ticketReplyForm" class="ticket-reply"><textarea id="ticketReplyText" placeholder="${t('اكتب ردك...','Write a reply…')}" required></textarea><button class="btn" type="submit">${t('إرسال الرد','Send reply')}</button></form>`}`;
    $('ticketReplyForm')?.addEventListener('submit',async e=>{e.preventDefault();const text=$('ticketReplyText').value.trim();if(!text)return;const u=await me();const {error}=await db.from('ticket_messages').insert({ticket_id:id,sender:'user',user_id:u.id,message:text});if(error)return alert(error.message);await db.from('feedback_submissions').update({updated_at:new Date().toISOString()}).eq('id',id);await openTicket(id);await loadTickets()});
  }
  function inject(){
    const panel=$('feedbackPanel');if(!panel||$('myTicketsPanel'))return false;
    const style=document.createElement('style');style.textContent=`.ticket-thanks{padding:12px;border:1px solid color-mix(in srgb,var(--accent2) 45%,var(--line));background:color-mix(in srgb,var(--accent2) 10%,var(--card2));border-radius:12px;line-height:1.7}.ticket-list{display:grid;gap:8px}.ticket-row{width:100%;text-align:start;background:var(--card2);color:var(--text);border:1px solid var(--line);border-radius:12px;padding:11px;display:grid;grid-template-columns:1fr auto;gap:5px}.ticket-row small{grid-column:1/-1}.ticket-state{font-size:10px;border:1px solid var(--line);border-radius:99px;padding:4px 7px}.ticket-state.resolved{color:var(--accent2)}.ticket-state.in_progress{color:var(--warn)}.ticket-modal{position:fixed;inset:0;background:#000a;display:none;align-items:center;justify-content:center;padding:16px;z-index:80}.ticket-modal.show{display:flex}.ticket-dialog{background:var(--panel);border:1px solid var(--line);border-radius:18px;width:min(760px,100%);max-height:90vh;overflow:auto;padding:16px}.ticket-close{float:inline-end}.ticket-thread{display:grid;gap:8px;margin:15px 0}.ticket-bubble{padding:10px 12px;border-radius:12px;background:var(--card2);border:1px solid var(--line)}.ticket-bubble.admin{background:color-mix(in srgb,var(--accent) 15%,var(--card2))}.ticket-bubble small{display:block;color:var(--muted);margin-top:6px}.ticket-reply{display:grid;gap:8px}.resolved-note{padding:10px;border-radius:10px;background:color-mix(in srgb,var(--accent2) 12%,var(--card2))}`;document.head.appendChild(style);
    const my=document.createElement('div');my.id='myTicketsPanel';my.style.marginTop='18px';my.innerHTML=`<div class="section-title"><h3>${t('🎫 تذاكري','🎫 My Tickets')}</h3><button id="refreshTickets" class="btn secondary small" type="button">${t('تحديث','Refresh')}</button></div><div id="myTicketsList" class="ticket-list"></div>`;panel.appendChild(my);
    const modal=document.createElement('div');modal.id='ticketModal';modal.className='ticket-modal';modal.innerHTML=`<div class="ticket-dialog"><button id="ticketClose" class="btn secondary ticket-close" type="button">×</button><div id="ticketModalBody"></div></div>`;document.body.appendChild(modal);$('ticketClose').onclick=()=>modal.classList.remove('show');modal.addEventListener('click',e=>{if(e.target===modal)modal.classList.remove('show')});$('refreshTickets').onclick=loadTickets;
    const form=$('feedbackForm');if(form){form.addEventListener('submit',e=>{e.preventDefault();e.stopImmediatePropagation();submit(e)},true)}
    const uemail=$('feedbackEmail');me().then(u=>{if(uemail&&!uemail.value&&u?.email)uemail.value=u.email});loadTickets();return true;
  }
  function init(){if(inject())return;const obs=new MutationObserver(()=>{if(inject())obs.disconnect()});obs.observe(document.body,{childList:true,subtree:true});setTimeout(loadTickets,1200);setInterval(()=>{if(!document.hidden&&$('myTicketsList'))loadTickets()},30000)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();