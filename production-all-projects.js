(() => {
  const cfg=window.APP_CONFIG||{};
  if(!window.supabase||!cfg.SUPABASE_URL||!cfg.SUPABASE_ANON_KEY)return;
  const db=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  const MODE_KEY='fm_project_view_mode';
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const n=v=>Number(v)||0;

  function style(){
    if(document.getElementById('allProjectsStyle'))return;
    const s=document.createElement('style');s.id='allProjectsStyle';s.textContent=`
      #allProjectsView{display:grid;gap:14px}
      #allProjectsView .ap-head{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
      #allProjectsView .ap-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
      #allProjectsView .ap-kpi{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:12px}
      #allProjectsView .ap-kpi span{font-size:11px;color:var(--muted)}#allProjectsView .ap-kpi strong{display:block;font-size:24px;margin-top:4px}
      #allProjectsView .ap-project{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:14px}
      #allProjectsView .ap-project-title{display:flex;justify-content:space-between;gap:8px;align-items:center;margin-bottom:10px}
      #allProjectsView .ap-printers{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
      #allProjectsView .ap-printer{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:12px}
      #allProjectsView .ap-printer.printing{border-color:color-mix(in srgb,var(--accent2) 55%,var(--line))}
      #allProjectsView .ap-printer-top{display:flex;justify-content:space-between;gap:8px;align-items:center}
      #allProjectsView .ap-printer-name{font-size:18px;font-weight:900}
      #allProjectsView .ap-state{font-size:11px;color:var(--muted)}
      #allProjectsView .ap-main{display:flex;justify-content:space-between;gap:10px;align-items:end;margin-top:9px}
      #allProjectsView .ap-plate{font-size:18px;font-weight:900}.ap-grams{font-size:20px;font-weight:900}
      #allProjectsView .ap-meta{font-size:11px;color:var(--muted);margin-top:4px}
      @media(max-width:760px){#allProjectsView .ap-summary{grid-template-columns:1fr 1fr}#allProjectsView .ap-printers{grid-template-columns:1fr}}
    `;document.head.appendChild(s);
  }

  function secondsUntilDone(a,pmap){
    if(a.status!=='printing')return null;
    if(a.manual_time_override&&a.manual_finish_at)return Math.max(0,Math.floor((new Date(a.manual_finish_at).getTime()-Date.now())/1000));
    const p=pmap.get(`${a.project_id}:${a.plate_no}`);
    if(!a.started_at||!p?.print_minutes)return null;
    return Math.max(0,Math.floor((new Date(a.started_at).getTime()+n(p.print_minutes)*60000-Date.now())/1000));
  }
  function fmt(sec){if(sec==null)return '—';const h=Math.floor(sec/3600),m=Math.floor((sec%3600)/60);return `${h?`${h}س `:''}${m}د`;}

  async function render(){
    if(localStorage.getItem(MODE_KEY)!=='all')return;
    const page=document.getElementById('productionPage');
    if(!page)return;
    const base=page.querySelector(':scope > .panel');
    if(base)base.style.display='none';
    let view=document.getElementById('allProjectsView');
    if(!view){view=document.createElement('div');view.id='allProjectsView';page.appendChild(view);}
    view.innerHTML='<div class="panel">جاري تحميل جميع المشاريع والطابعات…</div>';

    const {data:{session}}=await db.auth.getSession();if(!session?.user)return;
    const pr=await db.from('production_projects').select('*').eq('user_id',session.user.id).order('created_at');
    const projects=pr.data||[];
    if(!projects.length){view.innerHTML='<div class="panel">لا توجد مشاريع.</div>';return;}
    const ids=projects.map(p=>p.id);
    const [ar,plr]=await Promise.all([
      db.from('production_assignments').select('*').in('project_id',ids).order('printer_name'),
      db.from('production_plates').select('*').in('project_id',ids)
    ]);
    const assignments=ar.data||[], plates=plr.data||[];
    const pmap=new Map(plates.map(p=>[`${p.project_id}:${p.plate_no}`,p]));
    const printing=assignments.filter(a=>a.status==='printing').length;
    const grams=assignments.reduce((s,a)=>s+n(a.remaining_g),0);
    const activeProjects=projects.filter(p=>assignments.some(a=>a.project_id===p.id&&a.status==='printing')).length;

    view.innerHTML=`
      <div class="ap-head"><div><h2 style="margin:0">جميع المشاريع</h2><div class="muted">كل الطابعات من كل المشاريع في شاشة واحدة</div></div></div>
      <div class="ap-summary">
        <div class="ap-kpi"><span>المشاريع</span><strong>${projects.length}</strong></div>
        <div class="ap-kpi"><span>إجمالي الطابعات</span><strong>${assignments.length}</strong></div>
        <div class="ap-kpi"><span>تطبع الآن</span><strong>${printing}</strong></div>
        <div class="ap-kpi"><span>الفلمنت على الطابعات</span><strong>${grams.toFixed(0)}g</strong></div>
      </div>
      ${projects.map(p=>{
        const list=assignments.filter(a=>a.project_id===p.id);
        const run=list.filter(a=>a.status==='printing').length;
        return `<section class="ap-project"><div class="ap-project-title"><div><b style="font-size:20px">${esc(p.name)}</b><div class="ap-meta">${run} تطبع الآن · ${list.length} طابعات</div></div></div><div class="ap-printers">${list.length?list.map(a=>{
          const sec=secondsUntilDone(a,pmap);
          const finish=sec!=null?new Date(Date.now()+sec*1000).toLocaleTimeString('ar-AE',{hour:'numeric',minute:'2-digit',hour12:true}):'';
          return `<div class="ap-printer ${a.status==='printing'?'printing':''}"><div class="ap-printer-top"><div class="ap-printer-name">${esc(a.printer_name)}</div><div class="ap-state">${a.status==='printing'?'🟢 يطبع الآن':a.status==='paused'?'🟠 متوقفة':'⚪ جاهزة'}</div></div><div class="ap-main"><div><div class="ap-meta">الحالي</div><div class="ap-plate">${a.plate_no?`Plate ${a.plate_no}`:'—'}</div></div><div style="text-align:left"><div class="ap-meta">الفلمنت</div><div class="ap-grams">${n(a.remaining_g).toFixed(0)}g</div></div></div>${a.status==='printing'?`<div class="ap-meta" style="margin-top:8px">المتبقي: <b>${fmt(sec)}</b>${finish?` · ينتهي ${finish}`:''}</div>`:''}</div>`;
        }).join(''):'<div class="muted">لا توجد طابعات في هذا المشروع.</div>'}</div></section>`;
      }).join('')}`;
  }

  function boot(){style();setTimeout(render,250);document.addEventListener('click',e=>{if(e.target.closest('.nav [data-page="production"]'))setTimeout(render,100);});}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();