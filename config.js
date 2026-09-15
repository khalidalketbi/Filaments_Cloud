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

  const enableProductionMode = () => {
    document.title = 'Filaments Manager';

    const style = document.createElement('style');
    style.id = 'productionOnlyMode';
    style.textContent = `
      .nav [data-page="printers"],
      .nav [data-page="spools"],
      #printersPage,
      #printerModal,
      #spoolsPage,
      #spoolModal,
      #quickAdd,
      .topbar .search {
        display: none !important;
      }
    `;
    document.head.appendChild(style);

    const authTitle = document.querySelector('#authView h1');
    if (authTitle) authTitle.textContent = 'Filaments Manager';

    const authSubtitle = document.querySelector('#authView > p');
    if (authSubtitle) authSubtitle.textContent = 'متابعة الإنتاج والطابعات والمشاريع';

    const logo = document.querySelector('.logo');
    if (logo) logo.innerHTML = '◉ Filaments Manager<small>Production Manager</small>';

    const activeSpools = document.querySelector('.nav [data-page="spools"].active');
    if (activeSpools) {
      activeSpools.classList.remove('active');
      document.querySelector('.nav [data-page="dashboard"]')?.classList.add('active');
      document.querySelectorAll('.page').forEach(x => x.classList.add('hidden'));
      document.querySelector('#dashboardPage')?.classList.remove('hidden');
      const title = document.getElementById('pageTitle');
      if (title) title.textContent = 'لوحة التحكم';
    }
  };

  document.addEventListener('DOMContentLoaded', enableProductionMode, { once: true });

  window.addEventListener('load', async () => {
    await load('./dashboard-pro.js');
    await load('./production-project-switcher.js');
    await load('./production-dashboard.js');
    await load('./production-project-eta.js');
    await load('./production-tracking.js');
    await load('./production-all-projects.js');
    await load('./production-manual-time.js');
    await load('./production-printer-sort.js');
    await load('./production-finish-time.js');
    await load('./production-refill.js');
    await load('./production-printer-management.js');
    await load('./production-printer-constraints.js');
    await load('./production-plate-options.js');
    await load('./production-smart-suggestions.js');
    await load('./production-history.js');
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