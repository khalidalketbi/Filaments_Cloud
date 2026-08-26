(() => {
  let observer = null;
  let activeUrl = '';

  function stabilize() {
    const box = document.getElementById('remoteCamera');
    if (!box || box.dataset.cameraSmooth === '1') return;
    box.dataset.cameraSmooth = '1';
    box.style.backgroundColor = '#05080e';
    box.style.backgroundRepeat = 'no-repeat';
    box.style.backgroundPosition = 'center';
    box.style.backgroundSize = 'contain';

    const accept = img => {
      if (!img?.src || img.src === activeUrl) return;
      const url = img.src;
      img.style.opacity = '0';
      img.style.position = 'absolute';
      img.style.inset = '0';
      const preload = new Image();
      preload.decoding = 'async';
      preload.onload = () => {
        if (!document.getElementById('remoteCamera')) return;
        activeUrl = url;
        box.style.backgroundImage = `url("${url.replace(/"/g, '%22')}")`;
      };
      preload.src = url;
    };

    box.querySelectorAll('img').forEach(accept);
    observer = new MutationObserver(() => {
      box.querySelectorAll('img').forEach(accept);
    });
    observer.observe(box, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] });
  }

  document.addEventListener('click', e => {
    if (e.target.closest('[data-bambu-remote]')) setTimeout(stabilize, 250);
    if (e.target.closest('#closeBambuRemote')) {
      if (observer) observer.disconnect();
      observer = null;
      activeUrl = '';
      const box = document.getElementById('remoteCamera');
      if (box) {
        delete box.dataset.cameraSmooth;
        box.style.backgroundImage = '';
      }
    }
  }, true);

  const boot = setInterval(() => {
    if (document.getElementById('remoteCamera')) stabilize();
  }, 500);
  setTimeout(() => clearInterval(boot), 15000);
})();
