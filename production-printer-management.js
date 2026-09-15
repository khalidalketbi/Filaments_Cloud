(() => {
  const cfg=window.APP_CONFIG||{};
  if(!window.supabase||!cfg.SUPABASE_URL||!cfg.SUPABASE_ANON_KEY) return;
  const db=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  const KEY='fm_current_project_id';
  let busy=false;

  function style(){
    if(document.getElementById('prodPrinterManageStyle')) return;
    const s=document.createElement('style'); s.id='prodPrinterManageStyle';
    s.textContent=`
      #productionPage .printer-manage-bar{display:flex;justify-content:flex-end;gap:8px;margin:0 0 10px;flex-wrap:wrap}
      #productionPage .printer-add-btn{min-height:40px}
      #productionPage .printer-remove-btn{width:100%;margin-top:8px;min-height:38px;border-radius:10px;border:1px solid color-mix(in srgb,var(--warn) 55%,var(--line));background:color-mix(in srgb,var(--warn) 9%,var(--card2));color:inherit;font-weight:800}
      #printerManageModal .dialog{width:min(460px,100%)}
      #printerManageModal .pmgr-actions{display:flex;gap:8px;justify-content:flex-end;margin-top:14px}
    `; document.head.appendChild(s);
  }

  function ensureModal(){
    if(document.getElementById('printerManageModal')) return;
    const m=document.createElement('div'); m.id='printerManageModal'; m.className='modal';
    m.innerHTML=`<div class="dialog"><h2>إضافة طابعة</h2><div class="form-grid"><label>اسم الطابعة<input id="pmgrName" placeholder="مثال: M6 أو A3"></label><label>الفلمنت المتبقي g<input id="pmgrGrams" type="number" min="0" step="1" value="1000"></label><label class="span2">اسم/لون السبول<input id="pmgrSpool" value="PLA Green"></label></div><div id="pmgrStatus" class="status"></div><div class="pmgr-actions"><button id="pmgrCancel" class="btn secondary">إلغاء</button><button id="pmgrSave" class="btn">إضافة الطابعة</button></div></div>`;
    document.body.appendChild(m);
    document.getElementById('pmgrCancel').onclick=()=>m.classList.remove('show');
    document.getElementById('pmgrSave').onclick=addPrinter;
  }

  function printerName(card){
    return (card.querySelector('.printer-name')?.value || card.querySelector('.prod-num')?.textContent || card.querySelector('h3')?.textContent || '').trim();
  }

  async function addPrinter(){
    if(busy) return;
    const projectId=localStorage.getItem(KEY), st=document.getElementById('pmgrStatus');
    const name=document.getElementById('pmgrName').value.trim();
    const grams=Math.max(0,Number(document.getElementById('pmgrGrams').value)||0);
    const spool=document.getElementById('pmgrSpool').value.trim();
    if(!projectId){st.textContent='اختر مشروع أولاً.';return;}
    if(!name){st.textContent='اكتب اسم الطابعة.';return;}
    busy=true; st.textContent='جاري الإضافة…';
    const {error}=await db.from('production_assignments').insert({project_id:projectId,printer_name:name,status:'idle',remaining_g:grams,spool_name:spool||null});
    busy=false;
    if(error){
      st.textContent=error.code==='23505'?'هذه الطابعة موجودة في المشروع بالفعل.':'فشل الإضافة: '+error.message;
      return;
    }
    st.textContent='تمت إضافة الطابعة.';
    setTimeout(()=>location.reload(),350);
  }

  async function removePrinter(card,btn){
    if(busy) return;
    const projectId=localStorage.getItem(KEY), name=printerName(card);
    if(!projectId||!name) return;
    const state=(card.querySelector('.status-select')?.value||'').trim();
    const warning=state==='printing'?'\nتنبيه: الطابعة ظاهرة حالياً أنها تطبع. حذفها لن يحسب الطبعة كمكتملة.':'';
    if(!confirm(`هل تريد حذف الطابعة ${name} من هذا المشروع؟${warning}\n\nسجل الطبعات القديمة لن يتم حذفه.`)) return;
    busy=true; btn.disabled=true; const old=btn.textContent; btn.textContent='جاري الحذف…';
    const {error}=await db.from('production_assignments').delete().eq('project_id',projectId).eq('printer_name',name);
    busy=false;
    if(error){alert('فشل الحذف: '+error.message);btn.disabled=false;btn.textContent=old;return;}
    card.remove();
    setTimeout(()=>location.reload(),250);
  }

  function enhance(){
    style(); ensureModal();
    const grid=document.getElementById('prodPrinterGrid');
    if(grid && !document.getElementById('printerManageBar')){
      const bar=document.createElement('div'); bar.id='printerManageBar'; bar.className='printer-manage-bar';
      bar.innerHTML='<button type="button" class="btn printer-add-btn" id="printerAddBtn">+ إضافة طابعة</button>';
      grid.parentElement?.insertBefore(bar,grid);
      document.getElementById('printerAddBtn').onclick=()=>{
        document.getElementById('pmgrName').value='';
        document.getElementById('pmgrGrams').value='1000';
        document.getElementById('pmgrSpool').value='PLA Green';
        document.getElementById('pmgrStatus').textContent='';
        document.getElementById('printerManageModal').classList.add('show');
      };
    }
    document.querySelectorAll('#prodPrinterGrid .prod-printer-card').forEach(card=>{
      if(card.querySelector('.printer-remove-btn')) return;
      const b=document.createElement('button'); b.type='button'; b.className='printer-remove-btn'; b.textContent='− حذف الطابعة من المشروع';
      b.onclick=()=>removePrinter(card,b);
      card.appendChild(b);
    });
  }

  function boot(){
    enhance();
    const root=document.getElementById('productionPage')||document.body;
    let t=null;
    new MutationObserver(()=>{clearTimeout(t);t=setTimeout(enhance,80);}).observe(root,{childList:true,subtree:true});
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();
})();