(() => {
  function injectStyle(){
    if(document.getElementById('finishTimeStyle')) return;
    const s=document.createElement('style');
    s.id='finishTimeStyle';
    s.textContent=`
      #productionPage .printer-finish-at{margin-top:6px;font-size:13px;color:var(--muted);font-weight:700}
      #productionPage .printer-finish-at strong{color:var(--accent2);font-size:15px}
    `;
    document.head.appendChild(s);
  }

  function parseRemaining(timer){
    const txt=(timer?.textContent||'').trim();
    const m=txt.match(/(\d{1,3}):(\d{2}):(\d{2})/);
    if(!m) return null;
    return Number(m[1])*3600 + Number(m[2])*60 + Number(m[3]);
  }

  function formatClock(date){
    return new Intl.DateTimeFormat('ar-AE',{
      hour:'numeric', minute:'2-digit', hour12:true
    }).format(date);
  }

  function update(){
    document.querySelectorAll('#prodPrinterGrid .prod-printer-card').forEach(card=>{
      const timer=card.querySelector('.printer-timer');
      if(!timer) return;
      let line=card.querySelector('.printer-finish-at');
      if(!line){
        line=document.createElement('div');
        line.className='printer-finish-at';
        timer.insertAdjacentElement('afterend',line);
      }
      const sec=parseRemaining(timer);
      if(sec==null || sec<=0){
        line.textContent='';
        line.style.display='none';
        return;
      }
      const finish=new Date(Date.now()+sec*1000);
      line.style.display='block';
      line.innerHTML=`موعد الانتهاء المتوقع: <strong>${formatClock(finish)}</strong>`;
    });
  }

  function boot(){
    injectStyle();
    update();
    setInterval(update,1000);
    const root=document.getElementById('productionPage')||document.body;
    new MutationObserver(update).observe(root,{childList:true,subtree:true,characterData:true});
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();
})();