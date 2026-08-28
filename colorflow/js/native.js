/* =========================================================================
 * native.js  —  Capacitor NATIVE ortamda gerçek AdMob köprüsü.
 *   Web'de (tarayıcı) hiçbir şey yapmaz: isNative=false → simülasyon kalır.
 *   Native'de CF.ads presenter'ını ve banner'ı gerçek AdMob'a bağlar.
 * ========================================================================= */
window.CF = window.CF || {};

CF.native = (function () {
  "use strict";
  const Cap = window.Capacitor;
  const isNative = !!(Cap && typeof Cap.isNativePlatform === "function" && Cap.isNativePlatform());

  /* ⚠️ Geliştirmede TEST reklamları (Google örnek birimleri) kullanılır — kendi
   * reklamlarına tıklamak hesabını RİSKE atar. YAYINDA: DEV_TEST_ADS = false. */
  const DEV_TEST_ADS = false;
  const TEST = {
    banner: "ca-app-pub-3940256099942544/6300978111",
    interstitial: "ca-app-pub-3940256099942544/1033173712",
    rewarded: "ca-app-pub-3940256099942544/5224354917",
  };

  function unit(kind) {
    const ids = CF.config.ADMOB;
    if (DEV_TEST_ADS) {
      return kind === "banner" ? TEST.banner
        : kind === "rewardedInterstitial" ? TEST.interstitial : TEST.rewarded;
    }
    return kind === "banner" ? ids.banner
      : kind === "rewardedInterstitial" ? ids.rewardedInterstitial : ids.rewarded;
  }

  function init() {
    if (!isNative) return; // web → simülasyon presenter'ları kalır
    const AdMob = Cap.Plugins && Cap.Plugins.AdMob;
    if (!AdMob) { console.warn("[native] AdMob eklentisi bulunamadı"); return; }

    CF.ads.isNativeAds = function () { return true; };

    AdMob.initialize({ initializeForTesting: DEV_TEST_ADS, testingDevices: [] })
      .catch(function (e) { console.warn("[native] AdMob init hatası", e); });

    /* Ödüllü video + ödüllü geçiş → gerçek reklam (game.js/ui.js aynı presenter'ı çağırır) */
    CF.ads.setPresenter(function (req) {
      (async function () {
        try {
          if (req.kind === "rewardedInterstitial") {
            await AdMob.prepareInterstitial({ adId: unit("rewardedInterstitial"), isTesting: DEV_TEST_ADS });
            await AdMob.showInterstitial();
            req.onReward(true);
          } else {
            await AdMob.prepareRewardVideoAd({ adId: unit("rewarded"), isTesting: DEV_TEST_ADS });
            const r = await AdMob.showRewardVideoAd();
            req.onReward(!!r);
          }
        } catch (e) {
          console.warn("[native] reklam gösterilemedi", e);
          req.onReward(false); // reklam açılmazsa oyun akışı devam eder
        }
      })();
    });

    /* Banner — haritada altta (ui showMap/startGame çağırır) */
    CF.ads.showBanner = async function () {
      try {
        await AdMob.showBanner({
          adId: unit("banner"), isTesting: DEV_TEST_ADS,
          adSize: "ADAPTIVE_BANNER", position: "BOTTOM_CENTER", margin: 0,
        });
      } catch (e) { console.warn("[native] banner hatası", e); }
    };
    CF.ads.hideBanner = async function () { try { await AdMob.hideBanner(); } catch (e) {} };

    console.log("[native] AdMob köprüsü aktif (test=" + DEV_TEST_ADS + ")");

    // Google Play Billing köprüsü (cordova-plugin-purchase)
    if (window.CdvPurchase) setupBilling();
    else document.addEventListener("deviceready", function () { if (window.CdvPurchase) setupBilling(); }, { once: true });
  }

  /* ---- Google Play Billing (gerçek "Reklamları Kaldır" ödemesi) -------- */
  function setupBilling() {
    const CdvPurchase = window.CdvPurchase;
    if (!CdvPurchase) { console.warn("[native] CdvPurchase yok"); return; }
    const store = CdvPurchase.store;
    const ProductType = CdvPurchase.ProductType;
    const Platform = CdvPurchase.Platform;
    const REMOVE_ADS = CF.config.IAP.removeAds.id; // "remove_ads"
    let pendingResolve = null;

    store.register([{ id: REMOVE_ADS, type: ProductType.NON_CONSUMABLE, platform: Platform.GOOGLE_PLAY }]);

    store.when()
      .approved(function (t) { return t.verify(); })
      .verified(function (r) { return r.finish(); })
      .finished(function (t) {
        const has = (t.products || []).some(function (p) { return p.id === REMOVE_ADS; });
        if (has) {
          // Sahipliği HER durumda uygula (açılışta otomatik geri yükleme dahil)
          const s = CF.save.get();
          if (!s.stats.adsRemoved) { s.stats.adsRemoved = true; CF.save.persist(); CF.util.bus.emit("iap:changed", "removeAds"); }
          if (pendingResolve) { pendingResolve(true); pendingResolve = null; }
        }
      });
    store.error(function () { if (pendingResolve) { pendingResolve(false); pendingResolve = null; } });

    store.initialize([Platform.GOOGLE_PLAY]).catch(function (e) { console.warn("[native] billing init", e); });

    // Satın al: Play satın alma akışını başlatır, sonuç .finished ile döner.
    CF.iap.setNativePurchase(function (productId) {
      return new Promise(function (resolve) {
        pendingResolve = resolve;
        const product = store.get(productId, Platform.GOOGLE_PLAY);
        const offer = product && product.getOffer();
        if (!offer) { resolve(false); pendingResolve = null; return; }
        offer.order().catch(function () { resolve(false); pendingResolve = null; });
        setTimeout(function () { if (pendingResolve === resolve) { resolve(false); pendingResolve = null; } }, 120000);
      });
    });

    // Geri yükle: önceki satın almaları getir (cihaz değişimi vb.).
    CF.iap.setNativeRestore(function () {
      return new Promise(function (resolve) {
        Promise.resolve(store.restorePurchases()).then(function () {
          const p = store.get(REMOVE_ADS, Platform.GOOGLE_PLAY);
          resolve(p && p.owned ? [REMOVE_ADS] : []);
        }).catch(function () { resolve([]); });
      });
    });

    console.log("[native] Google Play Billing köprüsü aktif");
  }

  return { isNative, init };
})();
