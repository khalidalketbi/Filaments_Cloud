(() => {
  const cfg=window.APP_CONFIG||{};
  if(!window.supabase||!cfg.SUPABASE_URL||!cfg.SUPABASE_ANON_KEY)return;
  const db=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  let printerId=null,timer=null;
  const $=id=>document.getElementById(id);
  function ensure(){
    const rem=$('remoteRemaining');if(!rem||$('printUsageLive'))return;
    const card=rem.closest('.remote-card');if(!card)return;
    const el=document.createElement('div');el.id='printUsageLive';el.style.cssText='margin-top:9px;padding-top:9px;border-top:1px solid var(--line);display:grid;gap:4px;font-size:12px';
    el.innerHTML='<div style="display:flex;justify-content:space-between;gap:8px"><span class="muted">استهلاك الفلمنت حتى الآن</span><b id="usageNow">—</b></div><div style="display:flex;justify-content:space-between;gap:8px"><span class="muted">إجمالي الملف المتوقع</span><b id="usageTotal">—</b></div><div id="usageFinal" class="muted" style="display:none"></div>';
    card.appendChild(el);
  }
  async function refresh(){
    if(!printerId)return;ensure();if(!$('printUsageLive'))return;
    const {data:p}=await db.from('printers').select('actual_grams_used,estimated_grams,last_completed_grams,usage_committed,active_print_spool_id,loaded_spool_id,layer_num,total_layers').eq('id',printerId).maybeSingle();if(!p)return;
    const now=Number(p.actual_grams_used),total=Number(p.estimated_grams),final=Number(p.last_completed_grams);
    $('usageNow').textContent=Number.isFinite(now)?`${now.toFixed(1)} g`:'—';
    $('usageTotal').textContent=Number.isFinite(total)&&total>0?`${total.toFixed(1)} g`:'—';
    const f=$('usageFinal');
    if(p.usage_committed&&Number.isFinite(final)){
      f.style.display='block';f.textContent=`✓ الاستهلاك النهائي المحسوب: ${final.toFixed(1)} g · حتى Layer ${p.layer_num||0}/${p.total_layers||'—'}`;
    }else f.style.display='none';
  }
  document.addEventListener('click',e=>{const b=e.target.closest('[data-bambu-remote]');if(!b)return;printerId=b.dataset.bambuRemote;setTimeout(()=>{ensure();refresh();clearInterval(timer);timer=setInterval(refresh,1200);},150);},true);
  document.addEventListener('click',e=>{if(e.target.closest('#closeBambuRemote')){clearInterval(timer);timer=null;printerId=null;}},true);
})();
