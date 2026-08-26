(() => {
  const cfg = window.APP_CONFIG || {};
  if (!window.supabase || !cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) return;

  const db = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
  const VAPID_PUBLIC_KEY = 'BEgM3K-9lbsMzfQ7VBHxCvGE_A3izFeG1GXyqdQ70jjnwKxx0nrib87WNDBs72hn1Iu6OIxcOVYK0Z9eQEQHKFY';
  const $ = id => document.getElementById(id);

  function isIOS() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent);
  }
  function isStandalone() {
    return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
  }
  function b64ToUint8(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(base64);
    return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
  }
  function keyToB64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    bytes.forEach(b => binary += String.fromCharCode(b));
    return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  }

  async function currentSubscription() {
    if (!('serviceWorker' in navigator)) return null;
    const reg = await navigator.serviceWorker.ready;
    return reg.pushManager.getSubscription();
  }

  async function syncSubscription(sub) {
    const { data: { session } } = await db.auth.getSession();
    if (!session?.user || !sub) return;
    const json = sub.toJSON();
    const payload = {
      user_id: session.user.id,
      endpoint: sub.endpoint,
      p256dh: json.keys?.p256dh || keyToB64(sub.getKey('p256dh')),
      auth: json.keys?.auth || keyToB64(sub.getKey('auth')),
      user_agent: navigator.userAgent,
      updated_at: new Date().toISOString()
    };
    const { error } = await db.from('push_subscriptions').upsert(payload, { onConflict: 'user_id,endpoint' });
    if (error) throw error;
  }

  async function enableNotifications() {
    const msg = $('notificationStatus');
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
        msg.textContent = 'هذا المتصفح ما يدعم Push Notifications.';
        return;
      }
      if (isIOS() && !isStandalone()) {
        msg.textContent = 'على الآيفون: افتح الموقع في Safari ← مشاركة ← إضافة إلى الشاشة الرئيسية، وبعدها افتح Filament Cloud من الأيقونة وفعّل الإشعارات.';
        return;
      }
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        msg.textContent = permission === 'denied' ? 'الإشعارات مرفوضة من إعدادات الجهاز.' : 'ما تم السماح بالإشعارات.';
        refreshState();
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToUint8(VAPID_PUBLIC_KEY) });
      }
      await syncSubscription(sub);
      msg.textContent = '✅ تم تفعيل إشعارات الهاتف. بيجيك تنبيه قبل النهاية بـ10 دقائق وعند انتهاء الطبعة.';
      refreshState();
    } catch (e) {
      console.error(e);
      msg.textContent = 'تعذر تفعيل الإشعارات. جرّب مرة ثانية.';
    }
  }

  async function disableNotifications() {
    const msg = $('notificationStatus');
    try {
      const sub = await currentSubscription();
      if (sub) {
        await db.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
        await sub.unsubscribe();
      }
      msg.textContent = 'تم إيقاف إشعارات هذا الجهاز.';
      refreshState();
    } catch (e) {
      console.error(e);
      msg.textContent = 'تعذر إيقاف الإشعارات.';
    }
  }

  async function testNotification() {
    const msg = $('notificationStatus');
    if (Notification.permission !== 'granted') {
      msg.textContent = 'فعّل الإشعارات أولًا.';
      return;
    }
    const reg = await navigator.serviceWorker.ready;
    await reg.showNotification('✅ Filament Cloud', {
      body: 'الإشعارات شغالة على هذا الجهاز.',
      tag: 'filament-cloud-test',
      data: { url: '/?page=printers' }
    });
    msg.textContent = 'تم إرسال إشعار تجريبي على هذا الجهاز.';
  }

  async function refreshState() {
    const enable = $('enableNotifications');
    const disable = $('disableNotifications');
    const badge = $('notificationStateBadge');
    if (!enable || !disable || !badge) return;
    let sub = null;
    try { sub = await currentSubscription(); } catch (_) {}
    const active = Notification.permission === 'granted' && !!sub;
    badge.textContent = active ? 'مفعلة' : Notification.permission === 'denied' ? 'مرفوضة' : 'غير مفعلة';
    badge.style.color = active ? 'var(--accent2)' : Notification.permission === 'denied' ? 'var(--danger)' : 'var(--muted)';
    enable.classList.toggle('hidden', active);
    disable.classList.toggle('hidden', !active);
    if (active) syncSubscription(sub).catch(()=>{});
  }

  function injectSettings() {
    const page = $('settingsPage');
    if (!page || $('notificationPanel')) return;
    const panel = document.createElement('div');
    panel.id = 'notificationPanel';
    panel.className = 'panel';
    panel.style.marginTop = '14px';
    panel.innerHTML = `
      <div class="section-title"><h2>🔔 إشعارات الطباعة</h2><span id="notificationStateBadge" class="muted">...</span></div>
      <p class="muted" style="margin-top:0">يرسل تنبيه قبل انتهاء الطبعة بـ10 دقائق، وتنبيه ثاني وقت الانتهاء.</p>
      <div class="actions">
        <button id="enableNotifications" class="btn" type="button">تفعيل إشعارات الهاتف</button>
        <button id="disableNotifications" class="btn secondary hidden" type="button">إيقاف إشعارات هذا الجهاز</button>
        <button id="testNotification" class="btn secondary" type="button">إرسال إشعار تجريبي</button>
      </div>
      <div id="notificationStatus" class="status"></div>
      <div class="muted" style="font-size:11px;margin-top:8px">على iPhone لازم تضيف الموقع إلى الشاشة الرئيسية ثم تفتح التطبيق من الأيقونة.</div>`;
    page.appendChild(panel);
    $('enableNotifications').addEventListener('click', enableNotifications);
    $('disableNotifications').addEventListener('click', disableNotifications);
    $('testNotification').addEventListener('click', testNotification);
    refreshState();
  }

  async function init() {
    const link = document.createElement('link');
    link.rel = 'manifest'; link.href = '/manifest.json';
    if (!document.querySelector('link[rel="manifest"]')) document.head.appendChild(link);
    if (!document.querySelector('meta[name="apple-mobile-web-app-capable"]')) {
      const meta = document.createElement('meta'); meta.name = 'apple-mobile-web-app-capable'; meta.content = 'yes'; document.head.appendChild(meta);
    }
    if ('serviceWorker' in navigator) {
      try { await navigator.serviceWorker.register('/sw.js', { scope: '/' }); } catch (e) { console.error('SW registration failed', e); }
    }
    injectSettings();
    const obs = new MutationObserver(injectSettings);
    obs.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
