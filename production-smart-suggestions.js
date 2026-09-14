(() => {
  const cfg = window.APP_CONFIG || {};
  if (!window.supabase || !cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) return;
  const db = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  const currentKey='fm_current_project_id';
  const n=v=>Number(v)||0;
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function injectStyle(){
    if(document.getElementById('smartSuggestStyle')) return;
    const s=document.createElement('style');
    s.id='smartSuggestStyle';
    s.textContent=`
      #productionPage .smart-suggest{margin:0 0 14px;padding:14px;border:1px solid var(--line);border-radius:16px;background:var(--card)}
      #productionPage .smart-suggest-head{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
      #productionPage .smart-suggest-list{display:grid;gap:8px;margin-top:12px}
      #productionPage .smart-suggest-row{display:grid;grid-template-columns:90px 1fr auto;gap:10px;align-items:center;padding:10px;border-radius:12px;background:var(--card2);border:1px solid var(--line)}
      #productionPage .smart-suggest-printer{font-weight:900;font-size:16px}
      #productionPage .smart-suggest-choice{font-weight:800}
      #productionPage .smart-suggest-reason{font-size:11px;color:var(--muted);margin-top:3px}
      #productionPage .smart-suggest-fit{font-size:12px;font-weight:800;white-space:nowrap}
      #productionPage .smart-suggest-warn{color:var(--warn)}
      @media(max-width:620px){#productionPage .smart-suggest-row{grid-template-columns:70px 1fr}.smart-suggest-fit{grid-column:2}}
    `;
    document.head.appendChild(s);
  }

  function ensurePanel(){
    injectStyle();
    const printersPanel=document.querySelector('#productionPage .prod-printers-panel');
    if(!printersPanel || document.getElementById('smartSuggestPanel')) return;
    const panel=document.createElement('div');
    panel.id='smartSuggestPanel'; panel.className='smart-suggest';
    panel.innerHTML=`<div class="smart-suggest-head"><div><h2 style="margin:0">اقتراح الطباعة الذكي</h2><div class="muted" style="font-size:12px">حسب الناقص في المشروع + الطباعة الحالية + الفلمنت المتبقي لكل طابعة</div></div><button id="smartSuggestBtn" class="btn">اقترح شو أطبع</button></div><div id="smartSuggestBody" class="smart-suggest-list"><div class="muted">اضغط الزر للحصول على اقتراح.</div></div>`;
    printersPanel.insertAdjacentElement('beforebegin',panel);
    document.getElementById('smartSuggestBtn').addEventListener('click',buildSuggestions);
  }

  async function buildSuggestions(){
    const body=document.getElementById('smartSuggestBody'); if(!body)return;
    body.innerHTML='<div class="muted">جاري الحساب…</div>';
    const projectId=localStorage.getItem(currentKey);
    if(!projectId){body.innerHTML='<div class="smart-suggest-warn">اختر مشروع أولاً.</div>';return;}

    const [pp,aa]=await Promise.all([
      db.from('production_plates').select('*').eq('project_id',projectId).order('plate_no'),
      db.from('production_assignments').select('*').eq('project_id',projectId).order('printer_name')
    ]);
    if(pp.error||aa.error){body.innerHTML=`<div class="smart-suggest-warn">تعذر الحساب: ${esc(pp.error?.message||aa.error?.message)}</div>`;return;}
    const plates=pp.data||[], printers=aa.data||[];
    if(!plates.length||!printers.length){body.innerHTML='<div class="smart-suggest-warn">بيانات المشروع أو الطابعات ناقصة.</div>';return;}

    const pmap=new Map(plates.map(p=>[n(p.plate_no),p]));
    const projected=new Map(plates.map(p=>[n(p.plate_no),n(p.completed_qty)]));
    for(const a of printers){
      if(a.status==='printing' && a.plate_no && pmap.has(n(a.plate_no))){
        projected.set(n(a.plate_no),n(projected.get(n(a.plate_no)))+1);
      }
    }

    const shortage=new Map();
    for(const p of plates) shortage.set(n(p.plate_no),Math.max(0,n(p.target_qty)-n(projected.get(n(p.plate_no)))));

    const order=[...printers].sort((a,b)=>{
      const aaAvail=availableAfterCurrent(a,pmap), bbAvail=availableAfterCurrent(b,pmap);
      return aaAvail-bbAvail || String(a.printer_name).localeCompare(String(b.printer_name),undefined,{numeric:true});
    });

    const recs=[];
    for(const printer of order){
      const avail=availableAfterCurrent(printer,pmap);
      const candidates=plates.filter(p=>n(shortage.get(n(p.plate_no)))>0 && n(p.weight_g)<=avail);
      if(!candidates.length){
        const stillNeeded=[...shortage.entries()].filter(([,q])=>q>0).length>0;
        recs.push({printer,plate:null,avail,reason:stillNeeded?'لا يوجد Plate ناقص يناسب الفلمنت المتبقي':'المشروع مكتمل حسب الطباعة الحالية'});
        continue;
      }

      candidates.sort((a,b)=>{
        const sa=n(shortage.get(n(a.plate_no))), sb=n(shortage.get(n(b.plate_no)));
        if(sa!==sb) return sb-sa; // الأكثر نقصاً أولاً
        const wasteA=avail-n(a.weight_g), wasteB=avail-n(b.weight_g);
        if(wasteA!==wasteB) return wasteA-wasteB; // أفضل استغلال للسبول
        return n(a.print_minutes)-n(b.print_minutes); // ثم الأسرع
      });
      const choice=candidates[0];
      shortage.set(n(choice.plate_no),n(shortage.get(n(choice.plate_no)))-1);
      recs.push({printer,plate:choice,avail,after:avail-n(choice.weight_g),needBefore:n(shortage.get(n(choice.plate_no)))+1});
    }

    body.innerHTML=recs.map(r=>{
      const current=r.printer.status==='printing'&&r.printer.plate_no?`بعد انتهاء Plate ${n(r.printer.plate_no)}`:'الآن';
      if(!r.plate) return `<div class="smart-suggest-row"><div class="smart-suggest-printer">${esc(r.printer.printer_name)}</div><div><div class="smart-suggest-choice">—</div><div class="smart-suggest-reason">${esc(r.reason)} · المتاح المتوقع ${r.avail.toFixed(0)}g</div></div><div class="smart-suggest-fit smart-suggest-warn">لا اقتراح</div></div>`;
      return `<div class="smart-suggest-row"><div class="smart-suggest-printer">${esc(r.printer.printer_name)}</div><div><div class="smart-suggest-choice">${current}: Plate ${n(r.plate.plate_no)}</div><div class="smart-suggest-reason">ناقص ${r.needBefore} من هذا الـPlate · يحتاج ${n(r.plate.weight_g)}g · الوقت ${fmt(n(r.plate.print_minutes))}</div></div><div class="smart-suggest-fit">يبقى ≈ ${r.after.toFixed(0)}g</div></div>`;
    }).join('');
  }

  function availableAfterCurrent(a,pmap){
    let g=Math.max(0,n(a.remaining_g));
    if(a.status==='printing' && a.plate_no){
      const current=pmap.get(n(a.plate_no));
      if(current) g=Math.max(0,g-n(current.weight_g));
    }
    return g;
  }
  function fmt(m){m=n(m);return `${Math.floor(m/60)}س ${m%60}د`;}

  function boot(){
    ensurePanel();
    const root=document.getElementById('productionPage')||document.body;
    new MutationObserver(()=>ensurePanel()).observe(root,{childList:true,subtree:true});
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();
})();