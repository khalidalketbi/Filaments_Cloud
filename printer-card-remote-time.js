(() => {
  const cfg=window.APP_CONFIG||{};
  if(!window.supabase||!cfg.SUPABASE_URL||!cfg.SUPABASE_ANON_KEY)return;
  const db=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  let busy=false;

  const fmtSeconds=sec=>{
    sec=Math.max(0,Math.floor(Number(sec)||0));
    const h=Math.floor(sec/3600),m=Math.floor((sec%3600)/60),s=sec%60;
    if(h>0)return `${h}س ${m}د ${s}ث`;
    if(m>0)return `${m}د ${s}ث`;
    return `${s}ث`;
  };

  function removeDuplicateTemperature(){
    const root=document.getElementById('ccRoot');
    if(!root)return;
    const control=root.querySelector('[data-cc-page="control"]');
    if(!control)return;
    for(const box of [...control.querySelectorAll('.cc-box')]){
      const text=(box.textContent||'').replace(/\s+/g,' ').trim();
      const hasTempTitle=text.includes('الحرارة');
      const hasTempInputs=!!box.querySelector('#ccNozzle,#ccBed') || (text.includes('Nozzle 0')&&text.includes('Bed 0'));
      if(hasTempTitle&&hasTempInputs){
        box.remove();
        break;
      }
    }
  }

  function findCard(id){
    for(const btn of document.querySelectorAll('[data-edit-printer]')){
      if(String(btn.dataset.editPrinter)===String(id)) return btn.closest('.printer');
    }
    return null;
  }

  function renderTime(card,p){
    if(!card)return;
    let el=card.querySelector('[data-remote-time]');
    const printing=['printing','paused'].includes(String(p.status||''));
    if(!printing){el?.remove();return;}

    let seconds=null;
    if(p.estimated_end_at){
      const endMs=new Date(p.estimated_end_at).getTime();
      if(Number.isFinite(endMs))seconds=Math.max(0,Math.round((endMs-Date.now())/1000));
    }
    if(seconds==null&&Number.isFinite(Number(p.remaining_minutes)))seconds=Math.max(0,Math.round(Number(p.remaining_minutes)*60));
    if(seconds==null){el?.remove();return;}

    if(!el){
      el=document.createElement('div');
      el.dataset.remoteTime='1';
      el.style.cssText='margin:10px 0;padding:10px 12px;border:1px solid var(--line);border-radius:12px;background:var(--card2);display:flex;justify-content:space-between;gap:10px;align-items:center';
      const actions=card.querySelector('.actions');
      card.insertBefore(el,actions||null);
    }
    const end=p.estimated_end_at?new Date(p.estimated_end_at):null;
    const endTxt=end&&!Number.isNaN(end.getTime())?new Intl.DateTimeFormat('ar-AE',{timeStyle:'short'}).format(end):'—';
    const layer=(p.layer_num!=null||p.total_layers!=null)?` · Layer ${p.layer_num??'—'}/${p.total_layers??'—'}`:'';
    el.innerHTML=`<div><b style="font-size:14px">⏱ ${fmtSeconds(seconds)} متبقي</b><div class="muted" style="font-size:10px;margin-top:3px">النهاية ${endTxt}${layer}</div></div><span class="tag">${Math.round(Number(p.print_progress)||0)}%</span>`;
  }

  async function refresh(){
    if(busy)return;busy=true;
    try{
      removeDuplicateTemperature();
      const {data,error}=await db.from('printers').select('id,status,remaining_minutes,estimated_end_at,print_progress,layer_num,total_layers').eq('connection_type','bambu_lan');
      if(error){console.warn('Printer card timer:',error.message);return;}
      for(const p of data||[])renderTime(findCard(p.id),p);
    }finally{busy=false;}
  }

  const observer=new MutationObserver(()=>removeDuplicateTemperature());
  observer.observe(document.documentElement,{subtree:true,childList:true});
  setInterval(removeDuplicateTemperature,250);
  setInterval(refresh,1000);
  setTimeout(refresh,150);
  setTimeout(refresh,800);
})();
