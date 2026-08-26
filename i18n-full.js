(() => {
  const $ = id => document.getElementById(id);
  const dict = new Map(Object.entries({
    'لوحة التحكم':'Dashboard','السبولات':'Spools','الطابعات':'Printers','سجل الاستخدام':'Usage Log','الإعدادات':'Settings',
    'تسجيل خروج':'Log out','تسجيل الدخول':'Sign in','إنشاء حساب':'Create account','البريد الإلكتروني':'Email','كلمة المرور':'Password',
    'مخزون الفلمنت والطابعات في مكان واحد':'Filament inventory and printers in one place',
    'إجمالي السبولات':'Total Spools','إجمالي المتبقي':'Total Remaining','الفلمنت المتبقي':'Filament Remaining','الطابعات النشطة':'Active Printers','قريب من النفاد':'Low Stock','قيمة المخزون':'Inventory Value','استهلاك 30 يوم':'30-Day Usage',
    'توزيع المخزون حسب المادة':'Inventory by Material','تنبيهات المخزون':'Stock Alerts','المخزن والمواقع':'Storage & Locations','آخر السبولات':'Recent Spools','آخر النشاطات':'Recent Activity','نظرة سريعة':'Quick Overview','المواد':'Materials','المخزن':'Warehouse','على الطابعات':'On Printers',
    'قاعدة بيانات السبولات — تفاصيل كاملة':'Spool Database — Full Details','إدارة السبولات':'Manage Spools','عرض الكل':'View All','المظهر':'Appearance','حفظ الإعدادات':'Save Settings',
    'إضافة سبول':'Add Spool','+ إضافة سبول':'+ Add Spool','+ سبول':'+ Spool','إضافة طابعة':'Add Printer','+ إضافة طابعة':'+ Add Printer','تعديل':'Edit','استخدام':'Use','تكرار':'Duplicate','حذف':'Delete','إلغاء':'Cancel','حفظ':'Save','إرسال':'Send','فتح':'Open','تحديث':'Refresh',
    'كل المواد':'All Materials','كل المواقع':'All Locations','كل الألوان':'All Colors','الأحدث':'Newest','الجرامات: الأكثر':'Grams: High to Low','الجرامات: الأقل':'Grams: Low to High','الاسم: أ → ي':'Name: A → Z','الاسم: ي → أ':'Name: Z → A','حسب المادة':'By Material','حسب الشركة':'By Brand','الأقرب للنفاد':'Lowest Stock First','المؤرشف':'Archived','بحث حسب اللون':'Search by color',
    'اسم السبول':'Spool Name','الشركة':'Brand','المادة':'Material','اسم اللون':'Color Name','اللون':'Color','ألوان متعددة':'Multiple Colors','وزن الفلمنت الأصلي (g)':'Original Filament Weight (g)','المتبقي الآن (g)':'Remaining Now (g)','وزن السبول الفاضي (g)':'Empty Spool Weight (g)','قطر الفلمنت (mm)':'Filament Diameter (mm)','الكثافة (g/cm³)':'Density (g/cm³)','السعر':'Price','الموقع':'Location','رقم الدفعة / Lot':'Lot Number','رقم المنتج / SKU':'Product / SKU','تاريخ الشراء':'Purchase Date','حرارة النوزل من':'Nozzle Temp From','إلى':'To','حرارة البيد من':'Bed Temp From','ملاحظات':'Notes','مفضلة ★':'Favorite ★',
    'خيارات متقدمة':'Advanced Options','السعر، الموقع، Lot، SKU، الحرارة والمزيد':'Price, location, Lot, SKU, temperatures and more',
    'جاهزة':'Idle','تطبع':'Printing','غير متصلة':'Offline','صيانة':'Maintenance','السبول المركب':'Loaded Spool','بدون سبول':'No Spool','اسم الطابعة':'Printer Name','الموديل':'Model','الحالة':'Status','تسجيل طبعة':'Log Print',
    'سجل استهلاك الفلمنت':'Filament Usage Log','إجمالي مسجل':'Total Logged','آخر 30 يوم':'Last 30 Days','الأكثر استخدامًا':'Most Used','عمليات':'Operations',
    'المستخدم':'Used','الطول':'Length','المتبقي':'Remaining','الإجمالي':'Total','أول استخدام':'First Used','آخر استخدام':'Last Used','وزن الفاضي':'Empty Spool Weight','الشراء':'Purchase','النوزل':'Nozzle','البيد':'Bed',
    'Assistant':'Assistant','ملخص المخزون':'Inventory Summary','حالة الطابعات':'Printer Status','اقتراحات':'Suggestions','ملخص الألوان':'Color Summary',
    'اختر تقرير جاهز، أو اسألني عن المخزون والطابعات.':'Choose a ready report, or ask me about inventory and printers.',
    'اختر تقرير جاهز أو اكتب سؤالك عن المخزون والطابعات.':'Choose a ready report or ask about inventory and printers.',
    'اكتب طلبك...':'Type your request…','اكتب سؤالك عن المخزون والطابعات.':'Ask about inventory and printers.',
    'الثيمات الجاهزة':'Preset Themes','تخصيص الثيم':'Custom Theme','اللغة':'Language','العربية':'Arabic','الإنجليزية':'English','نسخة احتياطية للبيانات':'Database Backup','تصدير قاعدة البيانات':'Export Database','تحميل نسخة JSON':'Download JSON Backup','تطبيق مباشر':'Live Preview','حفظ الثيم المخصص':'Save Custom Theme','إرجاع الألوان الافتراضية':'Reset Colors',
    'الخلفية':'Background','الشريط الجانبي':'Sidebar','اللوحات':'Panels','البطاقات':'Cards','البطاقات الثانوية':'Secondary Cards','الحدود':'Borders','النص':'Text','النص الثانوي':'Muted Text','اللون الرئيسي':'Primary Accent','اللون الثانوي':'Secondary Accent','الخطر':'Danger','التحذير':'Warning',
    'إشعارات الطباعة':'Print Notifications','تفعيل إشعارات الهاتف':'Enable Phone Notifications','إيقاف إشعارات هذا الجهاز':'Disable Notifications on This Device','إرسال إشعار تجريبي':'Send Test Notification','تنبيه قبل انتهاء الطبعة بـ':'Notify Before Print Ends By','تنبيه عند انتهاء الطبعة':'Notify When Print Finishes','حفظ خيارات التنبيه':'Save Notification Settings',
    'الساعات':'Hours','الدقائق':'Minutes','الوقت المتبقي':'Remaining Time','النهاية المتوقعة':'Estimated Finish','مر':'Elapsed','باقي':'Remaining',
    'إجمالي الفلمنت المتبقي':'Total Filament Remaining','قيمة المتبقي تقريبًا':'Estimated remaining value','حسب حد التنبيه':'Based on alert threshold','حسب الأسعار المسجلة':'Based on recorded prices','يومي':'Daily','الأولوية الأعلى':'Highest priority','متوسط':'Average','الأكثر':'Most','الأقدم':'Oldest',
    'لا توجد بيانات.':'No data.','لا توجد بيانات':'No data','لا توجد طابعات.':'No printers.','لا توجد طابعات':'No printers','ما عندك طابعات مسجلة.':'No printers registered.','ما عندك سبولات.':'No spools.','لا توجد سبولات مطابقة.':'No matching spools.','ما في عمليات استخدام بعد.':'No usage records yet.','أضف أول سبول.':'Add your first spool.','المخزون بحالة جيدة.':'Inventory is healthy.','✓ المخزون بحالة جيدة.':'✓ Inventory is healthy.','✓ ما عندك سبولات منخفضة.':'✓ No low-stock spools.',
    'اللون المكتشف:':'Detected color:','اسم مخصص اختياري':'Optional custom name','بحث داخل السبولات':'Search spools','بحث':'Search','كل شيء':'All'
  }));

  const placeholders = new Map(Object.entries({
    'ابحث بالاسم، الشركة، المادة، اللون، الموقع، رقم الدفعة...':'Search by name, brand, material, color, location, lot…',
    'بحث داخل السبولات':'Search spools',
    'اكتب طلبك...':'Type your request…',
    'اكتب سؤالك عن المخزون والطابعات.':'Ask about inventory and printers.',
    'اسم مخصص للون (اختياري)':'Custom color name (optional)'
  }));

  function exactOrPatterns(input){
    const t=String(input ?? '');
    const s=t.trim();
    if(!s) return t;
    if(dict.has(s)) return t.replace(s,dict.get(s));

    const patterns = [
      [/^(\d+) في المخزن(?: · (\d+) مركب)?$/, (_,a,b)=>`${a} in warehouse${b?` · ${b} loaded`:''}`],
      [/^من (.+)$/, (_,a)=>`of ${a}`],
      [/^(\d+) عمليات$/, (_,a)=>`${a} operations`],
      [/^(\d+) مواد$/, (_,a)=>`${a} materials`],
      [/^(\d+) أنواع$/, (_,a)=>`${a} types`],
      [/^(\d+) سبول$/, (_,a)=>`${a} spools`],
      [/^(\d+) سبول فعال(?:، منها (\d+) مركب على الطابعات)?[.]?$/, (_,a,b)=>`${a} active spools${b?`, ${b} loaded on printers`:''}.`],
      [/^الموجود الآن (.+) · (.+) تقريبًا$/, (_,a,b)=>`Available now ${a} · about ${b}`],
      [/^الآن (.+)$/, (_,a)=>`Now ${a}`],
      [/^بعد الخصم (.+)$/, (_,a)=>`After deduction ${a}`],
      [/^استخدام (.+) · (.+)$/, (_,a,b)=>`Usage ${a} · ${b}`],
      [/^باقي (\d+)س (\d+)د(?: · النهاية (.+))?$/, (_,h,m,e)=>`${h}h ${m}m left${e?` · ends ${e}`:''}`],
      [/^النهاية المتوقعة: (.+)$/, (_,a)=>`Estimated finish: ${a}`],
      [/^تم حفظ الإعدادات[.]?$/, ()=>`Settings saved.`],
      [/^تم حفظ خيارات التنبيه[.]?$/, ()=>`Notification settings saved.`],
      [/^تم تفعيل إشعارات الهاتف[.]?.*$/, ()=>`Phone notifications are enabled.`],
      [/^تم إيقاف إشعارات هذا الجهاز[.]?$/, ()=>`Notifications are disabled on this device.`],
      [/^تم إرسال إشعار تجريبي.*$/, ()=>`Test notification sent.`],
      [/^أفضل اختيار: (.+) \((.+)\) عنده (.+)[.] بعد طبعة (.+) بيبقى تقريبًا (.+)[.].*$/, (_,a,b,c,d,e)=>`Best choice: ${a} (${b}) has ${c}. After a ${d} print, about ${e} will remain.`],
      [/^إجمالي الفلمنت المتبقي (.+)[.]$/, (_,a)=>`Total remaining filament: ${a}.`],
      [/^عندك (\d+) سبول (.+) بإجمالي (.+)[.]$/, (_,a,b,c)=>`You have ${a} ${b} spools totaling ${c}.`],
      [/^القيمة التقريبية للفلمنت المتبقي حسب الأسعار المسجلة: (.+)[.]$/, (_,a)=>`Estimated value of remaining filament based on recorded prices: ${a}.`],
      [/^تم، نقلتك للسبولات وطبقت الترتيب المناسب[.]$/, ()=>`Done. I opened Spools and applied the appropriate sorting.`],
      [/^تم، أعرض لك (.+) فقط[.]$/, (_,a)=>`Done. Showing ${a} only.`],
      [/^(.+): بدون سبول$/, (_,a)=>`${a}: No spool`]
    ];
    for(const [re,fn] of patterns){ if(re.test(s)) return t.replace(s,s.replace(re,fn)); }
    return t;
  }

  function shouldSkipTextNode(node){
    const p=node.parentElement;
    if(!p) return true;
    if(p.closest('script,style,noscript')) return true;
    // Preserve user-entered content. The Notes textarea value is never translated.
    if(p.matches('input,textarea')) return true;
    if(p.closest('.bubble.me')) return true;
    return false;
  }

  function translateNode(root){
    if(document.documentElement.lang!=='en') return;
    if(root.nodeType===Node.TEXT_NODE){
      if(!shouldSkipTextNode(root)){
        const v=exactOrPatterns(root.nodeValue);
        if(v!==root.nodeValue) root.nodeValue=v;
      }
      return;
    }
    if(root.nodeType!==Node.ELEMENT_NODE && root!==document) return;
    const scope=root===document?document:root;
    const walker=document.createTreeWalker(scope,NodeFilter.SHOW_TEXT);
    const nodes=[]; while(walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(n=>{ if(!shouldSkipTextNode(n)){ const v=exactOrPatterns(n.nodeValue); if(v!==n.nodeValue)n.nodeValue=v; } });
    const els=scope.querySelectorAll?.('input[placeholder],textarea[placeholder],select[title],button[title]')||[];
    els.forEach(el=>{
      const p=el.getAttribute('placeholder'); if(p&&placeholders.has(p))el.setAttribute('placeholder',placeholders.get(p));
      const title=el.getAttribute('title'); if(title&&dict.has(title))el.setAttribute('title',dict.get(title));
    });
  }

  function setDirection(){
    if(document.documentElement.lang==='en'){
      document.documentElement.dir='ltr'; document.body.dir='ltr';
    }
  }

  function init(){
    if(document.documentElement.lang!=='en') return;
    setDirection();
    translateNode(document);
    let queued=false;
    const pending=new Set();
    const obs=new MutationObserver(muts=>{
      muts.forEach(m=>{
        if(m.type==='characterData') pending.add(m.target);
        m.addedNodes.forEach(n=>pending.add(n));
      });
      if(queued)return; queued=true;
      requestAnimationFrame(()=>{
        queued=false;
        [...pending].forEach(n=>translateNode(n)); pending.clear();
      });
    });
    obs.observe(document.body,{childList:true,subtree:true,characterData:true});
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>setTimeout(init,0),{once:true});
  else setTimeout(init,0);
})();