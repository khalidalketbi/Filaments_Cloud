(() => {
  const cfg = window.APP_CONFIG || {};
  if (!window.supabase || !cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) return;
  const db = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
    auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
  });
  const PROJECT_KEY = 'fm_current_project_id';
  let busy = false;

  function injectStyle(){
    if(document.getElementById('productionRefillStyle')) return;
    const s=document.createElement('style');
    s.id='productionRefillStyle';
    s.textContent=`
      #productionPage .printer-refill-btn{
        width:100%;margin-top:8px;min-height:42px;border-radius:12px;
        border:1px solid color-mix(in srgb,var(--accent) 55%,var(--line));
        background:color-mix(in srgb,var(--accent) 12%,var(--card2));
        color:inherit;font-weight:900;cursor:pointer;
      }
      #productionPage .printer-refill-btn:disabled{opacity:.6;cursor:wait}
      #productionPage .printer-refill-msg{font-size:11px;margin-top:5px;color:var(--muted);min-height:15px}
      #productionPage .printer-refill-msg.ok{color:var(--accent2)}
      #productionPage .printer-refill-msg.err{color:var(--warn)}
    `;
    document.head.appendChild(s);
  }

  function printerName(card){
    return (card.querySelector('.printer-name')?.value ||
            card.querySelector('.prod-num')?.textContent ||
            card.querySelector('h3')?.textContent || '').trim();
  }

  function setCardGrams(card, grams){
    const input=card.querySelector('.remaining-g');
    if(input){
      input.value=String(grams);
      input.dispatchEvent(new Event('input',{bubbles:true}));
      input.dispatchEvent(new Event('change',{bubbles:true}));
    }
    const stat=card.querySelector('.printer-main-stat strong');
    if(stat) stat.textContent=`${grams}g`;
  }

  async function refill(card, btn, msg){
    if(busy || btn.disabled) return;
    const projectId=localStorage.getItem(PROJECT_KEY);
    const name=printerName(card);
    if(!projectId || !name){
      msg.textContent='تعذر تحديد المشروع أو الطابعة.';
      msg.className='printer-refill-msg err';
      return;
    }

    busy=true; btn.disabled=true;
    const old=btn.textContent;
    btn.textContent='جاري تعبئة السبول…';
    msg.textContent=''; msg.className='printer-refill-msg';

    const {error}=await db.from('production_assignments')
      .update({remaining_g:1000,updated_at:new Date().toISOString()})
      .eq('project_id',projectId)
      .eq('printer_name',name);

    if(error){
      msg.textContent='فشل التحديث: '+error.message;
      msg.className='printer-refill-msg err';
    }else{
      setCardGrams(card,1000);
      msg.textContent='تم تركيب سبول جديد: 1000g';
      msg.className='printer-refill-msg ok';
      btn.textContent='✓ Refill 1000g';
      setTimeout(()=>{ if(btn.isConnected) btn.textContent=old; },1400);
    }
    btn.disabled=false; busy=false;
  }

  function enhance(){
    injectStyle();
    document.querySelectorAll('#prodPrinterGrid .prod-printer-card').forEach(card=>{
      if(card.querySelector('.printer-refill-btn')) return;
      const actions=card.querySelector('.printer-actions');
      const remaining=card.querySelector('.remaining-g');
      if(!actions && !remaining) return;
      const host=actions || remaining.closest('.prod-controls') || card;
      const btn=document.createElement('button');
      btn.type='button';
      btn.className='printer-refill-btn';
      btn.textContent='↻ Refill سبول جديد 1000g';
      const msg=document.createElement('div');
      msg.className='printer-refill-msg';
      btn.addEventListener('click',()=>refill(card,btn,msg));
      host.insertAdjacentElement('afterend',btn);
      btn.insertAdjacentElement('afterend',msg);
    });
  }

  function boot(){
    enhance();
    const root=document.getElementById('productionPage') || document.body;
    let t=null;
    new MutationObserver(()=>{
      clearTimeout(t);
      t=setTimeout(enhance,80);
    }).observe(root,{childList:true,subtree:true});
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
