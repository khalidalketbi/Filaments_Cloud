(() => {
  const isEn=()=>document.documentElement.lang==='en';
  const ar=/[\u0600-\u06FF]/;

  const exact=new Map(Object.entries({
    // Core navigation / production
    'الإنتاج':'Production',
    'المشروع':'Project',
    'المشروع الحالي':'Current Project',
    'عرض المشاريع':'Project View',
    'جميع المشاريع':'All Projects',
    'كل الطابعات من كل المشاريع في ترتيب واحد':'All printers from all projects in one list',
    'المشاريع':'Projects',
    'إجمالي الطابعات':'Total Printers',
    'الطابعات الآن':'Printers Now',
    'Printers الآن':'Printers Now',
    'تطبع الآن':'Printing Now',
    'يطبع الآن':'Printing',
    'متوقفة':'Paused',
    'متوقف مؤقتًا':'Paused',
    'متوقفة مؤقتًا':'Paused',
    'متوقفة مؤقتاً':'Paused',
    'المتبقي':'Remaining',
    'الRemaining':'Remaining',
    'جاهزة':'Idle',
    'الحالي':'Current',
    'الفلمنت':'Filament',
    'الفلمنت على الطابعات':'Filament on Printers',
    'الفلمنت المتبقي':'Filament Remaining',
    'الجرام المتبقي':'Remaining Grams',
    'اسم الطابعة':'Printer Name',
    'اسم/لون السبول':'Spool Name / Color',
    'الحالة':'Status',
    'ملاحظات':'Notes',
    'بدون Plate':'No Plate',
    'حفظ':'Save',
    '✓ خلصت الطبعة':'✓ Print Finished',
    'خلصت الطبعة ✓':'Print Finished ✓',
    'متابعة الـ Plates':'Plate Tracking',
    'فرز الطابعات':'Sort Printers',
    'فرز Printers':'Sort Printers',
    'الترتيب الأساسي':'Default Order',
    'أقل فلمنت أولاً':'Lowest Filament First',
    'أعلى فلمنت أولاً':'Highest Filament First',
    'أقل وقت أولاً':'Shortest Time First',
    'أكثر وقت أولاً':'Longest Time First',
    'أقل وقت متبقي أولاً':'Shortest Remaining Time First',
    'أعلى وقت متبقي أولاً':'Longest Remaining Time First',

    // Projects
    '+ مشروع جديد':'+ New Project',
    'مشروع جديد':'New Project',
    'تعديل المشروع':'Edit Project',
    'اسم المشروع':'Project Name',
    'عدد الأطقم المطلوبة':'Required Sets',
    'عدد الـ Plates':'Number of Plates',
    'بيانات الـ Plates':'Plate Details',
    'الوزن + وقت الطباعة لكل Plate':'Weight + print time for each Plate',
    'حفظ المشروع':'Save Project',
    'إلغاء':'Cancel',
    'الوزن g':'Weight (g)',
    'الساعات':'Hours',
    'ساعات':'Hours',
    'الدقائق':'Minutes',
    'دقائق':'Minutes',
    'المنجز':'Completed',
    'الأطقم المكتملة':'Completed Sets',
    'نسبة الإنجاز':'Progress',
    'وقت الطباعة المتبقي':'Remaining Print Time',
    'إجمالي أوقات القطع المتبقية':'Total time of remaining parts',
    'حسب هدف المشروع':'Based on project target',
    'التقدم الكلي':'Overall Progress',
    'حالة كل Plate':'Plate Status',
    'المكتمل / المطلوب / الناقص':'Completed / Target / Missing',
    'ملخص المشروع':'Project Summary',
    'القطع المكتملة':'Completed Parts',
    'القطع المتبقية':'Remaining Parts',
    'الإنجاز':'Progress',
    'فتح صفحة الإنتاج':'Open Production',
    'أكثر Plate ناقص':'Most Needed Plate',
    'وقت الطباعة النظري المتبقي':'Theoretical Remaining Print Time',
    'قبل توزيع العمل على الطابعات':'Before distributing work across printers',
    'القطع الزائدة عن الهدف':'Parts Above Target',
    'لا تدخل في نسبة الإنجاز':'Not included in progress',
    'لا يوجد مشروع':'No Project',
    'أنشئ مشروع من صفحة الإنتاج.':'Create a project from the Production page.',
    'أنشئ مشروعك الأول':'Create your first project',
    'اضغط + مشروع جديد':'Tap + New Project',

    // ETA
    'الانتهاء المتوقع للمشروع':'Estimated Project Finish',
    'حسب الطابعات ووقت الطباعة الحالي':'Based on current printers and print times',
    'تعذر الحساب':'Could not calculate',
    'لا توجد طابعات في المشروع':'No printers in this project',
    'لا توجد طابعات صالحة للحساب':'No eligible printers for this calculation',

    // Smart suggestions
    'اقتراح الطباعة الذكي':'Smart Print Suggestion',
    'اقترح شو أطبع':'Suggest What to Print',
    'اضغط الزر للحصول على اقتراح.':'Tap the button to get a suggestion.',
    'جاري الحساب الذكي…':'Calculating smart suggestion…',
    'اختر مشروع أولاً.':'Select a project first.',
    'بيانات المشروع أو الطابعات ناقصة.':'Project or printer data is incomplete.',
    'الخطة المجمعة:':'Grouped Plan:',
    'لا اقتراح':'No Suggestion',
    'الآن':'Now',
    'استخدام':'Usage',
    'يبقى':'Left',
    'بعد Refill يعاد الحساب.':'Recalculate after a refill.',

    // Printer tools
    '+ إضافة طابعة':'+ Add Printer',
    '+ Add Printer':'+ Add Printer',
    'إضافة طابعة':'Add Printer',
    'إضافة الطابعة':'Add Printer',
    'الفلمنت المتبقي g':'Remaining Filament (g)',
    'اكتب اسم الطابعة.':'Enter a printer name.',
    'جاري الإضافة…':'Adding…',
    'تمت إضافة الطابعة.':'Printer added.',
    'هذه الطابعة موجودة في المشروع بالفعل.':'This printer is already in the project.',
    '🗑 حذف الطابعة من المشروع':'🗑 Remove Printer from Project',
    'جاري الحذف…':'Removing…',
    '↻ Refill سبول جديد 1000g':'↻ Refill New 1000g Spool',
    'تم تركيب سبول جديد: 1000g':'New 1000g spool installed',
    'وقت يدوي مفعل':'Manual Time Active',
    'استخدم الوقت اليدوي':'Use Manual Time',
    'إذا تريد وقت مختلف عن وقت الـPlate، أدخل الوقت المتبقي يدويًا. الوقت اليدوي تكون له الأولوية:':'If you need a different time from the Plate time, enter the remaining time manually. Manual time takes priority:',
    'جاري ضبط الوقت اليدوي…':'Setting manual time…',
    'تعذر تحديد الطابعة.':'Could not identify the printer.',
    'أدخل وقتًا متبقيًا أكبر من صفر.':'Enter a remaining time greater than zero.',
    'اختر Plate للطابعة أولًا.':'Select a Plate for the printer first.',
    'موعد الانتهاء المتوقع:':'Estimated finish:',

    // Plate option / states
    'مكتمل':'Completed',
    'مكتمل ✓':'Completed ✓',
    'قيد الطباعة':'Printing',
    'محجوز':'Reserved',
    'مكتمل/محجوز':'Completed/Reserved',
    'أنت تطبع واحدة الآن':'You are printing one now',
    'أخرى قيد الطباعة':'others printing',
    'قيد الطباعة/محجوز':'printing/reserved',
    'U1 تطبع P2 + P3 معاً':'U1 is printing P2 + P3 together',

    // History
    '↻ سجل الطباعة':'↻ Print History',
    'سجل الطباعة':'Print History',
    'سجل الطباعة حسب الطابعة':'Print History by Printer',
    'تحديث':'Refresh',
    'كل الطابعات':'All Printers',
    'كل الـ Plates':'All Plates',
    'إجمالي الطبعات':'Total Prints',
    'إجمالي الفلمنت':'Total Filament',
    'إجمالي الوقت':'Total Time',
    'الوقت:':'Time:',
    'المخطط:':'Planned:',
    'جاري التحميل…':'Loading…',
    'لا يوجد مشروع إنتاج.':'No production project.',

    // General leftovers from previous i18n
    'نسبة تنبيه المخزون المنخفض':'Low-stock alert threshold',
    'نسبة تنبيه المخزون المنخفض %':'Low-stock alert threshold %',
    'بدون موديل':'No model',
    'السبول':'Spool',
    'آخر 4':'Last 4',
    'آخر 30 يوم':'Last 30 Days',
    'اليوم':'Today',
    'قبل 30 يوم':'30 days ago',
    'طابعات':'printers',
    'سبول':'spools',
    'مواد':'materials',
    'واستخدام':'Usage',
    'النهاية':'Finish',
    'مر':'Elapsed',
    'باقي':'Remaining',
    'ص':'AM',
    'م':'PM',
    'لا توجد طابعات.':'No printers.',
    'لا توجد مشاريع.':'No projects.',
    'جاري تحميل جميع المشاريع والطابعات…':'Loading all projects and printers…'
  }));

  const months=new Map(Object.entries({
    'يناير':'January','فبراير':'February','مارس':'March','أبريل':'April','مايو':'May','يونيو':'June',
    'يوليو':'July','أغسطس':'August','سبتمبر':'September','أكتوبر':'October','نوفمبر':'November','ديسمبر':'December'
  }));
  const weekdays=new Map(Object.entries({
    'الأحد':'Sunday','الاثنين':'Monday','الثلاثاء':'Tuesday','الأربعاء':'Wednesday',
    'الخميس':'Thursday','الجمعة':'Friday','السبت':'Saturday'
  }));

  function skip(node){
    const e=node.parentElement;
    if(!e)return true;
    if(e.closest('script,style,noscript'))return true;
    if(e.closest('textarea#notes,.bubble.me,[data-user-content]'))return true;
    if(e.closest('.printer-notes'))return true;
    return false;
  }

  function replaceDateWords(x){
    for(const [a,b] of weekdays)x=x.split(a).join(b);
    for(const [a,b] of months)x=x.split(a).join(b);
    return x;
  }

  function tr(raw){
    let s=String(raw??'');
    if(!ar.test(s))return s;
    const t=s.trim();
    if(exact.has(t))return s.replace(t,exact.get(t));
    let x=t;

    // Normalize strings that may already be partially translated by the base i18n pass.
    if(/إذا تريد وقت مختلف/.test(x)){
      x='If you need a different time from the Plate time, enter the remaining time manually. Manual time takes priority:';
      return s.replace(t,x);
    }
    if(/يجمع نفس .*Plate/.test(x) || /أكبر عدد ممكن من/.test(x) && /Plate/.test(x)){
      x='Groups the same Plate on as many printers as possible, then moves to the next Plate while respecting filament and restrictions.';
      return s.replace(t,x);
    }
    if(/^(?:و)?يبقى\s*≈\s*([\d.]+)g?$/.test(x)){
      x=x.replace(/^(?:و)?يبقى\s*≈\s*([\d.]+)g?$/,'Left ≈ $1g');
      return s.replace(t,x);
    }
    if(/حوالي/.test(x) && /hours from now/i.test(x)){
      x=x.replace(/\s*حوالي\s*/g,' About ').replace(/\s+/g,' ').trim();
      if(/^([\d.]+)\s+About\s+hours from now$/i.test(x)){
        x=x.replace(/^([\d.]+)\s+About\s+hours from now$/i,'About $1 hours from now');
      }
      return s.replace(t,x);
    }
    x=x
      .replace(/الRemaining/g,'Remaining')
      .replace(/\bمتوقفة مؤقت[ًااً]+\b/g,'Paused');

    // High-value complete dynamic patterns
    const patterns=[
      [/^(\d+) تطبع الآن · ([\d.]+) g على الطابعات$/,(_,a,g)=>`${a} printing now · ${g}g on printers`],
      [/^(\d+) من (\d+) شغالة$/,(_,a,b)=>`${a} of ${b} running`],
      [/^من (\d+) قطعة$/,(_,a)=>`of ${a} parts`],
      [/^من (\d+) أطقم$/,(_,a)=>`of ${a} sets`],
      [/^بعد الحالية يبقى (\d+) قطعة$/,(_,a)=>`${a} parts remain after current prints`],
      [/^(\d+) Plates · الهدف (\d+) أطقم$/,(_,a,b)=>`${a} Plates · target ${b} sets`],
      [/^(\d+) مكتمل · (\d+) متبقي$/,(_,a,b)=>`${a} completed · ${b} remaining`],
      [/^(\d+)\/(\d+) مكتمل$/,(_,a,b)=>`${a}/${b} completed`],
      [/^ناقص (\d+)$/,(_,a)=>`Missing ${a}`],
      [/^(\d+) قطعة$/,(_,a)=>`${a} parts`],
      [/^([\d.]+)g مطلوبة$/,(_,a)=>`${a}g required`],
      [/^(\d+)س\s*(\d+)د$/,(_,h,m)=>`${h}h ${m}m`],
      [/^(\d+)د\s*(\d+)ث$/,(_,m,sec)=>`${m}m ${sec}s`],
      [/^(\d+)س\s*(\d+)د\s*(\d+)ث$/,(_,h,m,sec)=>`${h}h ${m}m ${sec}s`],
      [/^المتبقي:\s*(.+?)(?:\s*·\s*ينتهي\s*(.+))?$/,(_,a,b)=>`Remaining: ${a}${b?` · ends ${b}`:''}`],
      [/^موعد الانتهاء المتوقع:\s*(.+)$/,(_,a)=>`Estimated finish: ${a}`],
      [/^حوالي ([\d.]+) ساعة من الآن$/,(_,a)=>`About ${a} hours from now`],
      [/^([\d.]+)\s+حوالي\s+hours from now$/i,(_,a)=>`About ${a} hours from now`],
      [/^يبقى\s*≈\s*([\d.]+)g?$/,(_,a)=>`Left ≈ ${a}g`],
      [/^حوالي (\d+) يوم و(\d+) ساعة$/,(_,d,h)=>`About ${d}d ${h}h`],
      [/^Plate (\d+) لا توجد له طابعة متاحة$/,(_,p)=>`No eligible printer is available for Plate ${p}`],
      [/^موجود (\d+)\/(\d+) • باقي (\d+)$/,(_,a,b,c)=>`Available ${a}/${b} · ${c} remaining`],
      [/^موجود (\d+)\/(\d+) • أنت تطبع واحدة الآن$/,(_,a,b)=>`Available ${a}/${b} · you are printing one now`],
      [/^موجود (\d+)\/(\d+) • (\d+) أخرى قيد الطباعة$/,(_,a,b,c)=>`Available ${a}/${b} · ${c} others printing`],
      [/^موجود (\d+)\/(\d+) • (\d+) قيد الطباعة\/محجوز • باقي (\d+)$/,(_,a,b,c,d)=>`Available ${a}/${b} · ${c} printing/reserved · ${d} remaining`],
      [/^مكتمل\/محجوز (\d+)\/(\d+)$/,(_,a,b)=>`Completed/Reserved ${a}/${b}`],
      [/^تراجع إلى ([\d.]+)g$/,(_,g)=>`Undo to ${g}g`],
      [/^تم التراجع ورجعت القيمة إلى ([\d.]+)g$/,(_,g)=>`Undone. Restored to ${g}g`],
      [/^تم اعتماد الوقت اليدوي\s*(.*)$/,(_,v)=>`Manual time applied ${v}`],
      [/^الوقت:\s*(.+)$/,(_,v)=>`Time: ${v}`],
      [/^المخطط:\s*(.+)$/,(_,v)=>`Planned: ${v}`],
      [/^\+(\d+) زيادة$/,(_,v)=>`+${v} extra`],
      [/^(\d+) متبقي$/,(_,v)=>`${v} remaining`]
    ];
    for(const [re,fn] of patterns){
      if(re.test(x)){x=x.replace(re,fn);break;}
    }

    // Phrase replacements for mixed / compound dynamic strings
    const reps=[
      ['كل الطابعات من كل المشاريع في ترتيب واحد','All printers from all projects in one list'],
      ['الإنتاج','Production'],
      ['متوقفة مؤقتًا','Paused'],
      ['متوقفة مؤقتاً','Paused'],
      ['المتبقي','Remaining'],
      ['حوالي','About'],
      ['معاً','together'],
      ['معًا','together'],
      ['يجمع نفس الـPlate على أكبر عدد ممكن من الطابعات، ثم ينتقل للـPlate التالي مع مراعاة الفلمنت والقيود','Groups the same Plate on as many printers as possible, then moves to the next Plate while respecting filament and restrictions'],
      ['يجمع نفس الـPlate','Groups the same Plate'],
      ['أكبر عدد ممكن من','as many'],
      ['ثم ينتقل للـPlate التالي','then moves to the next Plate'],
      ['مع مراعاة','while respecting'],
      ['والقيود','and restrictions'],
      ['ولقيود','and restrictions'],
      ['البداية تكون Plate','Start with Plate'],
      ['على','on'],
      ['طابعة قدر الإمكان','printers where possible'],
      ['النظام يكمل نفس الـPlate أولاً، وبعدها ينتقل للي بعده حسب النقص والفلمنت.','The system finishes the same Plate first, then moves to the next based on shortage and filament.'],
      ['لا توجد مهمة ناقصة تناسب الفلمنت المتبقي أو صلاحية الطابعة','No remaining job fits the available filament or printer eligibility'],
      ['المتاح المتوقع','Expected available'],
      ['وقت إضافي','Additional time'],
      ['مجمّع مع نفس الـPlate قدر الإمكان','Grouped with the same Plate where possible'],
      ['يبقى بدون توزيع من السبولات الحالية:','Unassigned with current spools:'],
      ['بعد انتهاء Plate','After Plate'],
      ['تقديري إذا استمر التشغيل بدون توقف','Estimate if printing continues without interruption'],
      ['حسب الطابعات ووقت الطباعة الحالي','Based on current printers and print times'],
      ['إجمالي أوقات القطع المتبقية','Total time of remaining parts'],
      ['إجمالي أوقات القطع','Total part times'],
      ['التقدم الكلي','Overall Progress'],
      ['حسب هدف المشروع','Based on project target'],
      ['وأنت تطبع واحدة الآن','and you are printing one now'],
      ['إجمالي','Total'],
      ['أطقم','sets'],
      ['أوقات القطع','part times'],
      ['ساعة','hours'],
      ['يوم','days'],
      ['من الآن','from now'],
      ['قطعة','parts'],
      ['شغالة','running'],
      ['الهدف','target'],
      ['مطلوبة','required'],
      ['مكتمل','Completed'],
      ['متبقي','Remaining'],
      ['الموجود','Available'],
      ['موجود','Available'],
      ['باقي','Remaining'],
      ['قيد الطباعة/محجوز','printing/reserved'],
      ['قيد الطباعة','printing'],
      ['محجوز','reserved'],
      ['أنت تطبع واحدة الآن','you are printing one now'],
      ['أخرى','others'],
      ['ينتهي','ends'],
      ['تطبع الآن','printing now'],
      ['يطبع الآن','printing'],
      ['على الطابعات','on printers'],
      ['اسم/لون السبول','Spool Name / Color'],
      ['الجرام المتبقي','Remaining Grams'],
      ['الفلمنت المتبقي','Filament Remaining'],
      ['المشروع الحالي','Current Project'],
      ['المشروع','Project'],
      ['فرز الطابعات','Sort Printers'],
      ['الطابعات','Printers'],
      ['الفلمنت','Filament'],
      ['الحالي','Current'],
      ['تطبع','Printing'],
      ['وقت الطباعة','Print Time'],
      ['الوزن','Weight'],
      ['المنجز','Completed'],
      ['الساعات','Hours'],
      ['الدقائق','Minutes'],
      ['ساعات','Hours'],
      ['دقائق','Minutes'],
      ['زيادة','extra'],
      ['فقط:','Only:'],
      ['جاري الحفظ…','Saving…'],
      ['جاري حفظ الطابعة…','Saving printer…'],
      ['تم حفظ الطابعة','Printer saved'],
      ['تم الحفظ','Saved'],
      ['تعذر الحفظ:','Could not save:'],
      ['خطأ:','Error:'],
      ['جاري تعبئة السبول…','Refilling spool…'],
      ['فشل التحديث:','Update failed:'],
      ['فشل التراجع:','Undo failed:'],
      ['فشل الإضافة:','Add failed:'],
      ['فشل الحذف:','Remove failed:'],
      ['تعذر الحساب:','Could not calculate:'],
      ['تعذر حفظ الوقت:','Could not save time:']
    ];
    for(const [a,b] of reps)x=x.split(a).join(b);

    // Date/time units and Arabic calendar words
    x=replaceDateWords(x)
      .replace(/(\d{1,2}):(\d{2})\s*ص/g,'$1:$2 AM')
      .replace(/(\d{1,2}):(\d{2})\s*م/g,'$1:$2 PM')
      .replace(/(\d+)س/g,'$1h')
      .replace(/(\d+)د/g,'$1m')
      .replace(/(\d+)ث/g,'$1s');

    return s.replace(t,x);
  }

  function translateAttrs(root){
    root.querySelectorAll?.('input[placeholder],textarea[placeholder],[title],[aria-label]').forEach(el=>{
      if(el.matches('.printer-notes,[data-user-content]'))return;
      for(const attr of ['placeholder','title','aria-label']){
        const v=el.getAttribute(attr);
        if(!v||!ar.test(v))continue;
        el.setAttribute(attr,tr(v));
      }
    });
  }

  function sweep(root=document.body){
    if(!isEn()||!root)return;
    const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
    const nodes=[];while(w.nextNode())nodes.push(w.currentNode);
    for(const node of nodes){
      if(skip(node))continue;
      const v=tr(node.nodeValue);
      if(v!==node.nodeValue)node.nodeValue=v;
    }

    // Translate UI options, but preserve user-created project names.
    root.querySelectorAll?.('option').forEach(o=>{
      const sel=o.closest('select');
      const projectSelector=sel?.matches('#projectSelect,#pdashProject,#globalProjectSelect,#prodHistoryProject');
      if(projectSelector && o.value && o.value!=='__all__')return;
      const v=tr(o.textContent);
      if(v!==o.textContent)o.textContent=v;
    });
    translateAttrs(root);
  }

  let raf=0;
  function schedule(){
    if(raf||!isEn())return;
    raf=requestAnimationFrame(()=>{raf=0;sweep(document.body);});
  }

  function init(){
    sweep();
    new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['placeholder','title','aria-label']});
    [100,250,500,1000,2000,4000].forEach(ms=>setTimeout(schedule,ms));
    setInterval(schedule,1500);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();