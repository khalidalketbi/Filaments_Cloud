(() => {
  const cfg=window.APP_CONFIG||{};
  if(!window.supabase||!cfg.SUPABASE_URL||!cfg.SUPABASE_ANON_KEY)return;
  const db=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  let printerId=null,timer=null;
  let anchorGrams=null,anchorAt=0,rateGps=0,lastConfirmed=null,lastConfirmedAt=0;
  const $=id=>document.getElementById(id);

  function resetSmooth(){anchorGrams=null;anchorAt=0;rateGps=0;lastConfirmed=null;lastConfirmedAt=0;}

  function ensure(){
    const rem=$('remoteRemaining');if(!rem||$('printUsageLive'))return;
    const card=rem.closest('.remote-card');if(!card)return;
    const el=document.createElement('div');el.id='printUsageLive';el.style.cssText='margin-top:9px;padding-top:9px;border-top:1px solid var(--line);display:grid;gap:6px;font-size:12px';
    el.innerHTML=`
      <div style="display:flex;justify-content:space-between;gap:8px"><span class="muted">Layer الحالي</span><b id="usageLayer">— / —</b></div>
      <div style="display:flex;justify-content:space-between;gap:8px"><span class="muted">السبول المستخدم</span><b id="usageSpool">—</b></div>
      <div style="display:flex;justify-content:space-between;gap:8px"><span class="muted">المتبقي في السبول الآن</span><b id="usageSpoolRemaining">—</b></div>
      <div style="display:flex;justify-content:space-between;gap:8px"><span class="muted">استهلاك الفلمنت حتى الآن</span><b id="usageNow">—</b></div>
      <div style="display:flex;justify-content:space-between;gap:8px"><span class="muted">إجمالي الملف المتوقع</span><b id="usageTotal">—</b></div>
      <div style="display:flex;justify-content:space-between;gap:8px"><span class="muted">المتوقع بعد انتهاء الطبعة</span><b id="usageAfter">—</b></div>
      <div id="usageFinal" class="muted" style="display:none"></div>`;
    card.appendChild(el);
  }

  function smoothNow(confirmed,total,progress,remainingMinutes){
    const t=Date.now();
    if(!Number.isFinite(confirmed))return NaN;
    if(lastConfirmed===null){
      lastConfirmed=confirmed;lastConfirmedAt=t;anchorGrams=confirmed;anchorAt=t;
      const pct=Math.max(0,Math.min(99.9,Number(progress)||0));
      const remSec=Math.max(0,Number(remainingMinutes)||0)*60;
      const totalSec=(pct>0&&remSec>0)?remSec/(1-pct/100):0;
      rateGps=(Number.isFinite(total)&&total>0&&totalSec>0)?total/totalSec:0;
    }else if(Math.abs(confirmed-lastConfirmed)>0.0005){
      const dt=Math.max(1,(t-lastConfirmedAt)/1000);
      const measured=Math.max(0,(confirmed-lastConfirmed)/dt);
      if(measured>0)rateGps=measured;
      lastConfirmed=confirmed;lastConfirmedAt=t;anchorGrams=confirmed;anchorAt=t;
    }
    if(anchorGrams===null){anchorGrams=confirmed;anchorAt=t;}
    const elapsed=Math.max(0,(t-anchorAt)/1000);
    let live=Math.max(confirmed,anchorGrams+rateGps*elapsed);
    if(Number.isFinite(total)&&total>0)live=Math.min(total,live);
    return live;
  }

  async function refresh(){
    if(!printerId)return;ensure();if(!$('printUsageLive'))return;
    const {data:p}=await db.from('printers').select('actual_grams_used,estimated_grams,last_completed_grams,usage_committed,active_print_spool_id,loaded_spool_id,layer_num,total_layers,print_progress,remaining_minutes,status').eq('id',printerId).maybeSingle();if(!p)return;
    const spoolId=p.active_print_spool_id||p.loaded_spool_id||null;
    let spool=null;
    if(spoolId){const {data:s}=await db.from('spools').select('name,material,remaining_weight,total_weight,color_hex').eq('id',spoolId).maybeSingle();spool=s||null;}
    const confirmed=Number(p.actual_grams_used),total=Number(p.estimated_grams),final=Number(p.last_completed_grams);
    const printing=['printing','paused'].includes(String(p.status||''));
    const live=printing?smoothNow(confirmed,total,p.print_progress,p.remaining_minutes):confirmed;
    $('usageLayer').textContent=`${Number(p.layer_num)||0} / ${Number(p.total_layers)||'—'}`;
    $('usageSpool').textContent=spool?`${spool.name||'Spool'}${spool.material?` · ${spool.material}`:''}`:'—';
    const storedRemaining=spool?Number(spool.remaining_weight):NaN;
    const liveRemaining=Number.isFinite(storedRemaining)?Math.max(0,storedRemaining-(Number.isFinite(live)?live:0)):NaN;
    $('usageSpoolRemaining').textContent=Number.isFinite(liveRemaining)?`${liveRemaining.toFixed(1)} g`:'—';
    $('usageNow').textContent=Number.isFinite(live)?`${live.toFixed(1)} g`:'—';
    $('usageTotal').textContent=Number.isFinite(total)&&total>0?`${total.toFixed(1)} g`:'—';
    const after=(Number.isFinite(storedRemaining)&&Number.isFinite(total)&&total>0)?Math.max(0,storedRemaining-total):NaN;
    $('usageAfter').textContent=Number.isFinite(after)?`${after.toFixed(1)} g`:'—';
    const f=$('usageFinal');
    if(p.usage_committed&&Number.isFinite(final)){f.style.display='block';f.textContent=`✓ الاستهلاك النهائي المحسوب: ${final.toFixed(1)} g · حتى Layer ${p.layer_num||0}/${p.total_layers||'—'}`;}else f.style.display='none';
  }

  document.addEventListener('click',e=>{const b=e.target.closest('[data-bambu-remote]');if(!b)return;printerId=b.dataset.bambuRemote;resetSmooth();setTimeout(()=>{ensure();refresh();clearInterval(timer);timer=setInterval(refresh,1000);},150);},true);
  document.addEventListener('click',e=>{if(e.target.closest('#closeBambuRemote')){clearInterval(timer);timer=null;printerId=null;resetSmooth();}},true);
})();
