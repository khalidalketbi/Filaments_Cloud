(() => {
  const cfg=window.APP_CONFIG||{};
  if(!window.supabase||!cfg.SUPABASE_URL||!cfg.SUPABASE_ANON_KEY)return;
  const db=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num=v=>Number(v)||0;
  let timer=null;

  function duration(sec){sec=Math.max(0,Math.round(num(sec)));const h=Math.floor(sec/3600),m=Math.floor((sec%3600)/60);return h?`${h}س ${m}د`:`${m}د`;}
  function grams(v){return `${num(v).toFixed(1)} g`;}
  function pct(v){return `${Math.round(num(v))}%`;}
  function statusText(v){return v==='printing'?'يطبع':v==='paused'?'متوقف مؤقتًا':v==='offline'?'Offline':v==='error'?'خطأ':'جاهز';}
  function statusColor(v){return v==='printing'?'var(--accent)':v==='paused'?'var(--warn)':v==='offline'||v==='error'?'var(--danger)':'var(--accent2)';}
  function dateTime(v){if(!v)return'—';try{return new Intl.DateTimeFormat('ar-AE',{dateStyle:'short',timeStyle:'short'}).format(new Date(v));}catch{return'—';}}

  function addStyle(){if(document.getElementById('fleetDashboardStyle'))return;const s=document.createElement('style');s.id='fleetDashboardStyle';s.textContent=`
    .fleet-kpis{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px;margin-bottom:14px}.fleet-kpi{background:linear-gradient(145deg,var(--panel),var(--card));border:1px solid var(--line);border-radius:16px;padding:14px}.fleet-kpi span{display:block;color:var(--muted);font-size:11px}.fleet-kpi strong{display:block;font-size:22px;margin-top:5px}.fleet-kpi small{color:var(--muted);font-size:10px}
    .fleet-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.fleet-card{background:var(--panel);border:1px solid var(--line);border-radius:18px;padding:15px}.fleet-head{display:flex;gap:10px;align-items:flex-start;margin-bottom:12px}.fleet-dot{width:9px;height:9px;border-radius:50%;margin-top:7px;flex:none}.fleet-name{font-size:17px;font-weight:900}.fleet-model{color:var(--muted);font-size:11px;margin-top:2px}.fleet-state{margin-right:auto;border:1px solid var(--line);border-radius:999px;padding:4px 8px;font-size:10px}.fleet-current{background:var(--card2);border:1px solid var(--line);border-radius:13px;padding:11px;margin-bottom:11px}.fleet-current-top{display:flex;justify-content:space-between;gap:10px}.fleet-layer{font-weight:900}.fleet-progress{height:7px;background:var(--card);border-radius:99px;overflow:hidden;margin-top:8px}.fleet-progress i{display:block;height:100%;background:var(--accent);border-radius:99px}.fleet-spool{display:flex;gap:9px;align-items:center;background:var(--card2);border:1px solid var(--line);border-radius:13px;padding:10px;margin-bottom:11px}.fleet-swatch{width:30px;height:30px;border-radius:50%;border:2px solid #fff8;flex:none}.fleet-spool strong{display:block}.fleet-spool small{color:var(--muted)}
    .fleet-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:7px}.fleet-stat{background:var(--card2);border:1px solid var(--line);border-radius:11px;padding:9px}.fleet-stat span{display:block;color:var(--muted);font-size:9px}.fleet-stat b{display:block;font-size:14px;margin-top:3px}.fleet-last{margin-top:10px;padding-top:9px;border-top:1px solid var(--line);font-size:10px;color:var(--muted)}
    .fleet-note{margin-bottom:12px;padding:11px 13px;border:1px solid var(--line);background:var(--card2);border-radius:13px;color:var(--muted);font-size:11px}.fleet-note b{color:var(--text)}
    @media(max-width:1150px){.fleet-kpis{grid-template-columns:repeat(3,1fr)}}@media(max-width:760px){.fleet-kpis{grid-template-columns:repeat(2,1fr)}.fleet-grid{grid-template-columns:1fr}.fleet-stats{grid-template-columns:repeat(2,1fr)}}
  `;document.head.appendChild(s);}

  function removeInventoryUI(){
    const spoolsNav=document.querySelector('.nav [data-page="spools"]');if(spoolsNav)spoolsNav.style.display='none';
    const spoolPage=document.getElementById('spoolsPage');if(spoolPage)spoolPage.classList.add('hidden');
    const quick=document.getElementById('quickAdd');if(quick)quick.style.display='none';
    const search=document.querySelector('.topbar .search');if(search)search.style.display='none';
    document.querySelectorAll('[data-go="spools"]').forEach(x=>x.style.display='none');
  }

  function layout(){
    const page=document.getElementById('dashboardPage');if(!page)return false;
    if(page.dataset.fleetV2==='1')return true;
    page.dataset.fleetV2='1';
    page.innerHTML=`<div class="fleet-note"><b>النظام الجديد:</b> لا يوجد مخزن أو Inventory مستقل. يتم تتبع السبول المركب حاليًا على كل طابعة فقط، مع استهلاك الطبعات وإحصائيات تشغيل الطابعات.</div><div id="fleetKpis" class="fleet-kpis"></div><div id="fleetGrid" class="fleet-grid"></div>`;
    return true;
  }

  async function render(){
    removeInventoryUI();addStyle();if(!layout())return;
    const {data:{session}}=await db.auth.getSession();if(!session?.user)return;
    const [pr,sr,ss]=await Promise.all([
      db.from('printers').select('*').order('name'),
      db.from('spools').select('id,name,material,color,color_hex,remaining_weight,total_weight'),
      db.from('printer_print_sessions').select('*').order('started_at',{ascending:false}).limit(3000)
    ]);
    const printers=pr.data||[],spools=sr.data||[],sessions=ss.data||[],spoolMap=new Map(spools.map(s=>[s.id,s]));
    const now=Date.now();
    const totalSec=sessions.reduce((a,x)=>a+(x.ended_at?num(x.duration_seconds):Math.max(0,(now-new Date(x.started_at).getTime())/1000)),0);
    const completed=sessions.filter(x=>x.result==='completed').length,stopped=sessions.filter(x=>x.result==='stopped').length,errors=sessions.filter(x=>x.result==='error').length;
    const totalGrams=sessions.reduce((a,x)=>a+num(x.grams_used),0);
    const active=printers.filter(p=>['printing','paused'].includes(String(p.status||''))).length;
    const successDen=completed+stopped+errors;
    document.getElementById('fleetKpis').innerHTML=`
      <div class="fleet-kpi"><span>إجمالي الطابعات</span><strong>${printers.length}</strong><small>${active} تعمل الآن</small></div>
      <div class="fleet-kpi"><span>إجمالي الطبعات</span><strong>${sessions.length}</strong><small>المسجلة بالنظام الجديد</small></div>
      <div class="fleet-kpi"><span>إجمالي ساعات التشغيل</span><strong>${duration(totalSec)}</strong><small>كل الطابعات</small></div>
      <div class="fleet-kpi"><span>فلمنت مستهلك</span><strong>${grams(totalGrams)}</strong><small>من الجلسات المسجلة</small></div>
      <div class="fleet-kpi"><span>طبعات مكتملة</span><strong>${completed}</strong><small>${stopped} ملغاة · ${errors} أخطاء</small></div>
      <div class="fleet-kpi"><span>نسبة الإكمال</span><strong>${successDen?Math.round(completed/successDen*100):0}%</strong><small>من الطبعات المنتهية</small></div>`;

    document.getElementById('fleetGrid').innerHTML=printers.map(p=>{
      const rows=sessions.filter(x=>x.printer_id===p.id),ended=rows.filter(x=>x.ended_at),live=rows.find(x=>!x.ended_at);
      const seconds=rows.reduce((a,x)=>a+(x.ended_at?num(x.duration_seconds):Math.max(0,(now-new Date(x.started_at).getTime())/1000)),0);
      const avg=ended.length?ended.reduce((a,x)=>a+num(x.duration_seconds),0)/ended.length:0;
      const pg=rows.reduce((a,x)=>a+num(x.grams_used),0),pc=rows.filter(x=>x.result==='completed').length,ps=rows.filter(x=>x.result==='stopped').length,pe=rows.filter(x=>x.result==='error').length;
      const spool=spoolMap.get(p.loaded_spool_id),layer=num(p.layer_num),layers=num(p.total_layers),progress=num(p.print_progress),isPrinting=['printing','paused'].includes(String(p.status||''));
      const last=ended[0]||rows[0]||null;
      const currentName=p.current_file||live?.file_name||'لا توجد طبعة حالية';
      return `<article class="fleet-card"><div class="fleet-head"><i class="fleet-dot" style="background:${statusColor(p.status)}"></i><div><div class="fleet-name">${esc(p.name)}</div><div class="fleet-model">${esc(p.model||'Bambu Lab')}</div></div><span class="fleet-state">${statusText(p.status)}</span></div>
        ${isPrinting?`<div class="fleet-current"><div class="fleet-current-top"><div><b>${esc(currentName)}</b><div class="fleet-model">التقدم ${pct(progress)}</div></div><div class="fleet-layer">Layer ${layer||0} / ${layers||'—'}</div></div><div class="fleet-progress"><i style="width:${Math.max(0,Math.min(100,progress))}%"></i></div></div>`:''}
        <div class="fleet-spool">${spool?`<i class="fleet-swatch" style="background:${esc(spool.color_hex||'#777')}"></i><div><strong>${esc(spool.name||'Spool')} · ${esc(spool.material||'—')}</strong><small>المتبقي المسجل ${grams(spool.remaining_weight)}${isPrinting&&num(p.actual_grams_used)>0?` · استهلاك الطبعة ${grams(p.actual_grams_used)}`:''}</small></div>`:`<div><strong>بدون سبول</strong><small>اربط السبول الموجود حاليًا على هذه الطابعة</small></div>`}</div>
        <div class="fleet-stats"><div class="fleet-stat"><span>عدد الطبعات</span><b>${rows.length}</b></div><div class="fleet-stat"><span>ساعات التشغيل</span><b>${duration(seconds)}</b></div><div class="fleet-stat"><span>متوسط الطبعة</span><b>${duration(avg)}</b></div><div class="fleet-stat"><span>استهلاك الفلمنت</span><b>${grams(pg)}</b></div><div class="fleet-stat"><span>مكتملة</span><b>${pc}</b></div><div class="fleet-stat"><span>ملغاة</span><b>${ps}</b></div><div class="fleet-stat"><span>أخطاء</span><b>${pe}</b></div><div class="fleet-stat"><span>نسبة الإكمال</span><b>${pc+ps+pe?Math.round(pc/(pc+ps+pe)*100):0}%</b></div></div>
        <div class="fleet-last">آخر طبعة: ${last?`${esc(last.file_name||'—')} · ${dateTime(last.ended_at||last.started_at)}`:'لا يوجد سجل بعد'}</div></article>`;
    }).join('')||'<div class="fleet-note">لا توجد طابعات.</div>';
  }

  function boot(){removeInventoryUI();addStyle();setTimeout(render,600);clearInterval(timer);timer=setInterval(render,10000);}
  window.addEventListener('load',boot,{once:true});
  document.addEventListener('click',e=>{if(e.target.closest('[data-page="dashboard"]'))setTimeout(render,100);},true);
  setTimeout(boot,1200);
})();
