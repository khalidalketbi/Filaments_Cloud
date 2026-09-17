(() => {
  function applyCard(card){
    if(!card) return;
    const btn=card.querySelector('.printer-finish');
    if(!btn) return;
    const persistedPrinting=card.classList.contains('printing');
    const plate=card.querySelector('.plate-no')?.value;
    const enabled=persistedPrinting && !!plate;
    btn.disabled=!enabled;
    btn.setAttribute('aria-disabled',String(!enabled));
    btn.title=enabled?'تسجيل انتهاء الطبعة':'يتفعل بعد حفظ حالة الطابعة: تطبع الآن';
  }

  function applyAll(){
    document.querySelectorAll('#prodPrinterGrid .prod-printer-card').forEach(applyCard);
  }

  function boot(){
    applyAll();
    const root=document.getElementById('productionPage')||document.body;
    const observer=new MutationObserver(()=>applyAll());
    observer.observe(root,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
    document.addEventListener('change',e=>{
      if(e.target?.matches?.('#prodPrinterGrid .printer-status, #prodPrinterGrid .plate-no')){
        applyCard(e.target.closest('.prod-printer-card'));
      }
    });
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();