(() => {
  const cfg = window.APP_CONFIG || {};
  if (!window.supabase || !cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) return;
  const db = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  const $ = id => document.getElementById(id);
  const nowStamp = () => new Date().toISOString().replace(/[:.]/g,'-');
  const lang = () => document.documentElement.lang === 'en' ? 'en' : 'ar';
  const t = (ar,en) => lang()==='en'?en:ar;

  async function user(){ const {data:{session}}=await db.auth.getSession(); return session?.user || null; }
  function downloadJson(name, data){
    const blob = new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
    const url = URL.createObjectURL(blob); const a=document.createElement('a');
    a.href=url; a.download=name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),5000);
  }
  function readJsonFile(file){ return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>{try{resolve(JSON.parse(r.result))}catch(e){reject(e)}};r.onerror=reject;r.readAsText(file)}); }
  function cleanRow(row, uid){ const x={...row,user_id:uid}; delete x.__meta; return x; }

  async function exportSettings(){
    const u=await user(); if(!u)return;
    const {data,error}=await db.from('user_preferences').select('*').eq('user_id',u.id).maybeSingle();
    if(error) throw error;
    const payload={format:'filaments-manger-settings',version:1,exported_at:new Date().toISOString(),timezone:Intl.DateTimeFormat().resolvedOptions().timeZone,settings:data||{user_id:u.id}};
    delete payload.settings.user_id;
    downloadJson(`filaments-manger-settings-${nowStamp()}.json`,payload);
  }

  async function importSettings(file){
    const u=await user(); if(!u)return;
    const json=await readJsonFile(file);
    if(json?.format!=='filaments-manger-settings'||!json.settings) throw new Error('INVALID_SETTINGS');
    const payload={...json.settings,user_id:u.id,updated_at:new Date().toISOString()};
    delete payload.id;
    const {error}=await db.from('user_preferences').upsert(payload,{onConflict:'user_id'}); if(error)throw error;
    alert(t('تم استيراد الإعدادات بنجاح.','Settings imported successfully.'));
    location.reload();
  }

  async function exportBackup(){
    const u=await user(); if(!u)return;
    const [sp,pr,ul,pf]=await Promise.all([
      db.from('spools').select('*').eq('user_id',u.id),
      db.from('printers').select('*').eq('user_id',u.id),
      db.from('usage_logs').select('*').eq('user_id',u.id),
      db.from('user_preferences').select('*').eq('user_id',u.id).maybeSingle()
    ]);
    for(const r of [sp,pr,ul,pf]) if(r.error) throw r.error;
    const prefs={...(pf.data||{})}; delete prefs.user_id;
    const payload={format:'filaments-manger-backup',version:1,exported_at:new Date().toISOString(),timezone:Intl.DateTimeFormat().resolvedOptions().timeZone,counts:{spools:sp.data?.length||0,printers:pr.data?.length||0,usage_logs:ul.data?.length||0},data:{spools:sp.data||[],printers:pr.data||[],usage_logs:ul.data||[],settings:prefs}};
    downloadJson(`filaments-manger-backup-${nowStamp()}.json`,payload);
  }

  async function importBackup(file){
    const u=await user(); if(!u)return;
    const json=await readJsonFile(file);
    if(json?.format!=='filaments-manger-backup'||!json.data) throw new Error('INVALID_BACKUP');
    const yes=confirm(t('سيتم استبدال بيانات حسابك الحالية بالنسخة الاحتياطية. هل أنت متأكد؟','Your current account data will be replaced by this backup. Continue?'));
    if(!yes)return;
    const d=json.data;
    // FK-safe delete order.
    let r=await db.from('usage_logs').delete().eq('user_id',u.id); if(r.error)throw r.error;
    r=await db.from('printers').delete().eq('user_id',u.id); if(r.error)throw r.error;
    r=await db.from('spools').delete().eq('user_id',u.id); if(r.error)throw r.error;
    if(Array.isArray(d.spools)&&d.spools.length){r=await db.from('spools').insert(d.spools.map(x=>cleanRow(x,u.id)));if(r.error)throw r.error;}
    if(Array.isArray(d.printers)&&d.printers.length){r=await db.from('printers').insert(d.printers.map(x=>cleanRow(x,u.id)));if(r.error)throw r.error;}
    if(Array.isArray(d.usage_logs)&&d.usage_logs.length){r=await db.from('usage_logs').insert(d.usage_logs.map(x=>cleanRow(x,u.id)));if(r.error)throw r.error;}
    if(d.settings){const p={...d.settings,user_id:u.id,updated_at:new Date().toISOString()};delete p.id;r=await db.from('user_preferences').upsert(p,{onConflict:'user_id'});if(r.error)throw r.error;}
    alert(t('تم استيراد النسخة الاحتياطية بنجاح.','Backup imported successfully.'));
    location.reload();
  }

  function inject(){
    const page=$('settingsPage'); if(!page||$('backupTransferPanel'))return;
    const panel=document.createElement('div'); panel.id='backupTransferPanel'; panel.className='panel'; panel.style.marginTop='14px';
    panel.innerHTML=`<div class="section-title"><h2>💾 ${t('الاستيراد والتصدير','Import & Export')}</h2></div>
      <p class="muted">${t('الإعدادات فقط للثيم واللغة وطريقة العرض والتنبيهات. النسخة الاحتياطية تشمل السبولات والطابعات وسجل الاستخدام والإعدادات.','Settings files contain preferences only. Full backups include spools, printers, usage history, and settings.')}</p>
      <div class="actions" style="gap:8px;flex-wrap:wrap">
        <button id="exportSettingsBtn" class="btn secondary" type="button">${t('تصدير الإعدادات','Export Settings')}</button>
        <button id="importSettingsBtn" class="btn secondary" type="button">${t('استيراد الإعدادات','Import Settings')}</button>
        <button id="exportBackupBtn" class="btn" type="button">${t('تصدير النسخة الاحتياطية','Export Backup')}</button>
        <button id="importBackupBtn" class="btn secondary" type="button">${t('استيراد النسخة الاحتياطية','Import Backup')}</button>
      </div>
      <input id="importSettingsFile" type="file" accept="application/json,.json" hidden>
      <input id="importBackupFile" type="file" accept="application/json,.json" hidden>
      <div id="backupTransferStatus" class="status"></div>`;
    page.appendChild(panel);
    $('exportSettingsBtn').onclick=()=>exportSettings().catch(e=>{$('backupTransferStatus').textContent=t('تعذر تصدير الإعدادات.','Could not export settings.');console.error(e)});
    $('importSettingsBtn').onclick=()=>$('importSettingsFile').click();
    $('importSettingsFile').onchange=e=>{const f=e.target.files?.[0];if(f)importSettings(f).catch(err=>{alert(t('ملف الإعدادات غير صالح.','Invalid settings file.'));console.error(err)});e.target.value='';};
    $('exportBackupBtn').onclick=()=>exportBackup().catch(e=>{$('backupTransferStatus').textContent=t('تعذر تصدير النسخة الاحتياطية.','Could not export backup.');console.error(e)});
    $('importBackupBtn').onclick=()=>$('importBackupFile').click();
    $('importBackupFile').onchange=e=>{const f=e.target.files?.[0];if(f)importBackup(f).catch(err=>{alert(t('تعذر استيراد النسخة الاحتياطية. تأكد أن الملف صحيح.','Could not import backup. Make sure the file is valid.'));console.error(err)});e.target.value='';};
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{inject();new MutationObserver(inject).observe(document.body,{childList:true,subtree:true})},{once:true});else{inject();new MutationObserver(inject).observe(document.body,{childList:true,subtree:true})}
})();