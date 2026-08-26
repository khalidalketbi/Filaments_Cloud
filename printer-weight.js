(() => {
  const cfg = window.APP_CONFIG || {};
  if (!window.supabase || !cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) return;

  const dbWeight = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });

  const $ = id => document.getElementById(id);
  let activePrinterId = null;
  let activeSpool = null;

  const fmt = n => `${Math.round(Number(n) || 0).toLocaleString()}g`;

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

    await dbWeight.from('usage_logs').insert({
      spool_id: activeSpool.id,
      grams_used: actualUsed
    });

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

  document.addEventListener('click', e => {
    const btn = e.target.closest('[data-printer-weight]');
    if (btn) openForPrinter(btn.getAttribute('data-printer-weight'));
  });

  $('printerPrintGrams')?.addEventListener('input', updatePreview);
  $('cancelPrinterWeight')?.addEventListener('click', closeModal);
  $('applyPrinterWeight')?.addEventListener('click', applyUsage);

  const grid = $('printerGrid');
  if (grid) {
    new MutationObserver(addButtons).observe(grid, { childList: true, subtree: true });
    addButtons();
  }
})();