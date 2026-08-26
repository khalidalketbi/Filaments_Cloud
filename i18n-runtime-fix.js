(() => {
  const AR_TO_EN = new Map(Object.entries({
    'لوحة التحكم':'Dashboard','السبولات':'Spools','الطابعات':'Printers','سجل الاستخدام':'Usage Log','الإعدادات':'Settings',
    'المظهر':'Appearance','اختر الثيم الذي يعجبك. يحفظ على حسابك ويظهر على أجهزتك':'Choose the theme you like. It is saved to your account and appears on all your devices.',
    'نسبة تنبيه المخزون المنخفض':'Low-stock alert threshold','طريقة عرض السبولات':'Spool display mode','بطاقات':'Cards','جدول':'Table',
    'إشعارات الطباعة':'Print Notifications','تنبيه قبل النهاية بـ 10 دقيقة، تنبيه عند انتهاء الطبعة':'Notify 10 minutes before the print ends, and when the print finishes',
    'تنبيه قبل انتهاء الطبعة بـ':'Notify Before Print Ends By','تنبيه عند انتهاء الطبعة':'Notify When Print Finishes','حفظ خيارات التنبيه':'Save Notification Settings',
    'إيقاف إشعارات هذا الجهاز':'Disable Notifications on This Device','تفعيل إشعارات الهاتف':'Enable Phone Notifications','إرسال إشعار تجريبي':'Send Test Notification',
    'يلزم تثبيت الموقع للشاشة الرئيسية ثم السماح له بالإشعارات على iPhone':'Add this site to the Home Screen, then allow notifications on iPhone.',
    'يلزم تثبيت الموقع للشاشة الرئيسية ثم السماح له بالإشعارات على iPhone.':'Add this site to the Home Screen, then allow notifications on iPhone.',
    'اللغة':'Language','العربية':'Arabic','الإنجليزية':'English','تخصيص الثيم':'Custom Theme','الثيمات الجاهزة':'Preset Themes',
    'حفظ الإعدادات':'Save Settings','حفظ الثيم المخصص':'Save Custom Theme','إرجاع الألوان الافتراضية':'Reset Colors','تطبيق مباشر':'Live Preview',
    'الخلفية':'Background','الشريط الجانبي':'Sidebar','اللوحات':'Panels','البطاقات':'Cards','البطاقات الثانوية':'Secondary Cards','الحدود':'Borders','النص':'Text','النص الثانوي':'Muted Text','اللون الرئيسي':'Primary Accent','اللون الثانوي':'Secondary Accent','الخطر':'Danger','التحذير':'Warning',
    'نسخة احتياطية للبيانات':'Database Backup','تصدير قاعدة البيانات':'Export Database','تحميل نسخة JSON':'Download JSON Backup',
    'إجمالي السبولات':'Total Spools','إجمالي المتبقي':'Total Remaining','الطابعات النشطة':'Active Printers','قريب من النفاد':'Low Stock','قيمة المخزون':'Inventory Value','استهلاك 30 يوم':'30-Day Usage',
    'توزيع المخزون حسب المادة':'Inventory by Material','تنبيهات المخزون':'Stock Alerts','المخزن والمواقع':'Storage & Locations','آخر السبولات':'Recent Spools','آخر النشاطات':'Recent Activity','نظرة سريعة':'Quick Overview',
    'كل المواد':'All Materials','كل المواقع':'All Locations','كل الألوان':'All Colors','الأحدث':'Newest','الجرامات: الأكثر':'Grams: High to Low','الجرامات: الأقل':'Grams: Low to High','حسب المادة':'By Material','حسب الشركة':'By Brand','الأقرب للنفاد':'Lowest Stock First',
    'إضافة سبول':'Add Spool','إضافة طابعة':'Add Printer','تعديل':'Edit','استخدام':'Use','تكرار':'Duplicate','حذف':'Delete','إلغاء':'Cancel','حفظ':'Save','إرسال':'Send','تحديث':'Refresh','فتح':'Open',
    'اسم السبول':'Spool Name','الشركة':'Brand','المادة':'Material','اللون':'Color','اسم اللون':'Color Name','وزن الفلمنت الأصلي (g)':'Original Filament Weight (g)','المتبقي الآن (g)':'Remaining Now (g)','خيارات متقدمة':'Advanced Options',
    'السعر':'Price','الموقع':'Location','تاريخ الشراء':'Purchase Date','ملاحظات':'Notes','اسم الطابعة':'Printer Name','الموديل':'Model','الحالة':'Status','السبول المركب':'Loaded Spool','بدون سبول':'No Spool',
    'جاهزة':'Idle','تطبع':'Printing','صيانة':'Maintenance','غير متصلة':'Offline','الساعات':'Hours','الدقائق':'Minutes','الوقت المتبقي':'Remaining Time','النهاية المتوقعة':'Estimated Finish',
    'تسجيل الدخول':'Sign in','إنشاء حساب':'Create account','البريد الإلكتروني':'Email','كلمة المرور':'Password','تذكرني':'Remember me','نسيت كلمة المرور؟':'Forgot password?','نسيت البريد/اسم الدخول؟':'Forgot email / username?','تسجيل خروج':'Log out'
  }));

  const PLACEHOLDERS = new Map(Object.entries({
    'ابحث بالاسم، الشركة، المادة، اللون، الموقع، رقم الدفعة...':'Search by name, brand, material, color, location, lot…',
    'بحث داخل السبولات':'Search spools','اكتب طلبك...':'Type your request…','اكتب سؤالك عن المخزون والطابعات.':'Ask about inventory and printers.'
  }));

  function isEnglish(){ return document.documentElement.lang === 'en'; }
  function protectedNode(node){
    const el=node.nodeType===Node.ELEMENT_NODE?node:node.parentElement;
    if(!el) return true;
    if(el.closest('script,style,noscript')) return true;
    // Never alter user-entered field values; this preserves spool notes exactly as typed.
    if(el.matches('input,textarea') || el.closest('input,textarea')) return true;
    // User messages / free-form data should remain untouched.
    if(el.closest('.bubble.me,[data-user-content]')) return true;
    return false;
  }

  function translateTextValue(value){
    const raw=String(value??''); const t=raw.trim(); if(!t) return raw;
    if(AR_TO_EN.has(t)) return raw.replace(t,AR_TO_EN.get(t));
    let s=t;
    s=s.replace(/^(\d+) في المخزن(?: · (\d+) مركب)?$/,(_,a,b)=>`${a} in warehouse${b?` · ${b} loaded`:''}`)
       .replace(/^من (.+)$/,(_,a)=>`of ${a}`)
       .replace(/^(\d+) عمليات$/,(_,a)=>`${a} operations`)
       .replace(/^(\d+) مواد$/,(_,a)=>`${a} materials`)
       .replace(/^(\d+) أنواع$/,(_,a)=>`${a} types`)
       .replace(/^باقي (\d+)س (\d+)د$/,(_,h,m)=>`${h}h ${m}m left`);
    return raw.replace(t,s);
  }

  function translateTree(root=document.body){
    if(!isEnglish() || !root) return;
    if(root.nodeType===Node.TEXT_NODE){ if(!protectedNode(root)){const v=translateTextValue(root.nodeValue);if(v!==root.nodeValue)root.nodeValue=v;} return; }
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT); const nodes=[];
    while(walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(n=>{ if(protectedNode(n))return; const v=translateTextValue(n.nodeValue); if(v!==n.nodeValue)n.nodeValue=v; });
    const scope=root.querySelectorAll?root:document;
    scope.querySelectorAll?.('input[placeholder],textarea[placeholder]').forEach(el=>{ const p=el.getAttribute('placeholder'); if(PLACEHOLDERS.has(p))el.setAttribute('placeholder',PLACEHOLDERS.get(p)); });
    scope.querySelectorAll?.('option').forEach(o=>{ const v=translateTextValue(o.textContent); if(v!==o.textContent)o.textContent=v; });
  }

  let scheduled=false;
  function schedule(){ if(scheduled||!isEnglish())return; scheduled=true; requestAnimationFrame(()=>{scheduled=false;translateTree(document.body);}); }
  function init(){
    if(isEnglish()) translateTree(document.body);
    const obs=new MutationObserver(muts=>{
      if(!isEnglish())return;
      for(const m of muts){ if(m.type==='childList'||m.type==='characterData'){schedule();break;} }
    });
    obs.observe(document.body,{childList:true,subtree:true,characterData:true});
    setTimeout(schedule,150); setTimeout(schedule,700); setTimeout(schedule,1600);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true}); else init();
})();