(() => {
  const cfg=window.APP_CONFIG||{};
  if(!window.supabase||!cfg.SUPABASE_URL||!cfg.SUPABASE_ANON_KEY)return;
  const db=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  const PROJECT_KEY='fm_current_project_id';
  let projectId=null, plates=[], assignments=[], loading=false, applyTimer=null;
  const n=v=>Number(v)||0;
  const allowed=(p,printer)=>!Array.isArray(p?.allowed_printers)||!p.allowed_printers.length||p.allowed_printers.includes(printer);
  const fmt=mins=>`${Math.floor(n(mins)/60)}س${n(mins)%60?` ${n(mins)%60}د`:''}`;

  async function load(){
    const id=localStorage.getItem(PROJECT_KEY);
    if(!id){projectId=null;plates=[];assignments=[];return;}
    if(loading)return;
    loading=true;
    const [plr,ar]=await Promise.all([
      db.from('production_plates').select('plate_no,weight_g,print_minutes,target_qty,completed_qty,allowed_printers').eq('project_id',id).order('plate_no'),
      db.from('production_assignments').select('id,printer_name,plate_no,status').eq('project_id',id)
    ]);
    loading=false;
    if(plr.error||ar.error)return;
    projectId=id;
    plates=plr.data||[];
    assignments=ar.data||[];
    apply();
  }

  function activeCountForPlate(plateNo,excludeAssignmentId){
    return assignments.filter(a=>
      a.status==='printing' &&
      n(a.plate_no)===n(plateNo) &&
      String(a.id)!==String(excludeAssignmentId||'')
    ).length;
  }

  function label(p,isCurrent,assignmentId){
    const done=n(p.completed_qty), target=n(p.target_qty);
    const activeOthers=activeCountForPlate(p.plate_no,isCurrent?assignmentId:null);
    const freeRemaining=Math.max(0,target-done-activeOthers-(isCurrent?1:0));
    let status='';
    if(isCurrent){
      status=`موجود ${done}/${target} • أنت تطبع واحدة الآن`;
      if(activeOthers)status+=` • ${activeOthers} أخرى قيد الطباعة`;
    }else if(activeOthers){
      status=`موجود ${done}/${target} • ${activeOthers} قيد الطباعة • باقي ${freeRemaining}`;
    }else{
      status=freeRemaining>0?`موجود ${done}/${target} • باقي ${freeRemaining}`:`مكتمل/محجوز ${target}/${target}`;
    }
    return `Plate ${p.plate_no} • ${status} • ${n(p.weight_g)}g • ${fmt(p.print_minutes)}`;
  }

  function apply(){
    const current=localStorage.getItem(PROJECT_KEY);
    if(!current)return;
    if(current!==projectId){load();return;}
    document.querySelectorAll('#prodPrinterGrid .prod-printer-card').forEach(card=>{
      const select=card.querySelector('.plate-no');
      if(!select)return;
      const printer=(card.querySelector('.printer-name')?.value||card.querySelector('.prod-num')?.textContent||'').trim();
      const assignmentId=card.dataset.id||'';
      const currentValue=select.value||'';
      const currentNo=currentValue?Number(currentValue):null;
      const opts=['<option value="">بدون Plate</option>'];

      plates.forEach(p=>{
        const isCurrent=currentNo===n(p.plate_no);
        const done=n(p.completed_qty), target=n(p.target_qty);
        const activeOthers=activeCountForPlate(p.plate_no,isCurrent?assignmentId:null);
        const availableSlots=Math.max(0,target-done-activeOthers-(isCurrent?1:0));

        // Keep the current plate visible on the printer already printing it,
        // but hide it everywhere else once all remaining required copies are already in progress.
        if(!isCurrent && availableSlots<=0)return;
        if(!isCurrent && !allowed(p,printer))return;

        opts.push(`<option value="${p.plate_no}">${label(p,isCurrent,assignmentId)}</option>`);
      });

      const next=opts.join('');
      if(select.dataset.smartOptions!==next){
        select.innerHTML=next;
        select.dataset.smartOptions=next;
      }
      if(currentNo!=null && [...select.options].some(o=>Number(o.value)===currentNo))select.value=String(currentNo);
      else if(!currentNo)select.value='';
    });
  }

  function schedule(){clearTimeout(applyTimer);applyTimer=setTimeout(()=>{
    const current=localStorage.getItem(PROJECT_KEY);
    if(current!==projectId)load(); else load();
  },120);}

  function boot(){
    load();
    const root=document.getElementById('productionPage')||document.body;
    new MutationObserver(schedule).observe(root,{childList:true,subtree:true});
    document.addEventListener('change',e=>{if(e.target?.id==='projectSelect')setTimeout(load,50);});
    window.addEventListener('storage',e=>{if(e.key===PROJECT_KEY)load();});
    setInterval(load,5000);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();