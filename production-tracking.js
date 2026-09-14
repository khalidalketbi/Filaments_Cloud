(() => {
  const cfg = window.APP_CONFIG || {};
  if (!window.supabase || !cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) return;
  const db = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});

  const defaults = [
    [1,57,0],[2,231,10],[3,109,1],[4,129,0],[5,128,0],[6,138,12],[7,47,1],[8,120,1]
  ];
  const defaultPrinters = ['M1','M2','M3','M4','M5','A1','A2'];
  let project = null, plates = [], assignments = [], timer = null;
  const esc = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const n = v => Number(v)||0;
  const plateByNo = no => plates.find(p=>n(p.plate_no)===n(no));

  function injectUI(){
    if(document.getElementById('productionPage')) return;
    const nav = document.querySelector('.nav');
    const settings = nav?.querySelector('[data-page="settings"]');
    const btn = document.createElement('button');
    btn.dataset.page='production'; btn.textContent='▤ الإنتاج';
    if(settings) nav.insertBefore(btn,settings); else nav?.appendChild(btn);

    const main = document.querySelector('main.main');
    const section = document.createElement('section');
    section.id='productionPage'; section.className='page hidden';
    section.innerHTML=`
      <div class="panel">
        <div class="section-title"><h2>مشروع Plate 1–8</h2><span class="muted">10 من كل Plate = 10 أطقم</span></div>
        <div id="prodKpis" class="kpis"></div>
        <div id="prodProgress" class="panel" style="margin-bottom:14px"></div>

        <div class="panel prod-printers-panel">
          <div class="section-title"><h2>الطابعات الآن</h2><span id="prodPrinterSummary" class="muted"></span></div>
          <div id="prodReminderBanner" class="prod-reminder-banner hidden"></div>
          <div id="prodPrinterGrid" class="prod-printer-grid"></div>
        </div>

        <div class="section-title" style="margin-top:18px"><h2>متابعة الـ Plates</h2></div>
        <div id="prodGrid" class="spool-grid"></div>
        <div id="prodStatus" class="status"></div>
      </div>`;
    main?.appendChild(section);

    const style=document.createElement('style'); style.textContent=`
      #productionPage .prod-card,#productionPage .prod-printer-card{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:14px}
      #productionPage .prod-top{display:flex;align-items:center;justify-content:space-between;gap:10px}
      #productionPage .prod-num{font-weight:900;font-size:18px}.prod-done{font-size:24px;font-weight:900}
      #productionPage .prod-controls{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}
      #productionPage .prod-controls label{font-size:10px}.prod-controls input,#productionPage .prod-controls select{min-height:38px;padding:8px}
      #productionPage .prod-save{width:100%;margin-top:9px}.prod-over{color:var(--accent2);font-weight:800}
      #productionPage .prod-progressbar{height:12px;border-radius:99px;background:var(--card2);overflow:hidden;margin-top:8px}.prod-progressbar i{display:block;height:100%;background:var(--accent)}
      #productionPage .prod-printers-panel{margin-bottom:14px}
      #productionPage .prod-printer-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
      #productionPage .prod-printer-card.printing{border-color:color-mix(in srgb,var(--accent2) 55%,var(--line))}
      #productionPage .prod-printer-card.paused{border-color:color-mix(in srgb,var(--warn) 55%,var(--line))}
      #productionPage .printer-state{display:inline-flex;align-items:center;gap:6px;font-size:11px;color:var(--muted)}
      #productionPage .printer-state i{width:8px;height:8px;border-radius:50%;background:var(--muted)}
      #productionPage .printing .printer-state i{background:var(--accent2)}
      #productionPage .paused .printer-state i{background:var(--warn)}
      #productionPage .printer-main-stat{display:flex;justify-content:space-between;align-items:end;margin:10px 0;padding:10px;background:var(--card2);border-radius:12px}
      #productionPage .printer-main-stat strong{font-size:24px}.printer-current{font-size:18px;font-weight:900}
      #productionPage .printer-actions{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:9px}
      #productionPage .printer-actions .finish{background:var(--accent2)}
      #productionPage .printer-warning{margin-top:8px;color:var(--warn);font-size:11px;font-weight:700}
      #productionPage .printer-timer{font-size:18px;font-weight:900;color:var(--accent2);margin-top:9px;min-height:24px;font-variant-numeric:tabular-nums}
      #productionPage .prod-reminder-banner{margin:0 0 12px;padding:12px 14px;border-radius:12px;border:1px solid var(--warn);background:color-mix(in srgb,var(--warn) 12%,var(--card));font-weight:800}
      #productionPage .prod-reminder-banner.hidden{display:none}
      @media(max-width:1100px){#productionPage .prod-printer-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
      @media(max-width:700px){#productionPage .prod-printer-grid{grid-template-columns:1fr}}
    `;document.head.appendChild(style);

    document.addEventListener('click',e=>{
      const b=e.target.closest('.nav [data-page]'); if(!b) return;
      if(b.dataset.page==='production'){
        document.querySelectorAll('.page').forEach(x=>x.classList.add('hidden'));
        section.classList.remove('hidden');
        document.querySelectorAll('.nav button').forEach(x=>x.classList.remove('active')); b.classList.add('active');
        const title=document.getElementById('pageTitle'); if(title) title.textContent='الإنتاج';
        load();
      }
    });
  }

  async function ensureProject(user){
    let {data:p,error:pe}=await db.from('production_projects').select('*').eq('user_id',user.id).eq('name','Plate 1-8').maybeSingle();
    if(pe) throw pe;
    if(!p){
      const r=await db.from('production_projects').insert({user_id:user.id,name:'Plate 1-8',target_sets:10}).select().single();
      if(r.error) throw r.error; p=r.data;
    }
    project=p;

    const q=await db.from('production_plates').select('*').eq('project_id',p.id).order('plate_no');
    if(q.error) throw q.error;
    if((q.data||[]).length===0){
      const rows=defaults.map(([plate_no,weight_g,completed_qty])=>({project_id:p.id,plate_no,weight_g,target_qty:10,completed_qty}));
      const ins=await db.from('production_plates').insert(rows).select(); if(ins.error) throw ins.error; plates=ins.data||[];
    } else plates=q.data||[];

    const aq=await db.from('production_assignments').select('*').eq('project_id',p.id).order('printer_name');
    if(aq.error) throw aq.error;
    if((aq.data||[]).length===0){
      const rows=defaultPrinters.map(printer_name=>({project_id:p.id,printer_name,status:'idle',remaining_g:0}));
      const ins=await db.from('production_assignments').insert(rows).select(); if(ins.error) throw ins.error; assignments=ins.data||[];
    } else assignments=aq.data||[];
  }

  function statusLabel(v){return v==='printing'?'يطبع الآن':v==='paused'?'متوقف مؤقتًا':v==='done'?'منتهية':'جاهزة';}
  function formatRemaining(ms){
    if(ms<=0) return '00:00:00 — انتهى الوقت المتوقع';
    const total=Math.max(0,Math.ceil(ms/1000));
    const h=Math.floor(total/3600), m=Math.floor((total%3600)/60), s=total%60;
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  }

  function showReminder(a,pl){
    const banner=document.getElementById('prodReminderBanner');
    const msg=`⏰ ${a.printer_name}: باقي 10 دقائق تقريبًا على انتهاء Plate ${a.plate_no}`;
    if(banner){banner.textContent=msg;banner.classList.remove('hidden');}
    if('Notification' in window && Notification.permission==='granted'){
      try{new Notification('Filaments Manager',{body:msg,tag:`production-${a.id}-${a.started_at}`});}catch(_){ }
    }
    if(navigator.vibrate) try{navigator.vibrate([200,100,200]);}catch(_){ }
  }

  async function requestNotificationPermission(){
    if(!('Notification' in window) || Notification.permission!=='default') return;
    try{await Notification.requestPermission();}catch(_){ }
  }

  function renderPrinters(){
    const grid=document.getElementById('prodPrinterGrid'); if(!grid) return;
    const printing=assignments.filter(a=>a.status==='printing').length;
    const totalG=assignments.reduce((a,x)=>a+n(x.remaining_g),0);
    document.getElementById('prodPrinterSummary').textContent=`${printing} تطبع الآن · ${totalG.toFixed(0)} g على الطابعات`;

    const options=['<option value="">بدون Plate</option>',...plates.map(p=>`<option value="${p.plate_no}">Plate ${p.plate_no} · ${n(p.weight_g)}g</option>`)].join('');
    grid.innerHTML=assignments.map(a=>{
      const pl=plateByNo(a.plate_no), enough=!pl||n(a.remaining_g)>=n(pl.weight_g);
      const started=a.started_at?new Date(a.started_at).getTime():0;
      const finish=started&&pl?.print_minutes?started+n(pl.print_minutes)*60000:0;
      return `<article class="prod-printer-card ${esc(a.status)}" data-id="${a.id}" data-started="${started||''}" data-duration="${pl?.print_minutes?n(pl.print_minutes)*60000:''}">
        <div class="prod-top"><div class="prod-num">${esc(a.printer_name)}</div><span class="printer-state"><i></i>${statusLabel(a.status)}</span></div>
        <div class="printer-main-stat"><div><span class="muted">الفلمنت المتبقي</span><br><strong>${n(a.remaining_g).toFixed(0)}g</strong></div><div style="text-align:left"><span class="muted">تطبع</span><div class="printer-current">${a.plate_no?`Plate ${a.plate_no}`:'—'}</div></div></div>
        <div class="printer-timer">${a.status==='printing'&&finish?formatRemaining(finish-Date.now()):(a.status==='printing'?'اضغط حفظ لبدء العداد':'')}</div>
        ${!enough?`<div class="printer-warning">⚠ المتبقي لا يكفي لطباعة Plate ${a.plate_no} (${n(pl.weight_g)}g)</div>`:''}
        <div class="prod-controls">
          <label>اسم الطابعة<input class="printer-name" value="${esc(a.printer_name)}" maxlength="40"></label>
          <label>اسم/لون السبول<input class="spool-name" value="${esc(a.spool_name||'')}" maxlength="80" placeholder="PETG Black"></label>
          <label>الجرام المتبقي<input class="remaining-g" type="number" min="0" step="0.1" value="${n(a.remaining_g)}"></label>
          <label>Plate الحالي<select class="plate-no">${options}</select></label>
          <label>الحالة<select class="printer-status"><option value="idle">جاهزة</option><option value="printing">تطبع الآن</option><option value="paused">متوقفة مؤقتًا</option></select></label>
          <label>ملاحظات<input class="printer-notes" value="${esc(a.notes||'')}" maxlength="160"></label>
        </div>
        <div class="printer-actions"><button class="btn secondary small printer-save">حفظ</button><button class="btn small finish printer-finish" ${a.plate_no?'':'disabled'}>✓ خلصت الطبعة</button></div>
      </article>`;
    }).join('');

    assignments.forEach(a=>{
      const card=grid.querySelector(`[data-id="${a.id}"]`); if(!card)return;
      card.querySelector('.plate-no').value=a.plate_no??'';
      card.querySelector('.printer-status').value=a.status==='done'?'idle':a.status;
    });
    grid.querySelectorAll('.printer-save').forEach(b=>b.onclick=savePrinter);
    grid.querySelectorAll('.printer-finish').forEach(b=>b.onclick=finishPrint);
    updateTimers();
  }

  function updateTimers(){
    document.querySelectorAll('#prodPrinterGrid .prod-printer-card').forEach(card=>{
      const a=assignments.find(x=>x.id===card.dataset.id); if(!a||a.status!=='printing') return;
      const pl=plateByNo(a.plate_no), el=card.querySelector('.printer-timer');
      if(!el||!a.started_at||!pl?.print_minutes) return;
      const finish=new Date(a.started_at).getTime()+n(pl.print_minutes)*60000;
      const left=finish-Date.now();
      el.textContent=formatRemaining(left);
      if(left>0 && left<=10*60*1000 && !a.reminder_10m_sent){
        a.reminder_10m_sent=true;
        showReminder(a,pl);
        db.from('production_assignments').update({reminder_10m_sent:true,updated_at:new Date().toISOString()}).eq('id',a.id).then(()=>{});
      }
    });
  }

  function render(){
    const totalTarget=plates.reduce((a,p)=>a+n(p.target_qty),0);
    const completed=plates.reduce((a,p)=>a+n(p.completed_qty),0);
    const capped=plates.reduce((a,p)=>a+Math.min(n(p.completed_qty),n(p.target_qty)),0);
    const remainingQty=plates.reduce((a,p)=>a+Math.max(0,n(p.target_qty)-n(p.completed_qty)),0);
    const remainingG=plates.reduce((a,p)=>a+Math.max(0,n(p.target_qty)-n(p.completed_qty))*n(p.weight_g),0);
    const doneSets=plates.length?Math.min(...plates.map(p=>n(p.completed_qty))):0;
    const remainingMin=plates.reduce((a,p)=>a+Math.max(0,n(p.target_qty)-n(p.completed_qty))*n(p.print_minutes),0);
    const pct=totalTarget?Math.round(capped/totalTarget*100):0;
    document.getElementById('prodKpis').innerHTML=`
      <div class="kpi"><span>المنجز</span><strong>${completed}</strong><small>من ${totalTarget} قطعة</small></div>
      <div class="kpi"><span>الأطقم المكتملة</span><strong>${Math.min(doneSets,10)}</strong><small>من 10 أطقم</small></div>
      <div class="kpi"><span>المتبقي</span><strong>${remainingQty}</strong><small>${remainingG.toFixed(0)} g</small></div>
      <div class="kpi"><span>نسبة الإنجاز</span><strong>${pct}%</strong><small>على أساس 80 قطعة</small></div>
      <div class="kpi"><span>وقت الطباعة المتبقي</span><strong>${remainingMin?`${Math.floor(remainingMin/60)}س ${remainingMin%60}د`:'—'}</strong><small>حسب الأوقات المسجلة</small></div>`;
    document.getElementById('prodProgress').innerHTML=`<b>التقدم الكلي ${pct}%</b><div class="prod-progressbar"><i style="width:${pct}%"></i></div>`;

    renderPrinters();

    document.getElementById('prodGrid').innerHTML=plates.map(p=>{
      const rem=Math.max(0,n(p.target_qty)-n(p.completed_qty)), over=Math.max(0,n(p.completed_qty)-n(p.target_qty));
      return `<div class="prod-card" data-id="${p.id}"><div class="prod-top"><div><div class="prod-num">Plate ${p.plate_no}</div><div class="muted">${n(p.weight_g)} g للقطعة · ${rem} متبقي</div></div><div class="prod-done">${n(p.completed_qty)}/${n(p.target_qty)}</div></div>${over?`<div class="prod-over">+${over} زيادة عن المطلوب</div>`:''}<div class="prod-progressbar"><i style="width:${Math.min(100,n(p.completed_qty)/n(p.target_qty)*100)}%"></i></div><div class="prod-controls"><label>المنجز<input class="qty" type="number" min="0" value="${n(p.completed_qty)}"></label><label>وقت القطعة بالدقائق<input class="mins" type="number" min="0" value="${p.print_minutes??''}" placeholder="مثال 95"></label></div><button class="btn small prod-save">حفظ</button></div>`;
    }).join('');
    document.querySelectorAll('.prod-save').forEach(b=>b.onclick=saveCard);
  }

  async function saveCard(e){
    const card=e.currentTarget.closest('.prod-card'), id=card.dataset.id;
    const completed_qty=Math.max(0,parseInt(card.querySelector('.qty').value||'0',10));
    const raw=card.querySelector('.mins').value.trim(); const print_minutes=raw===''?null:Math.max(0,parseInt(raw,10));
    const st=document.getElementById('prodStatus'); st.textContent='جاري الحفظ…';
    const r=await db.from('production_plates').update({completed_qty,print_minutes,updated_at:new Date().toISOString()}).eq('id',id).select();
    if(r.error){st.textContent='تعذر الحفظ: '+r.error.message;return;} st.textContent='تم الحفظ'; await load();
  }

  async function savePrinter(e){
    const card=e.currentTarget.closest('.prod-printer-card'), id=card.dataset.id;
    const old=assignments.find(x=>x.id===id), status=card.querySelector('.printer-status').value;
    const plateRaw=card.querySelector('.plate-no').value;
    const newPlate=plateRaw?parseInt(plateRaw,10):null;
    const starting=status==='printing' && (!old.started_at || old.status!=='printing' || n(old.plate_no)!==n(newPlate));
    if(starting) await requestNotificationPermission();
    const update={
      printer_name:card.querySelector('.printer-name').value.trim()||old.printer_name,
      spool_name:card.querySelector('.spool-name').value.trim()||null,
      remaining_g:Math.max(0,n(card.querySelector('.remaining-g').value)),
      plate_no:newPlate,
      status,
      notes:card.querySelector('.printer-notes').value.trim()||null,
      updated_at:new Date().toISOString()
    };
    if(starting){update.started_at=new Date().toISOString();update.reminder_10m_sent=false;}
    if(status==='idle'){update.started_at=null;update.reminder_10m_sent=false;}
    const st=document.getElementById('prodStatus'); st.textContent='جاري حفظ الطابعة…';
    const r=await db.from('production_assignments').update(update).eq('id',id).select();
    if(r.error){st.textContent='تعذر الحفظ: '+r.error.message;return;}
    st.textContent=starting?'بدأ العداد التنازلي للطباعة':'تم حفظ الطابعة'; await load();
  }

  async function finishPrint(e){
    const card=e.currentTarget.closest('.prod-printer-card'), id=card.dataset.id;
    const a=assignments.find(x=>x.id===id); if(!a?.plate_no) return;
    const pl=plateByNo(a.plate_no), st=document.getElementById('prodStatus');
    e.currentTarget.disabled=true; st.textContent=`تسجيل اكتمال Plate ${a.plate_no} على ${a.printer_name}…`;
    const r=await db.rpc('complete_production_print',{p_assignment_id:id});
    if(r.error){st.textContent='تعذر تسجيل الاكتمال: '+r.error.message;e.currentTarget.disabled=false;return;}
    st.textContent=`تم: Plate ${a.plate_no} +1، وخصم ${n(pl?.weight_g)}g من ${a.printer_name}`;
    await load();
  }

  async function load(){
    const st=document.getElementById('prodStatus'); if(!st) return;
    const {data:{session}}=await db.auth.getSession(); if(!session?.user){st.textContent='سجل الدخول لعرض المشروع.';return;}
    try{await ensureProject(session.user); render(); st.textContent='';}catch(err){st.textContent='خطأ: '+(err?.message||err);}
  }

  function boot(){injectUI();clearInterval(timer);timer=setInterval(updateTimers,1000);}
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();
})();