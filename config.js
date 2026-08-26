window.APP_CONFIG = {
  SUPABASE_URL: "https://fljoowkjmvqijqiaimpp.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_YdE-PNM_SrerYvKjBn68BQ_8YCpuKR9"
};

(() => {
  const load = src => {
    const s = document.createElement('script');
    s.src = src;
    s.defer = true;
    document.head.appendChild(s);
  };
  window.addEventListener('load', () => {
    load('./printer-enhancements.js');
    load('./assistant-enhancements.js');
  }, { once: true });
})();
