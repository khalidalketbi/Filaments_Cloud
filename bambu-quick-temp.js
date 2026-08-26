(() => {
  const cfg=window.APP_CONFIG||{};
  if(!window.supabase||!cfg.SUPABASE_URL||!cfg.SUPABASE_ANON_KEY)return;
  const db=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  const $=id=>document.getElementById(id);
  let printerId=null;

  const style=document.createElement('style');
  style.textContent=`
    .quick-temp-controls{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px}
    .quick-temp-box{background:var(--card2);border:1px solid var(--line);border-radius:12px;padding:9px}
    .quick-temp-box label{display:block;color:var(--muted);font-size:10px;margin-bottom:6px}
    .quick-temp-row{display:flex;gap:6px;align-items:center}
    .quick-temp-row input{width:100%;min-width:0;margin:0;min-height:38px;text-align:center}
    .quick-temp-row .btn{min-height:38px;padding:7px 10px;white-space:nowrap}
    @media(max-width:520px){.quick-temp-controls{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);

  function ensure(){
    const modal=$('bambuRemoteModal');
    if(!modal||$('quickTempControls'))return;
    const temps=modal.querySelector('.remote-temps');
    if(!temps)return;
    const box=document.createElement('div');
    box.id='quickTempControls';
    box.className='quick-temp-controls';
    box.innerHTML=`
      <div class="quick-temp-box">
        <label>NOZZLE TARGET · 0–300°C</label>
        <div class="quick-temp-row"><input id="quickNozzleTemp" type="number" min="0" max="300" step="1" inputmode="numeric"><button id="quickNozzleApply" class="btn small" type="button">تطبيق</button></div>
      </div>
      <div class="quick-temp-box">
        <label>BED TARGET · 0–100°C</label>
        <div class="quick-temp-row"><input id="quickBedTemp" type="number" min="0" max="100" step="1" inputmode="numeric"><button id="quickBedApply" class="btn small" type="button">تطبيق</button></div>
      </div>`;
    temps.insertAdjacentElement('afterend',box);
    $('quickNozzleApply').onclick=()=>send('nozzle_temp','quickNozzleTemp',0,300);
    $('quickBedApply').onclick=()=>send('bed_temp','quickBedTemp',0,100);
    $('quickNozzleTemp').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();send('nozzle_temp','quickNozzleTemp',0,300);}});
    $('quickBedTemp').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();send('bed_temp','quickBedTemp',0,100);}});
  }

  async function send(command,inputId,min,max){
    if(!printerId)return;
    const input=$(inputId),status=$('remoteCommandStatus');
    let temp=Math.round(Number(input?.value));
    if(!Number.isFinite(temp)){if(status)status.textContent='اكتب درجة الحرارة أولاً.';return;}
    temp=Math.max(min,Math.min(max,temp));input.value=String(temp);
    const {error}=await db.from('printer_commands').insert({printer_id:printerId,command,payload:{temp}});
    if(status)status.textContent=error?error.message:`تم طلب ${temp}°C`;
  }

  async function syncTargets(){
    if(!printerId)return;
    const {data:p}=await db.from('printers').select('nozzle_target,bed_target').eq('id',printerId).maybeSingle();
    if(!p)return;
    const n=$('quickNozzleTemp'),b=$('quickBedTemp');
    if(n&&document.activeElement!==n&&p.nozzle_target!=null)n.value=String(Math.round(Number(p.nozzle_target)));
    if(b&&document.activeElement!==b&&p.bed_target!=null)b.value=String(Math.round(Number(p.bed_target)));
  }

  document.addEventListener('click',e=>{
    const b=e.target.closest('[data-bambu-remote]');
    if(!b)return;
    printerId=b.dataset.bambuRemote;
    setTimeout(()=>{ensure();syncTargets();},100);
  },true);
  setInterval(()=>{ensure();if(printerId)syncTargets();},1800);
})();
