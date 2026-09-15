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

  function parseRemaining(source){
    const txt=(source?.textContent||'').trim();
    const m=txt.match(/(\d{1,3}):(\d{2}):(\d{2})/);
    if(!m) return null;
    return Number(m[1])*3600 + Number(m[2])*60 + Number(m[3]);
  }

  function formatClock(date){
    return new Intl.DateTimeFormat('ar-AE',{hour:'numeric',minute:'2-digit',hour12:true}).format(date);
  }

  function updateCard(card){
    const source=card.querySelector('.manual-timer-display') || card.querySelector('.printer-timer');
    if(!source) return;

    let line=card.querySelector('.printer-finish-at');
    if(!line){
      line=document.createElement('div');
      line.className='printer-finish-at';
      source.insertAdjacentElement('afterend',line);
    }

    let finish=null;
    const manualTs=Number(card.dataset.manualFinishAt||0);
    if(manualTs>0) finish=new Date(manualTs);
    else {
      const sec=parseRemaining(source);
      if(sec!=null && sec>0) finish=new Date(Date.now()+sec*1000);
    }

    if(!finish){
      line.style.display='none';
      line.textContent='';
      return;
    }

    const value=formatClock(finish);
    line.style.display='block';
    if(line.dataset.value!==value){
      line.dataset.value=value;
      line.innerHTML=`موعد الانتهاء المتوقع: <strong>${value}</strong>`;
    }
  }

  function update(){
    document.querySelectorAll('#prodPrinterGrid .prod-printer-card').forEach(updateCard);
  }

  function boot(){
    injectStyle();
    update();
    setInterval(update,1000);
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();
})();