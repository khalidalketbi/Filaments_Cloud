(() => {
  const cfg = window.APP_CONFIG || {};
  const db = window.supabase && cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY
    ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}})
    : null;

  const exact = new Map(Object.entries({
    'لوحة التحكم':'Dashboard','السبولات':'Spools','الطابعات':'Printers','سجل الاستخدام':'Usage Log','الإعدادات':'Settings',
    'تسجيل خروج':'Log out','تسجيل الدخول':'Sign in','إنشاء حساب':'Create account','البريد الإلكتروني':'Email','كلمة المرور':'Password','تذكرني':'Remember me','نسيت كلمة المرور؟':'Forgot password?','نسيت البريد/اسم الدخول؟':'Forgot email / username?',
    'المظهر':'Appearance','اختر الثيم الذي يعجبك. يحفظ على حسابك ويظهر على أجهزتك':'Choose the theme you like. It is saved to your account and appears on all your devices.',
    'نسبة تنبيه المخزون المنخفض':'Low-stock alert threshold','طريقة عرض السبولات':'Spool display mode','بطاقات':'Cards','جدول':'Table',
    'إجمالي السبولات':'Total Spools','إجمالي المتبقي':'Total Remaining','الفلمنت المتبقي':'Filament Remaining','الطابعات النشطة':'Active Printers','قريب من النفاد':'Low Stock','قيمة المخزون':'Inventory Value','استهلاك 30 يوم':'30-Day Usage',
    'توزيع المخزون حسب المادة':'Inventory by Material','تنبيهات المخزون':'Stock Alerts','المخزن والمواقع':'Storage & Locations','آخر السبولات':'Recent Spools','آخر النشاطات':'Recent Activity','نظرة سريعة':'Quick Overview','المواد':'Materials','المخزن':'Warehouse','على الطابعات':'On Printers',
    'قاعدة بيانات السبولات — تفاصيل كاملة':'Spool Database — Full Details','إدارة السبولات':'Manage Spools','عرض الكل':'View All',
    'إضافة سبول':'Add Spool','+ إضافة سبول':'+ Add Spool','+ سبول':'+ Spool','إضافة طابعة':'Add Printer','+ إضافة طابعة':'+ Add Printer','تعديل':'Edit','استخدام':'Use','تكرار':'Duplicate','حذف':'Delete','إلغاء':'Cancel','حفظ':'Save','إرسال':'Send','فتح':'Open','تحديث':'Refresh',
    'كل المواد':'All Materials','كل المواقع':'All Locations','كل الألوان':'All Colors','الأحدث':'Newest','الجرامات: الأكثر':'Grams: High to Low','الجرامات: الأقل':'Grams: Low to High','الاسم: أ → ي':'Name: A → Z','الاسم: ي → أ':'Name: Z → A','حسب المادة':'By Material','حسب الشركة':'By Brand','الأقرب للنفاد':'Lowest Stock First','المؤرشف':'Archived','بحث حسب اللون':'Search by color',
    'اسم السبول':'Spool Name','الشركة':'Brand','المادة':'Material','اسم اللون':'Color Name','اللون':'Color','ألوان متعددة':'Multiple Colors','وزن الفلمنت الأصلي (g)':'Original Filament Weight (g)','المتبقي الآن (g)':'Remaining Now (g)','وزن السبول الفاضي (g)':'Empty Spool Weight (g)','قطر الفلمنت (mm)':'Filament Diameter (mm)','الكثافة (g/cm³)':'Density (g/cm³)','السعر':'Price','الموقع':'Location','رقم الدفعة / Lot':'Lot Number','رقم المنتج / SKU':'Product / SKU','تاريخ الشراء':'Purchase Date','حرارة النوزل من':'Nozzle Temp From','إلى':'To','حرارة البيد من':'Bed Temp From','ملاحظات':'Notes','مفضلة ★':'Favorite ★',
    'خيارات متقدمة':'Advanced Options','السعر، الموقع، Lot، SKU، الحرارة والمزيد':'Price, location, Lot, SKU, temperatures and more',
    'جاهزة':'Idle','تطبع':'Printing','غير متصلة':'Offline','صيانة':'Maintenance','السبول المركب':'Loaded Spool','بدون سبول':'No Spool','اسم الطابعة':'Printer Name','الموديل':'Model','الحالة':'Status','تسجيل طبعة':'Log Print',
    'الساعات':'Hours','الدقائق':'Minutes','دقيقة':'minutes','الوقت المتبقي':'Remaining Time','النهاية المتوقعة':'Estimated Finish','مر':'Elapsed','باقي':'Remaining',
    'سجل استهلاك الفلمنت':'Filament Usage Log','إجمالي مسجل':'Total Logged','آخر 30 يوم':'Last 30 Days','الأكثر استخدامًا':'Most Used','عمليات':'Operations',
    'المستخدم':'Used','الطول':'Length','المتبقي':'Remaining','الإجمالي':'Total','أول استخدام':'First Used','آخر استخدام':'Last Used','وزن الفاضي':'Empty Spool Weight','الشراء':'Purchase','النوزل':'Nozzle','البيد':'Bed',
    'Assistant':'Assistant','ملخص المخزون':'Inventory Summary','حالة الطابعات':'Printer Status','اقتراحات':'Suggestions','ملخص الألوان':'Color Summary',
    'اختر تقرير جاهز، أو اسألني عن المخزون والطابعات.':'Choose a ready report, or ask me about inventory and printers.','اختر تقرير جاهز أو اكتب سؤالك عن المخزون والطابعات.':'Choose a ready report or ask about inventory and printers.','اكتب طلبك...':'Type your request…','اكتب سؤالك عن المخزون والطابعات.':'Ask about inventory and printers.',
    'الثيمات الجاهزة':'Preset Themes','تخصيص الثيم':'Custom Theme','اللغة':'Language','العربية':'Arabic','الإنجليزية':'English','نسخة احتياطية للبيانات':'Database Backup','تصدير قاعدة البيانات':'Export Database','تحميل نسخة JSON':'Download JSON Backup','تطبيق مباشر':'Live Preview','حفظ الثيم المخصص':'Save Custom Theme','إرجاع الألوان الافتراضية':'Reset Colors',
    'الخلفية':'Background','الشريط الجانبي':'Sidebar','اللوحات':'Panels','البطاقات':'Cards','البطاقات الثانوية':'Secondary Cards','الحدود':'Borders','النص':'Text','النص الثانوي':'Muted Text','اللون الرئيسي':'Primary Accent','اللون الثانوي':'Secondary Accent','الخطر':'Danger','التحذير':'Warning',
    'إشعارات الطباعة':'Print Notifications','تفعيل إشعارات الهاتف':'Enable Phone Notifications','إيقاف إشعارات هذا الجهاز':'Disable Notifications on This Device','إرسال إشعار تجريبي':'Send Test Notification','تنبيه قبل انتهاء الطبعة بـ':'Notify Before Print Ends By','تنبيه عند انتهاء الطبعة':'Notify When Print Finishes','حفظ خيارات التنبيه':'Save Notification Settings',
    'كل تنبيهات انتهاء الطباعة متوقفة.':'All print-finish notifications are disabled.','مفعلة':'Enabled','مرفوضة':'Denied','غير مفعلة':'Disabled',
    'يلزم تثبيت الموقع للشاشة الرئيسية ثم السماح له بالإشعارات على iPhone':'Add the site to your Home Screen, then allow notifications on iPhone.','على iPhone لازم تضيف الموقع إلى الشاشة الرئيسية ثم تفتحه من الأيقونة.':'On iPhone, add the site to your Home Screen, then open it from the icon.',
    'حفظ الإعدادات':'Save Settings','اللون المكتشف:':'Detected color:','اسم مخصص اختياري':'Optional custom name','بحث داخل السبولات':'Search spools','بحث':'Search','كل شيء':'All',
    'إجمالي الفلمنت المتبقي':'Total Filament Remaining','قيمة المتبقي تقريبًا':'Estimated remaining value','حسب حد التنبيه':'Based on alert threshold','حسب الأسعار المسجلة':'Based on recorded prices','يومي':'Daily','الأولوية الأعلى':'Highest priority','متوسط':'Average','الأكثر':'Most','الأقدم':'Oldest',
    'لا توجد بيانات.':'No data.','لا توجد بيانات':'No data','لا توجد طابعات.':'No printers.','لا توجد طابعات':'No printers','ما عندك طابعات مسجلة.':'No printers registered.','ما عندك سبولات.':'No spools.','لا توجد سبولات مطابقة.':'No matching spools.','ما في عمليات استخدام بعد.':'No usage records yet.','أضف أول سبول.':'Add your first spool.','✓ المخزون بحالة جيدة.':'✓ Inventory is healthy.','✓ ما عندك سبولات منخفضة.':'✓ No low-stock spools.'
  }));

  const placeholders = new Map(Object.entries({
    'ابحث بالاسم، الشركة، المادة، اللون، الموقع، رقم الدفعة...':'Search by name, brand, material, color, location, lot…','بحث داخل السبولات':'Search spools','اكتب طلبك...':'Type your request…','اكتب سؤالك عن المخزون والطابعات.':'Ask about inventory and printers.','اسم مخصص للون (اختياري)':'Custom color name (optional)'
  }));

  const phrasePairs = [
    ['اختر الثيم الذي يعجبك. يحفظ على حسابك ويظهر على أجهزتك','Choose the theme you like. It is saved to your account and appears on all your devices.'],
    ['تنبيه عند انتهاء الطبعة','Notify when print finishes'],['تنبيه قبل انتهاء الطبعة بـ','Notify before print ends by'],['حفظ خيارات التنبيه','Save notification settings'],
    ['يلزم تثبيت الموقع للشاشة الرئيسية ثم السماح له بالإشعارات على iPhone','Add the site to your Home Screen, then allow notifications on iPhone.'],
    ['على iPhone لازم تضيف الموقع إلى الشاشة الرئيسية ثم تفتحه من الأيقونة.','On iPhone, add the site to your Home Screen, then open it from the icon.'],
    ['السعر، الموقع، Lot، SKU، الحرارة والمزيد','Price, location, Lot, SKU, temperatures and more'],
    ['في المخزن','in warehouse'],['مركب','loaded'],['سبول فعال','active spools'],['عمليات','operations'],['مواد','materials'],['أنواع','types']
  ];

  let lang = 'ar';
  let sweeping = false;

  function protect(el){
    if(!el) return true;
    if(el.closest('script,style,noscript')) return true;
    if(el.matches('textarea#notes') || el.closest('textarea#notes')) return true;
    if(el.matches('textarea,input') || el.closest('textarea,input')) return true;
    if(el.closest('.bubble.me,[data-user-content]')) return true;
    return false;
  }

  function translateString(raw){
    const original=String(raw??''); const t=original.trim(); if(!t) return original;
    if(exact.has(t)) return original.replace(t,exact.get(t));
    let s=t;
    s=s.replace(/^(\d+) في المخزن(?: · (\d+) مركب)?$/,(_,a,b)=>`${a} in warehouse${b?` · ${b} loaded`:''}`)
      .replace(/^من (.+)$/,(_,a)=>`of ${a}`)
      .replace(/^(\d+) عمليات$/,(_,a)=>`${a} operations`)
      .replace(/^(\d+) مواد$/,(_,a)=>`${a} materials`)
      .replace(/^(\d+) أنواع$/,(_,a)=>`${a} types`)
      .replace(/^(\d+) سبول$/,(_,a)=>`${a} spools`)
      .replace(/^(\d+) سبول فعال(?:، منها (\d+) مركب على الطابعات)?[.]?$/,(_,a,b)=>`${a} active spools${b?`, ${b} loaded on printers`:''}`)
      .replace(/^تنبيه قبل النهاية بـ (\d+) دقيقة$/,(_,a)=>`Notify ${a} minutes before the end`)
      .replace(/^باقي (\d+)س (\d+)د(?: · النهاية (.+))?$/,(_,h,m,e)=>`${h}h ${m}m left${e?` · ends ${e}`:''}`)
      .replace(/^النهاية المتوقعة: (.+)$/,(_,a)=>`Estimated finish: ${a}`)
      .replace(/^الموجود الآن (.+) · (.+) تقريبًا$/,(_,a,b)=>`Available now ${a} · about ${b}`)
      .replace(/^الآن (.+)$/,(_,a)=>`Now ${a}`)
      .replace(/^بعد الخصم (.+)$/,(_,a)=>`After deduction ${a}`)
      .replace(/^استخدام (.+) · (.+)$/,(_,a,b)=>`Usage ${a} · ${b}`)
      .replace(/^تم حفظ الإعدادات[.]?$/,()=>`Settings saved.`)
      .replace(/^تم حفظ خيارات التنبيه[.]?$/,()=>`Notification settings saved.`)
      .replace(/^تم تفعيل إشعارات الهاتف[.]?.*$/,()=>`Phone notifications are enabled.`)
      .replace(/^تم إيقاف إشعارات هذا الجهاز[.]?$/,()=>`Notifications are disabled on this device.`)
      .replace(/^تم إرسال إشعار تجريبي.*$/,()=>`Test notification sent.`);
    for(const [ar,en] of phrasePairs) s=s.split(ar).join(en);
    return original.replace(t,s);
  }

  function sweep(root=document.body){
    if(lang!=='en'||!root||sweeping)return;
    sweeping=true;
    try{
      document.documentElement.lang='en'; document.documentElement.dir='ltr'; document.body.dir='ltr';
      const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT); const nodes=[]; while(walker.nextNode())nodes.push(walker.currentNode);
      for(const n of nodes){ if(protect(n.parentElement))continue; const v=translateString(n.nodeValue); if(v!==n.nodeValue)n.nodeValue=v; }
      root.querySelectorAll?.('input[placeholder],textarea[placeholder]').forEach(el=>{ const p=el.getAttribute('placeholder'); if(placeholders.has(p))el.setAttribute('placeholder',placeholders.get(p)); });
      root.querySelectorAll?.('option').forEach(o=>{const v=translateString(o.textContent);if(v!==o.textContent)o.textContent=v;});
      root.querySelectorAll?.('[title],[aria-label]').forEach(el=>{for(const a of ['title','aria-label']){const v=el.getAttribute(a);if(v){const x=translateString(v);if(x!==v)el.setAttribute(a,x);}}});
    } finally { sweeping=false; }
  }

  async function resolveLanguage(){
    try{
      if(db){const {data:{session}}=await db.auth.getSession();if(session?.user){const {data}=await db.from('user_preferences').select('language').eq('user_id',session.user.id).maybeSingle();if(data?.language)lang=data.language;}}
    }catch(_){}
    if(!lang) lang=localStorage.getItem('filaments_language')||document.documentElement.lang||'ar';
    localStorage.setItem('filaments_language',lang);
    document.documentElement.lang=lang; document.documentElement.dir=lang==='en'?'ltr':'rtl'; document.body.dir=document.documentElement.dir;
    if(lang==='en')sweep(document.body);
  }

  function watch(){
    let raf=0;
    const obs=new MutationObserver(()=>{if(lang!=='en'||sweeping||raf)return;raf=requestAnimationFrame(()=>{raf=0;sweep(document.body);});});
    obs.observe(document.body,{childList:true,subtree:true,characterData:true});
    setInterval(()=>{if(lang==='en')sweep(document.body);},1500);
  }

  async function init(){await resolveLanguage();watch();setTimeout(()=>sweep(document.body),250);setTimeout(()=>sweep(document.body),1000);setTimeout(()=>sweep(document.body),2500);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();