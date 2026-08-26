(() => {
  if (window.__filamentRealAiLoaded) return;
  window.__filamentRealAiLoaded = true;

  const cfg = window.APP_CONFIG || {};
  if (!window.supabase || !cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) return;

  const aiDb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);

  const style = document.createElement('style');
  style.textContent = `
    #fc-ai-btn{position:fixed;left:18px;bottom:18px;z-index:9998;border:0;border-radius:999px;padding:13px 16px;background:#60a5fa;color:#08111f;font-weight:800;box-shadow:0 8px 26px rgba(0,0,0,.35);display:none}
    #fc-ai-panel{position:fixed;left:16px;bottom:78px;z-index:9999;width:min(390px,calc(100vw - 32px));max-height:70vh;background:#111a2b;border:1px solid #26344b;border-radius:18px;box-shadow:0 18px 50px rgba(0,0,0,.45);display:none;overflow:hidden;color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Tahoma,Arial,sans-serif;direction:rtl}
    #fc-ai-head{display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border-bottom:1px solid #26344b}
    #fc-ai-head strong{font-size:15px} #fc-ai-close{border:0;background:transparent;color:#94a3b8;font-size:22px;line-height:1}
    #fc-ai-log{padding:12px;overflow:auto;max-height:42vh;display:flex;flex-direction:column;gap:9px;background:#0d1525}
    .fc-ai-msg{padding:10px 12px;border-radius:13px;line-height:1.55;font-size:14px;white-space:pre-wrap}
    .fc-ai-user{background:#1d4ed8;align-self:flex-start;max-width:88%}.fc-ai-bot{background:#182235;border:1px solid #26344b;align-self:flex-end;max-width:94%}
    #fc-ai-form{display:flex;gap:8px;padding:10px;background:#111a2b;border-top:1px solid #26344b}
    #fc-ai-input{flex:1;min-width:0;background:#0b1220;color:#f8fafc;border:1px solid #26344b;border-radius:12px;padding:11px;font-size:16px}
    #fc-ai-send{border:0;border-radius:12px;padding:0 15px;background:#60a5fa;color:#08111f;font-weight:800}
    #fc-ai-hint{padding:8px 12px 0;color:#94a3b8;font-size:12px;background:#111a2b}
  `;
  document.head.appendChild(style);

  const btn = document.createElement('button');
  btn.id = 'fc-ai-btn';
  btn.type = 'button';
  btn.textContent = '✨ AI';
  document.body.appendChild(btn);

  const panel = document.createElement('section');
  panel.id = 'fc-ai-panel';
  panel.innerHTML = `
    <div id="fc-ai-head"><strong>Filament AI</strong><button id="fc-ai-close" type="button" aria-label="إغلاق">×</button></div>
    <div id="fc-ai-log"><div class="fc-ai-msg fc-ai-bot">اسألني عن مخزونك أو الطابعات، مثال: «أي PETG يكفيني لطبعة 650g؟»</div></div>
    <div id="fc-ai-hint">الذكاء الاصطناعي يقرأ بيانات حسابك الحالية فقط عند إرسال السؤال.</div>
    <form id="fc-ai-form"><input id="fc-ai-input" autocomplete="off" placeholder="اكتب سؤالك..."><button id="fc-ai-send" type="submit">إرسال</button></form>
  `;
  document.body.appendChild(panel);

  const log = panel.querySelector('#fc-ai-log');
  const input = panel.querySelector('#fc-ai-input');
  const send = panel.querySelector('#fc-ai-send');

  const addMsg = (text, who) => {
    const el = document.createElement('div');
    el.className = `fc-ai-msg ${who === 'user' ? 'fc-ai-user' : 'fc-ai-bot'}`;
    el.textContent = text;
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
    return el;
  };

  btn.addEventListener('click', () => {
    panel.style.display = 'block';
    input.focus();
  });
  panel.querySelector('#fc-ai-close').addEventListener('click', () => panel.style.display = 'none');

  async function refreshVisibility() {
    const { data: { session } } = await aiDb.auth.getSession();
    btn.style.display = session ? 'block' : 'none';
    if (!session) panel.style.display = 'none';
  }

  aiDb.auth.onAuthStateChange(() => refreshVisibility());
  refreshVisibility();

  panel.querySelector('#fc-ai-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const message = input.value.trim();
    if (!message) return;

    addMsg(message, 'user');
    input.value = '';
    input.disabled = true;
    send.disabled = true;
    const waiting = addMsg('أفكر...', 'bot');

    try {
      const [sRes, pRes] = await Promise.all([
        aiDb.from('spools').select('id,name,brand,material,color,total_weight,remaining_weight,location'),
        aiDb.from('printers').select('id,name,model,loaded_spool_id')
      ]);

      if (sRes.error) throw sRes.error;
      if (pRes.error) throw pRes.error;

      const { data, error } = await aiDb.functions.invoke('filament-ai', {
        body: {
          message,
          spools: sRes.data || [],
          printers: pRes.data || []
        }
      });

      if (error) throw error;
      if (data?.error === 'OPENAI_API_KEY_NOT_CONFIGURED') {
        waiting.textContent = 'باقي خطوة واحدة: إضافة OPENAI_API_KEY في Supabase Secrets.';
      } else if (data?.error) {
        waiting.textContent = 'صار خطأ في خدمة الذكاء الاصطناعي. جرّب مرة ثانية.';
      } else {
        waiting.textContent = data?.reply || 'ما قدرت أطلع جواب الآن.';
      }
    } catch (err) {
      waiting.textContent = 'ما قدرت أوصل للذكاء الاصطناعي الآن. تأكد من إعداد مفتاح OpenAI ثم جرّب مرة ثانية.';
      console.error(err);
    } finally {
      input.disabled = false;
      send.disabled = false;
      input.focus();
    }
  });
})();