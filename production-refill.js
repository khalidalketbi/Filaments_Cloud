(() => {
  const cfg = window.APP_CONFIG || {};
  if (!window.supabase || !cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) return;
  const db = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
    auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
  });
  const PROJECT_KEY = 'fm_current_project_id';
  const UNDO_PREFIX = 'fm_refill_undo:';
  const UNDO_TTL = 30 * 60 * 1000;
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
      #productionPage .printer-refill-undo{
        margin-inline-start:7px;padding:4px 9px;border-radius:8px;
        border:1px solid var(--line);background:var(--card2);color:inherit;
        font-size:11px;font-weight:900;cursor:pointer;
      }
      #productionPage .printer-refill-undo:disabled{opacity:.6;cursor:wait}
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

  function undoKey(projectId,name){
    return `${UNDO_PREFIX}${projectId}:${name}`;
  }

  function saveUndo(projectId,name,value){
    localStorage.setItem(undoKey(projectId,name),JSON.stringify({value:Number(value)||0,ts:Date.now()}));
  }

  function readUndo(projectId,name){
    try{
      const raw=localStorage.getItem(undoKey(projectId,name));
      if(!raw) return null;
      const data=JSON.parse(raw);
      if(!data || Date.now()-Number(data.ts||0)>UNDO_TTL){
        localStorage.removeItem(undoKey(projectId,name));
        return null;
      }
      return data;
    }catch(_){ return null; }
  }

  function clearUndo(projectId,name){
    localStorage.removeItem(undoKey(projectId,name));
  }

  function renderUndo(card,msg){
    const projectId=localStorage.getItem(PROJECT_KEY);
    const name=printerName(card);
    if(!projectId || !name) return;
    const data=readUndo(projectId,name);
    msg.querySelector('.printer-refill-undo')?.remove();
    if(!data) return;
    const b=document.createElement('button');
    b.type='button';
    b.className='printer-refill-undo';
    b.textContent=`تراجع إلى ${Number(data.value).toFixed(0)}g`;
    b.addEventListener('click',()=>undoRefill(card,b,msg,data.value));
    msg.appendChild(b);
  }

  async function undoRefill(card,btn,msg,oldValue){
    if(busy || btn.disabled) return;
    const projectId=localStorage.getItem(PROJECT_KEY);
    const name=printerName(card);
    if(!projectId || !name) return;
    busy=true; btn.disabled=true;
    const {error}=await db.from('production_assignments')
      .update({remaining_g:Number(oldValue)||0,updated_at:new Date().toISOString()})
      .eq('project_id',projectId)
      .eq('printer_name',name);
    if(error){
      msg.textContent='فشل التراجع: '+error.message;
      msg.className='printer-refill-msg err';
      renderUndo(card,msg);
    }else{
      setCardGrams(card,Number(oldValue)||0);
      clearUndo(projectId,name);
      msg.textContent=`تم التراجع ورجعت القيمة إلى ${Number(oldValue).toFixed(0)}g`;
      msg.className='printer-refill-msg ok';
    }
    busy=false;
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

    const q=await db.from('production_assignments')
      .select('remaining_g')
      .eq('project_id',projectId)
      .eq('printer_name',name)
      .maybeSingle();
    if(q.error){
      msg.textContent='تعذر قراءة القيمة الحالية: '+q.error.message;
      msg.className='printer-refill-msg err';
      return;
    }
    const previous=Number(q.data?.remaining_g)||0;

    if(!window.confirm(`تركيب سبول جديد 1000g على ${name}؟\nالقيمة الحالية ${previous.toFixed(0)}g ويمكن التراجع عنها لمدة 30 دقيقة.`)) return;

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
      saveUndo(projectId,name,previous);
      setCardGrams(card,1000);
      msg.textContent='تم تركيب سبول جديد: 1000g ';
      msg.className='printer-refill-msg ok';
      renderUndo(card,msg);
      btn.textContent='✓ Refill 1000g';
      setTimeout(()=>{ if(btn.isConnected) btn.textContent=old; },1400);
    }
    btn.disabled=false; busy=false;
  }

  function enhance(){
    injectStyle();
    document.querySelectorAll('#prodPrinterGrid .prod-printer-card').forEach(card=>{
      if(card.querySelector('.printer-refill-btn')){
        const msg=card.querySelector('.printer-refill-msg');
        if(msg) renderUndo(card,msg);
        return;
      }
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
      renderUndo(card,msg);
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
