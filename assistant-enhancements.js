(() => {
  const cfg = window.APP_CONFIG || {};
  if (!window.supabase || !cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) return;

  const db = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
  const $ = id => document.getElementById(id);
  const num = v => Number(v) || 0;
  const fmtG = v => `${Math.round(num(v)).toLocaleString()}g`;
  const norm = s => String(s || '').trim().toLowerCase();
  const ACTIVE_PAGE_KEY = 'filament_cloud_active_page';

  function addBubble(text, me = false) {
    const log = $('assistantLog');
    if (!log) return;
    const d = document.createElement('div');
    d.className = 'bubble' + (me ? ' me' : '');
    d.textContent = text;
    log.appendChild(d);
    log.scrollTop = log.scrollHeight;
  }

  async function getData() {
    const [s, p, u] = await Promise.all([
      db.from('spools').select('*'),
      db.from('printers').select('*'),
      db.from('usage_logs').select('grams_used,created_at,spool_id,printer_id')
    ]);
    return {
      spools: (s.data || []).filter(x => !x.archived),
      printers: p.data || [],
      usage: u.data || []
    };
  }

  function mountedMap(printers) {
    const map = new Map();
    printers.forEach(p => { if (p.loaded_spool_id) map.set(p.loaded_spool_id, p); });
    return map;
  }

  async function runQuick(action, label) {
    addBubble(label, true);
    addBubble('جاري تحليل بياناتك...');
    const log = $('assistantLog');
    const loading = log?.lastElementChild;
    try {
      const { spools, printers, usage } = await getData();
      const mounted = mountedMap(printers);
      const total = spools.reduce((a,s)=>a+num(s.remaining_weight),0);
      const cap = spools.reduce((a,s)=>a+num(s.total_weight),0);
      const warehouse = spools.filter(s=>!mounted.has(s.id));
      const loaded = spools.filter(s=>mounted.has(s.id));
      const low = [...spools].filter(s=>num(s.total_weight)>0 && num(s.remaining_weight)/num(s.total_weight)<=0.2)
        .sort((a,b)=>num(a.remaining_weight)/Math.max(1,num(a.total_weight))-num(b.remaining_weight)/Math.max(1,num(b.total_weight)));
      const cutoff = Date.now() - 30*86400000;
      const monthUsage = usage.filter(x=>new Date(x.created_at).getTime()>=cutoff);
      const monthGrams = monthUsage.reduce((a,x)=>a+num(x.grams_used),0);
      const groups = {};
      spools.forEach(s=>{
        const k=s.material||'Other';
        groups[k] ||= {count:0, grams:0};
        groups[k].count++;
        groups[k].grams += num(s.remaining_weight);
      });
      if (loading) loading.remove();

      if (action === 'summary') {
        const topMat = Object.entries(groups).sort((a,b)=>b[1].grams-a[1].grams)[0];
        return addBubble(`ملخص المخزون\n• ${spools.length} سبول فعال\n• ${warehouse.length} في المخزن\n• ${loaded.length} مركب على الطابعات\n• ${fmtG(total)} متبقي من ${fmtG(cap)}\n• ${low.length} سبول أقل من 20%\n• استهلاك آخر 30 يوم: ${fmtG(monthGrams)} عبر ${monthUsage.length} عملية${topMat?`\n• أكبر مخزون: ${topMat[0]} — ${fmtG(topMat[1].grams)}`:''}`);
      }
      if (action === 'materials') {
        const rows = Object.entries(groups).sort((a,b)=>b[1].grams-a[1].grams);
        return addBubble(rows.length ? rows.map(([k,v])=>`${k}: ${v.count} سبول · ${fmtG(v.grams)}`).join('\n') : 'ما عندك مواد مسجلة.');
      }
      if (action === 'printers') {
        return addBubble(printers.length ? printers.map(p=>{
          const s=spools.find(x=>x.id===p.loaded_spool_id);
          let status=p.status==='printing'?'تطبع':p.status==='idle'?'جاهزة':p.status||'غير محدد';
          let timer='';
          if(p.status==='printing'&&p.print_ends_at){const left=Math.max(0,new Date(p.print_ends_at).getTime()-Date.now());const m=Math.ceil(left/60000);timer=` · باقي ${Math.floor(m/60)}س ${m%60}د`;}
          return `${p.name}: ${status}${timer}${s?` · ${s.name} / ${s.material} / ${fmtG(s.remaining_weight)}`:' · بدون سبول'}`;
        }).join('\n') : 'ما عندك طابعات مسجلة.');
      }
      if (action === 'low') {
        return addBubble(low.length ? low.slice(0,10).map((s,i)=>`${i+1}. ${s.name} — ${fmtG(s.remaining_weight)} (${Math.round(num(s.remaining_weight)/Math.max(1,num(s.total_weight))*100)}%)`).join('\n') : 'ممتاز، ما عندك أي سبول أقل من 20%.');
      }
      if (action === 'usage') {
        const byMat={};
        monthUsage.forEach(x=>{
          const s=spools.find(z=>z.id===x.spool_id);
          const k=s?.material||'Unknown'; byMat[k]=(byMat[k]||0)+num(x.grams_used);
        });
        const top=Object.entries(byMat).sort((a,b)=>b[1]-a[1])[0];
        return addBubble(`استهلاك آخر 30 يوم\n• ${fmtG(monthGrams)} إجمالي\n• ${monthUsage.length} عمليات مسجلة${top?`\n• الأكثر استخدامًا: ${top[0]} — ${fmtG(top[1])}`:''}`);
      }
      if (action === 'recommend') {
        const candidates=[...warehouse].sort((a,b)=>num(a.remaining_weight)-num(b.remaining_weight));
        const nearly=candidates.filter(s=>num(s.remaining_weight)>0&&num(s.remaining_weight)<=300).slice(0,5);
        if(nearly.length) return addBubble(`اقتراحي: حاول تستهلك هذه السبولات أولًا لأنها الأقرب للانتهاء:\n${nearly.map((s,i)=>`${i+1}. ${s.name} — ${s.material} — ${fmtG(s.remaining_weight)}`).join('\n')}\nهذا يساعدك تقلل عدد السبولات المفتوحة.`);
        return addBubble('المخزون عندك متوازن حاليًا. ما عندك سبولات في المخزن أقل من 300g تحتاج أولوية واضحة.');
      }
    } catch (e) {
      if (loading) loading.remove();
      addBubble('تعذر قراءة الإحصائيات الآن. جرّب مرة ثانية.');
    }
  }

  function enhanceAssistant() {
    const section = $('assistantLog')?.closest('.assistant');
    if (!section || section.dataset.enhancedAssistant) return;
    section.dataset.enhancedAssistant = '1';
    const title = section.querySelector('.section-title h2');
    if (title) title.textContent = 'Assistant';
    const first = $('assistantLog')?.firstElementChild;
    if (first) first.textContent = 'اختر تقرير جاهز، أو اكتب سؤالك عن المخزون والطابعات.';

    const actions = document.createElement('div');
    actions.id = 'assistantQuickActions';
    actions.style.cssText = 'display:flex;gap:7px;flex-wrap:wrap;margin:8px 0 10px';
    const defs = [
      ['summary','ملخص المخزون'],
      ['materials','المواد'],
      ['printers','حالة الطابعات'],
      ['low','قريب من النفاد'],
      ['usage','استهلاك 30 يوم'],
      ['recommend','اقتراحات']
    ];
    defs.forEach(([key,label])=>{
      const b=document.createElement('button');
      b.type='button'; b.className='btn secondary small'; b.textContent=label;
      b.addEventListener('click',()=>runQuick(key,label));
      actions.appendChild(b);
    });
    $('assistantLog').before(actions);
  }

  function rememberNavigation() {
    document.querySelectorAll('.nav button[data-page]').forEach(btn=>{
      btn.addEventListener('click',()=>localStorage.setItem(ACTIVE_PAGE_KEY,btn.dataset.page));
    });
    document.querySelectorAll('[data-go]').forEach(btn=>{
      btn.addEventListener('click',()=>localStorage.setItem(ACTIVE_PAGE_KEY,btn.dataset.go));
    });
  }

  function restoreNavigation() {
    const wanted = localStorage.getItem(ACTIVE_PAGE_KEY);
    if (!wanted || wanted === 'dashboard') return;
    let attempts=0;
    const timer=setInterval(()=>{
      attempts++;
      const app=$('appView');
      const btn=document.querySelector(`.nav button[data-page="${CSS.escape(wanted)}"]`);
      if(app && !app.classList.contains('hidden') && btn){btn.click();clearInterval(timer);}
      if(attempts>30)clearInterval(timer);
    },100);
  }

  function persistBeforeSaves() {
    ['spoolForm','printerForm'].forEach(id=>{
      $(id)?.addEventListener('submit',()=>{
        const active=document.querySelector('.nav button.active[data-page]');
        if(active)localStorage.setItem(ACTIVE_PAGE_KEY,active.dataset.page);
      },true);
    });
    $('saveSettings')?.addEventListener('click',()=>localStorage.setItem(ACTIVE_PAGE_KEY,'settings'),true);
    $('applyUse')?.addEventListener('click',()=>{
      const active=document.querySelector('.nav button.active[data-page]');
      if(active)localStorage.setItem(ACTIVE_PAGE_KEY,active.dataset.page);
    },true);
  }

  function init(){enhanceAssistant();rememberNavigation();persistBeforeSaves();restoreNavigation();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
