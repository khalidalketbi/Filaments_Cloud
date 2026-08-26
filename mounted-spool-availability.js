(() => {
  const cfg=window.APP_CONFIG||{};
  if(!window.supabase||!cfg.SUPABASE_URL||!cfg.SUPABASE_ANON_KEY)return;
  const db=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  const $=id=>document.getElementById(id);
  let mounted=new Map();

  async function loadMounted(){
    const {data,error}=await db.from('printers').select('id,name,loaded_spool_id');
    if(error)return;
    mounted=new Map((data||[]).filter(p=>p.loaded_spool_id).map(p=>[p.loaded_spool_id,p]));
  }

  async function syncLocations(){
    await loadMounted();
    const ids=[...mounted.keys()];
    if(ids.length) await db.from('spools').update({location:'printer'}).in('id',ids);
  }

  async function rebuildPrinterSelect(){
    const select=$('printerSpool');
    if(!select)return;
    await loadMounted();
    const currentPrinterId=$('printerId')?.value||'';
    const currentEntry=[...mounted.entries()].find(([,p])=>p.id===currentPrinterId);
    const currentSpoolId=currentEntry?.[0]||'';
    const {data:spools,error}=await db.from('spools').select('id,name,material,remaining_weight,archived').order('name');
    if(error)return;
    const keep=select.value;
    select.innerHTML='<option value="">بدون سبول</option>';
    for(const s of spools||[]){
      if(s.archived)continue;
      const owner=mounted.get(s.id);
      if(owner&&owner.id!==currentPrinterId)continue;
      const o=document.createElement('option');
      o.value=s.id;
      o.textContent=`${s.name} — ${s.material||''} — ${Math.round(Number(s.remaining_weight||0)).toLocaleString()}g${owner?' — مركب على '+owner.name:''}`;
      select.appendChild(o);
    }
    if(currentSpoolId && [...select.options].some(o=>o.value===currentSpoolId)) select.value=currentSpoolId;
    else if(keep && [...select.options].some(o=>o.value===keep)) select.value=keep;
    else select.value='';
  }

  function hideMountedInventory(){
    if(!mounted.size)return;
    document.querySelectorAll('[data-spool-card]').forEach(card=>{
      const id=card.getAttribute('data-spool-card');
      card.style.display=mounted.has(id)?'none':'';
    });
    const table=$('spoolTable');
    if(table){
      table.querySelectorAll('tbody tr').forEach(row=>{
        const edit=row.querySelector('[data-edit-spool]');
        const id=edit?.getAttribute('data-edit-spool');
        if(id) row.style.display=mounted.has(id)?'none':'';
      });
    }
  }

  async function refreshAll(){
    await loadMounted();
    hideMountedInventory();
    await rebuildPrinterSelect();
  }

  function observe(){
    const printerModal=$('printerModal');
    if(printerModal){
      new MutationObserver(()=>{
        if(printerModal.classList.contains('show')) setTimeout(rebuildPrinterSelect,60);
      }).observe(printerModal,{attributes:true,attributeFilter:['class']});
    }
    const spoolArea=$('spoolCards')?.parentElement||document.body;
    let t;
    new MutationObserver(()=>{
      clearTimeout(t);
      t=setTimeout(async()=>{await loadMounted();hideMountedInventory()},80);
    }).observe(spoolArea,{childList:true,subtree:true});
  }

  async function init(){
    await syncLocations();
    await refreshAll();
    observe();
    setInterval(()=>{if(!document.hidden)refreshAll()},30000);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();