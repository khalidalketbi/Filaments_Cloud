(() => {
  function inject(){
    const sel=document.getElementById('feedbackKind'); if(!sel||[...sel.options].some(o=>o.value==='complaint'))return;
    const opt=document.createElement('option');opt.value='complaint';opt.textContent=document.documentElement.lang==='en'?'Complaint':'شكوى';
    sel.insertBefore(opt,sel.options[1]||null);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',inject,{once:true});else inject();
  const o=new MutationObserver(inject);o.observe(document.body,{childList:true,subtree:true});setTimeout(()=>o.disconnect(),15000);
})();