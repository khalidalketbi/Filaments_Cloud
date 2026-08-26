(() => {
  const isEn=()=>document.documentElement.lang==='en';
  const exact=new Map(Object.entries({
    'نسبة تنبيه المخزون المنخفض':'Low-stock alert threshold',
    'نسبة تنبيه المخزون المنخفض %':'Low-stock alert threshold %',
    'بدون موديل':'No model',
    'السبول':'Spool',
    'آخر 4':'Last 4',
    'آخر 30 يوم':'Last 30 Days',
    'اليوم':'Today',
    'قبل 30 يوم':'30 days ago',
    'طابعات':'printers',
    'سبول':'spools',
    'مواد':'materials',
    'استخدام':'Usage',
    'واستخدام':'Usage',
    'النهاية':'Finish',
    'مر':'Elapsed',
    'باقي':'Remaining',
    'ص':'AM',
    'م':'PM'
  }));
  function skip(node){const e=node.parentElement;if(!e)return true;if(e.closest('script,style,noscript,textarea#notes,.bubble.me,[data-user-content]'))return true;return false;}
  function tr(raw){let s=String(raw??'');if(!/[\u0600-\u06FF]/.test(s))return s;const t=s.trim();if(exact.has(t))return s.replace(t,exact.get(t));let x=t;
    x=x.replace(/^(\d+) طابعات$/, '$1 printers')
      .replace(/^of (\d+) طابعات$/, 'of $1 printers')
      .replace(/^(\d+) سبول$/, '$1 spools')
      .replace(/^(\d+) مواد$/, '$1 materials')
      .replace(/^مواد · (\d+) · (.+)$/,'materials · $1 · $2')
      .replace(/^Usage آخر 30 يوم$/,'Usage Last 30 Days')
      .replace(/^آخر (\d+)$/,'Last $1')
      .replace(/^استخدام (.+)$/,'Usage $1')
      .replace(/^واستخدام (.+)$/,'Usage $1')
      .replace(/(\d{1,2}):(\d{2})\s*ص/g,'$1:$2 AM')
      .replace(/(\d{1,2}):(\d{2})\s*م/g,'$1:$2 PM')
      .replace(/(\d+)س/g,'$1h')
      .replace(/(\d+)د/g,'$1m')
      .replace(/(\d+)ث/g,'$1s')
      .replace(/\bباقي\b/g,'Remaining')
      .replace(/\bمر\b/g,'Elapsed')
      .replace(/\bالنهاية\b/g,'Finish')
      .replace(/\bبدون موديل\b/g,'No model')
      .replace(/\bطابعات\b/g,'printers')
      .replace(/\bسبول\b/g,'spools')
      .replace(/\bمواد\b/g,'materials')
      .replace(/\bاستخدام\b/g,'Usage')
      .replace(/\bآخر\b/g,'Last')
      .replace(/\bاليوم\b/g,'Today');
    return s.replace(t,x);
  }
  function sweep(root=document.body){if(!isEn()||!root)return;const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);const a=[];while(w.nextNode())a.push(w.currentNode);for(const n of a){if(skip(n))continue;const v=tr(n.nodeValue);if(v!==n.nodeValue)n.nodeValue=v;}
    root.querySelectorAll?.('option').forEach(o=>{const v=tr(o.textContent);if(v!==o.textContent)o.textContent=v;});
  }
  let raf=0;function schedule(){if(raf||!isEn())return;raf=requestAnimationFrame(()=>{raf=0;sweep(document.body)});}
  function init(){sweep();new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true,characterData:true});setInterval(schedule,2500);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();