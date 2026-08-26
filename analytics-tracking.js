(() => {
  const cfg=window.APP_CONFIG||{};
  if(!window.supabase||!cfg.SUPABASE_URL||!cfg.SUPABASE_ANON_KEY)return;
  const db=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  let sessionId=sessionStorage.getItem('fm_analytics_session_id')||'';
  let lastPage='';
  let timer=null;

  const page=()=>document.querySelector('.nav button.active')?.dataset?.page||document.querySelector('.page:not(.hidden)')?.id||'app';
  async function user(){const {data:{session}}=await db.auth.getSession();return session?.user||null}

  async function ensureSession(){
    const u=await user(); if(!u)return null;
    if(sessionId){
      const {data}=await db.from('user_sessions').select('id').eq('id',sessionId).eq('user_id',u.id).maybeSingle();
      if(data)return u;
      sessionId='';sessionStorage.removeItem('fm_analytics_session_id');
    }
    const p=page();
    const {data,error}=await db.from('user_sessions').insert({
      user_id:u.id,user_agent:navigator.userAgent,platform:navigator.platform||'',timezone:Intl.DateTimeFormat().resolvedOptions().timeZone||'',language:document.documentElement.lang||navigator.language||'',entry_page:p,last_page:p,page_views:1
    }).select('id').single();
    if(error)return null;
    sessionId=data.id;sessionStorage.setItem('fm_analytics_session_id',sessionId);lastPage=p;
    await db.from('user_page_events').insert({user_id:u.id,session_id:sessionId,page:p});
    return u;
  }

  async function heartbeat(){
    const u=await ensureSession();if(!u||!sessionId)return;
    const p=page(),changed=p!==lastPage;
    await db.from('user_sessions').update({last_seen:new Date().toISOString(),last_page:p,...(changed?{page_views:undefined}:{})}).eq('id',sessionId).eq('user_id',u.id);
    if(changed){
      const {data:s}=await db.from('user_sessions').select('page_views').eq('id',sessionId).maybeSingle();
      await db.from('user_sessions').update({last_seen:new Date().toISOString(),last_page:p,page_views:Number(s?.page_views||0)+1}).eq('id',sessionId).eq('user_id',u.id);
      await db.from('user_page_events').insert({user_id:u.id,session_id:sessionId,page:p});
      lastPage=p;
    }
  }

  async function endSession(){
    if(!sessionId)return;
    try{const u=await user();if(!u)return;await db.from('user_sessions').update({last_seen:new Date().toISOString(),ended_at:new Date().toISOString(),last_page:page()}).eq('id',sessionId).eq('user_id',u.id)}catch{}
  }

  function start(){
    ensureSession().then(()=>heartbeat());
    if(timer)clearInterval(timer);timer=setInterval(()=>{if(!document.hidden)heartbeat()},60000);
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)heartbeat()});
    window.addEventListener('focus',heartbeat);
    document.addEventListener('click',e=>{if(e.target.closest('.nav button,[data-page]'))setTimeout(heartbeat,80)},true);
    window.addEventListener('pagehide',endSession);
    window.addEventListener('beforeunload',endSession);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
