/*!
 * TamgaStudio ortak ödeme dosyası — bütün ürün sayfaları bunu kullanır.
 * Paddle'ı açıp kapatmak, anahtarı veya sandbox/canlı ayarını değiştirmek için YALNIZCA aşağıdaki AYAR bloğunu düzenle.
 *
 * Ürün sayfasında kullanım:
 *   <script src="/assets/odeme.js"></script>
 *   if (TamgaOdeme.aktif) TamgaOdeme.ac({ urun:'soundpath', plan:'single', priceId:'pri_...', dil:'tr' });
 *   else  ... e-posta ile talep ...
 */
(function () {
  'use strict';

  /* ======================= AYAR ======================= */
  var AYAR = {
    aktif: false,                       // Paddle hesabı onaylanınca true
    ortam: 'sandbox',                   // 'sandbox' | 'production'
    token: '',                          // Paddle > Developer tools > Authentication > client-side token
    basariSayfasi: '/odeme-tamam.html'  // ödeme sonrası yönlendirme
  };
  /* ==================================================== */

  /* ---- kampanya kaynağı (UTM): ilk ve son tıklama, bütün ürünlerde ortak ---- */
  var KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
  var utm = (function () {
    var q = new URLSearchParams(location.search), now = {}, first = null, last = null;
    KEYS.forEach(function (k) { if (q.get(k)) now[k] = q.get(k); });
    var has = Object.keys(now).length > 0;
    try {
      first = JSON.parse(localStorage.getItem('ts_utm_first') || 'null');
      last = JSON.parse(localStorage.getItem('ts_utm_last') || 'null');
      if (has) { if (!first) localStorage.setItem('ts_utm_first', JSON.stringify(now)); localStorage.setItem('ts_utm_last', JSON.stringify(now)); }
    } catch (e) {}
    return { first: first || now, last: has ? now : (last || {}) };
  })();

  function track(name, props) {
    var d = Object.assign({}, props || {}, utm.last);
    try { if (window.plausible) window.plausible(name, { props: d }); } catch (e) {}
    try { if (window.gtag) window.gtag('event', name, d); } catch (e) {}
  }

  /* ---- Paddle.js yalnızca gerektiğinde yüklenir ---- */
  var yukleniyor = null;
  function paddle() {
    if (yukleniyor) return yukleniyor;
    yukleniyor = new Promise(function (resolve, reject) {
      if (window.Paddle && window.Paddle.Checkout) return resolve(window.Paddle);
      var s = document.createElement('script');
      s.src = 'https://cdn.paddle.com/paddle/v2/paddle.js';
      s.onload = function () {
        try {
          if (AYAR.ortam === 'sandbox') window.Paddle.Environment.set('sandbox');
          window.Paddle.Initialize({ token: AYAR.token });
          resolve(window.Paddle);
        } catch (e) { reject(e); }
      };
      s.onerror = function () { reject(new Error('Paddle yüklenemedi')); };
      document.head.appendChild(s);
    });
    return yukleniyor;
  }

  function customData(urun, plan, dil) {
    var d = { product: urun, plan: plan, lang: dil === 'tr' ? 'tr' : 'en', page: location.pathname };
    Object.keys(utm.last).forEach(function (k) { d['last_' + k] = utm.last[k]; });
    Object.keys(utm.first).forEach(function (k) { d['first_' + k] = utm.first[k]; });
    return d;
  }

  /** Ödeme penceresini açar. Paddle kapalıysa veya yüklenemezse false döner (sayfa e-posta talebine düşer). */
  function ac(o) {
    if (!api.aktif || !o || !o.priceId) return Promise.resolve(false);
    track('checkout_open', { product: o.urun, plan: o.plan });
    return paddle().then(function (P) {
      var settings = { displayMode: 'overlay', locale: o.dil === 'tr' ? 'tr' : 'en', successUrl: location.origin + AYAR.basariSayfasi + '?p=' + encodeURIComponent(o.urun) + '&lang=' + (o.dil === 'tr' ? 'tr' : 'en') };
      var req = { items: [{ priceId: o.priceId, quantity: 1 }], customData: customData(o.urun, o.plan, o.dil), settings: settings };
      if (o.email) req.customer = { email: o.email };
      P.Checkout.open(req);
      return true;
    }).catch(function () { return false; });
  }

  var api = {
    get aktif() { return !!(AYAR.aktif && AYAR.token); },
    ortam: AYAR.ortam,
    utm: utm,
    track: track,
    ac: ac
  };
  window.TamgaOdeme = api;
})();
