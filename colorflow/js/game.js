/* =========================================================================
 * game.js  —  GameController: tek seviye oynanışı. Tüp render, dokunma,
 *   akışkan dökme animasyonu, geri al, booster'lar, kazanma & yıldız.
 * ========================================================================= */
window.CF = window.CF || {};

CF.game = (function () {
  "use strict";
  const logic = () => CF.logic;
  const cfg = () => CF.config;

  let level = null;          // aktif seviye tanımı
  let state = [];            // tüplerin anlık durumu
  let history = [];          // { state, move } yığını (geri al için)
  let selected = -1;
  let moves = 0;
  let usedUndo = false;
  let startTime = 0;
  let boardEl = null;
  let onExitCb = null;
  let hintTimer = null;

  /* ---- Başlat ---------------------------------------------------------- */
  function start(levelDef, container, onExit) {
    level = levelDef;
    state = logic().cloneState(levelDef.tubes);
    history = [];
    selected = -1; moves = 0; usedUndo = false;
    startTime = Date.now();
    boardEl = container;
    onExitCb = onExit;
    CF.analytics.track("level_start", { level_number: level.level || 0, mode: CF.save.get().settings.mode });
    render();
    CF.util.bus.emit("game:hud", hud());
  }

  function hud() {
    return {
      level: level.level, moves, optimal: level.optimalMoves,
      colors: level.colors, tubes: state.length,
    };
  }

  /* ---- Render ---------------------------------------------------------- */
  // opts.fillTube / opts.fillCount: o tüpün en üst N katmanını 0'dan büyüterek
  // "sıvı doluyor" animasyonu oynatır.
  function render(opts) {
    opts = opts || {};
    boardEl.innerHTML = "";
    boardEl.dataset.skin = CF.skins.equipped();   // seçili tüp teması
    const cap = level.capacity;
    const colorBlind = CF.save.get().settings.colorBlind;
    // ızgara: satır başına en fazla ~5 tüp
    const perRow = Math.min(state.length, state.length > 8 ? 6 : (state.length > 4 ? Math.ceil(state.length / 2) : state.length));
    boardEl.style.setProperty("--per-row", perRow);

    state.forEach((tube, i) => {
      const tubeEl = CF.util.createEl("div", "tube");
      tubeEl.dataset.index = i;
      if (i === selected) tubeEl.classList.add("selected");
      if (tube.length > 0 && logic().isComplete(tube, cap)) tubeEl.classList.add("complete");

      const glass = CF.util.createEl("div", "glass");
      // katmanları alttan üste yerleştir
      for (let k = 0; k < tube.length; k++) {
        const c = cfg().COLORS[tube[k] % cfg().COLORS.length];
        const layer = CF.util.createEl("div", "layer");
        layer.style.height = (100 / cap) + "%";
        layer.style.background = `linear-gradient(180deg, ${c.top}, ${c.bot})`;
        // en üst katmanı belirgin yap
        if (k === tube.length - 1) layer.classList.add("top");
        // renk körlüğü modu: her katmana ayırt edici sembol
        if (colorBlind) {
          const sym = CF.util.createEl("span", "sym", c.symbol || "");
          layer.appendChild(sym);
        }
        // dolum animasyonu işareti (hedef tüpün yeni gelen katmanları)
        if (opts.fillTube === i && opts.fillCount && k >= tube.length - opts.fillCount) {
          layer.dataset.fill = "1";
        }
        glass.appendChild(layer);
      }
      tubeEl.appendChild(glass);
      tubeEl.addEventListener("click", () => onTubeClick(i));
      boardEl.appendChild(tubeEl);
    });

    // dolum animasyonunu tetikle: işaretli katmanları 0'dan tam yüksekliğe büyüt
    if (opts.fillTube != null && opts.fillCount) {
      const g = boardEl.querySelector(`.tube[data-index="${opts.fillTube}"] .glass`);
      if (g) {
        const fills = g.querySelectorAll('.layer[data-fill="1"]');
        fills.forEach((l) => { l.style.height = "0%"; });
        void g.offsetHeight; // reflow
        requestAnimationFrame(() => fills.forEach((l) => { l.style.height = (100 / cap) + "%"; }));
      }
    }
  }

  /* ---- Dokunma / seçim ------------------------------------------------- */
  function onTubeClick(i) {
    // Mantık her dokunuşta ANINDA işlenir (animasyon kozmetik ve bloklamaz),
    // bu yüzden A→B seçimi her zaman güvenilir aktarır.
    CF.audio.resume();
    clearHintFlash();
    const cap = level.capacity;

    // Tek dokunuş (oto-dökme): kaynağa dokun → en iyi hedefe otomatik dök.
    if (CF.save.get().settings.oneTap) {
      if (state[i].length === 0 || logic().isComplete(state[i], cap)) { wobble(i); return; }
      const to = bestTarget(i);
      if (to === -1) { CF.audio.error(); wobble(i); return; }
      selected = -1;
      doPour(i, to);
      return;
    }

    if (selected === -1) {
      if (state[i].length === 0 || logic().isComplete(state[i], cap)) { wobble(i); return; }
      selected = i; render(); CF.audio.click();
      return;
    }
    if (selected === i) { selected = -1; render(); return; }

    // dök: selected -> i  (serbest mod: renk eşleşmesi aranmaz)
    if (logic().canPour(state, selected, i, cap, true)) {
      doPour(selected, i);
    } else {
      // Geçersiz hedef: SEÇİLİ TÜPÜ DEĞİŞTİRME (piyasa liderleri de böyle yapar).
      // Seçim korunur, hedef sallanır. Kaynağı değiştirmek için seçili tüpe
      // tekrar dokun (bırakır), sonra yeni kaynağı seç.
      CF.audio.error(); wobble(i);
    }
  }

  // Tek-dokunuş için en mantıklı hedefi seç.
  function bestTarget(from) {
    const cap = level.capacity;
    const moves = logic().legalMoves(state, cap).filter((m) => m.from === from);
    if (!moves.length) return -1;
    const movingColor = logic().topColor(state[from]);
    let best = -1, bestScore = -Infinity;
    for (const m of moves) {
      const to = state[m.to];
      let score = m.count;                             // daha çok taşıyan
      const willLen = to.length + m.count;
      const sameAll = to.length === 0 || to.every((x) => x === movingColor);
      if (willLen === cap && sameAll) score += 100;    // tüpü tamamlıyor
      if (to.length > 0) score += 30;                  // konsolidasyon (boşu harcama)
      else score -= 5;                                 // boşa dökmek son tercih
      if (score > bestScore) { bestScore = score; best = m.to; }
    }
    return best;
  }

  /* ---- Dökme: mantık ANINDA, animasyon kozmetik ------------------------
   * state hemen güncellenir => girdi asla bloklanmaz, A→B her zaman aktarır.
   * Görsel (kaynak eğilir, sıvı boşalır, eğri akış yayı, hedef dolar, sıçrama)
   * üstte oynar ve kendini temizler; sonraki dokunuşu engellemez. */
  function doPour(from, to) {
    const cap = level.capacity;
    const res = logic().applyPour(state, from, to, cap, true); // serbest mod
    if (!res) return;
    const color = res.color, count = res.count;

    history.push({ state: logic().cloneState(state), move: { from, to } });

    // 1) mantığı ve tahtayı ANINDA uygula (hedef katmanları dolarak büyür)
    state = res.state; moves++; selected = -1;
    render({ fillTube: to, fillCount: count });

    // 2) gerçekçi kozmetik dökme animasyonu
    animatePour(from, to, color, count);

    // 3) ses/haptik/kazanma
    haptic(12); CF.audio.pour(color, count);
    if (logic().isComplete(state[to], cap)) { CF.audio.tubeComplete(); glowTube(to); haptic(20); }
    else CF.audio.pop();

    CF.util.bus.emit("game:hud", hud());
    checkWin();
  }

  // Gerçekçi dökme animasyonu (tamamen kozmetik, girdiyi bloklamaz).
  function animatePour(from, to, colorId, count) {
    const fromEl = boardEl.querySelector(`.tube[data-index="${from}"]`);
    const toEl = boardEl.querySelector(`.tube[data-index="${to}"]`);
    if (!fromEl || !toEl) return;
    const c = cfg().COLORS[colorId % cfg().COLORS.length];
    const cap = level.capacity;
    const br = boardEl.getBoundingClientRect();
    const fr = fromEl.getBoundingClientRect();
    const tr = toEl.getBoundingClientRect();
    const dir = (tr.left >= fr.left) ? 1 : -1;

    // (a) kaynağı hedefe doğru eğ + kaldır, sonra geri döndür
    fromEl.style.setProperty("--tilt", (dir * 26) + "deg");
    fromEl.style.transformOrigin = dir > 0 ? "82% 92%" : "18% 92%";
    fromEl.classList.add("pouring");
    setTimeout(() => {
      fromEl.classList.remove("pouring");
      fromEl.style.transform = "";
      fromEl.style.removeProperty("--tilt");
      fromEl.style.transformOrigin = "";
    }, 500);

    // (b) kaynağın üstünde boşalan "hayalet" katmanlar (sıvı akıp gidiyor)
    const glass = fromEl.querySelector(".glass");
    if (glass) {
      for (let k = 0; k < count; k++) {
        const g = CF.util.createEl("div", "layer draining");
        g.style.height = (100 / cap) + "%";
        g.style.background = `linear-gradient(180deg, ${c.top}, ${c.bot})`;
        glass.appendChild(g); // column-reverse => üste eklenir
      }
      void glass.offsetHeight; // reflow
      glass.querySelectorAll(".draining").forEach((g) => { g.style.height = "0%"; });
      setTimeout(() => glass.querySelectorAll(".draining").forEach((g) => g.remove()), 500);
    }

    // (c) eğri akış yayı (SVG) — kaynağın ağzından hedef yüzeyine
    const sx = fr.left - br.left + (dir > 0 ? fr.width * 0.74 : fr.width * 0.26);
    const sy = fr.top - br.top + 2;
    const ex = tr.left - br.left + tr.width / 2;
    const ey = tr.top - br.top + 10;
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("class", "pour-svg");
    svg.setAttribute("width", Math.max(1, Math.round(br.width)));
    svg.setAttribute("height", Math.max(1, Math.round(br.height)));
    const path = document.createElementNS(svgNS, "path");
    path.setAttribute("d", `M ${sx} ${sy} Q ${ex} ${sy} ${ex} ${ey}`);
    path.setAttribute("stroke", c.bot);
    path.setAttribute("stroke-width", "7");
    path.setAttribute("fill", "none");
    path.setAttribute("stroke-linecap", "round");
    svg.appendChild(path);
    boardEl.appendChild(svg);
    const len = path.getTotalLength();
    path.style.strokeDasharray = len;
    path.style.strokeDashoffset = len;
    path.getBoundingClientRect(); // reflow
    path.style.transition = "stroke-dashoffset .22s linear";
    path.style.strokeDashoffset = "0";
    setTimeout(() => { svg.style.transition = "opacity .2s"; svg.style.opacity = "0"; }, 300);
    setTimeout(() => svg.remove(), 620);

    // (d) hedef ağzında sıçrama damlaları (daha çok damla)
    for (let i = 0; i < 11; i++) {
      const d = CF.util.createEl("div", "droplet");
      d.style.background = c.bot;
      const sz = 5 + Math.random() * 5;
      d.style.width = sz + "px"; d.style.height = sz + "px";
      d.style.left = ex + "px"; d.style.top = ey + "px";
      const a = (-0.5 + Math.random()) * 1.9;
      d.style.setProperty("--ddx", (Math.sin(a) * (12 + Math.random() * 22)) + "px");
      d.style.setProperty("--ddy", (8 + Math.random() * 20) + "px");
      d.style.animationDelay = (0.05 + Math.random() * 0.1) + "s";
      boardEl.appendChild(d);
      setTimeout(() => d.remove(), 720);
    }
  }

  /* ---- Kazanma & yıldız ------------------------------------------------ */
  function checkWin() {
    if (!logic().isWin(state, level.capacity)) return;
    const timeSpent = Math.round((Date.now() - startTime) / 1000);
    const stars = computeStars();

    // --- Günün Bulmacası (kampanya ilerlemesini etkilemez) ---
    if (level.daily) {
      const sd = CF.save.get();
      const today = CF.util.todayStr();
      const already = sd.daily.puzzleDate === today;
      let reward = 0;
      if (!already) {
        sd.daily.puzzleDate = today; CF.save.persist();
        reward = 100; CF.economy.addCoins(reward, "daily_puzzle");
      }
      CF.audio.win(); haptic([0, 40, 30, 60]);
      CF.analytics.track("daily_puzzle_complete", { moves_used: moves });
      CF.achievements.check();
      CF.util.bus.emit("game:win", {
        daily: true, stars, reward, alreadyDone: already, moves, timeSpent,
        level: "Daily Puzzle", rewardedInterstitial: false,
      });
      return;
    }

    const s = CF.save.get();

    // ilerleme & yıldız kaydı
    const lv = level.level;
    if (lv) {
      s.stars[lv] = Math.max(s.stars[lv] || 0, stars);
      if (lv >= s.maxLevelUnlocked) s.maxLevelUnlocked = Math.min(lv + 1, CF.config.TOTAL_LEVELS + 1);
    }
    s.stats.levelsCompleted++;
    s.stats.totalMoves += moves;
    if (stars === 3) s.stats.perfectLevels++;
    s.stats._noUndoDone = s.stats._noUndoDone || !usedUndo;
    CF.save.persist();

    const reward = CF.economy.rewardForLevel(stars);
    CF.economy.addCoins(reward, "level_complete");

    CF.audio.win(); haptic([0, 40, 30, 60]);
    CF.analytics.track("level_complete", {
      level_number: lv, moves_used: moves, stars, time_spent: timeSpent,
    });
    CF.achievements.check();

    // Koleksiyon parçası ödülü (her seviye tamamlamada +1)
    const colRes = CF.collection.award(1);
    CF.achievements.check(); // koleksiyon tamamlanınca "Koleksiyoncu" açılabilir

    // Ödüllü geçiş reklamı sırası mı? (her 3 tamamlanan seviye)
    const rewardedInterstitial = CF.ads.dueRewardedInterstitial();

    CF.util.bus.emit("game:win", {
      stars, reward, moves, timeSpent, level: lv, rewardedInterstitial,
      collectionItem: colRes.gained ? colRes.newEmoji : null,
      collectionCompleted: colRes.completedName || null,
    });
  }

  function computeStars() {
    const opt = level.optimalMoves || (level.colors * 2 + 4);
    const slack = cfg().STARS_MODE_MOVE_SLACK; // [1.0,1.35,1.8]
    if (moves <= Math.ceil(opt * slack[0])) return 3;
    if (moves <= Math.ceil(opt * slack[1])) return 2;
    return 1;
  }

  /* ---- Booster'lar ----------------------------------------------------- */
  function undo() {
    if (history.length === 0) return false;
    const src = CF.boosters.use("undo");
    if (!src) { CF.audio.error(); return false; }
    const last = history.pop();
    state = last.state;
    moves = Math.max(0, moves - 1);
    usedUndo = true;
    selected = -1;
    render();
    CF.audio.pop(); haptic(10);
    CF.util.bus.emit("game:hud", hud());
    CF.analytics.track("booster_used", { booster_type: "undo", level_number: level.level, source: src });
    return true;
  }

  function addTube() {
    const src = CF.boosters.use("addTube");
    if (!src) { CF.audio.error(); return false; }
    history.push({ state: logic().cloneState(state), move: { addTube: true } });
    state.push([]);
    level.tubes.push([]); // kalıcı boyut
    render();
    CF.audio.pop();
    CF.analytics.track("booster_used", { booster_type: "addTube", level_number: level.level, source: src });
    return true;
  }

  function shuffle() {
    const src = CF.boosters.use("shuffle");
    if (!src) { CF.audio.error(); return false; }
    // Çözülebilir kalması için: tüm birimleri yeniden dağıt, çözücüyle doğrula
    history.push({ state: logic().cloneState(state), move: { shuffle: true } });
    const cap = level.capacity;
    const colors = level.colors;
    const empties = state.length - colors; // mevcut boş tüp sayısı (yaklaşık)
    let attempt = 0, newState = null;
    do {
      const gen = CF.generator.generate({
        colors, empties: Math.max(1, empties), capacity: cap,
        seed: (Date.now() + attempt) >>> 0,
      });
      newState = gen.tubes;
      // durum tüp sayısı korunsun
      while (newState.length < state.length) newState.push([]);
      attempt++;
    } while (!CF.generator.isSolvable(newState, cap, 50000) && attempt < 20);
    state = newState;
    selected = -1;
    render();
    CF.audio.pop(); haptic(15);
    CF.analytics.track("booster_used", { booster_type: "shuffle", level_number: level.level, source: src });
    return true;
  }

  function hint() {
    const src = CF.boosters.use("hint");
    if (!src) { CF.audio.error(); return false; }
    const sol = CF.generator.solve(state, level.capacity, 120000);
    if (!sol || sol.length === 0) { CF.audio.error(); return false; }
    const m = sol[0];
    flashHint(m.from, m.to);
    CF.audio.click();
    CF.analytics.track("booster_used", { booster_type: "hint", level_number: level.level, source: src });
    return true;
  }

  /* ---- Görsel geri bildirimler ---------------------------------------- */
  function glowTube(i) {
    const el = boardEl.querySelector(`.tube[data-index="${i}"]`);
    if (!el) return;
    el.classList.add("glow");
    burstConfetti(el);
    setTimeout(() => el.classList.remove("glow"), 700);
  }
  function wobble(i) {
    const el = boardEl.querySelector(`.tube[data-index="${i}"]`);
    if (!el) return;
    el.classList.add("wobble");
    setTimeout(() => el.classList.remove("wobble"), 400);
  }
  function flashHint(from, to) {
    clearHintFlash();
    const a = boardEl.querySelector(`.tube[data-index="${from}"]`);
    const b = boardEl.querySelector(`.tube[data-index="${to}"]`);
    if (a) a.classList.add("hint-from");
    if (b) b.classList.add("hint-to");
    hintTimer = setTimeout(clearHintFlash, 2200);
  }
  function clearHintFlash() {
    if (hintTimer) { clearTimeout(hintTimer); hintTimer = null; }
    boardEl && boardEl.querySelectorAll(".hint-from,.hint-to").forEach((e) => {
      e.classList.remove("hint-from", "hint-to");
    });
  }
  function burstConfetti(anchor) {
    const br = boardEl.getBoundingClientRect();
    const ar = anchor.getBoundingClientRect();
    const cx = ar.left - br.left + ar.width / 2;
    const cy = ar.top - br.top + ar.height / 3;
    for (let i = 0; i < 14; i++) {
      const p = CF.util.createEl("div", "confetti");
      const c = cfg().COLORS[Math.floor(Math.random() * cfg().COLORS.length)];
      p.style.background = c.bot;
      p.style.left = cx + "px"; p.style.top = cy + "px";
      const ang = Math.random() * Math.PI * 2;
      const dist = 40 + Math.random() * 70;
      p.style.setProperty("--dx", Math.cos(ang) * dist + "px");
      p.style.setProperty("--dy", (Math.sin(ang) * dist - 30) + "px");
      boardEl.appendChild(p);
      setTimeout(() => p.remove(), 900);
    }
  }

  /* ---- Haptik ---------------------------------------------------------- */
  function haptic(pattern) {
    if (!CF.save.get().settings.haptics) return;
    if (navigator.vibrate) { try { navigator.vibrate(pattern); } catch (e) {} }
  }

  function restart() { start(level, boardEl, onExitCb); }
  function getMoves() { return moves; }

  return {
    start, undo, addTube, shuffle, hint, restart, getMoves,
  };
})();
