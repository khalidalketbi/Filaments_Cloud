(() => {
  const STORAGE_KEY = 'productionPrinterSortMode';
  const DEFAULT_ORDER = ['A1','A2','M1','M2','M3','M4','M5'];
  let applying = false;
  let observer = null;
  let ensureTimer = null;

  function injectStyle(){
    if(document.getElementById('printerSortStyle')) return;
    const s=document.createElement('style');
    s.id='printerSortStyle';
    s.textContent=`
      #productionPage .printer-sort-wrap{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:8px 0 12px}
      #productionPage .printer-sort-wrap label{font-size:12px;color:var(--muted)}
      #productionPage .printer-sort-select{min-height:40px;min-width:190px;padding:8px 12px;border:1px solid var(--line);border-radius:10px;background:var(--card2);color:inherit}
    `;
    document.head.appendChild(s);
  }

  function getPrinterName(card){
    return (card.querySelector('.printer-name')?.value || card.querySelector('.prod-num')?.textContent || '').trim();
  }

  function getFilament(card){
    const input=card.querySelector('.remaining-g');
    if(input) return Number(input.value)||0;
    const txt=card.querySelector('.printer-main-stat strong')?.textContent||'0';
    return Number(txt.replace(/[^0-9.\-]/g,''))||0;
  }

  function getTimeSeconds(card){
    const txt=(card.querySelector('.printer-timer')?.textContent||'').trim();
    const m=txt.match(/(\d{1,3}):(\d{2}):(\d{2})/);
    if(!m) return null;
    return Number(m[1])*3600 + Number(m[2])*60 + Number(m[3]);
  }

  function compareDefault(a,b){
    const an=getPrinterName(a), bn=getPrinterName(b);
    const ai=DEFAULT_ORDER.indexOf(an), bi=DEFAULT_ORDER.indexOf(bn);
    if(ai!==-1 || bi!==-1){
      const ax=ai===-1?999:ai, bx=bi===-1?999:bi;
      if(ax!==bx) return ax-bx;
    }
    return an.localeCompare(bn,undefined,{numeric:true,sensitivity:'base'});
  }

  function compareForMode(mode,a,b){
    if(mode==='filament-asc') return getFilament(a)-getFilament(b) || compareDefault(a,b);
    if(mode==='filament-desc') return getFilament(b)-getFilament(a) || compareDefault(a,b);
    if(mode==='time-asc'){
      const at=getTimeSeconds(a), bt=getTimeSeconds(b);
      if(at==null && bt==null) return compareDefault(a,b);
      if(at==null) return 1;
      if(bt==null) return -1;
      return at-bt || compareDefault(a,b);
    }
    if(mode==='time-desc'){
      const at=getTimeSeconds(a), bt=getTimeSeconds(b);
      if(at==null && bt==null) return compareDefault(a,b);
      if(at==null) return 1;
      if(bt==null) return -1;
      return bt-at || compareDefault(a,b);
    }
    return compareDefault(a,b);
  }

  function applySort(){
    if(applying) return;
    const grid=document.getElementById('prodPrinterGrid');
    const select=document.getElementById('printerSortSelect');
    if(!grid||!select) return;

    const current=[...grid.querySelectorAll(':scope > .prod-printer-card')];
    if(current.length<2) return;

    const mode=select.value||'default';
    const sorted=[...current].sort((a,b)=>compareForMode(mode,a,b));
    const changed=sorted.some((card,i)=>card!==current[i]);
    if(!changed) return;

    applying=true;
    try{
      const frag=document.createDocumentFragment();
      sorted.forEach(card=>frag.appendChild(card));
      grid.appendChild(frag);
    } finally {
      applying=false;
    }
  }

  function ensureControls(){
    injectStyle();
    const grid=document.getElementById('prodPrinterGrid');
    if(!grid) return false;

    if(!document.getElementById('printerSortSelect')){
      const wrap=document.createElement('div');
      wrap.className='printer-sort-wrap';
      wrap.innerHTML=`<label for="printerSortSelect">فرز الطابعات</label><select id="printerSortSelect" class="printer-sort-select"><option value="default">الترتيب الأساسي</option><option value="filament-asc">أقل فلمنت أولاً</option><option value="filament-desc">أعلى فلمنت أولاً</option><option value="time-asc">أقل وقت متبقي أولاً</option><option value="time-desc">أعلى وقت متبقي أولاً</option></select>`;
      grid.parentElement?.insertBefore(wrap,grid);
      const select=wrap.querySelector('select');
      select.value=localStorage.getItem(STORAGE_KEY)||'default';
      select.addEventListener('change',()=>{
        localStorage.setItem(STORAGE_KEY,select.value);
        applySort();
      });
    }

    applySort();
    return true;
  }

  function attachObserver(){
    const grid=document.getElementById('prodPrinterGrid');
    if(!grid || observer) return;
    let pending=false;
    observer=new MutationObserver(()=>{
      if(applying || pending) return;
      pending=true;
      requestAnimationFrame(()=>{
        pending=false;
        ensureControls();
      });
    });
    observer.observe(grid,{childList:true});
  }

  function boot(){
    injectStyle();
    let tries=0;
    ensureTimer=setInterval(()=>{
      tries++;
      if(ensureControls()) attachObserver();
      if(tries>120 && document.getElementById('prodPrinterGrid')){
        clearInterval(ensureTimer);
        ensureTimer=null;
      }
    },500);

    setInterval(()=>{
      const mode=document.getElementById('printerSortSelect')?.value;
      if(mode==='time-asc'||mode==='time-desc') applySort();
    },1000);
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();
})();