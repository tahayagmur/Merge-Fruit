/* =========================================================================
 * save.js  —  JSON kaydetme sistemi (localStorage). İlerleme, coin,
 *   booster, ayarlar, günlük seri, başarımlar. (Spec: SaveSystem)
 * ========================================================================= */
window.CF = window.CF || {};

CF.save = (function () {
  "use strict";
  const KEY = "colorflow.save.v1";

  const DEFAULT = {
    version: 1,
    coins: CF.config.ECONOMY.startCoins,
    maxLevelUnlocked: 1,        // açılan en yüksek seviye
    stars: {},                  // { levelNo: 0..3 }
    boosters: { undo: 3, addTube: 1, shuffle: 1, hint: 3 },
    settings: { sound: true, music: true, haptics: true, mode: "relax", colorBlind: false, oneTap: false },
    daily: { lastClaim: null, streak: 0, bonusLevelsDate: null, bonusLevelsDone: 0, puzzleDate: null },
    collection: { itemsUnlocked: 0 }, // koleksiyon meta ilerlemesi
    skins: { equipped: "classic", owned: ["classic"] }, // kozmetik tüp temaları
    adCooldowns: {},            // { itemId: availableAtEpochMs } — reklamla alımda 1 saat bekleme
    achievements: {},           // { id: true }
    stats: { levelsCompleted: 0, totalMoves: 0, perfectLevels: 0, adsRemoved: false },
    firstRun: true,
  };

  let data = load();

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return structuredCloneSafe(DEFAULT);
      const parsed = JSON.parse(raw);
      return Object.assign(structuredCloneSafe(DEFAULT), parsed, {
        boosters: Object.assign({}, DEFAULT.boosters, parsed.boosters),
        settings: Object.assign({}, DEFAULT.settings, parsed.settings),
        daily: Object.assign({}, DEFAULT.daily, parsed.daily),
        collection: Object.assign({}, DEFAULT.collection, parsed.collection),
        skins: Object.assign({ equipped: "classic", owned: ["classic"] }, parsed.skins),
        adCooldowns: Object.assign({}, parsed.adCooldowns),
        stats: Object.assign({}, DEFAULT.stats, parsed.stats),
      });
    } catch (e) { return structuredCloneSafe(DEFAULT); }
  }

  function structuredCloneSafe(o) { return JSON.parse(JSON.stringify(o)); }

  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(data)); }
    catch (e) { console.warn("Kayıt başarısız", e); }
    CF.util.bus.emit("save:changed", data);
  }

  function get() { return data; }
  function set(patch) { Object.assign(data, patch); persist(); }
  function reset() { data = structuredCloneSafe(DEFAULT); persist(); }

  return { get, set, persist, reset, load };
})();
