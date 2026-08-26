(() => {
  const cfg=window.APP_CONFIG||{};
  if(!window.supabase||!cfg.SUPABASE_URL||!cfg.SUPABASE_ANON_KEY)return;
  const db=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  let busy=false;

  const fmt=m=>{
    m=Number(m);
    if(!Number.isFinite(m)||m<0)return '—';
    m=Math.max(0,Math.round(m));
    const h=Math.floor(m/60),mm=m%60;
    return h>0?`${h}س ${mm}د`:`${mm}د`;
  };

  function removeDuplicateTemperature(){
    const root=document.getElementById('ccRoot');
    if(!root)return;
    const control=root.querySelector('[data-cc-page="control"]');
    if(!control)return;
    [...control.querySelectorAll('.cc-box')].forEach(box=>{
      const text=(box.textContent||'').replace(/\s+/g,' ').trim();
      if(text.includes('الحرارة')&&(text.includes('Nozzle 0')||text.includes('Bed 0'))) box.remove();
    });
  }

  function findCard(id){
    const edit=document.querySelector(`[data-edit-printer="${CSS.escape(id)}"]`);
    return edit?.closest('.printer')||edit?.closest('[class*="printer"]')||null;
  }

  function renderTime(card,p){
    if(!card)return;
    let el=card.querySelector('[data-remote-time]');
    const printing=['printing','paused'].includes(String(p.status||''));
    if(!printing){el?.remove();return;}
    if(!el){
      el=document.createElement('div');
      el.dataset.remoteTime='1';
      el.style.cssText='margin:9px 0;padding:9px 11px;border:1px solid var(--line);border-radius:11px;background:var(--card2);display:flex;justify-content:space-between;gap:10px;align-items:center';
      const actions=card.querySelector('.actions');
      card.insertBefore(el,actions||null);
    }
    const end=p.estimated_end_at?new Date(p.estimated_end_at):null;
    const endTxt=end&&!Number.isNaN(end.getTime())?new Intl.DateTimeFormat('ar-AE',{timeStyle:'short'}).format(end):'—';
    el.innerHTML=`<div><b>⏱ ${fmt(p.remaining_minutes)} متبقي</b><div class="muted" style="font-size:10px;margin-top:2px">النهاية المتوقعة ${endTxt}</div></div><span class="tag">${Math.round(Number(p.print_progress)||0)}%</span>`;
  }

  async function refresh(){
    if(busy)return;busy=true;
    try{
      removeDuplicateTemperature();
      const {data,error}=await db.from('printers').select('id,status,remaining_minutes,estimated_end_at,print_progress').eq('connection_type','bambu_lan');
      if(error)return;
      for(const p of data||[])renderTime(findCard(p.id),p);
    }finally{busy=false;}
  }

  const observer=new MutationObserver(()=>{removeDuplicateTemperature();});
  observer.observe(document.documentElement,{subtree:true,childList:true});
  window.addEventListener('load',()=>{refresh();setInterval(refresh,1000);},{once:true});
  setTimeout(()=>{refresh();setInterval(refresh,1000);},900);
})();
