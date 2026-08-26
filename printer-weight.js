(() => {
  const cfg = window.APP_CONFIG || {};
  if (!window.supabase || !cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) return;

  const dbWeight = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });

  const $ = id => document.getElementById(id);
  let activePrinterId = null;
  let activeSpool = null;
  let applyingSort = false;

  const fmt = n => `${Math.round(Number(n) || 0).toLocaleString()}g`;
  const norm = s => String(s || '').trim().toLowerCase();

  function closeModal() {
    $('printerWeightModal')?.classList.remove('show');
    activePrinterId = null;
    activeSpool = null;
  }

  function updatePreview() {
    if (!activeSpool) return;
    const remaining = Number(activeSpool.remaining_weight || 0);
    const usedRaw = Number($('printerPrintGrams')?.value || 0);
    const used = Math.max(0, Math.min(remaining, usedRaw));
    const after = Math.max(0, remaining - used);
    const total = Math.max(1, Number(activeSpool.total_weight || 1));
    const pct = Math.max(0, Math.min(100, (after / total) * 100));

    $('weightNow').textContent = fmt(remaining);
    $('weightPrint').textContent = fmt(used);
    $('weightAfter').textContent = fmt(after);
    $('weightAfterPct').textContent = `${Math.round(pct)}% من السبول`;
    $('weightPreviewBar').style.width = `${pct}%`;
    $('printerWeightStatus').textContent = usedRaw > remaining ? `الطبعة أكبر من المتبقي؛ سيتم خصم ${fmt(remaining)} فقط.` : '';
    $('printerWeightStatus').style.color = usedRaw > remaining ? '#fbbf24' : '';
  }

  async function openForPrinter(printerId) {
    activePrinterId = printerId;
    $('printerWeightStatus').textContent = 'جاري تحميل بيانات السبول...';
    $('printerWeightModal').classList.add('show');

    const { data: printer, error: pError } = await dbWeight
      .from('printers')
      .select('id,name,loaded_spool_id')
      .eq('id', printerId)
      .single();

    if (pError || !printer) {
      $('printerWeightStatus').textContent = pError?.message || 'تعذر قراءة الطابعة.';
      $('printerWeightStatus').style.color = '#fca5a5';
      return;
    }

    $('printerWeightTitle').textContent = `استهلاك الفلمنت — ${printer.name}`;

    if (!printer.loaded_spool_id) {
      activeSpool = null;
      $('printerWeightStatus').textContent = 'ما في سبول مركب على هذه الطابعة.';
      $('printerWeightStatus').style.color = '#fca5a5';
      $('applyPrinterWeight').disabled = true;
      return;
    }

    const { data: spool, error: sError } = await dbWeight
      .from('spools')
      .select('id,name,material,color,total_weight,remaining_weight')
      .eq('id', printer.loaded_spool_id)
      .single();

    if (sError || !spool) {
      $('printerWeightStatus').textContent = sError?.message || 'تعذر قراءة السبول.';
      $('printerWeightStatus').style.color = '#fca5a5';
      $('applyPrinterWeight').disabled = true;
      return;
    }

    activeSpool = spool;
    $('printerWeightSpool').textContent = `${spool.name} · ${spool.material}${spool.color ? ` · ${spool.color}` : ''}`;
    $('printerPrintGrams').value = '';
    $('printerPrintGrams').max = String(Math.max(0, Number(spool.remaining_weight || 0)));
    $('applyPrinterWeight').disabled = false;
    $('printerWeightStatus').textContent = '';
    $('printerWeightStatus').style.color = '';
    updatePreview();
    $('printerPrintGrams').focus();
  }

  async function applyUsage() {
    if (!activeSpool) return;
    const requested = Number($('printerPrintGrams').value || 0);
    if (!(requested > 0)) {
      $('printerWeightStatus').textContent = 'اكتب جرامات الطبعة أولاً.';
      $('printerWeightStatus').style.color = '#fca5a5';
      return;
    }

    $('applyPrinterWeight').disabled = true;
    $('printerWeightStatus').textContent = 'جاري تحديث الوزن...';
    $('printerWeightStatus').style.color = '';

    const { data: fresh, error: readError } = await dbWeight
      .from('spools')
      .select('id,remaining_weight')
      .eq('id', activeSpool.id)
      .single();

    if (readError || !fresh) {
      $('printerWeightStatus').textContent = readError?.message || 'تعذر تحديث السبول.';
      $('printerWeightStatus').style.color = '#fca5a5';
      $('applyPrinterWeight').disabled = false;
      return;
    }

    const before = Number(fresh.remaining_weight || 0);
    const actualUsed = Math.min(requested, before);
    const after = Math.max(0, before - actualUsed);

    const { error: updateError } = await dbWeight
      .from('spools')
      .update({ remaining_weight: after })
      .eq('id', activeSpool.id);

    if (updateError) {
      $('printerWeightStatus').textContent = updateError.message;
      $('printerWeightStatus').style.color = '#fca5a5';
      $('applyPrinterWeight').disabled = false;
      return;
    }

    await dbWeight.from('usage_logs').insert({ spool_id: activeSpool.id, grams_used: actualUsed });

    $('printerWeightStatus').textContent = `تم الخصم: كان ${fmt(before)}، استُخدم ${fmt(actualUsed)}، والباقي ${fmt(after)}.`;
    $('printerWeightStatus').style.color = '#86efac';
    activeSpool.remaining_weight = after;
    updatePreview();

    setTimeout(() => window.location.reload(), 700);
  }

  function addButtons() {
    document.querySelectorAll('#printerGrid .printer').forEach(card => {
      if (card.querySelector('[data-printer-weight]')) return;
      const ref = card.querySelector('[data-printer-spool]');
      if (!ref) return;
      const id = ref.getAttribute('data-printer-spool');
      const actions = ref.closest('.actions');
      if (!actions || !id) return;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn small';
      btn.setAttribute('data-printer-weight', id);
      btn.textContent = 'تحديث الاستهلاك';
      actions.prepend(btn);
    });
  }

  function cardData(card) {
    const name = card.querySelector('h3')?.textContent?.trim() || '';
    const meta = card.querySelector('.meta')?.textContent || '';
    const materialMatch = meta.match(/(?:^|·)\s*(PLA|PETG|ASA|ABS|TPU|PA|PC|PPS|Other)\s*(?:·|$)/i);
    const material = materialMatch ? materialMatch[1].toUpperCase() : '';
    const remainText = card.querySelector('.remain strong')?.textContent || '0';
    const remaining = Number(remainText.replace(/[^0-9.]/g, '')) || 0;
    const totalText = card.querySelector('.remain small')?.textContent || '0';
    const total = Number(totalText.replace(/[^0-9.]/g, '')) || 1;
    const pct = remaining / Math.max(1, total);
    const brand = meta.split('·')[0]?.trim() || '';
    return { name, material, remaining, total, pct, brand };
  }

  function applyWarehouseSort() {
    if (applyingSort) return;
    const grid = $('spoolGrid');
    const sel = $('sortSpools');
    if (!grid || !sel) return;
    const cards = Array.from(grid.querySelectorAll('.spool'));
    if (cards.length < 2) return;

    const mode = sel.value;
    if (mode === 'default') return;
    applyingSort = true;

    const collator = new Intl.Collator(['ar', 'en'], { numeric: true, sensitivity: 'base' });
    cards.sort((a, b) => {
      const A = cardData(a), B = cardData(b);
      switch (mode) {
        case 'grams-desc': return B.remaining - A.remaining || collator.compare(A.name, B.name);
        case 'grams-asc': return A.remaining - B.remaining || collator.compare(A.name, B.name);
        case 'material': return collator.compare(A.material, B.material) || collator.compare(A.name, B.name);
        case 'name-asc': return collator.compare(A.name, B.name);
        case 'name-desc': return collator.compare(B.name, A.name);
        case 'low-first': return A.pct - B.pct || A.remaining - B.remaining;
        case 'brand': return collator.compare(A.brand, B.brand) || collator.compare(A.name, B.name);
        default: return 0;
      }
    });
    cards.forEach(card => grid.appendChild(card));
    applyingSort = false;
  }

  function addAssistantMessage(text, who = 'assistant') {
    const log = $('smartAssistantLog');
    if (!log) return;
    const msg = document.createElement('div');
    msg.style.cssText = who === 'user'
      ? 'margin:7px 0 7px 18%;padding:9px 11px;border-radius:12px;background:#1d4f91;color:#fff;font-size:13px;white-space:pre-wrap'
      : 'margin:7px 18% 7px 0;padding:9px 11px;border-radius:12px;background:#0d1525;border:1px solid #26344b;color:#e5e7eb;font-size:13px;white-space:pre-wrap';
    msg.textContent = text;
    log.appendChild(msg);
    log.scrollTop = log.scrollHeight;
  }

  async function getInventorySummary() {
    const { data, error } = await dbWeight
      .from('spools')
      .select('name,material,total_weight,remaining_weight,location');
    if (error) throw error;
    const all = data || [];
    const total = all.reduce((sum, s) => sum + Number(s.remaining_weight || 0), 0);
    const warehouse = all.filter(s => s.location !== 'printer').length;
    const loaded = all.filter(s => s.location === 'printer').length;
    const low = all.filter(s => Number(s.remaining_weight || 0) / Math.max(1, Number(s.total_weight || 1)) <= .2);
    const lowest = [...all].sort((a,b) => Number(a.remaining_weight)-Number(b.remaining_weight)).slice(0,3);
    return { all, total, warehouse, loaded, low, lowest };
  }

  async function runSmartCommand(raw) {
    const text = norm(raw);
    if (!text) return;
    addAssistantMessage(raw, 'user');
    const input = $('smartAssistantInput');
    if (input) input.value = '';

    const sort = $('sortSpools');
    const filter = $('filterMaterial');

    if ((text.includes('اكثر') || text.includes('الأكثر')) && (text.includes('اقل') || text.includes('الأقل')) && !text.includes('من الاقل') && !text.includes('من الأقل')) {
      sort.value = 'grams-desc'; applyWarehouseSort();
      return addAssistantMessage('تم. رتبت السبولات حسب الجرامات من الأكثر إلى الأقل.');
    }
    if ((text.includes('من الاقل') || text.includes('من الأقل') || text.includes('اقل الى اكثر') || text.includes('الأقل إلى الأكثر'))) {
      sort.value = 'grams-asc'; applyWarehouseSort();
      return addAssistantMessage('تم. رتبت السبولات حسب الجرامات من الأقل إلى الأكثر.');
    }
    if (text.includes('اقرب') && (text.includes('يخلص') || text.includes('نفاد')) || text.includes('الأقرب للنفاد')) {
      sort.value = 'low-first'; applyWarehouseSort();
      return addAssistantMessage('تم. حطيت السبولات الأقرب للنفاد أولاً.');
    }
    if (text.includes('حسب النوع') || text.includes('رتب النوع') || text.includes('حسب المادة')) {
      sort.value = 'material'; applyWarehouseSort();
      return addAssistantMessage('تم. رتبت حسب نوع المادة.');
    }
    if (text.includes('حسب الشركة')) {
      sort.value = 'brand'; applyWarehouseSort();
      return addAssistantMessage('تم. رتبت حسب الشركة.');
    }
    if (text.includes('الاسم') && (text.includes('عكس') || text.includes('تنازلي') || text.includes('z') || text.includes('ي الى ا'))) {
      sort.value = 'name-desc'; applyWarehouseSort();
      return addAssistantMessage('تم. رتبت الأسماء بالعكس.');
    }
    if (text.includes('الاسم')) {
      sort.value = 'name-asc'; applyWarehouseSort();
      return addAssistantMessage('تم. رتبت الأسماء أبجديًا.');
    }

    const materials = ['PLA','PETG','ASA','ABS','TPU','PA','PC','PPS'];
    const wanted = materials.find(m => text.includes(m.toLowerCase()));
    if (wanted && (text.includes('اعرض') || text.includes('ورني') || text.includes('اظهر') || text.includes('فلتر'))) {
      filter.value = wanted;
      filter.dispatchEvent(new Event('change', { bubbles: true }));
      setTimeout(applyWarehouseSort, 50);
      return addAssistantMessage(`تم. أعرض لك ${wanted} فقط.`);
    }
    if ((text.includes('اعرض') || text.includes('ورني')) && (text.includes('الكل') || text.includes('كل السبول'))) {
      filter.value = '';
      filter.dispatchEvent(new Event('change', { bubbles: true }));
      setTimeout(applyWarehouseSort, 50);
      return addAssistantMessage('تم. رجعت أعرض كل المواد.');
    }

    try {
      if (text.includes('كم سبول') || text.includes('عدد السبول')) {
        const s = await getInventorySummary();
        return addAssistantMessage(`عندك ${s.all.length} سبول إجمالاً: ${s.warehouse} في المخزن و${s.loaded} مركب على الطابعات.`);
      }
      if (text.includes('كم جرام') || text.includes('اجمالي') || text.includes('إجمالي')) {
        const s = await getInventorySummary();
        return addAssistantMessage(`إجمالي الفلمنت المتبقي عندك تقريبًا ${fmt(s.total)}.`);
      }
      if (text.includes('شو ناقص') || text.includes('وش ناقص') || text.includes('اقل سبول') || text.includes('أقل سبول')) {
        const s = await getInventorySummary();
        const lines = s.lowest.map((x,i) => `${i+1}. ${x.name} — ${Math.round(Number(x.remaining_weight || 0))}g`).join('\n');
        return addAssistantMessage(`أقل 3 سبولات عندك حاليًا:\n${lines || 'ما عندك سبولات.'}`);
      }
      if (text.includes('ملخص') || text.includes('اختصر')) {
        const s = await getInventorySummary();
        return addAssistantMessage(`ملخص سريع:\n• ${s.all.length} سبول\n• ${fmt(s.total)} متبقي إجمالاً\n• ${s.warehouse} في المخزن\n• ${s.loaded} على الطابعات\n• ${s.low.length} سبول عند 20% أو أقل`);
      }
    } catch (err) {
      return addAssistantMessage(`ما قدرت أقرأ البيانات الآن: ${err.message || err}`);
    }

    addAssistantMessage('أقدر حاليًا أرتب، أفلتر المواد، وأعطيك ملخص المخزون. جرّب مثلاً: «رتب من الأكثر للأقل» أو «اعرض PETG» أو «شو أقرب سبول يخلص؟».');
  }

  function installWarehouseTools() {
    const warehouse = $('warehouseView');
    const toolbar = warehouse?.querySelector('.toolbar');
    if (!warehouse || !toolbar) return;

    if (!$('sortSpools')) {
      const sort = document.createElement('select');
      sort.id = 'sortSpools';
      sort.setAttribute('aria-label', 'ترتيب السبولات');
      sort.style.cssText = 'width:auto;min-width:185px;margin:0';
      sort.innerHTML = `
        <option value="default">الترتيب الافتراضي</option>
        <option value="grams-desc">الجرامات: الأكثر ← الأقل</option>
        <option value="grams-asc">الجرامات: الأقل ← الأكثر</option>
        <option value="material">حسب النوع / المادة</option>
        <option value="name-asc">الاسم: أ ← ي</option>
        <option value="name-desc">الاسم: ي ← أ</option>
        <option value="low-first">الأقرب للنفاد أولاً</option>
        <option value="brand">حسب الشركة</option>`;
      toolbar.appendChild(sort);
      sort.addEventListener('change', applyWarehouseSort);
    }

    if (!$('smartAssistant')) {
      const box = document.createElement('div');
      box.id = 'smartAssistant';
      box.style.cssText = 'margin:0 0 14px;padding:12px;border:1px solid #26344b;border-radius:16px;background:#101929';
      box.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px">
          <strong style="font-size:14px">المساعد الذكي</strong>
          <span style="font-size:11px;color:#94a3b8">أوامر سريعة للمخزون</span>
        </div>
        <div id="smartAssistantLog" style="max-height:170px;overflow:auto;margin-bottom:8px"></div>
        <div style="display:flex;gap:7px;flex-wrap:wrap;margin-bottom:8px">
          <button type="button" class="btn secondary small" data-smart-cmd="رتب من الأكثر للأقل">الأكثر أولاً</button>
          <button type="button" class="btn secondary small" data-smart-cmd="شو أقرب سبول يخلص؟">الأقرب للنفاد</button>
          <button type="button" class="btn secondary small" data-smart-cmd="ملخص المخزون">ملخص</button>
        </div>
        <div style="display:flex;gap:8px">
          <input id="smartAssistantInput" type="text" placeholder="مثال: اعرض PETG ورتب من الأقل للأكثر" style="margin:0;min-width:0;flex:1">
          <button id="smartAssistantSend" type="button" class="btn">إرسال</button>
        </div>`;
      const grid = $('spoolGrid');
      warehouse.insertBefore(box, grid);
      addAssistantMessage('هلا 👋 قل لي كيف تبي أرتب أو أختصر المخزون.');

      $('smartAssistantSend').addEventListener('click', () => runSmartCommand($('smartAssistantInput').value));
      $('smartAssistantInput').addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); runSmartCommand(e.currentTarget.value); }
      });
      box.addEventListener('click', e => {
        const b = e.target.closest('[data-smart-cmd]');
        if (b) runSmartCommand(b.getAttribute('data-smart-cmd'));
      });
    }
  }

  document.addEventListener('click', e => {
    const btn = e.target.closest('[data-printer-weight]');
    if (btn) openForPrinter(btn.getAttribute('data-printer-weight'));
  });

  $('printerPrintGrams')?.addEventListener('input', updatePreview);
  $('cancelPrinterWeight')?.addEventListener('click', closeModal);
  $('applyPrinterWeight')?.addEventListener('click', applyUsage);

  const printerGrid = $('printerGrid');
  if (printerGrid) {
    new MutationObserver(addButtons).observe(printerGrid, { childList: true, subtree: true });
    addButtons();
  }

  const spoolGrid = $('spoolGrid');
  if (spoolGrid) {
    new MutationObserver(() => {
      if (!applyingSort) setTimeout(applyWarehouseSort, 0);
    }).observe(spoolGrid, { childList: true });
  }

  installWarehouseTools();
})();