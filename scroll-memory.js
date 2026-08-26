(() => {
  const PAGE_KEY = 'filament_cloud_active_page';
  const SCROLL_PREFIX = 'filament_cloud_scroll_';
  let saveTimer = null;
  let restoring = false;

  const activePage = () => document.querySelector('.nav button.active[data-page]')?.dataset.page || localStorage.getItem(PAGE_KEY) || 'dashboard';
  const scrollKey = page => `${SCROLL_PREFIX}${page || 'dashboard'}`;

  function savePosition() {
    if (restoring) return;
    const page = activePage();
    localStorage.setItem(PAGE_KEY, page);
    localStorage.setItem(scrollKey(page), String(Math.max(0, Math.round(window.scrollY || document.documentElement.scrollTop || 0))));
  }

  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(savePosition, 80);
  }

  function restorePosition() {
    const wantedPage = localStorage.getItem(PAGE_KEY) || 'dashboard';
    const wantedY = Math.max(0, Number(localStorage.getItem(scrollKey(wantedPage)) || 0));
    let attempts = 0;
    restoring = true;

    const timer = setInterval(() => {
      attempts++;
      const app = document.getElementById('appView');
      const active = document.querySelector('.nav button.active[data-page]')?.dataset.page;
      const pageReady = app && !app.classList.contains('hidden') && active === wantedPage;

      if (pageReady) {
        requestAnimationFrame(() => {
          window.scrollTo({ top: wantedY, left: 0, behavior: 'auto' });
          setTimeout(() => window.scrollTo({ top: wantedY, left: 0, behavior: 'auto' }), 120);
          setTimeout(() => {
            window.scrollTo({ top: wantedY, left: 0, behavior: 'auto' });
            restoring = false;
          }, 350);
        });
        clearInterval(timer);
      } else if (attempts > 50) {
        restoring = false;
        clearInterval(timer);
      }
    }, 100);
  }

  function bindNavigation() {
    document.querySelectorAll('.nav button[data-page]').forEach(btn => {
      btn.addEventListener('click', () => {
        savePosition();
        const next = btn.dataset.page;
        localStorage.setItem(PAGE_KEY, next);
        const y = Math.max(0, Number(localStorage.getItem(scrollKey(next)) || 0));
        setTimeout(() => window.scrollTo({ top: y, left: 0, behavior: 'auto' }), 60);
      }, true);
    });
  }

  function bindSaves() {
    ['spoolForm', 'printerForm'].forEach(id => {
      document.getElementById(id)?.addEventListener('submit', savePosition, true);
    });
    ['saveSettings', 'applyUse'].forEach(id => {
      document.getElementById(id)?.addEventListener('click', savePosition, true);
    });
    document.addEventListener('click', e => {
      if (e.target.closest('[data-delete-printer],[data-fav-spool],[data-duplicate-spool],[data-use-spool],[data-printer-use]')) savePosition();
    }, true);
  }

  function init() {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    window.addEventListener('scroll', scheduleSave, { passive: true });
    window.addEventListener('pagehide', savePosition);
    window.addEventListener('beforeunload', savePosition);
    bindNavigation();
    bindSaves();
    restorePosition();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
