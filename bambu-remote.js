(() => {
  const cfg = window.APP_CONFIG || {};
  if (!window.supabase || !cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) return;
  const db = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
  const $ = id => document.getElementById(id);
  let selectedPrinter = null;
  let refreshTimer = null;
  const BRIDGE = 'http://127.0.0.1:18473';

  const style = document.createElement('style');
  style.textContent = `
    .remote-badge{display:inline-flex;align-items:center;gap:6px;padding:4px 8px;border:1px solid var(--line);border-radius:999px;font-size:10px;color:var(--muted);background:var(--card2)}
    .remote-dot{width:7px;height:7px;border-radius:50%;background:var(--danger)}
    .remote-dot.on{background:var(--accent2);box-shadow:0 0 10px color-mix(in srgb,var(--accent2) 65%,transparent)}
    .remote-grid{display:grid;grid-template-columns:1.35fr .65fr;gap:12px}.remote-card{background:var(--card2);border:1px solid var(--line);border-radius:14px;padding:13px}
    .remote-temps{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.remote-temp{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:10px;text-align:center}.remote-temp span{display:block;color:var(--muted);font-size:10px}.remote-temp b{display:block;font-size:20px;margin-top:4px}
    .remote-controls{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}.remote-controls .btn{width:100%}.remote-screen{aspect-ratio:16/9;background:#05080e;border:1px solid var(--line);border-radius:14px;display:grid;place-items:center;overflow:hidden;position:relative}.remote-screen .placeholder{text-align:center;color:var(--muted);padding:18px;font-size:12px}.remote-meta{display:grid;grid-template-columns:1fr 1fr;gap:7px 12px;font-size:12px}.remote-meta span{color:var(--muted)}.remote-meta b{color:var(--text)}
    .bambu-connect-panel{margin:0 0 12px;padding:12px;border:1px solid color-mix(in srgb,var(--accent) 35%,var(--line));background:color-mix(in srgb,var(--accent) 7%,var(--panel));border-radius:14px}.bambu-connect-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
    .bridge-state{display:flex;align-items:center;gap:8px;margin-top:9px;padding:9px 11px;border:1px solid var(--line);border-radius:11px;background:var(--card2);font-size:12px}.bridge-state i{width:8px;height:8px;border-radius:50%;background:var(--warn)}.bridge-state.ok i{background:var(--accent2)}.bridge-state.bad i{background:var(--danger)}
    @media(max-width:760px){.remote-grid{grid-template-columns:1fr}.remote-controls{grid-template-columns:1fr 1fr}}
  `;
  document.head.appendChild(style);

  function setStatus(text, error=false){
    const el=$('bambuConnectStatus'); if(!el)return;
    el.textContent=text||''; el.style.color=error?'var(--danger)':'var(--muted)';
  }

  async function bridgeHealth(){
    const box=$('bridgeState');
    if(box){box.className='bridge-state';box.innerHTML='<i></i><span>جاري البحث عن Filaments Bridge...</span>';}
    try{
      const controller=new AbortController(); const t=setTimeout(()=>controller.abort(),1800);
      const r=await fetch(`${BRIDGE}/health`,{method:'GET',cache:'no-store',signal:controller.signal}); clearTimeout(t);
      if(!r.ok) throw new Error(`HTTP ${r.status}`);
      const j=await r.json();
      if(box){box.className='bridge-state ok';box.innerHTML=`<i></i><span>Bridge متصل على هذا الماك · ${Number(j.printers||0)} طابعة</span>`;}
      return true;
    }catch(e){
      if(box){box.className='bridge-state bad';box.innerHTML='<i></i><span>Bridge غير قابل للوصول من المتصفح. تأكد أن npm start ما زال شغال.</span>';}
      return false;
    }
  }

  function ensureUi(){
    const page=$('printersPage'); if(!page||$('bambuConnectPanel'))return;
    const panel=document.createElement('div'); panel.id='bambuConnectPanel';panel.className='bambu-connect-panel';
    panel.innerHTML=`<div class="bambu-connect-actions"><div style="flex:1;min-width:190px"><b>🖨 Bambu Remote</b><div class="muted" style="font-size:11px;margin-top:3px">اربط Bambu LAN وبعدها تحكم بالطابعة من أي مكان عبر Filaments Bridge.</div></div><button id="addBambuLan" class="btn">+ ربط Bambu LAN</button></div>`;
    page.insertBefore(panel,page.firstChild);

    const m=document.createElement('div');m.id='bambuConnectModal';m.className='modal';
    m.innerHTML=`<div class="dialog" style="width:min(650px,100%)"><h2>ربط طابعة Bambu LAN</h2><form id="bambuConnectForm"><div class="form-grid"><label>اسم الطابعة<input id="bambuName" required placeholder="A1 Mini 1"></label><label>الموديل<select id="bambuModel"><option>A1 mini</option><option>A1</option><option>P1P</option><option>P1S</option><option>X1</option><option>X1C</option><option>H2D</option><option>H2S</option><option>Other</option></select></label><label>LAN IP<input id="bambuIp" required inputmode="decimal" placeholder="192.168.1.100"></label><label class="span2">Serial Number<input id="bambuSerial" required placeholder="01P00A000000000"></label><label>Access Code<input id="bambuAccess" type="password" required minlength="6" autocomplete="off" placeholder="••••••••"></label><div class="full remote-card"><b>🔒 الأمان</b><div class="muted" style="font-size:11px;margin-top:5px">Access Code يرسل مباشرة إلى Filaments Bridge المحلي ويحفظ على هذا الماك فقط، ولا يتم تخزينه في جدول الطابعات.</div><div id="bridgeState" class="bridge-state"><i></i><span>جاري فحص Bridge...</span></div></div></div><div id="bambuConnectStatus" class="status" style="min-height:22px;margin-top:9px"></div><div class="dialog-actions"><button type="button" id="cancelBambuConnect" class="btn secondary">إلغاء</button><button type="submit" id="saveBambuBtn" class="btn">حفظ وربط</button></div></form></div>`;
    document.body.appendChild(m);

    const r=document.createElement('div');r.id='bambuRemoteModal';r.className='modal';
    r.innerHTML=`<div class="dialog" style="width:min(980px,100%)"><div class="section-title"><h2 id="remotePrinterTitle">Bambu Remote</h2><span id="remoteStatusBadge" class="remote-badge"><i class="remote-dot"></i><span>Offline</span></span></div><div class="remote-grid"><div><div class="remote-screen" id="remoteCamera"><div class="placeholder">📷<br>الكاميرا ستظهر هنا عند إضافة بث الكاميرا للـBridge.</div></div><div class="remote-card" style="margin-top:10px"><div style="display:flex;justify-content:space-between;gap:10px"><div><b id="remoteFile">—</b><div class="muted" id="remoteRemaining">لا توجد طبعة حالية</div></div><b id="remoteProgressText">0%</b></div><div class="bar"><i id="remoteProgressBar" style="width:0%"></i></div></div></div><div><div class="remote-temps"><div class="remote-temp"><span>NOZZLE</span><b id="remoteNozzle">—</b></div><div class="remote-temp"><span>BED</span><b id="remoteBed">—</b></div><div class="remote-temp"><span>CHAMBER</span><b id="remoteChamber">—</b></div></div><div class="remote-card" style="margin-top:10px"><div class="remote-meta"><span>IP</span><b id="remoteIp">—</b><span>Serial</span><b id="remoteSerial">—</b><span>آخر اتصال</span><b id="remoteLastSeen">—</b></div></div><div class="remote-card" style="margin-top:10px"><b>التحكم</b><div class="remote-controls" style="margin-top:9px"><button class="btn" data-remote-command="pause">⏸ Pause</button><button class="btn" data-remote-command="resume">▶ Resume</button><button class="btn danger" data-remote-command="stop">⏹ Stop</button><button class="btn secondary" data-remote-command="speed_standard">⚡ Standard</button></div><div id="remoteCommandStatus" class="status"></div></div></div></div><div class="dialog-actions"><button id="closeBambuRemote" class="btn secondary">إغلاق</button></div></div>`;
    document.body.appendChild(r);

    $('addBambuLan').onclick=()=>{$('bambuConnectForm').reset();setStatus('');$('bambuConnectModal').classList.add('show');bridgeHealth();};
    $('cancelBambuConnect').onclick=()=>$('bambuConnectModal').classList.remove('show');
    $('closeBambuRemote').onclick=closeRemote;
    $('bambuConnectForm').addEventListener('submit',saveBambuPrinter,true);
    r.querySelectorAll('[data-remote-command]').forEach(b=>b.onclick=()=>queueCommand(b.dataset.remoteCommand));
  }

  async function findExisting(name){
    const {data}=await db.from('printers').select('id,name,connection_type').order('created_at',{ascending:true});
    return (data||[]).find(p=>String(p.name||'').trim().toLowerCase()===String(name||'').trim().toLowerCase())||null;
  }

  async function saveBambuPrinter(e){
    e.preventDefault(); e.stopImmediatePropagation();
    const btn=$('saveBambuBtn'); if(btn.disabled)return;
    const name=$('bambuName').value.trim(),ip=$('bambuIp').value.trim(),serial=$('bambuSerial').value.trim(),access=$('bambuAccess').value.trim();
    if(!name||!ip||!serial||!access){setStatus('أكمل جميع البيانات أولاً.',true);return;}
    btn.disabled=true;btn.textContent='جاري الربط...';setStatus('1/3 جاري حفظ بيانات الطابعة...');
    try{
      const payload={name,model:$('bambuModel').value,status:'offline',connection_type:'bambu_lan',lan_ip:ip,serial_number:serial,remote_enabled:true,notes:'Bambu LAN remote enabled'};
      const existing=await findExisting(name);
      let printerId;
      if(existing){
        const {data,error}=await db.from('printers').update(payload).eq('id',existing.id).select('id').single();
        if(error)throw new Error(`الحفظ: ${error.message}`); printerId=data.id;
      }else{
        const {data,error}=await db.from('printers').insert(payload).select('id').single();
        if(error)throw new Error(`الحفظ: ${error.message}`); printerId=data.id;
      }

      setStatus('2/3 تم الحفظ. جاري الاتصال بالـBridge...');
      const {data:{session}}=await db.auth.getSession();
      if(!session)throw new Error('جلسة الدخول غير موجودة. سجل خروج ثم دخول وحاول مرة ثانية.');

      let bridgeReply;
      try{
        const controller=new AbortController();const t=setTimeout(()=>controller.abort(),5000);
        const resp=await fetch(`${BRIDGE}/pair`,{
          method:'POST',headers:{'Content-Type':'application/json'},signal:controller.signal,
          body:JSON.stringify({printer_id:printerId,name,lan_ip:ip,serial_number:serial,access_code:access,access_token:session.access_token,refresh_token:session.refresh_token})
        });clearTimeout(t);
        bridgeReply=await resp.json().catch(()=>({}));
        if(!resp.ok)throw new Error(bridgeReply.error||`Bridge HTTP ${resp.status}`);
      }catch(err){
        setStatus(`تم حفظ الطابعة، لكن لم نقدر نوصل للـBridge: ${err.message}. افتح http://127.0.0.1:18473/health في Safari وتأكد أنه يفتح.`,true);
        btn.disabled=false;btn.textContent='إعادة محاولة الربط';return;
      }

      setStatus('3/3 تم إرسال البيانات للـBridge. انتظر اتصال الطابعة...');
      try{localStorage.removeItem(`filaments_bambu_secret_${printerId}`);}catch{}
      setTimeout(()=>location.reload(),1600);
    }catch(err){
      setStatus(err.message||String(err),true);btn.disabled=false;btn.textContent='حفظ وربط';
    }
  }

  async function loadRemotePrinters(){const {data}=await db.from('printers').select('id,name,model,status,connection_type,lan_ip,serial_number,remote_enabled,last_seen_at,nozzle_temp,nozzle_target,bed_temp,bed_target,chamber_temp,print_progress,remaining_minutes,current_file').eq('connection_type','bambu_lan');return data||[];}
  async function decorateCards(){const rows=await loadRemotePrinters();for(const p of rows){const edit=document.querySelector(`[data-edit-printer="${CSS.escape(p.id)}"]`),card=edit?.closest('.printer');if(!card)continue;if(!card.querySelector('[data-bambu-remote]')){const actions=card.querySelector('.actions'),btn=document.createElement('button');btn.className='btn secondary small';btn.dataset.bambuRemote=p.id;btn.textContent='🎛 تحكم';actions?.prepend(btn);btn.onclick=()=>openRemote(p.id);}let badge=card.querySelector('.remote-badge');if(!badge){badge=document.createElement('span');badge.className='remote-badge';card.querySelector('.section-title')?.appendChild(badge);}const online=p.last_seen_at&&Date.now()-new Date(p.last_seen_at).getTime()<30000;badge.innerHTML=`<i class="remote-dot ${online?'on':''}"></i><span>${online?'Remote Online':'Remote Offline'}</span>`;}}
  function temp(v,target){if(v==null)return'—';return`${Math.round(Number(v))}°${target!=null?` / ${Math.round(Number(target))}°`:''}`;}function ago(v){if(!v)return'—';const s=Math.max(0,Math.round((Date.now()-new Date(v).getTime())/1000));return s<60?`${s}ث`:s<3600?`${Math.floor(s/60)}د`:`${Math.floor(s/3600)}س`;}
  async function openRemote(id){const {data:p}=await db.from('printers').select('*').eq('id',id).maybeSingle();if(!p)return;selectedPrinter=p;$('bambuRemoteModal').classList.add('show');renderRemote(p);clearInterval(refreshTimer);refreshTimer=setInterval(refreshRemote,1500);}function closeRemote(){$('bambuRemoteModal').classList.remove('show');clearInterval(refreshTimer);refreshTimer=null;selectedPrinter=null;}async function refreshRemote(){if(!selectedPrinter)return;const {data:p}=await db.from('printers').select('*').eq('id',selectedPrinter.id).maybeSingle();if(p){selectedPrinter=p;renderRemote(p);}}
  function renderRemote(p){$('remotePrinterTitle').textContent=p.name||'Bambu Remote';const online=p.last_seen_at&&Date.now()-new Date(p.last_seen_at).getTime()<30000;$('remoteStatusBadge').innerHTML=`<i class="remote-dot ${online?'on':''}"></i><span>${online?'Online':'Offline'}</span>`;$('remoteNozzle').textContent=temp(p.nozzle_temp,p.nozzle_target);$('remoteBed').textContent=temp(p.bed_temp,p.bed_target);$('remoteChamber').textContent=temp(p.chamber_temp,null);$('remoteIp').textContent=p.lan_ip||'—';$('remoteSerial').textContent=p.serial_number||'—';$('remoteLastSeen').textContent=ago(p.last_seen_at);const progress=Math.max(0,Math.min(100,Number(p.print_progress)||0));$('remoteProgressText').textContent=`${Math.round(progress)}%`;$('remoteProgressBar').style.width=`${progress}%`;$('remoteFile').textContent=p.current_file||'—';$('remoteRemaining').textContent=p.remaining_minutes!=null?`${p.remaining_minutes} دقيقة متبقية`:'لا توجد بيانات وقت';}
  async function queueCommand(command){if(!selectedPrinter)return;if(command==='stop'&&!confirm(`إيقاف الطباعة على ${selectedPrinter.name}؟`))return;const map={pause:['pause',{}],resume:['resume',{}],stop:['stop',{}],speed_standard:['print_speed',{level:2}]},item=map[command];if(!item)return;$('remoteCommandStatus').textContent='إرسال الأمر...';const {error}=await db.from('printer_commands').insert({printer_id:selectedPrinter.id,command:item[0],payload:item[1]});$('remoteCommandStatus').textContent=error?error.message:'تم وضع الأمر في قائمة التنفيذ.';}
  function watch(){ensureUi();db.auth.getSession().then(({data})=>{if(data.session)decorateCards();});const grid=$('printerGrid');if(grid){let t;new MutationObserver(()=>{clearTimeout(t);t=setTimeout(decorateCards,80)}).observe(grid,{childList:true,subtree:true});}setInterval(decorateCards,5000);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',watch,{once:true});else watch();
})();
