(() => {
  const cfg = window.APP_CONFIG || {};
  if (!window.supabase || !cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) return;
  const db = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});

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
      @media(max-width:520px){#productionPage .manual-time-row{grid-template-columns:1fr 1fr}.manual-time-save{grid-column:1/-1;width:100%}}
    `;
    document.head.appendChild(s);
  }

  function enhanceCards(){
    document.querySelectorAll('#prodPrinterGrid .prod-printer-card').forEach(card=>{
      if(card.querySelector('.manual-time-box')) return;
      const timer=card.querySelector('.printer-timer');
      if(!timer) return;
      const box=document.createElement('div');
      box.className='manual-time-box';
      box.innerHTML=`
        <div class="manual-time-title">إذا وقت البداية غير مسجل، أدخل الوقت المتبقي يدويًا:</div>
        <div class="manual-time-row">
          <label>ساعات<input class="manual-rem-h" type="number" min="0" max="999" step="1" value="0"></label>
          <label>دقائق<input class="manual-rem-m" type="number" min="0" max="59" step="1" value="0"></label>
          <button type="button" class="btn secondary small manual-time-save">ابدأ العد من هذا الوقت</button>
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
    if(status) status.textContent='جاري ضبط الوقت المتبقي…';

    const ares=await db.from('production_assignments').select('id,project_id,plate_no,status').eq('id',id).single();
    if(ares.error||!ares.data?.plate_no){
      if(status) status.textContent='اختر Plate للطابعة أولًا.';
      btn.disabled=false; return;
    }
    const pres=await db.from('production_plates').select('print_minutes').eq('project_id',ares.data.project_id).eq('plate_no',ares.data.plate_no).single();
    if(pres.error||!pres.data?.print_minutes){
      if(status) status.textContent='وقت هذا الـPlate غير مسجل.';
      btn.disabled=false; return;
    }
    const planned=Number(pres.data.print_minutes)||0;
    if(remaining>planned){
      if(status) status.textContent=`الوقت المتبقي لا يمكن أن يتجاوز وقت الـPlate (${Math.floor(planned/60)}س ${planned%60}د).`;
      btn.disabled=false; return;
    }

    const elapsed=planned-remaining;
    const startedAt=new Date(Date.now()-elapsed*60000).toISOString();
    const ures=await db.from('production_assignments').update({status:'printing',started_at:startedAt,reminder_10m_sent:false,updated_at:new Date().toISOString()}).eq('id',id).select();
    if(ures.error){
      if(status) status.textContent='تعذر حفظ الوقت: '+ures.error.message;
      btn.disabled=false; return;
    }
    if(status) status.textContent=`تم ضبط العد التنازلي على ${h?`${h}س `:''}${m}د.`;
    const timer=card.querySelector('.printer-timer');
    if(timer){
      const finish=Date.now()+remaining*60000;
      const tick=()=>{
        const diff=Math.max(0,finish-Date.now());
        const total=Math.floor(diff/1000), hh=Math.floor(total/3600), mm=Math.floor((total%3600)/60), ss=total%60;
        timer.textContent=`${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;
        if(diff>0) requestAnimationFrame(()=>setTimeout(tick,250));
      };
      tick();
    }
    btn.disabled=false;
  }

  function boot(){
    injectStyles();
    enhanceCards();
    const root=document.getElementById('productionPage')||document.body;
    const obs=new MutationObserver(()=>enhanceCards());
    obs.observe(root,{childList:true,subtree:true});
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();
})();