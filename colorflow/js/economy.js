/* =========================================================================
 * economy.js  —  Coin ekonomisi, booster, günlük seri, başarımlar, analytics
 *   (Spec: EconomyManager, BoosterManager, DailyStreakManager,
 *    AchievementManager, AnalyticsManager)
 * ========================================================================= */
window.CF = window.CF || {};

/* ---- Analytics (simülasyon: konsola + tampona yazar) -------------------- */
CF.analytics = (function () {
  const buffer = [];
  function track(evt, params) {
    const row = { t: Date.now(), evt, ...(params || {}) };
    buffer.push(row);
    if (buffer.length > 500) buffer.shift();
    // Gerçek entegrasyonda: Firebase / GameAnalytics gönderimi burada olur.
    console.debug("[analytics]", evt, params || "");
  }
  return { track, buffer };
})();

/* ---- Ekonomi ------------------------------------------------------------ */
CF.economy = (function () {
  "use strict";
  const S = () => CF.save.get();

  function coins() { return S().coins; }
  function addCoins(n, reason) {
    S().coins = Math.max(0, S().coins + n);
    CF.save.persist();
    if (n > 0) CF.audio.coin();
    CF.util.bus.emit("coins:changed", S().coins);
    CF.analytics.track("coins_change", { delta: n, reason: reason || "", total: S().coins });
    return S().coins;
  }
  function spend(n, reason) {
    if (S().coins < n) return false;
    addCoins(-n, reason);
    return true;
  }

  // Seviye tamamlama ödülü (yıldıza göre).
  function rewardForLevel(stars) {
    const e = CF.config.ECONOMY;
    return e.baseLevelReward + stars * e.rewardPerStar;
  }

  return { coins, addCoins, spend, rewardForLevel };
})();

/* ---- Booster yönetimi --------------------------------------------------- */
CF.boosters = (function () {
  "use strict";
  const S = () => CF.save.get();
  function count(id) { return S().boosters[id] || 0; }
  function add(id, n) {
    S().boosters[id] = Math.max(0, (S().boosters[id] || 0) + n);
    CF.save.persist();
    CF.util.bus.emit("boosters:changed", S().boosters);
  }
  // Booster kullan: önce envanterden, yoksa coin ile satın al.
  function use(id) {
    if (count(id) > 0) { add(id, -1); return "inventory"; }
    const cost = CF.config.BOOSTERS[id].cost;
    if (CF.economy.spend(cost, "booster:" + id)) return "coins";
    return null; // yetersiz
  }
  // Coin ile booster satın al (mağaza).
  function buy(id, qty) {
    qty = qty || 1;
    const cost = CF.config.BOOSTERS[id].cost * qty;
    if (CF.economy.spend(cost, "buy_booster:" + id)) { add(id, qty); return true; }
    return false;
  }
  return { count, add, use, buy };
})();

/* ---- Günlük seri (streak) ---------------------------------------------- */
CF.daily = (function () {
  "use strict";
  const S = () => CF.save.get();

  // Bugün ödül alınabilir mi?
  function canClaim() {
    const d = S().daily;
    return d.lastClaim !== CF.util.todayStr();
  }
  function currentStreakDay() {
    const d = S().daily;
    if (!d.lastClaim) return 1;
    const diff = CF.util.daysBetween(d.lastClaim, CF.util.todayStr());
    if (diff === 0) return d.streak;          // bugün alınmış
    if (diff === 1) return Math.min(d.streak + 1, 7); // ardışık
    return 1;                                 // seri kırıldı
  }
  function rewardForDay(day) {
    const e = CF.config.ECONOMY;
    return Math.min(e.dailyBonusMax, e.dailyBonusBase + (day - 1) * e.dailyBonusStep);
  }
  // Ödülü al; { day, coins, booster } döndürür.
  function claim(doubled) {
    if (!canClaim()) return null;
    const d = S().daily;
    const diff = d.lastClaim ? CF.util.daysBetween(d.lastClaim, CF.util.todayStr()) : 1;
    let streak = (diff === 1) ? Math.min(d.streak + 1, 7) : 1;
    const rewardCoins = rewardForDay(streak) * (doubled ? 2 : 1);
    d.lastClaim = CF.util.todayStr();
    d.streak = streak;
    CF.economy.addCoins(rewardCoins, "daily_streak");
    let booster = null;
    if (streak >= 7) { booster = "shuffle"; CF.boosters.add(booster, 1); } // gün 7: booster
    CF.save.persist();
    CF.analytics.track("daily_streak_claim", { day_number: streak, reward_type: doubled ? "2x" : "1x" });
    CF.achievements.check();
    return { day: streak, coins: rewardCoins, booster };
  }
  return { canClaim, currentStreakDay, rewardForDay, claim };
})();

/* ---- Başarımlar --------------------------------------------------------- */
CF.achievements = (function () {
  "use strict";
  const LIST = [
    { id: "first_sort", name: "First Sort", desc: "Complete the first level", icon: "🥇",
      test: (s) => s.stats.levelsCompleted >= 1 },
    { id: "lvl10", name: "Warming Up", desc: "Complete 10 levels", icon: "🔥",
      test: (s) => s.stats.levelsCompleted >= 10 },
    { id: "lvl50", name: "Apprentice", desc: "Complete 50 levels", icon: "⭐",
      test: (s) => s.stats.levelsCompleted >= 50 },
    { id: "lvl100", name: "Century Club", desc: "Complete 100 levels", icon: "💯",
      test: (s) => s.stats.levelsCompleted >= 100 },
    { id: "lvl150", name: "Campaign King", desc: "Finish all 150 levels", icon: "👑",
      test: (s) => s.maxLevelUnlocked > CF.config.TOTAL_LEVELS },
    { id: "perfect5", name: "Flawless x5", desc: "Finish 5 levels with 3 stars", icon: "🌟",
      test: (s) => s.stats.perfectLevels >= 5 },
    { id: "streak7", name: "Loyal Player", desc: "Reach a 7-day streak", icon: "📅",
      test: (s) => s.daily.streak >= 7 },
    { id: "rich", name: "Rich", desc: "Save up 1000 coins", icon: "💰",
      test: (s) => s.coins >= 1000 },
    { id: "no_undo", name: "No Undo", desc: "Finish a level without undo", icon: "🧠",
      test: (s) => s.stats._noUndoDone === true },
    { id: "daily_hunter", name: "Daily Hunter", desc: "Finish 3 daily bonus levels", icon: "🎯",
      test: (s) => (s.daily.bonusLevelsDone || 0) >= 3 },
    { id: "collector", name: "Collector", desc: "Complete your first collection", icon: "🖼️",
      test: (s) => ((s.collection && s.collection.itemsUnlocked) || 0) >=
        (CF.config.COLLECTIONS[0] ? CF.config.COLLECTIONS[0].items.length : 9) },
    { id: "puzzle_master", name: "Daily Master", desc: "Solve a Daily Puzzle", icon: "🗓️",
      test: (s) => !!s.daily.puzzleDate },
  ];

  function check() {
    const s = CF.save.get();
    let unlocked = [];
    LIST.forEach((a) => {
      if (!s.achievements[a.id] && a.test(s)) {
        s.achievements[a.id] = true; unlocked.push(a);
      }
    });
    if (unlocked.length) {
      CF.save.persist();
      unlocked.forEach((a) => {
        CF.analytics.track("achievement_unlocked", { id: a.id });
        CF.util.bus.emit("achievement:unlocked", a);
      });
    }
    return unlocked;
  }
  function all() { return LIST.map((a) => ({ ...a, done: !!CF.save.get().achievements[a.id] })); }
  return { check, all, LIST };
})();

/* ---- Monetizasyon: AdMob köprüsü (web'de simülasyon) -------------------- */
CF.ads = (function () {
  "use strict";
  const IDS = () => CF.config.ADMOB;

  // Görsel sunucu (ui kaydeder): reklamı gösterir, bitince onReward çağrılır.
  let presenter = null;
  function setPresenter(fn) { presenter = fn; }

  /* Ödüllü reklam göster. kind: "rewarded" | "rewardedInterstitial".
   * Gerçekte Google Mobile Ads SDK çağrısı; web'de presenter (ui overlay). */
  function show(kind, placement, onReward, opts) {
    const adUnitId = IDS()[kind] || IDS().rewarded;
    CF.analytics.track("ad_shown", { ad_type: kind, placement, ad_unit_id: adUnitId });
    if (presenter) presenter({ kind, placement, adUnitId, opts: opts || {}, onReward: (ok) => onReward && onReward(ok !== false) });
    else setTimeout(() => onReward && onReward(true), 300);
  }
  function rewarded(placement, onReward) { show("rewarded", placement, () => onReward && onReward()); }

  /* Ödüllü geçiş reklamı sırası geldi mi? (her 3 tamamlanan seviyede) */
  function dueRewardedInterstitial() {
    const s = CF.save.get();
    if (s.stats.adsRemoved) return false;
    const n = s.stats.levelsCompleted;
    return n > 0 && (n % CF.config.REWARDED_INTERSTITIAL_EVERY === 0);
  }

  /* ---- Reklamla alımda 1 saatlik bekleme sayacı ---- */
  function cooldownRemaining(itemId) {
    const at = CF.save.get().adCooldowns[itemId] || 0;
    return Math.max(0, at - Date.now());
  }
  function adReady(itemId) { return cooldownRemaining(itemId) <= 0; }
  function armCooldown(itemId) {
    CF.save.get().adCooldowns[itemId] = Date.now() + CF.config.AD_COOLDOWN_MS;
    CF.save.persist();
  }
  function fmtRemaining(ms) {
    const s = Math.ceil(ms / 1000);
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
    const p = (n) => String(n).padStart(2, "0");
    return h > 0 ? `${h}:${p(m)}:${p(ss)}` : `${p(m)}:${p(ss)}`;
  }

  function bannerId() { return IDS().banner; }

  // Banner göster/gizle — web'de no-op; native (native.js) gerçek AdMob ile override eder.
  function showBanner() {}
  function hideBanner() {}
  function isNativeAds() { return false; } // native.js true döndürecek şekilde override eder

  return { setPresenter, show, rewarded, dueRewardedInterstitial,
           cooldownRemaining, adReady, armCooldown, fmtRemaining, bannerId,
           showBanner, hideBanner, isNativeAds };
})();

/* ---- Koleksiyon meta'sı ------------------------------------------------- */
CF.collection = (function () {
  "use strict";
  const S = () => CF.save.get();
  const cols = () => CF.config.COLLECTIONS;

  function total() { return cols().reduce((a, c) => a + c.items.length, 0); }
  function unlocked() { return (S().collection && S().collection.itemsUnlocked) || 0; }

  // Global öğe indeksinden emoji.
  function emojiAt(gi) {
    let acc = 0;
    for (const c of cols()) { if (gi < acc + c.items.length) return c.items[gi - acc]; acc += c.items.length; }
    return null;
  }
  // Koleksiyon cIndex'te kaç öğe açık.
  function unlockedInCollection(cIndex) {
    let start = 0;
    for (let k = 0; k < cIndex; k++) start += cols()[k].items.length;
    return CF.util.clamp(unlocked() - start, 0, cols()[cIndex].items.length);
  }

  // n parça ödüllendir; koleksiyon tamamlandıysa coin bonusu.
  function award(n) {
    n = n || 1;
    const cap = total();
    const before = unlocked();
    if (before >= cap) return { gained: 0, newEmoji: null };
    S().collection.itemsUnlocked = Math.min(cap, before + n);
    const after = S().collection.itemsUnlocked;

    let completedName = null, acc = 0;
    for (const c of cols()) {
      acc += c.items.length;
      if (before < acc && after >= acc) {
        completedName = c.name;
        CF.economy.addCoins(CF.config.COLLECTION_COMPLETE_BONUS, "collection_complete:" + c.id);
      }
    }
    CF.save.persist();
    CF.util.bus.emit("collection:changed", after);
    if (completedName) CF.util.bus.emit("collection:completed", { name: completedName });
    return { gained: after - before, newEmoji: emojiAt(after - 1), completedName };
  }

  return { total, unlocked, emojiAt, unlockedInCollection, award };
})();

/* ---- Kozmetik tüp temaları (skinler) ----------------------------------- */
CF.skins = (function () {
  "use strict";
  const S = () => CF.save.get();
  function equipped() { return (S().skins && S().skins.equipped) || "classic"; }
  function owned(id) { return id === "classic" || ((S().skins.owned || []).indexOf(id) >= 0); }
  function buy(id) {
    const sk = CF.config.SKINS.find((x) => x.id === id);
    if (!sk) return false;
    if (owned(id)) return true;
    if (CF.economy.spend(sk.cost, "skin:" + id)) {
      S().skins.owned.push(id); CF.save.persist();
      CF.analytics.track("skin_buy", { skin: id });
      CF.util.bus.emit("skins:changed", id);
      return true;
    }
    return false;
  }
  function equip(id) {
    if (!owned(id)) return false;
    S().skins.equipped = id; CF.save.persist();
    CF.util.bus.emit("skins:changed", id);
    return true;
  }
  return { equipped, owned, buy, equip };
})();

/* ---- Gerçek para satın alma (Google Play Billing köprüsü) ---------------
 * Native (Capacitor) build gerçek Play Billing sağlarsa setNativePurchase ile
 * bağlanır. Web'de setPresenter ile ui simülasyon overlay'i gösterilir. */
CF.iap = (function () {
  "use strict";
  let nativePurchase = null;  // (playProductId) => Promise<boolean>
  let presenter = null;       // (product, cb) => void   (web simülasyonu)
  function setNativePurchase(fn) { nativePurchase = fn; }
  function setPresenter(fn) { presenter = fn; }

  function grant(key) {
    if (key === "removeAds") {
      CF.save.get().stats.adsRemoved = true; CF.save.persist();
      CF.util.bus.emit("iap:changed", key);
    }
  }
  function owned(key) {
    if (key === "removeAds") return !!CF.save.get().stats.adsRemoved;
    return false;
  }

  // Satın al: native varsa Play Billing, yoksa web simülasyonu.
  function purchase(key, onDone) {
    const p = CF.config.IAP[key];
    if (!p) { onDone && onDone(false); return; }
    CF.analytics.track("iap_initiate", { product_id: p.id, price: p.price });
    const done = (ok) => {
      if (ok) { grant(key); CF.analytics.track("iap_purchase", { product_id: p.id, price: p.price }); }
      onDone && onDone(!!ok);
    };
    if (nativePurchase) { nativePurchase(p.id).then(done).catch(() => done(false)); }
    else if (presenter) { presenter(p, done); }
    else { done(true); }
  }

  // Play'den daha önce alınmış satın almaları geri yükle (native).
  let nativeRestore = null;
  function setNativeRestore(fn) { nativeRestore = fn; }
  function restore(onDone) {
    if (nativeRestore) nativeRestore().then((ids) => {
      if (Array.isArray(ids) && ids.includes(CF.config.IAP.removeAds.id)) grant("removeAds");
      onDone && onDone(true);
    }).catch(() => onDone && onDone(false));
    else onDone && onDone(false);
  }

  return { setNativePurchase, setNativeRestore, setPresenter, purchase, owned, restore };
})();
