(() => {
  const cfg=window.APP_CONFIG||{};
  if(!window.supabase||!cfg.SUPABASE_URL||!cfg.SUPABASE_ANON_KEY)return;
  const db=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  const $=id=>document.getElementById(id);
  const BRIDGE='http://127.0.0.1:18473';

  function status(text,error=false){const e=$('bambuConnectStatus');if(!e)return;e.textContent=text||'';e.style.color=error?'var(--danger)':'var(--muted)';}
  function bridgeReadyMessage(){const box=$('bridgeState');if(!box)return;box.className='bridge-state';box.innerHTML='<i style="background:var(--accent)"></i><span>عند الضغط على حفظ وربط سنفتح Filaments Bridge المحلي لإكمال الربط.</span>';}

  async function findExisting(name){
    const {data}=await db.from('printers').select('id,name').order('created_at',{ascending:true});
    return (data||[]).find(p=>String(p.name||'').trim().toLowerCase()===String(name||'').trim().toLowerCase())||null;
  }

  async function submit(e){
    e.preventDefault();e.stopPropagation();
    const btn=$('saveBambuBtn');if(!btn||btn.disabled)return;
    const name=$('bambuName')?.value.trim(),ip=$('bambuIp')?.value.trim(),serial=$('bambuSerial')?.value.trim(),access=$('bambuAccess')?.value.trim();
    if(!name||!ip||!serial||!access){status('أكمل جميع البيانات أولاً.',true);return;}
    btn.disabled=true;btn.textContent='جاري التجهيز...';status('جاري حفظ بيانات الطابعة...');
    try{
      const payload={name,model:$('bambuModel')?.value||'Bambu',status:'offline',connection_type:'bambu_lan',lan_ip:ip,serial_number:serial,remote_enabled:true,notes:'Bambu LAN remote enabled'};
      const existing=await findExisting(name);let printerId;
      if(existing){const {data,error}=await db.from('printers').update(payload).eq('id',existing.id).select('id').single();if(error)throw error;printerId=data.id;}
      else{const {data,error}=await db.from('printers').insert(payload).select('id').single();if(error)throw error;printerId=data.id;}
      const {data:{session}}=await db.auth.getSession();
      if(!session)throw new Error('جلسة الدخول غير موجودة. سجل خروج ثم دخول وحاول مرة ثانية.');
      const pair={printer_id:printerId,name,lan_ip:ip,serial_number:serial,access_code:access,access_token:session.access_token,refresh_token:session.refresh_token};
      const url=`${BRIDGE}/pair-setup#${encodeURIComponent(JSON.stringify(pair))}`;
      status('تم الحفظ. سيتم فتح Filaments Bridge المحلي الآن...');
      setTimeout(()=>{window.location.href=url;},150);
    }catch(err){status(`فشل الحفظ: ${err.message||err}`,true);btn.disabled=false;btn.textContent='حفظ وربط';}
  }

  function install(){
    const old=$('bambuConnectForm');if(!old||old.dataset.safariPairing==='1')return false;
    const form=old.cloneNode(true);form.dataset.safariPairing='1';old.replaceWith(form);
    form.addEventListener('submit',submit);
    const cancel=$('cancelBambuConnect');if(cancel)cancel.onclick=()=>$('bambuConnectModal')?.classList.remove('show');
    bridgeReadyMessage();
    const add=$('addBambuLan');if(add)add.onclick=()=>{$('bambuConnectForm')?.reset();status('');$('bambuConnectModal')?.classList.add('show');setTimeout(bridgeReadyMessage,0);};
    return true;
  }

  let tries=0;const t=setInterval(()=>{tries++;if(install()||tries>40)clearInterval(t);},100);
})();
