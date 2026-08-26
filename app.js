(() => {
  const cfg = window.APP_CONFIG || {};
  if (!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY || cfg.SUPABASE_URL.includes("YOUR_") || cfg.SUPABASE_ANON_KEY.includes("YOUR_")) {
    document.body.innerHTML = '<div style="max-width:700px;margin:50px auto;padding:20px;font-family:Arial;direction:rtl"><h2>يلزم ربط Supabase</h2></div>';
    return;
  }

  const db = supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
  const $ = id => document.getElementById(id);
  let spools = [];
  let printers = [];
  let activeUseId = null;

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const validHex = v => /^#[0-9A-Fa-f]{6}$/.test(v);
  const normalizeName = v => String(v || '').trim().replace(/\s+/g,' ').toLowerCase();

  function show(view) {
    $('authView').classList.toggle('hidden', view !== 'auth');
    $('appView').classList.toggle('hidden', view !== 'app');
  }
  function setStatus(id,msg,isError=false){ const el=$(id); el.textContent=msg||''; el.style.color=isError?'#fca5a5':''; }

  function getAuthFields(){
    const email=$('email').value.trim(), password=$('password').value;
    if(!email||!password){setStatus('authStatus','اكتب البريد الإلكتروني وكلمة المرور أولاً.',true);return null;}
    if(!/^\S+@\S+\.\S+$/.test(email)){setStatus('authStatus','اكتب بريد إلكتروني صحيح.',true);return null;}
    if(password.length<6){setStatus('authStatus','كلمة المرور لازم تكون 6 أحرف على الأقل.',true);return null;}
    return {email,password};
  }

  function suggestedName(base, excludeId=null){
    const root=String(base||'').trim().replace(/\s+\d+$/,'').trim() || 'Spool';
    const used=new Set(spools.filter(s=>s.id!==excludeId).map(s=>normalizeName(s.name)));
    if(!used.has(normalizeName(root))) return root;
    let n=2;
    while(used.has(normalizeName(`${root} ${n}`))) n++;
    return `${root} ${n}`;
  }

  async function refreshSession(){
    const {data:{session}}=await db.auth.getSession();
    if(!session) return show('auth');
    $('userEmail').textContent=session.user.email||'';
    show('app');
    await loadAll();
  }

  async function loadAll(){
    setStatus('appStatus','جاري التحديث...');
    const [sRes,pRes]=await Promise.all([
      db.from('spools').select('*').order('created_at',{ascending:false}),
      db.from('printers').select('*').order('created_at',{ascending:false})
    ]);
    if(sRes.error) return setStatus('appStatus',sRes.error.message,true);
    if(pRes.error) return setStatus('printerStatus',pRes.error.message,true);
    spools=sRes.data||[]; printers=pRes.data||[];
    setStatus('appStatus',''); setStatus('printerStatus','');
    renderAll();
  }

  function renderAll(){ renderStats(); renderSpools(); renderPrinters(); fillPrinterSpoolOptions(); }

  function renderStats(){
    $('statCount').textContent=spools.length;
    $('statRemaining').textContent=Math.round(spools.reduce((a,s)=>a+Number(s.remaining_weight||0),0)).toLocaleString()+'g';
    $('statLow').textContent=spools.filter(s=>Number(s.total_weight)>0 && Number(s.remaining_weight)/Number(s.total_weight)<=.2).length;
  }

  function renderSpools(){
    const filter=$('filterMaterial').value;
    const rows=spools.filter(s=>s.location!=='printer' && (!filter||s.material===filter));
    $('spoolGrid').innerHTML=rows.map(s=>{
      const pct=Math.max(0,Math.min(100,(Number(s.remaining_weight)/Number(s.total_weight))*100||0));
      const cls=pct<=10?'critical':pct<=20?'low':'ok';
      const hex=validHex(s.color_hex)?s.color_hex:'#808080';
      return `<article class="spool">
        <div class="spool-head">
          <div>
            <div class="color-row"><span class="color-dot" style="background:${hex}"></span><h3>${esc(s.name)}</h3></div>
            <div class="meta">${esc(s.brand||'')}${s.brand?' · ':''}${esc(s.material)} · ${esc(s.color||'بدون اسم لون')}</div>
            <span class="warehouse-badge">المخزن</span>
          </div>
          <div class="remain"><strong class="${cls}">${Math.round(Number(s.remaining_weight))}g</strong><small>من ${Math.round(Number(s.total_weight))}g</small></div>
        </div>
        <div class="bar"><div style="width:${pct}%;background:linear-gradient(90deg,${hex},#22c55e)"></div></div>
        <div class="meta" style="margin-bottom:10px">${Math.round(pct)}% متبقي${Number(s.empty_spool_weight)>0?` · وزن السبول الفاضي ${Math.round(Number(s.empty_spool_weight))}g`:''}</div>
        <div class="actions">
          <button class="btn small" data-use="${s.id}">استخدمت فلمنت</button>
          <button class="btn secondary small" data-duplicate="${s.id}">تكرار</button>
          <button class="btn secondary small" data-edit="${s.id}">تعديل</button>
          <button class="btn danger small" data-delete="${s.id}">حذف</button>
        </div>
      </article>`;
    }).join('');
    $('emptyState').classList.toggle('hidden',rows.length>0);
  }

  function renderPrinters(){
    $('printerGrid').innerHTML=printers.map(p=>{
      const s=spools.find(x=>x.id===p.loaded_spool_id);
      const hex=s&&validHex(s.color_hex)?s.color_hex:'#808080';
      const loaded=s?`<div class="loaded"><span class="color-dot" style="background:${hex}"></span><div class="grow"><strong>${esc(s.name)}</strong><div class="meta">${esc(s.material)} · ${esc(s.color||'بدون اسم لون')} · ${Math.round(Number(s.remaining_weight))}g متبقي</div></div></div>`:`<div class="loaded"><div class="grow"><strong>بدون فلمنت</strong><div class="meta">ما في سبول مركب حاليًا</div></div></div>`;
      return `<article class="printer">
        <div class="printer-head"><div><h3>${esc(p.name)}</h3><div class="meta">${esc(p.model||'بدون موديل')}</div></div></div>
        ${loaded}
        <div class="actions" style="margin-top:12px">
          <button class="btn small" data-printer-spool="${p.id}">تغيير الفلمنت</button>
          <button class="btn secondary small" data-printer-edit="${p.id}">تعديل</button>
          <button class="btn danger small" data-printer-delete="${p.id}">حذف</button>
        </div>
      </article>`;
    }).join('');
    $('printerEmpty').classList.toggle('hidden',printers.length>0);
  }

  function fillPrinterSpoolOptions(selectedId=''){
    const sel=$('printerSpool');
    const current=selectedId||sel.value;
    const items=spools.slice().sort((a,b)=>a.name.localeCompare(b.name));
    sel.innerHTML='<option value="">بدون سبول</option>'+items.map(s=>`<option value="${s.id}">${esc(s.name)} — ${esc(s.material)} — ${Math.round(Number(s.remaining_weight))}g</option>`).join('');
    if(items.some(s=>s.id===current)) sel.value=current; else sel.value='';
  }

  $('warehouseTab').addEventListener('click',()=>{$('warehouseTab').classList.add('active');$('printersTab').classList.remove('active');$('warehouseView').classList.remove('hidden');$('printersView').classList.add('hidden');});
  $('printersTab').addEventListener('click',()=>{$('printersTab').classList.add('active');$('warehouseTab').classList.remove('active');$('printersView').classList.remove('hidden');$('warehouseView').classList.add('hidden');});

  $('loginBtn').addEventListener('click',async()=>{const f=getAuthFields();if(!f)return;setStatus('authStatus','جاري تسجيل الدخول...');const {error}=await db.auth.signInWithPassword(f);if(error)return setStatus('authStatus',error.message,true);setStatus('authStatus','');await refreshSession();});
  $('signupBtn').addEventListener('click',async()=>{const f=getAuthFields();if(!f)return;setStatus('authStatus','جاري إنشاء الحساب...');const {data,error}=await db.auth.signUp({email:f.email,password:f.password,options:{emailRedirectTo:'https://filaments-cloud.vercel.app/'}});if(error)return setStatus('authStatus',error.message,true);setStatus('authStatus',data.session?'تم إنشاء الحساب وتسجيل الدخول.':'تم إنشاء الحساب. تحقق من بريدك الإلكتروني لتأكيده.');if(data.session)await refreshSession();});
  $('logoutBtn').addEventListener('click',async()=>{await db.auth.signOut();spools=[];printers=[];show('auth');});

  $('colorHex').addEventListener('input',()=>{$('colorHexText').value=$('colorHex').value.toUpperCase();});
  $('colorHexText').addEventListener('input',()=>{const v=$('colorHexText').value.trim();if(validHex(v))$('colorHex').value=v;});

  $('addBtn').addEventListener('click',()=>{
    $('spoolForm').reset();$('spoolId').value='';$('totalWeight').value=1000;$('remainingWeight').value=1000;$('emptySpoolWeight').value=0;$('colorHex').value='#808080';$('colorHexText').value='#808080';$('modalTitle').textContent='إضافة سبول';$('spoolModal').classList.add('show');
  });
  $('cancelModal').addEventListener('click',()=> $('spoolModal').classList.remove('show'));
  $('cancelUseBtn').addEventListener('click',()=> $('useModal').classList.remove('show'));
  $('filterMaterial').addEventListener('change',renderSpools);

  $('spoolForm').addEventListener('submit',async e=>{
    e.preventDefault();
    const id=$('spoolId').value||null;
    const entered=$('name').value.trim();
    if(!entered) return;
    const conflict=spools.find(s=>s.id!==id && normalizeName(s.name)===normalizeName(entered));
    if(conflict){
      const suggestion=suggestedName(entered,id);
      alert(`هذا الاسم موجود بالفعل. أقترح عليك: ${suggestion}`);
      $('name').value=suggestion;$('name').focus();return;
    }
    const total=Number($('totalWeight').value), remain=Math.min(total,Math.max(0,Number($('remainingWeight').value)));
    const hex=validHex($('colorHexText').value.trim())?$('colorHexText').value.trim():$('colorHex').value;
    const payload={name:entered,material:$('material').value,color:$('color').value.trim(),color_hex:hex,total_weight:total,remaining_weight:remain,empty_spool_weight:Number($('emptySpoolWeight').value||0),brand:$('brand').value.trim(),notes:$('notes').value.trim()};
    const result=id?await db.from('spools').update(payload).eq('id',id):await db.from('spools').insert(payload);
    if(result.error)return alert(result.error.message);
    $('spoolModal').classList.remove('show');await loadAll();
  });

  $('spoolGrid').addEventListener('click',async e=>{
    const use=e.target.closest('[data-use]'), duplicate=e.target.closest('[data-duplicate]'), edit=e.target.closest('[data-edit]'), del=e.target.closest('[data-delete]');
    if(use){activeUseId=use.dataset.use;const s=spools.find(x=>x.id===activeUseId);$('useTitle').textContent='تسجيل استخدام — '+s.name;$('usedWeight').value=50;setStatus('useStatus',`المتبقي الآن ${Math.round(Number(s.remaining_weight))}g`);$('useModal').classList.add('show');}
    if(duplicate){const s=spools.find(x=>x.id===duplicate.dataset.duplicate);if(!s)return;const payload={name:suggestedName(s.name),brand:s.brand||'',material:s.material,color:s.color||'',color_hex:validHex(s.color_hex)?s.color_hex:'#808080',total_weight:Number(s.total_weight),remaining_weight:Number(s.total_weight),empty_spool_weight:Number(s.empty_spool_weight||0),notes:s.notes||'',location:'warehouse'};const {error}=await db.from('spools').insert(payload);if(error)return alert(error.message);await loadAll();}
    if(edit){const s=spools.find(x=>x.id===edit.dataset.edit);$('spoolId').value=s.id;$('name').value=s.name;$('material').value=s.material;$('color').value=s.color||'';$('colorHex').value=validHex(s.color_hex)?s.color_hex:'#808080';$('colorHexText').value=$('colorHex').value;$('totalWeight').value=s.total_weight;$('remainingWeight').value=s.remaining_weight;$('emptySpoolWeight').value=s.empty_spool_weight||0;$('brand').value=s.brand||'';$('notes').value=s.notes||'';$('modalTitle').textContent='تعديل السبول';$('spoolModal').classList.add('show');}
    if(del){const id=del.dataset.delete;const usedBy=printers.find(p=>p.loaded_spool_id===id);if(usedBy)return alert(`هذا السبول مركب حاليًا في الطابعة: ${usedBy.name}. شله من الطابعة أولاً.`);if(!confirm('حذف هذا السبول نهائيًا؟'))return;const {error}=await db.from('spools').delete().eq('id',id);if(error)return alert(error.message);await loadAll();}
  });

  $('applyUseBtn').addEventListener('click',async()=>{
    const s=spools.find(x=>x.id===activeUseId);if(!s)return;const used=Number($('usedWeight').value);if(!(used>0))return setStatus('useStatus','أدخل وزنًا أكبر من صفر.',true);
    const actual=Math.min(used,Number(s.remaining_weight));const newRemaining=Math.max(0,Number(s.remaining_weight)-used);
    const {error}=await db.from('spools').update({remaining_weight:newRemaining}).eq('id',s.id);if(error)return setStatus('useStatus',error.message,true);
    await db.from('usage_logs').insert({spool_id:s.id,grams_used:actual});$('useModal').classList.remove('show');await loadAll();
  });

  $('addPrinterBtn').addEventListener('click',()=>{
    $('printerForm').reset();$('printerId').value='';$('printerModalTitle').textContent='إضافة طابعة';fillPrinterSpoolOptions('');$('printerModal').classList.add('show');
  });
  $('cancelPrinterModal').addEventListener('click',()=> $('printerModal').classList.remove('show'));

  $('printerForm').addEventListener('submit',async e=>{
    e.preventDefault();
    const id=$('printerId').value||null, name=$('printerName').value.trim();
    const conflict=printers.find(p=>p.id!==id && normalizeName(p.name)===normalizeName(name));
    if(conflict)return alert('اسم الطابعة موجود بالفعل.');
    const old=id?printers.find(p=>p.id===id)?.loaded_spool_id:null;
    const newSpool=$('printerSpool').value||null;
    const payload={name,model:$('printerModel').value.trim(),notes:$('printerNotes').value.trim(),loaded_spool_id:newSpool};
    const result=id?await db.from('printers').update(payload).eq('id',id):await db.from('printers').insert(payload).select().single();
    if(result.error)return alert(result.error.message);
    const printerId=id || result.data.id;
    if(old && old!==newSpool) await db.from('spools').update({location:'warehouse'}).eq('id',old);
    if(newSpool){
      const other=printers.find(p=>p.id!==printerId && p.loaded_spool_id===newSpool);
      if(other) await db.from('printers').update({loaded_spool_id:null}).eq('id',other.id);
      await db.from('spools').update({location:'printer'}).eq('id',newSpool);
    }
    $('printerModal').classList.remove('show');await loadAll();
  });

  $('printerGrid').addEventListener('click',async e=>{
    const swap=e.target.closest('[data-printer-spool]'), edit=e.target.closest('[data-printer-edit]'), del=e.target.closest('[data-printer-delete]');
    if(swap){
      const p=printers.find(x=>x.id===swap.dataset.printerSpool);if(!p)return;
      $('printerId').value=p.id;$('printerName').value=p.name;$('printerModel').value=p.model||'';$('printerNotes').value=p.notes||'';
      fillPrinterSpoolOptions(p.loaded_spool_id||'');
      $('printerModalTitle').textContent='تغيير فلمنت الطابعة';
      $('printerModal').classList.add('show');
    }
    if(edit){
      const p=printers.find(x=>x.id===edit.dataset.printerEdit);if(!p)return;
      $('printerId').value=p.id;$('printerName').value=p.name;$('printerModel').value=p.model||'';$('printerNotes').value=p.notes||'';fillPrinterSpoolOptions(p.loaded_spool_id||'');$('printerModalTitle').textContent='تعديل الطابعة';$('printerModal').classList.add('show');
    }
    if(del){
      const p=printers.find(x=>x.id===del.dataset.printerDelete);if(!p)return;if(!confirm(`حذف الطابعة ${p.name}؟`))return;
      if(p.loaded_spool_id) await db.from('spools').update({location:'warehouse'}).eq('id',p.loaded_spool_id);
      const {error}=await db.from('printers').delete().eq('id',p.id);if(error)return alert(error.message);await loadAll();
    }
  });

  db.auth.onAuthStateChange(()=>refreshSession());
  refreshSession();
})();