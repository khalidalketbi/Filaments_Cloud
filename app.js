(() => {
  const cfg = window.APP_CONFIG || {};
  if (!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY ||
      cfg.SUPABASE_URL.includes("YOUR_") || cfg.SUPABASE_ANON_KEY.includes("YOUR_")) {
    document.body.innerHTML = '<div style="max-width:700px;margin:50px auto;padding:20px;font-family:Arial;direction:rtl"><h2>يلزم ربط Supabase</h2><p>افتح <b>config.js</b> وضع SUPABASE_URL و SUPABASE_ANON_KEY ثم ارفع الموقع.</p></div>';
    return;
  }

  const db = supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
  const $ = id => document.getElementById(id);
  let spools = [];
  let activeUseId = null;

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));

  function show(view) {
    $('authView').classList.toggle('hidden', view !== 'auth');
    $('appView').classList.toggle('hidden', view !== 'app');
  }

  function setStatus(id, msg, isError=false) {
    const el = $(id); el.textContent = msg || '';
    el.style.color = isError ? '#fca5a5' : '';
  }

  function getAuthFields() {
    const email = $('email').value.trim();
    const password = $('password').value;
    if (!email || !password) {
      setStatus('authStatus', 'اكتب البريد الإلكتروني وكلمة المرور أولاً.', true);
      return null;
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setStatus('authStatus', 'اكتب بريد إلكتروني صحيح.', true);
      return null;
    }
    if (password.length < 6) {
      setStatus('authStatus', 'كلمة المرور لازم تكون 6 أحرف على الأقل.', true);
      return null;
    }
    return { email, password };
  }

  async function refreshSession() {
    const { data: { session } } = await db.auth.getSession();
    if (!session) return show('auth');
    $('userEmail').textContent = session.user.email || '';
    show('app');
    await loadSpools();
  }

  async function loadSpools() {
    setStatus('appStatus', 'جاري التحديث...');
    const { data, error } = await db.from('spools').select('*').order('created_at', { ascending: false });
    if (error) return setStatus('appStatus', error.message, true);
    spools = data || [];
    setStatus('appStatus', '');
    render();
  }

  function render() {
    const filter = $('filterMaterial').value;
    const rows = filter ? spools.filter(s => s.material === filter) : spools;
    $('spoolGrid').innerHTML = rows.map(s => {
      const pct = Math.max(0, Math.min(100, (Number(s.remaining_weight) / Number(s.total_weight)) * 100 || 0));
      const cls = pct <= 10 ? 'critical' : pct <= 20 ? 'low' : 'ok';
      return `<article class="spool">
        <div class="spool-head">
          <div><h3>${esc(s.name)}</h3><div class="meta">${esc(s.brand || '')}${s.brand ? ' · ' : ''}${esc(s.material)} · ${esc(s.color || 'بدون لون')}</div></div>
          <div class="remain"><strong class="${cls}">${Math.round(Number(s.remaining_weight))}g</strong><small>من ${Math.round(Number(s.total_weight))}g</small></div>
        </div>
        <div class="bar"><div style="width:${pct}%"></div></div>
        <div class="meta" style="margin-bottom:10px">${Math.round(pct)}% متبقي${Number(s.empty_spool_weight) > 0 ? ` · وزن السبول الفاضي ${Math.round(Number(s.empty_spool_weight))}g` : ''}</div>
        <div class="actions">
          <button class="btn small" data-use="${s.id}">استخدمت فلمنت</button>
          <button class="btn secondary small" data-edit="${s.id}">تعديل</button>
          <button class="btn secondary small" data-reset="${s.id}">سبول جديد</button>
          <button class="btn danger small" data-delete="${s.id}">حذف</button>
        </div>
      </article>`;
    }).join('');

    $('emptyState').classList.toggle('hidden', rows.length > 0);
    $('statCount').textContent = spools.length;
    $('statRemaining').textContent = Math.round(spools.reduce((a,s)=>a+Number(s.remaining_weight || 0),0)).toLocaleString() + 'g';
    $('statLow').textContent = spools.filter(s => Number(s.remaining_weight) / Number(s.total_weight) <= .2).length;
  }

  $('loginBtn').addEventListener('click', async () => {
    const fields = getAuthFields();
    if (!fields) return;
    setStatus('authStatus','جاري تسجيل الدخول...');
    const { error } = await db.auth.signInWithPassword(fields);
    if (error) return setStatus('authStatus', error.message, true);
    setStatus('authStatus','');
    await refreshSession();
  });

  $('signupBtn').addEventListener('click', async () => {
    const fields = getAuthFields();
    if (!fields) return;
    setStatus('authStatus','جاري إنشاء الحساب...');
    const { data, error } = await db.auth.signUp(fields);
    if (error) return setStatus('authStatus', error.message, true);
    setStatus('authStatus', data.session ? 'تم إنشاء الحساب وتسجيل الدخول.' : 'تم إنشاء الحساب. تحقق من بريدك الإلكتروني لتأكيده.');
    if (data.session) await refreshSession();
  });

  $('logoutBtn').addEventListener('click', async () => { await db.auth.signOut(); spools=[]; show('auth'); });

  $('addBtn').addEventListener('click', () => {
    $('spoolForm').reset();
    $('spoolId').value = '';
    $('totalWeight').value = 1000;
    $('remainingWeight').value = 1000;
    $('emptySpoolWeight').value = 0;
    $('modalTitle').textContent = 'إضافة سبول';
    $('spoolModal').classList.add('show');
  });

  $('cancelModal').addEventListener('click', () => $('spoolModal').classList.remove('show'));
  $('cancelUseBtn').addEventListener('click', () => $('useModal').classList.remove('show'));
  $('filterMaterial').addEventListener('change', render);

  $('spoolForm').addEventListener('submit', async e => {
    e.preventDefault();
    const total = Number($('totalWeight').value);
    const remain = Math.min(total, Math.max(0, Number($('remainingWeight').value)));
    const payload = {
      name: $('name').value.trim(),
      material: $('material').value,
      color: $('color').value.trim(),
      total_weight: total,
      remaining_weight: remain,
      empty_spool_weight: Number($('emptySpoolWeight').value || 0),
      brand: $('brand').value.trim(),
      notes: $('notes').value.trim()
    };
    const id = $('spoolId').value;
    let result;
    if (id) result = await db.from('spools').update(payload).eq('id', id);
    else result = await db.from('spools').insert(payload);
    if (result.error) return alert(result.error.message);
    $('spoolModal').classList.remove('show');
    await loadSpools();
  });

  $('spoolGrid').addEventListener('click', async e => {
    const use = e.target.closest('[data-use]');
    const edit = e.target.closest('[data-edit]');
    const reset = e.target.closest('[data-reset]');
    const del = e.target.closest('[data-delete]');

    if (use) {
      activeUseId = use.dataset.use;
      const s = spools.find(x => x.id === activeUseId);
      $('useTitle').textContent = 'تسجيل استخدام — ' + s.name;
      $('usedWeight').value = 50;
      setStatus('useStatus', `المتبقي الآن ${Math.round(Number(s.remaining_weight))}g`);
      $('useModal').classList.add('show');
    }

    if (edit) {
      const s = spools.find(x => x.id === edit.dataset.edit);
      $('spoolId').value=s.id; $('name').value=s.name; $('material').value=s.material;
      $('color').value=s.color||''; $('totalWeight').value=s.total_weight;
      $('remainingWeight').value=s.remaining_weight; $('emptySpoolWeight').value=s.empty_spool_weight||0;
      $('brand').value=s.brand||''; $('notes').value=s.notes||'';
      $('modalTitle').textContent='تعديل السبول';
      $('spoolModal').classList.add('show');
    }

    if (reset) {
      const s = spools.find(x => x.id === reset.dataset.reset);
      if (!confirm(`تصفير الاستخدام وإرجاع ${s.name} إلى ${s.total_weight}g؟`)) return;
      const { error } = await db.from('spools').update({remaining_weight:s.total_weight}).eq('id', s.id);
      if (error) return alert(error.message);
      await loadSpools();
    }

    if (del) {
      if (!confirm('حذف هذا السبول نهائيًا؟')) return;
      const { error } = await db.from('spools').delete().eq('id', del.dataset.delete);
      if (error) return alert(error.message);
      await loadSpools();
    }
  });

  $('applyUseBtn').addEventListener('click', async () => {
    const s = spools.find(x => x.id === activeUseId);
    if (!s) return;
    const used = Number($('usedWeight').value);
    if (!(used > 0)) return setStatus('useStatus','أدخل وزنًا أكبر من صفر.',true);
    const newRemaining = Math.max(0, Number(s.remaining_weight) - used);

    const { error: spoolError } = await db.from('spools')
      .update({ remaining_weight: newRemaining }).eq('id', s.id);
    if (spoolError) return setStatus('useStatus',spoolError.message,true);

    await db.from('usage_logs').insert({
      spool_id: s.id,
      grams_used: Math.min(used, Number(s.remaining_weight))
    });

    $('useModal').classList.remove('show');
    await loadSpools();
  });

  db.auth.onAuthStateChange(() => refreshSession());
  refreshSession();
})();