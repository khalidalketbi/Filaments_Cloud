(() => {
  const cfg = window.APP_CONFIG || {};
  if (!window.supabase || !cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) return;

  const db = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
  const $ = id => document.getElementById(id);
  const fmt = n => `${Math.round(Number(n) || 0).toLocaleString()}g`;
  const norm = s => String(s || '').trim().toLowerCase();
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  let cache = { spools: [], printers: [], logs: [] };
  let activePrinterId = null;
  let activeSpool = null;
  let mutationLock = false;

  function injectStyles() {
    if ($('fcDashboardStyles')) return;
    const style = document.createElement('style');
    style.id = 'fcDashboardStyles';
    style.textContent = `
      :root{--fc-bg:#080d18;--fc-surface:#0f1726;--fc-card:#141f31;--fc-card2:#0b1322;--fc-line:#223149;--fc-muted:#8fa2bd;--fc-text:#eef5ff;--fc-blue:#58a6ff;--fc-green:#4ade80;--fc-yellow:#fbbf24;--fc-red:#fb7185}
      body{background:radial-gradient(circle at 50% -10%,#16243a 0,#0a101c 38%,#070b13 100%)!important;color:var(--fc-text)!important}
      .wrap{max-width:1280px!important;padding:18px!important}
      .topbar{padding:4px 2px 10px!important}.brand h1{font-size:27px!important;letter-spacing:-.4px}.brand h1:before{content:'◉';font-size:17px;color:var(--fc-blue);margin-left:9px}
      .panel{background:rgba(13,21,35,.92)!important;border:1px solid var(--fc-line)!important;border-radius:16px!important;box-shadow:0 14px 40px rgba(0,0,0,.18)}
      .stats{grid-template-columns:repeat(6,minmax(0,1fr))!important;gap:9px!important;margin-bottom:14px!important}
      .stat{background:linear-gradient(180deg,#152135,#101a2b)!important;border:1px solid var(--fc-line)!important;border-radius:13px!important;padding:13px 10px!important;text-align:right!important;min-width:0}
      .stat strong{font-size:22px!important;line-height:1.1}.stat span{font-size:11px!important;display:block;margin-top:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .stat .fc-mini{font-size:10px;color:#6f849f;margin-top:4px}
      .tabs{background:#0b1322;border:1px solid var(--fc-line);padding:4px;border-radius:14px;gap:4px!important}
      .tab{border:0!important;border-radius:10px!important;min-height:42px!important}.tab.active{background:#1a2a41!important;color:#fff!important;box-shadow:inset 0 0 0 1px #2e4566}
      .toolbar{align-items:center!important}.toolbar input,.toolbar select{margin:0!important;min-height:42px!important;background:#0a1220!important;border-color:var(--fc-line)!important;border-radius:10px!important}
      .fc-search{flex:1;min-width:180px}.fc-sort{width:auto!important;min-width:190px}
      .grid{grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:10px!important}
      .spool,.printer{background:linear-gradient(180deg,#142033,#101a2a)!important;border:1px solid var(--fc-line)!important;border-radius:14px!important;padding:14px!important;transition:border-color .15s ease,transform .15s ease}
      @media(hover:hover){.spool:hover,.printer:hover{border-color:#365278;transform:translateY(-1px)}}
      .spool h3,.printer h3{font-size:16px!important}.meta{color:var(--fc-muted)!important}.bar{height:7px!important;background:#07101d!important}.actions{margin-top:10px}.btn{border-radius:9px!important}.btn.small{padding:7px 9px!important;font-size:12px!important}
      .color-dot{width:21px!important;height:21px!important;border-width:1px!important}.warehouse-badge{border-radius:7px!important;padding:3px 7px!important}
      .fc-overview{display:grid;grid-template-columns:minmax(0,1.45fr) minmax(260px,.75fr);gap:10px;margin:0 0 14px}
      .fc-box{background:rgba(13,21,35,.94);border:1px solid var(--fc-line);border-radius:16px;padding:14px;min-width:0}
      .fc-box-title{font-size:13px;font-weight:800;margin-bottom:11px;display:flex;align-items:center;justify-content:space-between;gap:8px}.fc-box-title small{font-size:10px;color:var(--fc-muted);font-weight:500}
      .fc-materials{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.fc-material{background:#0a1321;border:1px solid #1d2c42;border-radius:11px;padding:10px;min-width:0}.fc-material strong{display:block;font-size:14px}.fc-material span{font-size:10px;color:var(--fc-muted);display:block;margin-top:3px}.fc-material .fc-mbar{height:4px;background:#111d2e;border-radius:999px;margin-top:8px;overflow:hidden}.fc-material .fc-mbar i{display:block;height:100%;background:#58a6ff;border-radius:999px}
      .fc-alert-list,.fc-activity-list{display:grid;gap:7px}.fc-row{display:flex;align-items:center;justify-content:space-between;gap:9px;background:#0a1321;border:1px solid #1d2c42;border-radius:10px;padding:9px 10px;min-width:0}.fc-row-main{min-width:0}.fc-row strong{font-size:12px;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.fc-row small{font-size:10px;color:var(--fc-muted)}.fc-pill{font-size:10px;padding:4px 7px;border-radius:999px;white-space:nowrap;background:#16253a;color:#bdd6f4}.fc-pill.warn{background:#3a2910;color:#ffd67a}.fc-pill.danger{background:#3b1821;color:#ff9aac}
      .fc-dashboard-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px}
      .fc-assistant{margin-top:14px;border:1px solid var(--fc-line);background:linear-gradient(180deg,#101b2d,#0c1524);border-radius:16px;overflow:hidden}.fc-ai-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 14px;border-bottom:1px solid var(--fc-line)}.fc-ai-head strong{font-size:14px}.fc-ai-head span{font-size:10px;color:var(--fc-muted)}
      .fc-ai-log{max-height:260px;overflow:auto;padding:10px;display:grid;gap:8px}.fc-msg{max-width:86%;padding:9px 11px;border-radius:11px;font-size:12px;line-height:1.55;white-space:pre-wrap}.fc-msg.user{margin-right:auto;background:#1f5b9a;color:white}.fc-msg.bot{margin-left:auto;background:#121f31;border:1px solid #243650;color:#e9f2ff}.fc-ai-input{display:grid;grid-template-columns:1fr auto;gap:7px;padding:10px;border-top:1px solid var(--fc-line)}.fc-ai-input input{margin:0!important;background:#08111e!important;border:1px solid var(--fc-line)!important;border-radius:9px!important;min-height:42px!important}.fc-quick{display:flex;gap:6px;flex-wrap:wrap;padding:0 10px 10px}.fc-quick button{background:#111e30;color:#bcd0e8;border:1px solid #243650;border-radius:999px;padding:6px 9px;font-size:10px;cursor:pointer}
      .fc-hidden-by-search{display:none!important}
      .fc-empty-note{font-size:11px;color:var(--fc-muted);padding:8px 0}
      .weight-metrics{grid-template-columns:repeat(3,1fr)!important}
      @media(max-width:1000px){.stats{grid-template-columns:repeat(3,1fr)!important}.grid{grid-template-columns:repeat(2,minmax(0,1fr))!important}.fc-materials{grid-template-columns:repeat(2,minmax(0,1fr))}.fc-overview{grid-template-columns:1fr}.fc-dashboard-grid{grid-template-columns:1fr 1fr}}
      @media(max-width:650px){.wrap{padding:12px!important}.stats{grid-template-columns:repeat(2,1fr)!important}.grid{grid-template-columns:1fr!important}.fc-dashboard-grid{grid-template-columns:1fr}.fc-materials{grid-template-columns:repeat(2,minmax(0,1fr))}.fc-ai-input{grid-template-columns:1fr}.fc-msg{max-width:94%}.toolbar{display:grid!important;grid-template-columns:1fr 1fr}.toolbar .btn{grid-column:1/-1}.fc-search,.fc-sort,#filterMaterial{width:100%!important;min-width:0!important}.weight-metrics{grid-template-columns:1fr!important}}
    `;
    document.head.appendChild(style);
  }

  function ensureDashboardShell() {
    const app = $('appView');
    if (!app) return;
    const stats = app.querySelector('.stats');
    if (stats && !$('statWarehouse')) {
      stats.insertAdjacentHTML('beforeend', `
        <div class="stat"><strong id="statWarehouse">0</strong><span>في المخزن</span><div class="fc-mini" id="statWarehouseWeight">0g</div></div>
        <div class="stat"><strong id="statLoaded">0</strong><span>على الطابعات</span><div class="fc-mini" id="statPrinterWeight">0g</div></div>
        <div class="stat"><strong id="statUsed">0g</strong><span>الاستهلاك المسجل</span><div class="fc-mini" id="statCapacity">السعة 0g</div></div>`);
    }

    const tabs = app.querySelector('.tabs');
    if (tabs && !$('fcOverview')) {
      const overview = document.createElement('section');
      overview.id = 'fcOverview';
      overview.innerHTML = `
        <div class="fc-overview">
          <div class="fc-box"><div class="fc-box-title"><span>ملخص المواد</span><small id="fcMaterialHint">—</small></div><div id="fcMaterials" class="fc-materials"></div></div>
          <div class="fc-box"><div class="fc-box-title"><span>تنبيهات المخزون</span><small>أقل من 20%</small></div><div id="fcLowStock" class="fc-alert-list"></div></div>
        </div>
        <div class="fc-dashboard-grid">
          <div class="fc-box"><div class="fc-box-title"><span>آخر الاستهلاك</span><small id="fcLogCount">—</small></div><div id="fcActivity" class="fc-activity-list"></div></div>
          <div class="fc-box"><div class="fc-box-title"><span>حالة الطابعات</span><small id="fcPrinterHint">—</small></div><div id="fcPrinterSummary" class="fc-activity-list"></div></div>
        </div>`;
      tabs.parentNode.insertBefore(overview, tabs);
    }

    const warehouseToolbar = $('warehouseView')?.querySelector('.toolbar');
    if (warehouseToolbar && !$('fcSearch')) {
      const search = document.createElement('input');
      search.id = 'fcSearch'; search.className = 'fc-search'; search.type = 'search'; search.placeholder = 'بحث بالاسم، الشركة، المادة أو اللون…';
      const sort = document.createElement('select');
      sort.id = 'sortSpools'; sort.className = 'fc-sort';
      sort.innerHTML = `<option value="default">الترتيب الافتراضي</option><option value="grams-desc">الجرامات: الأكثر أولاً</option><option value="grams-asc">الجرامات: الأقل أولاً</option><option value="low-first">الأقرب للنفاد</option><option value="material">حسب المادة</option><option value="brand">حسب الشركة</option><option value="name-asc">الاسم: أ ← ي</option><option value="name-desc">الاسم: ي ← أ</option>`;
      warehouseToolbar.append(search, sort);
      search.addEventListener('input', applySearchAndSort);
      sort.addEventListener('change', applySearchAndSort);
    }

    if (tabs && !$('fcAssistant')) {
      const ai = document.createElement('section');
      ai.id = 'fcAssistant'; ai.className = 'fc-assistant';
      ai.innerHTML = `
        <div class="fc-ai-head"><div><strong>مساعد Filament الذكي</strong><div><span>مجاني ومحلي — يفهم بيانات مخزونك والطابعات</span></div></div><span>بدون API</span></div>
        <div id="fcAiLog" class="fc-ai-log"><div class="fc-msg bot">اسألني عن المخزون أو الطابعات. مثال: «أي PETG يكفيني لطبعة 650g؟»</div></div>
        <div class="fc-quick"><button type="button" data-fc-q="ملخص المخزون">ملخص المخزون</button><button type="button" data-fc-q="شو أقرب سبول يخلص؟">الأقرب للنفاد</button><button type="button" data-fc-q="شو موجود على الطابعات؟">حالة الطابعات</button><button type="button" data-fc-q="شو ناقص عندي؟">شو ناقص؟</button></div>
        <div class="fc-ai-input"><input id="fcAiInput" type="text" placeholder="مثال: عندي طبعة PETG وزنها 400g، أي سبول أستخدم؟"><button id="fcAiSend" class="btn" type="button">إرسال</button></div>`;
      app.appendChild(ai);
      $('fcAiSend').addEventListener('click', () => runAssistant($('fcAiInput').value));
      $('fcAiInput').addEventListener('keydown', e => { if (e.key === 'Enter') runAssistant(e.target.value); });
      ai.querySelectorAll('[data-fc-q]').forEach(b => b.addEventListener('click', () => runAssistant(b.dataset.fcQ)));
    }
  }

  async function loadData() {
    const { data: { session } } = await db.auth.getSession();
    if (!session) return;
    const [s, p, l] = await Promise.all([
      db.from('spools').select('*').order('created_at', { ascending: false }),
      db.from('printers').select('*').order('created_at', { ascending: false }),
      db.from('usage_logs').select('spool_id,grams_used,created_at').order('created_at', { ascending: false }).limit(12)
    ]);
    if (!s.error) cache.spools = s.data || [];
    if (!p.error) cache.printers = p.data || [];
    if (!l.error) cache.logs = l.data || [];
    renderDashboard();
  }

  function renderDashboard() {
    ensureDashboardShell();
    const spools = cache.spools;
    const printers = cache.printers;
    const warehouse = spools.filter(s => s.location !== 'printer');
    const loaded = spools.filter(s => s.location === 'printer');
    const totalRemain = spools.reduce((a,s)=>a+Number(s.remaining_weight||0),0);
    const totalCapacity = spools.reduce((a,s)=>a+Number(s.total_weight||0),0);
    const totalUsed = cache.logs.reduce((a,l)=>a+Number(l.grams_used||0),0);

    if ($('statWarehouse')) $('statWarehouse').textContent = warehouse.length;
    if ($('statWarehouseWeight')) $('statWarehouseWeight').textContent = fmt(warehouse.reduce((a,s)=>a+Number(s.remaining_weight||0),0));
    if ($('statLoaded')) $('statLoaded').textContent = loaded.length;
    if ($('statPrinterWeight')) $('statPrinterWeight').textContent = fmt(loaded.reduce((a,s)=>a+Number(s.remaining_weight||0),0));
    if ($('statUsed')) $('statUsed').textContent = fmt(totalUsed);
    if ($('statCapacity')) $('statCapacity').textContent = `السعة ${fmt(totalCapacity)}`;

    const byMaterial = new Map();
    for (const s of spools) {
      const m = String(s.material || 'Other').toUpperCase();
      const o = byMaterial.get(m) || { count:0, remain:0, total:0 };
      o.count++; o.remain += Number(s.remaining_weight||0); o.total += Number(s.total_weight||0); byMaterial.set(m,o);
    }
    const mats = [...byMaterial.entries()].sort((a,b)=>b[1].remain-a[1].remain);
    if ($('fcMaterials')) $('fcMaterials').innerHTML = mats.length ? mats.map(([m,o]) => {
      const pct = Math.round((o.remain / Math.max(1,o.total))*100);
      return `<div class="fc-material"><strong>${esc(m)}</strong><span>${o.count} سبول · ${fmt(o.remain)}</span><div class="fc-mbar"><i style="width:${Math.max(2,Math.min(100,pct))}%"></i></div></div>`;
    }).join('') : '<div class="fc-empty-note">ما في مواد مسجلة بعد.</div>';
    if ($('fcMaterialHint')) $('fcMaterialHint').textContent = `${mats.length} أنواع · ${fmt(totalRemain)}`;

    const low = spools.filter(s => Number(s.remaining_weight||0)/Math.max(1,Number(s.total_weight||1)) <= .2).sort((a,b)=>Number(a.remaining_weight)-Number(b.remaining_weight));
    if ($('fcLowStock')) $('fcLowStock').innerHTML = low.length ? low.slice(0,6).map(s => {
      const pct = Math.round(Number(s.remaining_weight||0)/Math.max(1,Number(s.total_weight||1))*100);
      return `<div class="fc-row"><div class="fc-row-main"><strong>${esc(s.name)}</strong><small>${esc(s.material)} · ${fmt(s.remaining_weight)}</small></div><span class="fc-pill ${pct<=10?'danger':'warn'}">${pct}%</span></div>`;
    }).join('') : '<div class="fc-empty-note">ممتاز، ما عندك سبولات تحت 20%.</div>';

    const spoolMap = new Map(spools.map(s=>[s.id,s]));
    if ($('fcActivity')) $('fcActivity').innerHTML = cache.logs.length ? cache.logs.slice(0,6).map(l => {
      const s = spoolMap.get(l.spool_id);
      const when = l.created_at ? new Date(l.created_at).toLocaleDateString('ar-AE',{month:'short',day:'numeric'}) : '';
      return `<div class="fc-row"><div class="fc-row-main"><strong>${esc(s?.name || 'سبول محذوف')}</strong><small>${when}${s?.material?` · ${esc(s.material)}`:''}</small></div><span class="fc-pill">-${fmt(l.grams_used)}</span></div>`;
    }).join('') : '<div class="fc-empty-note">ما في استهلاك مسجل بعد.</div>';
    if ($('fcLogCount')) $('fcLogCount').textContent = `${cache.logs.length} عملية حديثة`;

    if ($('fcPrinterSummary')) $('fcPrinterSummary').innerHTML = printers.length ? printers.slice(0,7).map(p => {
      const s = spoolMap.get(p.loaded_spool_id);
      return `<div class="fc-row"><div class="fc-row-main"><strong>${esc(p.name)}</strong><small>${esc(p.model||'بدون موديل')}</small></div>${s?`<span class="fc-pill">${esc(s.material)} · ${fmt(s.remaining_weight)}</span>`:'<span class="fc-pill warn">بدون سبول</span>'}</div>`;
    }).join('') : '<div class="fc-empty-note">ما عندك طابعات مسجلة.</div>';
    if ($('fcPrinterHint')) $('fcPrinterHint').textContent = `${printers.length} طابعة · ${printers.filter(p=>p.loaded_spool_id).length} عليها فلمنت`;
  }

  function cardData(card) {
    const name = card.querySelector('h3')?.textContent?.trim() || '';
    const all = card.textContent || '';
    const material = ['PLA','PETG','ASA','ABS','TPU','PA','PC','PPS','OTHER'].find(m => all.toUpperCase().includes(m)) || '';
    const remainText = card.querySelector('.remain strong')?.textContent || '0';
    const totalText = card.querySelector('.remain small')?.textContent || '0';
    const remaining = Number(remainText.replace(/[^0-9.]/g,'')) || 0;
    const total = Number(totalText.replace(/[^0-9.]/g,'')) || 1;
    return { name, text:norm(all), material, remaining, total, pct:remaining/Math.max(1,total) };
  }

  function applySearchAndSort() {
    if (mutationLock) return;
    const grid = $('spoolGrid'); if (!grid) return;
    const q = norm($('fcSearch')?.value || '');
    const cards = [...grid.querySelectorAll('.spool')];
    cards.forEach(c => c.classList.toggle('fc-hidden-by-search', !!q && !cardData(c).text.includes(q)));
    const mode = $('sortSpools')?.value || 'default';
    if (mode !== 'default') {
      mutationLock = true;
      const coll = new Intl.Collator(['ar','en'],{numeric:true,sensitivity:'base'});
      cards.sort((a,b)=>{
        const A=cardData(a),B=cardData(b);
        if(mode==='grams-desc') return B.remaining-A.remaining || coll.compare(A.name,B.name);
        if(mode==='grams-asc') return A.remaining-B.remaining || coll.compare(A.name,B.name);
        if(mode==='low-first') return A.pct-B.pct || A.remaining-B.remaining;
        if(mode==='material') return coll.compare(A.material,B.material)||coll.compare(A.name,B.name);
        if(mode==='brand') return coll.compare(A.text.split('·')[0],B.text.split('·')[0])||coll.compare(A.name,B.name);
        if(mode==='name-asc') return coll.compare(A.name,B.name);
        if(mode==='name-desc') return coll.compare(B.name,A.name);
        return 0;
      });
      cards.forEach(c=>grid.appendChild(c));
      mutationLock = false;
    }
  }

  function addWeightButtons() {
    document.querySelectorAll('#printerGrid .printer').forEach(card => {
      if (card.querySelector('[data-printer-weight]')) return;
      const ref = card.querySelector('[data-printer-spool]');
      const actions = ref?.closest('.actions');
      const id = ref?.getAttribute('data-printer-spool');
      if (!actions || !id) return;
      const b = document.createElement('button'); b.type='button'; b.className='btn small'; b.dataset.printerWeight=id; b.textContent='تحديث الاستهلاك'; actions.prepend(b);
    });
  }

  function updateWeightPreview() {
    if (!activeSpool) return;
    const remaining=Number(activeSpool.remaining_weight||0), raw=Number($('printerPrintGrams')?.value||0), used=Math.max(0,Math.min(remaining,raw)), after=Math.max(0,remaining-used), total=Math.max(1,Number(activeSpool.total_weight||1)), pct=Math.max(0,Math.min(100,after/total*100));
    $('weightNow').textContent=fmt(remaining); $('weightPrint').textContent=fmt(used); $('weightAfter').textContent=fmt(after); $('weightAfterPct').textContent=`${Math.round(pct)}% من السبول`; $('weightPreviewBar').style.width=`${pct}%`;
    $('printerWeightStatus').textContent=raw>remaining?`الطبعة أكبر من المتبقي؛ سيتم خصم ${fmt(remaining)} فقط.`:''; $('printerWeightStatus').style.color=raw>remaining?'#fbbf24':'';
  }

  async function openWeight(printerId) {
    activePrinterId=printerId; $('printerWeightModal').classList.add('show'); $('printerWeightStatus').textContent='جاري تحميل بيانات السبول...';
    const p=cache.printers.find(x=>x.id===printerId) || (await db.from('printers').select('*').eq('id',printerId).single()).data;
    if(!p){$('printerWeightStatus').textContent='تعذر قراءة الطابعة.';return;}
    $('printerWeightTitle').textContent=`استهلاك الفلمنت — ${p.name}`;
    if(!p.loaded_spool_id){activeSpool=null;$('printerWeightStatus').textContent='ما في سبول مركب على هذه الطابعة.';$('applyPrinterWeight').disabled=true;return;}
    activeSpool=cache.spools.find(x=>x.id===p.loaded_spool_id) || (await db.from('spools').select('*').eq('id',p.loaded_spool_id).single()).data;
    if(!activeSpool){$('printerWeightStatus').textContent='تعذر قراءة السبول.';return;}
    $('printerWeightSpool').textContent=`${activeSpool.name} · ${activeSpool.material}${activeSpool.color?` · ${activeSpool.color}`:''}`; $('printerPrintGrams').value=''; $('applyPrinterWeight').disabled=false; $('printerWeightStatus').textContent=''; updateWeightPreview(); $('printerPrintGrams').focus();
  }

  async function applyWeight() {
    if(!activeSpool)return; const req=Number($('printerPrintGrams').value||0); if(!(req>0)){ $('printerWeightStatus').textContent='اكتب جرامات الطبعة أولاً.';return; }
    $('applyPrinterWeight').disabled=true; $('printerWeightStatus').textContent='جاري تحديث الوزن...';
    const {data:fresh,error:rerr}=await db.from('spools').select('remaining_weight').eq('id',activeSpool.id).single(); if(rerr||!fresh){$('printerWeightStatus').textContent=rerr?.message||'تعذر التحديث.';$('applyPrinterWeight').disabled=false;return;}
    const before=Number(fresh.remaining_weight||0), used=Math.min(req,before), after=Math.max(0,before-used); const {error}=await db.from('spools').update({remaining_weight:after}).eq('id',activeSpool.id); if(error){$('printerWeightStatus').textContent=error.message;$('applyPrinterWeight').disabled=false;return;}
    await db.from('usage_logs').insert({spool_id:activeSpool.id,grams_used:used}); activeSpool.remaining_weight=after; $('printerWeightStatus').textContent=`تم: ${fmt(before)} ← خصم ${fmt(used)} ← الباقي ${fmt(after)}`; $('printerWeightStatus').style.color='#86efac'; updateWeightPreview(); await loadData(); setTimeout(()=>location.reload(),550);
  }

  function aiMessage(text,who='bot') { const log=$('fcAiLog'); if(!log)return; const d=document.createElement('div'); d.className=`fc-msg ${who}`; d.textContent=text; log.appendChild(d); log.scrollTop=log.scrollHeight; }

  function materialFromText(t) { return ['PETG','PLA','ASA','ABS','TPU','PA','PC','PPS'].find(m=>t.toUpperCase().includes(m)) || null; }
  function gramsFromText(t) { const m=t.match(/(\d+(?:\.\d+)?)\s*(?:g|جرام|غرام)?/i); return m?Number(m[1]):null; }

  function executeSort(mode,msg) { if($('sortSpools')){$('sortSpools').value=mode;applySearchAndSort();} aiMessage(msg); }

  async function runAssistant(raw) {
    const text=String(raw||'').trim(); if(!text)return; aiMessage(text,'user'); if($('fcAiInput'))$('fcAiInput').value=''; if(!cache.spools.length) await loadData();
    const t=norm(text), mat=materialFromText(text), grams=gramsFromText(text), spools=cache.spools, warehouse=spools.filter(s=>s.location!=='printer');

    if((t.includes('رتب')||t.includes('ترتيب'))&&(t.includes('اكثر')||t.includes('الأكثر'))) return executeSort('grams-desc','تم، رتبت المخزون من الأكثر جرامًا إلى الأقل.');
    if((t.includes('رتب')||t.includes('ترتيب'))&&(t.includes('اقل')||t.includes('الأقل'))) return executeSort('grams-asc','تم، رتبت المخزون من الأقل جرامًا إلى الأكثر.');
    if(t.includes('اقرب')&&(t.includes('نفاد')||t.includes('يخلص'))) return executeSort('low-first','تم، حطيت الأقرب للنفاد أولاً.');
    if(t.includes('حسب')&&t.includes('الاسم')) return executeSort('name-asc','تم، رتبت حسب الاسم.');
    if(t.includes('حسب')&&(t.includes('نوع')||t.includes('مادة'))) return executeSort('material','تم، رتبت حسب نوع المادة.');

    if(mat && (t.includes('اعرض')||t.includes('ورني')||t.includes('فلتر'))) { const f=$('filterMaterial'); if(f){f.value=mat;f.dispatchEvent(new Event('change',{bubbles:true}));setTimeout(applySearchAndSort,80);} return aiMessage(`تم، أعرض لك ${mat} فقط.`); }

    if(mat && grams && (t.includes('يكفي')||t.includes('طبعة')||t.includes('استخدم')||t.includes('اختار')||t.includes('سبول'))) {
      const candidates=warehouse.filter(s=>String(s.material||'').toUpperCase()===mat).sort((a,b)=>Number(a.remaining_weight)-Number(b.remaining_weight));
      const enough=candidates.filter(s=>Number(s.remaining_weight)>=grams);
      if(enough.length){const best=enough[0],after=Number(best.remaining_weight)-grams;return aiMessage(`أفضل اختيار: ${best.name}.\nعنده ${fmt(best.remaining_weight)}، والطبعة تحتاج ${fmt(grams)}، وبعدها يبقى تقريبًا ${fmt(after)}. اخترته لأنه أصغر سبول يكفي للطبعة، عشان تستفيد من السبولات المفتوحة أولاً.`);}
      const total=candidates.reduce((a,s)=>a+Number(s.remaining_weight||0),0); return aiMessage(candidates.length?`ما عندك سبول ${mat} واحد يكفي ${fmt(grams)}. أكبر سبول عندك فيه ${fmt(Math.max(...candidates.map(s=>Number(s.remaining_weight||0))))}. إجمالي ${mat} في المخزن ${fmt(total)}.`:`ما عندك أي سبول ${mat} في المخزن حاليًا.`);
    }

    if(mat && (t.includes('كم')||t.includes('عندي')||t.includes('موجود'))) {
      const list=spools.filter(s=>String(s.material||'').toUpperCase()===mat), total=list.reduce((a,s)=>a+Number(s.remaining_weight||0),0); return aiMessage(`عندك ${list.length} سبول ${mat}، بإجمالي متبقي ${fmt(total)}. ${list.filter(s=>s.location==='printer').length} منها مركب على الطابعات.`);
    }

    if(t.includes('طابعات')||t.includes('الطابعات')) {
      if(!cache.printers.length)return aiMessage('ما عندك طابعات مسجلة حاليًا.');
      const lines=cache.printers.map(p=>{const s=spools.find(x=>x.id===p.loaded_spool_id);return `• ${p.name}: ${s?`${s.name} — ${s.material} — ${fmt(s.remaining_weight)}`:'بدون سبول'}`;}); return aiMessage(`حالة الطابعات:\n${lines.join('\n')}`);
    }

    if(t.includes('ناقص')||t.includes('نفاد')||t.includes('قليل')) {
      const low=spools.filter(s=>Number(s.remaining_weight||0)/Math.max(1,Number(s.total_weight||1))<=.2).sort((a,b)=>Number(a.remaining_weight)-Number(b.remaining_weight));
      if(!low.length)return aiMessage('مخزونك جيد: ما عندك أي سبول أقل من 20%.');
      return aiMessage(`عندك ${low.length} سبول منخفض:\n${low.slice(0,6).map(s=>`• ${s.name}: ${fmt(s.remaining_weight)} (${Math.round(Number(s.remaining_weight)/Math.max(1,Number(s.total_weight))*100)}%)`).join('\n')}`);
    }

    if(t.includes('ملخص')||t.includes('كم سبول')||t.includes('المخزون')) {
      const total=spools.reduce((a,s)=>a+Number(s.remaining_weight||0),0), low=spools.filter(s=>Number(s.remaining_weight||0)/Math.max(1,Number(s.total_weight||1))<=.2).length, mats=[...new Set(spools.map(s=>s.material))].filter(Boolean);
      return aiMessage(`ملخصك الآن:\n• ${spools.length} سبول\n• ${warehouse.length} في المخزن\n• ${spools.length-warehouse.length} على الطابعات\n• ${fmt(total)} فلمنت متبقي\n• ${mats.length} أنواع مواد\n• ${low} سبول أقل من 20%`);
    }

    if(grams && !mat && (t.includes('طبعة')||t.includes('يكفي'))) {
      const enough=warehouse.filter(s=>Number(s.remaining_weight)>=grams).sort((a,b)=>Number(a.remaining_weight)-Number(b.remaining_weight));
      if(!enough.length)return aiMessage(`ما عندك سبول واحد في المخزن يكفي طبعة وزنها ${fmt(grams)}.`);
      return aiMessage(`في ${enough.length} سبول يكفون طبعة ${fmt(grams)}. الأقل هدرًا هو ${enough[0].name} (${enough[0].material}) وفيه ${fmt(enough[0].remaining_weight)}.`);
    }

    aiMessage('أقدر أفهم أسئلة مثل:\n• أي PETG يكفيني لطبعة 650g؟\n• كم عندي ASA؟\n• شو موجود على الطابعات؟\n• شو أقرب سبول يخلص؟\n• ملخص المخزون\n• رتب من الأقل للأكثر');
  }

  function bindGlobalEvents() {
    document.addEventListener('click', e => {
      const b=e.target.closest('[data-printer-weight]'); if(b) openWeight(b.dataset.printerWeight);
    });
    $('printerPrintGrams')?.addEventListener('input',updateWeightPreview);
    $('applyPrinterWeight')?.addEventListener('click',applyWeight);
    $('cancelPrinterWeight')?.addEventListener('click',()=>{$('printerWeightModal').classList.remove('show');activeSpool=null;activePrinterId=null;});
    $('filterMaterial')?.addEventListener('change',()=>setTimeout(applySearchAndSort,60));
  }

  function startObserver() {
    const root=$('appView'); if(!root)return;
    const obs=new MutationObserver(()=>{if(mutationLock)return;ensureDashboardShell();addWeightButtons();setTimeout(applySearchAndSort,30);});
    obs.observe(root,{childList:true,subtree:true});
  }

  injectStyles();
  ensureDashboardShell();
  bindGlobalEvents();
  startObserver();
  addWeightButtons();
  db.auth.onAuthStateChange((_event,session)=>{if(session)setTimeout(loadData,120);});
  setTimeout(loadData,250);
  setInterval(()=>{ if(!$('appView')?.classList.contains('hidden')) loadData(); },30000);
})();