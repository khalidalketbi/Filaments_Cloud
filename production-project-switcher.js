(() => {
  const cfg=window.APP_CONFIG||{};
  if(!window.supabase||!cfg.SUPABASE_URL||!cfg.SUPABASE_ANON_KEY)return;
  const db=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  const KEY='fm_current_project_id';
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function style(){
    if(document.getElementById('globalProjectSwitcherStyle'))return;
    const s=document.createElement('style');s.id='globalProjectSwitcherStyle';s.textContent=`
      .global-project-switcher{display:flex;align-items:center;gap:8px;margin:8px 0 12px;padding:9px 11px;border:1px solid var(--line);border-radius:14px;background:var(--panel)}
      .global-project-switcher label{font-size:11px;color:var(--muted);white-space:nowrap}
      .global-project-switcher select{flex:1;min-width:0;min-height:40px}
      @media(max-width:700px){.global-project-switcher{margin:6px 0 10px}.global-project-switcher label{display:none}}
    `;document.head.appendChild(s);
  }

  function host(){
    return document.querySelector('main.main') || document.querySelector('.main') || document.body;
  }

  async function load(){
    const {data:{session}}=await db.auth.getSession();
    if(!session?.user)return;
    const {data,error}=await db.from('production_projects').select('id,name,created_at').eq('user_id',session.user.id).order('created_at',{ascending:true});
    if(error)return;
    const projects=data||[];
    let wrap=document.getElementById('globalProjectSwitcher');
    if(!wrap){
      wrap=document.createElement('div');wrap.id='globalProjectSwitcher';wrap.className='global-project-switcher';
      wrap.innerHTML='<label>المشروع الحالي</label><select id="globalProjectSelect"></select>';
      const h=host();
      const firstPage=h.querySelector('.page');
      if(firstPage)h.insertBefore(wrap,firstPage);else h.prepend(wrap);
    }
    const sel=document.getElementById('globalProjectSelect');
    if(!sel)return;
    sel.innerHTML=projects.map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join('');
    if(!projects.length){wrap.style.display='none';return;}else wrap.style.display='flex';
    let current=localStorage.getItem(KEY);
    if(!projects.some(p=>p.id===current))current=projects[0].id;
    localStorage.setItem(KEY,current);
    sel.value=current;
    sel.onchange=()=>{
      localStorage.setItem(KEY,sel.value);
      location.reload();
    };
  }

  function boot(){style();load();setTimeout(load,800);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();