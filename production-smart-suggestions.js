(() => {
  const cfg = window.APP_CONFIG || {};
  if (!window.supabase || !cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) return;
  const db = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  const currentKey='fm_current_project_id';
  const n=v=>Number(v)||0;
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const plateAllowed=(p,printerName)=>!Array.isArray(p?.allowed_printers)||!p.allowed_printers.length||p.allowed_printers.includes(printerName);
  const MAX_JOBS_PER_PRINTER=10;

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
      #productionPage .smart-wave-note{margin-top:10px;padding:9px 10px;border-radius:10px;background:color-mix(in srgb,var(--accent) 8%,var(--card2));border:1px solid color-mix(in srgb,var(--accent) 24%,var(--line));font-size:11px;line-height:1.6}
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
    panel.innerHTML=`<div class="smart-suggest-head"><div><h2 style="margin:0">اقتراح الطباعة الذكي</h2><div class="muted" style="font-size:12px">يجمع نفس الـPlate على أكبر عدد ممكن من الطابعات، ثم ينتقل للـPlate التالي مع مراعاة الفلمنت والقيود</div></div><button id="smartSuggestBtn" class="btn">اقترح شو أطبع</button></div><div id="smartSuggestBody" class="smart-suggest-list"><div class="muted">اضغط الزر للحصول على اقتراح.</div></div>`;
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

  function fmt(m){m=n(m);return `${Math.floor(m/60)}س ${m%60}د`;}

  function buildGroupedPlan(plates,printers,pmap,shortage){
    const states=printers.map(a=>({
      printer:a,
      name:String(a.printer_name||'').trim(),
      avail:availableAfterCurrent(a,pmap),
      after:availableAfterCurrent(a,pmap),
      freeAt:secondsUntilFree(a,pmap),
      readyAt:secondsUntilFree(a,pmap),
      used:0,
      seq:[]
    })).filter(s=>s.name);

    // ابدأ بأكبر نقص لأنه عنق الزجاجة، ومع التعادل نمشي برقم Plate لسهولة المتابعة.
    const priority=plates
      .filter(p=>n(shortage.get(n(p.plate_no)))>0)
      .sort((a,b)=>n(shortage.get(n(b.plate_no)))-n(shortage.get(n(a.plate_no))) || n(a.plate_no)-n(b.plate_no));

    const waves=[];
    for(const p of priority){
      const no=n(p.plate_no), w=n(p.weight_g), duration=n(p.print_minutes)*60;
      let need=n(shortage.get(no));
      let waveNo=0;
      while(need>0){
        const candidates=states.filter(s=>
          plateAllowed(p,s.name) &&
          s.after>=w &&
          s.seq.length<MAX_JOBS_PER_PRINTER
        );
        if(!candidates.length) break;

        // أولاً الطابعة التي تفضى أسرع، ومع التعادل نحافظ على السبول الأكبر
        // للمهام القادمة حتى لا نحشر المشروع في بقايا صغيرة.
        candidates.sort((a,b)=>a.readyAt-b.readyAt || b.after-a.after || a.name.localeCompare(b.name,undefined,{numeric:true}));
        const batch=candidates.slice(0,Math.min(need,candidates.length));
        if(!batch.length) break;
        waveNo++;
        const names=[];
        for(const s of batch){
          s.seq.push(p);
          s.after-=w;
          s.used+=w;
          s.readyAt+=duration;
          names.push(s.name);
        }
        need-=batch.length;
        waves.push({plate:no,waveNo,count:batch.length,printers:names});
      }
      shortage.set(no,need);
    }
    return {states,waves};
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

    const plan=buildGroupedPlan(plates,printers,pmap,shortage);
    const recs=plan.states.sort((a,b)=>a.freeAt-b.freeAt || a.readyAt-b.readyAt || String(a.name).localeCompare(String(b.name),undefined,{numeric:true}));
    const unscheduled=plates.map(p=>({no:n(p.plate_no),qty:n(shortage.get(n(p.plate_no)))})).filter(x=>x.qty>0);

    const firstWave=plan.waves[0];
    const note=firstWave
      ? `<div class="smart-wave-note"><b>الخطة المجمعة:</b> البداية تكون Plate ${firstWave.plate} على ${firstWave.count} طابعة قدر الإمكان. النظام يكمل نفس الـPlate أولاً، وبعدها ينتقل للي بعده حسب النقص والفلمنت.</div>`
      : '';

    body.innerHTML=note+recs.map((r,idx)=>{
      const current=r.printer.status==='printing'&&r.printer.plate_no?`بعد انتهاء Plate ${n(r.printer.plate_no)}`:'الآن';
      if(!r.seq.length){
        return `<div class="smart-suggest-row"><div><div class="smart-suggest-printer">${esc(r.name)}</div><div class="smart-suggest-rank">#${idx+1}</div></div><div><div class="smart-suggest-choice">—</div><div class="smart-suggest-reason">لا توجد مهمة ناقصة تناسب الفلمنت المتبقي أو صلاحية الطابعة · المتاح المتوقع ${r.avail.toFixed(0)}g</div></div><div class="smart-suggest-fit smart-suggest-warn">لا اقتراح</div></div>`;
      }
      const seqText=r.seq.map(p=>`P${n(p.plate_no)} ${n(p.weight_g)}g`).join(' → ');
      const totalMin=r.seq.reduce((s,p)=>s+n(p.print_minutes),0);
      return `<div class="smart-suggest-row"><div><div class="smart-suggest-printer">${esc(r.name)}</div><div class="smart-suggest-rank">#${idx+1}</div></div><div><div class="smart-suggest-choice">${current}: ${seqText}</div><div class="smart-suggest-reason">استخدام ${r.used.toFixed(0)}g · وقت إضافي ${fmt(totalMin)} · مجمّع مع نفس الـPlate قدر الإمكان</div></div><div class="smart-suggest-fit">يبقى ≈ ${r.after.toFixed(0)}g</div></div>`;
    }).join('')+(unscheduled.length?`<div class="smart-wave-note smart-suggest-warn"><b>يبقى بدون توزيع من السبولات الحالية:</b> ${unscheduled.map(x=>`P${x.no} × ${x.qty}`).join('، ')}. بعد Refill يعاد الحساب.</div>`:'');
  }

  function boot(){
    ensurePanel();
    const root=document.getElementById('productionPage')||document.body;
    new MutationObserver(()=>ensurePanel()).observe(root,{childList:true,subtree:true});
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();
})();