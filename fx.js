/* ================================================================
   TAMGA STUDIO — FX ENGINE (fx.js)
   Sinematik sayfa geçişleri (warp), oyun boot launcher,
   crosshair imleç, nav scramble, HUD scroll çubuğu, kart tilt.
   Bağımlılık yok — index, about ve privacy sayfalarında ortak.
   ================================================================ */
(function () {
  'use strict';

  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var FINE = window.matchMedia('(pointer: fine)').matches;

  /* ----------------------------------------------------------------
     0. STYLES
  ---------------------------------------------------------------- */
  var style = document.createElement('style');
  style.textContent =
    /* overlay */
    '#fxOverlay{position:fixed;inset:0;z-index:99990;pointer-events:none;opacity:0;background:#050607;}' +
    '#fxOverlay canvas{position:absolute;inset:0;width:100%;height:100%;display:block;}' +
    '#fxFlash{position:absolute;inset:0;opacity:0;pointer-events:none;' +
      'background:radial-gradient(circle at center,rgba(190,255,228,.95),rgba(0,255,156,.35) 45%,transparent 75%);}' +
    /* boot launcher */
    '#fxBoot{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;opacity:0;pointer-events:none;}' +
    '.fxb-box{width:min(480px,86vw);border:1px solid rgba(0,255,156,.35);background:rgba(5,10,8,.85);' +
      'padding:26px 28px;position:relative;font-family:"JetBrains Mono",monospace;' +
      'box-shadow:0 0 60px rgba(0,255,156,.12);}' +
    '.fxb-box::before,.fxb-box::after{content:"";position:absolute;width:14px;height:14px;border:2px solid #00ff9c;}' +
    '.fxb-box::before{top:-2px;left:-2px;border-right:0;border-bottom:0;}' +
    '.fxb-box::after{bottom:-2px;right:-2px;border-left:0;border-top:0;}' +
    '.fxb-title{font-size:10px;letter-spacing:.3em;color:#00e5ff;text-transform:uppercase;margin-bottom:16px;}' +
    '.fxb-lines{min-height:66px;font-size:12px;line-height:1.9;color:#8b98a5;white-space:pre-wrap;}' +
    '.fxb-lines .ok{color:#00ff9c;}' +
    '.fxb-barwrap{height:8px;border:1px solid rgba(0,255,156,.4);margin:14px 0 8px;padding:1px;}' +
    '.fxb-bar{height:100%;width:0%;background:linear-gradient(90deg,#00ff9c,#00e5ff);' +
      'box-shadow:0 0 12px rgba(0,255,156,.6);}' +
    '.fxb-pct{font-size:10px;letter-spacing:.25em;color:#00ff9c;text-align:right;}' +
    /* crosshair cursor */
    'html.fx-cursor,html.fx-cursor *{cursor:none!important;}' +
    '#fxCurDot{position:fixed;left:0;top:0;width:6px;height:6px;margin:-3px 0 0 -3px;border-radius:50%;' +
      'background:#00ff9c;z-index:99999;pointer-events:none;box-shadow:0 0 10px rgba(0,255,156,.8);}' +
    '#fxCurRing{position:fixed;left:0;top:0;width:34px;height:34px;margin:-17px 0 0 -17px;z-index:99999;' +
      'pointer-events:none;transition:transform .22s cubic-bezier(.22,1,.36,1),border-color .22s;}' +
    '#fxCurRing i{position:absolute;width:9px;height:9px;border-style:solid;border-color:rgba(0,255,156,.85);border-width:0;}' +
    '#fxCurRing i:nth-child(1){top:0;left:0;border-top-width:1.5px;border-left-width:1.5px;}' +
    '#fxCurRing i:nth-child(2){top:0;right:0;border-top-width:1.5px;border-right-width:1.5px;}' +
    '#fxCurRing i:nth-child(3){bottom:0;left:0;border-bottom-width:1.5px;border-left-width:1.5px;}' +
    '#fxCurRing i:nth-child(4){bottom:0;right:0;border-bottom-width:1.5px;border-right-width:1.5px;}' +
    '#fxCurRing.lock{transform:scale(1.45) rotate(45deg);}' +
    '#fxCurRing.lock i{border-color:#00e5ff;}' +
    /* scroll HUD bar */
    '#fxScroll{position:fixed;top:0;right:0;width:3px;height:100vh;z-index:9998;pointer-events:none;' +
      'background:rgba(0,255,156,.08);}' +
    '#fxScroll b{position:absolute;top:0;left:0;width:100%;height:100%;transform:scaleY(0);transform-origin:top;' +
      'background:linear-gradient(to bottom,#00ff9c,#00e5ff);box-shadow:0 0 8px rgba(0,255,156,.6);}' +
    /* tilt */
    '.fx-tilt{will-change:transform;}';
  document.head.appendChild(style);

  /* ----------------------------------------------------------------
     1. WARP OVERLAY  (light-speed streaks + glitch — opening'den
        farklı bir sinematik dil: kod yağmuru değil, ışık tüneli)
  ---------------------------------------------------------------- */
  var ov = document.createElement('div'); ov.id = 'fxOverlay';
  var cv = document.createElement('canvas');
  var flash = document.createElement('div'); flash.id = 'fxFlash';
  var bootEl = document.createElement('div'); bootEl.id = 'fxBoot';
  bootEl.innerHTML = '<div class="fxb-box"><div class="fxb-title">// TAMGA.LAUNCHER</div>' +
    '<div class="fxb-lines"></div><div class="fxb-barwrap"><div class="fxb-bar"></div></div>' +
    '<div class="fxb-pct">0%</div></div>';
  ov.appendChild(cv); ov.appendChild(flash); ov.appendChild(bootEl);
  document.body.appendChild(ov);

  var ctx = cv.getContext('2d');
  var W = 0, H = 0, CXp = 0, CYp = 0, MAXR = 0;
  var parts = [];
  var COLORS = ['#00ff9c', '#00e5ff', '#bfffe4', '#7ee8fa'];
  var GLYPHS = '01<>/{}=+*#'.split('');

  function sizeWarp() {
    W = window.innerWidth; H = window.innerHeight;
    cv.width = W; cv.height = H;
    CXp = W / 2; CYp = H / 2;
    MAXR = Math.hypot(CXp, CYp) + 60;
  }
  function buildParts() {
    parts.length = 0;
    var n = Math.max(90, Math.min(190, (W * H / 9000) | 0));
    for (var i = 0; i < n; i++) {
      parts.push({
        a: Math.random() * Math.PI * 2,
        d: Math.random() * MAXR,
        v: 0.5 + Math.random() * 1.3,
        c: COLORS[(Math.random() * COLORS.length) | 0],
        g: Math.random() < 0.12 ? GLYPHS[(Math.random() * GLYPHS.length) | 0] : null
      });
    }
  }
  sizeWarp(); buildParts();
  window.addEventListener('resize', function () { sizeWarp(); buildParts(); });

  var warp = { speed: 0, running: false, raf: null };

  function warpFrame() {
    if (!warp.running) return;
    warp.raf = requestAnimationFrame(warpFrame);

    ctx.fillStyle = 'rgba(5,6,7,0.34)';
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';

    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      p.d += p.v * warp.speed;
      if (p.d > MAXR) { p.d = Math.random() * 30; p.a = Math.random() * Math.PI * 2; }
      var cos = Math.cos(p.a), sin = Math.sin(p.a);
      var x1 = CXp + cos * p.d, y1 = CYp + sin * p.d;
      var prog = p.d / MAXR;
      var alpha = Math.min(prog * 2.4, 1) * Math.min(warp.speed / 6, 1);
      if (alpha < 0.02) continue;

      if (p.g && warp.speed < 14) {
        // seyrek süzülen glyph'ler (açılışa selam, ama ana dil ışık çizgileri)
        ctx.globalAlpha = alpha * 0.7;
        ctx.fillStyle = p.c;
        ctx.font = (8 + prog * 18) + 'px "JetBrains Mono",monospace';
        ctx.fillText(p.g, x1, y1);
      } else {
        var tail = Math.min(2 + p.d * 0.06 * warp.speed * 0.5, 170);
        var x0 = CXp + cos * Math.max(p.d - tail, 0);
        var y0 = CYp + sin * Math.max(p.d - tail, 0);
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = p.c;
        ctx.lineWidth = 0.6 + prog * 2.4;
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    // glitch dilimleri — hız arttıkça yoğunlaşır
    if (warp.speed > 10 && Math.random() < 0.22) {
      var gy = Math.random() * H, gh = 2 + Math.random() * 12;
      var off = (Math.random() - 0.5) * 44;
      try { ctx.drawImage(cv, 0, gy, W, gh, off, gy, W, gh); } catch (e) {}
    }
  }

  function warpStart() {
    if (warp.running) return;
    ctx.fillStyle = '#050607'; ctx.fillRect(0, 0, W, H);
    warp.running = true;
    warpFrame();
  }
  function warpStop() {
    warp.running = false;
    if (warp.raf) cancelAnimationFrame(warp.raf);
  }

  /* küçük tween yardımcıları */
  function tween(obj, key, to, ms, ease, done) {
    var from = obj[key], t0 = performance.now();
    function step(now) {
      var k = Math.min((now - t0) / ms, 1);
      obj[key] = from + (to - from) * ease(k);
      if (k < 1) requestAnimationFrame(step);
      else if (done) done();
    }
    requestAnimationFrame(step);
  }
  var easeIn = function (x) { return x * x * x; };
  var easeOut = function (x) { return 1 - Math.pow(1 - x, 3); };

  function setOv(opacity, block) {
    ov.style.opacity = opacity;
    ov.style.pointerEvents = block ? 'all' : 'none';
  }

  /* ---- ÇIKIŞ: warp hızlanır, flaş, yönlendir ---- */
  var leaving = false;
  function playExit(href) {
    if (leaving) return;
    leaving = true;
    try { sessionStorage.setItem('fx-enter', '1'); } catch (e) {}
    warp.speed = 2;
    warpStart();
    ov.style.transition = 'opacity .18s linear';
    setOv(1, true);
    tween(warp, 'speed', 30, 620, easeIn, function () {
      flash.style.transition = 'opacity .12s linear';
      flash.style.opacity = '1';
      setTimeout(function () { window.location.href = href; }, 110);
    });
  }

  /* ---- GİRİŞ: warp yavaşlar, perde açılır ---- */
  function playEnter() {
    warp.speed = 26;
    warpStart();
    ov.style.transition = 'none';
    setOv(1, true);
    requestAnimationFrame(function () {
      tween(warp, 'speed', 1.5, 850, easeOut);
      setTimeout(function () {
        ov.style.transition = 'opacity .55s ease';
        setOv(0, false);
        setTimeout(warpStop, 600);
      }, 300);
    });
  }

  /* ---- OYUN BOOT LAUNCHER ---- */
  function playBoot(label, href) {
    if (leaving) return;
    leaving = true;
    try { sessionStorage.setItem('fx-enter', '1'); } catch (e) {}
    try { sessionStorage.setItem('fxboot:' + href, '1'); } catch (e) {}

    warp.speed = 2.2;            // arkada sakin ışık akışı
    warpStart();
    ov.style.transition = 'opacity .2s linear';
    setOv(1, true);
    bootEl.style.transition = 'opacity .25s ease';
    bootEl.style.opacity = '1';

    var linesEl = bootEl.querySelector('.fxb-lines');
    var barEl = bootEl.querySelector('.fxb-bar');
    var pctEl = bootEl.querySelector('.fxb-pct');
    linesEl.innerHTML = ''; barEl.style.width = '0%'; pctEl.textContent = '0%';

    var script = [
      '> hedef: ' + label,
      '> varliklar yukleniyor...',
      ''  // progress satırı yerine bar dolacak
    ];

    var li = 0;
    function nextLine() {
      if (li >= script.length) { runBar(); return; }
      var text = script[li++];
      if (!text) { nextLine(); return; }
      var div = document.createElement('div');
      linesEl.appendChild(div);
      var ci = 0;
      var iv = setInterval(function () {
        div.textContent = text.slice(0, ++ci);
        if (ci >= text.length) { clearInterval(iv); setTimeout(nextLine, 120); }
      }, 14);
    }

    function runBar() {
      var p = { v: 0 };
      tween(p, 'v', 100, 820, easeOut, launch);
      var iv = setInterval(function () {
        barEl.style.width = p.v + '%';
        pctEl.textContent = Math.round(p.v) + '%';
        if (p.v >= 100) clearInterval(iv);
      }, 30);
    }

    function launch() {
      var ok = document.createElement('div');
      ok.className = 'ok';
      ok.textContent = '> OK — baslatiliyor';
      linesEl.appendChild(ok);
      setTimeout(function () {
        bootEl.style.opacity = '0';
        tween(warp, 'speed', 30, 480, easeIn, function () {
          flash.style.transition = 'opacity .12s linear';
          flash.style.opacity = '1';
          setTimeout(function () { window.location.href = href; }, 110);
        });
      }, 340);
    }

    nextLine();
  }

  /* ---- LİNK YAKALAMA ---- */
  function isInternal(a) {
    var href = a.getAttribute('href') || '';
    if (!href || href.charAt(0) === '#' || href.indexOf('mailto:') === 0) return false;
    if (a.target === '_blank') return false;
    if (/^https?:\/\//i.test(href) && href.indexOf(location.hostname) === -1) return false;
    return true;
  }

  if (!REDUCED) {
    document.addEventListener('click', function (e) {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || e.button !== 0) return;
      var a = e.target.closest ? e.target.closest('a[href]') : null;
      if (!a || !isInternal(a)) return;
      e.preventDefault();
      var href = a.getAttribute('href');
      var boot = a.getAttribute('data-boot');
      var seen = false;
      try { seen = !!sessionStorage.getItem('fxboot:' + href); } catch (er) {}
      if (boot && !seen) playBoot(boot, href);
      else playExit(href);
    });

    // sayfa girişi: önceki sayfadan warp ile geldiysek
    var entered = false;
    try { entered = !!sessionStorage.getItem('fx-enter'); } catch (e) {}
    if (entered) {
      try { sessionStorage.removeItem('fx-enter'); } catch (e) {}
      playEnter();
    }

    // geri tuşu / bfcache: takılı overlay bırakma
    window.addEventListener('pageshow', function (e) {
      if (e.persisted) {
        leaving = false;
        warpStop();
        ov.style.transition = 'none';
        setOv(0, false);
        flash.style.opacity = '0';
        bootEl.style.opacity = '0';
      }
    });
  }

  /* ----------------------------------------------------------------
     2. CROSSHAIR İMLEÇ  (yalnızca mouse'lu cihazlar)
  ---------------------------------------------------------------- */
  if (FINE && !REDUCED) {
    document.documentElement.classList.add('fx-cursor');
    var dot = document.createElement('div'); dot.id = 'fxCurDot';
    var ring = document.createElement('div'); ring.id = 'fxCurRing';
    ring.innerHTML = '<i></i><i></i><i></i><i></i>';
    document.body.appendChild(dot); document.body.appendChild(ring);

    var mx = -100, my = -100, rx = -100, ry = -100;
    document.addEventListener('mousemove', function (e) { mx = e.clientX; my = e.clientY; });
    document.addEventListener('mouseover', function (e) {
      if (e.target.closest && e.target.closest('a,button,[data-boot],input,textarea,select')) ring.classList.add('lock');
    });
    document.addEventListener('mouseout', function (e) {
      if (e.target.closest && e.target.closest('a,button,[data-boot],input,textarea,select')) ring.classList.remove('lock');
    });
    (function curLoop() {
      requestAnimationFrame(curLoop);
      dot.style.left = mx + 'px'; dot.style.top = my + 'px';
      rx += (mx - rx) * 0.18; ry += (my - ry) * 0.18;
      ring.style.left = rx + 'px'; ring.style.top = ry + 'px';
    })();
  }

  /* ----------------------------------------------------------------
     3. HUD SCROLL ÇUBUĞU
  ---------------------------------------------------------------- */
  var sb = document.createElement('div'); sb.id = 'fxScroll';
  sb.innerHTML = '<b></b>';
  document.body.appendChild(sb);
  var sbBar = sb.firstChild;
  function updScroll() {
    var max = document.documentElement.scrollHeight - window.innerHeight;
    var p = max > 0 ? (window.scrollY || document.documentElement.scrollTop) / max : 0;
    sbBar.style.transform = 'scaleY(' + Math.min(Math.max(p, 0), 1) + ')';
  }
  window.addEventListener('scroll', updScroll, { passive: true });
  window.addEventListener('resize', updScroll);
  updScroll();

  /* ----------------------------------------------------------------
     4. NAV HOVER SCRAMBLE
  ---------------------------------------------------------------- */
  if (FINE && !REDUCED) {
    var POOL = '!<>-_/[]{}=+*^?#01';
    document.querySelectorAll('.nav-links a').forEach(function (a) {
      var orig = a.textContent;
      var iv = null;
      a.addEventListener('mouseenter', function () {
        var frame = 0, total = 10;
        if (iv) clearInterval(iv);
        iv = setInterval(function () {
          frame++;
          var out = '';
          for (var i = 0; i < orig.length; i++) {
            if (orig.charAt(i) === ' ') { out += ' '; continue; }
            out += (i / orig.length < frame / total)
              ? orig.charAt(i)
              : POOL[(Math.random() * POOL.length) | 0];
          }
          a.textContent = out;
          if (frame >= total) { a.textContent = orig; clearInterval(iv); iv = null; }
        }, 28);
      });
      a.addEventListener('mouseleave', function () {
        if (iv) { clearInterval(iv); iv = null; }
        a.textContent = orig;
      });
    });
  }

  /* ----------------------------------------------------------------
     5. KART 3D TILT  (.proj / .svc / .value — yalnızca desktop)
  ---------------------------------------------------------------- */
  if (FINE && !REDUCED) {
    document.querySelectorAll('.proj.hud, .svc.hud, .value.hud').forEach(function (el) {
      el.classList.add('fx-tilt');
      var rect = null;
      el.addEventListener('mouseenter', function () {
        rect = el.getBoundingClientRect();
        el.style.transition = 'transform .08s ease-out'; // sayfadaki .fx geçişini ezer
      });
      el.addEventListener('mousemove', function (e) {
        if (!rect) rect = el.getBoundingClientRect();
        var px = (e.clientX - rect.left) / rect.width - 0.5;
        var py = (e.clientY - rect.top) / rect.height - 0.5;
        el.style.transform = 'perspective(760px) rotateX(' + (-py * 7) + 'deg) rotateY(' + (px * 9) + 'deg) translateY(-4px)';
      });
      el.addEventListener('mouseleave', function () {
        rect = null;
        el.style.transition = 'transform .45s cubic-bezier(.22,1,.36,1)';
        el.style.transform = '';
        setTimeout(function () { el.style.transition = ''; }, 460);
      });
    });
  }
})();
