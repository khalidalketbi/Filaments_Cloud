(() => {
  const cfg = window.APP_CONFIG || {};
  if (!window.supabase || !cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) return;

  const db = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
    auth: { persistSession:true, autoRefreshToken:true, detectSessionInUrl:true }
  });

  const PROJECT_KEY = 'fm_current_project_id';
  let busy = false;
  let timer = null;

  const n = v => Number(v) || 0;

  function injectStyle(){
    if (document.getElementById('projectEtaStyle')) return;
    const s = document.createElement('style');
    s.id = 'projectEtaStyle';
    s.textContent = `
      #dashboardPage .pdash-kpis{grid-template-columns:repeat(6,minmax(0,1fr))}
      #dashboardPage .pdash-kpi.pdash-eta strong{font-size:19px;line-height:1.35}
      #dashboardPage .pdash-kpi.pdash-eta .eta-time{display:block;font-size:22px;font-weight:900;margin-top:2px}
      #dashboardPage .pdash-kpi.pdash-eta .eta-day{display:block;font-size:12px;color:var(--muted);margin-top:3px;font-weight:700}
      @media(max-width:1250px){#dashboardPage .pdash-kpis{grid-template-columns:repeat(3,1fr)}}
      @media(max-width:900px){#dashboardPage .pdash-kpis{grid-template-columns:repeat(2,1fr)}}
    `;
    document.head.appendChild(s);
  }

  function ensureCard(){
    const grid = document.querySelector('#dashboardPage .pdash-kpis');
    if (!grid) return null;
    let card = document.getElementById('pdEtaCard');
    if (!card){
      card = document.createElement('div');
      card.id = 'pdEtaCard';
      card.className = 'pdash-kpi pdash-eta';
      card.innerHTML = `
        <span>الانتهاء المتوقع للمشروع</span>
        <strong id="pdEta">—</strong>
        <small id="pdEtaMeta">حسب الطابعات ووقت الطباعة الحالي</small>`;
      grid.appendChild(card);
    }
    return card;
  }

  function remainingSeconds(a, plate){
    if (a.status !== 'printing') return 0;
    if (a.manual_time_override && a.manual_finish_at){
      return Math.max(0, (new Date(a.manual_finish_at).getTime() - Date.now()) / 1000);
    }
    if (a.started_at && plate?.print_minutes){
      return Math.max(0, (new Date(a.started_at).getTime() + n(plate.print_minutes) * 60000 - Date.now()) / 1000);
    }
    if (plate?.print_minutes) return n(plate.print_minutes) * 60;
    return 0;
  }

  function formatEta(date){
    const day = new Intl.DateTimeFormat('ar-AE', {
      weekday:'long', day:'numeric', month:'long'
    }).format(date);
    const time = new Intl.DateTimeFormat('ar-AE', {
      hour:'numeric', minute:'2-digit', hour12:true
    }).format(date);
    return { day, time };
  }

  function buildEstimate(plates, assignments){
    if (!assignments.length) return { ok:false, reason:'لا توجد طابعات في المشروع' };

    const pmap = new Map(plates.map(p => [n(p.plate_no), p]));
    const projected = new Map(plates.map(p => [n(p.plate_no), n(p.completed_qty)]));

    assignments.forEach(a => {
      if (a.status === 'printing' && a.plate_no){
        const no = n(a.plate_no);
        projected.set(no, n(projected.get(no)) + 1);
      }
    });

    const printers = assignments.map(a => ({
      name: String(a.printer_name || '').trim(),
      available: remainingSeconds(a, pmap.get(n(a.plate_no)))
    })).filter(p => p.name);

    if (!printers.length) return { ok:false, reason:'لا توجد طابعات صالحة للحساب' };

    const jobs = [];
    plates.forEach(p => {
      const no = n(p.plate_no);
      const need = Math.max(0, n(p.target_qty) - n(projected.get(no)));
      const duration = n(p.print_minutes) * 60;
      const allowed = Array.isArray(p.allowed_printers) ? p.allowed_printers.filter(Boolean).map(String) : [];
      for (let i=0; i<need; i++) jobs.push({ no, duration, allowed });
    });

    // Restricted jobs first, then longer prints first. This gives a practical farm estimate
    // while respecting Plates that only certain printers can make.
    jobs.sort((a,b) => {
      const ar = a.allowed.length ? 0 : 1;
      const br = b.allowed.length ? 0 : 1;
      if (ar !== br) return ar - br;
      if (a.allowed.length !== b.allowed.length) return a.allowed.length - b.allowed.length;
      return b.duration - a.duration;
    });

    for (const job of jobs){
      const candidates = printers.filter(p => !job.allowed.length || job.allowed.includes(p.name));
      if (!candidates.length){
        return { ok:false, reason:`Plate ${job.no} لا توجد له طابعة متاحة` };
      }
      candidates.sort((a,b) => a.available - b.available);
      candidates[0].available += job.duration;
    }

    const seconds = Math.max(0, ...printers.map(p => p.available));
    return { ok:true, seconds, printers:printers.length, jobs:jobs.length };
  }

  async function update(){
    if (busy) return;
    const card = ensureCard();
    if (!card) return;
    busy = true;
    try{
      const { data:{ session } } = await db.auth.getSession();
      if (!session?.user) return;

      const sel = document.getElementById('pdashProject');
      const projectId = sel?.value || localStorage.getItem(PROJECT_KEY);
      if (!projectId) return;

      const [plr, ar] = await Promise.all([
        db.from('production_plates')
          .select('plate_no,target_qty,completed_qty,print_minutes,allowed_printers')
          .eq('project_id', projectId)
          .order('plate_no'),
        db.from('production_assignments')
          .select('printer_name,status,plate_no,started_at,manual_time_override,manual_finish_at')
          .eq('project_id', projectId)
          .order('printer_name')
      ]);

      if (plr.error || ar.error){
        document.getElementById('pdEta').textContent = 'تعذر الحساب';
        document.getElementById('pdEtaMeta').textContent = plr.error?.message || ar.error?.message || '';
        return;
      }

      const estimate = buildEstimate(plr.data || [], ar.data || []);
      const out = document.getElementById('pdEta');
      const meta = document.getElementById('pdEtaMeta');
      if (!out || !meta) return;

      if (!estimate.ok){
        out.textContent = '—';
        meta.textContent = estimate.reason;
        return;
      }

      const finish = new Date(Date.now() + estimate.seconds * 1000);
      const f = formatEta(finish);
      out.innerHTML = `<span class="eta-time">${f.time}</span><span class="eta-day">${f.day}</span>`;

      const hours = estimate.seconds / 3600;
      const durationText = hours < 24
        ? `حوالي ${Math.max(0, Math.round(hours * 10) / 10)} ساعة من الآن`
        : `حوالي ${Math.floor(hours/24)} يوم و${Math.round(hours%24)} ساعة`;
      meta.textContent = `${durationText} · تقديري إذا استمر التشغيل بدون توقف`;
    } finally {
      busy = false;
    }
  }

  function boot(){
    injectStyle();
    const tryStart = setInterval(() => {
      if (ensureCard()){
        clearInterval(tryStart);
        update();
      }
    }, 250);

    document.addEventListener('change', e => {
      if (e.target?.id === 'pdashProject') setTimeout(update, 80);
    });
    document.addEventListener('click', e => {
      if (e.target.closest?.('.nav [data-page="dashboard"]')) setTimeout(update, 150);
    });

    clearInterval(timer);
    timer = setInterval(update, 15000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true});
  else boot();
})();