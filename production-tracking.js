(() => {
  const cfg = window.APP_CONFIG || {};
  if (!window.supabase || !cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) return;
  const db = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  const defaults = [
    [1,57,0],[2,231,10],[3,109,1],[4,129,0],[5,128,0],[6,138,12],[7,47,1],[8,120,1]
  ];
  let project = null, plates = [];
  const esc = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const n = v => Number(v)||0;

  function injectUI(){
    if(document.getElementById('productionPage')) return;
    const nav = document.querySelector('.nav');
    const settings = nav?.querySelector('[data-page="settings"]');
    const btn = document.createElement('button');
    btn.dataset.page='production'; btn.textContent='▤ الإنتاج';
    if(settings) nav.insertBefore(btn,settings); else nav?.appendChild(btn);
    const main = document.querySelector('main.main');
    const section = document.createElement('section');
    section.id='productionPage'; section.className='page hidden';
    section.innerHTML=`<div class="panel"><div class="section-title"><h2>مشروع Plate 1–8</h2><span class="muted">10 من كل Plate = 10 أطقم</span></div><div id="prodKpis" class="kpis"></div><div id="prodProgress" class="panel" style="margin-bottom:14px"></div><div id="prodGrid" class="spool-grid"></div><div id="prodStatus" class="status"></div></div>`;
    main?.appendChild(section);
    const style=document.createElement('style'); style.textContent=`
      #productionPage .prod-card{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:14px}
      #productionPage .prod-top{display:flex;align-items:center;justify-content:space-between;gap:10px}
      #productionPage .prod-num{font-weight:900;font-size:18px}.prod-done{font-size:24px;font-weight:900}
      #productionPage .prod-controls{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}
      #productionPage .prod-controls label{font-size:10px}.prod-controls input{min-height:38px;padding:8px}
      #productionPage .prod-save{width:100%;margin-top:9px}.prod-over{color:var(--accent2);font-weight:800}
      #productionPage .prod-progressbar{height:12px;border-radius:99px;background:var(--card2);overflow:hidden;margin-top:8px}.prod-progressbar i{display:block;height:100%;background:var(--accent)}
    `;document.head.appendChild(style);

    document.addEventListener('click',e=>{
      const b=e.target.closest('.nav [data-page]'); if(!b) return;
      if(b.dataset.page==='production'){
        document.querySelectorAll('.page').forEach(x=>x.classList.add('hidden'));
        section.classList.remove('hidden');
        document.querySelectorAll('.nav button').forEach(x=>x.classList.remove('active')); b.classList.add('active');
        const title=document.getElementById('pageTitle'); if(title) title.textContent='الإنتاج';
        load();
      }
    });
  }

  async function ensureProject(user){
    let {data:p}=await db.from('production_projects').select('*').eq('user_id',user.id).eq('name','Plate 1-8').maybeSingle();
    if(!p){
      const r=await db.from('production_projects').insert({user_id:user.id,name:'Plate 1-8',target_sets:10}).select().single();
      if(r.error) throw r.error; p=r.data;
    }
    project=p;
    const q=await db.from('production_plates').select('*').eq('project_id',p.id).order('plate_no');
    if(q.error) throw q.error;
    if((q.data||[]).length===0){
      const rows=defaults.map(([plate_no,weight_g,completed_qty])=>({project_id:p.id,plate_no,weight_g,target_qty:10,completed_qty}));
      const ins=await db.from('production_plates').insert(rows).select(); if(ins.error) throw ins.error; plates=ins.data||[];
    } else plates=q.data||[];
  }

  function render(){
    const totalTarget=plates.reduce((a,p)=>a+n(p.target_qty),0);
    const completed=plates.reduce((a,p)=>a+n(p.completed_qty),0);
    const capped=plates.reduce((a,p)=>a+Math.min(n(p.completed_qty),n(p.target_qty)),0);
    const remainingQty=plates.reduce((a,p)=>a+Math.max(0,n(p.target_qty)-n(p.completed_qty)),0);
    const remainingG=plates.reduce((a,p)=>a+Math.max(0,n(p.target_qty)-n(p.completed_qty))*n(p.weight_g),0);
    const doneSets=plates.length?Math.min(...plates.map(p=>n(p.completed_qty))):0;
    const remainingMin=plates.reduce((a,p)=>a+Math.max(0,n(p.target_qty)-n(p.completed_qty))*n(p.print_minutes),0);
    const pct=totalTarget?Math.round(capped/totalTarget*100):0;
    document.getElementById('prodKpis').innerHTML=`
      <div class="kpi"><span>المنجز</span><strong>${completed}</strong><small>من ${totalTarget} قطعة</small></div>
      <div class="kpi"><span>الأطقم المكتملة</span><strong>${Math.min(doneSets,10)}</strong><small>من 10 أطقم</small></div>
      <div class="kpi"><span>المتبقي</span><strong>${remainingQty}</strong><small>${remainingG.toFixed(0)} g</small></div>
      <div class="kpi"><span>نسبة الإنجاز</span><strong>${pct}%</strong><small>على أساس 80 قطعة</small></div>
      <div class="kpi"><span>وقت الطباعة المتبقي</span><strong>${remainingMin?`${Math.floor(remainingMin/60)}س ${remainingMin%60}د`:'—'}</strong><small>حسب الأوقات المسجلة</small></div>`;
    document.getElementById('prodProgress').innerHTML=`<b>التقدم الكلي ${pct}%</b><div class="prod-progressbar"><i style="width:${pct}%"></i></div>`;
    document.getElementById('prodGrid').innerHTML=plates.map(p=>{
      const rem=Math.max(0,n(p.target_qty)-n(p.completed_qty)), over=Math.max(0,n(p.completed_qty)-n(p.target_qty));
      return `<div class="prod-card" data-id="${p.id}"><div class="prod-top"><div><div class="prod-num">Plate ${p.plate_no}</div><div class="muted">${n(p.weight_g)} g للقطعة · ${rem} متبقي</div></div><div class="prod-done">${n(p.completed_qty)}/${n(p.target_qty)}</div></div>${over?`<div class="prod-over">+${over} زيادة عن المطلوب</div>`:''}<div class="prod-progressbar"><i style="width:${Math.min(100,n(p.completed_qty)/n(p.target_qty)*100)}%"></i></div><div class="prod-controls"><label>المنجز<input class="qty" type="number" min="0" value="${n(p.completed_qty)}"></label><label>وقت القطعة بالدقائق<input class="mins" type="number" min="0" value="${p.print_minutes??''}" placeholder="مثال 95"></label></div><button class="btn small prod-save">حفظ</button></div>`;
    }).join('');
    document.querySelectorAll('.prod-save').forEach(b=>b.onclick=saveCard);
  }

  async function saveCard(e){
    const card=e.currentTarget.closest('.prod-card'), id=card.dataset.id;
    const completed_qty=Math.max(0,parseInt(card.querySelector('.qty').value||'0',10));
    const raw=card.querySelector('.mins').value.trim(); const print_minutes=raw===''?null:Math.max(0,parseInt(raw,10));
    const st=document.getElementById('prodStatus'); st.textContent='جاري الحفظ…';
    const r=await db.from('production_plates').update({completed_qty,print_minutes,updated_at:new Date().toISOString()}).eq('id',id).select();
    if(r.error){st.textContent='تعذر الحفظ: '+r.error.message;return;} st.textContent='تم الحفظ'; await load();
  }

  async function load(){
    const st=document.getElementById('prodStatus'); if(!st) return;
    const {data:{session}}=await db.auth.getSession(); if(!session?.user){st.textContent='سجل الدخول لعرض المشروع.';return;}
    try{await ensureProject(session.user); render(); st.textContent='';}catch(err){st.textContent='خطأ: '+(err?.message||err);}
  }

  function boot(){injectUI();}
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();
})();