/* =========================================================================
 * ui.js  —  Ekran yönlendirme + tüm arayüzler (harita, oynanış HUD,
 *   kazanma, mağaza, ayarlar, günlük ödül, başarımlar).
 * ========================================================================= */
window.CF = window.CF || {};

CF.ui = (function () {
  "use strict";
  const el = CF.util.el;
  const mk = CF.util.createEl;
  const cfg = () => CF.config;

  let root, topbar, screenEl, modalRoot, coinLabel;

  function init() {
    root = el("app");
    topbar = el("topbar");
    screenEl = el("screen");
    modalRoot = el("modal-root");
    coinLabel = el("coin-label");

    // üst bar butonları
    el("btn-shop").addEventListener("click", () => { CF.audio.click(); showShop(); });
    el("btn-settings").addEventListener("click", () => { CF.audio.click(); showSettings(); });
    el("btn-daily").addEventListener("click", () => { CF.audio.click(); showDaily(); });

    CF.util.bus.on("coins:changed", refreshCoins);
    CF.util.bus.on("save:changed", refreshCoins);
    CF.util.bus.on("boosters:changed", updateBoosterCounts);
    CF.util.bus.on("achievement:unlocked", (a) => toast(`${a.icon} Achievement: ${a.name}`));
    CF.util.bus.on("collection:completed", (c) => toast(`🏆 "${c.name}" collection complete!`));
    refreshCoins();

    CF.ads.setPresenter(presentAd);   // reklam görsel overlay'ini kaydet
    CF.iap.setPresenter(presentIapPurchase); // gerçek-para satın alma (web simülasyonu)
    probeGeneratedAssets();
    showMap();

    // Günlük ödül hazırsa küçük rozet
    updateDailyBadge();
  }

  function refreshCoins() {
    if (coinLabel) coinLabel.textContent = CF.economy.coins();
    updateDailyBadge();
  }
  function updateDailyBadge() {
    const b = el("daily-badge");
    if (b) b.style.display = CF.daily.canClaim() ? "block" : "none";
  }

  /* ---- HARİTA (seviye seçimi, Candy Crush tarzı yol) ------------------- */
  function showMap() {
    setTopbar(true);
    screenEl.className = "screen map-screen";
    screenEl.innerHTML = "";

    const header = mk("div", "map-header");
    const s = CF.save.get();
    const mode = s.settings.mode === "challenge" ? "Challenge" : "Relax";
    header.innerHTML = `
      <img class="logo" src="assets/icon.svg" alt="Color Flow Puzzle" />
      <h1 class="title">Color Flow<span>Puzzle</span></h1>
      <div class="subtitle">Sort the liquids by color</div>`;
    screenEl.appendChild(header);

    // hızlı oyna butonu
    const cont = mk("button", "btn primary big");
    const nextLevel = Math.min(s.maxLevelUnlocked, cfg().TOTAL_LEVELS);
    cont.innerHTML = `▶ Play — Level ${nextLevel}`;
    cont.addEventListener("click", () => { CF.audio.click(); loadLevel(nextLevel); });
    screenEl.appendChild(cont);

    // Günün Bulmacası (bugün yapılmadıysa vurgulu)
    const dailyDone = s.daily.puzzleDate === CF.util.todayStr();
    const dailyBtn = mk("button", "btn " + (dailyDone ? "ghost" : "reward-ad"));
    dailyBtn.innerHTML = dailyDone ? "🗓️ Daily Puzzle ✓" : "🗓️ Daily Puzzle";
    dailyBtn.addEventListener("click", () => { CF.audio.click(); loadDailyPuzzle(); });
    screenEl.appendChild(dailyBtn);

    // mod & koleksiyon & başarım satırı
    const rowBtns = mk("div", "row-btns");
    const modeBtn = mk("button", "btn ghost");
    modeBtn.innerHTML = `🎚️ Mode: ${mode}`;
    modeBtn.addEventListener("click", () => {
      s.settings.mode = s.settings.mode === "challenge" ? "relax" : "challenge";
      CF.save.persist(); CF.audio.click(); showMap();
    });
    const colBtn = mk("button", "btn ghost");
    const colU = CF.collection.unlocked(), colT = CF.collection.total();
    colBtn.innerHTML = `🖼️ Collection <small>${colU}/${colT}</small>`;
    colBtn.addEventListener("click", () => { CF.audio.click(); showCollection(); });
    const skinBtn = mk("button", "btn ghost");
    skinBtn.innerHTML = "🎨 Themes";
    skinBtn.addEventListener("click", () => { CF.audio.click(); showSkins(); });
    const achBtn = mk("button", "btn ghost");
    achBtn.innerHTML = "🏆 Achievements";
    achBtn.addEventListener("click", () => { CF.audio.click(); showAchievements(); });
    rowBtns.append(modeBtn, colBtn, skinBtn, achBtn);
    screenEl.appendChild(rowBtns);

    // seviye yolu
    const path = mk("div", "level-path");
    const total = cfg().TOTAL_LEVELS;
    for (let lv = 1; lv <= total; lv++) {
      const node = mk("button", "level-node");
      node.style.marginLeft = (Math.sin(lv * 0.6) * 60 + 60) + "px";
      const stars = s.stars[lv] || 0;
      const unlocked = lv <= s.maxLevelUnlocked;
      if (!unlocked) node.classList.add("locked");
      if (stars > 0) node.classList.add("done");
      node.innerHTML = `<span class="num">${unlocked ? lv : "🔒"}</span>
        <span class="stars">${starStr(stars)}</span>`;
      if (unlocked) node.addEventListener("click", () => { CF.audio.click(); loadLevel(lv); });
      path.appendChild(node);
    }
    screenEl.appendChild(path);

    // Banner reklam (harita altında; reklamlar kaldırıldıysa gizle)
    if (s.stats.adsRemoved) {
      CF.ads.hideBanner();
    } else if (CF.ads.isNativeAds()) {
      CF.ads.showBanner();          // native: gerçek AdMob banner'ı
    } else {
      const banner = mk("div", "banner-ad",   // web: simulation
        `<span class="ad-tag">Ad · banner</span><span>📢 Banner area (simulation)</span>`);
      banner.title = CF.ads.bannerId();
      screenEl.appendChild(banner);
    }

    // en son açılan seviyeye kaydır
    setTimeout(() => {
      const target = path.children[Math.min(s.maxLevelUnlocked, total) - 1];
      if (target) target.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 60);

    setBg((Math.floor((nextLevel - 1) / 25)) % cfg().BG_THEMES.length);
  }

  function starStr(n) {
    let out = "";
    for (let i = 0; i < 3; i++) out += i < n ? "★" : "☆";
    return out;
  }

  /* ---- Seviye yükle (çözücü biraz sürebilir => kısa yükleme) ---------- */
  function loadLevel(lv) {
    if (lv > cfg().TOTAL_LEVELS) { toast("Campaign complete! 👑"); return; }
    showLoading("Preparing level…");
    setTimeout(() => {
      const def = CF.generator.buildLevel(lv);
      hideLoading();
      startGame(def);
    }, 30);
  }

  function loadDailyPuzzle() {
    showLoading("Preparing daily puzzle…");
    setTimeout(() => {
      const def = CF.generator.buildDailyLevel();
      hideLoading();
      startGame(def);
    }, 30);
  }

  /* ---- OYNANIŞ EKRANI -------------------------------------------------- */
  function startGame(def) {
    setTopbar(false);
    CF.ads.hideBanner();   // oynanışta banner yok (native)
    setBg(def.themeIndex);
    screenEl.className = "screen game-screen";
    screenEl.innerHTML = `
      <div class="game-top">
        <button class="icon-btn" id="g-back">←</button>
        <div class="hud">
          <div class="hud-item"><span class="hud-lbl">Level</span><span id="hud-level">-</span></div>
          <div class="hud-item"><span class="hud-lbl">Moves</span><span id="hud-moves">0</span></div>
          <div class="hud-item"><span class="hud-lbl">Coins</span><span id="hud-coin">0</span></div>
        </div>
        <button class="icon-btn" id="g-restart">⟳</button>
      </div>
      <div id="board" class="board"></div>
      <div class="booster-bar" id="booster-bar"></div>`;

    el("g-back").addEventListener("click", () => { CF.audio.click(); showMap(); });
    el("g-restart").addEventListener("click", () => { CF.audio.click(); CF.game.restart(); });

    buildBoosterBar();

    CF.util.bus.off("game:hud", onHud);
    CF.util.bus.on("game:hud", onHud);
    CF.util.bus.off("game:win", onWin);
    CF.util.bus.on("game:win", onWin);

    CF.game.start(def, el("board"), showMap);
  }

  function onHud(h) {
    if (el("hud-level")) el("hud-level").textContent = h.level === "daily" ? "🗓️" : (h.level || "?");
    if (el("hud-moves")) el("hud-moves").textContent = h.moves + (CF.save.get().settings.mode === "challenge" ? " / " + Math.ceil(h.optimal * 1.35) : "");
    if (el("hud-coin")) el("hud-coin").textContent = CF.economy.coins();
    updateBoosterCounts();
  }

  function buildBoosterBar() {
    const bar = el("booster-bar");
    bar.innerHTML = "";
    const defs = [
      { b: cfg().BOOSTERS.undo,    fn: () => CF.game.undo() },
      { b: cfg().BOOSTERS.hint,    fn: () => CF.game.hint() },
      { b: cfg().BOOSTERS.addTube, fn: () => CF.game.addTube() },
      { b: cfg().BOOSTERS.shuffle, fn: () => CF.game.shuffle() },
    ];
    defs.forEach(({ b, fn }) => {
      const btn = mk("button", "booster");
      btn.dataset.booster = b.id;
      btn.innerHTML = `<span class="bicon">${b.icon}</span>
        <span class="bname">${b.name}</span>
        <span class="bcount" data-count="${b.id}"></span>`;
      btn.addEventListener("click", () => { CF.audio.click(); if (!fn()) toast("Not enough coins/boosters"); });
      bar.appendChild(btn);
    });
    updateBoosterCounts();
  }
  function updateBoosterCounts() {
    document.querySelectorAll("[data-count]").forEach((sp) => {
      const id = sp.getAttribute("data-count");
      const n = CF.boosters.count(id);
      sp.textContent = n > 0 ? n : cfg().BOOSTERS[id].cost + "🪙";
      sp.classList.toggle("buy", n === 0);
    });
  }

  /* ---- KAZANMA ekranı -------------------------------------------------- */
  function onWin(w) { showWinModal(w); }

  function showWinModal(w) {
    const m = openModal("win");
    const doubled = w._doubled;
    const daily = w.daily;
    const title = daily ? "🗓️ Daily Puzzle!" : `Level ${w.level} Complete!`;
    const rewardLine = (daily && w.alreadyDone)
      ? `<div class="win-reward small">Today's reward already claimed 👍</div>`
      : `<div class="win-reward">+${w.reward}${doubled ? ` +${w.reward}` : ""} 🪙</div>`;
    const collLine = (!daily && w.collectionItem)
      ? `<div class="win-collect">🖼️ Collection: +1 <span class="ci">${w.collectionItem}</span></div>` : "";
    const collDone = (!daily && w.collectionCompleted)
      ? `<div class="win-collect done">🏆 "${w.collectionCompleted}" completed! +${cfg().COLLECTION_COMPLETE_BONUS}🪙</div>` : "";
    const canDouble = w.reward > 0 && !doubled;
    const twoxBtn = doubled
      ? `<button class="btn reward-ad" disabled>✔ 2x coins claimed</button>`
      : (canDouble ? `<button class="btn reward-ad" id="win-2x">📺 Watch ad → 2x coins (+${w.reward})</button>` : "");
    const actions = daily
      ? `<div class="win-actions">
           <button class="btn ghost" id="win-map">Map</button>
           <button class="btn primary" id="win-replay">Replay</button>
         </div>`
      : `<div class="win-actions">
           <button class="btn ghost" id="win-map">Map</button>
           <button class="btn ghost" id="win-replay">Replay</button>
           <button class="btn primary" id="win-next">Next ▶</button>
         </div>`;
    m.innerHTML = `
      <div class="win-card">
        <h2>${title}</h2>
        <div class="win-stars">${[0,1,2].map(i=>`<span class="ws ${i<w.stars?'on':''}">★</span>`).join("")}</div>
        ${rewardLine}
        <div class="win-meta">Moves: ${w.moves} · Time: ${w.timeSpent}s</div>
        ${collLine}${collDone}
        ${twoxBtn}
        ${actions}
      </div>`;
    const dbl = el("win-2x");
    if (dbl) dbl.addEventListener("click", () => {
      CF.ads.show("rewarded", "win_double", (ok) => {
        if (ok) { CF.economy.addCoins(w.reward, "reward_ad_2x"); w._doubled = true; toast(`+${w.reward} 🪙 (2x)`); }
        showWinModal(w);
      });
    });
    el("win-map").addEventListener("click", () => { CF.audio.click(); afterWin(w, () => { closeModal(); showMap(); }); });
    const rep = el("win-replay");
    if (rep) rep.addEventListener("click", () => { CF.audio.click(); afterWin(w, () => { closeModal(); daily ? loadDailyPuzzle() : loadLevel(w.level); }); });
    const nxt = el("win-next");
    if (nxt) nxt.addEventListener("click", () => { CF.audio.click(); afterWin(w, () => { closeModal(); loadLevel(w.level + 1); }); });
  }

  // Ödüllü geçiş reklamı sırası geldiyse önce onu göster, sonra aksiyonu yürüt.
  function afterWin(w, action) {
    if (w.rewardedInterstitial) {
      w.rewardedInterstitial = false;
      CF.ads.show("rewardedInterstitial", "level_transition", (ok) => {
        if (ok) { CF.economy.addCoins(30, "rewarded_interstitial"); toast("+30 🪙"); }
        action();
      }, { reward: 30, skippable: true });
    } else action();
  }

  /* ---- Reklam görsel overlay'i (AdMob köprüsü presenter'ı) ------------- */
  function presentAd(req) {
    // req: { kind, placement, adUnitId, opts, onReward }
    const secs = req.kind === "rewardedInterstitial" ? 4 : 3;
    const skippable = req.opts && req.opts.skippable;
    const m = openModal("ad", true);
    let t = secs, done = false;
    m.innerHTML = `<div class="ad-card">
      <div class="ad-tag">Ad · ${req.kind === "rewardedInterstitial" ? "rewarded interstitial" : "rewarded"}
        <span class="ad-id">${req.adUnitId}</span></div>
      <div class="ad-body">📺 Playing ad…<br><small>(web simulation — real AdMob in native build)</small></div>
      <div class="ad-actions">
        ${skippable ? `<button class="btn ghost" id="ad-skip">Skip</button>` : ""}
        <button class="btn primary" id="ad-claim" disabled>Claim Reward (<span id="ad-c">${t}</span>)</button>
      </div>
    </div>`;
    const iv = setInterval(() => {
      t--; const c = el("ad-c"); if (c) c.textContent = t;
      if (t <= 0) { clearInterval(iv); const b = el("ad-claim"); if (b) { b.disabled = false; b.innerHTML = "Claim Reward ✓"; } }
    }, 1000);
    const finish = (ok) => { if (done) return; done = true; clearInterval(iv); closeModal(); req.onReward && req.onReward(ok); };
    m.addEventListener("click", (e) => {
      if (e.target.id === "ad-claim" && !e.target.disabled) finish(true);
      if (e.target.id === "ad-skip") finish(false);
    });
  }

  /* ---- Gerçek-para satın alma ekranı (Google Play — web simülasyonu) --- */
  function presentIapPurchase(product, cb) {
    const m = openModal("iap", true);
    let done = false;
    const finish = (ok) => { if (done) return; done = true; closeModal(); cb(ok); };
    m.innerHTML = `<div class="ad-card">
      <div class="ad-tag">🅶 Google Play · Purchase <span class="ad-id">${product.id}</span></div>
      <div class="iap-body">
        <div class="iap-icon">🚫</div>
        <div class="iap-name">${product.name}</div>
        <div class="iap-price">${product.price}</div>
        <div class="iap-note">Web simulation — real Google Play payment in the native build.</div>
      </div>
      <div class="ad-actions">
        <button class="btn ghost" id="iap-cancel">Cancel</button>
        <button class="btn primary" id="iap-buy">Buy · ${product.price}</button>
      </div>
    </div>`;
    m.addEventListener("click", (e) => {
      if (e.target.id === "iap-buy") finish(true);
      if (e.target.id === "iap-cancel") finish(false);
    });
  }

  /* ---- MAĞAZA (gerçek para YOK; coin ya da reklam) --------------------- */
  let shopTimer = null;

  // Reklam butonu: bekleme sayacı aktifse geri sayım, değilse "Reklam izle".
  function adBtn(itemId, label) {
    const rem = CF.ads.cooldownRemaining(itemId);
    if (rem > 0) {
      return `<button class="shop-ad locked" disabled><span class="cd" data-cd="${itemId}">⏳ ${CF.ads.fmtRemaining(rem)}</span></button>`;
    }
    return `<button class="shop-ad" data-ad="${itemId}">📺 ${label}</button>`;
  }

  // Reklamla alınan ödülü ver; kullanıcıya gösterilecek mesajı döndür.
  function grantAdItem(id) {
    const E = cfg().ECONOMY;
    if (id === "ad_coins") { CF.economy.addCoins(E.adCoinReward, "ad_coins"); return `+${E.adCoinReward} 🪙`; }
    if (id === "ad_starter") {
      CF.economy.addCoins(500, "ad_starter");
      ["undo","addTube","shuffle","hint"].forEach((b) => CF.boosters.add(b, 3));
      return "Starter pack 🎁";
    }
    const key = id.replace("ad_", "");
    if (cfg().BOOSTERS[key]) { CF.boosters.add(key, 1); return `+1 ${cfg().BOOSTERS[key].name}`; }
    return "Reward claimed";
  }

  function showShop() { renderShop(openModal("shop")); }

  function renderShop(m) {
    const s = CF.save.get();
    const E = cfg().ECONOMY;
    const boosterRows = Object.values(cfg().BOOSTERS).map((b) => `
      <div class="shop-row">
        <span class="sr-name">${b.icon} ${b.name} <i>(you have: ${CF.boosters.count(b.id)})</i></span>
        <button class="buy-coin" data-buycoin="${b.id}">🪙 ${b.cost}</button>
        ${adBtn("ad_" + b.id, "+1")}
      </div>`).join("");

    m.innerHTML = `
      <div class="modal-card scroll">
        <div class="modal-head"><h2>Shop</h2><button class="icon-btn" data-close>✕</button></div>
        <p class="note">💡 Booster/coin items are bought with <b>coins</b> or by <b>watching an ad</b>
          (an ad purchase starts a <b>1-hour</b> timer for that item). <b>Remove Ads</b> is real money
          (Google Play payment).</p>

        <h3>🪙 Earn Coins</h3>
        <div class="shop-row wide-row">
          <span class="sr-name">Watch ad → <b>+${E.adCoinReward}</b> coins</span>
          ${adBtn("ad_coins", "+" + E.adCoinReward + " 🪙")}
        </div>

        <h3>🧪 Boosters</h3>
        ${boosterRows}

        <h3>🎁 Other</h3>
        <div class="shop-row">
          <span class="sr-name">🚫 Remove Ads <i>(permanent · real money)</i></span>
          ${s.stats.adsRemoved
            ? `<button class="buy-coin done" disabled>✔ Owned</button>`
            : `<button class="iap-btn" data-iap="removeAds">${cfg().IAP.removeAds.price}</button>`}
        </div>
        <div class="shop-row">
          <span class="sr-name">🎁 Starter Pack <i>(500🪙 + 3 of each)</i></span>
          <button class="buy-coin" data-starter>🪙 ${E.starterPackCost}</button>
          ${adBtn("ad_starter", "Free")}
        </div>
      </div>`;

    m.querySelector("[data-close]").addEventListener("click", closeModal);

    // coin ile booster
    m.querySelectorAll("[data-buycoin]").forEach((btn) => btn.addEventListener("click", () => {
      const id = btn.dataset.buycoin;
      if (CF.boosters.buy(id, 1)) { toast(`+1 ${cfg().BOOSTERS[id].name}`); updateBoosterCounts(); renderShop(m); }
      else toast("Not enough coins");
    }));
    // reklamları kaldır (GERÇEK PARA — Google Play Billing)
    const ra = m.querySelector("[data-iap='removeAds']");
    if (ra) ra.addEventListener("click", () => {
      CF.iap.purchase("removeAds", (ok) => {
        if (ok) toast("Ads removed ✔ Thank you!");
        showShop(); // satın alma overlay'i modalı değiştirdiği için mağazayı taze aç
      });
    });
    // başlangıç paketi (coin)
    const st = m.querySelector("[data-starter]");
    if (st) st.addEventListener("click", () => {
      if (CF.economy.spend(E.starterPackCost, "starter")) {
        CF.economy.addCoins(500, "starter_bundle");
        ["undo","addTube","shuffle","hint"].forEach((b) => CF.boosters.add(b, 3));
        toast("Starter pack 🎁"); renderShop(m);
      } else toast("Not enough coins");
    });
    // reklamla alım (1 saat bekleme başlar)
    m.querySelectorAll("[data-ad]").forEach((btn) => btn.addEventListener("click", () => {
      const id = btn.dataset.ad;
      CF.ads.show("rewarded", "shop:" + id, (ok) => {
        if (ok) { const msg = grantAdItem(id); CF.ads.armCooldown(id); toast(msg); updateBoosterCounts(); }
        showShop(); // yeniden çiz (sayaç görünür)
      });
    }));

    startShopCooldownTimer(m);
  }

  // Sayaçları saniyede bir güncelle; süre dolunca mağazayı yeniden çiz.
  function startShopCooldownTimer(m) {
    clearInterval(shopTimer);
    shopTimer = setInterval(() => {
      const cds = m.querySelectorAll("[data-cd]");
      if (!cds.length || !document.body.contains(m)) { clearInterval(shopTimer); shopTimer = null; return; }
      let expired = false;
      cds.forEach((sp) => {
        const rem = CF.ads.cooldownRemaining(sp.getAttribute("data-cd"));
        if (rem <= 0) expired = true; else sp.textContent = "⏳ " + CF.ads.fmtRemaining(rem);
      });
      if (expired) renderShop(m);
    }, 1000);
  }

  /* ---- AYARLAR --------------------------------------------------------- */
  function showSettings() {
    const m = openModal("settings");
    const s = CF.save.get().settings;
    const tog = (id, on, label) => `
      <label class="toggle-row">
        <span>${label}</span>
        <input type="checkbox" id="${id}" ${on ? "checked" : ""}/>
        <span class="switch"></span>
      </label>`;
    m.innerHTML = `
      <div class="modal-card">
        <div class="modal-head"><h2>Settings</h2><button class="icon-btn" data-close>✕</button></div>
        ${tog("set-sound", s.sound, "🔊 Sound effects")}
        ${tog("set-music", s.music, "🎵 Music")}
        ${tog("set-haptic", s.haptics, "📳 Vibration")}
        ${tog("set-colorblind", s.colorBlind, "🎨 Color-blind mode (symbols)")}
        ${tog("set-onetap", s.oneTap, "👆 One-tap (auto-pour)")}
        <div class="mode-row">
          <span>🎚️ Mode</span>
          <div class="seg">
            <button data-mode="relax" class="${s.mode==='relax'?'on':''}">Relax</button>
            <button data-mode="challenge" class="${s.mode==='challenge'?'on':''}">Challenge</button>
          </div>
        </div>
        <button class="btn danger" id="set-reset">Reset Progress</button>
        <p class="note">Relax: no move limit. Challenge: efficiency stars.</p>
      </div>`;
    m.querySelector("[data-close]").addEventListener("click", closeModal);
    el("set-sound").addEventListener("change", (e) => { s.sound = e.target.checked; CF.audio.setSound(s.sound); CF.save.persist(); });
    el("set-music").addEventListener("change", (e) => { s.music = e.target.checked; CF.audio.setMusic(s.music); CF.save.persist(); });
    el("set-haptic").addEventListener("change", (e) => { s.haptics = e.target.checked; CF.save.persist(); });
    el("set-colorblind").addEventListener("change", (e) => {
      s.colorBlind = e.target.checked; CF.save.persist();
      CF.util.bus.emit("settings:colorBlind", s.colorBlind);
    });
    el("set-onetap").addEventListener("change", (e) => { s.oneTap = e.target.checked; CF.save.persist(); });
    m.querySelectorAll("[data-mode]").forEach((b) => b.addEventListener("click", () => {
      s.mode = b.dataset.mode; CF.save.persist(); showSettings();
    }));
    el("set-reset").addEventListener("click", () => {
      if (confirm("Delete all progress?")) { CF.save.reset(); closeModal(); refreshCoins(); showMap(); toast("Reset done"); }
    });
  }

  /* ---- GÜNLÜK ÖDÜL ----------------------------------------------------- */
  function showDaily() {
    const m = openModal("daily");
    const canClaim = CF.daily.canClaim();
    const todayDay = CF.daily.currentStreakDay();
    const days = [];
    for (let d = 1; d <= 7; d++) {
      const claimed = d < todayDay || (!canClaim && d === todayDay);
      const isToday = d === todayDay && canClaim;
      days.push(`<div class="day-cell ${claimed?'claimed':''} ${isToday?'today':''}">
        <div class="day-num">Day ${d}</div>
        <div class="day-rew">${CF.daily.rewardForDay(d)}🪙${d===7?' + 🔀':''}</div>
        ${claimed?'<div class="day-check">✔</div>':''}
      </div>`);
    }
    m.innerHTML = `
      <div class="modal-card">
        <div class="modal-head"><h2>Daily Reward</h2><button class="icon-btn" data-close>✕</button></div>
        <div class="days-grid">${days.join("")}</div>
        ${canClaim ? `
          <button class="btn primary" id="daily-claim">Claim (${CF.daily.rewardForDay(todayDay)} 🪙)</button>
          <button class="btn reward-ad" id="daily-2x">📺 Watch ad → 2x</button>`
          : `<p class="note">Today's reward claimed. Come back tomorrow! Streak: ${CF.save.get().daily.streak} days</p>`}
      </div>`;
    m.querySelector("[data-close]").addEventListener("click", closeModal);
    if (canClaim) {
      el("daily-claim").addEventListener("click", () => {
        const r = CF.daily.claim(false); if (r) { toast(`+${r.coins}🪙${r.booster?' + booster':''}`); closeModal(); refreshCoins(); }
      });
      el("daily-2x").addEventListener("click", (e) => {
        e.currentTarget.disabled = true;
        CF.ads.rewarded("daily_double", () => {
          const r = CF.daily.claim(true); if (r) { toast(`+${r.coins}🪙 (2x)`); closeModal(); refreshCoins(); }
        });
      });
    }
  }

  /* ---- BAŞARIMLAR ------------------------------------------------------ */
  function showAchievements() {
    const m = openModal("ach");
    const list = CF.achievements.all().map((a) => `
      <div class="ach-row ${a.done?'done':''}">
        <span class="ach-icon">${a.icon}</span>
        <div class="ach-txt"><b>${a.name}</b><span>${a.desc}</span></div>
        <span class="ach-state">${a.done?'✔':'🔒'}</span>
      </div>`).join("");
    m.innerHTML = `
      <div class="modal-card scroll">
        <div class="modal-head"><h2>Achievements</h2><button class="icon-btn" data-close>✕</button></div>
        ${list}
      </div>`;
    m.querySelector("[data-close]").addEventListener("click", closeModal);
  }

  /* ---- KOLEKSİYON ------------------------------------------------------ */
  function showCollection() {
    const m = openModal("collection");
    const cols = cfg().COLLECTIONS;
    const totalU = CF.collection.unlocked(), total = CF.collection.total();
    const sections = cols.map((col, ci) => {
      const u = CF.collection.unlockedInCollection(ci);
      const done = u === col.items.length;
      const grid = col.items.map((emo, ii) =>
        `<div class="col-item ${ii < u ? "on" : ""}">${ii < u ? emo : "❓"}</div>`).join("");
      return `<div class="col-card ${done ? "done" : ""}">
        <div class="col-head"><span>${col.emoji} ${col.name}</span>
          <span class="col-count">${u}/${col.items.length}${done ? " ✓" : ""}</span></div>
        <div class="col-grid">${grid}</div>
      </div>`;
    }).join("");
    m.innerHTML = `
      <div class="modal-card scroll">
        <div class="modal-head"><h2>🖼️ Collection</h2><button class="icon-btn" data-close>✕</button></div>
        <p class="note">Unlock a new piece every level you complete. Total <b>${totalU}/${total}</b>.
          <b>+${cfg().COLLECTION_COMPLETE_BONUS}🪙</b> when a collection is full.</p>
        ${sections}
      </div>`;
    m.querySelector("[data-close]").addEventListener("click", closeModal);
  }

  /* ---- TÜP TEMALARI (skinler) ----------------------------------------- */
  function showSkins() {
    const m = openModal("skins");
    renderSkins(m);
  }
  function renderSkins(m) {
    const eq = CF.skins.equipped();
    const cards = cfg().SKINS.map((sk) => {
      const owned = CF.skins.owned(sk.id);
      const isEq = sk.id === eq;
      const preview = `<div class="skin-prev" data-skin="${sk.id}"><div class="tube"><div class="glass">
        <div class="layer" style="height:25%;background:linear-gradient(180deg,#ff8a80,#ff5252)"></div>
        <div class="layer" style="height:25%;background:linear-gradient(180deg,#40c4ff,#0091ea)"></div>
        <div class="layer" style="height:25%;background:linear-gradient(180deg,#ffd740,#ffab00)"></div>
        <div class="layer top" style="height:25%;background:linear-gradient(180deg,#69f0ae,#00c853)"></div>
      </div></div></div>`;
      const action = isEq
        ? `<button class="buy-coin done" disabled>✔ Selected</button>`
        : owned
          ? `<button class="shop-ad" data-equip="${sk.id}">Use</button>`
          : `<button class="buy-coin" data-buyskin="${sk.id}">🪙 ${sk.cost}</button>`;
      return `<div class="skin-card ${isEq ? "sel" : ""}">${preview}
        <div class="skin-name">${sk.name}</div>${action}</div>`;
    }).join("");
    m.innerHTML = `
      <div class="modal-card scroll">
        <div class="modal-head"><h2>🎨 Tube Themes</h2><button class="icon-btn" data-close>✕</button></div>
        <p class="note">Cosmetic — doesn't affect gameplay. Buy with coins, pick any you own.</p>
        <div class="skin-grid">${cards}</div>
      </div>`;
    m.querySelector("[data-close]").addEventListener("click", closeModal);
    m.querySelectorAll("[data-buyskin]").forEach((b) => b.addEventListener("click", () => {
      const id = b.dataset.buyskin;
      if (CF.skins.buy(id)) { CF.skins.equip(id); toast("Theme bought & selected 🎨"); renderSkins(m); }
      else toast("Not enough coins");
    }));
    m.querySelectorAll("[data-equip]").forEach((b) => b.addEventListener("click", () => {
      CF.skins.equip(b.dataset.equip); toast("Theme selected"); renderSkins(m);
    }));
  }

  /* ---- Yardımcı UI ----------------------------------------------------- */
  function setTopbar(show) { topbar.style.display = show ? "flex" : "none"; }

  let currentTheme = 0;
  let hasGenBg = false;   // assets/generated/bg-*.png üretildiyse true olur
  function setBg(themeIdx) {
    currentTheme = themeIdx % cfg().BG_THEMES.length;
    const t = cfg().BG_THEMES[currentTheme];
    const grad = `radial-gradient(circle at 50% 0%, ${t[1]}, ${t[0]} 70%)`;
    if (hasGenBg) {
      document.body.style.background =
        `url("assets/generated/bg-${currentTheme}.png") center center / cover no-repeat fixed, ${grad}`;
    } else {
      document.body.style.background = grad;
    }
  }
  // Üretilmiş arka plan var mı diye tek sefer yokla (yoksa CSS gradyan kalır).
  function probeGeneratedAssets() {
    const img = new Image();
    img.onload = () => { hasGenBg = true; document.body.classList.add("has-genbg"); setBg(currentTheme); };
    img.src = "assets/generated/bg-0.png";
  }

  function openModal(name, noBackdropClose) {
    modalRoot.innerHTML = "";
    modalRoot.style.display = "flex";
    modalRoot.dataset.name = name;
    const inner = mk("div", "modal-inner");
    modalRoot.appendChild(inner);
    if (!noBackdropClose) {
      modalRoot.onclick = (e) => { if (e.target === modalRoot) closeModal(); };
    } else { modalRoot.onclick = null; }
    return inner;
  }
  function closeModal() {
    if (shopTimer) { clearInterval(shopTimer); shopTimer = null; }
    modalRoot.style.display = "none"; modalRoot.innerHTML = ""; CF.audio.click();
  }

  let loadingEl = null;
  function showLoading(txt) {
    loadingEl = mk("div", "loading-overlay", `<div class="spinner"></div><div>${txt||"Loading…"}</div>`);
    document.body.appendChild(loadingEl);
  }
  function hideLoading() { if (loadingEl) { loadingEl.remove(); loadingEl = null; } }

  let toastTimer = null;
  function toast(msg) {
    let t = el("toast");
    if (!t) { t = mk("div", "toast"); t.id = "toast"; document.body.appendChild(t); }
    t.textContent = msg; t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 1800);
  }

  return { init, showMap, toast };
})();
