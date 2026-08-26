(() => {
  const $ = id => document.getElementById(id);
  let bound = false;

  function applyColorFilter(select) {
    const search = $('spoolSearch');
    if (!search) return;

    const chosen = select.value || '';
    search.value = chosen;
    search.dataset.colorFilterValue = chosen;

    // The main app listens to input to render the spool list.
    search.dispatchEvent(new Event('input', { bubbles: true }));
    // Fire change as a compatibility fallback for browsers/PWA shells.
    search.dispatchEvent(new Event('change', { bubbles: true }));

    // Re-fire on the next frame after the native select menu closes.
    requestAnimationFrame(() => {
      search.dispatchEvent(new Event('input', { bubbles: true }));
    });
  }

  function bind() {
    const select = $('colorSearch');
    if (!select || select.dataset.instantFilter === '1') return false;
    select.dataset.instantFilter = '1';
    select.addEventListener('change', () => applyColorFilter(select));
    return true;
  }

  function init() {
    if (bind()) return;
    const obs = new MutationObserver(() => {
      if (bind()) obs.disconnect();
    });
    obs.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => obs.disconnect(), 15000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
