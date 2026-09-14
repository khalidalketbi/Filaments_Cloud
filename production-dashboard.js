(() => {
  const cfg=window.APP_CONFIG||{};
  if(!window.supabase||!cfg.SUPABASE_URL||!cfg.SUPABASE_ANON_KEY)return;
  const db=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  const key='fm_current_project_id';
  const n=v=>Number(v)||0;
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let tick=null,busy=false;

  function style(){
    if(document.getElementById('projectDashboardStyle'))return;
    const s=document.createElement('style');s.id='projectDashboardStyle';s.textContent=`
      #dashboardPage .pdash{display:grid;gap:14px}
      #dashboardPage .pdash-head{display:flex;gap:10px;align-items:end;flex-wrap:wrap}
      #dashboardPage .pdash-project{flex:1;min-width:220px}
      #dashboardPage .pdash-kpis{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px}
      #dashboardPage .pdash-kpi{background:linear-gradient(145deg,var(--panel),var(--card));border:1px solid var(--line);border-radius:16px;padding:14px}
      #dashboardPage .pdash-kpi span{font-size:11px;color:var(--muted)}#dashboardPage .pdash-kpi strong{display:block;font-size:26px;margin:5px 0 2px}#dashboardPage .pdash-kpi small{font-size:10px;color:var(--muted)}
      #dashboardPage .pdash-progress{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:14px}
      #dashboardPage .pdash-progressbar{height:14px;background:var(--card2);border-radius:99px;overflow:hidden;margin-top:9px}#dashboardPage .pdash-progressbar i{display:block;height:100%;background:linear-gradient(90deg,var(--accent),var(--accent2))}
      #dashboardPage .pdash-grid{display:grid;grid-template-columns:1.05fr .95fr;gap:12px}
      #dashboardPage .pdash-panel{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:14px;min-width:0}
      #dashboardPage .pdash-title{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px}
      #dashboardPage .pdash-plates{display:grid;gap:8px}
      #dashboardPage .pdash-plate{display:grid;grid-template-columns:72px 1fr 92px;gap:10px;align-items:center;background:var(--card2);border:1px solid var(--line);border-radius:12px;padding:10px}
      #dashboardPage .pdash-plate b{font-size:15px}.pdash-mini{font-size:10px;color:var(--muted)}
      #dashboardPage .pdash-mini-bar{height:8px;background:var(--panel);border-radius:99px;overflow:hidden;margin-top:6px}.pdash-mini-bar i{display:block;height:100%;background:var(--accent)}
      #dashboardPage .pdash-printers{display:grid;gap:8px}
      #dashboardPage .pdash-printer{display:grid;grid-template-columns:64px 1fr auto;gap:10px;align-items:center;background:var(--card2);border:1px solid var(--line);border-radius:12px;padding:10px}
      #dashboardPage .pdash-printer.printing{border-color:color-mix(in srgb,var(--accent2) 45%,var(--line))}
      #dashboardPage .pdash-printer strong{font-size:15px}.pdash-time{font-weight:900;font-variant-numeric:tabular-nums;color:var(--accent2)}
      #dashboardPage .pdash-shortage{font-weight:900}.pdash-ok{color:var(--accent2)}.pdash-warn{color:var(--warn)}
      #dashboardPage .pdash-footer{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
      #dashboardPage .pdash-fact{background:var(--card2);border:1px solid var(--line);border-radius:12px;padding:12px}
      @media(max-width:900px){#dashboardPage .pdash-kpis{grid-template-columns:repeat(2,1fr)}#dashboardPage .pdash-grid{grid-template-columns:1fr}}
      @media(max-width:560px){#dashboardPage .pdash-kpis{grid-template-columns:1fr 1fr}#dashboardPage .pdash-footer{grid-template-columns:1fr}#dashboardPage .pdash-plate{grid-template-columns:62px 1fr 72px}#dashboardPage .pdash-printer{grid-template-columns:54px 1fr}}
    `;document.head.appendChild(s);
  }

  function layout(){
    const page=document.getElementById('dashboardPage');if(!page)return;
    if(page.dataset.projectDash==='1')return;
    page.dataset.projectDash='1';
    page.innerHTML=`<div class="pdash">
      <div class="pdash-head">
        <label class="pdash-project">المشروع الحالي<select id="pdashProject"></select></label>
        <button id="pdashOpenProduction" class="btn">فتح صفحة الإنتاج</button>
      </div>
      <div class="pdash-kpis">
        <div class="pdash-kpi"><span>القطع المكتملة</span><strong id="pdDone">—</strong><small id="pdDoneMeta"></small></div>
        <div class="pdash-kpi"><span>القطع المتبقية</span><strong id="pdRemaining">—</strong><small id="pdRemainingG"></small></div>
        <div class="pdash-kpi"><span>الأطقم المكتملة</span><strong id="pdSets">—</strong><small id="pdSetsMeta"></small></div>
        <div class="pdash-kpi"><span>تطبع الآن</span><strong id="pdPrinting">—</strong><small id="pdPrintingMeta"></small></div>
        <div class="pdash-kpi"><span>الإنجاز</span><strong id="pdPct">—</strong><small>حسب هدف المشروع</small></div>
      </div>
      <section class="pdash-progress"><div class="pdash-title"><b id="pdTitle">المشروع</b><span id="pdMeta" class="muted"></span></div><div id="pdProgressText"></div><div class="pdash-progressbar"><i id="pdProgressBar" style="width:0%"></i></div></section>
      <div class="pdash-grid">
        <section class="pdash-panel"><div class="pdash-title"><b>حالة كل Plate</b><span class="muted">المكتمل / المطلوب / الناقص</span></div><div id="pdPlates" class="pdash-plates"></div></section>
        <section class="pdash-panel"><div class="pdash-title"><b>الطابعات الآن</b><span id="pdPrinterCount" class="muted"></span></div><div id="pdPrinters" class="pdash-printers"></div></section>
      </div>
      <section class="pdash-panel"><div class="pdash-title"><b>ملخص المشروع</b></div><div id="pdFacts" class="pdash-footer"></div></section>
    </div>`;
    document.getElementById('pdashProject')?.addEventListener('change',e=>{localStorage.setItem(key,e.target.value);render();});
    document.getElementById('pdashOpenProduction')?.addEventListener('click',()=>document.querySelector('.nav [data-page="production"]')?.click());
  }

  function fmtTime(sec){if(sec==null)return '—';sec=Math.max(0,Math.floor(sec));const h=Math.floor(sec/3600),m=Math.floor(sec%3600/60);return `${h?`${h}س `:''}${m}د`;}
  function remainingSec(a,plate){
    if(a.status!=='printing')return null;
    if(a.manual_time_override&&a.manual_finish_at)return Math.max(0,(new Date(a.manual_finish_at).getTime()-Date.now())/1000);
    if(!a.started_at||!plate?.print_minutes)return null;
    return Math.max(0,(new Date(a.started_at).getTime()+n(plate.print_minutes)*60000-Date.now())/1000);
  }

  async function render(){
    if(busy)return;busy=true;
    try{
      const {data:{session}}=await db.auth.getSession();if(!session?.user)return;
      const pr=await db.from('production_projects').select('*').eq('user_id',session.user.id).order('created_at');
      const projects=pr.data||[];
      const sel=document.getElementById('pdashProject');if(!sel)return;
      sel.innerHTML=projects.map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join('');
      if(!projects.length){document.getElementById('pdTitle').textContent='لا يوجد مشروع';document.getElementById('pdPlates').innerHTML='<div class="muted">أنشئ مشروع من صفحة الإنتاج.</div>';return;}
      let id=localStorage.getItem(key);if(!projects.some(p=>p.id===id))id=projects[0].id;sel.value=id;
      const project=projects.find(p=>p.id===id);
      const [plr,ar]=await Promise.all([db.from('production_plates').select('*').eq('project_id',id).order('plate_no'),db.from('production_assignments').select('*').eq('project_id',id).order('printer_name')]);
      const plates=plr.data||[], assignments=ar.data||[];const pmap=new Map(plates.map(p=>[n(p.plate_no),p]));
      const target=plates.reduce((s,p)=>s+n(p.target_qty),0),done=plates.reduce((s,p)=>s+n(p.completed_qty),0),capped=plates.reduce((s,p)=>s+Math.min(n(p.completed_qty),n(p.target_qty)),0);
      const remaining=plates.reduce((s,p)=>s+Math.max(0,n(p.target_qty)-n(p.completed_qty)),0),remainingG=plates.reduce((s,p)=>s+Math.max(0,n(p.target_qty)-n(p.completed_qty))*n(p.weight_g),0);
      const sets=plates.length?Math.min(...plates.map(p=>n(p.completed_qty))):0;const pct=target?Math.round(capped/target*100):0;const printing=assignments.filter(a=>a.status==='printing');
      const projected=new Map(plates.map(p=>[n(p.plate_no),n(p.completed_qty)]));printing.forEach(a=>{if(a.plate_no)projected.set(n(a.plate_no),n(projected.get(n(a.plate_no)))+1);});
      const projectedRemaining=[...plates].reduce((s,p)=>s+Math.max(0,n(p.target_qty)-n(projected.get(n(p.plate_no)))),0);
      document.getElementById('pdDone').textContent=done;document.getElementById('pdDoneMeta').textContent=`من ${target} قطعة`;
      document.getElementById('pdRemaining').textContent=remaining;document.getElementById('pdRemainingG').textContent=`${remainingG.toFixed(0)}g مطلوبة`;
      document.getElementById('pdSets').textContent=Math.min(sets,n(project.target_sets));document.getElementById('pdSetsMeta').textContent=`من ${n(project.target_sets)} أطقم`;
      document.getElementById('pdPrinting').textContent=printing.length;document.getElementById('pdPrintingMeta').textContent=`بعد الحالية يبقى ${projectedRemaining} قطعة`;
      document.getElementById('pdPct').textContent=`${pct}%`;document.getElementById('pdTitle').textContent=project.name;document.getElementById('pdMeta').textContent=`${plates.length} Plates · الهدف ${project.target_sets} أطقم`;
      document.getElementById('pdProgressText').textContent=`${done} مكتمل · ${remaining} متبقي`;document.getElementById('pdProgressBar').style.width=`${pct}%`;
      document.getElementById('pdPlates').innerHTML=plates.map(p=>{const q=n(p.completed_qty),t=n(p.target_qty),need=Math.max(0,t-q),pp=Math.min(100,Math.round(q/t*100));return `<div class="pdash-plate"><b>Plate ${p.plate_no}</b><div><div>${q}/${t} مكتمل</div><div class="pdash-mini-bar"><i style="width:${pp}%"></i></div><div class="pdash-mini">${n(p.weight_g)}g · ${Math.floor(n(p.print_minutes)/60)}س ${n(p.print_minutes)%60}د</div></div><div class="pdash-shortage ${need?'pdash-warn':'pdash-ok'}">${need?`ناقص ${need}`:'مكتمل ✓'}</div></div>`;}).join('');
      document.getElementById('pdPrinters').innerHTML=assignments.map(a=>{const pl=pmap.get(n(a.plate_no));const sec=remainingSec(a,pl);const finish=sec!=null?new Date(Date.now()+sec*1000).toLocaleTimeString('ar-AE',{hour:'numeric',minute:'2-digit',hour12:true}):'';return `<div class="pdash-printer ${a.status==='printing'?'printing':''}"><strong>${esc(a.printer_name)}</strong><div><div>${a.status==='printing'&&a.plate_no?`Plate ${a.plate_no}`:'جاهزة'}</div><div class="pdash-mini">${n(a.remaining_g).toFixed(0)}g · ${esc(a.spool_name||'')}</div></div><div class="pdash-time">${sec!=null?fmtTime(sec):'—'}${finish?`<div class="pdash-mini">${finish}</div>`:''}</div></div>`;}).join('');
      document.getElementById('pdPrinterCount').textContent=`${printing.length} من ${assignments.length} شغالة`;
      const totalPrintMin=plates.reduce((s,p)=>s+Math.max(0,n(p.target_qty)-n(p.completed_qty))*n(p.print_minutes),0),over=plates.reduce((s,p)=>s+Math.max(0,n(p.completed_qty)-n(p.target_qty)),0),lowest=plates.slice().sort((a,b)=>Math.max(0,n(b.target_qty)-n(b.completed_qty))-Math.max(0,n(a.target_qty)-n(a.completed_qty)))[0];
      document.getElementById('pdFacts').innerHTML=`<div class="pdash-fact"><div class="pdash-mini">أكثر Plate ناقص</div><strong>${lowest?`Plate ${lowest.plate_no}`:'—'}</strong><div class="pdash-mini">${lowest?Math.max(0,n(lowest.target_qty)-n(lowest.completed_qty)):0} قطعة</div></div><div class="pdash-fact"><div class="pdash-mini">وقت الطباعة النظري المتبقي</div><strong>${Math.floor(totalPrintMin/60)}س ${totalPrintMin%60}د</strong><div class="pdash-mini">قبل توزيع العمل على الطابعات</div></div><div class="pdash-fact"><div class="pdash-mini">القطع الزائدة عن الهدف</div><strong>${over}</strong><div class="pdash-mini">لا تدخل في نسبة الإنجاز</div></div>`;
    }finally{busy=false;}
  }

  function boot(){style();layout();render();clearInterval(tick);tick=setInterval(render,15000);document.addEventListener('click',e=>{if(e.target.closest('.nav [data-page="dashboard"]'))setTimeout(render,50);});}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();