(() => {
  const URL='https://fljoowkjmvqijqiaimpp.supabase.co';
  const KEY='sb_publishable_YdE-PNM_SrerYvKjBn68BQ_8YCpuKR9';
  const API=`${URL}/functions/v1/admin-api`;
  const token=()=>sessionStorage.getItem('filaments_admin_token')||'';
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const isArabic=()=>document.documentElement.lang==='ar';

  async function call(action,body={}){
    const r=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json','apikey':KEY,'x-admin-token':token()},body:JSON.stringify({action,...body})});
    const d=await r.json();
    if(!r.ok) throw new Error(d.message||d.error||'Request failed');
    return d;
  }

  function ensureStyles(){
    if(document.getElementById('adminAttachmentStyles')) return;
    const s=document.createElement('style');
    s.id='adminAttachmentStyles';
    s.textContent=`
      .ticket-attachments{margin:12px 0;padding:12px;border:1px solid var(--line);border-radius:12px;background:var(--card2)}
      .ticket-attachments h3{margin:0 0 9px;font-size:14px}
      .ticket-attachment-grid{display:flex;gap:10px;flex-wrap:wrap}
      .ticket-image-link{display:block;width:150px;text-decoration:none;color:inherit}
      .ticket-image-link img{display:block;width:150px;height:110px;object-fit:cover;border-radius:10px;border:1px solid var(--line);background:#0003}
      .ticket-file-name{display:block;font-size:11px;margin-top:5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .ticket-file-card{display:flex;align-items:center;gap:8px;max-width:280px;padding:10px;border:1px solid var(--line);border-radius:10px;background:var(--panel);color:var(--text);text-decoration:none}
      .ticket-attachment-loading{color:var(--muted);font-size:12px}
    `;
    document.head.appendChild(s);
  }

  function getBox(){
    const dialog=document.querySelector('#ticketModal .dialog');
    const info=document.getElementById('ticketModalInfo');
    if(!dialog||!info) return null;
    let box=document.getElementById('ticketAttachments');
    if(!box){
      box=document.createElement('div');
      box.id='ticketAttachments';
      box.className='ticket-attachments';
      info.insertAdjacentElement('afterend',box);
    }
    return box;
  }

  async function showAttachments(ticketId){
    ensureStyles();
    const box=getBox();
    if(!box) return;
    box.innerHTML=`<div class="ticket-attachment-loading">${isArabic()?'جاري تحميل المرفقات...':'Loading attachments…'}</div>`;
    try{
      const d=await call('ticket_detail',{id:ticketId});
      const files=Array.isArray(d.ticket?.attachments)?d.ticket.attachments:[];
      if(!files.length){
        box.style.display='none';
        box.innerHTML='';
        return;
      }
      box.style.display='block';
      const rendered=[];
      for(const a of files){
        try{
          const u=await call('attachment_url',{path:a.path});
          const name=esc(a.name||'Attachment');
          const type=String(a.type||'');
          if(type.startsWith('image/')){
            rendered.push(`<a class="ticket-image-link" href="${esc(u.url)}" target="_blank" rel="noopener"><img src="${esc(u.url)}" alt="${name}"><span class="ticket-file-name">📷 ${name}</span></a>`);
          }else{
            rendered.push(`<a class="ticket-file-card" href="${esc(u.url)}" target="_blank" rel="noopener"><span>📎</span><span>${name}</span></a>`);
          }
        }catch(err){
          rendered.push(`<div class="ticket-file-card">⚠️ ${esc(a.name||'Attachment')}</div>`);
        }
      }
      box.innerHTML=`<h3>${isArabic()?'المرفقات':'Attachments'} (${files.length})</h3><div class="ticket-attachment-grid">${rendered.join('')}</div>`;
    }catch(err){
      box.style.display='block';
      box.innerHTML=`<div class="ticket-attachment-loading">${isArabic()?'تعذر تحميل المرفقات: ':'Could not load attachments: '}${esc(err.message)}</div>`;
    }
  }

  document.addEventListener('click',e=>{
    const b=e.target.closest?.('.open-ticket');
    if(!b?.dataset?.id) return;
    setTimeout(()=>showAttachments(b.dataset.id),30);
  },true);
})();