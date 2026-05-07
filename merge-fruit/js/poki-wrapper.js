/**
 * Poki SDK Integration – Merge Fruit
 * Bu dosya game.js'e dokunmadan Poki SDK'sini entegre eder.
 */
(function () {
    'use strict';

    var pokiReady = false;

    // ── SDK INIT ──────────────────────────────────────────────────
    PokiSDK.init().then(function () {
        pokiReady = true;
        console.log('[Poki] SDK hazir');
    }).catch(function () {
        pokiReady = false;
        console.log('[Poki] SDK baslatılamadı, devam ediliyor');
    });

    // ── OYUN YUKLEMESI ────────────────────────────────────────────
    PokiSDK.gameLoadingStart();

    window.addEventListener('load', function () {
        setTimeout(function () {
            PokiSDK.gameLoadingFinished();
        }, 800);
    });

    // ── adBreak → Poki rewarded/interstitial ─────────────────────
    // game.js'deki mevcut adBreak çağrılarını Poki SDK'ya yönlendir
    window.adBreak = function (config) {
        if (!pokiReady) {
            // SDK hazır değilse boost'u direkt ver (geliştirme ortamı)
            if (config.type === 'reward') {
                if (config.beforeReward) config.beforeReward(function () {});
                setTimeout(function () {
                    if (config.adViewed) config.adViewed();
                    if (config.afterAd)  config.afterAd();
                }, 1500);
            }
            return;
        }

        if (config.type === 'reward') {
            // Ödüllü reklam
            PokiSDK.rewardedBreak().then(function (rewardGranted) {
                if (rewardGranted) {
                    if (config.adViewed)   config.adViewed();
                } else {
                    if (config.adDismissed) config.adDismissed();
                }
                if (config.afterAd) config.afterAd();
            });
        } else {
            // Interstisyel reklam
            PokiSDK.commercialBreak().then(function () {
                if (config.afterAd) config.afterAd();
            });
        }
    };

    // ── GAMEPLAY TAKIBI ───────────────────────────────────────────
    document.addEventListener('DOMContentLoaded', function () {

        // Oyna butonuna basıldığında → gameplayStart
        var playBtn = document.getElementById('play-btn');
        if (playBtn) {
            playBtn.addEventListener('click', function () {
                if (pokiReady) PokiSDK.gameplayStart();
            });
        }

        // Game Over modal açıldığında → gameplayStop + commercialBreak
        var modal = document.getElementById('game-over-modal');
        if (modal) {
            var observer = new MutationObserver(function (mutations) {
                mutations.forEach(function (m) {
                    if (m.attributeName === 'class' && !modal.classList.contains('hidden')) {
                        if (pokiReady) {
                            PokiSDK.gameplayStop();
                            // Game over sonrası reklam göster
                            PokiSDK.commercialBreak();
                        }
                    }
                });
            });
            observer.observe(modal, { attributes: true });
        }

        // Yeniden başlat → gameplayStart (reklam bittikten sonra)
        var restartBtn = document.getElementById('restart-btn');
        if (restartBtn) {
            restartBtn.addEventListener('click', function () {
                if (pokiReady) {
                    PokiSDK.commercialBreak().then(function () {
                        PokiSDK.gameplayStart();
                    });
                }
            });
        }

        // Mağaza açıldığında → gameplayStop
        var storeBtn = document.getElementById('store-btn');
        if (storeBtn) {
            storeBtn.addEventListener('click', function () {
                if (pokiReady) PokiSDK.gameplayStop();
            });
        }

        // Mağazadan çıkınca → gameplayStart
        var storeReturnBtn = document.getElementById('store-return-btn');
        if (storeReturnBtn) {
            storeReturnBtn.addEventListener('click', function () {
                if (pokiReady) PokiSDK.gameplayStart();
            });
        }
    });

})();
