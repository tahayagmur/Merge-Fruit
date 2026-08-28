/* =========================================================================
 * util.js  —  Genel yardımcılar, olay veri yolu (event bus), seeded RNG
 * ========================================================================= */
window.CF = window.CF || {};

CF.util = (function () {
  "use strict";

  /* Deterministik (tohumlu) rasgele sayı üreteci — mulberry32.
   * Aynı tohum her zaman aynı seviyeyi üretir => 150 seviye kararlı olur. */
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function rngFromSeed(seed) {
    const r = mulberry32(seed);
    return {
      next: r,                                   // [0,1)
      int: (n) => Math.floor(r() * n),           // [0,n)
      range: (a, b) => a + Math.floor(r() * (b - a + 1)),
      pick: (arr) => arr[Math.floor(r() * arr.length)],
      shuffle: (arr) => {                         // Fisher-Yates, yerinde
        for (let i = arr.length - 1; i > 0; i--) {
          const j = Math.floor(r() * (i + 1));
          const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
        }
        return arr;
      },
    };
  }

  /* Basit yayınla/abone ol olay veri yolu (event-driven mimari). */
  const listeners = {};
  const bus = {
    on(evt, fn) {
      (listeners[evt] || (listeners[evt] = [])).push(fn);
      return () => bus.off(evt, fn);
    },
    off(evt, fn) {
      const a = listeners[evt];
      if (a) { const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); }
    },
    emit(evt, payload) {
      const a = listeners[evt];
      if (a) a.slice().forEach((fn) => { try { fn(payload); } catch (e) { console.error(e); } });
    },
  };

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const el = (id) => document.getElementById(id);

  function createEl(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  /* Bugünün tarihi YYYY-MM-DD (yerel) — günlük seri/ödül sıfırlaması için. */
  function todayStr(d) {
    d = d || new Date();
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }
  function daysBetween(aStr, bStr) {
    const a = new Date(aStr + "T00:00:00");
    const b = new Date(bStr + "T00:00:00");
    return Math.round((b - a) / 86400000);
  }

  return { rngFromSeed, bus, clamp, el, createEl, todayStr, daysBetween };
})();
