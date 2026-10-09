/* =====================================================================
 * platform.js - Playgama Bridge layer (the Playgama build)
 * The same API as the YouTube Playables layer, so the game code is unchanged.
 * Playgama hosts the game on its own site and passes it to partner platforms
 * (YouTube Playables among them); Bridge talks to whichever host the game runs on:
 *  - saves go through bridge.storage (cloud where the host has it), the language is
 *    the host's (bridge.platform.language);
 *  - ads go through bridge.advertisement: interstitials only at the game's natural
 *    breaks (Bridge also keeps its own minimum delay), rewarded ads only when the
 *    player asks; an ad pauses and mutes the game until it closes;
 *  - the host's pause and sound (PAUSE_STATE_CHANGED, AUDIO_STATE_CHANGED) reach
 *    the game like YouTube's did; a hidden tab pauses it too;
 *  - "game_ready" is sent when the game says it can be played;
 *  - the game's own sound switch (setAudio) is offered everywhere except on YouTube,
 *    where the host's sound button is the only one (a Playables rule).
 * Bridge is bundled in the build (playgama-bridge.js): no outside request at start.
 * ===================================================================== */
(function () {
    'use strict';

    var LOCAL_KEY = 'wolftowoof.save.v1';         // the game's own save key (set by the build)
    var SOUND_KEY = LOCAL_KEY + '.sound';
    var SAVE_DEBOUNCE_MS = 1500;
    var SAVE_MAX_WAIT_MS = 5000;
    var BRIDGE_WAIT_MS = 6000;               // the game never waits longer for Bridge to start
    var AD_STUCK_MS = 4000;                  // an ad that never opens counts as no ad
    var nativeSetTimeout = window.setTimeout.bind(window);
    var nativeClearTimeout = window.clearTimeout.bind(window);

    function warn(msg) { if (window.console) console.warn('[platform]', msg); }
    function logError(err) { if (window.console) console.error('[platform]', err); }
    function each(list, arg) { list.slice().forEach(function (cb) { try { cb(arg); } catch (e) { logError(e); } }); }
    function store(key, val) { try { window.localStorage.setItem(key, val); } catch (_) {} }
    function read(key) { try { return window.localStorage.getItem(key); } catch (_) { return null; } }

    /* ---- Bridge ---- */
    var B = null;                // window.bridge once initialized
    var onYouTube = false;
    var hostKnown = false;       // Bridge has started (or given up): onYouTube is decided
    var bridgeReady = (function () {
        var b = window.bridge;
        if (!b || typeof b.initialize !== 'function') return Promise.resolve(false);
        var init;
        try { init = Promise.resolve(b.initialize()); } catch (e) { warn('Bridge failed to start: ' + e); return Promise.resolve(false); }
        var ok = init.then(function () {
            B = b;
            onYouTube = B.platform && B.platform.id === 'youtube';
            hostAudio = B.platform.isAudioEnabled !== false;
            B.platform.on(B.EVENT_NAME.AUDIO_STATE_CHANGED, function (on) { hostAudio = !!on; audioChanged(); });
            B.platform.on(B.EVENT_NAME.PAUSE_STATE_CHANGED, function (p) { hostPaused = !!p; update(); });
            B.advertisement.on(B.EVENT_NAME.INTERSTITIAL_STATE_CHANGED, function (s) { adState('interstitial', s); });
            B.advertisement.on(B.EVENT_NAME.REWARDED_STATE_CHANGED, function (s) { adState('rewarded', s); });
            if (ready) B.platform.sendMessage('game_ready');
            audioChanged();
            return true;
        }, function (e) { warn('Bridge failed to start: ' + e); return false; });
        var timeout = new Promise(function (res) { window.setTimeout(function () { res('timeout'); }, BRIDGE_WAIT_MS); });
        return Promise.race([ok, timeout]).then(function (r) {
            if (r === 'timeout') { warn('Bridge did not start within ' + BRIDGE_WAIT_MS / 1000 + ' s: playing without it'); return false; }
            return r;
        });
    })();

    /* ---- pause: host pause, an ad on screen and, off YouTube, a hidden tab (on YouTube the host
       pauses the game itself and the page must not use the Page Visibility API) ---- */
    var hostPaused = false, adOpen = false, hidden = false, paused = false;
    var pauseCbs = [], resumeCbs = [], audioCbs = [];
    function update() {
        var want = hostPaused || adOpen || hidden;
        if (want && !paused) { paused = true; flush(); each(pauseCbs); }
        else if (!want && paused) { paused = false; each(resumeCbs); }
    }

    /* ---- sound: the host's switch and, off YouTube, the game's own (this browser's setting; never
       read on YouTube, where the page must not use its own storage) ---- */
    var hostAudio = true, lastAudio = null;
    function ownAudio() { return !hostKnown || onYouTube || read(SOUND_KEY) !== 'off'; }
    function audioOn() { return hostAudio && ownAudio(); }
    function audioChanged() {
        var on = audioOn();
        if (on !== lastAudio) { lastAudio = on; each(audioCbs, on); }
    }

    /* ---- saves (Bridge storage; this browser until Bridge is there) ---- */
    var loaded = false, queued = null, lastWritten = null, saveTimer = null, firstQueuedAt = 0;
    function write(str) {
        if (str === lastWritten) return;
        lastWritten = str;
        if (B) {
            try {
                Promise.resolve(B.storage.set([LOCAL_KEY], [str])).catch(function (e) { lastWritten = null; warn('storage.set failed: ' + e); });
                return;
            } catch (e) { warn('storage.set failed: ' + e); }
        }
        store(LOCAL_KEY, str);
    }
    function flush() {
        if (saveTimer) { nativeClearTimeout(saveTimer); saveTimer = null; }
        firstQueuedAt = 0;
        if (!loaded || queued === null) return;
        var s = queued; queued = null;
        write(s);
    }
    window.addEventListener('pagehide', flush);

    /* ---- ads ---- */
    var ad = null;               // the ad being shown: { type, opened, earned, failed, done }
    function adState(type, s) {
        if (!ad || ad.type !== type) return;
        if (s === 'opened') { ad.opened = true; adOpen = true; update(); }
        else if (s === 'rewarded') ad.earned = true;
        // "failed" can follow "opened" (YouTube reports no ad only after it was asked for one): that
        // is no ad, not an ad closed early
        else if (s === 'failed') { ad.failed = true; finishAd(); }
        else if (s === 'closed') finishAd();
    }
    function finishAd() {
        var a = ad; if (!a) return;
        ad = null;
        nativeClearTimeout(a.stuck);
        adOpen = false; update();
        a.done(a);
    }
    function showAd(type, placement) {
        return new Promise(function (resolve) {
            ad = { type: type, opened: false, earned: false, done: resolve };
            // an ad that never opens (no fill, a rule of the host) must not hold the game
            ad.stuck = nativeSetTimeout(function () { if (ad && !ad.opened) finishAd(); }, AD_STUCK_MS);
            try {
                if (type === 'rewarded') B.advertisement.showRewarded(placement);
                else B.advertisement.showInterstitial(placement);
            } catch (e) { warn(type + ' failed: ' + e); finishAd(); }
        });
    }

    var ready = false;
    window.Platform = {
        live: true,
        playgama: true,

        /* ---- lifecycle ---- */
        firstFrameReady: function () {},
        gameReady: function () {
            if (ready) return;
            ready = true;
            if (B) { try { B.platform.sendMessage('game_ready'); } catch (e) { warn('game_ready: ' + e); } }
        },
        isReady: function () { return ready; },

        /* ---- saves ---- */
        load: function () {
            return bridgeReady.then(function () {
                if (!B) return read(LOCAL_KEY);
                return Promise.resolve(B.storage.get([LOCAL_KEY])).then(function (r) {
                    return r && r[0] != null ? r[0] : null;
                }, function (e) { warn('storage.get failed: ' + e); return read(LOCAL_KEY); });
            }).then(function (raw) {
                loaded = true;
                if (raw && typeof raw !== 'string') { try { raw = JSON.stringify(raw); } catch (_) { raw = null; } }
                lastWritten = raw || null;
                queued = null;
                var data = null;
                if (raw) { try { data = JSON.parse(raw); } catch (_) { data = null; } }
                return data;
            });
        },
        /** Debounced save (at most SAVE_MAX_WAIT_MS late); call flush() at important moments. */
        save: function (state) {
            queued = JSON.stringify(state);
            if (!loaded) return;
            var now = Date.now();
            if (!firstQueuedAt) firstQueuedAt = now;
            if (saveTimer) nativeClearTimeout(saveTimer);
            saveTimer = nativeSetTimeout(flush, Math.max(0, Math.min(SAVE_DEBOUNCE_MS, firstQueuedAt + SAVE_MAX_WAIT_MS - now)));
        },
        flush: flush,

        /* ---- sound and pause ---- */
        isAudioEnabled: audioOn,
        onAudioChange: function (cb) { audioCbs.push(cb); },
        onPause: function (cb) { pauseCbs.push(cb); },
        onResume: function (cb) { resumeCbs.push(cb); },
        adPlaying: function () { return adOpen; },

        /** Resolves to a language tag such as "en" or "tr" (the host's, else the browser's). */
        getLanguage: function () {
            return bridgeReady.then(function () {
                var l = B && B.platform.language;
                return String(l || (navigator.languages && navigator.languages[0]) || navigator.language || 'en');
            });
        },

        sendScore: function () {},

        /* ---- ads ---- */
        adsAvailable: function () { return !!(B && (B.advertisement.isInterstitialSupported || B.advertisement.isRewardedSupported)); },
        /** Resolves to 'earned' | 'dismissed' | 'unavailable'. Never rejects. */
        rewardedAd: function (rewardId) {
            if (!B || !B.advertisement.isRewardedSupported || ad) return Promise.resolve('unavailable');
            return showAd('rewarded', rewardId).then(function (a) { return a.earned ? 'earned' : a.opened && !a.failed ? 'dismissed' : 'unavailable'; });
        },
        /** Resolves when the interstitial is done: true if it played, false if it could not be shown. */
        interstitialAd: function () {
            if (!B || !B.advertisement.isInterstitialSupported || ad) return Promise.resolve(false);
            return showAd('interstitial').then(function (a) { return a.opened && !a.failed; });
        },

        warn: warn,
        logError: logError
    };
    // the game's own sound switch: not on YouTube (the host's sound button is the only one there).
    // Decided once Bridge knows the host; until then the game sees no switch. Platform.hostReady
    // resolves after that decision (a game that builds its switch early waits for it).
    window.Platform.hostReady = bridgeReady.then(function () {
        hostKnown = true;
        if (onYouTube) return;
        document.addEventListener('visibilitychange', function () { hidden = document.hidden; update(); });
        window.Platform.setAudio = function (on) { store(SOUND_KEY, on ? 'on' : 'off'); audioChanged(); };
        audioChanged();
    });

    window.addEventListener('error', function (e) { logError(e && e.error ? e.error : (e && e.message)); });
    window.addEventListener('unhandledrejection', function (e) { logError(e && e.reason); });
})();
