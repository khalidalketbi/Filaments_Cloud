(() => {
  const cfg = window.APP_CONFIG || {};
  if (!window.supabase || !cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) return;
  const db = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  const overrides = new Map();

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
          <label>ساعات<input class="manual-rem-h" type="number" min="0" max="999" step="1" value="0"></label>
          <label>دقائق<input class="manual-rem-m" type="number" min="0" max="59" step="1" value="0"></label>
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

    const ares=await db.from('production_assignments').select('id,plate_no,status,started_at').eq('id',id).single();
    if(ares.error||!ares.data?.plate_no){if(status) status.textContent='اختر Plate للطابعة أولًا.';btn.disabled=false;return;}

    const finishAt=new Date(Date.now()+remaining*60000).toISOString();
    const update={status:'printing',manual_time_override:true,manual_finish_at:finishAt,reminder_10m_sent:false,updated_at:new Date().toISOString()};
    const ures=await db.from('production_assignments').update(update).eq('id',id).select('id,manual_time_override,manual_finish_at').single();
    if(ures.error){if(status) status.textContent='تعذر حفظ الوقت: '+ures.error.message;btn.disabled=false;return;}

    overrides.set(id,new Date(ures.data.manual_finish_at).getTime());
    if(status) status.textContent=`تم اعتماد الوقت اليدوي ${h?`${h}س `:''}${m}د، وهو الآن أقوى من وقت الـPlate.`;
    applyOverrideToCard(card,id);
    btn.disabled=false;
  }

  function applyOverrideToCard(card,id){
    const finish=overrides.get(id); if(!finish) return;
    const timer=card.querySelector('.printer-timer'); if(!timer) return;
    const diff=finish-Date.now();
    timer.textContent=diff>0?fmt(diff):'00:00:00';
    timer.classList.toggle('overdue',diff<=0);
    if(!card.querySelector('.manual-time-active')){
      const badge=document.createElement('span'); badge.className='manual-time-active'; badge.textContent='وقت يدوي مفعل';
      timer.insertAdjacentElement('afterend',badge);
    }
  }

  async function refreshOverrides(){
    const cards=[...document.querySelectorAll('#prodPrinterGrid .prod-printer-card')];
    const ids=cards.map(c=>c.dataset.id).filter(Boolean);
    if(!ids.length) return;
    const q=await db.from('production_assignments').select('id,manual_time_override,manual_finish_at,status').in('id',ids);
    if(q.error) return;
    const active=new Set();
    (q.data||[]).forEach(r=>{
      if(r.status==='printing'&&r.manual_time_override&&r.manual_finish_at){overrides.set(r.id,new Date(r.manual_finish_at).getTime());active.add(r.id);}
    });
    [...overrides.keys()].forEach(id=>{if(!active.has(id)) overrides.delete(id);});
    cards.forEach(card=>{
      const id=card.dataset.id;
      if(overrides.has(id)) applyOverrideToCard(card,id);
      else card.querySelector('.manual-time-active')?.remove();
    });
  }

  function tick(){
    document.querySelectorAll('#prodPrinterGrid .prod-printer-card').forEach(card=>{
      const id=card.dataset.id;
      if(overrides.has(id)) applyOverrideToCard(card,id);
    });
  }

  function boot(){
    injectStyles(); enhanceCards(); refreshOverrides();
    const root=document.getElementById('productionPage')||document.body;
    const obs=new MutationObserver(()=>{enhanceCards();refreshOverrides();});
    obs.observe(root,{childList:true,subtree:true});
    setInterval(tick,200);
    setInterval(refreshOverrides,3000);
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();
})();