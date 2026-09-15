(() => {
  const cfg = window.APP_CONFIG || {};
  if (!window.supabase || !cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) return;
  const db = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  const currentKey='fm_current_project_id';
  const n=v=>Number(v)||0;
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const plateAllowed=(p,printerName)=>!Array.isArray(p?.allowed_printers)||!p.allowed_printers.length||p.allowed_printers.includes(printerName);

  function injectStyle(){
    if(document.getElementById('smartSuggestStyle')) return;
    const s=document.createElement('style');
    s.id='smartSuggestStyle';
    s.textContent=`
      #productionPage .smart-suggest{margin:0 0 14px;padding:14px;border:1px solid var(--line);border-radius:16px;background:var(--card)}
      #productionPage .smart-suggest-head{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
      #productionPage .smart-suggest-list{display:grid;gap:8px;margin-top:12px}
      #productionPage .smart-suggest-row{display:grid;grid-template-columns:76px 1fr auto;gap:10px;align-items:center;padding:10px;border-radius:12px;background:var(--card2);border:1px solid var(--line)}
      #productionPage .smart-suggest-printer{font-weight:900;font-size:16px}
      #productionPage .smart-suggest-choice{font-weight:900;font-size:15px}
      #productionPage .smart-suggest-reason{font-size:11px;color:var(--muted);margin-top:4px;line-height:1.55}
      #productionPage .smart-suggest-fit{font-size:12px;font-weight:900;white-space:nowrap}
      #productionPage .smart-suggest-warn{color:var(--warn)}
      #productionPage .smart-suggest-rank{font-size:10px;color:var(--muted);margin-top:3px}
      @media(max-width:620px){#productionPage .smart-suggest-row{grid-template-columns:58px 1fr}.smart-suggest-fit{grid-column:2}}
    `;
    document.head.appendChild(s);
  }

  function ensurePanel(){
    injectStyle();
    const printersPanel=document.querySelector('#productionPage .prod-printers-panel');
    if(!printersPanel || document.getElementById('smartSuggestPanel')) return;
    const panel=document.createElement('div');
    panel.id='smartSuggestPanel'; panel.className='smart-suggest';
    panel.innerHTML=`<div class="smart-suggest-head"><div><h2 style="margin:0">اقتراح الطباعة الذكي</h2><div class="muted" style="font-size:12px">يوازن بين إكمال الأطقم واستغلال كل سبول لأقل بقايا ممكنة</div></div><button id="smartSuggestBtn" class="btn">اقترح شو أطبع</button></div><div id="smartSuggestBody" class="smart-suggest-list"><div class="muted">اضغط الزر للحصول على اقتراح.</div></div>`;
    printersPanel.insertAdjacentElement('beforebegin',panel);
    document.getElementById('smartSuggestBtn').addEventListener('click',buildSuggestions);
  }

  function availableAfterCurrent(a,pmap){
    let g=Math.max(0,n(a.remaining_g));
    if(a.status==='printing' && a.plate_no){
      const current=pmap.get(n(a.plate_no));
      if(current) g=Math.max(0,g-n(current.weight_g));
    }
    return g;
  }

  function secondsUntilFree(a,pmap){
    if(a.status!=='printing' || !a.plate_no) return 0;
    if(a.manual_time_override && a.manual_finish_at){
      return Math.max(0,Math.floor((new Date(a.manual_finish_at).getTime()-Date.now())/1000));
    }
    const p=pmap.get(n(a.plate_no));
    if(!p?.print_minutes || !a.started_at) return Number.POSITIVE_INFINITY;
    const end=new Date(a.started_at).getTime()+n(p.print_minutes)*60000;
    return Math.max(0,Math.floor((end-Date.now())/1000));
  }

  function generateSequences(plates, shortage, capacity, printerName){
    const valid=plates.filter(p=>plateAllowed(p,printerName) && n(shortage.get(n(p.plate_no)))>0 && n(p.weight_g)>0 && n(p.weight_g)<=capacity);
    const out=[];
    const counts=new Map();
    const seq=[];

    function pushCandidate(used){
      if(!seq.length) return;
      const distinct=new Set(seq.map(p=>n(p.plate_no))).size;
      const urgency=seq.reduce((s,p)=>s+n(shortage.get(n(p.plate_no))),0);
      const duplicatePenalty=seq.length-distinct;
      out.push({seq:[...seq],used,left:capacity-used,distinct,urgency,duplicatePenalty});
    }

    function dfs(start,used,depth){
      pushCandidate(used);
      if(depth>=6) return;
      for(let i=start;i<valid.length;i++){
        const p=valid[i], no=n(p.plate_no), w=n(p.weight_g);
        const c=counts.get(no)||0, max=n(shortage.get(no));
        if(c>=max || used+w>capacity) continue;
        counts.set(no,c+1); seq.push(p);
        dfs(i,used+w,depth+1);
        seq.pop(); counts.set(no,c);
      }
    }
    dfs(0,0,0);
    return out;
  }

  function candidateScore(c,capacity){
    const wastePenalty=c.left*4;
    const urgencyBonus=c.urgency*10;
    const diversityBonus=c.distinct*9;
    const duplicatePenalty=c.duplicatePenalty*7;
    const utilizationBonus=capacity>0?(c.used/capacity)*120:0;
    return urgencyBonus+diversityBonus+utilizationBonus-wastePenalty-duplicatePenalty;
  }

  async function buildSuggestions(){
    const body=document.getElementById('smartSuggestBody'); if(!body)return;
    body.innerHTML='<div class="muted">جاري الحساب الذكي…</div>';
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
      const ga=availableAfterCurrent(a,pmap), gb=availableAfterCurrent(b,pmap);
      if(ga!==gb) return ga-gb;
      return secondsUntilFree(a,pmap)-secondsUntilFree(b,pmap) || String(a.printer_name).localeCompare(String(b.printer_name),undefined,{numeric:true});
    });

    const recs=[];
    for(const printer of order){
      const avail=availableAfterCurrent(printer,pmap);
      const candidates=generateSequences(plates,shortage,avail,printer.printer_name);
      if(!candidates.length){
        const stillNeeded=[...shortage.values()].some(q=>q>0);
        recs.push({printer,seq:[],avail,after:avail,reason:stillNeeded?'لا توجد تركيبة ناقصة تناسب الفلمنت أو صلاحية الطابعة':'المشروع مكتمل حسب الطباعة الحالية'});
        continue;
      }

      candidates.sort((a,b)=>{
        const sa=candidateScore(a,avail), sb=candidateScore(b,avail);
        if(sa!==sb) return sb-sa;
        if(a.left!==b.left) return a.left-b.left;
        if(a.distinct!==b.distinct) return b.distinct-a.distinct;
        return b.used-a.used;
      });
      const best=candidates[0];
      for(const p of best.seq){
        const no=n(p.plate_no);
        shortage.set(no,Math.max(0,n(shortage.get(no))-1));
      }
      recs.push({printer,seq:best.seq,avail,after:best.left,used:best.used});
    }

    recs.sort((a,b)=>secondsUntilFree(a.printer,pmap)-secondsUntilFree(b.printer,pmap) || a.after-b.after);

    body.innerHTML=recs.map((r,idx)=>{
      const current=r.printer.status==='printing'&&r.printer.plate_no?`بعد انتهاء Plate ${n(r.printer.plate_no)}`:'الآن';
      if(!r.seq.length) return `<div class="smart-suggest-row"><div><div class="smart-suggest-printer">${esc(r.printer.printer_name)}</div><div class="smart-suggest-rank">#${idx+1}</div></div><div><div class="smart-suggest-choice">—</div><div class="smart-suggest-reason">${esc(r.reason)} · المتاح المتوقع ${r.avail.toFixed(0)}g</div></div><div class="smart-suggest-fit smart-suggest-warn">لا اقتراح</div></div>`;
      const seqText=r.seq.map(p=>`P${n(p.plate_no)} ${n(p.weight_g)}g`).join(' → ');
      const totalMin=r.seq.reduce((s,p)=>s+n(p.print_minutes),0);
      return `<div class="smart-suggest-row"><div><div class="smart-suggest-printer">${esc(r.printer.printer_name)}</div><div class="smart-suggest-rank">#${idx+1}</div></div><div><div class="smart-suggest-choice">${current}: ${seqText}</div><div class="smart-suggest-reason">استخدام ${r.used.toFixed(0)}g · وقت إضافي ${fmt(totalMin)} · محسوب مع مخزون المشروع والطبعات الحالية</div></div><div class="smart-suggest-fit">يبقى ≈ ${r.after.toFixed(0)}g</div></div>`;
    }).join('');
  }

  function fmt(m){m=n(m);return `${Math.floor(m/60)}س ${m%60}د`;}

  function boot(){
    ensurePanel();
    const root=document.getElementById('productionPage')||document.body;
    new MutationObserver(()=>ensurePanel()).observe(root,{childList:true,subtree:true});
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();
})();