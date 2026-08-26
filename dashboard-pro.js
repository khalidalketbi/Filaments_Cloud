(() => {
  const cfg = window.APP_CONFIG || {};
  if (!window.supabase || !cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) return;
  const db = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, { auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true} });
  const $ = id => document.getElementById(id);
  const n = v => Number(v)||0;
  const esc = s => String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fg = v => `${Math.round(n(v)).toLocaleString()}g`;
  const pct = s => Math.max(0,Math.min(100,n(s.remaining_weight)/Math.max(1,n(s.total_weight))*100));
  const date = v => v ? new Intl.DateTimeFormat('ar-AE',{dateStyle:'short'}).format(new Date(v)) : '—';
  const time = v => v ? new Intl.DateTimeFormat('ar-AE',{dateStyle:'short',timeStyle:'short'}).format(new Date(v)) : '—';
  const money = v => v==null ? '—' : `${n(v).toLocaleString(undefined,{maximumFractionDigits:2})} AED`;
  const validHex = v => /^#[0-9a-f]{6}$/i.test(String(v||''));
  let timer = null;

  function style(){
    if ($('proDashboardStyle')) return;
    const s=document.createElement('style'); s.id='proDashboardStyle';
    s.textContent=`
      .brand-lockup{display:flex;align-items:center;gap:10px}.brand-lockup img{width:48px;height:48px;border-radius:12px}.brand-copy b{display:block;font-size:18px;line-height:1.1}.brand-copy small{display:block;color:var(--muted);font-size:10px;margin-top:4px;letter-spacing:.04em}
      .pro-kpis{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px;margin-bottom:12px}.pro-kpi{position:relative;overflow:hidden;background:linear-gradient(145deg,var(--panel),var(--card));border:1px solid var(--line);border-radius:16px;padding:14px}.pro-kpi:after{content:'';position:absolute;inset:auto -25px -35px auto;width:90px;height:90px;border-radius:50%;background:color-mix(in srgb,var(--accent) 13%,transparent)}.pro-kpi span{font-size:11px;color:var(--muted)}.pro-kpi strong{display:block;font-size:23px;margin:5px 0 2px}.pro-kpi small{font-size:10px;color:var(--muted)}
      .pro-grid{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(0,1fr) minmax(260px,.7fr);gap:12px}.pro-stack{display:grid;gap:12px}.pro-panel{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:14px;min-width:0}.pro-title{display:flex;gap:8px;align-items:center;margin-bottom:10px}.pro-title b{flex:1}.pro-title span{font-size:11px;color:var(--muted)}
      .pro-materials{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:7px;margin-bottom:12px}.pro-mat{background:var(--card2);border:1px solid var(--line);border-radius:11px;padding:9px}.pro-mat b{display:block;font-size:13px}.pro-mat small{color:var(--muted)}
      .pro-bars{display:grid;gap:9px}.pro-bar-row{display:grid;grid-template-columns:64px 1fr 78px;gap:8px;align-items:center;font-size:11px}.pro-bar-bg{height:9px;border-radius:99px;background:var(--card2);overflow:hidden}.pro-bar-bg i{display:block;height:100%;border-radius:99px;background:linear-gradient(90deg,var(--accent),var(--accent2))}
      .pro-printers{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:8px}.pro-printer{background:var(--card2);border:1px solid var(--line);border-radius:12px;padding:10px}.pro-printer-head{display:flex;align-items:center;gap:7px}.pro-dot{width:8px;height:8px;border-radius:50%;background:var(--accent2)}.pro-printer .bar{margin:8px 0}.pro-mini{font-size:10px;color:var(--muted)}
      .pro-storage{display:grid;gap:8px}.pro-storage-row{display:grid;grid-template-columns:90px 1fr 80px;gap:8px;align-items:center;font-size:11px}.pro-storage-row i{display:block;height:8px;background:var(--accent);border-radius:99px}
      .pro-activity{display:grid;gap:7px}.pro-activity-item{display:flex;gap:8px;align-items:flex-start;padding:8px;background:var(--card2);border-radius:10px;border:1px solid var(--line);font-size:11px}.pro-activity-item .grow{line-height:1.45}.pro-activity-item time{color:var(--muted);font-size:10px;white-space:nowrap}
      .pro-table{overflow:auto;border:1px solid var(--line);border-radius:14px}.pro-table table{min-width:1650px}.pro-table th{font-size:10px}.pro-table td{font-size:11px;vertical-align:middle}.pro-color{width:18px;height:18px;border-radius:50%;border:2px solid #fff7;display:inline-block}.pro-pill{display:inline-flex;border:1px solid var(--line);background:var(--card2);border-radius:999px;padding:3px 7px;font-size:10px}
      .pro-assistant{background:linear-gradient(145deg,color-mix(in srgb,var(--accent) 10%,var(--panel)),var(--panel))}.pro-chart{height:155px;width:100%;display:block}.pro-chart text{fill:var(--muted);font-size:9px}.pro-chart .gridline{stroke:var(--line);stroke-width:1}.pro-chart .line{fill:none;stroke:var(--accent);stroke-width:2.5}.pro-chart .area{fill:color-mix(in srgb,var(--accent) 18%,transparent)}
      @media(max-width:1250px){.pro-kpis{grid-template-columns:repeat(3,1fr)}.pro-grid{grid-template-columns:1fr 1fr}.pro-grid>.pro-stack:last-child{grid-column:1/-1}}
      @media(max-width:760px){.pro-kpis{grid-template-columns:repeat(2,1fr)}.pro-grid{grid-template-columns:1fr}.pro-grid>.pro-stack:last-child{grid-column:auto}.pro-materials{grid-template-columns:repeat(2,1fr)}.brand-lockup img{width:40px;height:40px}.pro-table{margin-left:-2px;margin-right:-2px}}
    `; document.head.appendChild(s);
  }

  function brand(){
    document.title='Filaments Manger';
    const logo=document.querySelector('.sidebar .logo');
    if(logo) logo.innerHTML='<div class="brand-lockup"><img src="/logo.svg" alt="Filaments Manger"><div class="brand-copy"><b>Filaments Manger</b><small>by Khalid Alketbi</small></div></div>';
    const ah=document.querySelector('#authView h1'); if(ah) ah.textContent='Filaments Manger';
    const ap=document.querySelector('#authView > p'); if(ap) ap.textContent='by Khalid Alketbi';
  }

  function layout(){
    const page=$('dashboardPage'); if(!page || page.dataset.pro==='1') return;
    page.dataset.pro='1';
    page.innerHTML=`
      <div class="pro-kpis">
        <div class="pro-kpi"><span>إجمالي السبولات</span><strong id="kpiSpools">0</strong><small id="kpiWarehouse">0 في المخزن</small></div>
        <div class="pro-kpi"><span>إجمالي المتبقي</span><strong id="kpiWeight">0g</strong><small id="kpiCapacity">من 0g</small></div>
        <div class="pro-kpi"><span>الطابعات النشطة</span><strong id="proActivePrinters">0</strong><small id="proPrinterTotal">من 0 طابعات</small></div>
        <div class="pro-kpi"><span>قريب من النفاد</span><strong id="kpiLow">0</strong><small>حسب حد التنبيه</small></div>
        <div class="pro-kpi"><span>قيمة المخزون</span><strong id="kpiValue">—</strong><small>قيمة المتبقي تقريبًا</small></div>
        <div class="pro-kpi"><span>استهلاك 30 يوم</span><strong id="kpiMonthUsed">0g</strong><small id="kpiMonthJobs">0 عمليات</small></div>
      </div>
      <div id="materialChips" class="pro-materials"></div><span id="materialSummary" class="hidden"></span>
      <div class="pro-grid">
        <div class="pro-stack">
          <section class="pro-panel"><div class="pro-title"><b>توزيع المخزون حسب المادة</b><span id="proMaterialTotal"></span></div><div id="proMaterialBars" class="pro-bars"></div></section>
          <section class="pro-panel"><div class="pro-title"><b>استهلاك آخر 30 يوم</b><span>يومي</span></div><svg id="proUsageChart" class="pro-chart" viewBox="0 0 640 155" preserveAspectRatio="none"></svg></section>
          <section class="pro-panel"><div class="pro-title"><b>الطابعات</b><button class="btn secondary small" data-go="printers">عرض الكل</button></div><div id="proPrinterCards" class="pro-printers"></div></section>
        </div>
        <div class="pro-stack">
          <section class="pro-panel"><div class="pro-title"><b>تنبيهات المخزون</b><span>الأولوية الأعلى</span></div><div id="alerts" class="alert-list"></div></section>
          <section class="pro-panel"><div class="pro-title"><b>المخزن والمواقع</b><span id="proStorageTotal"></span></div><div id="proStorage" class="pro-storage"></div></section>
          <section class="pro-panel"><div class="pro-title"><b>آخر السبولات</b><button class="btn secondary small" data-go="spools">عرض الكل</button></div><div id="recentSpools" class="spool-grid" style="grid-template-columns:1fr"></div></section>
        </div>
        <div class="pro-stack">
          <section class="pro-panel pro-assistant assistant"><div class="pro-title section-title"><h2 style="font-size:15px;margin:0">Assistant</h2></div><div id="assistantLog" class="assistant-log"><div class="bubble">اختر تقرير جاهز، أو اسألني عن المخزون والطابعات.</div></div><div class="assistant-row"><input id="assistantInput" placeholder="اكتب طلبك..."><button id="assistantSend" class="btn">إرسال</button></div></section>
          <section class="pro-panel"><div class="pro-title"><b>آخر النشاطات</b><span id="proActivityCount"></span></div><div id="proActivity" class="pro-activity"></div></section>
          <section class="pro-panel"><div class="pro-title"><b>نظرة سريعة</b></div><div id="proQuickFacts" class="pro-bars"></div></section>
        </div>
      </div>
      <section class="pro-panel" style="margin-top:12px"><div class="pro-title"><b>قاعدة بيانات السبولات — تفاصيل كاملة</b><button class="btn secondary small" data-go="spools">إدارة السبولات</button></div><div id="proInventoryTable" class="pro-table"></div></section>`;
  }

  function chart(rows){
    const svg=$('proUsageChart'); if(!svg) return;
    const days=[]; for(let i=29;i>=0;i--){const d=new Date();d.setHours(0,0,0,0);d.setDate(d.getDate()-i);days.push({d,key:d.toISOString().slice(0,10),v:0});}
    const map=new Map(days.map(x=>[x.key,x])); rows.forEach(r=>{const k=new Date(r.created_at).toISOString().slice(0,10);if(map.has(k))map.get(k).v+=n(r.grams_used)});
    const max=Math.max(1,...days.map(x=>x.v)); const W=640,H=155,pad=18;
    const pts=days.map((x,i)=>[pad+i*(W-2*pad)/(days.length-1),H-pad-(x.v/max)*(H-2*pad)]);
    const line=pts.map((p,i)=>`${i?'L':'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
    const area=`M${pad} ${H-pad} `+pts.map(p=>`L${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ')+` L${W-pad} ${H-pad} Z`;
    svg.innerHTML=`<line class="gridline" x1="${pad}" y1="${H-pad}" x2="${W-pad}" y2="${H-pad}"/><line class="gridline" x1="${pad}" y1="${pad}" x2="${W-pad}" y2="${pad}"/><path class="area" d="${area}"/><path class="line" d="${line}"/><text x="${pad}" y="12">${Math.round(max)}g</text><text x="${pad}" y="151">30 يوم</text><text x="${W-pad-35}" y="151">اليوم</text>`;
  }

  async function render(){
    const {data:{session}}=await db.auth.getSession(); if(!session?.user) return;
    const [sr,pr,ur]=await Promise.all([
      db.from('spools').select('*').order('updated_at',{ascending:false}),
      db.from('printers').select('*').order('name'),
      db.from('usage_logs').select('*,spools(name,material,color_hex),printers(name)').order('created_at',{ascending:false}).limit(300)
    ]);
    const spools=(sr.data||[]).filter(s=>!s.archived), printers=pr.data||[], usage=ur.data||[];
    const mounted=new Map(printers.filter(p=>p.loaded_spool_id).map(p=>[p.loaded_spool_id,p]));
    const total=spools.reduce((a,s)=>a+n(s.remaining_weight),0), cap=spools.reduce((a,s)=>a+n(s.total_weight),0);
    const cutoff=Date.now()-30*86400000, month=usage.filter(x=>new Date(x.created_at).getTime()>=cutoff), used30=month.reduce((a,x)=>a+n(x.grams_used),0);
    const low=spools.filter(s=>pct(s)<=20).sort((a,b)=>pct(a)-pct(b));
    const value=spools.reduce((a,s)=>a+(s.purchase_price==null?0:n(s.purchase_price)*n(s.remaining_weight)/Math.max(1,n(s.total_weight))),0);
    if($('kpiSpools'))$('kpiSpools').textContent=spools.length;
    if($('kpiWarehouse'))$('kpiWarehouse').textContent=`${spools.filter(s=>!mounted.has(s.id)).length} في المخزن · ${mounted.size} مركب`;
    if($('kpiWeight'))$('kpiWeight').textContent=fg(total); if($('kpiCapacity'))$('kpiCapacity').textContent=`من ${fg(cap)}`;
    if($('kpiLow'))$('kpiLow').textContent=low.length; if($('kpiValue'))$('kpiValue').textContent=money(value);
    if($('kpiMonthUsed'))$('kpiMonthUsed').textContent=fg(used30); if($('kpiMonthJobs'))$('kpiMonthJobs').textContent=`${month.length} عمليات`;
    if($('proActivePrinters'))$('proActivePrinters').textContent=printers.filter(p=>p.status==='printing').length; if($('proPrinterTotal'))$('proPrinterTotal').textContent=`من ${printers.length} طابعات`;

    const groups={}; spools.forEach(s=>{const k=s.material||'Other';groups[k]??={count:0,g:0};groups[k].count++;groups[k].g+=n(s.remaining_weight)});
    const gs=Object.entries(groups).sort((a,b)=>b[1].g-a[1].g);
    if($('materialChips'))$('materialChips').innerHTML=gs.map(([k,v])=>`<button class="pro-mat" data-material-jump="${esc(k)}"><b>${esc(k)}</b><small>${v.count} سبول · ${fg(v.g)} · ${total?Math.round(v.g/total*100):0}%</small></button>`).join('');
    if($('proMaterialTotal'))$('proMaterialTotal').textContent=`${gs.length} مواد · ${fg(total)}`;
    if($('proMaterialBars'))$('proMaterialBars').innerHTML=gs.map(([k,v])=>`<div class="pro-bar-row"><b>${esc(k)}</b><div class="pro-bar-bg"><i style="width:${total?v.g/total*100:0}%"></i></div><span>${fg(v.g)}</span></div>`).join('')||'<span class="muted">لا توجد بيانات.</span>';
    chart(month);

    if($('alerts'))$('alerts').innerHTML=low.slice(0,7).map(s=>`<div class="alert-item"><span class="pro-color" style="background:${validHex(s.color_hex)?s.color_hex:'#777'}"></span><div class="grow"><b>${esc(s.name)}</b><div class="muted">${fg(s.remaining_weight)} · ${Math.round(pct(s))}% · ${esc(s.material||'')}</div></div><button class="btn secondary small" data-open-spool="${s.id}">فتح</button></div>`).join('')||'<div class="muted">✓ المخزون بحالة جيدة.</div>';

    if($('proPrinterCards'))$('proPrinterCards').innerHTML=printers.map(p=>{const s=spools.find(x=>x.id===p.loaded_spool_id);const left=p.print_ends_at?Math.max(0,new Date(p.print_ends_at)-Date.now()):0;const mins=Math.ceil(left/60000);const status=p.status==='printing'?'تطبع':p.status==='maintenance'?'صيانة':p.status==='offline'?'غير متصلة':'جاهزة';return `<div class="pro-printer"><div class="pro-printer-head"><i class="pro-dot" style="background:${p.status==='printing'?'var(--accent2)':p.status==='maintenance'?'var(--warn)':p.status==='offline'?'var(--danger)':'var(--accent)'}"></i><b class="grow">${esc(p.name)}</b><span class="pro-pill">${status}</span></div><div class="pro-mini" style="margin-top:7px">${esc(p.model||'بدون موديل')}</div>${s?`<div style="margin-top:8px"><b>${esc(s.name)}</b><div class="pro-mini">${esc(s.material||'')} · ${fg(s.remaining_weight)} · ${Math.round(pct(s))}%</div><div class="bar"><i style="width:${pct(s)}%"></i></div></div>`:'<div class="pro-mini" style="margin-top:9px">بدون سبول</div>'}${p.status==='printing'&&p.print_ends_at?`<div class="pro-mini">⏱ باقي ${Math.floor(mins/60)}س ${mins%60}د · النهاية ${new Intl.DateTimeFormat('ar-AE',{timeStyle:'short'}).format(new Date(p.print_ends_at))}</div>`:''}</div>`}).join('')||'<span class="muted">لا توجد طابعات.</span>';

    const loc={}; spools.forEach(s=>{const k=mounted.has(s.id)?'على الطابعات':(s.location_name||'Warehouse');loc[k]=(loc[k]||0)+n(s.remaining_weight)});const ls=Object.entries(loc).sort((a,b)=>b[1]-a[1]);
    if($('proStorageTotal'))$('proStorageTotal').textContent=fg(total);
    if($('proStorage'))$('proStorage').innerHTML=ls.slice(0,8).map(([k,v])=>`<div class="pro-storage-row"><b class="ellipsis">${esc(k)}</b><div class="pro-bar-bg"><i style="width:${total?v/total*100:0}%"></i></div><span>${fg(v)}</span></div>`).join('');

    if($('proActivityCount'))$('proActivityCount').textContent=`آخر ${Math.min(usage.length,8)}`;
    if($('proActivity'))$('proActivity').innerHTML=usage.slice(0,8).map(x=>`<div class="pro-activity-item"><span>↻</span><div class="grow"><b>${esc(x.spools?.name||'سبول')}</b><div class="muted">استخدام ${fg(x.grams_used)}${x.printers?.name?' · '+esc(x.printers.name):''}</div></div><time>${time(x.created_at)}</time></div>`).join('')||'<span class="muted">ما في نشاط بعد.</span>';

    const avg=spools.length?total/spools.length:0;const oldest=[...spools].filter(s=>s.purchase_date).sort((a,b)=>String(a.purchase_date).localeCompare(String(b.purchase_date)))[0];const top=gs[0];
    if($('proQuickFacts'))$('proQuickFacts').innerHTML=`<div class="pro-bar-row"><b>متوسط</b><div class="pro-bar-bg"><i style="width:${cap?total/cap*100:0}%"></i></div><span>${fg(avg)}/سبول</span></div><div class="pro-bar-row"><b>الأكثر</b><div></div><span>${esc(top?.[0]||'—')}</span></div><div class="pro-bar-row"><b>الأقدم</b><div></div><span>${oldest?date(oldest.purchase_date):'—'}</span></div>`;

    const rows=[...spools].sort((a,b)=>new Intl.Collator(['ar','en'],{numeric:true,sensitivity:'base'}).compare(a.name,b.name));
    if($('proInventoryTable'))$('proInventoryTable').innerHTML=`<table><thead><tr><th>الاسم</th><th>الشركة</th><th>المادة</th><th>اللون</th><th>الإجمالي</th><th>المتبقي</th><th>المستخدم</th><th>%</th><th>القطر</th><th>الكثافة</th><th>وزن الفاضي</th><th>السعر</th><th>Lot</th><th>SKU</th><th>الموقع</th><th>النوزل</th><th>البيد</th><th>الشراء</th><th>أول استخدام</th><th>آخر استخدام</th></tr></thead><tbody>${rows.map(s=>`<tr><td><b>${esc(s.name)}</b></td><td>${esc(s.brand||'—')}</td><td>${esc(s.material||'—')}</td><td><span class="pro-color" title="${esc(s.color||'')}" style="background:${validHex(s.color_hex)?s.color_hex:'#777'}"></span></td><td>${fg(s.total_weight)}</td><td>${fg(s.remaining_weight)}</td><td>${fg(n(s.total_weight)-n(s.remaining_weight))}</td><td>${Math.round(pct(s))}%</td><td>${n(s.diameter||1.75)}mm</td><td>${n(s.density||1.24)}</td><td>${fg(s.empty_spool_weight)}</td><td>${money(s.purchase_price)}</td><td>${esc(s.lot_nr||'—')}</td><td>${esc(s.article_number||'—')}</td><td>${esc(mounted.get(s.id)?.name||s.location_name||'Warehouse')}</td><td>${s.nozzle_min??'—'}–${s.nozzle_max??'—'}</td><td>${s.bed_min??'—'}–${s.bed_max??'—'}</td><td>${date(s.purchase_date)}</td><td>${date(s.first_used)}</td><td>${date(s.last_used)}</td></tr>`).join('')}</tbody></table>`;
  }

  function bind(){
    document.addEventListener('click',e=>{const el=e.target.closest('[data-material-jump]');if(!el)return;const b=document.querySelector('.nav button[data-page="spools"]');b?.click();setTimeout(()=>{const f=$('materialFilter');if(f){f.value=el.dataset.materialJump;f.dispatchEvent(new Event('change'));}},60)});
  }
  async function init(){style();brand();layout();bind();await render();if(timer)clearInterval(timer);timer=setInterval(render,30000);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();