(() => {
  const cfg = window.APP_CONFIG || {};
  if (!window.supabase || !cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) return;

  const db = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });

  const $ = id => document.getElementById(id);
  const fmtDuration = ms => {
    ms = Math.max(0, Number(ms) || 0);
    const totalSec = Math.floor(ms / 1000);
    const d = Math.floor(totalSec / 86400);
    const h = Math.floor((totalSec % 86400) / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (d > 0) return `${d}ي ${h}س ${m}د`;
    if (h > 0) return `${h}س ${m}د ${s}ث`;
    return `${m}د ${s}ث`;
  };

  let timerHandle = null;
  let finishing = new Set();

  function ensureTimerFields() {
    const form = $('printerForm');
    if (!form || $('printTimeFields')) return;
    const grid = form.querySelector('.form-grid');
    const notesLabel = $('printerNotes')?.closest('label');
    if (!grid) return;

    const wrap = document.createElement('div');
    wrap.id = 'printTimeFields';
    wrap.className = 'full';
    wrap.style.cssText = 'display:none;background:var(--card2);border:1px solid var(--line);border-radius:12px;padding:12px';
    wrap.innerHTML = `
      <div style="font-weight:800;margin-bottom:8px;color:var(--text)">⏱ الوقت المتبقي للطباعة</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <label>الساعات<input id="printHours" type="number" min="0" max="999" step="1" inputmode="numeric" value="0"></label>
        <label>الدقائق<input id="printMinutes" type="number" min="0" max="59" step="1" inputmode="numeric" value="0"></label>
      </div>
      <div id="printEndPreview" class="muted" style="font-size:12px;margin-top:8px"></div>
      <div class="muted" style="font-size:11px;margin-top:5px">الوقت ينحفظ في Cloud ويستمر حتى لو سكرت الموقع.</div>`;
    if (notesLabel) grid.insertBefore(wrap, notesLabel); else grid.appendChild(wrap);

    const status = $('printerStatus');
    status?.addEventListener('change', toggleTimeFields);
    $('printHours')?.addEventListener('input', updateEndPreview);
    $('printMinutes')?.addEventListener('input', updateEndPreview);
    toggleTimeFields();
  }

  function toggleTimeFields() {
    const wrap = $('printTimeFields');
    if (!wrap) return;
    const printing = $('printerStatus')?.value === 'printing';
    wrap.style.display = printing ? 'block' : 'none';
    if (printing) updateEndPreview();
  }

  function updateEndPreview() {
    const out = $('printEndPreview');
    if (!out) return;
    const h = Math.max(0, Number($('printHours')?.value || 0));
    const m = Math.max(0, Math.min(59, Number($('printMinutes')?.value || 0)));
    const mins = Math.round(h * 60 + m);
    if (mins <= 0) {
      out.textContent = 'اكتب الوقت المتبقي.';
      return;
    }
    const end = new Date(Date.now() + mins * 60000);
    out.textContent = `النهاية المتوقعة: ${new Intl.DateTimeFormat('ar-AE',{dateStyle:'medium',timeStyle:'short'}).format(end)}`;
  }

  async function loadPrinterRows() {
    const { data, error } = await db.from('printers').select('id,name,loaded_spool_id,status,print_started_at,print_ends_at,print_duration_minutes');
    if (error) return [];
    return data || [];
  }

  async function filterSpoolOptions() {
    const select = $('printerSpool');
    const form = $('printerForm');
    if (!select || !form) return;
    const currentPrinterId = $('printerId')?.value || '';
    const rows = await loadPrinterRows();
    const occupied = new Set(rows.filter(p => p.loaded_spool_id && p.id !== currentPrinterId).map(p => p.loaded_spool_id));
    Array.from(select.options).forEach(opt => {
      if (!opt.value) return;
      if (occupied.has(opt.value)) opt.remove();
    });

    const current = rows.find(p => p.id === currentPrinterId);
    if (current?.loaded_spool_id && !Array.from(select.options).some(o => o.value === current.loaded_spool_id)) {
      const { data: spool } = await db.from('spools').select('id,name,material,remaining_weight').eq('id', current.loaded_spool_id).maybeSingle();
      if (spool) {
        const o = document.createElement('option');
        o.value = spool.id;
        o.textContent = `${spool.name} — ${spool.material || ''} — ${Math.round(Number(spool.remaining_weight || 0)).toLocaleString()}g`;
        select.appendChild(o);
        select.value = spool.id;
      }
    }
  }

  async function preloadExistingTimer() {
    const id = $('printerId')?.value;
    if (!id) {
      if ($('printHours')) $('printHours').value = '0';
      if ($('printMinutes')) $('printMinutes').value = '0';
      toggleTimeFields();
      return;
    }
    const { data: p } = await db.from('printers').select('status,print_ends_at').eq('id', id).maybeSingle();
    if (!p) return;
    if ($('printerStatus')) $('printerStatus').value = p.status || 'idle';
    if (p.status === 'printing' && p.print_ends_at) {
      const leftMin = Math.max(0, Math.ceil((new Date(p.print_ends_at).getTime() - Date.now()) / 60000));
      if ($('printHours')) $('printHours').value = String(Math.floor(leftMin / 60));
      if ($('printMinutes')) $('printMinutes').value = String(leftMin % 60);
    } else {
      if ($('printHours')) $('printHours').value = '0';
      if ($('printMinutes')) $('printMinutes').value = '0';
    }
    toggleTimeFields();
    updateEndPreview();
  }

  async function refreshPrinterModal() {
    ensureTimerFields();
    await filterSpoolOptions();
    await preloadExistingTimer();
  }

  async function savePrinterEnhanced(e) {
    e.preventDefault();
    e.stopImmediatePropagation();

    const form = $('printerForm');
    const id = $('printerId')?.value || null;
    const name = $('printerName')?.value.trim() || '';
    if (!name) return;

    const status = $('printerStatus')?.value || 'idle';
    const nextSpool = $('printerSpool')?.value || null;
    const rows = await loadPrinterRows();
    const old = id ? rows.find(p => p.id === id) : null;
    const usedBy = nextSpool ? rows.find(p => p.loaded_spool_id === nextSpool && p.id !== id) : null;
    if (usedBy) {
      alert(`هذا السبول مركب بالفعل على ${usedBy.name}. اختر سبول ثاني.`);
      await filterSpoolOptions();
      return;
    }

    let startedAt = null, endsAt = null, durationMinutes = null;
    if (status === 'printing') {
      const h = Math.max(0, Math.floor(Number($('printHours')?.value || 0)));
      const m = Math.max(0, Math.min(59, Math.floor(Number($('printMinutes')?.value || 0))));
      durationMinutes = h * 60 + m;
      if (durationMinutes <= 0) {
        alert('اكتب الوقت المتبقي للطباعة بالساعات أو الدقائق.');
        return;
      }
      const now = Date.now();
      startedAt = new Date(now).toISOString();
      endsAt = new Date(now + durationMinutes * 60000).toISOString();
    }

    const payload = {
      name,
      model: $('printerModel')?.value.trim() || '',
      status,
      location_name: $('printerLocation')?.value.trim() || null,
      notes: $('printerNotes')?.value.trim() || '',
      loaded_spool_id: nextSpool,
      print_started_at: startedAt,
      print_ends_at: endsAt,
      print_duration_minutes: durationMinutes
    };

    const result = id
      ? await db.from('printers').update(payload).eq('id', id)
      : await db.from('printers').insert(payload);

    if (result.error) {
      alert(result.error.message);
      return;
    }

    if (old?.loaded_spool_id && old.loaded_spool_id !== nextSpool) {
      await db.from('spools').update({ location: 'warehouse' }).eq('id', old.loaded_spool_id);
    }
    if (nextSpool) {
      await db.from('spools').update({ location: 'printer' }).eq('id', nextSpool);
    }

    $('printerModal')?.classList.remove('show');
    window.location.reload();
  }

  async function markFinished(p) {
    if (!p?.id || finishing.has(p.id)) return;
    finishing.add(p.id);
    await db.from('printers').update({
      status: 'idle',
      print_started_at: null,
      print_ends_at: null,
      print_duration_minutes: null
    }).eq('id', p.id);
    finishing.delete(p.id);
  }

  function timerHtml(p) {
    if (p.status !== 'printing' || !p.print_ends_at) return '';
    const end = new Date(p.print_ends_at).getTime();
    const left = Math.max(0, end - Date.now());
    const start = p.print_started_at ? new Date(p.print_started_at).getTime() : end - Math.max(0, Number(p.print_duration_minutes || 0)) * 60000;
    const total = Math.max(1, end - start);
    const elapsed = Math.max(0, Math.min(total, Date.now() - start));
    const progress = Math.max(0, Math.min(100, elapsed / total * 100));
    return `<div data-cloud-timer="${p.id}" style="margin:10px 0;background:var(--card2);border:1px solid var(--line);border-radius:12px;padding:10px">
      <div style="display:flex;justify-content:space-between;gap:10px;align-items:center">
        <div><b style="color:var(--text)">⏱ ${fmtDuration(left)} متبقي</b><div class="muted" style="font-size:11px;margin-top:3px">مر ${fmtDuration(elapsed)}</div></div>
        <span class="tag">${Math.round(progress)}%</span>
      </div>
      <div class="bar" style="margin-top:8px"><i style="width:${progress}%;background:var(--accent)"></i></div>
      <div class="muted" style="font-size:11px">النهاية: ${new Intl.DateTimeFormat('ar-AE',{timeStyle:'short'}).format(new Date(end))}</div>
    </div>`;
  }

  async function renderCloudTimers() {
    const rows = await loadPrinterRows();
    const now = Date.now();
    for (const p of rows) {
      if (p.status === 'printing' && p.print_ends_at && new Date(p.print_ends_at).getTime() <= now) {
        await markFinished(p);
        p.status = 'idle';
        p.print_ends_at = null;
      }
      const editBtn = document.querySelector(`[data-edit-printer="${CSS.escape(p.id)}"]`);
      const card = editBtn?.closest('.printer');
      if (!card) continue;
      card.querySelector('[data-cloud-timer]')?.remove();
      if (p.status === 'printing' && p.print_ends_at) {
        const actions = card.querySelector('.actions');
        const holder = document.createElement('div');
        holder.innerHTML = timerHtml(p);
        const timer = holder.firstElementChild;
        if (timer) card.insertBefore(timer, actions || null);
      }
    }
  }

  function startTimerLoop() {
    if (timerHandle) clearInterval(timerHandle);
    renderCloudTimers();
    timerHandle = setInterval(renderCloudTimers, 1000);
  }

  function watchUi() {
    ensureTimerFields();
    const printerModal = $('printerModal');
    if (printerModal) {
      new MutationObserver(() => {
        if (printerModal.classList.contains('show')) setTimeout(refreshPrinterModal, 30);
      }).observe(printerModal, { attributes: true, attributeFilter: ['class'] });
    }

    const grid = $('printerGrid');
    if (grid) {
      let t;
      new MutationObserver(() => {
        clearTimeout(t);
        t = setTimeout(renderCloudTimers, 40);
      }).observe(grid, { childList: true, subtree: true });
    }

    const form = $('printerForm');
    if (form) form.addEventListener('submit', savePrinterEnhanced, true);
    startTimerLoop();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watchUi, { once: true });
  else watchUi();
})();
