(() => {
  const $ = id => document.getElementById(id);
  let syncing = false;

  function fire(el){
    if(!el) return;
    el.dispatchEvent(new Event('input',{bubbles:true}));
    el.dispatchEvent(new Event('change',{bubbles:true}));
  }

  function goSpools(){
    const page=document.querySelector('.nav button[data-page="spools"]');
    if(page && !page.classList.contains('active')) page.click();
  }

  function syncFromGlobal(){
    if(syncing) return;
    const g=$('globalSearch'), s=$('spoolSearch'); if(!g||!s)return;
    syncing=true;
    s.value=g.value;
    // A manual text search should not remain trapped by an old color selection.
    const c=$('colorSearch'); if(c && c.value && g.value.trim()) c.value='';
    syncing=false;
    goSpools();
    fire(s);
  }

  function syncFromSpool(){
    if(syncing) return;
    const g=$('globalSearch'), s=$('spoolSearch'); if(!g||!s)return;
    syncing=true; g.value=s.value; syncing=false;
    // Main app owns rendering through spoolSearch.oninput; schedule a second input
    // in case another extension changed the DOM during the first event.
    requestAnimationFrame(()=>{ if(s.value===g.value) s.dispatchEvent(new Event('input',{bubbles:true})); });
  }

  function bind(){
    const g=$('globalSearch'), s=$('spoolSearch');
    if(g && g.dataset.searchFix!=='1'){
      g.dataset.searchFix='1';
      g.addEventListener('input',syncFromGlobal);
      g.addEventListener('search',syncFromGlobal);
      g.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();syncFromGlobal();}});
    }
    if(s && s.dataset.searchFix!=='1'){
      s.dataset.searchFix='1';
      s.addEventListener('input',syncFromSpool);
      s.addEventListener('search',syncFromSpool);
    }
    return !!(g&&s);
  }

  function init(){
    bind();
    const obs=new MutationObserver(()=>bind());
    obs.observe(document.body,{childList:true,subtree:true});
    setTimeout(()=>obs.disconnect(),20000);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true}); else init();
})();