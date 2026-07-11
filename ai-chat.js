/* ================================================================
   TAMGA STUDIO — AI CHAT WIDGET
   Gemini destekli yardımcı — sağ altta yüzer, tıklanınca açılır.
   ================================================================ */
(function () {
  'use strict';

  var _k = ['AIzaSyArV','Snj0RRRhY','J9FacKEyt','v_JD0dV2t8P4'];
  var API_KEY = _k.join('');
  var MODELS = [
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=',
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key='
  ];
  var _modelIdx = 0;
  function getApiUrl() { return MODELS[_modelIdx] + API_KEY; }


  var SYSTEM_PROMPT = `Sen Tamga Studio'nun yapay zeka yardımcısısın. Adın "Tamga AI". 
Tamga Studio bir Türk dijital ajansı ve oyun geliştirme stüdyosudur.

Hakkında bilgin olan oyunlar ve ürünler:
- **Merge Fruit (Suika Game)**: Meyveleri birleştiren fizik tabanlı oyun. Aynı meyvelere değince birleşip daha büyük meyve olur. Karpuz en büyük meyvedir (2048 puan). 4 tema var: Meyve, Taş, Derin Deniz, Skuşi. Boost'lar: Sallama (Shake), Bomba, Takas (Swap), Yükseltme (Upgrade). 4 mod: Normal, Hız, Hayatta Kal, Süre. Coin toplayarak store'dan boost satın alabilirsin. https://tamgastudio.com/merge-fruit adresinde oynanabilir.
- **Knight Rush**: Şövalye temalı aksiyon oyunu.
- **TypeRush**: Yazma hızı oyunu.
- **Glitch Business**: İş simülasyonu.
- **SaaS Panel**: Web uygulaması.
- **Science Lab (FenLab)**: Fen deneyi simülasyonu.
- **Bionests**: Doğa ve yuva temalı uygulama.
- **Flotixs**: Uçuş/hava temalı uygulama.
- **Double Cross**: GTA tarzı 3D açık dünya oyunu.

İletişim: ceo@bionests.com
Web: tamgastudio.com

Kısa, net ve samimi cevaplar ver. Türkçe konuş. Emojiler kullanabilirsin ama abartma. Eğer bilmediğin bir şey sorulursa dürüstçe söyle.`;

  var FAQS = [
    { label: '🍉 Merge Fruit nasıl oynanır?', q: 'Merge Fruit oyunu nasıl oynanır? Kuralları ve ipuçları nelerdir?' },
    { label: '🎮 Hangi oyunlar var?', q: 'Tamga Studio\'nun hangi oyunları ve uygulamaları var?' },
    { label: '🎨 Temalar nelerdir?', q: 'Merge Fruit\'ta kaç tema var ve bunlar nelerdir?' },
    { label: '⚡ Boost\'lar ne işe yarar?', q: 'Merge Fruit\'taki boostlar ne işe yarar, nasıl kullanılır?' },
    { label: '🏆 Nasıl yüksek puan alınır?', q: 'Merge Fruit\'ta yüksek puan almanın ipuçları nelerdir?' },
    { label: '📧 İletişim bilgileri', q: 'Tamga Studio ile nasıl iletişime geçebilirim?' },
  ];

  var isOpen = false;
  var history = [];
  var isLoading = false;

  /* ── HTML OLUŞTUR ─────────────────────────────────────────── */
  var css = `
    #tg-ai-fab {
      position: fixed; bottom: 28px; right: 28px; z-index: 99999;
      width: 60px; height: 60px; border-radius: 50%;
      background: linear-gradient(135deg, #00ff9c, #00e5ff);
      border: none; cursor: pointer;
      box-shadow: 0 4px 24px rgba(0,255,156,.45), 0 0 0 0 rgba(0,255,156,.3);
      display: flex; align-items: center; justify-content: center;
      font-size: 26px; transition: transform .2s, box-shadow .2s;
      animation: tg-pulse 2.8s infinite;
    }
    #tg-ai-fab:hover { transform: scale(1.1); box-shadow: 0 6px 32px rgba(0,255,156,.6); }
    @keyframes tg-pulse {
      0%,100% { box-shadow: 0 4px 24px rgba(0,255,156,.45), 0 0 0 0 rgba(0,255,156,.3); }
      50%      { box-shadow: 0 4px 24px rgba(0,255,156,.45), 0 0 0 12px rgba(0,255,156,0); }
    }
    #tg-ai-panel {
      position: fixed; bottom: 100px; right: 28px; z-index: 99998;
      width: 360px; max-width: calc(100vw - 40px);
      background: #0d1117; border: 1px solid rgba(0,255,156,.25);
      border-radius: 20px;
      box-shadow: 0 20px 60px rgba(0,0,0,.6), 0 0 40px rgba(0,255,156,.08);
      display: flex; flex-direction: column; overflow: hidden;
      transform: translateY(20px) scale(.95); opacity: 0;
      pointer-events: none; transition: transform .3s cubic-bezier(.22,1,.36,1), opacity .3s;
    }
    #tg-ai-panel.open { transform: translateY(0) scale(1); opacity: 1; pointer-events: all; }
    #tg-ai-header {
      padding: 16px 18px; background: rgba(0,255,156,.07);
      border-bottom: 1px solid rgba(0,255,156,.12);
      display: flex; align-items: center; gap: 12px;
    }
    #tg-ai-avatar {
      width: 36px; height: 36px; border-radius: 50%;
      background: linear-gradient(135deg,#00ff9c,#00e5ff);
      display: flex; align-items: center; justify-content: center;
      font-size: 18px; flex-shrink: 0;
    }
    #tg-ai-header-text h3 { margin:0; font-size:.9rem; color:#e6edf3; font-family:'JetBrains Mono',monospace; }
    #tg-ai-header-text p  { margin:0; font-size:.7rem; color:#00ff9c; }
    #tg-ai-close {
      margin-left:auto; background:none; border:none; color:rgba(255,255,255,.4);
      font-size:20px; cursor:pointer; padding:4px; border-radius:6px;
      transition: color .2s;
    }
    #tg-ai-close:hover { color: #fff; }
    #tg-ai-faqs {
      padding: 12px 14px 8px; display: flex; flex-wrap: wrap; gap: 7px;
      border-bottom: 1px solid rgba(255,255,255,.06);
    }
    .tg-faq-btn {
      background: rgba(0,255,156,.08); border: 1px solid rgba(0,255,156,.2);
      color: #b0bec5; border-radius: 20px; padding: 5px 12px;
      font-size: .72rem; cursor: pointer; font-family: 'JetBrains Mono', monospace;
      transition: background .2s, color .2s, border-color .2s;
      white-space: nowrap;
    }
    .tg-faq-btn:hover { background: rgba(0,255,156,.2); color: #00ff9c; border-color: rgba(0,255,156,.5); }
    #tg-ai-messages {
      flex: 1; overflow-y: auto; padding: 14px; display: flex; flex-direction: column;
      gap: 10px; min-height: 200px; max-height: 320px;
      scrollbar-width: thin; scrollbar-color: rgba(0,255,156,.2) transparent;
    }
    .tg-msg { display: flex; gap: 8px; align-items: flex-start; }
    .tg-msg.user { flex-direction: row-reverse; }
    .tg-bubble {
      max-width: 80%; padding: 9px 13px; border-radius: 14px;
      font-size: .82rem; line-height: 1.55; font-family: 'Space Grotesk', sans-serif;
    }
    .tg-msg.bot  .tg-bubble { background: rgba(0,255,156,.1); border: 1px solid rgba(0,255,156,.15); color: #c9d1d9; border-radius: 4px 14px 14px 14px; }
    .tg-msg.user .tg-bubble { background: linear-gradient(135deg,#00b87a,#00a8cc); color: #000; font-weight: 500; border-radius: 14px 4px 14px 14px; }
    .tg-msg-icon { width:28px; height:28px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:14px; flex-shrink:0; margin-top:2px; }
    .tg-msg.bot  .tg-msg-icon { background: rgba(0,255,156,.15); }
    .tg-msg.user .tg-msg-icon { background: rgba(0,200,255,.2); }
    .tg-typing { display: flex; gap: 4px; padding: 12px 14px; align-items: center; }
    .tg-dot { width:7px; height:7px; border-radius:50%; background:#00ff9c; opacity:.4;
      animation: tg-blink 1.2s infinite; }
    .tg-dot:nth-child(2) { animation-delay:.2s; }
    .tg-dot:nth-child(3) { animation-delay:.4s; }
    @keyframes tg-blink { 0%,100%{opacity:.4;transform:scale(1)} 50%{opacity:1;transform:scale(1.3)} }
    #tg-ai-input-row {
      display: flex; gap: 8px; padding: 12px 14px;
      border-top: 1px solid rgba(255,255,255,.07);
      background: rgba(0,0,0,.2);
    }
    #tg-ai-input {
      flex: 1; background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.1);
      border-radius: 10px; padding: 9px 13px; color: #e6edf3;
      font-size: .82rem; font-family: 'Space Grotesk', sans-serif; outline: none;
      transition: border-color .2s;
    }
    #tg-ai-input:focus { border-color: rgba(0,255,156,.4); }
    #tg-ai-input::placeholder { color: rgba(255,255,255,.3); }
    #tg-ai-send {
      background: linear-gradient(135deg,#00ff9c,#00e5ff); border: none;
      border-radius: 10px; width: 40px; height: 40px; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      font-size: 17px; flex-shrink: 0; transition: opacity .2s, transform .15s;
    }
    #tg-ai-send:hover { opacity: .85; }
    #tg-ai-send:active { transform: scale(.92); }
    #tg-ai-send:disabled { opacity: .4; cursor: not-allowed; }
    #tg-ai-footer { text-align:center; padding: 6px; font-size:.65rem; color:rgba(255,255,255,.2); font-family:monospace; }
    @media (max-width: 420px) {
      #tg-ai-panel { right: 10px; width: calc(100vw - 20px); bottom: 90px; }
      #tg-ai-fab   { right: 16px; bottom: 18px; }
    }
  `;

  /* inject CSS */
  var styleEl = document.createElement('style');
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  /* inject HTML */
  var html = `
    <button id="tg-ai-fab" aria-label="AI Yardımcı">🤖</button>
    <div id="tg-ai-panel" role="dialog" aria-label="Tamga AI Chat">
      <div id="tg-ai-header">
        <div id="tg-ai-avatar">🤖</div>
        <div id="tg-ai-header-text">
          <h3>Tamga AI</h3>
          <p>● Çevrimiçi — soru sorabilirsin</p>
        </div>
        <button id="tg-ai-close" aria-label="Kapat">✕</button>
      </div>
      <div id="tg-ai-faqs"></div>
      <div id="tg-ai-messages"></div>
      <div id="tg-ai-input-row">
        <input id="tg-ai-input" type="text" placeholder="Bir şey sor..." maxlength="400" autocomplete="off">
        <button id="tg-ai-send" aria-label="Gönder">➤</button>
      </div>
      <div id="tg-ai-footer">Tamga AI · Gemini destekli</div>
    </div>
  `;
  var wrapper = document.createElement('div');
  wrapper.innerHTML = html;
  document.body.appendChild(wrapper);

  /* ── ELEMANLAR ─────────────────────────────────────────────── */
  var fab      = document.getElementById('tg-ai-fab');
  var panel    = document.getElementById('tg-ai-panel');
  var closeBtn = document.getElementById('tg-ai-close');
  var msgBox   = document.getElementById('tg-ai-messages');
  var input    = document.getElementById('tg-ai-input');
  var sendBtn  = document.getElementById('tg-ai-send');
  var faqsBox  = document.getElementById('tg-ai-faqs');

  /* ── FAQ BUTONLARI ─────────────────────────────────────────── */
  FAQS.forEach(function (faq) {
    var btn = document.createElement('button');
    btn.className = 'tg-faq-btn';
    btn.textContent = faq.label;
    btn.addEventListener('click', function () { sendMessage(faq.q); });
    faqsBox.appendChild(btn);
  });

  /* ── PANEL AÇ/KAPA ─────────────────────────────────────────── */
  function openPanel() {
    isOpen = true;
    panel.classList.add('open');
    fab.textContent = '✕';
    if (history.length === 0) addBotMsg('Merhaba! 👋 Ben Tamga AI. Tamga Studio oyunları ve ürünleri hakkında sana yardımcı olabilirim. Aşağıdaki sık sorulan sorulara tıklayabilir ya da dilediğini yazabilirsin!');
    setTimeout(function () { input.focus(); }, 300);
  }
  function closePanel() {
    isOpen = false;
    panel.classList.remove('open');
    fab.textContent = '🤖';
  }

  fab.addEventListener('click', function () { isOpen ? closePanel() : openPanel(); });
  closeBtn.addEventListener('click', closePanel);

  /* ── MESAJ EKLEME ──────────────────────────────────────────── */
  function addBotMsg(text) {
    var div = document.createElement('div');
    div.className = 'tg-msg bot';
    div.innerHTML = '<div class="tg-msg-icon">🤖</div><div class="tg-bubble">' + escHtml(text) + '</div>';
    msgBox.appendChild(div);
    scrollBottom();
  }
  function addUserMsg(text) {
    var div = document.createElement('div');
    div.className = 'tg-msg user';
    div.innerHTML = '<div class="tg-bubble">' + escHtml(text) + '</div><div class="tg-msg-icon">👤</div>';
    msgBox.appendChild(div);
    scrollBottom();
  }

  var typingEl = null;
  function showTyping() {
    typingEl = document.createElement('div');
    typingEl.className = 'tg-msg bot';
    typingEl.innerHTML = '<div class="tg-msg-icon">🤖</div><div class="tg-bubble tg-typing"><div class="tg-dot"></div><div class="tg-dot"></div><div class="tg-dot"></div></div>';
    msgBox.appendChild(typingEl);
    scrollBottom();
  }
  function hideTyping() { if (typingEl && typingEl.parentNode) { typingEl.parentNode.removeChild(typingEl); typingEl = null; } }

  function scrollBottom() { msgBox.scrollTop = msgBox.scrollHeight; }
  function escHtml(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>'); }

  /* ── GEMİNİ API ────────────────────────────────────────────── */
  function sendMessage(text) {
    text = (text || '').trim();
    if (!text || isLoading) return;

    input.value = '';
    addUserMsg(text);
    history.push({ role: 'user', parts: [{ text: text }] });

    isLoading = true;
    sendBtn.disabled = true;
    showTyping();

    var body = {
      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: history.slice(-10)
    };

    function tryFetch() {
      fetch(getApiUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        hideTyping();
        var reply = '';
        try {
          if (data.error) {
            // Model bulunamazsa bir sonraki modeli dene
            if ((data.error.code === 404 || data.error.status === 'NOT_FOUND') && _modelIdx < MODELS.length - 1) {
              _modelIdx++;
              showTyping();
              tryFetch();
              return;
            }
            reply = '⚠️ API Hatası: ' + data.error.message;
          } else {
            reply = data.candidates[0].content.parts[0].text;
          }
        } catch(e) {
          reply = 'Beklenmedik yanıt: ' + JSON.stringify(data).slice(0, 150);
        }
        history.push({ role: 'model', parts: [{ text: reply }] });
        addBotMsg(reply);
        isLoading = false; sendBtn.disabled = false; input.focus();
      })
      .catch(function (err) {
        hideTyping();
        addBotMsg('Bağlantı hatası: ' + err.message);
        isLoading = false; sendBtn.disabled = false; input.focus();
      });
    }
    tryFetch();
  }

  /* ── INPUT OLAYLARı ────────────────────────────────────────── */
  sendBtn.addEventListener('click', function () { sendMessage(input.value); });
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input.value); }
  });

})();
