(() => {
  const cfg=window.APP_CONFIG||{};
  if(!window.supabase||!cfg.SUPABASE_URL||!cfg.SUPABASE_ANON_KEY)return;
  const db=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  let printerId=null,timer=null;
  const $=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  const labels={
    nozzle_temp:'حرارة النوزل',bed_temp:'حرارة البيد',print_speed:'السرعة',light:'الإضاءة',fan:'المروحة',
    pause:'إيقاف مؤقت',resume:'استمرار',stop:'إيقاف الطباعة',load_filament:'Load',unload_filament:'Unload',
    set_spool:'تحديد الفلمنت',move:'تحريك',extrude:'Extruder',calibration:'Calibration',skip_objects:'Skip Parts',upload_print:'رفع وبدء طباعة'
  };
  const statusLabel={queued:'بانتظار التنفيذ',sent:'جاري التنفيذ',done:'تم',failed:'فشل',superseded:'أُلغي بأمر أحدث',cancelled:'أُلغي يدويًا'};
  function valueOf(c){const p=c.payload||{};switch(c.command){
    case'nozzle_temp':case'bed_temp':return `${p.temp??'—'}°C`;
    case'print_speed':return ({1:'50%',2:'100%',3:'124%',4:'166%'})[p.level]||String(p.level??'—');
    case'light':return p.on?'تشغيل':'إطفاء';
    case'fan':return `${p.fan||'part'} · ${p.percent??0}%`;
    case'move':return `${p.axis||''} ${p.distance??''}mm`;
    case'extrude':return `${p.distance??''}mm`;
    case'load_filament':return `Slot ${p.slot??'—'}`;
    case'skip_objects':return `Parts ${(p.object_ids||[]).join(', ')}`;
    default:return '';
  }}
  function ensure(){
    const modal=$('bambuRemoteModal');if(!modal||$('commandQueuePanel'))return;
    const dialog=modal.querySelector('.dialog');if(!dialog)return;
    const panel=document.createElement('div');panel.id='commandQueuePanel';panel.className='remote-card';panel.style.marginTop='12px';
    panel.innerHTML=`<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><b style="flex:1;min-width:150px">📋 قائمة التنفيذ</b><span class="muted" style="font-size:11px">آخر قيمة من نفس النوع هي المعتمدة</span><button id="cancelQueuedCommands" class="btn danger small" type="button">إلغاء كل المنتظر</button><button id="clearCommandHistory" class="btn secondary small" type="button">مسح المنتهي</button></div><div id="commandQueueList" style="display:grid;gap:7px;margin-top:10px"><span class="muted">لا توجد أوامر.</span></div>`;
    const actions=dialog.querySelector('.dialog-actions');dialog.insertBefore(panel,actions||null);
    $('clearCommandHistory').onclick=clearHistory;
    $('cancelQueuedCommands').onclick=cancelAllQueued;
  }
  async function clearHistory(){if(!printerId)return;await db.from('printer_commands').delete().eq('printer_id',printerId).in('status',['done','failed','superseded','cancelled']);await refresh();}
  async function cancelCommand(id){
    if(!printerId||!id)return;
    const {error}=await db.from('printer_commands').update({status:'cancelled',error:'Cancelled by user',completed_at:new Date().toISOString()}).eq('id',id).eq('printer_id',printerId).eq('status','queued');
    if(error)alert(error.message);
    await refresh();
  }
  async function cancelAllQueued(){
    if(!printerId)return;
    if(!confirm('إلغاء كل الأوامر التي ما زالت بانتظار التنفيذ؟'))return;
    const {error}=await db.from('printer_commands').update({status:'cancelled',error:'Cancelled by user',completed_at:new Date().toISOString()}).eq('printer_id',printerId).eq('status','queued');
    if(error)alert(error.message);
    await refresh();
  }
  async function refresh(){
    if(!printerId)return;ensure();const out=$('commandQueueList');if(!out)return;
    const {data,error}=await db.from('printer_commands').select('id,command,payload,status,error,created_at,completed_at').eq('printer_id',printerId).order('created_at',{ascending:false}).limit(25);
    if(error){out.innerHTML=`<span class="muted">${esc(error.message)}</span>`;return;}
    if(!data?.length){out.innerHTML='<span class="muted">لا توجد أوامر.</span>';return;}
    out.innerHTML=data.map(c=>{
      const st=statusLabel[c.status]||c.status,val=valueOf(c),time=new Date(c.created_at).toLocaleTimeString('ar-AE',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
      const tone=c.status==='done'?'var(--accent2)':c.status==='failed'?'var(--danger)':c.status==='cancelled'||c.status==='superseded'?'var(--muted)':c.status==='sent'?'var(--warn)':'var(--accent)';
      const cancel=c.status==='queued'?`<button class="btn danger small" type="button" data-cancel-command="${c.id}">إلغاء</button>`:'';
      return `<div style="display:grid;grid-template-columns:minmax(110px,1fr) minmax(90px,.9fr) auto auto;gap:8px;align-items:center;background:var(--card);border:1px solid var(--line);border-radius:11px;padding:9px"><div><b>${esc(labels[c.command]||c.command)}</b>${val?`<div class="muted" style="font-size:11px">${esc(val)}</div>`:''}</div><div style="font-size:11px;color:${tone}">${esc(st)}${c.error&&c.status==='failed'?`<div>${esc(c.error)}</div>`:''}</div><div class="muted" style="font-size:10px">${time}</div><div>${cancel}</div></div>`;
    }).join('');
    out.querySelectorAll('[data-cancel-command]').forEach(b=>b.onclick=()=>cancelCommand(b.dataset.cancelCommand));
  }
  document.addEventListener('click',e=>{const b=e.target.closest('[data-bambu-remote]');if(!b)return;printerId=b.dataset.bambuRemote;setTimeout(()=>{ensure();refresh();clearInterval(timer);timer=setInterval(refresh,1000);},100);},true);
  document.addEventListener('click',e=>{if(e.target.closest('#closeBambuRemote')){clearInterval(timer);timer=null;printerId=null;}},true);
})();
