(() => {
  const cfg=window.APP_CONFIG||{}; if(!window.supabase||!cfg.SUPABASE_URL||!cfg.SUPABASE_ANON_KEY)return;
  const db=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  let timer=null;
  const currentPage=()=>document.querySelector('.nav button.active')?.dataset?.page||document.querySelector('.page:not(.hidden)')?.id||'app';
  async function ping(){
    try{
      const {data:{session}}=await db.auth.getSession(); const u=session?.user;if(!u)return;
      await db.from('user_presence').upsert({user_id:u.id,last_seen:new Date().toISOString(),current_page:currentPage(),user_agent:navigator.userAgent,updated_at:new Date().toISOString()},{onConflict:'user_id'});
    }catch(_){}
  }
  function start(){if(timer)clearInterval(timer);ping();timer=setInterval(()=>{if(!document.hidden)ping()},60000)}
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)ping()});
  window.addEventListener('focus',ping);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();