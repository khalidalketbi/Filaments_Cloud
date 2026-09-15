(() => {
  const cfg=window.APP_CONFIG||{};
  if(!window.supabase||!cfg.SUPABASE_URL||!cfg.SUPABASE_ANON_KEY)return;
  const db=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  const KEY='fm_current_project_id';
  let projectId=null, rules=new Map(), loading=false, t=null;

  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const allowed=(p,printer)=>!Array.isArray(p?.allowed_printers)||!p.allowed_printers.length||p.allowed_printers.includes(printer);

  function style(){
    if(document.getElementById('printerConstraintStyle'))return;
    const s=document.createElement('style');s.id='printerConstraintStyle';s.textContent=`
      #productionPage .plate-printer-only{display:inline-flex;align-items:center;margin-top:6px;padding:4px 8px;border-radius:999px;border:1px solid color-mix(in srgb,var(--accent) 45%,var(--line));background:color-mix(in srgb,var(--accent) 10%,var(--card2));font-size:10px;font-weight:800}
    `;document.head.appendChild(s);
  }

  async function loadRules(){
    const id=localStorage.getItem(KEY);
    if(!id){rules.clear();projectId=null;return;}
    if(loading)return;
    loading=true;
    const {data,error}=await db.from('production_plates').select('id,plate_no,allowed_printers').eq('project_id',id);
    loading=false;
    if(error)return;
    projectId=id;
    rules=new Map((data||[]).map(p=>[Number(p.plate_no),p]));
    apply();
  }

  function apply(){
    style();
    const current=localStorage.getItem(KEY);
    if(current!==projectId){loadRules();return;}

    document.querySelectorAll('#prodPrinterGrid .prod-printer-card').forEach(card=>{
      const printer=(card.querySelector('.printer-name')?.value||card.querySelector('.prod-num')?.textContent||'').trim();
      const sel=card.querySelector('.plate-no');
      if(!printer||!sel)return;
      [...sel.options].forEach(opt=>{
        if(!opt.value)return;
        const p=rules.get(Number(opt.value));
        if(p && !allowed(p,printer)) opt.remove();
      });
    });

    document.querySelectorAll('#prodGrid .prod-card').forEach(card=>{
      if(card.querySelector('.plate-printer-only'))return;
      const id=card.dataset.id;
      const p=[...rules.values()].find(x=>String(x.id)===String(id));
      if(!p?.allowed_printers?.length)return;
      const top=card.querySelector('.prod-top > div:first-child')||card.querySelector('.prod-top');
      if(!top)return;
      const badge=document.createElement('div');badge.className='plate-printer-only';
      badge.textContent=`🖨 فقط: ${p.allowed_printers.map(esc).join('، ')}`;
      top.appendChild(badge);
    });
  }

  function boot(){
    loadRules();
    const root=document.getElementById('productionPage')||document.body;
    new MutationObserver(()=>{clearTimeout(t);t=setTimeout(()=>{const id=localStorage.getItem(KEY);if(id!==projectId)loadRules();else apply();},80);}).observe(root,{childList:true,subtree:true});
    window.addEventListener('storage',e=>{if(e.key===KEY)loadRules();});
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();