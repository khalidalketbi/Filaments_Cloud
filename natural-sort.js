(() => {
  const collator = new Intl.Collator(['ar', 'en'], {
    numeric: true,
    sensitivity: 'base'
  });

  function naturalSortOptions(select) {
    if (!select) return;
    const selected = select.value;
    const placeholder = Array.from(select.options).find(o => !o.value) || null;
    const options = Array.from(select.options).filter(o => o.value);
    options.sort((a, b) => collator.compare(a.textContent || '', b.textContent || ''));
    select.innerHTML = '';
    if (placeholder) select.appendChild(placeholder);
    options.forEach(o => select.appendChild(o));
    if (Array.from(select.options).some(o => o.value === selected)) select.value = selected;
  }

  function sortPrinterSpools() {
    naturalSortOptions(document.getElementById('printerSpool'));
  }

  const modal = document.getElementById('printerModal');
  if (modal) {
    new MutationObserver(() => {
      if (modal.classList.contains('show')) setTimeout(sortPrinterSpools, 60);
    }).observe(modal, { attributes: true, attributeFilter: ['class'] });
  }

  const select = document.getElementById('printerSpool');
  if (select) {
    new MutationObserver(() => setTimeout(sortPrinterSpools, 0)).observe(select, { childList: true });
    sortPrinterSpools();
  }
})();
