(() => {
  const cfg = window.APP_CONFIG || {};
  if (!window.supabase || !cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) return;
  const db = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  const currentKey='fm_current_project_id';
  const n=v=>Number(v)||0;
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const DEFAULT_ORDER=['A1','A2','M1','M2','M3','M4','M5'];

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
      #productionPage .smart-suggest-reason{font-size:11px;color:var(--muted);margin-top:3px;line-height:1.55}
      #productionPage .smart-suggest-fit{font-size:12px;font-weight:800;white-space:nowrap}
      #productionPage .smart-suggest-warn{color:var(--warn)}
      #productionPage .smart-ai-badge{display:inline-block;margin-inline-start:6px;padding:2px 7px;border-radius:999px;background:color-mix(in srgb,var(--accent) 16%,transparent);color:var(--accent);font-size:10px;font-weight:800}
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
    panel.innerHTML=`<div class="smart-suggest-head"><div><h2 style="margin:0">اقتراح الطباعة الذكي <span class="smart-ai-badge">Smart Optimizer</span></h2><div class="muted" style="font-size:12px">يوازن المشروع كاملًا، يستغل الفلمنت بأفضل شكل، ويراعي الطباعة الحالية ووقت انتهاء كل طابعة</div></div><button id="smartSuggestBtn" class="btn">اقترح شو أطبع</button></div><div id="smartSuggestBody" class="smart-suggest-list"><div class="muted">اضغط الزر للحصول على اقتراح.</div></div>`;
    printersPanel.insertAdjacentElement('beforebegin',panel);
    document.getElementById('smartSuggestBtn').addEventListener('click',buildSuggestions);
  }

  async function buildSuggestions(){
    const body=document.getElementById('smartSuggestBody'); if(!body)return;
    body.innerHTML='<div class="muted">جاري تحسين التوزيع على كل الطابعات…</div>';
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

    const shortage={};
    for(const p of plates) shortage[n(p.plate_no)]=Math.max(0,n(p.target_qty)-n(projected.get(n(p.plate_no))));

    const orderedPrinters=[...printers].sort((a,b)=>{
      const ta=finishSeconds(a,pmap), tb=finishSeconds(b,pmap);
      if(ta!==tb) return ta-tb;
      return defaultIndex(a.printer_name)-defaultIndex(b.printer_name);
    });

    const optimized=optimizeGlobally(orderedPrinters,plates,pmap,shortage);
    const recs=optimized.map((plate,idx)=>{
      const printer=orderedPrinters[idx];
      const avail=availableAfterCurrent(printer,pmap);
      if(!plate){
        const anyNeed=Object.values(shortage).some(q=>q>0);
        return {printer,plate:null,avail,reason:anyNeed?'لا يوجد Plate ناقص يناسب الفلمنت المتوقع بعد الطبعة الحالية':'المشروع مكتمل حسب الطباعة الحالية'};
      }
      return {
        printer,plate,avail,after:avail-n(plate.weight_g),
        needBefore:shortage[n(plate.plate_no)]||0,
        finish:finishSeconds(printer,pmap)
      };
    });

    body.innerHTML=recs.map(r=>{
      const current=r.printer.status==='printing'&&r.printer.plate_no?`بعد انتهاء Plate ${n(r.printer.plate_no)}`:'الآن';
      if(!r.plate) return `<div class="smart-suggest-row"><div class="smart-suggest-printer">${esc(r.printer.printer_name)}</div><div><div class="smart-suggest-choice">—</div><div class="smart-suggest-reason">${esc(r.reason)} · المتاح المتوقع ${r.avail.toFixed(0)}g</div></div><div class="smart-suggest-fit smart-suggest-warn">لا اقتراح</div></div>`;
      return `<div class="smart-suggest-row"><div class="smart-suggest-printer">${esc(r.printer.printer_name)}</div><div><div class="smart-suggest-choice">${current}: Plate ${n(r.plate.plate_no)}</div><div class="smart-suggest-reason">اختيار محسّن على مستوى كل الطابعات · ناقص ${r.needBefore} من هذا الـPlate · يحتاج ${n(r.plate.weight_g)}g · الوقت ${fmt(n(r.plate.print_minutes))}</div></div><div class="smart-suggest-fit">يبقى ≈ ${r.after.toFixed(0)}g</div></div>`;
    }).join('');
  }

  function optimizeGlobally(printers,plates,pmap,shortage){
    const options=printers.map(printer=>{
      const avail=availableAfterCurrent(printer,pmap);
      const fit=plates.filter(p=>shortage[n(p.plate_no)]>0 && n(p.weight_g)<=avail);
      // Keep the search compact but intelligent: strongest candidates first.
      fit.sort((a,b)=>{
        const sa=shortage[n(a.plate_no)], sb=shortage[n(b.plate_no)];
        if(sa!==sb) return sb-sa;
        const wa=avail-n(a.weight_g), wb=avail-n(b.weight_g);
        if(wa!==wb) return wa-wb;
        return n(b.print_minutes)-n(a.print_minutes);
      });
      return fit.slice(0,8);
    });

    let best=null, bestScore=null;
    const used={};
    const chosen=new Array(printers.length).fill(null);

    function scoreSolution(){
      let assigned=0, weightUsed=0, waste=0, balanceGain=0, longWork=0;
      const finalShort={...shortage};
      for(let i=0;i<chosen.length;i++){
        const p=chosen[i]; if(!p) continue;
        assigned++;
        const no=n(p.plate_no);
        finalShort[no]=Math.max(0,(finalShort[no]||0)-1);
        weightUsed+=n(p.weight_g);
        waste+=Math.max(0,availableAfterCurrent(printers[i],pmap)-n(p.weight_g));
        longWork+=n(p.print_minutes);
      }
      // Large reward for reducing the biggest deficits. This keeps all kit parts balanced.
      for(const p of plates){
        const no=n(p.plate_no), before=shortage[no]||0, after=finalShort[no]||0;
        balanceGain+=(before*before-after*after);
      }
      // Lexicographic priorities encoded with safe gaps:
      // 1) fill as many printers as possible
      // 2) balance the project (largest shortages first)
      // 3) use more grams / leave less waste globally
      // 4) prefer longer jobs slightly, so early-finishing printers get useful long work
      return [assigned,balanceGain,weightUsed,-waste,longWork];
    }

    function better(a,b){
      if(!b) return true;
      for(let i=0;i<a.length;i++){
        if(a[i]!==b[i]) return a[i]>b[i];
      }
      return false;
    }

    function dfs(i){
      if(i===printers.length){
        const sc=scoreSolution();
        if(better(sc,bestScore)){bestScore=sc;best=[...chosen];}
        return;
      }

      // Try real assignments before skipping.
      for(const p of options[i]){
        const no=n(p.plate_no);
        if((used[no]||0)>=shortage[no]) continue;
        used[no]=(used[no]||0)+1;
        chosen[i]=p;
        dfs(i+1);
        chosen[i]=null;
        used[no]--;
      }
      dfs(i+1);
    }

    dfs(0);
    return best||chosen;
  }

  function availableAfterCurrent(a,pmap){
    let g=Math.max(0,n(a.remaining_g));
    if(a.status==='printing' && a.plate_no){
      const current=pmap.get(n(a.plate_no));
      if(current) g=Math.max(0,g-n(current.weight_g));
    }
    return g;
  }

  function finishSeconds(a,pmap){
    if(a.status!=='printing') return 0;
    if(a.manual_time_override && a.manual_finish_at){
      return Math.max(0,(new Date(a.manual_finish_at).getTime()-Date.now())/1000);
    }
    const p=pmap.get(n(a.plate_no));
    if(a.started_at && p?.print_minutes){
      return Math.max(0,(new Date(a.started_at).getTime()+n(p.print_minutes)*60000-Date.now())/1000);
    }
    return Number.POSITIVE_INFINITY;
  }

  function defaultIndex(name){
    const i=DEFAULT_ORDER.indexOf(String(name)); return i<0?999:i;
  }
  function fmt(m){m=n(m);return `${Math.floor(m/60)}س ${m%60}د`;}

  function boot(){
    ensurePanel();
    const root=document.getElementById('productionPage')||document.body;
    new MutationObserver(()=>ensurePanel()).observe(root,{childList:true,subtree:true});
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();
})();