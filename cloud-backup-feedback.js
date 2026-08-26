(() => {
  const cfg = window.APP_CONFIG || {};
  if (!window.supabase || !cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) return;
  const db = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const MAX_FILE = 10 * 1024 * 1024;

  function en(){ return document.documentElement.lang === 'en'; }
  function t(ar,enText){ return en() ? enText : ar; }
  function fileStamp(){
    const d=new Date();
    const p=n=>String(n).padStart(2,'0');
    return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}`;
  }
  function downloadJson(obj,name){
    const blob=new Blob([JSON.stringify(obj,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url;a.download=name;a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  async function user(){ const {data:{session}}=await db.auth.getSession(); return session?.user||null; }

  async function snapshot(){
    const u=await user(); if(!u) throw new Error('Not signed in');
    const [sp,pr,lg,pf]=await Promise.all([
      db.from('spools').select('*').order('created_at'),
      db.from('printers').select('*').order('created_at'),
      db.from('usage_logs').select('*').order('created_at'),
      db.from('user_preferences').select('*').eq('user_id',u.id).maybeSingle()
    ]);
    for(const r of [sp,pr,lg,pf]) if(r.error) throw r.error;
    return {
      format:'filaments-manger-backup',version:2,
      exported_at:new Date().toISOString(),
      timezone:Intl.DateTimeFormat().resolvedOptions().timeZone,
      counts:{spools:sp.data?.length||0,printers:pr.data?.length||0,usage_logs:lg.data?.length||0},
      data:{spools:sp.data||[],printers:pr.data||[],usage_logs:lg.data||[],preferences:pf.data||null}
    };
  }

  async function createCloudBackup(){
    const msg=$('cloudBackupStatus'); const btn=$('cloudBackupNow');
    try{
      btn.disabled=true; msg.textContent=t('جاري إنشاء النسخة...','Creating backup…');
      const u=await user(); const snap=await snapshot();
      const {error}=await db.from('cloud_backups').insert({user_id:u.id,name:`Backup ${new Date().toLocaleString()}`,snapshot:snap});
      if(error)throw error;
      msg.textContent=t('✅ تم حفظ نسخة في الـCloud.','✅ Cloud backup saved.');
      await loadCloudBackups();
    }catch(e){console.error(e);msg.textContent=t('تعذر إنشاء النسخة.','Could not create backup.');}
    finally{btn.disabled=false;}
  }

  async function loadCloudBackups(){
    const box=$('cloudBackupList'); if(!box)return;
    const {data,error}=await db.from('cloud_backups').select('id,name,created_at,snapshot').order('created_at',{ascending:false}).limit(20);
    if(error){box.innerHTML=`<div class="muted">${t('تعذر تحميل النسخ.','Could not load backups.')}</div>`;return;}
    if(!data?.length){box.innerHTML=`<div class="muted">${t('لا توجد نسخ Cloud بعد.','No cloud backups yet.')}</div>`;return;}
    box.innerHTML=data.map(b=>{
      const c=b.snapshot?.counts||{};
      return `<div class="cb-row" data-backup="${b.id}"><div><b>${esc(new Date(b.created_at).toLocaleString(en()?'en-US':'ar-AE'))}</b><div class="muted">${c.spools||0} ${t('سبول','spools')} · ${c.printers||0} ${t('طابعة','printers')} · ${c.usage_logs||0} ${t('سجل','logs')}</div></div><div class="actions"><button class="btn secondary cb-download" type="button">${t('تنزيل','Download')}</button><button class="btn secondary cb-restore" type="button">${t('استعادة','Restore')}</button><button class="btn danger cb-delete" type="button">${t('حذف','Delete')}</button></div></div>`;
    }).join('');
    data.forEach(b=>{
      const row=box.querySelector(`[data-backup="${b.id}"]`);
      row?.querySelector('.cb-download')?.addEventListener('click',()=>downloadJson(b.snapshot,`filaments-manger-cloud-backup_${fileStamp()}.json`));
      row?.querySelector('.cb-delete')?.addEventListener('click',()=>deleteCloudBackup(b.id));
      row?.querySelector('.cb-restore')?.addEventListener('click',()=>restoreSnapshot(b.snapshot));
    });
  }

  async function deleteCloudBackup(id){
    if(!confirm(t('حذف هذه النسخة من الـCloud؟','Delete this cloud backup?')))return;
    const {error}=await db.from('cloud_backups').delete().eq('id',id); if(error)return alert(error.message); loadCloudBackups();
  }

  async function restoreSnapshot(snap){
    if(!snap?.data) return alert(t('ملف النسخة غير صالح.','Invalid backup.'));
    if(!confirm(t('سيتم استبدال بياناتك الحالية بهذه النسخة. هل أنت متأكد؟','Your current data will be replaced by this backup. Continue?')))return;
    const msg=$('cloudBackupStatus'); msg.textContent=t('جاري الاستعادة...','Restoring…');
    try{
      const u=await user();
      const sp=(snap.data.spools||[]).map(x=>({...x,user_id:u.id}));
      const pr=(snap.data.printers||[]).map(x=>({...x,user_id:u.id}));
      const lg=(snap.data.usage_logs||[]).map(x=>({...x,user_id:u.id}));
      // Remove dependent rows first.
      let r=await db.from('usage_logs').delete().eq('user_id',u.id); if(r.error)throw r.error;
      r=await db.from('printers').delete().eq('user_id',u.id); if(r.error)throw r.error;
      r=await db.from('spools').delete().eq('user_id',u.id); if(r.error)throw r.error;
      if(sp.length){r=await db.from('spools').insert(sp);if(r.error)throw r.error;}
      if(pr.length){r=await db.from('printers').insert(pr);if(r.error)throw r.error;}
      if(lg.length){r=await db.from('usage_logs').insert(lg);if(r.error)throw r.error;}
      if(snap.data.preferences){
        const p={...snap.data.preferences,user_id:u.id,updated_at:new Date().toISOString()};
        r=await db.from('user_preferences').upsert(p,{onConflict:'user_id'});if(r.error)throw r.error;
      }
      msg.textContent=t('✅ تمت الاستعادة. سيتم تحديث الصفحة.','✅ Restore complete. Reloading…');
      setTimeout(()=>location.reload(),800);
    }catch(e){console.error(e);msg.textContent=t('تعذرت الاستعادة: ','Restore failed: ')+e.message;}
  }

  async function exportSettings(){
    const u=await user(); const {data,error}=await db.from('user_preferences').select('*').eq('user_id',u.id).maybeSingle(); if(error)throw error;
    downloadJson({format:'filaments-manger-settings',version:1,exported_at:new Date().toISOString(),settings:data||{}},`filaments-manger-settings_${fileStamp()}.json`);
  }
  async function importSettings(file){
    try{
      const obj=JSON.parse(await file.text()); if(obj.format!=='filaments-manger-settings')throw new Error(t('ملف إعدادات غير صالح','Invalid settings file'));
      const u=await user(); const p={...(obj.settings||{}),user_id:u.id,updated_at:new Date().toISOString()}; delete p.created_at;
      const {error}=await db.from('user_preferences').upsert(p,{onConflict:'user_id'}); if(error)throw error;
      alert(t('تم استيراد الإعدادات.','Settings imported.')); location.reload();
    }catch(e){alert(e.message);}
  }
  async function exportBackup(){ downloadJson(await snapshot(),`filaments-manger-backup_${fileStamp()}.json`); }
  async function importBackup(file){
    try{const obj=JSON.parse(await file.text());if(obj.format!=='filaments-manger-backup')throw new Error(t('ملف Backup غير صالح','Invalid backup file'));await restoreSnapshot(obj);}catch(e){alert(e.message);}
  }

  async function uploadAttachments(files, feedbackId){
    const u=await user(); const out=[];
    for(const f of files){
      if(f.size>MAX_FILE) throw new Error(`${f.name}: ${t('الحد الأقصى 10MB','maximum 10MB')}`);
      const safe=f.name.replace(/[^a-zA-Z0-9._-]/g,'_');
      const path=`${u.id}/${feedbackId}/${Date.now()}_${safe}`;
      const {error}=await db.storage.from('feedback-attachments').upload(path,f,{upsert:false,contentType:f.type||'application/octet-stream'}); if(error)throw error;
      out.push({name:f.name,path,size:f.size,type:f.type});
    }
    return out;
  }

  async function submitFeedback(e){
    e.preventDefault(); const status=$('feedbackStatus'); const btn=$('feedbackSubmit');
    try{
      btn.disabled=true; status.textContent=t('جاري الإرسال...','Sending…');
      const u=await user(); const email=$('feedbackEmail').value.trim(); const message=$('feedbackMessage').value.trim(); const kind=$('feedbackKind').value;
      if(!email||!message)throw new Error(t('اكتب الإيميل والرسالة.','Enter your email and message.'));
      const id=crypto.randomUUID(); const files=[...$('feedbackFiles').files]; const attachments=await uploadAttachments(files,id);
      const {error}=await db.from('feedback_submissions').insert({id,user_id:u.id,contact_email:email,kind,message,attachments}); if(error)throw error;
      // Email delivery is handled by an Edge Function when configured. The database copy is always preserved.
      let emailed=false;
      try{
        const {data,error:fnErr}=await db.functions.invoke('send-feedback-email',{body:{feedback_id:id}});
        emailed=!fnErr && data?.email_sent===true;
      }catch(_){}
      status.textContent=emailed?t('✅ تم الإرسال ووصلت نسخة على البريد.','✅ Sent and emailed successfully.'):t('✅ تم حفظ الاقتراح والمرفقات. إرسال البريد يحتاج تفعيل خدمة البريد.','✅ Feedback and attachments saved. Email delivery needs the mail service enabled.');
      $('feedbackMessage').value='';$('feedbackFiles').value='';
    }catch(err){console.error(err);status.textContent=t('تعذر الإرسال: ','Could not send: ')+err.message;}
    finally{btn.disabled=false;}
  }

  function inject(){
    const page=$('settingsPage'); if(!page || $('cloudBackupPanel'))return;
    const s=document.createElement('style');s.textContent=`.cb-row{display:flex;justify-content:space-between;gap:12px;align-items:center;padding:11px;border:1px solid var(--line);border-radius:12px;background:var(--card2);margin-top:8px}.cb-upload{display:none}.cb-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}@media(max-width:720px){.cb-row{align-items:flex-start;flex-direction:column}.cb-grid{grid-template-columns:1fr}}`;document.head.appendChild(s);
    const panel=document.createElement('div');panel.id='cloudBackupPanel';panel.className='panel';panel.style.marginTop='14px';
    panel.innerHTML=`<div class="section-title"><h2>☁️ ${t('Cloud Backup','Cloud Backup')}</h2><span class="muted">Supabase</span></div><p class="muted">${t('احفظ نسخ كاملة في السحابة واستعد أي نسخة لاحقًا.','Save full backups in the cloud and restore any version later.')}</p><div class="actions"><button id="cloudBackupNow" class="btn" type="button">${t('Backup Now','Backup Now')}</button><button id="cloudBackupRefresh" class="btn secondary" type="button">${t('تحديث القائمة','Refresh list')}</button></div><div id="cloudBackupStatus" class="status"></div><div id="cloudBackupList"></div>`;
    page.appendChild(panel);

    const transfer=document.createElement('div');transfer.className='panel';transfer.style.marginTop='14px';transfer.innerHTML=`<div class="section-title"><h2>⇄ ${t('تصدير واستيراد','Export & Import')}</h2></div><div class="cb-grid"><button id="exportSettings2" class="btn secondary" type="button">${t('تصدير الإعدادات','Export Settings')}</button><button id="importSettings2" class="btn secondary" type="button">${t('استيراد الإعدادات','Import Settings')}</button><button id="exportBackup2" class="btn secondary" type="button">${t('تصدير Backup','Export Backup')}</button><button id="importBackup2" class="btn secondary" type="button">${t('استيراد Backup','Import Backup')}</button></div><input id="settingsImportFile2" class="cb-upload" type="file" accept="application/json,.json"><input id="backupImportFile2" class="cb-upload" type="file" accept="application/json,.json">`;
    page.appendChild(transfer);

    const feedback=document.createElement('div');feedback.id='feedbackPanel';feedback.className='panel';feedback.style.marginTop='14px';feedback.innerHTML=`<div class="section-title"><h2>💬 ${t('الاقتراحات والملاحظات','Suggestions & Feedback')}</h2><span class="muted">→ Khalid</span></div><form id="feedbackForm"><div class="form-grid"><label>${t('إيميلك','Your email')}<input id="feedbackEmail" type="email" required></label><label>${t('النوع','Type')}<select id="feedbackKind"><option value="suggestion">${t('اقتراح','Suggestion')}</option><option value="note">${t('ملاحظة','Note')}</option><option value="bug">${t('مشكلة / Bug','Bug')}</option><option value="other">${t('أخرى','Other')}</option></select></label><label class="full">${t('اكتب اقتراحك أو ملاحظتك','Write your suggestion or feedback')}<textarea id="feedbackMessage" rows="5" required></textarea></label><label class="full">${t('صور أو ملفات (اختياري، حتى 10MB للملف)','Images or files (optional, up to 10MB each)')}<input id="feedbackFiles" type="file" multiple accept="image/*,.pdf,.txt,.log,.json,.csv,.zip"></label></div><div class="actions"><button id="feedbackSubmit" class="btn" type="submit">${t('إرسال','Send')}</button></div><div id="feedbackStatus" class="status"></div></form>`;page.appendChild(feedback);

    $('cloudBackupNow').onclick=createCloudBackup;$('cloudBackupRefresh').onclick=loadCloudBackups;
    $('exportSettings2').onclick=()=>exportSettings().catch(e=>alert(e.message));
    $('importSettings2').onclick=()=>$('settingsImportFile2').click();$('settingsImportFile2').onchange=e=>e.target.files[0]&&importSettings(e.target.files[0]);
    $('exportBackup2').onclick=()=>exportBackup().catch(e=>alert(e.message));
    $('importBackup2').onclick=()=>$('backupImportFile2').click();$('backupImportFile2').onchange=e=>e.target.files[0]&&importBackup(e.target.files[0]);
    $('feedbackForm').addEventListener('submit',submitFeedback);
    user().then(u=>{if(u&&$('feedbackEmail'))$('feedbackEmail').value=u.email||'';});
    loadCloudBackups();
  }

  function init(){inject();const o=new MutationObserver(inject);o.observe(document.body,{childList:true,subtree:true});setTimeout(()=>o.disconnect(),12000);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();