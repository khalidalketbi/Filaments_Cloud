(() => {
  const cfg = window.APP_CONFIG || {};
  if (!window.supabase || !cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) return;

  const db = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
  const VAPID_PUBLIC_KEY = 'BEgM3K-9lbsMzfQ7VBHxCvGE_A3izFeG1GXyqdQ70jjnwKxx0nrib87WNDBs72hn1Iu6OIxcOVYK0Z9eQEQHKFY';
  const $ = id => document.getElementById(id);

  function isIOS(){ return /iphone|ipad|ipod/i.test(navigator.userAgent); }
  function isStandalone(){ return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true; }
  function b64ToUint8(base64String){ const padding='='.repeat((4-base64String.length%4)%4);const base64=(base64String+padding).replace(/-/g,'+').replace(/_/g,'/');const raw=atob(base64);return Uint8Array.from([...raw].map(c=>c.charCodeAt(0))); }
  function keyToB64(buffer){ const bytes=new Uint8Array(buffer);let binary='';bytes.forEach(b=>binary+=String.fromCharCode(b));return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); }

  async function currentSubscription(){ if(!('serviceWorker' in navigator))return null;const reg=await navigator.serviceWorker.ready;return reg.pushManager.getSubscription(); }
  async function getUser(){ const {data:{session}}=await db.auth.getSession();return session?.user||null; }

  async function syncSubscription(sub){
    const user=await getUser(); if(!user||!sub)return;
    const json=sub.toJSON();
    const payload={user_id:user.id,endpoint:sub.endpoint,p256dh:json.keys?.p256dh||keyToB64(sub.getKey('p256dh')),auth:json.keys?.auth||keyToB64(sub.getKey('auth')),user_agent:navigator.userAgent,updated_at:new Date().toISOString()};
    const {error}=await db.from('push_subscriptions').upsert(payload,{onConflict:'user_id,endpoint'});if(error)throw error;
  }

  async function loadPrefs(){
    const user=await getUser(); if(!user)return;
    const {data}=await db.from('user_preferences').select('notify_before_enabled,notify_before_minutes,notify_on_finish').eq('user_id',user.id).maybeSingle();
    const before=data?.notify_before_enabled ?? true, mins=data?.notify_before_minutes ?? 10, finish=data?.notify_on_finish ?? true;
    if($('notifyBeforeEnabled'))$('notifyBeforeEnabled').checked=before;
    if($('notifyBeforeMinutes')){$('notifyBeforeMinutes').value=String(mins);$('notifyBeforeMinutes').disabled=!before;}
    if($('notifyOnFinish'))$('notifyOnFinish').checked=finish;
    updateSummary();
  }

  function updateSummary(){
    const before=$('notifyBeforeEnabled')?.checked;
    const mins=Math.max(1,Math.min(1440,Number($('notifyBeforeMinutes')?.value||10)));
    const finish=$('notifyOnFinish')?.checked;
    const parts=[]; if(before)parts.push(`تنبيه قبل النهاية بـ ${mins} دقيقة`); if(finish)parts.push('تنبيه عند انتهاء الطبعة');
    if($('notificationPrefsSummary'))$('notificationPrefsSummary').textContent=parts.length?parts.join(' · '):'كل تنبيهات انتهاء الطباعة متوقفة.';
  }

  async function savePrefs(){
    const user=await getUser(); if(!user)return;
    const before=!!$('notifyBeforeEnabled')?.checked;
    const mins=Math.max(1,Math.min(1440,Math.round(Number($('notifyBeforeMinutes')?.value||10))));
    const finish=!!$('notifyOnFinish')?.checked;
    const {error}=await db.from('user_preferences').upsert({user_id:user.id,notify_before_enabled:before,notify_before_minutes:mins,notify_on_finish:finish,updated_at:new Date().toISOString()},{onConflict:'user_id'});
    if(error){$('notificationStatus').textContent='تعذر حفظ إعدادات التنبيه.';return;}
    $('notificationStatus').textContent='✅ تم حفظ خيارات التنبيه.';updateSummary();
  }

  async function enableNotifications(){
    const msg=$('notificationStatus');
    try{
      if(!('serviceWorker' in navigator)||!('PushManager' in window)||!('Notification' in window)){msg.textContent='هذا المتصفح ما يدعم Push Notifications.';return;}
      if(isIOS()&&!isStandalone()){msg.textContent='على الآيفون: Safari ← مشاركة ← إضافة إلى الشاشة الرئيسية، وبعدها افتح Filaments Manger من الأيقونة وفعّل الإشعارات.';return;}
      const permission=await Notification.requestPermission();
      if(permission!=='granted'){msg.textContent=permission==='denied'?'الإشعارات مرفوضة من إعدادات الجهاز.':'ما تم السماح بالإشعارات.';refreshState();return;}
      const reg=await navigator.serviceWorker.ready;let sub=await reg.pushManager.getSubscription();
      if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64ToUint8(VAPID_PUBLIC_KEY)});
      await syncSubscription(sub);await savePrefs();msg.textContent='✅ تم تفعيل إشعارات الهاتف.';refreshState();
    }catch(e){console.error(e);msg.textContent='تعذر تفعيل الإشعارات. جرّب مرة ثانية.';}
  }
  async function disableNotifications(){
    const msg=$('notificationStatus');
    try{const sub=await currentSubscription();if(sub){await db.from('push_subscriptions').delete().eq('endpoint',sub.endpoint);await sub.unsubscribe();}msg.textContent='تم إيقاف إشعارات هذا الجهاز.';refreshState();}catch(e){console.error(e);msg.textContent='تعذر إيقاف الإشعارات.';}
  }
  async function testNotification(){
    const msg=$('notificationStatus');if(Notification.permission!=='granted'){msg.textContent='فعّل إشعارات الهاتف أولًا.';return;}
    const reg=await navigator.serviceWorker.ready;await reg.showNotification('✅ Filaments Manger',{body:'الإشعارات شغالة على هذا الجهاز.',tag:'filaments-manger-test',data:{url:'/?page=printers'}});msg.textContent='تم إرسال إشعار تجريبي.';
  }
  async function refreshState(){
    const enable=$('enableNotifications'),disable=$('disableNotifications'),badge=$('notificationStateBadge');if(!enable||!disable||!badge)return;
    let sub=null;try{sub=await currentSubscription()}catch(_){}const active=Notification.permission==='granted'&&!!sub;
    badge.textContent=active?'مفعلة':Notification.permission==='denied'?'مرفوضة':'غير مفعلة';badge.style.color=active?'var(--accent2)':Notification.permission==='denied'?'var(--danger)':'var(--muted)';enable.classList.toggle('hidden',active);disable.classList.toggle('hidden',!active);if(active)syncSubscription(sub).catch(()=>{});
  }

  function injectSettings(){
    const page=$('settingsPage');if(!page||$('notificationPanel'))return;
    const panel=document.createElement('div');panel.id='notificationPanel';panel.className='panel';panel.style.marginTop='14px';
    panel.innerHTML=`
      <div class="section-title"><h2>🔔 إشعارات الطباعة</h2><span id="notificationStateBadge" class="muted">...</span></div>
      <p id="notificationPrefsSummary" class="muted" style="margin-top:0"></p>
      <div style="display:grid;gap:10px;margin:14px 0">
        <div style="display:flex;gap:10px;align-items:center;background:var(--card2);border:1px solid var(--line);border-radius:12px;padding:12px;flex-wrap:wrap">
          <label style="display:flex;gap:8px;align-items:center;color:var(--text);font-size:13px;flex:1;min-width:210px"><input id="notifyBeforeEnabled" type="checkbox" style="width:auto;min-height:auto"> تنبيه قبل انتهاء الطبعة بـ</label>
          <div style="display:flex;gap:7px;align-items:center"><input id="notifyBeforeMinutes" type="number" min="1" max="1440" value="10" inputmode="numeric" style="width:95px;margin:0"><span class="muted">دقيقة</span></div>
        </div>
        <label style="display:flex;gap:8px;align-items:center;color:var(--text);font-size:13px;background:var(--card2);border:1px solid var(--line);border-radius:12px;padding:12px"><input id="notifyOnFinish" type="checkbox" style="width:auto;min-height:auto"> تنبيه عند انتهاء الطبعة</label>
      </div>
      <div class="actions">
        <button id="saveNotificationPrefs" class="btn" type="button">حفظ خيارات التنبيه</button>
        <button id="enableNotifications" class="btn" type="button">تفعيل إشعارات الهاتف</button>
        <button id="disableNotifications" class="btn secondary hidden" type="button">إيقاف إشعارات هذا الجهاز</button>
        <button id="testNotification" class="btn secondary" type="button">إرسال إشعار تجريبي</button>
      </div>
      <div id="notificationStatus" class="status"></div>
      <div class="muted" style="font-size:11px;margin-top:8px">على iPhone لازم تضيف الموقع إلى الشاشة الرئيسية ثم تفتحه من الأيقونة.</div>`;
    page.appendChild(panel);
    $('notifyBeforeEnabled').addEventListener('change',()=>{$('notifyBeforeMinutes').disabled=!$('notifyBeforeEnabled').checked;updateSummary();});
    $('notifyBeforeMinutes').addEventListener('input',updateSummary);$('notifyOnFinish').addEventListener('change',updateSummary);
    $('saveNotificationPrefs').addEventListener('click',savePrefs);$('enableNotifications').addEventListener('click',enableNotifications);$('disableNotifications').addEventListener('click',disableNotifications);$('testNotification').addEventListener('click',testNotification);
    loadPrefs();refreshState();
  }

  async function init(){
    const link=document.createElement('link');link.rel='manifest';link.href='/manifest.json';if(!document.querySelector('link[rel="manifest"]'))document.head.appendChild(link);
    if(!document.querySelector('meta[name="apple-mobile-web-app-capable"]')){const meta=document.createElement('meta');meta.name='apple-mobile-web-app-capable';meta.content='yes';document.head.appendChild(meta);}
    if('serviceWorker' in navigator){try{await navigator.serviceWorker.register('/sw.js',{scope:'/'});}catch(e){console.error('SW registration failed',e);}}
    injectSettings();new MutationObserver(injectSettings).observe(document.body,{childList:true,subtree:true});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();