(() => {
  const norm = s => String(s||'').trim().toLowerCase();
  function isColorQuery(raw){
    const q=norm(raw);
    return !!q && (q.includes('لون') || q.includes('color') || q.includes('#'));
  }
  function bind(){
    const send=document.getElementById('assistantSend');
    if(send && !send.dataset.xpGuard){
      send.dataset.xpGuard='1';
      send.addEventListener('click',e=>{
        const raw=document.getElementById('assistantInput')?.value||'';
        if(isColorQuery(raw)){ e.preventDefault(); e.stopImmediatePropagation(); }
      },true);
    }
    const input=document.getElementById('assistantInput');
    if(input && !input.dataset.xpGuard){
      input.dataset.xpGuard='1';
      input.addEventListener('keydown',e=>{
        if(e.key==='Enter' && isColorQuery(input.value)){ e.preventDefault(); e.stopImmediatePropagation(); }
      },true);
    }
    document.querySelectorAll('[data-theme-choice]').forEach(b=>{
      if(b.dataset.xpPresetGuard)return;b.dataset.xpPresetGuard='1';
      b.addEventListener('click',()=>{
        ['bg','side','panel','card','card2','line','text','muted','accent','accent2','danger','warn'].forEach(k=>document.documentElement.style.removeProperty(`--${k}`));
      },true);
    });
  }
  bind();
  new MutationObserver(bind).observe(document.body,{childList:true,subtree:true});
})();