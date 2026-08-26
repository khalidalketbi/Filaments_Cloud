(() => {
  const cfg=window.APP_CONFIG||{};
  if(!window.supabase||!cfg.SUPABASE_URL||!cfg.SUPABASE_ANON_KEY)return;
  const db=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  const $=id=>document.getElementById(id);

  async function pair(e){
    const form=$('bambuConnectForm');
    if(!form||e.target!==form)return;
    e.preventDefault();e.stopImmediatePropagation();
    const out=$('bambuConnectStatus');
    const name=$('bambuName')?.value.trim(),ip=$('bambuIp')?.value.trim(),serial=$('bambuSerial')?.value.trim(),access=$('bambuAccess')?.value.trim();
    if(!name||!ip||!serial||!access)return;
    out.textContent='جاري فحص Filaments Bridge...';
    let health=false;
    try{const r=await fetch('http://127.0.0.1:18473/health',{cache:'no-store'});health=r.ok;}catch{}
    if(!health){
      out.innerHTML='Filaments Bridge غير شغال على هذا الجهاز. شغّله أولاً ثم اضغط حفظ وربط مرة ثانية. <b>لن يتم إرسال Access Code إلى السحابة.</b>';
      return;
    }
    const {data:sessionData}=await db.auth.getSession();
    const session=sessionData.session;
    if(!session){out.textContent='الجلسة انتهت. سجل الدخول مرة ثانية.';return;}
    out.textContent='جاري إضافة الطابعة...';
    const payload={name,model:$('bambuModel')?.value||'Bambu',status:'offline',connection_type:'bambu_lan',lan_ip:ip,serial_number:serial,remote_enabled:true,notes:'Bambu LAN via Filaments Bridge'};
    const {data,error}=await db.from('printers').insert(payload).select('id').single();
    if(error){out.textContent=error.message;return;}
    try{
      const r=await fetch('http://127.0.0.1:18473/pair',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({printer_id:data.id,name,lan_ip:ip,serial_number:serial,access_code:access,access_token:session.access_token,refresh_token:session.refresh_token})});
      const j=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(j.error||'Pairing failed');
      out.textContent='✅ تم الربط. الـ Bridge يحاول الاتصال بالطابعة الآن.';
      setTimeout(()=>location.reload(),900);
    }catch(err){
      await db.from('printers').delete().eq('id',data.id);
      out.textContent=`فشل الربط مع Bridge: ${err.message}`;
    }
  }

  function install(){
    document.addEventListener('submit',pair,true);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
