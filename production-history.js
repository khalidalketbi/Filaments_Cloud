(() => {
  const cfg=window.APP_CONFIG||{};
  if(!window.supabase||!cfg.SUPABASE_URL||!cfg.SUPABASE_ANON_KEY)return;
  const db=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  const CURRENT_KEY='fm_current_project_id';
  let projectId=null;
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmtDuration=sec=>{sec=Number(sec)||0;const h=Math.floor(sec/3600),m=Math.floor((sec%3600)/60),s=sec%60;return h?`${h}س ${m}د ${s}ث`:`${m}د ${s}ث`;};
  const fmtDate=v=>v?new Intl.DateTimeFormat('ar-AE',{dateStyle:'medium',timeStyle:'short'}).format(new Date(v)):'—';

  function setup(){
    const nav=document.querySelector('.nav [data-page="history"]');
    if(nav) nav.innerHTML='↻ سجل الطباعة';
    const page=document.getElementById('historyPage');
    if(!page)return;
    page.innerHTML=`
      <div class="panel">
        <div class="section-title"><h2>سجل الطباعة حسب الطابعة</h2><button id="prodHistoryRefresh" class="btn secondary small">تحديث</button></div>
        <div class="toolbar"><select id="prodHistoryProject"><option value="">المشروع الحالي</option></select><select id="prodHistoryPrinter"><option value="">كل الطابعات</option></select><select id="prodHistoryPlate"><option value="">كل الـ Plates</option></select></div>
        <div id="prodHistorySummary" class="kpis"></div>
        <div id="prodHistoryList" class="history-list"></div>
        <div id="prodHistoryStatus" class="status"></div>
      </div>`;
    const style=document.createElement('style');style.textContent=`
      #historyPage .history-print{display:grid;grid-template-columns:110px 1fr auto;gap:12px;align-items:center;background:var(--card2);border:1px solid var(--line);border-radius:14px;padding:12px}
      #historyPage .history-printer{font-weight:900;font-size:17px}.history-main{min-width:0}.history-plate{font-weight:800;font-size:15px}.history-meta{color:var(--muted);font-size:12px;margin-top:4px;display:flex;gap:12px;flex-wrap:wrap}.history-time{text-align:left;font-size:12px;color:var(--muted)}
      @media(max-width:700px){#historyPage .history-print{grid-template-columns:70px 1fr}.history-time{grid-column:1/-1;text-align:right}}
    `;document.head.appendChild(style);
    document.getElementById('prodHistoryRefresh').onclick=load;
    document.getElementById('prodHistoryPrinter').onchange=load;
    document.getElementById('prodHistoryPlate').onchange=load;
    document.getElementById('prodHistoryProject').onchange=e=>{
      if(e.target.value){projectId=e.target.value;localStorage.setItem(CURRENT_KEY,projectId);}
      load();
    };
    document.addEventListener('click',e=>{const b=e.target.closest('.nav [data-page="history"]');if(b){projectId=null;setTimeout(load,0);}});
  }

  async function ensureProject(){
    const {data:{session}}=await db.auth.getSession();if(!session?.user)return null;
    const {data,error}=await db.from('production_projects').select('id,name,created_at').eq('user_id',session.user.id).order('created_at',{ascending:false});
    if(error)throw error;
    const projects=data||[];
    const sel=document.getElementById('prodHistoryProject');
    if(sel){
      sel.innerHTML=projects.map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join('');
    }
    const saved=localStorage.getItem(CURRENT_KEY);
    const chosen=projects.find(p=>p.id===saved)||projects[0]||null;
    projectId=chosen?.id||null;
    if(sel&&projectId) sel.value=projectId;
    if(projectId) localStorage.setItem(CURRENT_KEY,projectId);
    return projectId;
  }

  async function load(){
    const st=document.getElementById('prodHistoryStatus');if(!st)return;
    try{
      st.textContent='جاري التحميل…';
      if(!projectId)await ensureProject();
      if(!projectId){st.textContent='لا يوجد مشروع إنتاج.';return;}
      let q=db.from('production_print_history').select('*').eq('project_id',projectId).order('finished_at',{ascending:false}).limit(500);
      const pr=document.getElementById('prodHistoryPrinter').value;
      const pl=document.getElementById('prodHistoryPlate').value;
      if(pr)q=q.eq('printer_name',pr);if(pl)q=q.eq('plate_no',Number(pl));
      const {data,error}=await q;if(error)throw error;const rows=data||[];
      const printers=[...new Set(rows.map(x=>x.printer_name))].sort();
      const plates=[...new Set(rows.map(x=>x.plate_no))].sort((a,b)=>a-b);
      const prSel=document.getElementById('prodHistoryPrinter'),plSel=document.getElementById('prodHistoryPlate');
      const oldPr=prSel.value,oldPl=plSel.value;
      prSel.innerHTML='<option value="">كل الطابعات</option>'+printers.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');
      plSel.innerHTML='<option value="">كل الـ Plates</option>'+plates.map(x=>`<option value="${x}">Plate ${x}</option>`).join('');
      prSel.value=oldPr;plSel.value=oldPl;
      const totalG=rows.reduce((a,x)=>a+Number(x.grams_used||0),0),totalSec=rows.reduce((a,x)=>a+Number(x.actual_seconds||0),0);
      document.getElementById('prodHistorySummary').innerHTML=`<div class="kpi"><span>إجمالي الطبعات</span><strong>${rows.length}</strong></div><div class="kpi"><span>إجمالي الفلمنت</span><strong>${totalG.toFixed(0)}g</strong></div><div class="kpi"><span>إجمالي الوقت</span><strong>${fmtDuration(totalSec)}</strong></div>`;
      const list=document.getElementById('prodHistoryList');
      list.innerHTML=rows.length?rows.map(r=>`<div class="history-print"><div class="history-printer">${esc(r.printer_name)}</div><div class="history-main"><div class="history-plate">Plate ${r.plate_no}</div><div class="history-meta"><span>${Number(r.grams_used||0).toFixed(0)}g</span><span>الوقت: ${fmtDuration(r.actual_seconds)}</span>${r.planned_minutes!=null?`<span>المخطط: ${Math.floor(r.planned_minutes/60)}س ${r.planned_minutes%60}د</span>`:''}</div></div><div class="history-time">${fmtDate(r.finished_at)}</div></div>`).join(''):'<div class="empty">لا توجد طبعات مكتملة مسجلة بعد. أول ما تضغط «خلصت الطبعة» بتظهر هنا.</div>';
      st.textContent='';
    }catch(err){st.textContent='خطأ: '+(err?.message||err);}
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup,{once:true});else setup();
})();