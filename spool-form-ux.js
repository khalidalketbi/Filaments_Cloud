(() => {
  const $ = id => document.getElementById(id);
  const validHex = v => /^#[0-9a-f]{6}$/i.test(String(v || ''));

  const COLORS = [
    ['Black','#000000'],['Charcoal','#36454F'],['Dark Gray','#555555'],['Gray','#808080'],['Silver','#C0C0C0'],['Light Gray','#D3D3D3'],['White','#FFFFFF'],
    ['Red','#FF0000'],['Dark Red','#8B0000'],['Maroon','#800000'],['Coral','#FF7F50'],['Salmon','#FA8072'],
    ['Orange','#FFA500'],['Dark Orange','#FF8C00'],['Gold','#FFD700'],['Yellow','#FFFF00'],['Cream','#FFFDD0'],['Beige','#F5F5DC'],['Tan','#D2B48C'],['Brown','#8B4513'],
    ['Lime','#00FF00'],['Green','#008000'],['Dark Green','#006400'],['Olive','#808000'],['Mint','#98FF98'],
    ['Cyan','#00FFFF'],['Teal','#008080'],['Turquoise','#40E0D0'],['Light Blue','#ADD8E6'],['Sky Blue','#87CEEB'],['Blue','#0000FF'],['Royal Blue','#4169E1'],['Dark Blue','#00008B'],['Navy','#000080'],
    ['Purple','#800080'],['Violet','#8F00FF'],['Lavender','#E6E6FA'],['Magenta','#FF00FF'],['Pink','#FFC0CB'],['Hot Pink','#FF69B4'],['Rose','#FF007F']
  ].map(([name,hex])=>({name,hex,r:parseInt(hex.slice(1,3),16),g:parseInt(hex.slice(3,5),16),b:parseInt(hex.slice(5,7),16)}));

  function colorName(hex){
    if(!validHex(hex)) return '';
    const r=parseInt(hex.slice(1,3),16), g=parseInt(hex.slice(3,5),16), b=parseInt(hex.slice(5,7),16);
    let best=COLORS[0], bestD=Infinity;
    for(const c of COLORS){
      // Weighted RGB distance; closer to perceived visual difference than plain RGB.
      const dr=r-c.r,dg=g-c.g,db=b-c.b;
      const d=0.30*dr*dr+0.59*dg*dg+0.11*db*db;
      if(d<bestD){bestD=d;best=c;}
    }
    return best.name;
  }

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
      #spoolForm .auto-color-name{display:block;margin-top:6px;font-size:11px;color:var(--muted)}
      .pro-kpi[data-kpi-go]{cursor:pointer;transition:transform .15s ease,border-color .15s ease,box-shadow .15s ease}
      .pro-kpi[data-kpi-go]:hover{transform:translateY(-2px);border-color:var(--accent);box-shadow:0 10px 26px #0003}
      .pro-kpi[data-kpi-go]:active{transform:translateY(0)}
      @media(max-width:760px){#spoolForm .form-grid,#spoolForm .spool-basic-grid,#spoolForm .spool-advanced .advanced-grid{grid-template-columns:1fr}}
    `;
    document.head.appendChild(s);
  }

  function setupAutoColor(){
    const picker=$('colorHex'), text=$('colorHexText'), name=$('color');
    if(!picker || !text || !name || picker.dataset.autoColorReady==='1') return;
    picker.dataset.autoColorReady='1';

    const colorLabel=picker.closest('label');
    let hint=colorLabel?.querySelector('.auto-color-name');
    if(colorLabel && !hint){
      hint=document.createElement('small');
      hint.className='auto-color-name';
      colorLabel.appendChild(hint);
    }

    const update=(hex,overwrite=true)=>{
      if(!validHex(hex)) return;
      const detected=colorName(hex.toUpperCase());
      if(overwrite || !name.value.trim()) name.value=detected;
      if(hint) hint.textContent=document.documentElement.lang==='en' ? `Detected: ${detected}` : `اللون المكتشف: ${detected}`;
    };

    picker.addEventListener('input',()=>update(picker.value,true));
    text.addEventListener('input',()=>{if(validHex(text.value)) update(text.value,true)});

    // Guarantee a color name exists before the existing save handler runs.
    $('spoolForm')?.addEventListener('submit',()=>{
      const hex=validHex(text.value)?text.value:picker.value;
      if(!name.value.trim()) name.value=colorName(hex);
    },true);

    // Existing records keep their custom color names until the picker changes.
    update(validHex(text.value)?text.value:picker.value,!name.value.trim());
  }

  function restructureSpoolForm(){
    const form=$('spoolForm');
    if(!form || form.dataset.simpleAdvanced==='1') return;
    const grid=form.querySelector('.form-grid');
    if(!grid) return;

    // Color name is intentionally Advanced; selecting the actual color is enough for normal use.
    const basicIds=['name','brand','material','colorHex','colorHexText','totalWeight','remainingWeight'];
    const advancedIds=['color','multiColor','emptySpoolWeight','diameter','density','price','locationName','lotNr','articleNumber','purchaseDate','nozzleMin','nozzleMax','bedMin','bedMax','notes','favorite','archived'];
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

    const colorNameInput=$('color');
    const colorNameLabel=colorNameInput?.closest('label');
    if(colorNameLabel){
      const textNode=[...colorNameLabel.childNodes].find(n=>n.nodeType===Node.TEXT_NODE && n.textContent.trim());
      if(textNode) textNode.textContent=document.documentElement.lang==='en'?'Color Name (optional)':'اسم اللون (اختياري)';
      colorNameInput.placeholder=document.documentElement.lang==='en'?'Auto detected; optional custom name':'يتم تحديده تلقائيًا؛ اكتب اسمًا خاصًا فقط إذا رغبت';
    }

    const modal=$('spoolModal');
    if(modal){
      let wasOpen=modal.classList.contains('show');
      const modalObs=new MutationObserver(()=>{
        const isOpen=modal.classList.contains('show');
        if(isOpen && !wasOpen){
          details.open=false;
          requestAnimationFrame(()=>setupAutoColor());
        }
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
    const hint=d.parentElement?.querySelector('.auto-color-name');
    if(hint && validHex($('colorHexText')?.value||$('colorHex')?.value)){
      const detected=colorName(validHex($('colorHexText')?.value)?$('colorHexText').value:$('colorHex').value);
      hint.textContent=en?`Detected: ${detected}`:`اللون المكتشف: ${detected}`;
    }
  }

  function init(){
    addStyle();
    restructureSpoolForm();
    setupAutoColor();
    linkActivePrinters();
    translateAdvancedSummary();

    let raf=0;
    const obs=new MutationObserver(()=>{
      if(raf) return;
      raf=requestAnimationFrame(()=>{
        raf=0;
        restructureSpoolForm();
        setupAutoColor();
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