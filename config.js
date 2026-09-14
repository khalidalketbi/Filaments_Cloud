window.APP_CONFIG = {
  SUPABASE_URL: "https://fljoowkjmvqijqiaimpp.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_YdE-PNM_SrerYvKjBn68BQ_8YCpuKR9"
};

(() => {
  const load = src => new Promise(resolve => {
    const s = document.createElement('script');
    s.src = src;
    s.defer = true;
    s.onload = resolve;
    s.onerror = resolve;
    document.head.appendChild(s);
  });

  const enableSpoolManagerMode = () => {
    document.title = 'Filaments Manager';

    const style = document.createElement('style');
    style.id = 'spoolManagerOnlyMode';
    style.textContent = `
      .nav [data-page="printers"],
      #printersPage,
      #printerModal {
        display: none !important;
      }
    `;
    document.head.appendChild(style);

    const authTitle = document.querySelector('#authView h1');
    if (authTitle) authTitle.textContent = 'Filaments Manager';

    const authSubtitle = document.querySelector('#authView > p');
    if (authSubtitle) authSubtitle.textContent = 'إدارة السبولات ومخزون الفلمنت في مكان واحد';

    const logo = document.querySelector('.logo');
    if (logo) logo.innerHTML = '◉ Filaments Manager<small>Spool Management</small>';
  };

  document.addEventListener('DOMContentLoaded', enableSpoolManagerMode, { once: true });

  window.addEventListener('load', async () => {
    await load('./dashboard-pro.js');
    await load('./production-tracking.js');
    await load('./assistant-enhancements.js');
    await load('./natural-sort.js');
    await load('./scroll-memory.js');
    await load('./notifications.js');
    await load('./experience-plus.js');
    await load('./experience-fixes.js');
    await load('./spool-form-ux.js');
    await load('./color-filter-refresh.js');
    await load('./auth-enhancements.js');
    await load('./admin-entry.js');
    await load('./presence.js');
    await load('./analytics-tracking.js');
    await load('./backup-import.js');
    await load('./cloud-backup-feedback.js');
    await load('./feedback-complaint-fix.js');
    await load('./ticket-system.js');
    await load('./floating-support.js');
    await load('./i18n-master.js');
    await load('./i18n-known-fixes.js');
    await load('./search-fix.js');
  }, { once: true });
})();
