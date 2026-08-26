(() => {
  function hideManualTime(root=document){
    const candidates=[...root.querySelectorAll('div,section,fieldset,label')];
    for(const el of candidates){
      const t=(el.textContent||'').replace(/\s+/g,' ').trim();
      if(!t.includes('الوقت المتبقي للطباعة')) continue;
      const hasTimeInputs=el.querySelector('input[type="number"], input');
      if(hasTimeInputs){el.style.display='none';}
    }
  }
  const run=()=>hideManualTime(document);
  window.addEventListener('load',run,{once:true});
  document.addEventListener('click',()=>setTimeout(run,50),true);
  new MutationObserver(()=>run()).observe(document.documentElement,{subtree:true,childList:true});
  setTimeout(run,500);
})();
