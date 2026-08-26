(() => {
  const cfg = window.APP_CONFIG || {};
  if (!window.supabase || !cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) return;
  const db = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm = s => String(s||'').trim().toLowerCase();
  const num = v => Number(v)||0;
  const validHex = v => /^#[0-9a-f]{6}$/i.test(String(v||''));
  const THEME_KEYS = ['bg','side','panel','card','card2','line','text','muted','accent','accent2','danger','warn'];
  const THEME_DEFAULTS = {bg:'#080d18',side:'#0c1322',panel:'#111a2b',card:'#162236',card2:'#0d1626',line:'#26354d',text:'#eef4ff',muted:'#91a2bb',accent:'#60a5fa',accent2:'#22c55e',danger:'#f87171',warn:'#fbbf24'};
  let prefs = {language:'ar',theme:'midnight',custom_theme:{}};
  let colorRows = [];

  const EN = new Map(Object.entries({
    'لوحة التحكم':'Dashboard','السبولات':'Spools','الطابعات':'Printers','سجل الاستخدام':'Usage Log','الإعدادات':'Settings',
    'إجمالي السبولات':'Total Spools','إجمالي المتبقي':'Total Remaining','الفلمنت المتبقي':'Filament Remaining','الطابعات النشطة':'Active Printers','قريب من النفاد':'Low Stock','قيمة المخزون':'Inventory Value','استهلاك 30 يوم':'30-Day Usage',
    'توزيع المخزون حسب المادة':'Inventory by Material','تنبيهات المخزون':'Stock Alerts','المخزن والمواقع':'Storage & Locations','آخر السبولات':'Recent Spools','آخر النشاطات':'Recent Activity','نظرة سريعة':'Quick Overview','المواد':'Materials',
    'قاعدة بيانات السبولات — تفاصيل كاملة':'Spool Database — Full Details','إدارة السبولات':'Manage Spools','عرض الكل':'View All','المظهر':'Appearance','حفظ الإعدادات':'Save Settings',
    'إضافة سبول':'Add Spool','+ إضافة سبول':'+ Add Spool','+ سبول':'+ Spool','إضافة طابعة':'Add Printer','+ إضافة طابعة':'+ Add Printer','تعديل':'Edit','استخدام':'Use','تكرار':'Duplicate','حذف':'Delete','إلغاء':'Cancel','حفظ':'Save','إرسال':'Send','فتح':'Open',
    'كل المواد':'All Materials','كل المواقع':'All Locations','الأحدث':'Newest','الجرامات: الأكثر':'Grams: High to Low','الجرامات: الأقل':'Grams: Low to High','الاسم: أ → ي':'Name: A → Z','الاسم: ي → أ':'Name: Z → A','حسب المادة':'By Material','حسب الشركة':'By Brand','الأقرب للنفاد':'Lowest Stock First','المؤرشف':'Archived',
    'اسم السبول':'Spool Name','الشركة':'Brand','المادة':'Material','اسم اللون':'Color Name','اللون':'Color','ألوان متعددة':'Multiple Colors','وزن الفلمنت الأصلي (g)':'Original Filament Weight (g)','المتبقي الآن (g)':'Remaining Now (g)','وزن السبول الفاضي (g)':'Empty Spool Weight (g)','قطر الفلمنت (mm)':'Filament Diameter (mm)','الكثافة (g/cm³)':'Density (g/cm³)','السعر':'Price','الموقع':'Location','رقم الدفعة / Lot':'Lot Number','رقم المنتج / SKU':'Product / SKU','تاريخ الشراء':'Purchase Date','حرارة النوزل من':'Nozzle Temp From','إلى':'To','حرارة البيد من':'Bed Temp From','ملاحظات':'Notes','مفضلة ★':'Favorite ★','مؤرشف':'Archived',
    'جاهزة':'Idle','تطبع':'Printing','غير متصلة':'Offline','صيانة':'Maintenance','السبول المركب':'Loaded Spool','بدون سبول':'No Spool','اسم الطابعة':'Printer Name','الموديل':'Model','الحالة':'Status',
    'سجل استهلاك الفلمنت':'Filament Usage Log','تحديث':'Refresh','إجمالي مسجل':'Total Logged','آخر 30 يوم':'Last 30 Days','الأكثر استخدامًا':'Most Used',
    'اختر تقرير جاهز، أو اكتب سؤالك عن المخزون والطابعات.':'Choose a report or ask about inventory and printers.','ملخص المخزون':'Inventory Summary','حالة الطابعات':'Printer Status','اقتراحات':'Suggestions',
    'الثيمات الجاهزة':'Preset Themes','تخصيص الثيم':'Custom Theme','اللغة':'Language','العربية':'Arabic','الإنجليزية':'English','نسخة احتياطية للبيانات':'Database Backup','تصدير قاعدة البيانات':'Export Database','تحميل نسخة JSON':'Download JSON Backup','تطبيق مباشر':'Live Preview','حفظ الثيم المخصص':'Save Custom Theme','إرجاع الألوان الافتراضية':'Reset Colors',
    'الخلفية':'Background','الشريط الجانبي':'Sidebar','اللوحات':'Panels','البطاقات':'Cards','البطاقات الثانوية':'Secondary Cards','الحدود':'Borders','النص':'Text','النص الثانوي':'Muted Text','اللون الرئيسي':'Primary Accent','اللون الثانوي':'Secondary Accent','الخطر':'Danger','التحذير':'Warning',
    'بحث حسب اللون':'Search by color','كل الألوان':'All Colors','الألوان':'Colors','ملخص الألوان':'Color Summary'
  }));

  function style(){
    if ($('experiencePlusStyle')) return;
    const s=document.createElement('style'); s.id='experiencePlusStyle';
    s.textContent=`
      .xp-panel{margin-top:14px}.xp-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.xp-theme-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px}.xp-color-field{background:var(--card2);border:1px solid var(--line);border-radius:12px;padding:9px}.xp-color-field label{display:flex;align-items:center;gap:8px}.xp-color-field input[type=color]{width:44px;height:38px;min-height:38px;padding:3px;flex:none}.xp-color-field code{font-size:10px;color:var(--muted)}
      .xp-lang{display:flex;gap:8px}.xp-lang button.active{outline:2px solid var(--accent);outline-offset:1px}.xp-backup{background:linear-gradient(145deg,color-mix(in srgb,var(--accent) 8%,var(--panel)),var(--panel))}.xp-color-search{min-width:155px;max-width:210px}.xp-swatch{display:inline-block;width:12px;height:12px;border-radius:50%;border:1px solid #fff6;margin-inline-end:5px;vertical-align:-1px}
      @media(max-width:760px){.xp-grid,.xp-theme-grid{grid-template-columns:1fr 1fr}.xp-color-search{max-width:none;flex:1}}
    `; document.head.appendChild(s);
  }

  async function loadPrefs(){
    const {data}=await db.from('user_preferences').select('*').maybeSingle();
    if(data) prefs={...prefs,...data};
    prefs.language = prefs.language || 'ar'; prefs.custom_theme = prefs.custom_theme || {};
    applyLanguage(prefs.language);
    if(prefs.theme==='custom') applyCustomTheme(prefs.custom_theme);
  }

  function applyCustomTheme(theme){
    document.documentElement.dataset.theme='custom';
    THEME_KEYS.forEach(k=>{const v=theme?.[k];if(validHex(v))document.documentElement.style.setProperty(`--${k}`,v)});
  }
  function clearInlineTheme(){ THEME_KEYS.forEach(k=>document.documentElement.style.removeProperty(`--${k}`)); }

  async function saveLanguage(lang){
    const {data:{session}}=await db.auth.getSession(); if(!session?.user)return;
    prefs.language=lang;
    await db.from('user_preferences').upsert({user_id:session.user.id,language:lang,updated_at:new Date().toISOString()},{onConflict:'user_id'});
    location.reload();
  }

  function translateText(text){
    const t=String(text||''); const trimmed=t.trim(); if(!trimmed)return t;
    if(EN.has(trimmed)) return t.replace(trimmed,EN.get(trimmed));
    let out=trimmed;
    const reps=[
      [/^(\d+) في المخزن(?: · (\d+) مركب)?$/,(_,a,b)=>`${a} in warehouse${b?` · ${b} loaded`:''}`],
      [/^من (.+)$/,(_,a)=>`of ${a}`],[/^(\d+) عمليات$/,(_,a)=>`${a} operations`],[/^(\d+) مواد$/,(_,a)=>`${a} materials`],[/^(\d+) أنواع$/,(_,a)=>`${a} types`],
      [/^(.+) سبول فعال$/,(_,a)=>`${a} active spools`],[/^(\d+) سبول$/,(_,a)=>`${a} spools`],[/باقي (\d+)س (\d+)د/g,(_,h,m)=>`${h}h ${m}m left`],
      [/في المخزن/g,'in warehouse'],[/مركب/g,'loaded'],[/بدون شركة/g,'No brand'],[/لا توجد بيانات/g,'No data'],[/لا توجد طابعات/g,'No printers'],[/المستخدم/g,'Used'],[/الطول/g,'Length']
    ];
    for(const [r,v] of reps) out=out.replace(r,v);
    return t.replace(trimmed,out);
  }

  function translateElement(root=document.body){
    if(prefs.language!=='en') return;
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT); const nodes=[]; while(walker.nextNode())nodes.push(walker.currentNode);
    nodes.forEach(n=>{if(n.parentElement?.closest('script,style'))return;const v=translateText(n.nodeValue);if(v!==n.nodeValue)n.nodeValue=v});
    root.querySelectorAll?.('input[placeholder],textarea[placeholder]').forEach(el=>{
      const p=el.getAttribute('placeholder'); const dict={
        'ابحث بالاسم، الشركة، المادة، اللون، الموقع، رقم الدفعة...':'Search name, brand, material, color, location, lot…','بحث داخل السبولات':'Search spools','اكتب طلبك...':'Type your request…','اكتب سؤالك عن المخزون والطابعات.':'Ask about inventory and printers.'
      }; if(dict[p])el.setAttribute('placeholder',dict[p]);
    });
  }
  function applyLanguage(lang){
    document.documentElement.lang=lang; document.documentElement.dir=lang==='en'?'ltr':'rtl';
    document.body.dir=document.documentElement.dir;
    if(lang==='en')translateElement(document.body);
    document.querySelectorAll('[data-xp-lang]').forEach(b=>b.classList.toggle('active',b.dataset.xpLang===lang));
  }

  async function refreshColors(){
    const {data}=await db.from('spools').select('color,color_hex,multi_color_hexes').eq('archived',false);
    const map=new Map(); (data||[]).forEach(s=>{
      const name=String(s.color||'').trim(); const hex=validHex(s.color_hex)?s.color_hex.toUpperCase():'';
      const key=norm(name)||hex.toLowerCase(); if(!key)return;
      if(!map.has(key))map.set(key,{name:name||hex,hex,count:0}); map.get(key).count++;
    });
    colorRows=[...map.values()].sort((a,b)=>a.name.localeCompare(b.name,undefined,{numeric:true,sensitivity:'base'}));
    fillColorSearch();
  }

  function injectColorSearch(){
    const toolbar=$('spoolSearch')?.closest('.toolbar'); if(!toolbar||$('colorSearch'))return;
    const sel=document.createElement('select'); sel.id='colorSearch';sel.className='xp-color-search';sel.title='بحث حسب اللون';
    sel.addEventListener('change',()=>{
      const target=$('spoolSearch'); if(!target)return;
      target.value=sel.value; target.dispatchEvent(new Event('input',{bubbles:true}));
    });
    const loc=$('locationFilter'); toolbar.insertBefore(sel,loc||null); fillColorSearch();
  }
  function fillColorSearch(){
    const sel=$('colorSearch'); if(!sel)return; const current=sel.value;
    sel.innerHTML=`<option value="">${prefs.language==='en'?'All Colors':'كل الألوان'}</option>`+colorRows.map(c=>`<option value="${esc(c.name)}">${esc(c.name)}${c.hex?` · ${c.hex}`:''} (${c.count})</option>`).join('');
    if([...sel.options].some(o=>o.value===current))sel.value=current;
  }

  function injectSettings(){
    const page=$('settingsPage'); if(!page||$('experienceSettings'))return;
    const wrap=document.createElement('div');wrap.id='experienceSettings';
    wrap.innerHTML=`
      <div class="panel xp-panel">
        <div class="section-title"><h2 data-xp-i18n>اللغة</h2></div>
        <div class="xp-lang"><button type="button" class="btn secondary" data-xp-lang="ar">العربية</button><button type="button" class="btn secondary" data-xp-lang="en">English</button></div>
      </div>
      <div class="panel xp-panel">
        <div class="section-title"><h2>🎨 <span data-xp-i18n>تخصيص الثيم</span></h2><span class="muted">Pro</span></div>
        <p class="muted">${prefs.language==='en'?'Keep the preset themes above, or build your own palette. Changes preview instantly.':'الثيمات الجاهزة فوق تظل موجودة، أو صمّم ثيمك بنفسك. التغييرات تظهر مباشرة.'}</p>
        <div id="xpThemeFields" class="xp-theme-grid"></div>
        <div class="actions" style="margin-top:12px"><button id="xpSaveTheme" type="button" class="btn">${prefs.language==='en'?'Save Custom Theme':'حفظ الثيم المخصص'}</button><button id="xpResetTheme" type="button" class="btn secondary">${prefs.language==='en'?'Reset Colors':'إرجاع الألوان الافتراضية'}</button></div>
        <div id="xpThemeStatus" class="status"></div>
      </div>
      <div class="panel xp-panel xp-backup">
        <div class="section-title"><h2>💾 ${prefs.language==='en'?'Database Backup':'نسخة احتياطية للبيانات'}</h2><span class="muted">JSON</span></div>
        <p class="muted">${prefs.language==='en'?'Exports your spools, printers, usage history and preferences with export date/time. Sensitive push-subscription keys are excluded.':'يصدر السبولات والطابعات وسجل الاستخدام وإعداداتك مع تاريخ ووقت التصدير. مفاتيح إشعارات الهاتف الحساسة غير مشمولة.'}</p>
        <div class="actions"><button id="xpExportDb" type="button" class="btn">${prefs.language==='en'?'Export Database':'تصدير قاعدة البيانات'}</button></div>
        <div id="xpExportStatus" class="status"></div>
      </div>`;
    page.appendChild(wrap);
    buildThemeFields();
    wrap.querySelectorAll('[data-xp-lang]').forEach(b=>b.addEventListener('click',()=>saveLanguage(b.dataset.xpLang)));
    $('xpSaveTheme').addEventListener('click',saveCustomTheme); $('xpResetTheme').addEventListener('click',resetCustomTheme); $('xpExportDb').addEventListener('click',exportDatabase);
    applyLanguage(prefs.language);
  }

  function themeLabel(k){const ar={bg:'الخلفية',side:'الشريط الجانبي',panel:'اللوحات',card:'البطاقات',card2:'البطاقات الثانوية',line:'الحدود',text:'النص',muted:'النص الثانوي',accent:'اللون الرئيسي',accent2:'اللون الثانوي',danger:'الخطر',warn:'التحذير'};const en={bg:'Background',side:'Sidebar',panel:'Panels',card:'Cards',card2:'Secondary Cards',line:'Borders',text:'Text',muted:'Muted Text',accent:'Primary Accent',accent2:'Secondary Accent',danger:'Danger',warn:'Warning'};return (prefs.language==='en'?en:ar)[k]}
  function cssVar(k){return getComputedStyle(document.documentElement).getPropertyValue(`--${k}`).trim()||THEME_DEFAULTS[k]}
  function buildThemeFields(){
    const box=$('xpThemeFields');if(!box)return; box.innerHTML=THEME_KEYS.map(k=>{const v=validHex(prefs.custom_theme?.[k])?prefs.custom_theme[k]:cssVar(k);return `<div class="xp-color-field"><label><input type="color" data-xp-theme="${k}" value="${v}"><span class="grow">${themeLabel(k)}<br><code data-xp-code="${k}">${v.toUpperCase()}</code></span></label></div>`}).join('');
    box.querySelectorAll('[data-xp-theme]').forEach(i=>i.addEventListener('input',()=>{document.documentElement.dataset.theme='custom';document.documentElement.style.setProperty(`--${i.dataset.xpTheme}`,i.value);const c=box.querySelector(`[data-xp-code="${i.dataset.xpTheme}"]`);if(c)c.textContent=i.value.toUpperCase()}));
  }
  async function saveCustomTheme(){
    const {data:{session}}=await db.auth.getSession();if(!session?.user)return;const theme={};document.querySelectorAll('[data-xp-theme]').forEach(i=>theme[i.dataset.xpTheme]=i.value.toUpperCase());
    const {error}=await db.from('user_preferences').upsert({user_id:session.user.id,theme:'custom',custom_theme:theme,language:prefs.language,updated_at:new Date().toISOString()},{onConflict:'user_id'});
    const st=$('xpThemeStatus');if(error){st.textContent=error.message;st.style.color='var(--danger)';return}prefs.theme='custom';prefs.custom_theme=theme;applyCustomTheme(theme);st.textContent=prefs.language==='en'?'✓ Custom theme saved to your account.':'✓ تم حفظ الثيم المخصص على حسابك.';
  }
  function resetCustomTheme(){clearInlineTheme();prefs.custom_theme={...THEME_DEFAULTS};document.documentElement.dataset.theme='midnight';buildThemeFields();$('xpThemeStatus').textContent=prefs.language==='en'?'Colors reset. Save to keep them.':'تم إرجاع الألوان. اضغط حفظ إذا تريد تثبيتها.'}

  async function exportDatabase(){
    const st=$('xpExportStatus');st.textContent=prefs.language==='en'?'Preparing backup…':'جاري تجهيز النسخة الاحتياطية…';
    try{
      const {data:{session}}=await db.auth.getSession(); if(!session?.user)throw new Error('Not signed in');
      const [s,p,u,pr]=await Promise.all([db.from('spools').select('*').order('created_at'),db.from('printers').select('*').order('created_at'),db.from('usage_logs').select('*').order('created_at'),db.from('user_preferences').select('*').maybeSingle()]);
      for(const r of [s,p,u])if(r.error)throw r.error;
      const now=new Date(); const payload={
        backup_format:'Filaments Manger Database Backup',format_version:1,app:'Filaments Manger',created_by:'Khalid Alketbi',exported_at_utc:now.toISOString(),exported_at_local:now.toLocaleString(),timezone:Intl.DateTimeFormat().resolvedOptions().timeZone,user:{email:session.user.email||null,id:session.user.id},
        summary:{spools:(s.data||[]).length,printers:(p.data||[]).length,usage_logs:(u.data||[]).length},
        tables:{spools:s.data||[],printers:p.data||[],usage_logs:u.data||[],user_preferences:pr.data||null},
        notes:['This file is a complete user-data backup for Filaments Manger.','Push notification subscription endpoints and cryptographic keys are intentionally excluded for security.']
      };
      const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');const stamp=now.toISOString().replace(/[:.]/g,'-');a.href=url;a.download=`Filaments-Manger-Backup-${stamp}.json`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
      st.textContent=(prefs.language==='en'?`✓ Backup exported: ${payload.summary.spools} spools, ${payload.summary.printers} printers, ${payload.summary.usage_logs} usage records.`:`✓ تم التصدير: ${payload.summary.spools} سبول، ${payload.summary.printers} طابعة، ${payload.summary.usage_logs} سجل استخدام.`);
    }catch(e){st.textContent=(prefs.language==='en'?'Export failed: ':'تعذر التصدير: ')+(e?.message||e);st.style.color='var(--danger)'}
  }

  async function assistantColor(raw){
    const q=norm(raw); if(!q||!(q.includes('لون')||q.includes('color')||colorRows.some(c=>q.includes(norm(c.name)))))return false;
    const log=$('assistantLog');if(!log)return false;
    const add=(t,me=false)=>{const d=document.createElement('div');d.className='bubble'+(me?' me':'');d.textContent=t;log.appendChild(d);log.scrollTop=log.scrollHeight};
    add(raw,true);if($('assistantInput'))$('assistantInput').value='';
    const {data:spools}=await db.from('spools').select('name,brand,material,color,color_hex,remaining_weight,total_weight,archived').eq('archived',false);
    const foundColor=colorRows.find(c=>q.includes(norm(c.name))||q.includes(norm(c.hex)));
    if(foundColor){const rows=(spools||[]).filter(s=>norm(s.color)===norm(foundColor.name)||norm(s.color_hex)===norm(foundColor.hex));if(!rows.length)add(prefs.language==='en'?'No matching spools.':'ما لقيت سبولات بهذا اللون.');else add(rows.map((s,i)=>`${i+1}. ${s.name} — ${s.material} — ${s.color||s.color_hex} — ${Math.round(num(s.remaining_weight))}g`).join('\n'));return true}
    const groups={};(spools||[]).forEach(s=>{const k=s.color||s.color_hex||'Unknown';groups[k]??={count:0,g:0,hex:s.color_hex};groups[k].count++;groups[k].g+=num(s.remaining_weight)});const rows=Object.entries(groups).sort((a,b)=>b[1].g-a[1].g);
    add((prefs.language==='en'?'Color Summary\n':'ملخص الألوان\n')+rows.map(([k,v])=>`${k}${v.hex&&k!==v.hex?` (${v.hex})`:''}: ${v.count} ${prefs.language==='en'?'spools':'سبول'} · ${Math.round(v.g).toLocaleString()}g`).join('\n'));return true;
  }

  function enhanceAssistant(){
    const actions=$('assistantQuickActions');if(actions&&!$('xpColorAssistant')){const b=document.createElement('button');b.id='xpColorAssistant';b.type='button';b.className='btn secondary small';b.textContent=prefs.language==='en'?'Colors':'الألوان';b.onclick=()=>assistantColor(prefs.language==='en'?'color summary':'ملخص الألوان');actions.appendChild(b)}
    const send=$('assistantSend');if(send&&!send.dataset.xpColor){send.dataset.xpColor='1';send.addEventListener('click',async e=>{const raw=$('assistantInput')?.value||'';if(await assistantColor(raw)){e.preventDefault();e.stopImmediatePropagation()}},true)}
    const input=$('assistantInput');if(input&&!input.dataset.xpColor){input.dataset.xpColor='1';input.addEventListener('keydown',async e=>{if(e.key==='Enter'&&await assistantColor(input.value)){e.preventDefault();e.stopImmediatePropagation()}},true)}
  }

  function observe(){
    let timer;const obs=new MutationObserver(muts=>{clearTimeout(timer);timer=setTimeout(()=>{injectColorSearch();injectSettings();enhanceAssistant();if(prefs.language==='en')muts.forEach(m=>m.addedNodes.forEach(n=>{if(n.nodeType===1)translateElement(n)}))},50)});obs.observe(document.body,{childList:true,subtree:true});
  }
  async function init(){style();await loadPrefs();injectColorSearch();injectSettings();enhanceAssistant();await refreshColors();observe();db.auth.onAuthStateChange(async(_e,s)=>{if(s?.user){await loadPrefs();await refreshColors();setTimeout(()=>{injectSettings();injectColorSearch();enhanceAssistant()},200)}})}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();