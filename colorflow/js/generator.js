/* =========================================================================
 * generator.js  —  Seviye üretici + çözücü (solver).
 *   - solve(): herhangi bir çözüm yolunu bulur (ipucu & doğrulama için).
 *   - generate(): ÇÖZÜLEBİLİRLİĞİ GARANTİLİ seviye üretir (spec şartı).
 * ========================================================================= */
window.CF = window.CF || {};

CF.generator = (function () {
  "use strict";
  const L = () => CF.logic;

  /* ---- Çözücü: sezgisel sıralı DFS + ziyaret kümesi ---------------------
   * Herhangi bir çözüm bulunca hamle listesini döndürür, yoksa null.
   * nodeCap: düğüm bütçesi (patlamayı önler, performans için). */
  function solve(tubes, cap, nodeCap) {
    cap = cap || CF.config.CAPACITY;
    nodeCap = nodeCap || 80000;
    const logic = L();
    const visited = new Set();
    const path = [];
    let nodes = 0;
    let overflow = false;

    function scoreMove(state, m) {
      // Yüksek skor önce denenir.
      const to = state[m.to], from = state[m.from];
      let s = 0;
      const movingColor = from[from.length - 1];
      // Bir tüpü tamamlıyor mu?
      if (to.length + m.count === cap &&
          (to.length === 0 || to[0] === movingColor) &&
          to.every((x) => x === movingColor)) s += 100;
      // Kaynağı boşaltıyor mu?
      if (m.count === from.length) s += 40;
      // Aynı renge (dolu tüpe) döküyor => konsolidasyon
      if (to.length > 0) s += 20;
      // Tüm kaynak tek renkken boşa dökmek israf => cezalandır
      if (to.length === 0 && logic.topRun(from) === from.length) s -= 30;
      return s;
    }

    function dfs(state, depth) {
      if (logic.isWin(state, cap)) return true;
      if (nodes++ > nodeCap) { overflow = true; return false; }
      const key = logic.canonical(state);
      if (visited.has(key)) return false;
      visited.add(key);

      const moves = logic.legalMoves(state, cap);
      moves.sort((a, b) => scoreMove(state, b) - scoreMove(state, a));

      for (const m of moves) {
        const res = logic.applyPour(state, m.from, m.to, cap);
        if (!res) continue;
        path.push({ from: m.from, to: m.to, count: res.count });
        if (dfs(res.state, depth + 1)) return true;
        path.pop();
        if (overflow) return false;
      }
      return false;
    }

    const ok = dfs(logic.cloneState(tubes), 0);
    return ok ? path.slice() : null;
  }

  function isSolvable(tubes, cap, nodeCap) {
    return solve(tubes, cap, nodeCap) !== null;
  }

  /* ---- Üretici ----------------------------------------------------------
   * Çözülmüş durumdan başlar, tüm birimleri karıştırıp renk-tüplerine
   * dağıtır, sonra ÇÖZÜLEBİLİR olduğunu doğrular. Değilse yeni tohumla
   * tekrar dener => her zaman çözülebilir seviye. */
  function generate(opts) {
    const cap = opts.capacity || CF.config.CAPACITY;
    const colors = opts.colors;
    const empties = opts.empties != null ? opts.empties : 2;
    let seed = (opts.seed >>> 0) || 1;

    for (let attempt = 0; attempt < 400; attempt++) {
      const rng = CF.util.rngFromSeed((seed + attempt * 2654435761) >>> 0);

      // Tüm birimleri topla (her renkten cap adet) ve karıştır.
      const units = [];
      for (let c = 0; c < colors; c++)
        for (let k = 0; k < cap; k++) units.push(c);
      rng.shuffle(units);

      // Renk-tüplerine dağıt (boş tüpler boş kalır).
      const tubes = [];
      let idx = 0;
      for (let c = 0; c < colors; c++) {
        const t = [];
        for (let k = 0; k < cap; k++) t.push(units[idx++]);
        tubes.push(t);
      }
      for (let e = 0; e < empties; e++) tubes.push([]);

      // Zaten çözülü (çok kolay) olanı atla.
      if (L().isWin(tubes, cap)) continue;

      // Çözülebilirlik doğrulaması.
      if (isSolvable(tubes, cap, 60000)) {
        return { tubes, capacity: cap, colors, empties };
      }
    }

    // Aşırı nadir: garanti çözülebilir "neredeyse çözülü" yedek üret.
    return fallbackSolvable(colors, empties, cap, seed);
  }

  // Garantili çözülebilir yedek: çözülü durumdan tek-birim swap'larla hafif
  // karıştırma (her adım çözücüyle doğrulanır).
  function fallbackSolvable(colors, empties, cap, seed) {
    const rng = CF.util.rngFromSeed(seed >>> 0);
    const tubes = [];
    for (let c = 0; c < colors; c++) {
      const t = []; for (let k = 0; k < cap; k++) t.push(c); tubes.push(t);
    }
    for (let e = 0; e < empties; e++) tubes.push([]);
    // Üst katmanları birkaç kez takas et, her seferinde çözülebilir kalsın.
    let swaps = colors * cap;
    while (swaps-- > 0) {
      const i = rng.int(colors), j = rng.int(colors);
      if (i === j) continue;
      const ti = tubes[i], tj = tubes[j];
      const tmp = ti[ti.length - 1];
      ti[ti.length - 1] = tj[tj.length - 1];
      tj[tj.length - 1] = tmp;
      if (!isSolvable(tubes, cap, 40000)) {
        // geri al
        const t2 = ti[ti.length - 1];
        ti[ti.length - 1] = tj[tj.length - 1];
        tj[tj.length - 1] = t2;
      }
    }
    return { tubes, capacity: cap, colors, empties };
  }

  /* Bir seviye numarasından (kampanya) tam seviye tanımı üret. */
  function buildLevel(levelNumber) {
    const b = CF.config.band(levelNumber);
    const gen = generate({
      colors: b.colors,
      empties: b.empties,
      capacity: CF.config.CAPACITY,
      seed: (levelNumber * 100003 + 7) >>> 0,
    });
    // Optimal hamle sayısını (yıldız eşiği için) çözücüyle hesapla.
    const sol = solve(gen.tubes, gen.capacity, 120000);
    gen.optimalMoves = sol ? sol.length : (b.colors * 2 + 4);
    gen.level = levelNumber;
    gen.tubeCount = gen.tubes.length;
    gen.themeIndex = Math.floor((levelNumber - 1) / 25) % CF.config.BG_THEMES.length;
    return gen;
  }

  /* Günün Bulmacası: bugünün tarihinden tohum => herkese AYNI bulmaca. */
  function buildDailyLevel(dateStr) {
    dateStr = dateStr || CF.util.todayStr();
    let h = 2166136261;
    for (let i = 0; i < dateStr.length; i++) { h ^= dateStr.charCodeAt(i); h = Math.imul(h, 16777619); }
    h = h >>> 0;
    const gen = generate({ colors: 5, empties: 2, capacity: CF.config.CAPACITY, seed: h || 1 });
    const sol = solve(gen.tubes, gen.capacity, 120000);
    gen.optimalMoves = sol ? sol.length : 14;
    gen.level = "daily";
    gen.daily = true;
    gen.dateStr = dateStr;
    gen.tubeCount = gen.tubes.length;
    gen.themeIndex = h % CF.config.BG_THEMES.length;
    return gen;
  }

  return { solve, isSolvable, generate, buildLevel, buildDailyLevel };
})();
