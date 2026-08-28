/* =========================================================================
 * config.js  —  Renk paletleri, zorluk eğrisi, ekonomi & booster sabitleri
 * (Spec'teki ScriptableObject / DifficultyCurve karşılığı)
 * ========================================================================= */
window.CF = window.CF || {};

CF.config = (function () {
  "use strict";

  /* Gradyan dostu, jenerik olmayan güzel renk paleti (spec: "beautiful
   * gradient color palette, not generic primary colors"). Her renk için
   * alt/üst gradyan tonu tanımlı — cam sıvı görünümü için. */
  // symbol: renk körlüğü modunda katmanlarda gösterilen ayırt edici şekil.
  // (Kampanyada en fazla 7 renk kullanılır => ilk 7 sembol en belirgin seçildi.)
  const COLORS = [
    { id: 0, name: "Coral",     top: "#ff8a80", bot: "#ff5252", symbol: "●" },
    { id: 1, name: "Ocean",     top: "#40c4ff", bot: "#0091ea", symbol: "▲" },
    { id: 2, name: "Leaf",      top: "#69f0ae", bot: "#00c853", symbol: "■" },
    { id: 3, name: "Amber",     top: "#ffd740", bot: "#ffab00", symbol: "★" },
    { id: 4, name: "Violet",    top: "#b388ff", bot: "#7c4dff", symbol: "♥" },
    { id: 5, name: "Peach",     top: "#ffab91", bot: "#ff6e40", symbol: "♦" },
    { id: 6, name: "Turquoise", top: "#64ffda", bot: "#1de9b6", symbol: "♣" },
    { id: 7, name: "Rose",      top: "#ff80ab", bot: "#f50057", symbol: "♠" },
    { id: 8, name: "Indigo",    top: "#8c9eff", bot: "#3d5afe", symbol: "✚" },
    { id: 9, name: "Lemon",     top: "#eeff41", bot: "#c6ff00", symbol: "▼" },
    { id: 10, name: "Sky",      top: "#84ffff", bot: "#00b8d4", symbol: "✿" },
    { id: 11, name: "Plum",     top: "#ea80fc", bot: "#d500f9", symbol: "◐" },
  ];

  /* Seviye başına arkaplan gradyanı — bölgeye göre ton kayması. */
  const BG_THEMES = [
    ["#1a1440", "#2d1b52"],
    ["#0f2027", "#203a43"],
    ["#232526", "#414345"],
    ["#3a1c71", "#4a1e6b"],
    ["#0b486b", "#0f5c7a"],
    ["#42275a", "#734b6d"],
  ];

  const CAPACITY = 4; // her tüpteki katman sayısı

  /* Zorluk eğrisi (spec'teki tablonun birebir karşılığı).
   * band(level) => { colors, emptyTubes } döndürür; tüp sayısı =
   * colors + emptyTubes. */
  function band(level) {
    if (level <= 20)  return { colors: rampi(level, 1, 20, 2, 3),  empties: 2 };
    if (level <= 50)  return { colors: rampi(level, 21, 50, 3, 4), empties: 2 };
    if (level <= 100) return { colors: rampi(level, 51, 100, 4, 5), empties: 2 };
    if (level <= 150) return { colors: rampi(level, 101, 150, 5, 6), empties: 2 };
    // 150+ uzman: jeneratör sonsuz üretir
    return { colors: CF.util.clamp(6 + Math.floor((level - 150) / 40), 6, 7), empties: 2 };
  }

  // Bir aralık boyunca [fromVal..toVal] arası kademeli artış (tam sayı).
  function rampi(level, lo, hi, fromVal, toVal) {
    const t = (level - lo) / Math.max(1, hi - lo);
    return Math.round(fromVal + (toVal - fromVal) * CF.util.clamp(t, 0, 1));
  }

  /* Özel mekanik kilitleri (spec: kademeli tanıtım). */
  const MECHANICS = {
    lockedTubeFrom: 30,   // kilitli tüp
    frozenLayerFrom: 50,  // donmuş katman
    colorMixerFrom: 70,   // renk karıştırıcı (opsiyonel, ileri seviye)
  };

  /* Ekonomi & ödül dengesi. */
  const ECONOMY = {
    startCoins: 300,
    rewardPerStar: 15,       // yıldız başına coin
    baseLevelReward: 20,     // seviye tamamlama tabanı
    dailyBonusBase: 50,      // günlük seri gün-1
    dailyBonusStep: 75,      // her gün artış (gün 7 ~ 500)
    dailyBonusMax: 500,
    // Gerçek-para ürünleri artık COIN ile alınıyor:
    removeAdsCost: 2500,     // "Reklamları Kaldır" coin bedeli
    starterPackCost: 1200,   // "Başlangıç Paketi" coin bedeli
    adCoinReward: 200,       // "Reklam izle → coin" ile kazanılan
  };

  /* AdMob reklam birimi ID'leri (kullanıcı tarafından verildi).
   * Not: gerçek reklam yalnızca native Android pakette (Cordova/Capacitor +
   * Google Mobile Ads) çalışır; web önizlemesinde simüle edilir ama ID'ler
   * native köprü tarafından aynen kullanılır. */
  const ADMOB = {
    banner:              "ca-app-pub-3066824413621209/2362624782",
    rewarded:            "ca-app-pub-3066824413621209/9889495086",
    rewardedInterstitial:"ca-app-pub-3066824413621209/1703883301",
  };
  const REWARDED_INTERSTITIAL_EVERY = 3;   // her 3 seviyede ödüllü geçiş
  const AD_COOLDOWN_MS = 60 * 60 * 1000;   // reklamla alımda 1 saat bekleme

  /* GERÇEK PARA ürünleri — Google Play Billing ile (native pakette).
   * `id` = Play Console'daki ürün kimliği. Web'de simüle edilir. */
  const IAP = {
    removeAds: { id: "remove_ads", name: "Remove Ads", price: "$2.99" },
  };

  /* Booster maliyetleri (spec ile birebir). */
  const BOOSTERS = {
    undo:    { id: "undo",    name: "Undo",     icon: "↩️", cost: 100 },
    addTube: { id: "addTube", name: "Add Tube", icon: "🧪", cost: 200 },
    shuffle: { id: "shuffle", name: "Shuffle",  icon: "🔀", cost: 300 },
    hint:    { id: "hint",    name: "Hint",     icon: "💡", cost: 150 },
  };

  /* Mağaza coin paketleri (spec fiyatlarıyla — burada simülasyon). */
  const COIN_PACKS = [
    { id: "c100",  coins: 100,  price: "$0.99" },
    { id: "c550",  coins: 550,  price: "$4.99", badge: "Best Value" },
    { id: "c1200", coins: 1200, price: "$9.99" },
    { id: "c2500", coins: 2500, price: "$19.99" },
    { id: "c6500", coins: 6500, price: "$49.99" },
  ];

  /* Koleksiyon meta'sı: her seviye tamamlamada 1 parça açılır; bir koleksiyon
   * dolunca coin bonusu. (Rakiplerin en zayıf halkası = uzun vadeli hedef.) */
  const COLLECTIONS = [
    { id: "aqua",  name: "Aquarium", emoji: "🐠", items: ["🐠","🐟","🐡","🦈","🐙","🦀","🦑","🐚","🐢"] },
    { id: "garden",name: "Garden",   emoji: "🌸", items: ["🌷","🌹","🌻","🌼","🌸","🌺","🌵","🍄","🦋"] },
    { id: "space", name: "Space",    emoji: "🚀", items: ["🪐","⭐","🌟","🚀","🛸","☄️","🌙","🔭","🌌"] },
    { id: "sweet", name: "Sweets",   emoji: "🍩", items: ["🍩","🍪","🧁","🍰","🍫","🍬","🍭","🍮","🍯"] },
    { id: "fruit", name: "Fruits",   emoji: "🍓", items: ["🍓","🍒","🍑","🍊","🍋","🍉","🍇","🥝","🍍"] },
    { id: "animal",name: "Animals",  emoji: "🦊", items: ["🦊","🐰","🐼","🐨","🦁","🐯","🐸","🐵","🦉"] },
    { id: "sky",   name: "Weather",  emoji: "🌈", items: ["🌈","☀️","🌤️","⛅","🌧️","⛈️","❄️","🌪️","🌩️"] },
    { id: "gem",   name: "Gems",     emoji: "💎", items: ["💎","💍","👑","🔮","⚜️","🏆","🥇","🎖️","🪙"] },
  ];
  const COLLECTION_COMPLETE_BONUS = 200; // koleksiyon tamamlama coin ödülü

  /* Kozmetik tüp temaları (coin ile alınır, seçilir). classic ücretsiz/başlangıç. */
  const SKINS = [
    { id: "classic", name: "Classic",  cost: 0 },
    { id: "neon",    name: "Neon",     cost: 500 },
    { id: "ice",     name: "Ice",      cost: 600 },
    { id: "wood",    name: "Wood",     cost: 800 },
    { id: "gold",    name: "Gold",     cost: 1200 },
    { id: "rainbow", name: "Rainbow",  cost: 2000 },
  ];

  const AD_EVERY_LEVELS = 4;   // spec: her 4 seviyede reklam (rakiplerde 2)
  const NO_ADS_FIRST_N = 10;   // ilk 10 seviye reklamsız

  const TOTAL_LEVELS = 150;    // kampanya; jeneratör 150+ sonsuz üretir
  const STARS_MODE_MOVE_SLACK = [1.0, 1.35, 1.8]; // 3/2/1 yıldız hamle eşikleri

  return {
    COLORS, BG_THEMES, CAPACITY, band, MECHANICS, ECONOMY, BOOSTERS,
    COIN_PACKS, AD_EVERY_LEVELS, NO_ADS_FIRST_N, TOTAL_LEVELS,
    STARS_MODE_MOVE_SLACK, ADMOB, REWARDED_INTERSTITIAL_EVERY, AD_COOLDOWN_MS,
    COLLECTIONS, COLLECTION_COMPLETE_BONUS, SKINS, IAP,
  };
})();
