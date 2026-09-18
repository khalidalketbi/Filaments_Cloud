(() => {
  const cfg = window.APP_CONFIG || {};
  if (!window.supabase || !cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) return;
  const db = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  const overrides = new Map();
  let refreshing = false;

  function injectStyles(){
    if(document.getElementById('manualRemainingTimeStyle')) return;
    const s=document.createElement('style');
    s.id='manualRemainingTimeStyle';
    s.textContent=`
      #productionPage .manual-time-box{margin-top:9px;padding:10px;background:var(--card2);border:1px dashed var(--line);border-radius:12px}
      #productionPage .manual-time-title{font-size:11px;color:var(--muted);margin-bottom:7px}
      #productionPage .manual-time-row{display:grid;grid-template-columns:1fr 1fr auto;gap:7px;align-items:end}
      #productionPage .manual-time-row label{margin:0}
      #productionPage .manual-time-row input{min-height:38px;padding:8px}
      #productionPage .manual-time-save{min-height:38px;white-space:nowrap}
      #productionPage .manual-time-active{display:inline-block;margin-top:6px;padding:3px 8px;border-radius:999px;background:color-mix(in srgb,var(--accent2) 18%,var(--card2));color:var(--accent2);font-size:10px;font-weight:800}
      #productionPage .manual-timer-display{font-size:22px;color:var(--accent2);font-weight:900;margin-top:10px;min-height:28px;font-variant-numeric:tabular-nums}
      #productionPage .manual-timer-display.overdue{color:var(--warn)}
      #productionPage .manual-override-active>.printer-timer{display:none!important}
      @media(max-width:520px){#productionPage .manual-time-row{grid-template-columns:1fr 1fr}.manual-time-save{grid-column:1/-1;width:100%}}
    `;
    document.head.appendChild(s);
  }

  function fmt(ms){
    const total=Math.max(0,Math.floor(ms/1000));
    const hh=Math.floor(total/3600), mm=Math.floor((total%3600)/60), ss=total%60;
    return `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;
  }

  function enhanceCards(){
    document.querySelectorAll('#prodPrinterGrid .prod-printer-card').forEach(card=>{
      if(card.querySelector('.manual-time-box')) return;
      const timer=card.querySelector('.printer-timer');
      if(!timer) return;
      const box=document.createElement('div');
      box.className='manual-time-box';
      box.innerHTML=`
        <div class="manual-time-title">إذا تريد وقت مختلف عن وقت الـPlate، أدخل الوقت المتبقي يدويًا. الوقت اليدوي تكون له الأولوية:</div>
        <div class="manual-time-row">
          <label>ساعات<input class="manual-rem-h" type="number" inputmode="numeric" min="0" max="999" step="1" value=""></label>
          <label>دقائق<input class="manual-rem-m" type="number" inputmode="numeric" min="0" max="59" step="1" value=""></label>
          <button type="button" class="btn secondary small manual-time-save">استخدم الوقت اليدوي</button>
        </div>`;
      timer.insertAdjacentElement('afterend',box);
      box.querySelector('.manual-time-save').addEventListener('click',()=>saveRemaining(card,box));
    });
  }

  async function saveRemaining(card,box){
    const id=card.dataset.id;
    const h=Math.max(0,parseInt(box.querySelector('.manual-rem-h').value||'0',10));
    const m=Math.max(0,Math.min(59,parseInt(box.querySelector('.manual-rem-m').value||'0',10)));
    const remaining=h*60+m;
    const btn=box.querySelector('.manual-time-save');
    const status=document.getElementById('prodStatus');
    if(!id){if(status) status.textContent='تعذر تحديد الطابعة.';return;}
    if(remaining<=0){if(status) status.textContent='أدخل وقتًا متبقيًا أكبر من صفر.';return;}
    btn.disabled=true;
    if(status) status.textContent='جاري ضبط الوقت اليدوي…';

    const ares=await db.from('production_assignments').select('id,plate_no,status').eq('id',id).single();
    if(ares.error||!ares.data?.plate_no){if(status) status.textContent='اختر Plate للطابعة أولًا.';btn.disabled=false;return;}

    const finishAt=new Date(Date.now()+remaining*60000).toISOString();
    const update={status:'printing',manual_time_override:true,manual_finish_at:finishAt,reminder_10m_sent:false,updated_at:new Date().toISOString()};
    const ures=await db.from('production_assignments').update(update).eq('id',id).select('id,manual_time_override,manual_finish_at').single();
    if(ures.error){if(status) status.textContent='تعذر حفظ الوقت: '+ures.error.message;btn.disabled=false;return;}

    const finish=new Date(ures.data.manual_finish_at).getTime();
    overrides.set(id,finish);
    activateCard(card,id,finish);
    if(status) status.textContent=`تم اعتماد الوقت اليدوي ${h?`${h}س `:''}${m}د.`;
    btn.disabled=false;
  }

  function activateCard(card,id,finish){
    if(!card||!finish) return;
    card.classList.add('manual-override-active');
    card.dataset.manualFinishAt=String(finish);
    const nativeTimer=card.querySelector('.printer-timer');
    if(!nativeTimer) return;
    let display=card.querySelector('.manual-timer-display');
    if(!display){
      display=document.createElement('div');
      display.className='manual-timer-display';
      nativeTimer.insertAdjacentElement('afterend',display);
    }
    let badge=card.querySelector('.manual-time-active');
    if(!badge){
      badge=document.createElement('span');
      badge.className='manual-time-active';
      badge.textContent='وقت يدوي مفعل';
      display.insertAdjacentElement('afterend',badge);
    }
    updateDisplay(card,finish);
  }

  function deactivateCard(card){
    card.classList.remove('manual-override-active');
    delete card.dataset.manualFinishAt;
    card.querySelector('.manual-timer-display')?.remove();
    card.querySelector('.manual-time-active')?.remove();
  }

  function updateDisplay(card,finish){
    const display=card.querySelector('.manual-timer-display');
    if(!display) return;
    const diff=finish-Date.now();
    display.textContent=diff>0?fmt(diff):'00:00:00';
    display.classList.toggle('overdue',diff<=0);
  }

  async function refreshOverrides(){
    if(refreshing) return;
    const cards=[...document.querySelectorAll('#prodPrinterGrid .prod-printer-card')];
    const ids=cards.map(c=>c.dataset.id).filter(Boolean);
    if(!ids.length) return;
    refreshing=true;
    try{
      const q=await db.from('production_assignments').select('id,manual_time_override,manual_finish_at,status').in('id',ids);
      if(q.error) return;
      const active=new Map();
      (q.data||[]).forEach(r=>{
        if(r.status==='printing'&&r.manual_time_override&&r.manual_finish_at){
          const finish=new Date(r.manual_finish_at).getTime();
          active.set(r.id,finish);
          overrides.set(r.id,finish);
        }
      });
      [...overrides.keys()].forEach(id=>{if(!active.has(id)) overrides.delete(id);});
      cards.forEach(card=>{
        const id=card.dataset.id;
        const finish=active.get(id);
        if(finish) activateCard(card,id,finish); else deactivateCard(card);
      });
    } finally { refreshing=false; }
  }

  function tick(){
    document.querySelectorAll('#prodPrinterGrid .prod-printer-card').forEach(card=>{
      const finish=overrides.get(card.dataset.id);
      if(finish) updateDisplay(card,finish);
    });
  }

  function boot(){
    injectStyles();
    enhanceCards();
    refreshOverrides();
    const grid=document.getElementById('prodPrinterGrid');
    if(grid){
      let pending=false;
      new MutationObserver(()=>{
        if(pending) return;
        pending=true;
        requestAnimationFrame(()=>{
          pending=false;
          enhanceCards();
          refreshOverrides();
        });
      }).observe(grid,{childList:true});
    }
    setInterval(tick,1000);
    setInterval(refreshOverrides,5000);
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();
})();