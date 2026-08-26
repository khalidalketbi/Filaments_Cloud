(() => {
  const URL='https://fljoowkjmvqijqiaimpp.supabase.co';
  const KEY='sb_publishable_YdE-PNM_SrerYvKjBn68BQ_8YCpuKR9';
  const API=`${URL}/functions/v1/admin-api`;
  let currentId=null;
  const ar=()=>document.documentElement.lang==='ar';
  const tx=(a,e)=>ar()?a:e;
  const token=()=>sessionStorage.getItem('filaments_admin_token')||'';

  async function api(action,body={}){
    const r=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json','apikey':KEY,'x-admin-token':token()},body:JSON.stringify({action,...body})});
    const d=await r.json();if(!r.ok)throw new Error(d.message||d.error||'Request failed');return d;
  }
  async function markUnread(id){
    try{await api('feedback_status',{id,status:'new'});document.getElementById('refreshBtn')?.click();}
    catch(e){alert(e.message||e)}
  }
  async function removeTicket(id){
    if(!id)return;
    if(!confirm(tx('سيتم حذف هذه التذكرة نهائياً مع كل الردود والمرفقات، ولا يمكن التراجع. هل أنت متأكد؟','This will permanently delete the ticket, all replies, and attachments. This cannot be undone. Continue?')))return;
    try{
      const r=await fetch(`${URL}/functions/v1/admin-delete-ticket`,{method:'POST',headers:{'Content-Type':'application/json','apikey':KEY,'x-admin-token':token()},body:JSON.stringify({id})});
      const d=await r.json();if(!r.ok)throw new Error(d.message||d.error||'Delete failed');
      document.getElementById('ticketModal')?.classList.remove('show');currentId=null;document.getElementById('refreshBtn')?.click();
    }catch(e){alert(e.message||e)}
  }
  function enhance(){
    const filter=document.getElementById('feedbackFilter');
    if(filter&&!filter.querySelector('option[value="unread"]')){
      const o=document.createElement('option');o.value='unread';o.textContent=tx('غير مقروءة','Unread');filter.insertBefore(o,filter.children[1]||null);
    }
    document.querySelectorAll('.fitem').forEach(item=>{
      const open=item.querySelector('.open-ticket');if(!open)return;
      const id=open.dataset.id;const actions=item.querySelector('.actions');
      if(actions&&!actions.querySelector(`.mark-unread[data-id="${id}"]`)){
        const b=document.createElement('button');b.className='btn secondary mark-unread';b.dataset.id=id;b.textContent=tx('غير مقروءة','Unread');b.onclick=()=>markUnread(id);actions.insertBefore(b,actions.children[1]||null);
      }
    });
    const modalActions=document.querySelector('#ticketModal .actions');
    if(modalActions&&!document.getElementById('ticketUnreadBtn')){
      const b=document.createElement('button');b.id='ticketUnreadBtn';b.className='btn secondary';b.textContent=tx('غير مقروءة','Unread');b.onclick=()=>currentId&&markUnread(currentId);modalActions.insertBefore(b,modalActions.firstChild);
    }
    if(modalActions&&!document.getElementById('adminDeleteTicket')){
      const b=document.createElement('button');b.id='adminDeleteTicket';b.className='btn danger';b.textContent=tx('حذف نهائي','Delete permanently');b.onclick=()=>removeTicket(currentId);modalActions.appendChild(b);
    }
    document.querySelectorAll('.tag').forEach(el=>{if(el.textContent.trim()==='unread')el.textContent=tx('غير مقروءة','Unread')});
  }
  async function fixUnreadKpi(){
    if(!token())return;
    try{const d=await api('dashboard');const n=(d.feedback||[]).filter(x=>x.status==='unread'||x.status==='new').length;const el=document.getElementById('kFeedback');if(el)el.textContent=n;}catch{}
  }
  document.addEventListener('click',e=>{const b=e.target.closest?.('.open-ticket');if(b?.dataset?.id){currentId=b.dataset.id;setTimeout(enhance,80)}},true);
  const mo=new MutationObserver(()=>enhance());
  function init(){enhance();mo.observe(document.body,{childList:true,subtree:true});setInterval(fixUnreadKpi,10000);fixUnreadKpi();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();