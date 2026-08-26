(() => {
  const cfg = window.APP_CONFIG || {};
  const db = window.supabase && cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY
    ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}})
    : null;

  let lang = 'ar';
  let busy = false;
  const arabic = /[\u0600-\u06FF]/;

  const T = new Map(Object.entries({
    'لوحة التحكم':'Dashboard','السبولات':'Spools','الطابعات':'Printers','سجل الاستخدام':'Usage Log','الإعدادات':'Settings',
    'تسجيل خروج':'Log out','تسجيل الدخول':'Sign in','إنشاء حساب':'Create account','البريد الإلكتروني':'Email','كلمة المرور':'Password',
    'تذكرني':'Remember me','نسيت كلمة المرور؟':'Forgot password?','نسيت البريد/اسم الدخول؟':'Forgot email / username?',
    'المظهر':'Appearance','اختر الثيم الذي يعجبك. يحفظ على حسابك ويظهر على أجهزتك':'Choose the theme you like. It is saved to your account and appears on all your devices.',
    'نسبة تنبيه المخزون المنخفض':'Low-stock alert threshold','% تنبيه المخزون المنخفض':'Low-stock alert %','طريقة عرض السبولات':'Spool display mode','بطاقات':'Cards','جدول':'Table',
    'إجمالي السبولات':'Total Spools','إجمالي المتبقي':'Total Remaining','الفلمنت المتبقي':'Filament Remaining','الطابعات النشطة':'Active Printers','قريب من النفاد':'Low Stock','قيمة المخزون':'Inventory Value','استهلاك 30 يوم':'30-Day Usage',
    'توزيع المخزون حسب المادة':'Inventory by Material','تنبيهات المخزون':'Stock Alerts','المخزن والمواقع':'Storage & Locations','آخر السبولات':'Recent Spools','آخر النشاطات':'Recent Activity','نظرة سريعة':'Quick Overview','المواد':'Materials','المخزن':'Warehouse','على الطابعات':'On Printers',
    'قاعدة بيانات السبولات — تفاصيل كاملة':'Spool Database — Full Details','إدارة السبولات':'Manage Spools','عرض الكل':'View All',
    'إضافة سبول':'Add Spool','+ إضافة سبول':'+ Add Spool','+ سبول':'+ Spool','إضافة طابعة':'Add Printer','+ إضافة طابعة':'+ Add Printer',
    'تعديل':'Edit','استخدام':'Use','تكرار':'Duplicate','حذف':'Delete','إلغاء':'Cancel','حفظ':'Save','إرسال':'Send','فتح':'Open','تحديث':'Refresh',
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
    'لا توجد بيانات.':'No data.','لا توجد بيانات':'No data','لا توجد طابعات.':'No printers.','لا توجد طابعات':'No printers','ما عندك طابعات مسجلة.':'No printers registered.','ما عندك سبولات.':'No spools.','لا توجد سبولات مطابقة.':'No matching spools.','ما في عمليات استخدام بعد.':'No usage records yet.','أضف أول سبول.':'Add your first spool.','✓ المخزون بحالة جيدة.':'✓ Inventory is healthy.','✓ ما عندك سبولات منخفضة.':'✓ No low-stock spools.',
    'تم حفظ الإعدادات.':'Settings saved.','تم حفظ خيارات التنبيه.':'Notification settings saved.','تعذر حفظ إعدادات التنبيه.':'Could not save notification settings.','فعّل إشعارات الهاتف أولًا.':'Enable phone notifications first.','تم إرسال إشعار تجريبي.':'Test notification sent.','تم إيقاف إشعارات هذا الجهاز.':'Notifications disabled on this device.','تعذر إيقاف الإشعارات.':'Could not disable notifications.','تعذر تفعيل الإشعارات. جرّب مرة ثانية.':'Could not enable notifications. Try again.','الإشعارات مرفوضة من إعدادات الجهاز.':'Notifications are blocked in device settings.','ما تم السماح بالإشعارات.':'Notifications were not allowed.','هذا المتصفح ما يدعم Push Notifications.':'This browser does not support Push Notifications.','تم تفعيل إشعارات الهاتف.':'Phone notifications enabled.','الإشعارات شغالة على هذا الجهاز.':'Notifications are working on this device.'
  }));

  const placeholders = new Map(Object.entries({
    'ابحث بالاسم، الشركة، المادة، اللون، الموقع، رقم الدفعة...':'Search by name, brand, material, color, location, lot…',
    'بحث داخل السبولات':'Search spools','اكتب طلبك...':'Type your request…','اكتب سؤالك عن المخزون والطابعات.':'Ask about inventory and printers.','اسم مخصص للون (اختياري)':'Custom color name (optional)'
  }));

  function protectedElement(el){
    if(!el) return true;
    if(el.closest('script,style,noscript')) return true;
    if(el.matches('#notes') || el.closest('#notes')) return true;
    if(el.matches('input,textarea') || el.closest('input,textarea')) return true;
    return false;
  }

  function translateText(raw){
    const original=String(raw??'');
    const t=original.trim();
    if(!t || !arabic.test(t)) return original;
    if(T.has(t)) return original.replace(t,T.get(t));

    let s=t;
    const patterns=[
      [/^(\d+) في المخزن(?: · (\d+) مركب)?$/,(_,a,b)=>`${a} in warehouse${b?` · ${b} loaded`:''}`],
      [/^من (.+)$/,(_,a)=>`of ${a}`],
      [/^(\d+) عمليات$/,(_,a)=>`${a} operations`],
      [/^(\d+) مواد$/,(_,a)=>`${a} materials`],
      [/^(\d+) أنواع$/,(_,a)=>`${a} types`],
      [/^(\d+) سبول$/,(_,a)=>`${a} spools`],
      [/^(\d+) سبول فعال(?:، منها (\d+) مركب على الطابعات)?[.]?$/,(_,a,b)=>`${a} active spools${b?`, ${b} loaded on printers`:''}`],
      [/^تنبيه قبل النهاية بـ\s*(\d+)\s*دقيقة[،,.]?\s*تنبيه عند انتهاء الطبعة$/,(_,m)=>`Notify ${m} minutes before the print ends, and when the print finishes`],
      [/^تنبيه قبل النهاية بـ\s*(\d+)\s*دقيقة$/,(_,m)=>`Notify ${m} minutes before the end`],
      [/^باقي\s*(\d+)س\s*(\d+)د(?:\s*·\s*النهاية\s*(.+))?$/,(_,h,m,e)=>`${h}h ${m}m left${e?` · ends ${e}`:''}`],
      [/^النهاية المتوقعة:\s*(.+)$/,(_,a)=>`Estimated finish: ${a}`],
      [/^الموجود الآن\s*(.+?)\s*·\s*(.+?)\s*تقريبًا$/,(_,a,b)=>`Available now ${a} · about ${b}`],
      [/^استخدام\s*(.+?)\s*·\s*(.+)$/,(_,a,b)=>`Usage ${a} · ${b}`]
    ];
    for(const [re,fn] of patterns){ if(re.test(s)){s=s.replace(re,fn);break;} }
    if(!arabic.test(s)) return original.replace(t,s);

    const replacements=[
      ['اختر الثيم الذي يعجبك','Choose the theme you like'],['يحفظ على حسابك','Saved to your account'],['ويظهر على أجهزتك','and appears on your devices'],
      ['تنبيه قبل انتهاء الطبعة بـ','Notify Before Print Ends By'],['تنبيه عند انتهاء الطبعة','Notify When Print Finishes'],['حفظ خيارات التنبيه','Save Notification Settings'],['إشعارات الطباعة','Print Notifications'],
      ['الشاشة الرئيسية','Home Screen'],['إعدادات الجهاز','device settings'],['إشعارات الهاتف','phone notifications'],['نسبة تنبيه المخزون المنخفض','Low-stock alert threshold'],['طريقة عرض السبولات','Spool display mode'],
      ['خيارات متقدمة','Advanced Options'],['لوحة التحكم','Dashboard'],['السبولات','Spools'],['الطابعات','Printers'],['سجل الاستخدام','Usage Log'],['الإعدادات','Settings'],
      ['قريب من النفاد','Low Stock'],['قيمة المخزون','Inventory Value'],['استهلاك','Usage'],['المخزون','Inventory'],['المتبقي','Remaining'],['المستخدم','Used'],['الطول','Length'],
      ['إضافة','Add'],['تعديل','Edit'],['حذف','Delete'],['حفظ','Save'],['إلغاء','Cancel'],['تحديث','Refresh'],['إرسال','Send'],['المادة','Material'],['الشركة','Brand'],['اللون','Color'],['الموقع','Location'],['السعر','Price'],['ملاحظات','Notes'],['دقيقة','minutes'],['الساعات','Hours'],['الدقائق','Minutes'],['اللغة','Language'],['العربية','Arabic'],['الإنجليزية','English']
    ];
    for(const [a,b] of replacements) s=s.split(a).join(b);
    return original.replace(t,s);
  }

  function translateElement(root){
    if(lang!=='en' || !root) return;
    busy=true;
    try{
      const el=root.nodeType===Node.ELEMENT_NODE?root:document.body;
      if(!el) return;
      const walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);
      const nodes=[]; while(walker.nextNode()) nodes.push(walker.currentNode);
      nodes.forEach(n=>{
        if(protectedElement(n.parentElement)) return;
        const v=translateText(n.nodeValue);
        if(v!==n.nodeValue)n.nodeValue=v;
      });
      el.querySelectorAll?.('input[placeholder],textarea[placeholder]').forEach(x=>{
        if(x.id==='notes') return;
        const p=x.getAttribute('placeholder')||'';
        const v=placeholders.get(p)||translateText(p);
        if(v!==p)x.setAttribute('placeholder',v);
      });
      el.querySelectorAll?.('option').forEach(o=>{const v=translateText(o.textContent);if(v!==o.textContent)o.textContent=v;});
      el.querySelectorAll?.('[title],[aria-label]').forEach(x=>{
        for(const attr of ['title','aria-label']){const a=x.getAttribute(attr);if(!a)continue;const v=translateText(a);if(v!==a)x.setAttribute(attr,v);}
      });
    } finally {busy=false;}
  }

  function applyDirection(){
    document.documentElement.lang=lang;
    document.documentElement.dir=lang==='en'?'ltr':'rtl';
    document.body?.setAttribute('dir',lang==='en'?'ltr':'rtl');
  }

  async function readLanguage(){
    try{
      if(!db)return;
      const {data:{session}}=await db.auth.getSession();
      if(!session?.user)return;
      const {data}=await db.from('user_preferences').select('language').eq('user_id',session.user.id).maybeSingle();
      if(data?.language==='en'||data?.language==='ar')lang=data.language;
    }catch(e){console.warn('language load failed',e)}
  }

  function sweep(){if(lang==='en')requestAnimationFrame(()=>translateElement(document.body));}

  async function init(){
    await readLanguage();
    applyDirection();
    if(lang==='en')translateElement(document.body);

    const obs=new MutationObserver(muts=>{
      if(lang!=='en'||busy)return;
      for(const m of muts){if(m.type==='characterData'||m.addedNodes.length){sweep();break;}}
    });
    obs.observe(document.body,{childList:true,subtree:true,characterData:true});
    [100,300,700,1400,2500,4500].forEach(ms=>setTimeout(sweep,ms));

    document.addEventListener('click',async e=>{
      const b=e.target.closest('[data-xp-lang]');
      if(!b||!db)return;
      const next=b.dataset.xpLang;if(next!=='ar'&&next!=='en')return;
      try{
        const {data:{session}}=await db.auth.getSession();
        if(session?.user)await db.from('user_preferences').upsert({user_id:session.user.id,language:next,updated_at:new Date().toISOString()},{onConflict:'user_id'});
      }catch(_){}
      lang=next;applyDirection();setTimeout(()=>location.reload(),80);
    },true);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();