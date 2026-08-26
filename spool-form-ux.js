(() => {
  const $ = id => document.getElementById(id);

  function addStyle(){
    if ($('spoolFormUxStyle')) return;
    const s=document.createElement('style');
    s.id='spoolFormUxStyle';
    s.textContent=`
      #spoolForm .form-grid{grid-template-columns:repeat(2,minmax(0,1fr));}
      #spoolForm .spool-basic-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:11px;grid-column:1/-1}
      #spoolForm .spool-advanced{grid-column:1/-1;border:1px solid var(--line);background:var(--card2);border-radius:14px;overflow:hidden;margin-top:2px}
      #spoolForm .spool-advanced summary{list-style:none;cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:13px 14px;font-weight:800;color:var(--text);user-select:none}
      #spoolForm .spool-advanced summary::-webkit-details-marker{display:none}
      #spoolForm .spool-advanced summary:after{content:'⌄';font-size:20px;color:var(--muted);transition:transform .2s ease}
      #spoolForm .spool-advanced[open] summary:after{transform:rotate(180deg)}
      #spoolForm .spool-advanced .advanced-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:11px;padding:0 14px 14px;border-top:1px solid var(--line)}
      #spoolForm .spool-advanced .advanced-grid>label{margin-top:12px}
      #spoolForm .spool-advanced .advanced-grid .full{grid-column:1/-1}
      .pro-kpi[data-kpi-go]{cursor:pointer;transition:transform .15s ease,border-color .15s ease,box-shadow .15s ease}
      .pro-kpi[data-kpi-go]:hover{transform:translateY(-2px);border-color:var(--accent);box-shadow:0 10px 26px #0003}
      .pro-kpi[data-kpi-go]:active{transform:translateY(0)}
      @media(max-width:760px){#spoolForm .form-grid,#spoolForm .spool-basic-grid,#spoolForm .spool-advanced .advanced-grid{grid-template-columns:1fr}}
    `;
    document.head.appendChild(s);
  }

  function restructureSpoolForm(){
    const form=$('spoolForm');
    if(!form || form.dataset.simpleAdvanced==='1') return;
    const grid=form.querySelector('.form-grid');
    if(!grid) return;

    const basicIds=['name','brand','material','color','colorHex','colorHexText','totalWeight','remainingWeight'];
    const advancedIds=['multiColor','emptySpoolWeight','diameter','density','price','locationName','lotNr','articleNumber','purchaseDate','nozzleMin','nozzleMax','bedMin','bedMax','notes','favorite','archived'];
    const labelFor=id=>$(id)?.closest('label') || null;

    const basic=document.createElement('div');
    basic.className='spool-basic-grid';
    const seen=new Set();
    basicIds.forEach(id=>{
      const lab=labelFor(id);
      if(lab && !seen.has(lab)){ seen.add(lab); basic.appendChild(lab); }
    });

    const details=document.createElement('details');
    details.className='spool-advanced';
    details.innerHTML='<summary><span>خيارات متقدمة</span><small class="muted">السعر، الموقع، Lot، SKU، الحرارة والمزيد</small></summary><div class="advanced-grid"></div>';
    const adv=details.querySelector('.advanced-grid');
    advancedIds.forEach(id=>{
      const lab=labelFor(id);
      if(lab && !seen.has(lab)){ seen.add(lab); adv.appendChild(lab); }
    });

    [...grid.children].forEach(child=>{
      if(child.tagName==='LABEL' && !seen.has(child)){ seen.add(child); adv.appendChild(child); }
    });

    grid.replaceChildren(basic,details);
    form.dataset.simpleAdvanced='1';

    const modal=$('spoolModal');
    if(modal){
      let wasOpen=modal.classList.contains('show');
      const modalObs=new MutationObserver(()=>{
        const isOpen=modal.classList.contains('show');
        if(isOpen && !wasOpen) details.open=false;
        wasOpen=isOpen;
      });
      modalObs.observe(modal,{attributes:true,attributeFilter:['class']});
    }
  }

  function linkActivePrinters(){
    const card=$('proActivePrinters')?.closest('.pro-kpi');
    if(!card || card.dataset.kpiGo) return;
    card.dataset.kpiGo='printers';
    card.tabIndex=0;
    card.setAttribute('role','button');
    card.setAttribute('aria-label','فتح صفحة الطابعات');
    const go=()=>document.querySelector('.nav button[data-page="printers"]')?.click();
    card.addEventListener('click',go);
    card.addEventListener('keydown',e=>{
      if(e.key==='Enter'||e.key===' '){ e.preventDefault(); go(); }
    });
  }

  function translateAdvancedSummary(){
    const d=document.querySelector('#spoolForm .spool-advanced');
    if(!d) return;
    const span=d.querySelector('summary span');
    const small=d.querySelector('summary small');
    const en=document.documentElement.lang==='en';
    const title=en?'Advanced Options':'خيارات متقدمة';
    const sub=en?'Price, location, Lot, SKU, temperatures and more':'السعر، الموقع، Lot، SKU، الحرارة والمزيد';
    if(span && span.textContent!==title) span.textContent=title;
    if(small && small.textContent!==sub) small.textContent=sub;
  }

  function init(){
    addStyle();
    restructureSpoolForm();
    linkActivePrinters();
    translateAdvancedSummary();

    // Watch only until dynamically rendered dashboard/form elements exist.
    let raf=0;
    const obs=new MutationObserver(()=>{
      if(raf) return;
      raf=requestAnimationFrame(()=>{
        raf=0;
        restructureSpoolForm();
        linkActivePrinters();
        translateAdvancedSummary();
        if($('spoolForm')?.dataset.simpleAdvanced==='1' && $('proActivePrinters')?.closest('.pro-kpi')?.dataset.kpiGo){
          obs.disconnect();
        }
      });
    });
    obs.observe(document.body,{childList:true,subtree:true});

    setTimeout(()=>obs.disconnect(),10000);
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();