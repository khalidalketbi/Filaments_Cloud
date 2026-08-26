(() => {
  function findEditDialog(){
    const dialogs=[...document.querySelectorAll('.dialog,[role="dialog"],.modal')];
    return dialogs.find(el=>{
      const title=(el.querySelector('h1,h2,h3')?.textContent||'').replace(/\s+/g,' ').trim();
      return title.includes('تعديل الطابعة');
    })||null;
  }

  function hideManualTime(){
    const dialog=findEditDialog();
    if(!dialog)return;
    const candidates=[...dialog.querySelectorAll('div,section,fieldset,label')];
    for(const el of candidates){
      const t=(el.textContent||'').replace(/\s+/g,' ').trim();
      if(!t.includes('الوقت المتبقي للطباعة'))continue;
      if(el.querySelector('input'))el.style.display='none';
    }
  }

  const run=()=>hideManualTime();
  window.addEventListener('load',run,{once:true});
  document.addEventListener('click',()=>setTimeout(run,50),true);
  new MutationObserver(()=>run()).observe(document.documentElement,{subtree:true,childList:true});
  setTimeout(run,500);
})();
