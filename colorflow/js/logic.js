/* =========================================================================
 * logic.js  —  Saf sıralama mantığı (SortLogic). Görselden bağımsız.
 *   Bir "durum" = tüplerin dizisi; her tüp = renk id'lerinin dizisi
 *   (alttan üste). Boş dolgu = renk id 'undefined' yok, sadece uzunluk.
 * ========================================================================= */
window.CF = window.CF || {};

CF.logic = (function () {
  "use strict";
  const CAP = () => CF.config.CAPACITY;

  const cloneState = (tubes) => tubes.map((t) => t.slice());

  const topColor = (tube) => (tube.length ? tube[tube.length - 1] : -1);

  // Tüpün üstündeki aynı renkten kesintisiz katman sayısı.
  function topRun(tube) {
    if (!tube.length) return 0;
    const c = tube[tube.length - 1];
    let n = 1;
    for (let i = tube.length - 2; i >= 0; i--) {
      if (tube[i] === c) n++; else break;
    }
    return n;
  }

  // Tek renkli & tam dolu mu (ya da boş)? Kazanma kontrolü için.
  function isComplete(tube, cap) {
    cap = cap || CAP();
    if (tube.length === 0) return true;
    if (tube.length !== cap) return false;
    const c = tube[0];
    return tube.every((x) => x === c);
  }

  // A tüpünden B tüpüne dökme geçerli mi?
  // free=true (oynanış): renk eşleşmesi aranmaz — yer varsa her tüpe dökülür.
  // free=false (çözücü/üretici): klasik su-sıralama kuralı (aynı renk veya boş).
  function canPour(tubes, from, to, cap, free) {
    cap = cap || CAP();
    if (from === to) return false;
    const a = tubes[from], b = tubes[to];
    if (!a || !b) return false;
    if (a.length === 0) return false;               // kaynak boş
    if (b.length >= cap) return false;              // hedef dolu
    if (free) return true;                           // serbest mod: renk şartı yok
    if (b.length === 0) return true;                 // klasik: boşa her zaman
    return topColor(a) === topColor(b);              // klasik: üst renkler aynı
  }

  // Dökme sonucu kaç katman taşınır?
  function pourAmount(tubes, from, to, cap) {
    cap = cap || CAP();
    const a = tubes[from], b = tubes[to];
    const run = topRun(a);
    const space = cap - b.length;
    return Math.max(0, Math.min(run, space));
  }

  // Dökmeyi uygula (yeni durum döndürür). Geçersizse null. free: serbest mod.
  function applyPour(tubes, from, to, cap, free) {
    cap = cap || CAP();
    if (!canPour(tubes, from, to, cap, free)) return null;
    const n = pourAmount(tubes, from, to, cap);
    if (n <= 0) return null;
    const ns = cloneState(tubes);
    const color = topColor(ns[from]);
    for (let i = 0; i < n; i++) { ns[from].pop(); ns[to].push(color); }
    return { state: ns, count: n, color };
  }

  // Tüm tüpler tamamlandı mı? (kazanma)
  function isWin(tubes, cap) {
    cap = cap || CAP();
    return tubes.every((t) => isComplete(t, cap));
  }

  // Geçerli tüm hamleler [ {from,to,count} ].
  function legalMoves(tubes, cap) {
    cap = cap || CAP();
    const moves = [];
    for (let i = 0; i < tubes.length; i++) {
      if (tubes[i].length === 0) continue;
      if (isComplete(tubes[i], cap)) continue;       // bitmiş tüpü kurcalama
      for (let j = 0; j < tubes.length; j++) {
        if (i === j) continue;
        if (canPour(tubes, i, j, cap)) {
          // Boş->boş veya tek renk tam tüpü başka boşa taşımayı ele
          const amt = pourAmount(tubes, i, j, cap);
          if (amt > 0) moves.push({ from: i, to: j, count: amt });
        }
      }
    }
    return moves;
  }

  // Durumu kanonik metne çevir (çözücü ziyaret kümesi için).
  // Tüpler kendi içinde sıralı kalır ama tüp sırası önemsiz => sıralı birleştir.
  function canonical(tubes) {
    return tubes.map((t) => t.join(",")).sort().join("|");
  }

  return {
    cloneState, topColor, topRun, isComplete, canPour, pourAmount,
    applyPour, isWin, legalMoves, canonical,
  };
})();
