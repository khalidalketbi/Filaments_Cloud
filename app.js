(() => {
  const cfg = window.APP_CONFIG || {};
  if (!window.supabase || !cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) return;
  const db = supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm = s => String(s || '').trim().replace(/\s+/g, ' ').toLowerCase();
  const num = v => Number(v) || 0;
  const fmtG = v => `${Math.round(num(v)).toLocaleString()}g`;
  const fmtMoney = v => v == null || v === '' ? '—' : `${num(v).toLocaleString(undefined,{maximumFractionDigits:2})} AED`;
  const validHex = v => /^#[0-9a-f]{6}$/i.test(String(v || ''));
  const dateText = v => v ? new Intl.DateTimeFormat('ar-AE',{dateStyle:'medium'}).format(new Date(v)) : '—';
  const timeText = v => v ? new Intl.DateTimeFormat('ar-AE',{dateStyle:'short',timeStyle:'short'}).format(new Date(v)) : '—';

  let user = null, spools = [], printers = [], usage = [], prefs = {theme:'midnight',view_mode:'cards',low_stock_percent:20};
  let activePage = 'dashboard', activeUseId = null;

  function showAuth(authenticated){ $('authView').classList.toggle('hidden', authenticated); $('appView').classList.toggle('hidden', !authenticated); }
  function status(id,msg,error=false){ const e=$(id); if(!e)return; e.textContent=msg||''; e.style.color=error?'var(--danger)':''; }
  function pct(s){ return Math.max(0,Math.min(100,num(s.remaining_weight)/Math.max(1,num(s.total_weight))*100)); }
  function usedWeight(s){ return Math.max(0,num(s.total_weight)-num(s.remaining_weight)); }
  function remainingMeters(s){
    const d = num(s.diameter || 1.75) / 10; // cm
    const density = Math.max(.001,num(s.density || 1.24));
    const area = Math.PI * Math.pow(d/2,2);
    return (num(s.remaining_weight)/density/area)/100;
  }
  function stockClass(s){ const p=pct(s); return p<=10?'var(--danger)':p<=prefs.low_stock_percent?'var(--warn)':'var(--accent2)'; }
  function mountedPrinter(spoolId){ return printers.find(p=>p.loaded_spool_id===spoolId); }
  function spoolLocation(s){ const p=mountedPrinter(s.id); return p ? `🖨 ${p.name}` : (s.location_name || 'Warehouse'); }
  function suggestion(base,exclude=null){
    const root=String(base||'Spool').trim().replace(/\s+\d+$/,'').trim()||'Spool';
    const used=new Set(spools.filter(s=>s.id!==exclude).map(s=>norm(s.name)));
    if(!used.has(norm(root))) return root; let n=2; while(used.has(norm(`${root} ${n}`))) n++; return `${root} ${n}`;
  }
  function matches(s,q){
    if(!q)return true;
    const p=mountedPrinter(s.id);
    return [s.name,s.brand,s.material,s.color,s.location_name,s.lot_nr,s.article_number,s.notes,p?.name].some(v=>norm(v).includes(q));
  }

  async function loadPrefs(){
    const {data}=await db.from('user_preferences').select('*').maybeSingle();
    if(data) prefs={...prefs,...data};
    document.documentElement.dataset.theme=prefs.theme||'midnight';
    $('lowStockSetting').value=prefs.low_stock_percent||20; $('viewSetting').value=prefs.view_mode||'cards';
    updateThemeButtons();
  }
  function updateThemeButtons(){ document.querySelectorAll('[data-theme-choice]').forEach(b=>b.classList.toggle('active',b.dataset.themeChoice===prefs.theme)); }
  async function loadAll(){
    const [s,p,u]=await Promise.all([
      db.from('spools').select('*').order('created_at',{ascending:false}),
      db.from('printers').select('*').order('created_at',{ascending:false}),
      db.from('usage_logs').select('*,spools(name,material,color,color_hex),printers(name)').order('created_at',{ascending:false}).limit(200)
    ]);
    if(s.error) return alert(s.error.message); if(p.error) return alert(p.error.message);
    spools=s.data||[]; printers=p.data||[]; usage=u.data||[]; renderAll();
  }
  function renderAll(){ renderDashboard(); renderSpools(); renderPrinters(); renderHistory(); fillPrinterSpools(); }

  function renderDashboard(){
    const active=spools.filter(s=>!s.archived), warehouse=active.filter(s=>!mountedPrinter(s.id));
    const total=active.reduce((a,s)=>a+num(s.remaining_weight),0), cap=active.reduce((a,s)=>a+num(s.total_weight),0);
    const value=active.reduce((a,s)=>a+(s.purchase_price==null?0:num(s.purchase_price)*(num(s.remaining_weight)/Math.max(1,num(s.total_weight)))),0);
    const low=active.filter(s=>pct(s)<=prefs.low_stock_percent);
    const cutoff=Date.now()-30*86400000, month=usage.filter(x=>new Date(x.created_at).getTime()>=cutoff);
    $('kpiSpools').textContent=active.length; $('kpiWarehouse').textContent=`${warehouse.length} في المخزن · ${printers.filter(p=>p.loaded_spool_id).length} مركب`;
    $('kpiWeight').textContent=fmtG(total); $('kpiCapacity').textContent=`من ${fmtG(cap)}`;
    $('kpiValue').textContent=fmtMoney(value); $('kpiLow').textContent=low.length;
    $('kpiMonthUsed').textContent=fmtG(month.reduce((a,x)=>a+num(x.grams_used),0)); $('kpiMonthJobs').textContent=`${month.length} عمليات`;

    const groups={}; active.forEach(s=>{ const k=s.material||'Other'; groups[k]??={count:0,grams:0}; groups[k].count++;groups[k].grams+=num(s.remaining_weight); });
    $('materialSummary').textContent=`${Object.keys(groups).length} أنواع`;
    $('materialChips').innerHTML=Object.entries(groups).sort((a,b)=>b[1].grams-a[1].grams).map(([k,v])=>`<button class="mat-chip" data-material-jump="${esc(k)}"><b>${esc(k)}</b>${v.count} سبول · ${fmtG(v.grams)}</button>`).join('')||'<span class="muted">لا توجد بيانات</span>';

    $('alerts').innerHTML=low.sort((a,b)=>pct(a)-pct(b)).slice(0,7).map(s=>`<div class="alert-item"><div class="swatch" style="width:24px;height:24px;background:${validHex(s.color_hex)?s.color_hex:'#777'}"></div><div class="grow"><b class="ellipsis">${esc(s.name)}</b><div class="muted">${Math.round(pct(s))}% · ${fmtG(s.remaining_weight)}</div></div><button class="btn secondary small" data-open-spool="${s.id}">فتح</button></div>`).join('')||'<div class="muted">✓ ما عندك سبولات منخفضة.</div>';
    const recent=active.slice().sort((a,b)=>new Date(b.updated_at||b.created_at)-new Date(a.updated_at||a.created_at)).slice(0,6);
    $('recentSpools').innerHTML=recent.map(spoolCard).join('')||'<div class="muted">أضف أول سبول.</div>';
  }

  function spoolCard(s){
    const color=validHex(s.color_hex)?s.color_hex:'#808080', p=pct(s), mp=mountedPrinter(s.id), meters=remainingMeters(s);
    return `<article class="spool-card ${s.favorite?'favorite':''}" data-spool-card="${s.id}"><div class="spool-head"><div class="swatch" style="background:${color}"></div><div class="grow"><div class="spool-title ellipsis">${esc(s.name)}</div><div class="muted ellipsis" style="font-size:11px">${esc(s.brand||'بدون شركة')} · ${esc(s.material||'—')} · ${esc(s.color||'—')}</div><span class="tag">${esc(mp?`🖨 ${mp.name}`:(s.location_name||'Warehouse'))}</span>${s.archived?'<span class="tag">مؤرشف</span>':''}</div></div><div class="weight-row"><strong>${fmtG(s.remaining_weight)}</strong><span class="muted">${Math.round(p)}%</span></div><div class="bar"><i style="width:${p}%;background:${stockClass(s)}"></i></div><div class="detail-grid"><span>المستخدم <b>${fmtG(usedWeight(s))}</b></span><span>الطول <b>${meters.toFixed(meters<100?1:0)}m</b></span><span>Lot <b>${esc(s.lot_nr||'—')}</b></span><span>السعر <b>${s.purchase_price==null?'—':num(s.purchase_price).toFixed(0)+' AED'}</b></span></div><div class="actions"><button class="btn small" data-use-spool="${s.id}">استخدام</button><button class="btn secondary small" data-edit-spool="${s.id}">تعديل</button><button class="btn secondary small" data-duplicate-spool="${s.id}">تكرار</button><button class="btn secondary small" data-fav-spool="${s.id}">${s.favorite?'★':'☆'}</button></div></article>`;
  }

  function filteredSpools(){
    const q=norm($('spoolSearch').value||$('globalSearch').value), mat=$('materialFilter').value, loc=$('locationFilter').value, showArc=$('showArchived').checked;
    let rows=spools.filter(s=>(showArc||!s.archived)&&matches(s,q)&&(mat===''||s.material===mat)&&(loc===''||spoolLocation(s)===loc));
    const coll=new Intl.Collator(['ar','en'],{numeric:true,sensitivity:'base'}), mode=$('spoolSort').value;
    rows.sort((a,b)=>{switch(mode){case'remaining_desc':return num(b.remaining_weight)-num(a.remaining_weight);case'remaining_asc':return num(a.remaining_weight)-num(b.remaining_weight);case'name_asc':return coll.compare(a.name,b.name);case'name_desc':return coll.compare(b.name,a.name);case'material':return coll.compare(a.material||'',b.material||'')||coll.compare(a.name,b.name);case'brand':return coll.compare(a.brand||'',b.brand||'')||coll.compare(a.name,b.name);case'low':return pct(a)-pct(b);default:return new Date(b.updated_at||b.created_at)-new Date(a.updated_at||a.created_at)}});
    return rows;
  }
  function renderSpools(){
    const mats=[...new Set(spools.map(s=>s.material).filter(Boolean))].sort(); const locs=[...new Set(spools.map(spoolLocation).filter(Boolean))].sort();
    const mv=$('materialFilter').value, lv=$('locationFilter').value;
    $('materialFilter').innerHTML='<option value="">كل المواد</option>'+mats.map(x=>`<option>${esc(x)}</option>`).join(''); if(mats.includes(mv))$('materialFilter').value=mv;
    $('locationFilter').innerHTML='<option value="">كل المواقع</option>'+locs.map(x=>`<option>${esc(x)}</option>`).join(''); if(locs.includes(lv))$('locationFilter').value=lv;
    const rows=filteredSpools(); $('spoolEmpty').classList.toggle('hidden',rows.length>0);
    $('spoolCards').innerHTML=rows.map(spoolCard).join('');
    $('spoolTable').innerHTML=`<table><thead><tr><th>السبول</th><th>المادة</th><th>المتبقي</th><th>المستخدم</th><th>الطول</th><th>الموقع</th><th>Lot</th><th>السعر</th><th>آخر استخدام</th><th></th></tr></thead><tbody>${rows.map(s=>`<tr><td><b>${esc(s.name)}</b><div class="muted">${esc(s.brand||'')}</div></td><td>${esc(s.material||'—')}</td><td>${fmtG(s.remaining_weight)} · ${Math.round(pct(s))}%</td><td>${fmtG(usedWeight(s))}</td><td>${remainingMeters(s).toFixed(0)}m</td><td>${esc(spoolLocation(s))}</td><td>${esc(s.lot_nr||'—')}</td><td>${fmtMoney(s.purchase_price)}</td><td>${dateText(s.last_used)}</td><td><button class="btn secondary small" data-edit-spool="${s.id}">تعديل</button></td></tr>`).join('')}</tbody></table>`;
    setSpoolView(prefs.view_mode||'cards');
  }
  function setSpoolView(mode){ prefs.view_mode=mode; $('spoolCards').classList.toggle('hidden',mode!=='cards'); $('spoolTable').classList.toggle('hidden',mode!=='table'); $('cardsView').classList.toggle('active',mode==='cards'); $('tableView').classList.toggle('active',mode==='table'); $('viewSetting').value=mode; }

  function renderPrinters(){
    $('printerGrid').innerHTML=printers.map(p=>{ const s=spools.find(x=>x.id===p.loaded_spool_id), col=s&&validHex(s.color_hex)?s.color_hex:'#777'; return `<article class="printer"><div class="section-title"><h2><span class="printer-status" style="background:${p.status==='offline'?'var(--danger)':p.status==='maintenance'?'var(--warn)':p.status==='printing'?'var(--accent)':'var(--accent2)'}"></span>${esc(p.name)}</h2><span class="tag">${esc(p.status||'idle')}</span></div><div class="muted">${esc(p.model||'بدون موديل')}${p.location_name?' · '+esc(p.location_name):''}</div>${s?`<div class="mounted"><div class="swatch" style="background:${col}"></div><div class="grow"><b>${esc(s.name)}</b><div class="muted">${esc(s.material||'')} · ${fmtG(s.remaining_weight)} · ${Math.round(pct(s))}%</div></div></div><div class="bar"><i style="width:${pct(s)}%;background:${stockClass(s)}"></i></div>`:'<div class="mounted"><div class="grow"><b>بدون سبول</b><div class="muted">اختر فلمنت لهذه الطابعة</div></div></div>'}<div class="actions"><button class="btn small" data-printer-use="${p.id}" ${s?'':'disabled'}>تسجيل طبعة</button><button class="btn secondary small" data-edit-printer="${p.id}">تعديل</button><button class="btn danger small" data-delete-printer="${p.id}">حذف</button></div></article>`; }).join('');
    $('printerEmpty').classList.toggle('hidden',printers.length>0);
  }

  function renderHistory(){
    const total=usage.reduce((a,x)=>a+num(x.grams_used),0), last30=usage.filter(x=>Date.now()-new Date(x.created_at).getTime()<30*86400000), top={}; usage.forEach(x=>{const k=x.spools?.material||'Unknown';top[k]=(top[k]||0)+num(x.grams_used)}); const topMat=Object.entries(top).sort((a,b)=>b[1]-a[1])[0];
    $('historyStats').innerHTML=`<div class="kpi"><span>إجمالي مسجل</span><strong>${fmtG(total)}</strong></div><div class="kpi"><span>آخر 30 يوم</span><strong>${fmtG(last30.reduce((a,x)=>a+num(x.grams_used),0))}</strong></div><div class="kpi"><span>الأكثر استخدامًا</span><strong>${esc(topMat?.[0]||'—')}</strong><small>${topMat?fmtG(topMat[1]):''}</small></div>`;
    $('historyList').innerHTML=usage.map(x=>`<div class="history-item"><div class="swatch" style="width:25px;height:25px;background:${validHex(x.spools?.color_hex)?x.spools.color_hex:'#777'}"></div><div class="grow"><b>${esc(x.spools?.name||'سبول محذوف')}</b><div class="muted">${fmtG(x.grams_used)} · ${esc(x.spools?.material||'')} ${x.printers?.name?'· '+esc(x.printers.name):''}${x.note?' · '+esc(x.note):''}</div></div><div class="muted">${timeText(x.created_at)}</div></div>`).join('');
    $('historyEmpty').classList.toggle('hidden',usage.length>0);
  }

  function page(name){
    activePage=name; document.querySelectorAll('.page').forEach(x=>x.classList.add('hidden')); $(`${name}Page`).classList.remove('hidden');
    document.querySelectorAll('.nav button').forEach(x=>x.classList.toggle('active',x.dataset.page===name));
    const titles={dashboard:'لوحة التحكم',spools:'السبولات',printers:'الطابعات',history:'سجل الاستخدام',settings:'الإعدادات'}; $('pageTitle').textContent=titles[name];
    $('quickAdd').classList.toggle('hidden',name==='settings'||name==='history'); if(name==='spools')renderSpools(); if(name==='history')renderHistory();
  }

  function openSpool(id=null){
    $('spoolForm').reset(); $('spoolId').value=''; $('spoolModalTitle').textContent=id?'تعديل السبول':'إضافة سبول'; status('spoolFormStatus','');
    $('totalWeight').value=1000;$('remainingWeight').value=1000;$('emptySpoolWeight').value=0;$('diameter').value=1.75;$('density').value=1.24;$('colorHex').value='#808080';$('colorHexText').value='#808080';
    if(id){const s=spools.find(x=>x.id===id);if(!s)return;$('spoolId').value=s.id;$('name').value=s.name||'';$('brand').value=s.brand||'';$('material').value=s.material||'';$('color').value=s.color||'';$('colorHex').value=validHex(s.color_hex)?s.color_hex:'#808080';$('colorHexText').value=$('colorHex').value;$('multiColor').value=s.multi_color_hexes||'';$('totalWeight').value=s.total_weight;$('remainingWeight').value=s.remaining_weight;$('emptySpoolWeight').value=s.empty_spool_weight||0;$('diameter').value=s.diameter||1.75;$('density').value=s.density||1.24;$('price').value=s.purchase_price??'';$('locationName').value=s.location_name||'';$('lotNr').value=s.lot_nr||'';$('articleNumber').value=s.article_number||'';$('purchaseDate').value=s.purchase_date||'';$('nozzleMin').value=s.nozzle_min??'';$('nozzleMax').value=s.nozzle_max??'';$('bedMin').value=s.bed_min??'';$('bedMax').value=s.bed_max??'';$('notes').value=s.notes||'';$('favorite').checked=!!s.favorite;$('archived').checked=!!s.archived;}
    $('spoolModal').classList.add('show');
  }
  async function saveSpool(e){
    e.preventDefault(); const id=$('spoolId').value||null, name=$('name').value.trim(); if(!name)return;
    const conflict=spools.find(s=>s.id!==id&&norm(s.name)===norm(name)); if(conflict){const suggest=suggestion(name,id);$('name').value=suggest;return status('spoolFormStatus',`الاسم موجود. اقترحت لك: ${suggest}`,true)}
    const total=Math.max(1,num($('totalWeight').value)), remaining=Math.max(0,Math.min(total,num($('remainingWeight').value))); const hx=validHex($('colorHexText').value)?$('colorHexText').value:$('colorHex').value;
    const payload={name,brand:$('brand').value.trim(),material:$('material').value.trim(),color:$('color').value.trim(),color_hex:hx,multi_color_hexes:$('multiColor').value.trim()||null,total_weight:total,remaining_weight:remaining,empty_spool_weight:num($('emptySpoolWeight').value),diameter:num($('diameter').value)||1.75,density:num($('density').value)||1.24,purchase_price:$('price').value===''?null:num($('price').value),purchase_date:$('purchaseDate').value||null,location_name:$('locationName').value.trim()||'Warehouse',lot_nr:$('lotNr').value.trim()||null,article_number:$('articleNumber').value.trim()||null,nozzle_min:$('nozzleMin').value===''?null:Math.round(num($('nozzleMin').value)),nozzle_max:$('nozzleMax').value===''?null:Math.round(num($('nozzleMax').value)),bed_min:$('bedMin').value===''?null:Math.round(num($('bedMin').value)),bed_max:$('bedMax').value===''?null:Math.round(num($('bedMax').value)),notes:$('notes').value.trim(),favorite:$('favorite').checked,archived:$('archived').checked};
    const r=id?await db.from('spools').update(payload).eq('id',id):await db.from('spools').insert(payload); if(r.error)return status('spoolFormStatus',r.error.message,true); $('spoolModal').classList.remove('show');await loadAll();
  }

  function openUse(spoolId,printerId=null){
    const s=spools.find(x=>x.id===spoolId);if(!s)return;activeUseId=spoolId;$('useTitle').textContent=`تسجيل استخدام — ${s.name}`;$('useMeta').textContent=`الموجود الآن ${fmtG(s.remaining_weight)} · ${remainingMeters(s).toFixed(0)}m تقريبًا`;$('usedWeight').value='';$('usedWeight').dataset.printerId=printerId||'';$('useNote').value='';status('useStatus','');updateUsePreview();$('useModal').classList.add('show');
  }
  function updateUsePreview(){const s=spools.find(x=>x.id===activeUseId);if(!s)return;const use=Math.max(0,num($('usedWeight').value)),after=Math.max(0,num(s.remaining_weight)-use);$('usePreview').innerHTML=`<div class="weight-row"><span>الآن <b>${fmtG(s.remaining_weight)}</b></span><span>بعد الخصم <b>${fmtG(after)}</b></span></div><div class="bar"><i style="width:${Math.max(0,Math.min(100,after/Math.max(1,num(s.total_weight))*100))}%"></i></div>`;}
  async function applyUse(){
    const s=spools.find(x=>x.id===activeUseId), requested=num($('usedWeight').value);if(!s||requested<=0)return status('useStatus','اكتب جرامات صحيحة.',true);
    const actual=Math.min(requested,num(s.remaining_weight)), after=Math.max(0,num(s.remaining_weight)-actual), now=new Date().toISOString();
    const patch={remaining_weight:after,last_used:now}; if(!s.first_used)patch.first_used=now;
    const r=await db.from('spools').update(patch).eq('id',s.id);if(r.error)return status('useStatus',r.error.message,true);
    const log=await db.from('usage_logs').insert({spool_id:s.id,grams_used:actual,printer_id:$('usedWeight').dataset.printerId||null,source:$('usedWeight').dataset.printerId?'printer':'manual',note:$('useNote').value.trim()||null});if(log.error)return status('useStatus',log.error.message,true);
    $('useModal').classList.remove('show');await loadAll();
  }

  function fillPrinterSpools(selected=''){ const options=spools.filter(s=>!s.archived).sort((a,b)=>a.name.localeCompare(b.name)).map(s=>`<option value="${s.id}">${esc(s.name)} — ${esc(s.material||'')} — ${fmtG(s.remaining_weight)}${mountedPrinter(s.id)&&mountedPrinter(s.id).id!==$('printerId').value?' — مستخدم':''}</option>`).join('');$('printerSpool').innerHTML='<option value="">بدون سبول</option>'+options;$('printerSpool').value=selected||''; }
  function openPrinter(id=null){$('printerForm').reset();$('printerId').value='';$('printerModalTitle').textContent=id?'تعديل الطابعة':'إضافة طابعة';let selected='';if(id){const p=printers.find(x=>x.id===id);if(!p)return;$('printerId').value=p.id;$('printerName').value=p.name||'';$('printerModel').value=p.model||'';$('printerStatus').value=p.status||'idle';$('printerLocation').value=p.location_name||'';$('printerNotes').value=p.notes||'';selected=p.loaded_spool_id||'';}fillPrinterSpools(selected);$('printerModal').classList.add('show');}
  async function savePrinter(e){
    e.preventDefault();const id=$('printerId').value||null, old=id?printers.find(p=>p.id===id):null, next=$('printerSpool').value||null;
    const usedBy=next?printers.find(p=>p.loaded_spool_id===next&&p.id!==id):null;if(usedBy)return alert(`هذا السبول مركب على ${usedBy.name}.`);
    const payload={name:$('printerName').value.trim(),model:$('printerModel').value.trim(),status:$('printerStatus').value,location_name:$('printerLocation').value.trim()||null,notes:$('printerNotes').value.trim(),loaded_spool_id:next};
    const r=id?await db.from('printers').update(payload).eq('id',id):await db.from('printers').insert(payload);if(r.error)return alert(r.error.message);
    if(old?.loaded_spool_id&&old.loaded_spool_id!==next)await db.from('spools').update({location:'warehouse'}).eq('id',old.loaded_spool_id);
    if(next)await db.from('spools').update({location:'printer'}).eq('id',next);
    $('printerModal').classList.remove('show');await loadAll();
  }

  async function smart(raw){
    const text=norm(raw);if(!text)return;addBubble(raw,true);$('assistantInput').value='';
    const active=spools.filter(s=>!s.archived); const gramsMatch=text.match(/(\d+(?:\.\d+)?)\s*(?:g|جرام|جرامات)?/); const need=gramsMatch?num(gramsMatch[1]):null; const mats=['PLA','PETG','ASA','ABS','TPU','PA','PC','PPS']; const mat=mats.find(m=>text.includes(m.toLowerCase()));
    if((text.includes('يكفي')||text.includes('طبعة')||text.includes('اطبع'))&&need){let cand=active.filter(s=>num(s.remaining_weight)>=need&&(!mat||norm(s.material)===mat.toLowerCase())).sort((a,b)=>num(a.remaining_weight)-num(b.remaining_weight));if(cand.length){const s=cand[0];return addBubble(`أفضل اختيار: ${s.name} (${s.material}) عنده ${fmtG(s.remaining_weight)}. بعد طبعة ${fmtG(need)} بيبقى تقريبًا ${fmtG(num(s.remaining_weight)-need)}. اخترته لأنه أقل سبول يكفيك حتى ما تفتح سبول أكبر بدون داعي.`)}return addBubble(`ما لقيت ${mat||'سبول'} فيه ${fmtG(need)} أو أكثر. أكبر المتوفر ${fmtG(Math.max(0,...active.filter(s=>!mat||norm(s.material)===mat.toLowerCase()).map(s=>num(s.remaining_weight))))}.`)}
    if(text.includes('قيمة')||text.includes('كم يسوى')||text.includes('كم سعر مخزون')){const v=active.reduce((a,s)=>a+(s.purchase_price==null?0:num(s.purchase_price)*num(s.remaining_weight)/Math.max(1,num(s.total_weight))),0);return addBubble(`القيمة التقريبية للفلمنت المتبقي حسب الأسعار المسجلة: ${fmtMoney(v)}.`)}
    if(text.includes('قريب')&&text.includes('نفاد')||text.includes('يخلص')){const low=[...active].sort((a,b)=>pct(a)-pct(b)).slice(0,5);return addBubble(low.map((s,i)=>`${i+1}. ${s.name}: ${fmtG(s.remaining_weight)} (${Math.round(pct(s))}%)`).join('\n')||'ما عندك سبولات.');}
    if(text.includes('طابعة')||text.includes('الطابعات')){return addBubble(printers.map(p=>{const s=spools.find(x=>x.id===p.loaded_spool_id);return `${p.name}: ${s?`${s.name} / ${s.material} / ${fmtG(s.remaining_weight)}`:'بدون سبول'}`}).join('\n')||'ما عندك طابعات مسجلة.');}
    if(text.includes('كم')&&mat){const a=active.filter(s=>norm(s.material)===mat.toLowerCase());return addBubble(`عندك ${a.length} سبول ${mat} بإجمالي ${fmtG(a.reduce((x,s)=>x+num(s.remaining_weight),0))}.`)}
    if(text.includes('كم سبول')||text.includes('عدد السبول'))return addBubble(`عندك ${active.length} سبول فعال، منها ${active.filter(s=>mountedPrinter(s.id)).length} مركب على الطابعات.`);
    if(text.includes('كم جرام')||text.includes('اجمالي')||text.includes('إجمالي'))return addBubble(`إجمالي الفلمنت المتبقي ${fmtG(active.reduce((a,s)=>a+num(s.remaining_weight),0))}.`);
    if(text.includes('رتب')||text.includes('الأقل')||text.includes('الاكثر')||text.includes('الأكثر')){page('spools');if(text.includes('الأقل'))$('spoolSort').value='remaining_asc';else if(text.includes('الأكثر'))$('spoolSort').value='remaining_desc';else if(text.includes('اسم'))$('spoolSort').value='name_asc';else $('spoolSort').value='low';renderSpools();return addBubble('تم، نقلتك للسبولات وطبقت الترتيب المناسب.');}
    if(mat&&(text.includes('ورني')||text.includes('اعرض')||text.includes('عرض'))){page('spools');$('materialFilter').value=mat;renderSpools();return addBubble(`تم، أعرض لك ${mat} فقط.`)}
    addBubble('أقدر أساعدك في المخزون: اسأل عن سبول مناسب لطبعة بجرامات معينة، قيمة المخزون، المواد، الطابعات، الأقرب للنفاد، أو اطلب ترتيب السبولات.');
  }
  function addBubble(text,me=false){const d=document.createElement('div');d.className='bubble'+(me?' me':'');d.textContent=text;$('assistantLog').appendChild(d);$('assistantLog').scrollTop=$('assistantLog').scrollHeight;}

  async function savePrefs(){prefs.theme=document.documentElement.dataset.theme||'midnight';prefs.low_stock_percent=Math.max(1,Math.min(90,num($('lowStockSetting').value)||20));prefs.view_mode=$('viewSetting').value;const r=await db.from('user_preferences').upsert({user_id:user.id,theme:prefs.theme,view_mode:prefs.view_mode,low_stock_percent:prefs.low_stock_percent,density:'comfortable',updated_at:new Date().toISOString()});if(r.error)return alert(r.error.message);renderAll();alert('تم حفظ الإعدادات.');}

  // auth
  $('loginBtn').onclick=async()=>{const email=$('email').value.trim(),password=$('password').value;if(!email||!password)return status('authStatus','اكتب البريد وكلمة المرور.',true);status('authStatus','جاري الدخول...');const {error}=await db.auth.signInWithPassword({email,password});if(error)return status('authStatus',error.message,true)};
  $('signupBtn').onclick=async()=>{const email=$('email').value.trim(),password=$('password').value;if(!email||password.length<6)return status('authStatus','اكتب بريد صحيح وكلمة مرور 6 أحرف على الأقل.',true);const {data,error}=await db.auth.signUp({email,password,options:{emailRedirectTo:'https://filaments-cloud.vercel.app/'}});if(error)return status('authStatus',error.message,true);status('authStatus',data.session?'تم إنشاء الحساب.':'تم. افتح رسالة التأكيد في بريدك.');};
  $('logoutBtn').onclick=()=>db.auth.signOut();
  db.auth.onAuthStateChange(async(_,session)=>{user=session?.user||null;showAuth(!!user);if(user){$('userEmail').textContent=user.email||'';await loadPrefs();await loadAll();}});

  // navigation
  document.querySelectorAll('.nav button').forEach(b=>b.onclick=()=>page(b.dataset.page)); document.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>page(b.dataset.go));
  $('quickAdd').onclick=()=>activePage==='printers'?openPrinter():openSpool(); $('addSpoolBtn').onclick=()=>openSpool(); $('addPrinterBtn').onclick=()=>openPrinter();
  $('globalSearch').oninput=()=>{if(activePage==='spools')renderSpools();}; $('spoolSearch').oninput=renderSpools; $('materialFilter').onchange=renderSpools; $('locationFilter').onchange=renderSpools; $('spoolSort').onchange=renderSpools; $('showArchived').onchange=renderSpools;
  $('cardsView').onclick=()=>setSpoolView('cards'); $('tableView').onclick=()=>setSpoolView('table');
  $('colorHex').oninput=()=>{$('colorHexText').value=$('colorHex').value.toUpperCase()}; $('colorHexText').oninput=()=>{if(validHex($('colorHexText').value))$('colorHex').value=$('colorHexText').value};
  $('spoolForm').onsubmit=saveSpool; $('cancelSpool').onclick=()=>$('spoolModal').classList.remove('show');
  $('usedWeight').oninput=updateUsePreview; $('cancelUse').onclick=()=>$('useModal').classList.remove('show'); $('applyUse').onclick=applyUse;
  $('printerForm').onsubmit=savePrinter; $('cancelPrinter').onclick=()=>$('printerModal').classList.remove('show'); $('refreshHistory').onclick=loadAll;
  $('assistantSend').onclick=()=>smart($('assistantInput').value); $('assistantInput').onkeydown=e=>{if(e.key==='Enter')smart($('assistantInput').value)};
  document.querySelectorAll('[data-theme-choice]').forEach(b=>b.onclick=()=>{prefs.theme=b.dataset.themeChoice;document.documentElement.dataset.theme=prefs.theme;updateThemeButtons()}); $('saveSettings').onclick=savePrefs;

  document.addEventListener('click',async e=>{
    const el=e.target.closest('button,[data-material-jump]');if(!el)return;const id=el.dataset.openSpool||el.dataset.editSpool;if(id)return openSpool(id);
    if(el.dataset.materialJump){page('spools');$('materialFilter').value=el.dataset.materialJump;return renderSpools()}
    if(el.dataset.useSpool)return openUse(el.dataset.useSpool);
    if(el.dataset.duplicateSpool){const s=spools.find(x=>x.id===el.dataset.duplicateSpool);if(!s)return;const clone={...s};['id','user_id','created_at','updated_at','first_used','last_used'].forEach(k=>delete clone[k]);clone.name=suggestion(s.name);clone.remaining_weight=clone.total_weight;clone.location='warehouse';clone.location_name=s.location_name||'Warehouse';clone.archived=false;const {error}=await db.from('spools').insert(clone);if(error)alert(error.message);else await loadAll();return}
    if(el.dataset.favSpool){const s=spools.find(x=>x.id===el.dataset.favSpool);await db.from('spools').update({favorite:!s.favorite}).eq('id',s.id);return loadAll()}
    if(el.dataset.editPrinter)return openPrinter(el.dataset.editPrinter);
    if(el.dataset.printerUse){const p=printers.find(x=>x.id===el.dataset.printerUse);if(p?.loaded_spool_id)return openUse(p.loaded_spool_id,p.id)}
    if(el.dataset.deletePrinter){const p=printers.find(x=>x.id===el.dataset.deletePrinter);if(!confirm(`حذف ${p?.name||'الطابعة'}؟`))return;if(p?.loaded_spool_id)await db.from('spools').update({location:'warehouse'}).eq('id',p.loaded_spool_id);const {error}=await db.from('printers').delete().eq('id',el.dataset.deletePrinter);if(error)alert(error.message);else loadAll()}
  });

  document.querySelectorAll('.modal').forEach(m=>m.addEventListener('click',e=>{if(e.target===m)m.classList.remove('show')}));
  db.auth.getSession().then(async({data:{session}})=>{user=session?.user||null;showAuth(!!user);if(user){$('userEmail').textContent=user.email||'';await loadPrefs();await loadAll();}});
})();