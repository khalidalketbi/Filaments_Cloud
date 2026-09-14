(() => {
  const cfg = window.APP_CONFIG || {};
  if (!window.supabase || !cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) return;
  const db = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  const defaultPrinters = ['M1','M2','M3','M4','M5','A1','A2'];
  const currentKey = 'fm_current_project_id';
  let projects = [], project = null, plates = [], assignments = [], timer = null, reminderBusy = new Set();
  const esc = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const n = v => Number(v)||0;
  const plateByNo = no => plates.find(p=>n(p.plate_no)===n(no));
  const fmtHM = mins => `${Math.floor(n(mins)/60)}س ${n(mins)%60}د`;

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
        <div class="project-toolbar">
          <div class="project-select-wrap"><label>المشروع الحالي<select id="projectSelect"></select></label></div>
          <button id="newProjectBtn" class="btn">+ مشروع جديد</button>
          <button id="editProjectBtn" class="btn secondary">تعديل المشروع</button>
        </div>
        <div class="section-title"><h2 id="projectTitle">المشروع</h2><span id="projectMeta" class="muted"></span></div>
        <div id="prodKpis" class="kpis"></div>
        <div id="prodProgress" class="panel" style="margin-bottom:14px"></div>
        <div class="panel prod-printers-panel">
          <div class="section-title"><h2>الطابعات الآن</h2><span id="prodPrinterSummary" class="muted"></span></div>
          <div id="prodPrinterGrid" class="prod-printer-grid"></div>
        </div>
        <div class="section-title" style="margin-top:18px"><h2>متابعة الـ Plates</h2></div>
        <div id="prodGrid" class="spool-grid"></div>
        <div id="prodStatus" class="status"></div>
      </div>`;
    main?.appendChild(section);

    const modal=document.createElement('div');
    modal.id='projectManagerModal'; modal.className='modal';
    modal.innerHTML=`<div class="dialog project-dialog">
      <h2 id="projectModalTitle">مشروع جديد</h2>
      <div class="form-grid project-head-fields">
        <label class="span2">اسم المشروع<input id="pmName" maxlength="80" placeholder="مثال: طلبية xBloom"></label>
        <label>عدد الأطقم المطلوبة<input id="pmTargetSets" type="number" min="1" max="999" value="10"></label>
        <label>عدد الـ Plates<input id="pmPlateCount" type="number" min="1" max="50" value="8"></label>
      </div>
      <div class="section-title" style="margin-top:16px"><h2>بيانات الـ Plates</h2><span class="muted">الوزن + وقت الطباعة لكل Plate</span></div>
      <div id="pmPlateRows" class="pm-plate-rows"></div>
      <div id="pmStatus" class="status"></div>
      <div class="dialog-actions"><button id="pmCancel" class="btn secondary">إلغاء</button><button id="pmSave" class="btn">حفظ المشروع</button></div>
    </div>`;
    document.body.appendChild(modal);

    const style=document.createElement('style'); style.textContent=`
      #productionPage .project-toolbar{display:flex;gap:8px;align-items:end;flex-wrap:wrap;margin-bottom:14px}
      #productionPage .project-select-wrap{min-width:240px;flex:1}
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
      #productionPage .printer-timer{font-size:22px;color:var(--accent2);font-weight:900;margin-top:10px;min-height:28px;font-variant-numeric:tabular-nums}
      #productionPage .printer-timer.overdue{color:var(--warn)}
      #productionPage .ten-warning{margin-top:7px;padding:8px 10px;border:1px solid color-mix(in srgb,var(--warn) 55%,var(--line));background:color-mix(in srgb,var(--warn) 10%,var(--card2));border-radius:10px;font-size:11px;font-weight:800}
      #projectManagerModal .project-dialog{width:min(920px,100%)}
      #projectManagerModal .pm-plate-rows{display:grid;gap:8px;max-height:48vh;overflow:auto;padding-left:2px}
      #projectManagerModal .pm-row{display:grid;grid-template-columns:80px 1fr 1fr 1fr;gap:8px;align-items:end;background:var(--card2);border:1px solid var(--line);border-radius:12px;padding:10px}
      #projectManagerModal .pm-row b{align-self:center}
      @media(max-width:1100px){#productionPage .prod-printer-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
      @media(max-width:700px){#productionPage .prod-printer-grid{grid-template-columns:1fr}#projectManagerModal .pm-row{grid-template-columns:70px 1fr 1fr}.pm-row .pm-mins{grid-column:2/-1}}
    `;document.head.appendChild(style);

    document.addEventListener('click',e=>{
      const b=e.target.closest('.nav [data-page]'); if(!b) return;
      if(b.dataset.page==='production'){
        document.querySelectorAll('.page').forEach(x=>x.classList.add('hidden'));
        section.classList.remove('hidden');
        document.querySelectorAll('.nav button').forEach(x=>x.classList.remove('active')); b.classList.add('active');
        const title=document.getElementById('pageTitle'); if(title) title.textContent='الإنتاج';
        loadProjectsAndCurrent();
      }
    });

    document.getElementById('projectSelect').addEventListener('change', async e=>{
      localStorage.setItem(currentKey,e.target.value); await loadProject(e.target.value);
    });
    document.getElementById('newProjectBtn').onclick=()=>openProjectModal(null);
    document.getElementById('editProjectBtn').onclick=()=>project&&openProjectModal(project);
    document.getElementById('pmCancel').onclick=()=>modal.classList.remove('show');
    document.getElementById('pmPlateCount').addEventListener('input',renderProjectRows);
    document.getElementById('pmSave').onclick=saveProjectFromModal;
  }

  async function getSession(){ const {data:{session}}=await db.auth.getSession(); return session; }

  async function loadProjectsAndCurrent(){
    const st=document.getElementById('prodStatus'); if(!st)return;
    const session=await getSession(); if(!session?.user){st.textContent='سجل الدخول لعرض المشاريع.';return;}
    const q=await db.from('production_projects').select('*').eq('user_id',session.user.id).order('created_at');
    if(q.error){st.textContent='خطأ: '+q.error.message;return;}
    projects=q.data||[];
    if(!projects.length){
      project=null; plates=[]; assignments=[]; renderProjectSelect(); renderEmpty(); openProjectModal(null); return;
    }
    renderProjectSelect();
    let id=localStorage.getItem(currentKey);
    if(!projects.some(p=>p.id===id)) id=projects[0].id;
    localStorage.setItem(currentKey,id);
    document.getElementById('projectSelect').value=id;
    await loadProject(id);
  }

  function renderProjectSelect(){
    const s=document.getElementById('projectSelect'); if(!s)return;
    s.innerHTML=projects.map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join('');
  }

  async function ensureAssignments(p){
    const aq=await db.from('production_assignments').select('*').eq('project_id',p.id).order('printer_name');
    if(aq.error) throw aq.error;
    if((aq.data||[]).length===0){
      const rows=defaultPrinters.map(printer_name=>({project_id:p.id,printer_name,status:'idle',remaining_g:0}));
      const ins=await db.from('production_assignments').insert(rows).select(); if(ins.error) throw ins.error; assignments=ins.data||[];
    } else assignments=aq.data||[];
  }

  async function loadProject(id){
    const st=document.getElementById('prodStatus');
    project=projects.find(p=>p.id===id); if(!project){renderEmpty();return;}
    try{
      const pq=await db.from('production_plates').select('*').eq('project_id',id).order('plate_no'); if(pq.error)throw pq.error; plates=pq.data||[];
      await ensureAssignments(project);
      render(); if(st)st.textContent='';
    }catch(err){if(st)st.textContent='خطأ: '+(err?.message||err);}
  }

  function renderEmpty(){
    document.getElementById('projectTitle').textContent='لا يوجد مشروع';
    document.getElementById('projectMeta').textContent='أنشئ مشروعك الأول';
    document.getElementById('prodKpis').innerHTML=''; document.getElementById('prodProgress').innerHTML='';
    document.getElementById('prodPrinterGrid').innerHTML=''; document.getElementById('prodGrid').innerHTML='<div class="empty">اضغط + مشروع جديد</div>';
  }

  function openProjectModal(p){
    const modal=document.getElementById('projectManagerModal'); modal.dataset.projectId=p?.id||'';
    document.getElementById('projectModalTitle').textContent=p?'تعديل المشروع':'مشروع جديد';
    document.getElementById('pmName').value=p?.name||'';
    document.getElementById('pmTargetSets').value=p?.target_sets||10;
    document.getElementById('pmPlateCount').value=p?Math.max(1,plates.length):8;
    modal.dataset.editRows=p?JSON.stringify(plates.map(x=>({plate_no:x.plate_no,weight_g:x.weight_g,print_minutes:x.print_minutes,completed_qty:x.completed_qty,target_qty:x.target_qty}))):'[]';
    document.getElementById('pmStatus').textContent=''; renderProjectRows(); modal.classList.add('show');
  }

  function renderProjectRows(){
    const count=Math.min(50,Math.max(1,parseInt(document.getElementById('pmPlateCount').value||'1',10)));
    const old=JSON.parse(document.getElementById('projectManagerModal').dataset.editRows||'[]');
    const wrap=document.getElementById('pmPlateRows');
    wrap.innerHTML=Array.from({length:count},(_,i)=>{
      const no=i+1, row=old.find(x=>n(x.plate_no)===no)||{};
      const mins=n(row.print_minutes), h=Math.floor(mins/60), m=mins%60;
      return `<div class="pm-row" data-plate="${no}"><b>Plate ${no}</b><label>الوزن g<input class="pm-weight" type="number" min="0" step="0.1" value="${row.weight_g??''}" placeholder="120"></label><label>الساعات<input class="pm-hours" type="number" min="0" max="99" value="${row.print_minutes!=null?h:''}" placeholder="2"></label><label class="pm-mins">الدقائق<input class="pm-minutes" type="number" min="0" max="59" value="${row.print_minutes!=null?m:''}" placeholder="35"></label></div>`;
    }).join('');
  }

  async function saveProjectFromModal(){
    const modal=document.getElementById('projectManagerModal'), st=document.getElementById('pmStatus');
    const session=await getSession(); if(!session?.user)return;
    const name=document.getElementById('pmName').value.trim(), target_sets=Math.max(1,parseInt(document.getElementById('pmTargetSets').value||'10',10));
    const count=Math.min(50,Math.max(1,parseInt(document.getElementById('pmPlateCount').value||'1',10)));
    if(!name){st.textContent='اكتب اسم المشروع.';return;}
    const rows=[...document.querySelectorAll('#pmPlateRows .pm-row')].map(r=>{
      const h=Math.max(0,parseInt(r.querySelector('.pm-hours').value||'0',10)), m=Math.min(59,Math.max(0,parseInt(r.querySelector('.pm-minutes').value||'0',10)));
      return {plate_no:parseInt(r.dataset.plate,10),weight_g:Math.max(0,n(r.querySelector('.pm-weight').value)),print_minutes:h*60+m};
    });
    if(rows.some(r=>r.weight_g<=0)){st.textContent='حط وزن أكبر من 0 لكل Plate.';return;}
    if(rows.some(r=>r.print_minutes<=0)){st.textContent='حط وقت الطباعة لكل Plate.';return;}
    st.textContent='جاري الحفظ…';
    try{
      let pid=modal.dataset.projectId;
      if(pid){
        const up=await db.from('production_projects').update({name,target_sets,updated_at:new Date().toISOString()}).eq('id',pid).select().single(); if(up.error)throw up.error;
        const existing=plates;
        const forbidden=existing.filter(x=>n(x.plate_no)>count && n(x.completed_qty)>0);
        if(forbidden.length) throw new Error(`لا يمكن تقليل عدد الـ Plates لأن Plate ${forbidden.map(x=>x.plate_no).join(', ')} فيه إنتاج مسجل.`);
        for(const r of rows){
          const ex=existing.find(x=>n(x.plate_no)===r.plate_no);
          if(ex){const u=await db.from('production_plates').update({weight_g:r.weight_g,print_minutes:r.print_minutes,target_qty:target_sets,updated_at:new Date().toISOString()}).eq('id',ex.id);if(u.error)throw u.error;}
          else {const ins=await db.from('production_plates').insert({project_id:pid,plate_no:r.plate_no,weight_g:r.weight_g,print_minutes:r.print_minutes,target_qty:target_sets,completed_qty:0});if(ins.error)throw ins.error;}
        }
        const removable=existing.filter(x=>n(x.plate_no)>count&&n(x.completed_qty)===0);
        if(removable.length){const del=await db.from('production_plates').delete().in('id',removable.map(x=>x.id));if(del.error)throw del.error;}
      }else{
        const ins=await db.from('production_projects').insert({user_id:session.user.id,name,target_sets}).select().single(); if(ins.error)throw ins.error; pid=ins.data.id;
        const pRows=rows.map(r=>({...r,project_id:pid,target_qty:target_sets,completed_qty:0}));
        const pi=await db.from('production_plates').insert(pRows); if(pi.error)throw pi.error;
        const ai=await db.from('production_assignments').insert(defaultPrinters.map(printer_name=>({project_id:pid,printer_name,status:'idle',remaining_g:0}))); if(ai.error)throw ai.error;
      }
      localStorage.setItem(currentKey,pid); modal.classList.remove('show'); await loadProjectsAndCurrent();
    }catch(err){st.textContent='تعذر الحفظ: '+(err?.message||err);}
  }

  function statusLabel(v){return v==='printing'?'يطبع الآن':v==='paused'?'متوقف مؤقتًا':'جاهزة';}
  function countdown(ms){
    const neg=ms<0, t=Math.abs(Math.floor(ms/1000)), h=Math.floor(t/3600), m=Math.floor((t%3600)/60), s=t%60;
    const str=[h,m,s].map(x=>String(x).padStart(2,'0')).join(':'); return neg?`+${str}`:str;
  }

  async function maybeReminder(a,pl,remainingMs,card){
    if(a.reminder_10m_sent||remainingMs>600000||remainingMs<=0||reminderBusy.has(a.id))return;
    reminderBusy.add(a.id);
    const r=await db.from('production_assignments').update({reminder_10m_sent:true,updated_at:new Date().toISOString()}).eq('id',a.id).select();
    reminderBusy.delete(a.id); if(r.error)return; a.reminder_10m_sent=true;
    const warning=card?.querySelector('.ten-warning'); if(warning){warning.classList.remove('hidden');warning.textContent=`⏰ ${a.printer_name} - Plate ${a.plate_no} بيخلص خلال 10 دقائق`;}
    if('Notification' in window && Notification.permission==='granted') new Notification('الطباعة قربت تخلص',{body:`${a.printer_name} • Plate ${a.plate_no} • باقي أقل من 10 دقائق`});
  }

  function renderPrinters(){
    const grid=document.getElementById('prodPrinterGrid'); if(!grid)return;
    const printing=assignments.filter(a=>a.status==='printing').length, totalG=assignments.reduce((a,x)=>a+n(x.remaining_g),0);
    document.getElementById('prodPrinterSummary').textContent=`${printing} تطبع الآن · ${totalG.toFixed(0)} g على الطابعات`;
    const options=['<option value="">بدون Plate</option>',...plates.map(p=>`<option value="${p.plate_no}">Plate ${p.plate_no} · ${n(p.weight_g)}g · ${fmtHM(p.print_minutes)}</option>`)].join('');
    grid.innerHTML=assignments.map(a=>{
      const pl=plateByNo(a.plate_no), enough=!pl||n(a.remaining_g)>=n(pl.weight_g);
      return `<article class="prod-printer-card ${esc(a.status)}" data-id="${a.id}">
        <div class="prod-top"><div class="prod-num">${esc(a.printer_name)}</div><span class="printer-state"><i></i>${statusLabel(a.status)}</span></div>
        <div class="printer-main-stat"><div><span class="muted">الفلمنت المتبقي</span><br><strong>${n(a.remaining_g).toFixed(0)}g</strong></div><div style="text-align:left"><span class="muted">تطبع</span><div class="printer-current">${a.plate_no?`Plate ${a.plate_no}`:'—'}</div></div></div>
        <div class="printer-timer"></div><div class="ten-warning hidden"></div>
        ${!enough?`<div class="printer-warning">⚠ المتبقي لا يكفي لطباعة Plate ${a.plate_no} (${n(pl.weight_g)}g)</div>`:''}
        <div class="prod-controls"><label>اسم الطابعة<input class="printer-name" value="${esc(a.printer_name)}"></label><label>اسم/لون السبول<input class="spool-name" value="${esc(a.spool_name||'')}" placeholder="PETG Black"></label><label>الجرام المتبقي<input class="remaining-g" type="number" min="0" step="0.1" value="${n(a.remaining_g)}"></label><label>Plate الحالي<select class="plate-no">${options}</select></label><label>الحالة<select class="printer-status"><option value="idle">جاهزة</option><option value="printing">تطبع الآن</option><option value="paused">متوقفة مؤقتًا</option></select></label><label>ملاحظات<input class="printer-notes" value="${esc(a.notes||'')}"></label></div>
        <div class="printer-actions"><button class="btn secondary small printer-save">حفظ</button><button class="btn small finish printer-finish" ${a.plate_no?'':'disabled'}>✓ خلصت الطبعة</button></div>
      </article>`;
    }).join('');
    assignments.forEach(a=>{const card=grid.querySelector(`[data-id="${a.id}"]`);if(!card)return;card.querySelector('.plate-no').value=a.plate_no??'';card.querySelector('.printer-status').value=a.status==='done'?'idle':a.status;});
    grid.querySelectorAll('.printer-save').forEach(b=>b.onclick=savePrinter); grid.querySelectorAll('.printer-finish').forEach(b=>b.onclick=finishPrint); updateTimers();
  }

  function updateTimers(){
    document.querySelectorAll('#prodPrinterGrid .prod-printer-card').forEach(card=>{
      const a=assignments.find(x=>x.id===card.dataset.id), el=card.querySelector('.printer-timer'); if(!a||!el)return;
      if(a.status!=='printing'){el.textContent='';return;}
      const pl=plateByNo(a.plate_no); if(!pl?.print_minutes||!a.started_at){el.textContent='وقت البداية غير مسجل';return;}
      const remain=new Date(a.started_at).getTime()+n(pl.print_minutes)*60000-Date.now(); el.textContent=countdown(remain); el.classList.toggle('overdue',remain<0); maybeReminder(a,pl,remain,card);
    });
  }

  function render(){
    const totalTarget=plates.reduce((a,p)=>a+n(p.target_qty),0), completed=plates.reduce((a,p)=>a+n(p.completed_qty),0), capped=plates.reduce((a,p)=>a+Math.min(n(p.completed_qty),n(p.target_qty)),0);
    const remainingQty=plates.reduce((a,p)=>a+Math.max(0,n(p.target_qty)-n(p.completed_qty)),0), remainingG=plates.reduce((a,p)=>a+Math.max(0,n(p.target_qty)-n(p.completed_qty))*n(p.weight_g),0);
    const doneSets=plates.length?Math.min(...plates.map(p=>n(p.completed_qty))):0, remainingMin=plates.reduce((a,p)=>a+Math.max(0,n(p.target_qty)-n(p.completed_qty))*n(p.print_minutes),0), pct=totalTarget?Math.round(capped/totalTarget*100):0;
    document.getElementById('projectTitle').textContent=project.name; document.getElementById('projectMeta').textContent=`${plates.length} Plates · ${project.target_sets} أطقم`;
    document.getElementById('prodKpis').innerHTML=`<div class="kpi"><span>المنجز</span><strong>${completed}</strong><small>من ${totalTarget} قطعة</small></div><div class="kpi"><span>الأطقم المكتملة</span><strong>${Math.min(doneSets,n(project.target_sets))}</strong><small>من ${project.target_sets} أطقم</small></div><div class="kpi"><span>المتبقي</span><strong>${remainingQty}</strong><small>${remainingG.toFixed(0)} g</small></div><div class="kpi"><span>نسبة الإنجاز</span><strong>${pct}%</strong><small>حسب هدف المشروع</small></div><div class="kpi"><span>وقت الطباعة المتبقي</span><strong>${fmtHM(remainingMin)}</strong><small>إجمالي أوقات القطع المتبقية</small></div>`;
    document.getElementById('prodProgress').innerHTML=`<b>التقدم الكلي ${pct}%</b><div class="prod-progressbar"><i style="width:${pct}%"></i></div>`;
    renderPrinters();
    document.getElementById('prodGrid').innerHTML=plates.map(p=>{const rem=Math.max(0,n(p.target_qty)-n(p.completed_qty)),over=Math.max(0,n(p.completed_qty)-n(p.target_qty));return `<div class="prod-card" data-id="${p.id}"><div class="prod-top"><div><div class="prod-num">Plate ${p.plate_no}</div><div class="muted">${n(p.weight_g)}g · ${fmtHM(p.print_minutes)} · ${rem} متبقي</div></div><div class="prod-done">${n(p.completed_qty)}/${n(p.target_qty)}</div></div>${over?`<div class="prod-over">+${over} زيادة</div>`:''}<div class="prod-progressbar"><i style="width:${Math.min(100,n(p.completed_qty)/n(p.target_qty)*100)}%"></i></div><div class="prod-controls"><label>المنجز<input class="qty" type="number" min="0" value="${n(p.completed_qty)}"></label><label>الوزن g<input class="weight" type="number" min="0" step="0.1" value="${n(p.weight_g)}"></label><label>وقت بالساعات<input class="hours" type="number" min="0" value="${Math.floor(n(p.print_minutes)/60)}"></label><label>الدقائق<input class="mins" type="number" min="0" max="59" value="${n(p.print_minutes)%60}"></label></div><button class="btn small prod-save">حفظ Plate</button></div>`;}).join('');
    document.querySelectorAll('.prod-save').forEach(b=>b.onclick=saveCard);
  }

  async function saveCard(e){
    const card=e.currentTarget.closest('.prod-card'), id=card.dataset.id, completed_qty=Math.max(0,parseInt(card.querySelector('.qty').value||'0',10)), weight_g=Math.max(0,n(card.querySelector('.weight').value));
    const print_minutes=Math.max(0,parseInt(card.querySelector('.hours').value||'0',10))*60+Math.min(59,Math.max(0,parseInt(card.querySelector('.mins').value||'0',10)));
    const st=document.getElementById('prodStatus'); st.textContent='جاري الحفظ…'; const r=await db.from('production_plates').update({completed_qty,weight_g,print_minutes,updated_at:new Date().toISOString()}).eq('id',id).select();
    if(r.error){st.textContent='تعذر الحفظ: '+r.error.message;return;} st.textContent='تم الحفظ'; await loadProject(project.id);
  }

  async function savePrinter(e){
    const card=e.currentTarget.closest('.prod-printer-card'), id=card.dataset.id, old=assignments.find(x=>x.id===id), status=card.querySelector('.printer-status').value, plateRaw=card.querySelector('.plate-no').value, newPlate=plateRaw?parseInt(plateRaw,10):null;
    const update={printer_name:card.querySelector('.printer-name').value.trim()||old.printer_name,spool_name:card.querySelector('.spool-name').value.trim()||null,remaining_g:Math.max(0,n(card.querySelector('.remaining-g').value)),plate_no:newPlate,status,notes:card.querySelector('.printer-notes').value.trim()||null,updated_at:new Date().toISOString()};
    if(status==='printing' && (old.status!=='printing'||!old.started_at||n(old.plate_no)!==n(newPlate))){update.started_at=new Date().toISOString();update.reminder_10m_sent=false;}
    if(status==='idle'){update.started_at=null;update.reminder_10m_sent=false;}
    const st=document.getElementById('prodStatus'); st.textContent='جاري حفظ الطابعة…'; const r=await db.from('production_assignments').update(update).eq('id',id).select();
    if(r.error){st.textContent='تعذر الحفظ: '+r.error.message;return;}
    if(status==='printing'&&'Notification' in window&&Notification.permission==='default'){try{await Notification.requestPermission();}catch{}}
    st.textContent='تم حفظ الطابعة'; await loadProject(project.id);
  }

  async function finishPrint(e){
    const card=e.currentTarget.closest('.prod-printer-card'), id=card.dataset.id, a=assignments.find(x=>x.id===id); if(!a?.plate_no)return;
    const pl=plateByNo(a.plate_no), st=document.getElementById('prodStatus'); e.currentTarget.disabled=true; st.textContent=`تسجيل Plate ${a.plate_no}…`;
    const r=await db.rpc('complete_production_print',{p_assignment_id:id}); if(r.error){st.textContent='تعذر تسجيل الاكتمال: '+r.error.message;e.currentTarget.disabled=false;return;}
    st.textContent=`تم Plate ${a.plate_no} وخصم ${n(pl?.weight_g)}g`; await loadProject(project.id);
  }

  function boot(){injectUI();clearInterval(timer);timer=setInterval(updateTimers,1000);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();