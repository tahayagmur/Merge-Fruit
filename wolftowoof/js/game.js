/* Wolf to Woof - the game.
 * Camp at the bottom, forest at the top. Wolves come to the firelight; you win
 * their trust (toss treats into the glowing ring, then hold eye contact), pair
 * the friendliest, and every generation the pack looks more like dogs. */
(function () {
    'use strict';
    var W = window.WTW, P = window.Platform;
    var G = W.gen, A = W.art, FX = W.fx, SFX = W.sfx;
    var Q = W.quests, B = W.breeds, J = W.jobs;
    var MINI = {};                                         // the Play menu's games, by id
    (W.minis || []).forEach(function (m) { MINI[m.id] = m; });
    var MINI_ORDER = ['fetch', 'point', 'words', 'scent', 'eyes', 'howl'];
    var t = function (k, p) { return W.i18n.t(k, p); };
    var pct = function (n) { return W.i18n.pct(n); };       // "45%" / Turkish "%45"
    var clamp = G.clamp;

    /* ================================================================ tuning */
    var DEN = [8, 10, 12, 14, 16, 18];
    var HUTS = [2, 4, 6, 9, 12, 16];
    var POUCH = [5, 6, 7, 8];
    var FIRE_EVERY = [50, 42, 34, 27, 21];          // seconds between visitors
    // a rare coloured wolf now and then: often enough early on that the first wolves are not all alike
    var FIRE_RARE = [0.1, 0.13, 0.16, 0.19, 0.22];
    var FIRE_LIGHT = [330, 370, 410, 450, 500];
    var COST = {
        fire: [0, 120, 350, 900, 2200],
        den: [0, 80, 220, 550, 1300, 3000],
        huts: [0, 60, 180, 450, 1100, 2500],
        pouch: [0, 90, 260, 700]
    };
    var BREED_REST_MS = 90 * 1000;
    var DAY_S = 150;                                   // a full day-night cycle
    // while you are away a wolf comes to the fire every WAIT_MIN minutes; at most WAIT_MAX wait there
    var WAIT_MIN = 20, WAIT_MAX = 3;
    // an interstitial only at a natural break, at most every 2 minutes (YouTube: ads at logical pauses)
    var AD_GAP_MS = 2 * 60 * 1000, AD_FIRST_MS = 2 * 60 * 1000;
    var BOOST_MS = 10 * 60 * 1000;                     // a rewarded ad doubles the village income this long
    var BREED_BONES = [0, 40, 70, 110, 160, 250];     // a new breed pays by its stars
    var REST_MS = 3 * 60 * 1000;                       // a dog rests after a round of any mini-game
    // the camp through the ages: a painting for every level of every building, and its height at scale 1
    var LOOK = {
        huts: ['tent', 'house_2', 'house_3', 'house_4', 'house_5', 'house_6'],
        fire: ['campfire', 'fire_2', 'fire_3', 'fire_4', 'fire_5'],
        den: ['nest', 'nest_2', 'nest_3', 'nest_4', 'nest_5', 'nest_6'],
        pouch: ['pantry_1', 'rack', 'pantry_3', 'pantry_4']
    };
    // homes are clearly bigger than a dog (a grown dog is about 100 px tall in camp); the first level
    // is the old tents, drawn by art.tent
    var LOOK_H = {
        huts: [110, 158, 150, 160, 176, 204],
        fire: [88, 88, 128, 92, 128],
        den: [100, 104, 108, 128, 132, 156],
        pouch: [62, 96, 112, 124]
    };
    var UPS = ['huts', 'fire', 'den', 'pouch'];
    var ERAS = 6;                                      // a new era with every chapter finished
    var VILLAGE_SHOWN = 6;                             // village dogs seen at the forest edge

    /* ================================================================ canvas */
    var stageEl = document.getElementById('stage'), canvas = document.getElementById('game');
    var ctx = canvas.getContext('2d'), uiEl = document.getElementById('ui');
    var LW = 720, LH = 1280, POS = {};
    // a screen wider than the game (a desktop, a turned phone) shows more world to the left and right:
    // x from XL to XR is on screen (0..720 on a tall screen), and the camp spreads out by SPREAD
    var XL = 0, XR = 720, VW = 720, SPREAD = 1;
    /* a spot in the camp, f of the way across (spread out on a wide screen) */
    function X(f) { return SPREAD === 1 ? LW * f : LW / 2 + (f - 0.5) * LW * SPREAD; }
    function SX(x) { return SPREAD === 1 ? x : LW / 2 + (x - LW / 2) * SPREAD; }
    /* the canvas transform: logical pixels to the screen */
    function viewTransform(c) {
        if (XL === 0) c.setTransform(canvas.width / LW, 0, 0, canvas.height / LH, 0, 0);
        else c.setTransform(canvas.width / VW, 0, 0, canvas.height / LH, -XL * canvas.width / VW, 0);
    }

    function layout() {
        var vw = window.innerWidth, vh = window.innerHeight, aspect = vh / vw;
        LH = aspect >= 1.45 ? Math.round(clamp(720 * aspect, 1180, 1560)) : 1280;
        var sc = Math.min(vw / LW, vh / LH);
        // wider than the game: the stage fills the screen and the world goes on to the sides
        var wide = vw / sc - LW > 8;
        VW = wide ? vw / sc : LW; XL = (LW - VW) / 2; XR = XL + VW;
        if (!wide) { XL = 0; XR = LW; }
        SPREAD = wide ? clamp(1 + (VW / LW - 1) * 0.4, 1, 1.5) : 1;
        A.setView(XL, XR);
        stageEl.classList.toggle('wide', wide);
        var cw = wide ? vw : Math.round(LW * sc), ch = Math.round(LH * sc);
        stageEl.style.width = cw + 'px'; stageEl.style.height = ch + 'px';
        stageEl.style.left = Math.round((vw - cw) / 2) + 'px'; stageEl.style.top = Math.round((vh - ch) / 2) + 'px';
        // a turned phone is short: the buttons and panels grow so they stay easy to read and tap
        stageEl.style.setProperty('--u', sc * (wide ? clamp(600 / vh, 1, 1.6) : 1) + 'px');
        var dpr = Math.min(2, window.devicePixelRatio || 1);
        canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
        POS.horizon = LH * 0.34;
        POS.edge = { x: LW * 0.5, y: POS.horizon + 70 };        // where visitors wait
        POS.fire = { x: LW * 0.5, y: LH * 0.66 };
        POS.nest = { x: X(0.2), y: LH * 0.77 };
        POS.tentL = { x: X(0.13), y: LH * 0.575 };
        POS.tentR = { x: X(0.87), y: LH * 0.56 };
        POS.campTop = LH * 0.5; POS.campBot = LH - 190;
        POS.hand = { x: LW * 0.5, y: LH - 200 };
        POS.pantry = { x: X(0.64), y: LH * 0.535 };
        // the village spreads along the forest edge, either side of the path the wolves come down
        POS.village = [
            { x: X(0.09), y: POS.horizon + 132 }, { x: X(0.91), y: POS.horizon + 126 },
            { x: X(0.25), y: POS.horizon + 112 }, { x: X(0.75), y: POS.horizon + 108 }
        ];
        POS.vzone = [{ x0: SX(40), x1: SX(230) }, { x0: SX(490), x1: SX(680) }];
        POS.vy = [POS.horizon + 104, POS.horizon + 156];
        // journey rewards stand around the camp
        POS.deco = {
            doghouse: { x: X(0.76), y: LH * 0.81 },
            lanterns: [{ x: X(0.29), y: LH * 0.64 }, { x: X(0.71), y: LH * 0.64 }],
            totem: { x: X(0.07), y: LH * 0.71 },
            statue: { x: X(0.915), y: LH * 0.69 }
        };
        // where the pack wanders: the camp, and on a wide screen the meadow around it too
        POS.roam = SPREAD === 1 ? { x0: 40, x1: LW - 40 } : { x0: Math.max(XL + 60, X(0) - 200), x1: Math.min(XR - 60, X(1) + 200) };
    }
    function toLogical(e) {
        var r = canvas.getBoundingClientRect();
        return { x: XL + (e.clientX - r.left) / r.width * VW, y: (e.clientY - r.top) / r.height * LH };
    }

    /* ================================================================ state */
    var S = null;                   // the saved game
    var dogs = [];                  // runtime view of S.dogs (pack only), with positions
    var scene = 'title';            // title | camp | tame | litter
    var paused = false, clock = 0, dayT = DAY_S * 0.5;
    var visitor = null, tame = null, litter = null;
    var hold = null;                // finger held on a dog: { dog, t }
    var lastAdAt = 0, playMs = 0, adBusy = false;
    var away = null;                // what happened while you were away: { n, finds, wolves }
    var miniS = null, miniEnv = null, miniDef = null;   // a round of a mini-game (Play menu)
    var breedQueue = [];                    // new-breed cards waiting for a calm moment
    var readyKnown = null;                  // journey goals already announced

    function fresh() {
        return {
            v: 1, bones: 40, dogs: [], seen: {}, up: { fire: 1, den: 1, huts: 1, pouch: 1 },
            nextVisit: 0, tut: 0, litters: 0, tamed: 0, maxGen: 1, bestCute: 0,
            lucky: 0, nameIdx: 0, music: true, lastSeen: Date.now(), uid: 1, boostUntil: 0,
            store: 0, finds: {}, museum: 0, waitVis: 0      // the pantry, the scouts' finds, wolves waiting by the fire
        };
    }
    function save(now) { S.lastSeen = Date.now(); P.save(S); if (now) P.flush(); }
    function uid() { return S.uid++; }
    function nextName() {
        var list = W.i18n.names();
        var n = list[(S.nameIdx * 7 + 3) % list.length];
        S.nameIdx++;
        return n;
    }
    function isAdult(d) { return ageOf(d) >= 1; }
    function ageOf(d) { return d.adult ? 1 : clamp((Date.now() - d.born) / d.grow, 0, 1); }
    function packDogs() { return S.dogs.filter(function (d) { return d.role === 'pack'; }); }
    function villageDogs() { return S.dogs.filter(function (d) { return d.role === 'village'; }); }
    function denCap() { return DEN[S.up.den - 1]; }
    function hutCap() { return HUTS[S.up.huts - 1]; }
    function bestTame() { return S.dogs.reduce(function (m, d) { return Math.max(m, d.g.tame); }, 0); }
    function growMs() { return S.litters <= 1 ? 20000 : Math.min(300, 45 + 15 * S.litters) * 1000; }
    /* bones a minute the village makes at its jobs (js/jobs.js), without the boost */
    function villageBase() { return villageDogs().reduce(function (s, d) { return s + J.rate(d); }, 0); }
    function boostLeft() { return S ? Math.max(0, (S.boostUntil || 0) - Date.now()) : 0; }
    function villageRate() { return villageBase() * (boostLeft() > 0 ? 2 : 1); }
    /* the pantry holds this many bones: so many hours of the village's work */
    function storeCap() { return villageBase() * 60 * J.storeHours(S.up.pouch, villageDogs()); }
    function storeFull() { var cap = storeCap(); return cap > 0 && (S.store || 0) >= cap - 0.01; }
    function jobKey(id) { return 'job' + id.charAt(0).toUpperCase() + id.slice(1); }
    function jobName(id) { return t(jobKey(id)); }
    function findKey(id) { return 'find' + id.charAt(0).toUpperCase() + id.slice(1); }
    function hours(h) { return W.i18n.num(h, Math.abs(h - Math.round(h)) < 0.05 ? 0 : 1); }

    /* ================================================================ runtime dogs */
    function rt(d) {                     // runtime body for a saved dog
        var r = dogs.find(function (x) { return x.d === d; });
        if (r) return r;
        r = {
            d: d, x: POS.fire.x + (Math.random() - 0.5) * 300, y: POS.campTop + Math.random() * (POS.campBot - POS.campTop),
            tx: 0, ty: 0, st: 'idle', timer: Math.random() * 3, flip: Math.random() < 0.5 ? 1 : -1,
            hop: 0, hopP: 0, blink: 0, blinkT: 2 + Math.random() * 3, wag: 0.2, happy: 0, gaze: 0, petCd: 0, brow: 0
        };
        dogs.push(r);
        return r;
    }
    function syncDogs() {
        dogs = dogs.filter(function (r) { return r.d.role === 'pack' && S.dogs.indexOf(r.d) >= 0; });
        packDogs().forEach(function (d) { rt(d); });
        // every village dog works: one that came without a job takes the one its genes suit
        var taken = {};
        villageDogs().forEach(function (d) { if (d.job && !J.isMaker(d.job)) taken[d.job] = 1; });
        villageDogs().forEach(function (d) { if (!d.job) { d.job = J.best(d.g, era(), taken); if (!J.isMaker(d.job)) taken[d.job] = 1; } });
        syncVillage();
    }
    function scaleOf(d) {
        var age = ageOf(d);
        return 0.66 * (0.82 + 0.3 * d.g.size) * (0.5 + 0.5 * age);
    }
    /* depth: further up the meadow is further away, so smaller and slower; 1 at the fire's line */
    function depthAt(y) { return 0.7 + 0.35 * clamp((y - (POS.horizon + 60)) / (LH - 240 - POS.horizon), 0, 1); }
    function depthN(y) { return depthAt(y) / depthAt(POS.fire.y); }
    function campScale(r) { return scaleOf(r.d) * depthN(r.y); }
    function updateDogs(dt) {
        var night = nightAmt();
        dogs.forEach(function (r) {
            var d = r.d, adult = isAdult(d);
            if (!d.adult && ageOf(d) >= 1) grewUp(d, r);
            r.blinkT -= dt;
            if (r.blinkT <= 0) { r.blink = 1; r.blinkT = 2.5 + Math.random() * 4; }
            r.blink = Math.max(0, r.blink - dt * 7);
            r.happy = Math.max(0, r.happy - dt);
            r.petCd = Math.max(0, r.petCd - dt);
            r.wag += ((r.happy > 0 ? 1 : 0.25) - r.wag) * Math.min(1, dt * 4);
            r.brow = d.g.brow ? (Math.sin(clock * 1.7 + d.id) > 0.6 ? Math.min(1, r.brow + dt * 3) : Math.max(0, r.brow - dt * 2)) : 0;
            if (hold && hold.r === r) return;
            r.timer -= dt;
            if (r.st === 'walk') {
                var dx = r.tx - r.x, dy = r.ty - r.y, dist = Math.hypot(dx, dy);
                var sp = (adult ? 85 : 60) * (r.happy > 0 ? 1.4 : 1) * depthN(r.y);
                if (dist < 4) { r.st = 'idle'; r.timer = 1.5 + Math.random() * 4; r.hop = 0; }
                else {
                    r.x += dx / dist * sp * dt; r.y += dy / dist * sp * dt;
                    r.flip = dx < 0 ? -1 : 1;
                    r.hopP += dt * 11; r.hop = Math.abs(Math.sin(r.hopP)) * 7 * campScale(r);
                }
            } else if (r.timer <= 0) {
                var sleepy = night > 0.7 && Math.random() < 0.6;
                if (sleepy) {
                    // at night the pack curls up by the fire; pups go to the nest
                    var home = adult ? POS.fire : POS.nest;
                    var a = Math.random() * Math.PI * 2, rad = adult ? 110 + Math.random() * 70 : Math.random() * 50;
                    r.tx = home.x + Math.cos(a) * rad; r.ty = clamp(home.y + Math.abs(Math.sin(a)) * rad * 0.45 + 10, POS.campTop, POS.campBot);
                    r.st = 'walk'; r.sleepAfter = true;
                } else {
                    // somewhere in the camp, not in the fire and not inside a building
                    for (var tries = 0; tries < 8; tries++) {
                        r.tx = POS.roam.x0 + Math.random() * (POS.roam.x1 - POS.roam.x0); r.ty = POS.campTop + Math.random() * (POS.campBot - POS.campTop);
                        if (Math.hypot(r.tx - POS.fire.x, (r.ty - POS.fire.y) * 2) < 90) r.ty += 90;
                        if (!blocked(r.tx, r.ty)) break;
                    }
                    r.st = 'walk'; r.sleepAfter = false;
                }
                if (Math.random() < 0.08) SFX.play(adult ? 'bark' : 'yip', adult ? 1 : 1.3);
            }
            if (r.st === 'idle' && r.sleepAfter && night > 0.6) r.st = 'sleep';
            if (r.st === 'sleep' && night < 0.4) { r.st = 'idle'; r.timer = 0.5; }
        });
    }
    function grewUp(d, r) {
        d.adult = true;
        d.g.tame = Math.min(100, d.g.tame + Math.round((d.bond || 0) * 3));   // socialisation
        FX.sparkle(r.x, r.y - 40, 14, '#fff6a0');
        FX.text(clamp(r.x, XL + 190, XR - 190), r.y - 80, t('grew', { name: d.name }), '#fff6a0', 30);
        SFX.play('grow');
        if (S.tut === 5) { S.tut = 6; hint(t('tut6'), 6000); }
        emit('grow');
        save();
        refreshHud();
    }

    /* ================================================================ day & night */
    function phase() { return (dayT % DAY_S) / DAY_S; }
    // mostly day: sunset, a short blue night round the fire, sunrise
    function nightAmt() {
        var p = phase();
        if (p < 0.52) return 0;
        if (p < 0.62) return (p - 0.52) / 0.1;
        if (p < 0.86) return 1;
        if (p < 0.96) return 1 - (p - 0.86) / 0.1;
        return 0;
    }
    function duskAmt() {
        var p = phase();
        if (p > 0.42 && p < 0.64) return 1 - Math.abs(p - 0.53) / 0.11;
        if (p > 0.84) return Math.max(0, 1 - Math.abs(p - 0.92) / 0.08) * 0.8;
        return 0;
    }

    /* ================================================================ visitors */
    function spawnVisitor(kind) {
        var r = Math.random;
        var g = G.wild(r, kind);
        if (S.tut <= 2) {                  // the first two friends are a pair
            var have = packDogs()[0];
            g.sex = have ? (have.g.sex === 'm' ? 'f' : 'm') : 'm';
        }
        visitor = {                        // down the path between the village homes
            d: { id: 0, g: g, seed: Math.floor(r() * 1e9), age: 1, name: '' },
            x: 210 + r() * (LW - 420), y: POS.edge.y, kind: kind || '', t: 0
        };
        SFX.play('howl');
        if (S.tut === 0 || S.tut === 2) hint(t('tut1'), 0, 'eyes');
    }
    function updateVisits(dt) {
        if (scene !== 'camp' || visitor || S.tut === 3 || S.tut === 4) return;
        if (packDogs().length >= denCap()) return;
        if (Date.now() >= S.nextVisit) {
            var kind = '';
            if (S.tut >= 5 && Math.random() < FIRE_RARE[S.up.fire - 1]) kind = ['white', 'black', 'red', 'gold'][Math.floor(Math.random() * 4)];
            if (S.waitVis > 0) S.waitVis--;          // one of the wolves that came while you were away
            spawnVisitor(kind);
        }
    }
    function scheduleVisit(sec) { S.nextVisit = Date.now() + sec * 1000; }

    /* ================================================================ taming */
    function startTame() {
        if (!visitor) return;
        scene = 'tame';
        var ringK = 0.3;
        tame = {
            v: visitor, x: visitor.x, y: visitor.y, tx: visitor.x, ty: visitor.y + 90,
            phase: 'enter', trust: 0, fear: 0, treats: POUCH[S.up.pouch - 1] + (S.tut <= 2 ? 3 : 0),
            ringR: S.tut <= 2 ? 92 : 74, ringK: ringK, flying: null, eatT: 0, flinch: 0,
            looking: false, lookT: 1.2, fill: 0, holding: false, mood: 'scared', msgT: 0, adOffered: false, done: 0
        };
        hideHint();
        SFX.play('tap');
        if (S.tut <= 2) hint(t('tut2'), 0);
        refreshHud();
    }
    function ringPos() {
        var k = tame.ringK;
        return { x: tame.x + (POS.hand.x - tame.x) * k, y: tame.y + (POS.hand.y - tame.y) * k };
    }
    function tossAt(p) {
        if (tame.phase !== 'approach' || tame.flying || tame.eatT > 0) return;
        if (tame.treats <= 0) return;
        tame.treats--;
        var ring = ringPos();
        tame.flying = { sx: POS.hand.x, sy: POS.hand.y, x: p.x, y: p.y, t: 0, dur: 0.45, ring: ring };
        SFX.play('whoosh');
        refreshHud();
    }
    function landTreat(f) {
        SFX.play('land');
        var ring = f.ring, dist = Math.hypot(f.x - ring.x, f.y - ring.y);
        // how far along the visitor -> you line did it land? 0 = at the visitor, 1 = at you
        var vx = POS.hand.x - tame.x, vy = POS.hand.y - tame.y, len2 = vx * vx + vy * vy;
        var along = ((f.x - tame.x) * vx + (f.y - tame.y) * vy) / len2;
        var gain = 0, label, col;
        if (dist <= tame.ringR * 0.4) { gain = 0.38; label = t('perfect'); col = '#fff36b'; SFX.play('good'); FX.sparkle(f.x, f.y, 10); }
        else if (dist <= tame.ringR) { gain = 0.25; label = t('good'); col = '#b9ff8a'; SFX.play('good'); }
        else if (along > tame.ringK) {
            tame.fear++; tame.flinch = 0.6; label = t('tooClose'); col = '#ff8f8f'; SFX.play('wrong');
            FX.text(f.x, f.y - 40, label, col, 34);
            if (tame.fear >= 3) flee();
            tame.dropped = { x: f.x, y: f.y, t: 3 };
            return;
        } else { gain = 0.07; label = t('tooFar'); col = '#ffd18a'; }
        FX.text(f.x, f.y - 40, label, col, 34);
        tame.trust = Math.min(1, tame.trust + gain);
        tame.tx = f.x; tame.ty = f.y; tame.goEat = { x: f.x, y: f.y };
        tame.phase = 'walk';
        tame.mood = tame.trust > 0.5 ? 'calm' : 'scared';
    }
    function flee() {
        tame.phase = 'flee'; tame.mood = 'scared'; tame.tx = tame.x; tame.ty = POS.horizon - 40;
        SFX.play('flee');
        FX.text(LW / 2, LH * 0.45, t('fled'), '#ffd6d6', 32);
        hideHint();
    }
    function toGaze() {
        tame.phase = 'gaze'; tame.mood = 'calm'; tame.looking = false; tame.lookT = 0.8;
        if (S.tut <= 2) hint(t('tut3'), 0); else hint(t('gaze'), 3500);
        refreshHud();
    }
    function bond() {
        tame.phase = 'bond'; tame.mood = 'happy'; tame.done = 1.6;
        var d = tame.v.d;
        d.id = uid(); d.name = nextName(); d.role = 'pack'; d.adult = true; d.age = undefined;
        d.born = Date.now() - 1; d.grow = 1; d.gen = 1; d.rest = 0; d.bond = 0;
        S.dogs.push(d);
        S.tamed++;
        S.bones += 15;
        Q.on(S, 'tame');
        if (nightAmt() > 0.5) Q.on(S, 'tameNight');
        if (tame.v.kind) Q.on(S, 'tameRare');
        FX.hearts(tame.x, tame.y - 60, 14, true);
        FX.confetti(tame.x, tame.y - 40, 40);
        FX.text(LW / 2, LH * 0.42, t('bonded'), '#ffb3d9', 50);
        SFX.play('bond'); SFX.play('bark');
        discover(d, tame.x, tame.y - 120);
        tame.newDog = d;                    // joins the camp when the celebration ends
        hideHint();
        save(true);
        refreshHud();
    }
    function updateTame(dt) {
        var tm = tame;
        if (!tm) return;
        var dx = tm.tx - tm.x, dy = tm.ty - tm.y, dist = Math.hypot(dx, dy);
        var speed = tm.phase === 'flee' ? 260 : tm.phase === 'enter' ? 90 : 120;
        if (dist > 2) { var st = Math.min(dist, speed * dt); tm.x += dx / dist * st; tm.y += dy / dist * st; tm.hopP = (tm.hopP || 0) + dt * 10; }
        tm.flinch = Math.max(0, tm.flinch - dt);
        if (tm.dropped) { tm.dropped.t -= dt; if (tm.dropped.t <= 0) tm.dropped = null; }
        if (tm.phase === 'enter' && dist <= 2) { tm.phase = 'approach'; }
        if (tm.flying) {
            tm.flying.t += dt;
            if (tm.flying.t >= tm.flying.dur) { var f = tm.flying; tm.flying = null; landTreat(f); }
            // a landing gives the wolf a new target (the treat, or the forest when it flees):
            // measure again, or it would "eat" before walking there / vanish instead of running off
            dist = Math.hypot(tm.tx - tm.x, tm.ty - tm.y);
        }
        if (tm.phase === 'walk' && dist <= 2) {
            tm.phase = 'eat'; tm.eatT = 0.7; SFX.play('munch');
        }
        if (tm.phase === 'eat') {
            tm.eatT -= dt;
            if (tm.eatT <= 0) {
                tm.eatT = 0;
                var near = Math.hypot(POS.hand.x - tm.x, POS.hand.y - tm.y) < 260;
                if (tm.trust >= 0.99 || near) toGaze();
                else { tm.phase = 'approach'; if (tm.treats <= 0) outOfTreats(); }
            }
        }
        if (tm.phase === 'approach' && tm.treats <= 0 && !tm.flying && !tm.adOffered) outOfTreats();
        if (tm.phase === 'gaze') {
            // wolves hold your gaze only briefly; the tamer the animal, the longer it looks
            tm.lookT -= dt;
            if (tm.lookT <= 0) {
                tm.looking = !tm.looking;
                var tameF = tm.v.d.g.tame / 100;
                tm.lookT = tm.looking ? 0.8 + 1.6 * tameF + (S.tut <= 2 ? 0.9 : 0) + Math.random() * 0.5 : 0.9 + Math.random() * 0.9 - tameF * 0.4;
                if (tm.looking) SFX.play('heart');
            }
            if (tm.holding) {
                if (tm.looking) {
                    tm.fill = Math.min(1, tm.fill + dt * (S.tut <= 2 ? 0.55 : 0.42));
                    if (Math.random() < dt * 6) FX.hearts(tm.x, tm.y - 70, 1);
                } else {
                    tm.fill = Math.max(0, tm.fill - dt * 0.12);
                    tm.msgT -= dt;
                    if (tm.msgT <= 0) { FX.text(tm.x, tm.y - 130, t('waitEyes'), '#ffe7b0', 26); tm.msgT = 1.6; }
                }
            } else tm.fill = Math.max(0, tm.fill - dt * 0.04);
            if (tm.fill >= 1) bond();
        }
        if (tm.phase === 'bond') {
            tm.done -= dt;
            if (tm.done <= 0) endTame(true);
        }
        if (tm.phase === 'flee' && dist <= 2) endTame(false);
    }
    function outOfTreats() {
        tame.adOffered = true;
        if (P.adsAvailable()) {
            showPanel(buildPanel(t('treats'), [
                el('div', { class: 'sub' }, t('moreTreats')),
                el('div', { class: 'body' }, [
                    btn(t('moreTreats'), 'pink', function () {
                        // closed quietly: the panel's own "closed = the wolf leaves" must not run, or the
                        // wolf would run off while the player watches the ad for its treats
                        closePanel(true);
                        rewarded('wtw-treats', function () { if (tame) { tame.treats += 3; refreshHud(); } }, function () { if (tame) flee(); });
                    }, true),
                    el('div', { class: 'gap' }),
                    btn(t('close'), 'gray', function () { closePanel(); })      // closing lets the wolf go (below)
                ])
            ], function () { flee(); }));
        } else flee();
    }
    function endTame(ok) {
        if (ok && tame && tame.newDog) { var nr = rt(tame.newDog); nr.x = tame.x; nr.y = Math.max(tame.y, POS.campTop); nr.happy = 3; }
        visitor = null; tame = null; scene = 'camp';
        // the wolves still waiting by the fire come one after another
        scheduleVisit(S.waitVis > 0 ? 3 : ok ? FIRE_EVERY[S.up.fire - 1] : 12);
        if (ok) {
            if (S.tut === 0) { S.tut = 2; scheduleVisit(2); }
            else if (S.tut === 2) { S.tut = 3; hint(t('tut4'), 0, 'family'); }
        } else if (S.tut <= 2) scheduleVisit(3);
        save(true);
        refreshHud();
        maybeInterstitial();
    }

    /* ================================================================ breeding */
    function canBreed(d) { return d.role === 'pack' && isAdult(d) && Date.now() >= (d.rest || 0); }
    /* does a trait change how a dog with these genes looks? (its painting) */
    function showsOn(g) {
        if (!W.sprites || !W.sprites.lookOf) return null;
        var now = W.sprites.lookOf(g);
        return function (key) { var c = Object.assign({}, g); G.applyTrait(c, key); return W.sprites.lookOf(c) !== now; };
    }
    function freeDen() { return denCap() - packDogs().length; }
    function breedPair(a, b) {
        var free = freeDen();
        if (free < 1) { toast(t('denFull')); return; }
        var r = Math.random;
        var lucky = S.lucky > 0;
        var n = Math.min(free, 3 + Math.floor(r() * 3) + (lucky ? 1 : 0));
        var boost = (S.litters < 6 ? 1.8 : 1) * (lucky ? 2 : 1);
        if (lucky) S.lucky--;
        var gen = Math.max(a.gen || 1, b.gen || 1) + 1;
        var pups = [];
        for (var i = 0; i < n; i++) {
            var g = G.breed(a.g, b.g, r, boost);
            pups.push({ id: uid(), name: nextName(), g: g, seed: Math.floor(r() * 1e9), gen: gen, role: 'pack', adult: false, born: Date.now(), grow: growMs(), bond: 0, rest: 0 });
        }
        // the first three litters always bring something new: the hook is set early. A trait the
        // pup's picture shows is preferred, so the change is there to see, not only in the Book
        if (S.litters < 3 || lucky) G.forceNew(pups[0].g, S.seen, r, Math.max(12, bestTame() + 10), showsOn(pups[0].g));
        a.rest = b.rest = Date.now() + BREED_REST_MS;
        S.litters++;
        Q.on(S, 'litter');
        var newGen = gen > S.maxGen;
        S.maxGen = Math.max(S.maxGen, gen);
        pups.forEach(function (p) { S.dogs.push(p); });
        S.bones += 5 * n;
        var found = pups.map(markNew);
        litter = { pups: pups, found: found, shown: 0, t: 0.6, gen: gen, newGen: newGen, a: a, b: b, finish: false, cards: [] };
        scene = 'litter';
        closePanel(); hideHint(); refreshHud();
        if (S.tut === 3) S.tut = 4;
        save(true);
        P.sendScore(Object.keys(S.breeds).length * 1000 + S.maxGen * 100 + S.bestCute);
    }
    function updateLitter(dt) {
        var L = litter;
        L.t -= dt;
        if (L.shown < L.pups.length && L.t <= 0) {
            var p = L.pups[L.shown];
            var n = L.pups.length, i = L.shown;
            var x = LW / 2 + (i - (n - 1) / 2) * Math.min(150, (LW - 120) / n), y = LH * 0.56;
            var f = L.found[i];
            celebrate(f, x, y - 130);
            L.cards.push({ p: p, x: x, y: y, pop: 0, found: f.n, breed: f.br[0] || null });
            SFX.play('pop', i);
            FX.sparkle(x, y - 40, 12, '#ffffff');
            L.shown++;
            L.t = f.n ? 1.5 + 0.5 * f.br.length : 0.8;
        }
        L.cards.forEach(function (c) { c.pop = Math.min(1, c.pop + dt * 4); });
        if (L.shown >= L.pups.length && L.t <= -0.4) L.finish = true;
    }
    function endLitter() {
        var L = litter;
        L.pups.forEach(function (p, i) { var r = rt(p); r.x = POS.nest.x + (i - L.pups.length / 2) * 30; r.y = POS.nest.y; r.st = 'idle'; r.timer = 1 + i * 0.3; });
        litter = null; scene = 'camp';
        if (S.tut === 4) { S.tut = 5; hint(t('tut5'), 0, 'pup'); }
        refreshHud();
        maybeInterstitial();
    }

    /* A dog joins or is born: record new traits, celebrate, pay out. */
    /* Record a newcomer's unseen traits and pay for them. Saved at once, so a
       reload during the celebration loses nothing; celebrate() is only the show. */
    function markNew(d) {
        var tr = G.traits(d.g).filter(function (k) { return !S.seen[k]; });
        tr.forEach(function (k) { S.seen[k] = Date.now(); });
        if (tr.length) S.bones += 30 * tr.length;
        // a breed is a named mix of traits; the first dog of each one is a big moment
        var br = B.match(d.g).filter(function (b) { return !S.breeds[b.id]; });
        br.forEach(function (b) { S.breeds[b.id] = Date.now(); S.bones += BREED_BONES[b.stars]; });
        S.bestCute = Math.max(S.bestCute, G.cuteness(d.g));
        return { tr: tr, br: br, d: d, n: tr.length + br.length };
    }
    function celebrate(f, x, y) {
        f.tr.forEach(function (k, i) {
            later(i * 0.45, function () {
                FX.text(clamp(x, XL + 170, XR - 170), y - i * 50, t('newTrait') + ' ' + W.i18n.trait(k), '#ffe45c', 32);
                FX.confetti(x, y + 40, 26);
                SFX.play('newTrait');
            });
        });
        f.br.forEach(function (b, j) {
            later((f.tr.length + j) * 0.45 + 0.25, function () {
                FX.text(clamp(x, XL + 220, XR - 220), y - 90, t('newBreed'), '#ff9fd0', 50);
                FX.text(clamp(x, XL + 220, XR - 220), y - 40, stars(b) + ' ' + bname(b), '#fff6a0', 34);
                FX.confetti(x, y + 20, 60); FX.sparkle(x, y, 26, '#ffd1ea');
                SFX.play('bond');
            });
            breedQueue.push({ b: b, d: f.d });
        });
        refreshHud();
    }
    function bname(b) { var m = t('breedNames'); return (m && m[b.id]) || b.id; }
    function bdesc(b) { var m = t('breedDesc'); return (m && m[b.id]) || ''; }
    function stars(b) { return new Array(b.stars + 1).join('★'); }
    function discover(d, x, y) { var f = markNew(d); celebrate(f, x, y); return f; }
    /* timed events on the game clock, so they wait while YouTube pauses the game */
    var timers = [];
    function later(sec, fn) { timers.push({ at: clock + sec, fn: fn }); }
    function runTimers() {
        for (var i = timers.length - 1; i >= 0; i--) {
            if (clock >= timers[i].at) { var f = timers[i].fn; timers.splice(i, 1); f(); }
        }
    }

    /* ================================================================ interactions in camp */
    function dogAt(p) {
        var best = null, bd = 1e9;
        dogs.forEach(function (r) {
            var s = campScale(r), cy = r.y - 70 * s;
            var dd = Math.hypot(p.x - r.x, (p.y - cy) * 0.9);
            if (dd < 95 * s + 18 && dd < bd) { best = r; bd = dd; }
        });
        return best;
    }
    function pet(r) {
        if (r.petCd > 0) return;
        r.petCd = 0.9; r.happy = 1.6;
        var d = r.d, s = campScale(r);
        FX.hearts(r.x, r.y - 110 * s, 3);
        SFX.play(isAdult(d) ? 'bark' : 'yip', isAdult(d) ? 1 : 1.35);
        if (!d.adult) {
            d.born -= d.grow * 0.04;                 // loved pups grow faster
            d.bond = Math.min(1, (d.bond || 0) + 0.08);
            emit('pet');
            save();
        }
    }
    function updateHold(dt) {
        if (!hold) return;
        hold.t += dt;
        var r = hold.r, d = r.d;
        if (hold.t < 0.35) return;
        // eye contact: the oxytocin-gaze loop (Nagasawa et al., Science 2015)
        r.gaze = Math.min(1, r.gaze + dt * 3); r.happy = 0.5;
        hold.fill = Math.min(1, (hold.fill || 0) + dt * (0.45 + d.g.tame / 250));
        if (Math.random() < dt * 5) FX.hearts(r.x, r.y - 110 * campScale(r), 1);
        if (hold.fill >= 1) {
            FX.hearts(r.x, r.y - 110 * campScale(r), 10, true);
            SFX.play('bond');
            if (!d.adult) { d.born -= d.grow * 0.15; d.bond = Math.min(1, (d.bond || 0) + 0.35); }
            S.bones += 2;
            hold = null; r.happy = 2.5;
            emit('gaze');
            save(); refreshHud();
        }
    }

    /* ================================================================ the village at work
     * Village dogs work at the job their genes suit (js/jobs.js). What they make waits in the
     * pantry until you tap it; a full pantry stops the work, so coming back is worth it. Nannies make
     * pups grow and tired dogs rest faster, scouts dig things up, guards make the pantry hold more. */
    /* sec seconds of village work (any length: a frame, or the time the game was hidden) */
    function villageTick(sec) {
        var vd = villageDogs(), cap = storeCap(), rate = villageRate();
        if (!vd.length || rate <= 0) return;
        // everyone works until the pantry is full
        var min = Math.min(sec / 60, Math.max(0, cap - (S.store || 0)) / rate);
        if (min <= 0) return;
        S.store = Math.min(cap, (S.store || 0) + rate * min);
        var k = J.nanny(vd), now = Date.now();
        if (k > 0) packDogs().forEach(function (d) {
            if (!d.adult) d.born -= min * 60000 * k;
            if ((d.play || 0) > now) d.play = Math.max(now, d.play - min * 60000 * k);
        });
        vd.forEach(function (d) {
            var x = J.findChance(d) * min, n = x < 1 ? (Math.random() < x ? 1 : 0) : Math.min(3, Math.floor(x) + (Math.random() < x % 1 ? 1 : 0));
            for (var i = 0; i < n; i++) found(d, n > 1);
        });
    }
    // the village works by the clock, not by frames: a slow phone fills it as fast, and the time the
    // game was hidden or paused counts when it comes back
    var villageAt = 0, storeSavedAt = 0;
    function updateVillage(dt) {
        var now = Date.now(), sec = villageAt ? clamp((now - villageAt) / 1000, 0, 7 * 24 * 3600) : dt;
        villageAt = now;
        var before = Math.floor(S.store || 0), wasFull = storeFull();
        villageTick(sec);
        var after = Math.floor(S.store || 0);
        if (after > before) villageShown += after - before;
        if (!wasFull && storeFull()) { save(); refreshHud(); }
        if (now - storeSavedAt > 10000) { storeSavedAt = now; save(); }    // the pantry's count survives a reload
        showVillageIncome(dt);
        updateFlyBones(dt);
        showFinds();
    }
    /* what a scout digs up: a piece of history (its own card), a clover or a cache of bones */
    var findQueue = [];
    function found(d, quiet) {
        var res = J.roll(S.finds, Math.random, era());
        if (res.kind === 'find') {
            S.finds[res.id] = Date.now();
            var all = !S.museum && J.FINDS.every(function (f) { return S.finds[f]; });
            if (all) { S.museum = 1; S.clover = (S.clover || 0) + 3; }    // the village museum is complete
            findQueue.push({ id: res.id, d: d, all: all });
        } else if (res.kind === 'clover') {
            S.clover = (S.clover || 0) + 1;
            if (!quiet) toast(t('findClover', { name: d.name }));
        } else {
            S.bones += res.n;
            if (!quiet) toast(t('findCache', { name: d.name, n: res.n }));
        }
        save(); refreshHud();
        if (!quiet) showFinds();
        return res;
    }
    var welcomed = false;                   // the welcome-back card comes first, the finds after it
    function showFinds() {
        if (!welcomed || !findQueue.length || scene !== 'camp' || panelEl || hold || (hud.hint && hud.hint.style.display === 'block')) return;
        var q = findQueue.shift();
        findCard(q.id, q.d, q.all);
    }
    function findCard(id, d, all, back) {
        SFX.play('newTrait');
        showPanel(buildPanel('🧭 ' + t(findKey(id)), [el('div', { class: 'body center' }, [
            el('img', { class: 'findpic', src: 'img/find_' + id + '.webp', alt: '' }),
            d ? el('div', { class: 'sub', style: 'padding:0;font-weight:900' }, t('findNew', { name: d.name, item: t(findKey(id)) })) : null,
            el('div', { class: 'fact' }, '💡 ' + t(findKey(id) + 'F')),
            all ? el('div', { class: 'sub', style: 'font-weight:900;color:#2e8a3a' }, '🏛️ ' + t('findAll')) : null,
            el('div', { class: 'gap' }),
            btn(t('ok'), 'green', function () { if (back) back(); else closePanel(); })
        ])]));
    }
    /* the pantry's bones go to the counter: they fly there */
    function collect(mult) {
        var n = Math.floor(S.store || 0);
        if (n < 1) { toast(t('storeEmpty')); return 0; }
        mult = mult || 1;
        S.store -= n; S.bones += n * mult;
        launchBones(n * mult);
        SFX.play('coin'); later(0.5, function () { SFX.play('pop', 4); });
        toast(t('collected', { n: n * mult }));
        save(true); refreshHud();
        return n;
    }
    var flyBones = [];                      // bones on their way from the pantry to the counter
    function counterPos() {                 // the bone counter (HUD) in the canvas's coordinates
        var r = hud.bones && hud.bones.getBoundingClientRect(), cr = canvas.getBoundingClientRect();
        if (!r || !r.width || !cr.width) return { x: 100, y: 50 };
        return { x: XL + (r.left + r.height * 0.6 - cr.left) / cr.width * VW, y: (r.top + r.height / 2 - cr.top) / cr.height * LH };
    }
    function launchBones(n) {
        var from = bubblePos(true), to = counterPos(), k = clamp(Math.ceil(n / 6), 3, 14);
        for (var i = 0; i < k; i++) {
            flyBones.push({ x0: from.x + (Math.random() - 0.5) * 50, y0: from.y + (Math.random() - 0.5) * 24, x1: to.x, y1: to.y, t: -i * 0.05, dur: 0.6 + Math.random() * 0.2 });
        }
    }
    function updateFlyBones(dt) {
        for (var i = flyBones.length - 1; i >= 0; i--) {
            if ((flyBones[i].t += dt) >= flyBones[i].dur) { flyBones.splice(i, 1); if (!flyBones.length) bumpCounter(); }
        }
    }
    function drawFlyBones(c) {
        if (!flyBones.length) return;
        c.save();
        c.font = '34px system-ui, "Segoe UI Emoji", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
        flyBones.forEach(function (b) {
            if (b.t < 0) return;
            var u = b.t / b.dur, e = u * u * (3 - 2 * u);
            c.globalAlpha = u > 0.85 ? (1 - u) / 0.15 : 1;
            c.fillText('🦴', b.x0 + (b.x1 - b.x0) * e, b.y0 + (b.y1 - b.y0) * e - Math.sin(u * Math.PI) * 110);
        });
        c.restore();
    }
    function bumpCounter() {
        if (!hud.bones) return;
        hud.bones.classList.remove('bump'); void hud.bones.offsetWidth; hud.bones.classList.add('bump');
    }
    /* the bubble over the pantry: what waits there (null when nothing does, unless always) */
    function bubblePos(always) {
        var h = S ? LOOK_H.pouch[S.up.pouch - 1] * 0.95 : 60, p = { x: POS.pantry.x, y: POS.pantry.y - h - 46 };
        if (always) return p;
        return S && scene === 'camp' && (S.store || 0) >= 1 ? p : null;
    }
    function drawStoreBubble(c) {
        var p = bubblePos();
        if (!p) return;
        var full = storeFull(), n = Math.floor(S.store), cap = storeCap();
        var k = full ? 1 + 0.06 * Math.sin(clock * 6) : 1, y = p.y + Math.sin(clock * 3) * 4;
        var txt = full ? t('storeFullShort') : String(n);
        c.save();
        c.translate(p.x, y); c.scale(k, k);
        c.font = '900 28px "Trebuchet MS", system-ui, sans-serif';
        var w = Math.max(104, c.measureText(txt).width + 78);
        c.fillStyle = full ? '#ffe2d0' : '#fff8ec'; c.strokeStyle = full ? '#c4521f' : A.INK; c.lineWidth = 4;
        c.beginPath(); c.moveTo(-11, 24); c.lineTo(0, 40); c.lineTo(11, 24); c.closePath(); c.fill(); c.stroke();
        A.roundRect(c, -w / 2, -28, w, 56, 28); c.fill(); c.stroke();
        // the gauge along the bottom of the bubble
        if (cap > 0) { A.roundRect(c, -w / 2 + 16, 14, (w - 32) * Math.min(1, n / cap), 6, 3); c.fillStyle = full ? '#ff8a5c' : '#f2a73b'; c.fill(); }
        c.textAlign = 'center'; c.textBaseline = 'middle';
        c.font = '30px system-ui, "Segoe UI Emoji", sans-serif'; c.fillText('🦴', -w / 2 + 30, -2);
        c.font = '900 28px "Trebuchet MS", system-ui, sans-serif'; c.fillStyle = full ? '#c4521f' : '#5a3a2a';
        c.fillText(txt, 15, -2);
        c.restore();
    }
    function onPantry(p) {
        var lv = S.up.pouch, h = LOOK_H.pouch[lv - 1] * 0.95;
        return Math.abs(p.x - POS.pantry.x) < 62 && p.y < POS.pantry.y + 6 && p.y > POS.pantry.y - h;
    }

    /* back after a while: what the village made, what the scouts found, the wolves at the fire */
    function workWhileAway() {
        var now = Date.now(), ms = clamp(now - (S.lastSeen || now), 0, 40 * 24 * 3600 * 1000);
        away = null;
        if (ms < 60000) return;
        var vd = villageDogs(), base = villageBase(), res = { n: 0, finds: [], wolves: 0 };
        if (vd.length && base > 0) {
            var room = Math.max(0, storeCap() - (S.store || 0));
            var boosted = clamp(Math.min(now, S.boostUntil || 0) - (now - ms), 0, ms);    // the part of it under a boost
            var make = Math.min(room, base * (ms + boosted) / 60000);
            S.store = (S.store || 0) + make; res.n = make;
            // everyone worked until the pantry was full
            var work = Math.min(ms, make / base * 60000), k = J.nanny(vd);
            if (k > 0) packDogs().forEach(function (d) {
                if (!d.adult) d.born -= work * k;
                if ((d.play || 0) > now) d.play = Math.max(now, d.play - work * k);
            });
            vd.forEach(function (d) {
                var x = J.findChance(d) * work / 60000, n = Math.min(3, Math.floor(x) + (Math.random() < x % 1 ? 1 : 0));
                for (var i = 0; i < n; i++) res.finds.push(found(d, true));
            });
        }
        // wolves kept coming to the fire, and some wait there
        if (S.tut >= 6) {
            var w = Math.min(WAIT_MAX, Math.floor(ms / 60000 / WAIT_MIN), Math.max(0, denCap() - packDogs().length));
            S.waitVis = Math.max(S.waitVis || 0, w);
            res.wolves = S.waitVis;
        }
        away = res;
    }
    function findLabel(f) { return f.kind === 'find' ? t(findKey(f.id)) : f.kind === 'clover' ? '🍀' : '🦴 ' + f.n; }
    function welcomeBack(then) {
        var a = away; away = null;
        var n = Math.floor(S.store || 0);
        if (!a || S.tut < 6 || (a.n < 10 && !a.wolves && !a.finds.length)) { wolvesCome(); if (then) then(); return; }
        var cap = storeCap(), full = storeFull();
        showPanel(buildPanel(t('welcomeTitle'), [el('div', { class: 'body center' }, [
            el('div', { class: 'store' + (full ? ' full' : '') }, [
                el('div', { class: 'big' }, '🦴 ' + n),
                el('div', { class: 'bar' }, el('i', { style: 'width:' + (cap > 0 ? Math.min(100, n / cap * 100) : 0) + '%' })),
                el('div', { class: 'note' }, full ? t('storeFull') : t('welcomeBody'))
            ]),
            a.finds.length ? el('div', { class: 'sub', style: 'padding:0 0 calc(var(--u)*8)' }, '🧭 ' + t('findsAway', { list: a.finds.map(findLabel).join(', ') })) : null,
            a.wolves ? el('div', { class: 'sub', style: 'padding:0 0 calc(var(--u)*10);font-weight:900;color:#2e7a8a' }, '🐺 ' + (a.wolves === 1 ? t('wolvesWaiting1') : t('wolvesWaiting', { n: a.wolves }))) : null,
            n >= 1 && P.adsAvailable() ? btn(t('collect2') + '  🦴 +' + 2 * n, 'pink', function () {
                rewarded('wtw-away2', function () { collect(2); closePanel(); });
            }, true) : null,
            n >= 1 && P.adsAvailable() ? el('div', { class: 'gap' }) : null,
            btn(n >= 1 ? t('collect') + '  🦴 +' + n : t('ok'), 'green', function () { if (n >= 1) collect(1); closePanel(); })
        ])], function () { wolvesCome(); if (then) then(); }));
    }
    /* the wolves that waited by the fire step out of the forest one after another */
    function wolvesCome() { if (S.waitVis > 0) S.nextVisit = Math.min(S.nextVisit || 0, Date.now() + 600); }
    /* the waiting wolves sit behind the one at the edge, eyes shining */
    var waitG = [];
    function drawWaiting(c, night) {
        var n = Math.min(WAIT_MAX, S.waitVis || 0);
        if (!n || scene !== 'camp') return;
        for (var i = 0; i < n; i++) {
            if (!waitG[i]) waitG[i] = { g: G.wild(G.rngFrom(4100 + i * 37)), seed: 900 + i, age: 1 };
            var side = i % 2 ? 1 : -1, x = LW / 2 + side * (130 + 70 * Math.floor(i / 2)), y = POS.edge.y - 18 + Math.sin(clock * 1.1 + i) * 3;
            c.save(); c.globalAlpha = 0.9 - night * 0.2;
            A.dog(c, waitG[i], x, y, 0.4, { t: clock + i, mood: 'scared', flip: side < 0 ? 1 : -1, lookX: -side * 0.6, wag: 0 });
            c.restore();
        }
    }

    /* ================================================================ the camp through the ages
     * Every chapter finished starts a new era of the settlement, the way people and dogs settled
     * down together. An era lets each building go one level further, and every level is a new
     * painting: hide tents become tepees, thatched huts, log cabins, stone cottages, village houses.
     * Homes spread along the forest edge, and the dogs sent to the village live there in sight. */
    function era() { return S ? Math.min(ERAS, S.ch + 1) : 1; }
    function capOf(key) { return Math.min(COST[key].length, era() + 1); }
    function lookKey(key, lv) { return LOOK[key][clamp(lv, 1, LOOK[key].length) - 1]; }
    function tierName(key, lv) { return t('tier' + key.charAt(0).toUpperCase() + key.slice(1) + clamp(lv, 1, LOOK[key].length)); }
    function canUpgrade(key) { var lv = S.up[key]; return lv < capOf(key) && S.bones >= COST[key][lv]; }
    function anyUpgrade() { return !!S && S.tut >= 6 && UPS.some(canUpgrade); }
    function backHomes() { return S ? clamp(S.up.huts - 2, 0, POS.village.length) : 0; }

    var build = null;                       // a building that has just gone up: { key, t }
    function popOf(key) {
        if (!build || build.key !== key) return 1;
        return 0.55 + 0.45 * easeOutBack(Math.min(1, build.t / 0.55));
    }
    /* a soft shadow on the ground under something standing there: it sits on the meadow, not on top of it */
    function groundShadow(c, x, y, rx, ry) {
        c.fillStyle = 'rgba(30,20,40,0.2)';
        c.beginPath(); c.ellipse(x, y, Math.max(1, rx), Math.max(1, ry), 0, 0, Math.PI * 2); c.fill();
    }
    /* the shadow of a painting h tall standing on (x, y) (mirrored with flip): a soft shade under its
       whole base and a darker line right where its walls meet the grass (js/bases.js). The painting
       covers the part under it, so it stands on the meadow instead of hovering over an oval.
       False when there is no base line for it. */
    function baseShadow(c, key, x, y, h, flip, pop) {
        var b = W.bases && W.bases[key], im = b && W.sprites && W.sprites.on && W.sprites.get(key);
        if (!im) return false;
        pop = pop || 1;
        var w = h * im.width / im.height, x0 = 1, x1 = 0, y0 = 1, y1 = 0, i;
        for (i = 0; i < b.length; i++) { x0 = Math.min(x0, b[i][0]); x1 = Math.max(x1, b[i][0]); y0 = Math.min(y0, b[i][1]); y1 = Math.max(y1, b[i][1]); }
        c.save();
        c.translate(x, y); c.scale(pop * (flip ? -1 : 1), pop);
        var rx = (x1 - x0) / 2 * w + h * 0.05, ry = (y1 - y0) / 2 * h + h * 0.05;
        c.save();
        c.translate(((x0 + x1) / 2 - 0.5) * w, ((y0 + y1) / 2 - 1) * h); c.scale(1, ry / rx);
        var g = c.createRadialGradient(0, 0, 0, 0, 0, rx);
        g.addColorStop(0, 'rgba(30,20,40,0.26)'); g.addColorStop(0.7, 'rgba(30,20,40,0.18)'); g.addColorStop(1, 'rgba(30,20,40,0)');
        c.fillStyle = g; c.beginPath(); c.arc(0, 0, rx, 0, Math.PI * 2); c.fill();
        c.restore();
        c.lineJoin = 'round'; c.lineCap = 'round';
        c.beginPath();
        for (i = 0; i < b.length; i++) { var px = (b[i][0] - 0.5) * w, py = (b[i][1] - 1) * h; if (i) c.lineTo(px, py); else c.moveTo(px, py); }
        [[0.075, 0.1], [0.045, 0.14], [0.02, 0.22]].forEach(function (L) { c.lineWidth = h * L[0]; c.strokeStyle = 'rgba(30,20,40,' + L[1] + ')'; c.stroke(); });
        c.restore();
        return true;
    }
    /* a building at a level, standing on y (mirrored on the right side), with its shadow; false while its painting loads */
    function building(c, key, x, y, s, flip, lv) {
        lv = lv || S.up[key];
        var im = W.sprites && W.sprites.on && W.sprites.get(lookKey(key, lv));
        if (!im) return false;
        var h = LOOK_H[key][lv - 1] * s, w = h * im.width / im.height, pop = popOf(key);
        if (!baseShadow(c, lookKey(key, lv), x, y, h, flip, pop)) groundShadow(c, x, y - 2, w * 0.46 * pop, Math.max(4, h * 0.07) * pop);
        c.save();
        c.imageSmoothingQuality = 'high';
        c.translate(x, y); c.scale(pop * (flip ? -1 : 1), pop);
        c.drawImage(im, -w / 2, -h, w, h);
        c.restore();
        return true;
    }
    /* the two homes either side of the fire: tents at first, then one painting per level */
    function homeH(lv) { return lv <= 1 ? 110 : LOOK_H.huts[lv - 1]; }
    function drawHome(c, right, night) {
        var lv = S ? S.up.huts : 1, p = right ? POS.tentR : POS.tentL;
        if (lv >= 2 && building(c, 'huts', p.x, p.y + 5, 1, right)) return;
        var s = right ? 0.8 : 0.9;                  // art.tent stands its painting on y + 6s, 122s tall
        if (!baseShadow(c, right ? 'tent_blue' : 'tent_red', p.x, p.y + 6 * s, 122 * s)) groundShadow(c, p.x, p.y + 4, right ? 62 : 70, 9);
        A.tent(c, p.x, p.y, s, right ? '#5aa7d8' : '#e0714f', night);
    }
    function drawFireBase(c) {
        if (S && S.up.fire >= 2 && building(c, 'fire', POS.fire.x, POS.fire.y + 46, 1)) return;
        A.campfire(c, POS.fire.x, POS.fire.y, 0.95);
    }
    function drawDen(c, night) {
        if (S && S.up.den >= 2 && building(c, 'den', POS.nest.x, POS.nest.y + 43, 0.9)) return;
        A.nest(c, POS.nest.x, POS.nest.y, 0.9, night);
    }
    /* the garland hangs between the homes' eaves, whatever they have become */
    function drawBunting(c, night) {
        var lv = S ? S.up.huts : 1, h = homeH(lv), k = lv <= 1 ? 0 : 1;
        var yl = k ? POS.tentL.y + 5 - h * 0.6 : POS.tentL.y - 100, yr = k ? POS.tentR.y + 5 - h * 0.6 : POS.tentR.y - 90;
        var xl = POS.tentL.x + (k ? h * 0.32 : 0), xr = POS.tentR.x - (k ? h * 0.32 : 0);
        A.bunting(c, xl, yl, xr, yr, clock, night);
    }

    /* paths worn between the homes, the fire and the forest from the second era on: drawn once into
       a canvas (it only changes with the era or the screen) */
    var pathArt = null;
    function drawPaths(c) {
        var e = era();
        if (!S || e < 2 || typeof document === 'undefined') return;
        var k = Math.min(2.5, c.getTransform ? c.getTransform().a : canvas.width / LW);
        // the paths' own canvas covers the game's width, or the spread-out camp on a wide screen
        var px0 = SPREAD === 1 ? 0 : Math.floor(X(0) - 120), pw = SPREAD === 1 ? LW : Math.ceil(X(1) + 120) - px0;
        if (!pathArt || pathArt.e !== e || pathArt.lh !== LH || Math.abs(pathArt.k - k) > 0.01 || pathArt.x0 !== px0 || pathArt.w !== pw) {
            var cv = document.createElement('canvas'); cv.width = Math.ceil(pw * k); cv.height = Math.ceil(LH * k);
            var pc = cv.getContext('2d'); pc.scale(k, k);
            if (px0) pc.translate(-px0, 0);
            var F = POS.fire, top = POS.horizon + 44;
            var lines = [
                [[LW * 0.5, top], [X(0.47), (top + F.y) / 2], [F.x, F.y - 30]],              // down from the forest
                [[POS.tentL.x + 30, POS.tentL.y + 4], [X(0.3), POS.tentL.y + 40], [F.x - 60, F.y + 6]],
                [[POS.tentR.x - 30, POS.tentR.y + 4], [X(0.7), POS.tentR.y + 44], [F.x + 60, F.y + 6]]
            ];
            if (e >= 4) lines.push([[F.x - 40, F.y + 40], [X(0.3), F.y + 70], [POS.nest.x + 40, POS.nest.y + 30]]);
            var stone = e >= 5;
            // a path is a chain of round dabs, narrower further away: a wide soft edge, then the trodden middle
            [[1.45, stone ? 'rgba(120,110,100,0.16)' : 'rgba(120,85,40,0.16)'], [1, stone ? 'rgba(214,206,190,0.62)' : 'rgba(222,190,128,0.55)']].forEach(function (L) {
                pc.fillStyle = L[1];
                lines.forEach(function (ln) {
                    for (var i = 0; i <= 60; i++) {
                        var u = i / 60, a = ln[0], b = ln[1], d = ln[2];
                        var x = (1 - u) * (1 - u) * a[0] + 2 * (1 - u) * u * b[0] + u * u * d[0];
                        var y = (1 - u) * (1 - u) * a[1] + 2 * (1 - u) * u * b[1] + u * u * d[1];
                        var r = (8 + 12 * clamp((y - POS.horizon) / (LH * 0.4), 0, 1)) * L[0];
                        pc.beginPath(); pc.ellipse(x, y, r, r * 0.55, 0, 0, Math.PI * 2); pc.fill();
                    }
                });
            });
            if (stone) {                                   // a few paving stones
                pc.fillStyle = 'rgba(160,150,140,0.5)';
                lines.forEach(function (ln) {
                    for (var i = 2; i < 60; i += 5) {
                        var u = i / 60, a = ln[0], b = ln[1], d = ln[2];
                        var x = (1 - u) * (1 - u) * a[0] + 2 * (1 - u) * u * b[0] + u * u * d[0] + (i % 2 ? 4 : -4);
                        var y = (1 - u) * (1 - u) * a[1] + 2 * (1 - u) * u * b[1] + u * u * d[1];
                        pc.beginPath(); pc.ellipse(x, y, 5, 3, 0, 0, Math.PI * 2); pc.fill();
                    }
                });
            }
            pathArt = { e: e, lh: LH, k: k, cv: cv, x0: px0, w: pw };
        }
        c.drawImage(pathArt.cv, px0, 0, pw, LH);
    }

    /* where a dog cannot stand: inside a building or a decoration */
    function footprints() {
        var f = [{ x: POS.tentL.x, y: POS.tentL.y - 12, rx: 78, ry: 30 }, { x: POS.tentR.x, y: POS.tentR.y - 12, rx: 78, ry: 30 },
            { x: POS.nest.x, y: POS.nest.y + 18, rx: 66, ry: 26 }, { x: POS.pantry.x, y: POS.pantry.y - 6, rx: 50, ry: 18 }];
        var D = POS.deco;
        if (hasDeco('doghouse')) f.push({ x: D.doghouse.x, y: D.doghouse.y - 4, rx: 56, ry: 20 });
        if (hasDeco('totem')) f.push({ x: D.totem.x, y: D.totem.y - 4, rx: 40, ry: 16 });
        if (hasDeco('statue')) f.push({ x: D.statue.x, y: D.statue.y - 4, rx: 46, ry: 18 });
        if (era() >= 5) f.push({ x: X(0.31), y: LH * 0.515 - 6, rx: 40, ry: 16 });
        return f;
    }
    function blocked(x, y) {
        return footprints().some(function (b) { var dx = (x - b.x) / b.rx, dy = (y - b.y) / b.ry; return dx * dx + dy * dy < 1; });
    }
    /* what each era adds around the camp: [painting, from era, x, y, height]; y below 1 is a fraction
       of the screen height, else pixels below the horizon */
    var PROPS = [
        ['sign', 2, 0.37, 178, 86], ['garden', 3, 0.2, 178, 58], ['fence', 4, 0.17, 90, 50], ['fence', 4, 0.83, 86, 50],
        ['well', 5, 0.31, 0.515, 96], ['flowers', 6, 0.33, 0.87, 62], ['flowers', 6, 0.66, 0.885, 62]
    ];
    var FLAT = { garden: 1, flowers: 1 };              // lie on the ground: no shadow, drawn under everything
    function propY(v) { return v < 1 ? LH * v : POS.horizon + v; }
    function drawProp(c, p) {
        var im = W.sprites && W.sprites.on && W.sprites.get(p[0]);
        if (!im) return;
        var x = X(p[2]), y = propY(p[3]), h = p[4], w = h * im.width / im.height;
        var pop = build && build.key === 'era' && p[1] === era() ? popOf('era') : 1;
        if (!FLAT[p[0]] && !baseShadow(c, p[0], x, y, h, false, pop)) groundShadow(c, x, y - 2, w * 0.42 * pop, Math.max(3, h * 0.06) * pop);
        c.save(); c.imageSmoothingQuality = 'high';
        c.translate(x, y); c.scale(pop, pop);
        c.drawImage(im, -w / 2, -h, w, h);
        if (p[0] === 'sign') {                      // the settlement's name on its sign
            var txt = t('era' + era());
            c.font = '900 ' + Math.round(h * 0.19) + 'px "Trebuchet MS", system-ui, sans-serif';
            var tw = c.measureText(txt).width, max = w * 0.84, k = tw > max ? max / tw : 1;
            c.translate(0, -h * 0.71); c.scale(k, k);
            c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#4a2c18';
            c.fillText(txt, 0, 0);
        }
        c.restore();
    }

    /* the village dogs, living at the forest edge */
    var vdogs = [];
    function syncVillage() {
        var list = villageDogs().slice(0, VILLAGE_SHOWN);
        vdogs = vdogs.filter(function (v) { return list.indexOf(v.d) >= 0; });
        list.forEach(function (d, i) {
            if (vdogs.some(function (v) { return v.d === d; })) return;
            var z = POS.vzone[i % 2];
            vdogs.push({ d: d, side: i % 2, x: z.x0 + Math.random() * (z.x1 - z.x0), y: POS.vy[0] + Math.random() * (POS.vy[1] - POS.vy[0]),
                tx: 0, ty: 0, st: 'idle', timer: Math.random() * 4, flip: Math.random() < 0.5 ? 1 : -1 });
        });
    }
    function updateVillageDogs(dt) {
        vdogs.forEach(function (v) {
            if (v.st === 'walk') {
                var dx = v.tx - v.x, dy = v.ty - v.y, dist = Math.hypot(dx, dy);
                if (dist < 3) { v.st = 'idle'; v.timer = 2 + Math.random() * 5; }
                else { v.x += dx / dist * 34 * dt; v.y += dy / dist * 34 * dt; if (Math.abs(dx) > 2) v.flip = dx < 0 ? -1 : 1; }
            } else if ((v.timer -= dt) <= 0) {
                var z = POS.vzone[v.side];
                v.tx = z.x0 + Math.random() * (z.x1 - z.x0); v.ty = POS.vy[0] + Math.random() * (POS.vy[1] - POS.vy[0]);
                v.st = 'walk';
            }
        });
    }
    /* behind the camp: homes at the forest edge, the village dogs and the era's things, back to front */
    function drawVillage(c, night) {
        if (!S) return;
        var items = [], lv = S.up.huts, n = backHomes(), e = era();
        for (var i = 0; i < n; i++) (function (p, flip) {
            items.push({ y: p.y, f: function () { building(c, 'huts', p.x, p.y, 0.62, flip, lv); } });
        })(POS.village[i], i % 2 === 1);
        PROPS.forEach(function (p) { if (e >= p[1] && propY(p[3]) < POS.campTop) items.push({ y: propY(p[3]), f: function () { drawProp(c, p); } }); });
        vdogs.forEach(function (v) {
            items.push({ y: v.y, f: function () {
                A.dog(c, { g: v.d.g, seed: v.d.seed, age: 1 }, v.x, v.y, 0.34, { t: clock, mood: 'calm', flip: v.flip, walk: v.st === 'walk', wag: 0.3 });
            } });
        });
        // the herders' goats rest in the village: two for every herder, at most four
        var herd = Math.min(4, 2 * villageDogs().filter(function (d) { return d.job === 'herder'; }).length);
        for (var gi = 0; gi < herd; gi++) (function (k) {
            var z = POS.vzone[k % 2], x = z.x0 + (z.x1 - z.x0) * (0.22 + 0.56 * ((k * 0.41 + 0.15) % 1)), y = POS.vy[0] + 14 + (k >> 1) * 24;
            items.push({ y: y, f: function () {
                groundShadow(c, x, y - 1, 14, 4);
                if (W.sprites && W.sprites.item) W.sprites.item(c, 'an_goat', x, y + Math.sin(clock * 2 + k) * 0.6, 34, { bottom: true, flip: k % 2 === 1 });
            } });
        })(gi);
        items.sort(function (a, b) { return a.y - b.y; }).forEach(function (it) { it.f(); });
    }
    /* the era's things in the camp itself (in front of the village): flat ones on the ground, the rest
       join the back-to-front list */
    function campProps(c, items) {
        var e = era();
        PROPS.forEach(function (p) {
            if (e < p[1] || propY(p[3]) < POS.campTop) return;
            if (FLAT[p[0]]) drawProp(c, p); else items.push({ y: propY(p[3]) - 6, f: function () { drawProp(c, p); } });
        });
    }
    /* what the village makes goes into the pantry: now and then a "+n" rises over it */
    var villageShown = 0, villageShowT = 0;
    function showVillageIncome(dt) {
        villageShowT += dt;
        if (villageShowT < 5 || villageShown < 3) return;
        villageShowT = 0;
        if (scene !== 'camp' || panelEl || !villageDogs().length) { villageShown = 0; return; }
        var p = bubblePos(true);
        FX.text(clamp(p.x + 70, XL + 70, XR - 70), p.y - 30, '+' + villageShown + ' 🦴', '#fff6a0', 24);
        villageShown = 0;
    }
    /* buy the next level: the panel closes and the new building goes up in the camp */
    function upgrade(key) {
        var lv = S.up[key];
        if (lv >= capOf(key)) { toast('🔒 ' + t('eraLocked')); return; }
        var cost = COST[key][lv];
        if (S.bones < cost) return;
        S.bones -= cost; S.up[key]++;
        if (key === 'fire') SFX.fireLevel(S.up.fire);
        closePanel(true);
        build = { key: key, t: 0 };
        var p = key === 'fire' ? POS.fire : key === 'den' ? POS.nest : key === 'pouch' ? POS.pantry : POS.tentL;
        SFX.play('coin'); later(0.12, function () { SFX.play('pop', 5); });
        FX.sparkle(p.x, p.y - 40, 26, '#fff6a0'); FX.confetti(p.x, p.y - 30, 30);
        if (key === 'huts') { FX.sparkle(POS.tentR.x, POS.tentR.y - 40, 20, '#fff6a0'); var b = POS.village[backHomes() - 1]; if (b && S.up.huts >= 3) FX.sparkle(b.x, b.y - 30, 16, '#fff6a0'); }
        FX.text(clamp(p.x, XL + 190, XR - 190), p.y - 150, t('built', { name: tierName(key, S.up[key]) }), '#ffe45c', 38);
        if (key === 'huts') syncVillage();
        emit('build');
        save(true); refreshHud();
    }

    /* ================================================================ ads */
    function rewarded(id, onEarn, onFail) {
        if (adBusy) return;
        if (!P.adsAvailable()) { toast(t('adNone')); if (onFail) onFail(); return; }
        adBusy = true; SFX.suspend(); toast(t('adLoading'));
        P.rewardedAd(id).then(function (res) {
            adBusy = false; if (!paused) SFX.resume(); lastAdAt = Date.now();
            if (res === 'earned') { onEarn(); save(true); }
            else { toast(res === 'dismissed' ? t('adDismissed') : t('adNone')); if (onFail) onFail(); }
        });
    }
    /* An interstitial at a natural break (a round, a taming or a litter has just ended, a chapter
       closes): at most every AD_GAP_MS, never in the tutorial or a session's first minutes.
       YouTube decides whether an ad really plays. then() runs after it, or at once. */
    function maybeInterstitial(then) {
        var go = function () { if (then) then(); };
        if (adBusy || !S || S.tut < 6 || !P.adsAvailable() || playMs < AD_FIRST_MS || Date.now() - lastAdAt < AD_GAP_MS) { go(); return; }
        adBusy = true; SFX.suspend();
        toast('📺 ' + t('adBreak'));
        P.interstitialAd().then(function (shown) {
            adBusy = false; if (!paused) SFX.resume();
            lastAdAt = shown ? Date.now() : Date.now() - AD_GAP_MS + 30000;   // none to show: try again at a later break
            go();
        });
    }

    /* ================================================================ drawing */
    function draw() {
        var c = ctx;
        viewTransform(c);
        if (inMini()) {                                   // a mini-game draws its own world
            miniEnv.LH = LH; miniEnv.clock = clock;
            miniDef.draw(c, miniS, miniEnv);
            FX.draw(c, 0, 'fx');
            return;
        }
        var night = nightAmt(), dusk = duskAmt(), fireLv = S ? S.up.fire : 1;
        A.world(c, LW, LH, clock, night, dusk, fireLv);
        drawPaths(c);
        drawVillage(c, night);
        // wolves that came while you were away wait at the forest edge, behind the one stepping out
        if (S) drawWaiting(c, night);
        // the visitor waits at the forest edge, on the path between the homes
        if (visitor && scene === 'camp') drawVisitorAtEdge(c, night);
        A.fireGlow(c, POS.fire.x, POS.fire.y - 30, 170 + fireLv * 25, clock, 0.5 + night * 0.6);

        // everything that stands in the camp, back to front: homes, decorations, the fire and the dogs
        // hide one another the way they stand (a dog behind a house is behind it)
        var items = [];
        items.push({ y: POS.tentL.y - 20, f: function () { drawHome(c, false, night); } });
        items.push({ y: POS.tentR.y - 20, f: function () { drawHome(c, true, night); } });
        if (S) items.push({ y: POS.pantry.y - 10, f: function () { building(c, 'pouch', POS.pantry.x, POS.pantry.y, 0.95); } });
        campProps(c, items);
        items.push({ y: POS.nest.y - 30, f: function () { drawDen(c, night); } });     // pups in the nest stand in front of it
        decoItems(c, night, items);
        items.push({ y: POS.fire.y + 20, f: function () { drawFireBase(c); A.flames(c, POS.fire.x, POS.fire.y - 6, 0.5 + fireLv * 0.07, clock); } });
        dogs.forEach(function (r) { items.push({ y: r.y, f: function () { drawCampDog(c, r); } }); });
        if (tame) items.push({ y: tame.y, f: function () { drawTameDog(c); } });
        items.sort(function (a, b) { return a.y - b.y; }).forEach(function (it) { it.f(); });

        FX.draw(c, night, 'fire');
        A.darkness(c, LW, LH, POS.fire.x, POS.fire.y - 40, FIRE_LIGHT[fireLv - 1] + 160 * (1 - night), night, clock);
        if (hasDeco('lanterns')) POS.deco.lanterns.forEach(function (p) { A.lanternGlow(c, p.x, p.y, 0.85, clock, night); });
        if (visitor && scene === 'camp') drawEyes(c, night);
        FX.draw(c, night, 'fx');
        if (S && scene === 'camp') drawStoreBubble(c);      // over the dark: always readable
        drawFlyBones(c);

        if (scene === 'tame' && tame) drawTameUi(c);
        if (scene === 'litter' && litter) drawLitter(c);
        if (scene === 'title') drawTitle(c);
        if (pointer) drawPointer(c);
    }

    function drawCampDog(c, r) {
        var d = r.d, s = campScale(r);
        var mood = r.st === 'sleep' ? 'sleep' : r.happy > 0 ? 'happy' : 'calm';
        A.dog(c, { g: d.g, seed: d.seed, age: ageOf(d) }, r.x, r.y, s, {
            t: clock, mood: mood, wag: r.wag, blink: r.blink, flip: r.flip, hop: r.hop,
            gaze: r.gaze, lookX: r.gaze > 0 ? 0 : r.flip * 0.4, brow: r.brow,
            walk: r.st === 'walk' && !(hold && hold.r === r)
        });
        r.gaze = Math.max(0, r.gaze - 0.02);
        if (r.st === 'sleep') zzz(c, r.x + 20 * s, r.y - 120 * s);
        if (hold && hold.r === r && hold.t > 0.35) ringMeter(c, r.x, r.y - 150 * s, hold.fill || 0);
    }

    function hasDeco(k) { return !!(S && S.deco && S.deco.indexOf(k) >= 0); }
    /* the journey's decorations, each with its shadow, into the back-to-front list */
    function decoItems(c, night, items) {
        if (!S || !S.deco || !S.deco.length) return;
        var D = POS.deco;
        // art.js stands each painting on y + 6s, its height times s (statue 205, totem 190, doghouse 132)
        var shade = function (k, p, s, hh, rx, ry) { if (!baseShadow(c, k, p.x, p.y + 6 * s, hh * s)) groundShadow(c, p.x, p.y + 3, rx, ry); };
        if (hasDeco('bunting')) items.push({ y: Math.max(POS.tentL.y, POS.tentR.y) - 19, f: function () { drawBunting(c, night); } });
        if (hasDeco('statue')) items.push({ y: D.statue.y - 4, f: function () { shade('statue', D.statue, 0.8, 205, 52, 9); A.statue(c, D.statue.x, D.statue.y, 0.8, clock, night); } });
        if (hasDeco('totem')) items.push({ y: D.totem.y - 4, f: function () { shade('totem', D.totem, 0.85, 190, 44, 8); A.totem(c, D.totem.x, D.totem.y, 0.85, clock, night); } });
        if (hasDeco('lanterns')) D.lanterns.forEach(function (p) { items.push({ y: p.y - 4, f: function () { groundShadow(c, p.x + 8, p.y + 2, 20, 5); A.lantern(c, p.x, p.y, 0.85, clock, night); } }); });
        if (hasDeco('doghouse')) items.push({ y: D.doghouse.y - 4, f: function () { shade('doghouse', D.doghouse, 0.85, 132, 62, 10); A.doghouse(c, D.doghouse.x, D.doghouse.y, 0.85, night); } });
    }
    function decoSpot(k) {
        var D = POS.deco;
        return k === 'bunting' ? { x: LW / 2, y: POS.tentL.y - 40 } : k === 'lanterns' ? { x: LW / 2, y: D.lanterns[0].y - 90 } :
            D[k] ? { x: D[k].x, y: D[k].y - 70 } : { x: LW / 2, y: LH / 2 };
    }
    function drawVisitorAtEdge(c, night) {
        var v = visitor;
        var peek = Math.sin(clock * 1.3) * 4;
        c.save();
        c.globalAlpha = 1 - night * 0.2;
        A.dog(c, v.d, v.x, v.y + peek, 0.5, { t: clock, mood: 'scared', lookX: v.x < LW / 2 ? 0.6 : -0.6, flip: v.x < LW / 2 ? 1 : -1, wag: 0 });
        c.restore();
    }
    function drawEyes(c, night) {
        var v = visitor;
        var pulse = 0.6 + 0.4 * Math.sin(clock * 5);
        var ex = v.x, ey = v.y - 52 + Math.sin(clock * 1.3) * 4;
        c.save();
        c.globalCompositeOperation = 'lighter';
        [-1, 1].forEach(function (sd) {
            var g = c.createRadialGradient(ex + sd * 12, ey, 0, ex + sd * 12, ey, 26);
            g.addColorStop(0, 'rgba(255,230,120,' + (0.85 * pulse * (0.3 + night)) + ')');
            g.addColorStop(1, 'rgba(255,200,80,0)');
            c.fillStyle = g; c.fillRect(ex + sd * 12 - 26, ey - 26, 52, 52);
        });
        c.restore();
        // tap target ring
        c.strokeStyle = 'rgba(255,240,180,' + (0.35 + 0.35 * pulse) + ')'; c.lineWidth = 5;
        c.setLineDash([12, 10]); c.lineDashOffset = -clock * 30;
        c.beginPath(); c.arc(v.x, v.y - 40, 70 + pulse * 6, 0, Math.PI * 2); c.stroke(); c.setLineDash([]);
        bubble(c, v.x, v.y - 140, v.kind ? t('visitorRare', { kind: t('kind' + v.kind.charAt(0).toUpperCase() + v.kind.slice(1)) }) : t('visitor'));
    }
    function drawTameDog(c) {
        var tm = tame, d = tm.v.d;
        var s = 0.72 * (0.82 + 0.3 * d.g.size) * depthN(tm.y);     // it grows as it comes out of the forest
        var moving = Math.hypot(tm.tx - tm.x, tm.ty - tm.y) > 3;
        var hop = moving ? Math.abs(Math.sin(tm.hopP || 0)) * 6 : 0;
        var flip = tm.tx < tm.x ? -1 : 1;
        var look = tm.phase === 'gaze' ? (tm.looking ? 0 : (Math.sin(clock * 0.7) > 0 ? 0.9 : -0.9)) : (POS.hand.x - tm.x) / 400;
        A.dog(c, d, tm.x + (tm.flinch > 0 ? Math.sin(clock * 60) * 4 : 0), tm.y, s, {
            t: clock, mood: tm.eatT > 0 ? 'happy' : tm.mood, flip: flip, hop: hop,
            lookX: look, lookY: tm.phase === 'gaze' && tm.looking ? 0.4 : -0.1,
            gaze: tm.phase === 'gaze' && tm.looking ? 1 : 0, wag: tm.trust * 0.7 + (tm.phase === 'bond' ? 1 : 0),
            away: tm.phase === 'gaze' && !tm.looking, walk: moving && !(tm.flinch > 0)
        });
    }
    function drawTameUi(c) {
        var tm = tame;
        if (tm.phase === 'approach' || tm.phase === 'walk' || tm.phase === 'eat') {
            var ring = ringPos(), pul = 0.5 + 0.5 * Math.sin(clock * 4);
            c.save();
            c.fillStyle = 'rgba(255,236,150,' + (0.12 + 0.08 * pul) + ')';
            c.beginPath(); c.arc(ring.x, ring.y, tm.ringR, 0, Math.PI * 2); c.fill();
            c.strokeStyle = 'rgba(255,236,150,' + (0.6 + 0.3 * pul) + ')'; c.lineWidth = 5; c.setLineDash([14, 9]); c.lineDashOffset = clock * 20;
            c.stroke(); c.setLineDash([]);
            c.fillStyle = 'rgba(255,245,200,0.5)';
            c.beginPath(); c.arc(ring.x, ring.y, tm.ringR * 0.4, 0, Math.PI * 2); c.fill();
            c.restore();
        }
        if (tm.dropped) { c.globalAlpha = Math.min(1, tm.dropped.t); A.treat(c, tm.dropped.x, tm.dropped.y, 1.1); c.globalAlpha = 1; }
        if (tm.goEat && tm.phase === 'walk') A.treat(c, tm.goEat.x, tm.goEat.y, 1.1);
        if (tm.flying) {
            var f = tm.flying, u = f.t / f.dur;
            var x = f.sx + (f.x - f.sx) * u, y = f.sy + (f.y - f.sy) * u - Math.sin(u * Math.PI) * 160;
            A.treat(c, x, y, 1.2);
        }
        // your hand and the pouch
        c.save();
        A.treat(c, POS.hand.x, POS.hand.y + 8, 1.5);
        c.font = '900 34px "Trebuchet MS", system-ui, sans-serif'; c.textAlign = 'center';
        c.lineWidth = 8; c.strokeStyle = A.INK; c.lineJoin = 'round';
        var label = '× ' + tm.treats;
        c.strokeText(label, POS.hand.x + 70, POS.hand.y + 20); c.fillStyle = '#fff4dc'; c.fillText(label, POS.hand.x + 70, POS.hand.y + 20);
        c.restore();
        if (tm.phase === 'approach' || tm.phase === 'walk' || tm.phase === 'eat') trustBar(c, tm.x, tm.y - 150, tm.trust, '#8fd3ff');
        if (tm.phase === 'gaze') {
            var s = 0.72;
            ringMeter(c, tm.x, tm.y - 165 * s, tm.fill);
            if (tm.looking) {
                c.save(); c.globalAlpha = 0.5 + 0.3 * Math.sin(clock * 10);
                c.strokeStyle = '#ffd1ea'; c.lineWidth = 6; c.beginPath(); c.arc(tm.x, tm.y - 70 * s, 95, 0, Math.PI * 2); c.stroke(); c.restore();
            }
        }
    }
    function trustBar(c, x, y, v, col) {
        c.save();
        A.roundRect(c, x - 70, y, 140, 18, 9); c.fillStyle = 'rgba(40,25,50,0.6)'; c.fill();
        A.roundRect(c, x - 68, y + 2, 136 * v, 14, 7); c.fillStyle = col; c.fill();
        A.roundRect(c, x - 70, y, 140, 18, 9); c.lineWidth = 3; c.strokeStyle = A.INK; c.stroke();
        c.restore();
    }
    function ringMeter(c, x, y, v) {
        c.save();
        c.beginPath(); c.arc(x, y, 30, 0, Math.PI * 2); c.fillStyle = 'rgba(40,25,50,0.6)'; c.fill();
        c.beginPath(); c.moveTo(x, y); c.arc(x, y, 30, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * v); c.closePath(); c.fillStyle = '#ff7fb4'; c.fill();
        c.beginPath(); c.arc(x, y, 30, 0, Math.PI * 2); c.lineWidth = 4; c.strokeStyle = A.INK; c.stroke();
        A.heart(c, x, y + 2, 1.05, '#ffffff');
        c.restore();
    }
    function zzz(c, x, y) {
        c.save(); c.font = '900 22px "Trebuchet MS", sans-serif'; c.fillStyle = 'rgba(255,255,255,0.8)';
        var k = (clock * 0.8) % 1;
        c.globalAlpha = 1 - k; c.fillText('z', x + k * 10, y - k * 24);
        c.globalAlpha = Math.max(0, 1 - ((k + 0.5) % 1)); c.fillText('Z', x + ((k + 0.5) % 1) * 12 + 8, y - ((k + 0.5) % 1) * 28 - 8);
        c.restore();
    }
    function bubble(c, x, y, str) {
        c.save();
        c.font = '900 26px "Trebuchet MS", system-ui, sans-serif';
        var w = c.measureText(str).width + 36;
        x = clamp(x, XL + w / 2 + 10, XR - w / 2 - 10);
        A.roundRect(c, x - w / 2, y - 26, w, 52, 24); c.fillStyle = '#fff8ec'; c.fill(); c.lineWidth = 4; c.strokeStyle = A.INK; c.stroke();
        c.fillStyle = '#5a3a2a'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(str, x, y + 1);
        c.restore();
    }
    function drawLitter(c) {
        var L = litter;
        c.fillStyle = 'rgba(25,15,45,0.55)'; c.fillRect(XL, 0, VW, LH);
        var cx = LW / 2;
        c.save();
        c.font = '900 64px "Trebuchet MS", system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.lineWidth = 12; c.strokeStyle = A.INK; c.lineJoin = 'round';
        var title = t('puppies'), ty = LH * 0.22 + Math.sin(clock * 3) * 4;
        c.strokeText(title, cx, ty); c.fillStyle = '#ffd23f'; c.fillText(title, cx, ty);
        c.font = '900 34px "Trebuchet MS", system-ui, sans-serif';
        var gl = t('generation', { n: L.gen }) + (L.newGen ? ' ★' : '');
        c.lineWidth = 8; c.strokeText(gl, cx, ty + 62); c.fillStyle = L.newGen ? '#9ff07a' : '#fff4dc'; c.fillText(gl, cx, ty + 62);
        c.restore();
        // soft spotlight
        var gr = c.createRadialGradient(cx, LH * 0.55, 20, cx, LH * 0.55, 380);
        gr.addColorStop(0, 'rgba(255,230,180,0.35)'); gr.addColorStop(1, 'rgba(255,230,180,0)');
        c.fillStyle = gr; c.fillRect(XL, LH * 0.2, VW, LH * 0.7);
        L.cards.forEach(function (cd) {
            var p = cd.p, k = cd.pop;
            var bounce = k < 1 ? Math.sin(k * Math.PI) * 30 : 0;
            var sc = 0.75 * (0.3 + 0.7 * easeOutBack(k));
            A.dog(c, { g: p.g, seed: p.seed, age: 0.25 }, cd.x, cd.y - bounce, sc, { t: clock, mood: 'happy', wag: 1, flip: 1, gaze: 0.6 });
            c.save(); c.font = '900 24px "Trebuchet MS", sans-serif'; c.textAlign = 'center';
            c.lineWidth = 6; c.strokeStyle = A.INK; c.lineJoin = 'round';
            c.strokeText(p.name, cd.x, cd.y + 34); c.fillStyle = '#fff'; c.fillText(p.name, cd.x, cd.y + 34);
            c.font = '900 22px "Trebuchet MS", sans-serif';
            var sx = p.g.sex === 'm' ? '♂' : '♀';
            c.strokeText(sx, cd.x, cd.y + 64); c.fillStyle = p.g.sex === 'm' ? '#8fc8ff' : '#ffa8d0'; c.fillText(sx, cd.x, cd.y + 64);
            if (cd.found) { A.star(c, cd.x + 44, cd.y - 110, 16 + Math.sin(clock * 6) * 3, '#ffe45c'); }
            if (cd.breed) {
                c.font = '900 20px "Trebuchet MS", sans-serif'; c.lineWidth = 6;
                var bl = stars(cd.breed);
                c.strokeText(bl, cd.x, cd.y + 92); c.fillStyle = '#ffd23f'; c.fillText(bl, cd.x, cd.y + 92);
            }
            c.restore();
        });
        if (L.finish) {
            c.save(); c.globalAlpha = 0.6 + 0.4 * Math.sin(clock * 4);
            c.font = '900 30px "Trebuchet MS", sans-serif'; c.textAlign = 'center'; c.fillStyle = '#fff';
            c.fillText('▶  ' + t('ok'), cx, LH * 0.8); c.restore();
        }
    }
    function easeOutBack(k) { var s = 1.7; k = k - 1; return k * k * ((s + 1) * k + s) + 1; }
    function drawTitle(c) {
        c.fillStyle = 'rgba(25,15,45,0.25)'; c.fillRect(XL, 0, VW, LH);
        var cx = LW / 2, y = LH * 0.2;
        c.save();
        c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round';
        c.font = '900 92px "Trebuchet MS", system-ui, sans-serif'; c.lineWidth = 16; c.strokeStyle = A.INK;
        var title = t('title');
        c.strokeText(title, cx, y + Math.sin(clock * 2) * 5);
        var gr = c.createLinearGradient(0, y - 40, 0, y + 40); gr.addColorStop(0, '#fff3a0'); gr.addColorStop(1, '#ff9f2e');
        c.fillStyle = gr; c.fillText(title, cx, y + Math.sin(clock * 2) * 5);
        c.font = '900 30px "Trebuchet MS", system-ui, sans-serif'; c.lineWidth = 8;
        c.strokeText(t('tagline'), cx, y + 80); c.fillStyle = '#fff8ec'; c.fillText(t('tagline'), cx, y + 80);
        c.restore();
        // wolf -> dog, side by side
        var wolf = { g: G.wild(G.rngFrom(7)), seed: 11, age: 1 };
        var dogG = { sex: 'f', tame: 90, ear: 3, tail: 2, snout: 0.3, eye: 0.85, round: 0.8, size: 0.4, coat: 'golden', pat: 'pie', fur: 'fluffy', eyeC: 'brown', brow: 1 };
        A.dog(c, wolf, cx - 150, LH * 0.56, 1.1, { t: clock, mood: 'calm', flip: 1, lookX: 0.5 });
        A.dog(c, { g: dogG, seed: 5, age: 1 }, cx + 150, LH * 0.56, 1.1, { t: clock, mood: 'happy', wag: 1, flip: -1, gaze: 1, brow: (Math.sin(clock * 2) + 1) / 2 });
        c.save(); c.font = '900 70px "Trebuchet MS", sans-serif'; c.textAlign = 'center'; c.fillStyle = '#fff8ec';
        c.lineWidth = 10; c.strokeStyle = A.INK; c.strokeText('→', cx, LH * 0.47); c.fillText('→', cx, LH * 0.47); c.restore();
        c.save(); c.globalAlpha = 0.65 + 0.35 * Math.sin(clock * 4);
        c.font = '900 36px "Trebuchet MS", sans-serif'; c.textAlign = 'center'; c.fillStyle = '#fff';
        c.lineWidth = 8; c.strokeStyle = A.INK; c.strokeText(t('tapStart'), cx, LH * 0.74); c.fillText(t('tapStart'), cx, LH * 0.74);
        c.restore();
    }

    /* tutorial finger */
    var pointer = null;
    function drawPointer(c) {
        var p = pointer === 'eyes' && visitor ? { x: visitor.x, y: visitor.y - 30 } :
            pointer === 'pup' ? (function () { var r = dogs.find(function (x) { return !x.d.adult; }); return r ? { x: r.x, y: r.y - 40 } : null; })() : null;
        if (!p) return;
        var k = (clock * 1.4) % 1;
        c.save(); c.translate(p.x + 30, p.y + 40 + Math.sin(k * Math.PI * 2) * 10);
        c.rotate(-0.5);
        c.beginPath(); A.roundRect(c, -12, -6, 24, 58, 12); c.fillStyle = '#fff8ec'; c.fill(); c.lineWidth = 4; c.strokeStyle = A.INK; c.stroke();
        c.beginPath(); c.arc(0, -4, 12, Math.PI, 0); c.fillStyle = '#fff8ec'; c.fill(); c.stroke();
        c.restore();
    }

    /* ================================================================ HTML: HUD + panels */
    function el(tag, attrs, kids) {
        var e = document.createElement(tag);
        if (attrs) Object.keys(attrs).forEach(function (k) {
            if (k === 'onclick') e.addEventListener('click', function (ev) { ev.stopPropagation(); SFX.play('tap'); attrs[k](ev); });
            else if (k === 'style') e.setAttribute('style', attrs[k]);
            else e.setAttribute(k, attrs[k]);
        });
        // children may come in nested lists (a list of unlocks inside a card): add them all
        (function add(list) {
            list.forEach(function (k) {
                if (k === null || k === undefined || k === false) return;
                if (Array.isArray(k)) { add(k); return; }
                e.appendChild(typeof k === 'string' || typeof k === 'number' ? document.createTextNode(String(k)) : k);
            });
        })(Array.isArray(kids) ? kids : kids !== undefined ? [kids] : []);
        return e;
    }
    function btn(label, color, fn, ad, disabled) {
        var b = el('button', { class: 'btn ' + (color || '') + ' wide', onclick: function () { if (!disabled) fn(); } }, [ad ? el('span', { class: 'ad' }, '▶ AD') : null, label]);
        if (disabled) b.disabled = true;
        return b;
    }
    function portrait(d, age, px, silhouette, code) {
        var cv = document.createElement('canvas');
        var w = px || 150, h = Math.round(w * 1.05);
        cv.width = w * 2; cv.height = h * 2;
        cv.style.width = '100%'; cv.style.height = 'auto'; cv.style.display = 'block';   // fit the card, whatever its size
        var c = cv.getContext('2d');
        c.scale(2, 2);
        var s = w / 190;
        A.dog(c, { g: d.g, seed: d.seed, age: age === undefined ? 1 : age }, w / 2, h - 12 * s - 6, s * 1.05, { t: 0.4, mood: 'happy', wag: 0.5, gaze: 0.6, brow: 1, code: !!code });
        if (silhouette) {                 // an undiscovered breed: only its outline
            c.globalCompositeOperation = 'source-atop';
            c.fillStyle = 'rgba(122,92,72,0.94)'; c.fillRect(0, 0, w, h);
        }
        return cv;
    }

    var hud = {};
    function buildHud() {
        uiEl.innerHTML = '';
        var top = el('div', { style: 'position:absolute;left:0;right:0;top:calc(var(--u)*18);display:flex;justify-content:space-between;align-items:flex-start;padding:0 calc(var(--u)*18);pointer-events:none' });
        hud.bones = el('div', { class: 'pill', style: pillCss() }, '');
        hud.mid = el('div', { style: pillCss() + 'flex-direction:column;gap:calc(var(--u)*4);min-width:calc(var(--u)*250)' }, '');
        var music = function () { S.music = !S.music; SFX.setMusic(S.music); save(); refreshHud(); }, right;
        if (P.setAudio) {
            // where the platform lets the game switch its sound (GameDistribution), a sound switch sits
            // next to the music one; on YouTube the player's own sound button does it
            hud.sound = el('button', { class: 'hb', onclick: function () { P.setAudio(!P.isAudioEnabled()); refreshHud(); } }, '');
            hud.music = el('button', { class: 'hb', onclick: music }, '');
            right = el('div', { style: pillCss() + 'pointer-events:auto;padding:calc(var(--u)*2) calc(var(--u)*8);gap:calc(var(--u)*2)' }, [hud.sound, hud.music]);
        } else right = hud.music = el('button', { style: pillCss() + 'pointer-events:auto;cursor:pointer;font-family:inherit', onclick: music }, '');
        top.appendChild(hud.bones); top.appendChild(hud.mid); top.appendChild(right);
        uiEl.appendChild(top);
        var nav = el('div', { class: 'navbar', style: 'position:absolute;left:0;right:0;bottom:calc(var(--u)*16);display:flex;justify-content:space-around;padding:0 calc(var(--u)*12)' });
        hud.nav = {};
        [['pack', '🐾', 'navPack', openPack], ['family', '❤️', 'navFamily', openFamily], ['play', '🎾', 'navPlay', openPlay],
            ['book', '📖', 'navBook', function () { openBook(); }], ['camp', '🔥', 'navCamp', openCamp]].forEach(function (n) {
            var lbl = el('div', { style: 'font-size:calc(var(--u)*21);font-weight:900;margin-top:calc(var(--u)*4)' }, '');
            var b = el('button', { style: navCss(), onclick: function () { if (scene === 'camp') n[3](); } }, [
                el('div', { style: 'font-size:calc(var(--u)*46);line-height:1' }, n[1]), lbl
            ]);
            b._label = n[2]; b._lbl = lbl; hud.nav[n[0]] = b; nav.appendChild(b);
        });
        hud.playLock = el('span', { class: 'lockn' }, '🔒');
        hud.nav.play.appendChild(hud.playLock);
        uiEl.appendChild(nav);
        hud.navBar = nav;
        hud.quest = el('button', { class: 'quest', onclick: function () { if (scene === 'camp') openJourney(); } }, '');
        uiEl.appendChild(hud.quest);
        hud.hint = el('div', { style: 'position:absolute;left:50%;transform:translateX(-50%);top:calc(var(--u)*176);max-width:calc(var(--u)*620);background:#fff8ec;border:calc(var(--u)*4) solid #5a3a2a;border-radius:calc(var(--u)*24);padding:calc(var(--u)*14) calc(var(--u)*22);font-weight:900;font-size:calc(var(--u)*26);color:#5a3a2a;text-align:center;display:none;pointer-events:none;box-shadow:0 calc(var(--u)*6) 0 rgba(0,0,0,.2)' });
        uiEl.appendChild(hud.hint);
        refreshHud();
    }
    function pillCss() {
        return 'display:flex;align-items:center;justify-content:center;gap:calc(var(--u)*10);background:rgba(255,248,236,.94);border:calc(var(--u)*4) solid #5a3a2a;border-radius:calc(var(--u)*30);padding:calc(var(--u)*8) calc(var(--u)*18);font-weight:900;font-size:calc(var(--u)*28);color:#5a3a2a;box-shadow:0 calc(var(--u)*5) 0 rgba(0,0,0,.18);';
    }
    function navCss() {
        return 'pointer-events:auto;cursor:pointer;width:calc(var(--u)*128);height:calc(var(--u)*116);border-radius:calc(var(--u)*30);border:calc(var(--u)*5) solid #5a3a2a;background:linear-gradient(180deg,#fff8ec,#ffd9a8);color:#5a3a2a;font-family:inherit;box-shadow:0 calc(var(--u)*7) 0 #a35a1c;display:flex;flex-direction:column;align-items:center;justify-content:center;position:relative';
    }
    function refreshHud() {
        if (!hud.bones || !S) return;
        hud.bones.textContent = '🦴 ' + Math.floor(S.bones) + (S.clover > 0 ? '  🍀' + S.clover : '') + (boostLeft() > 0 ? '  ⚡' : '');
        var bt = bestTame();
        hud.mid.innerHTML = '';
        hud.mid.appendChild(el('div', null, t('gen', { n: S.maxGen }) + ' · ' + t(G.stage(bt))));
        var bar = el('div', { class: 'bar', style: 'width:100%;height:calc(var(--u)*14)' }, el('i', { style: 'width:' + bt + '%' }));
        hud.mid.appendChild(bar);
        if (hud.sound) {                     // the music note fades out when the music is off
            var on = P.isAudioEnabled();
            hud.sound.textContent = on ? '🔊' : '🔇';
            hud.music.textContent = '🎵'; hud.music.style.opacity = S.music && on ? '1' : '0.35';
        } else hud.music.textContent = S.music ? '🎵' : '🔇';
        var hide = scene !== 'camp';
        hud.navBar.style.display = hide ? 'none' : 'flex';
        Object.keys(hud.nav).forEach(function (k) { hud.nav[k]._lbl.textContent = t(hud.nav[k]._label); });
        // badges: the Family button glows when a pair is ready
        var ready = pairReady();
        hud.nav.family.style.animation = ready && S.tut >= 3 ? 'none' : 'none';
        hud.nav.family.style.boxShadow = ready ? '0 calc(var(--u)*7) 0 #a35a1c, 0 0 0 calc(var(--u)*6) #ff7fb4' : '';
        if (S.tut === 3) hud.nav.family.style.transform = 'scale(' + (1.05 + 0.05 * Math.sin(Date.now() / 150)) + ')';
        else hud.nav.family.style.transform = '';
        var playOk = playOpen();
        hud.playLock.style.display = playOk ? 'none' : 'block';
        hud.nav.play.style.opacity = playOk ? '1' : '0.72';
        hud.nav.play.style.boxShadow = playOk && anyDogReady() ? '0 calc(var(--u)*7) 0 #a35a1c, 0 0 0 calc(var(--u)*6) #6ec6ff' : '';
        // the Camp button glows while a building can go up
        hud.nav.camp.style.boxShadow = anyUpgrade() ? '0 calc(var(--u)*7) 0 #a35a1c, 0 0 0 calc(var(--u)*6) #ffd23f' : '';
        refreshTracker();
    }

    /* ---- journey tracker: the next goal, always in sight ---- */
    function goalText(g) {
        if (g.target === 1) { var k1 = g.text + '1', s1 = t(k1); if (s1 !== k1) return s1; }
        return t(g.text, { n: g.target });
    }
    function fmtGoal(g, v) { return g.text === 'gTameness' ? pct(v) : String(v); }
    function dailyClaimable() {
        if (!S.unlocks.daily || !S.day || S.day.d !== Q.today()) return false;
        for (var i = 0; i < 3; i++) if (!S.day.got[i] && Q.dailyProgress(S, i) >= S.day.tasks[i].target) return true;
        return !S.day.chest && S.day.got.indexOf(0) < 0;
    }
    function refreshTracker() {
        var q = hud.quest;
        if (!q || !S) return;
        var show = scene === 'camp' && S.tut >= 6;
        q.style.display = show ? 'flex' : 'none';
        if (!show) return;
        var ch = Q.chapter(S), txt, ready = false;
        if (ch && Q.chapterComplete(S)) { txt = '⭐ ' + t('chapterDone'); ready = true; }
        else if (ch) {
            var g = Q.focus(S), p = Math.min(g.target, Q.progress(S, g));
            ready = p >= g.target;
            txt = (ready ? '✅ ' : '📜 ') + goalText(g) + (ready ? '' : '  ' + fmtGoal(g, p) + '/' + fmtGoal(g, g.target));
        } else if (S.unlocks.daily && S.day) {
            txt = '📅 ' + t('tabDaily') + '  ' + S.day.got.filter(Boolean).length + '/3'; ready = dailyClaimable();
        } else txt = '🏆 ' + t('journeyTitle');
        var key = txt + '|' + ready + '|' + (Q.giftDue(S) || dailyClaimable());
        if (q._key === key) return;               // nothing changed: keep the pulse running smoothly
        q._key = key;
        q.className = 'quest' + (ready ? ' ready' : '');
        q.innerHTML = '';
        q.appendChild(el('span', { class: 'qt' }, txt));
        if (Q.giftDue(S) || dailyClaimable()) q.appendChild(el('span', { class: 'dot' }, '🎁'));
    }
    /* count an event, then see whether any goal just got done */
    function emit(key, n) { Q.on(S, key, n); checkGoals(); }
    function checkGoals(silent) {
        if (!S) return;
        if (S.unlocks.daily) Q.ensureDaily(S, Math.random);
        var ready = Q.readyGoals(S).map(function (g) { return g.id; });
        // news waits while you are busy (taming, a litter, fetch, a tutorial hint)
        var calm = scene === 'camp' && S.tut >= 6 && hud.hint && hud.hint.style.display !== 'block';
        if (!silent && readyKnown && calm) {
            var fresh = ready.filter(function (id) { return readyKnown.indexOf(id) < 0; });
            if (fresh.length) {
                SFX.play('good');
                toast('✅ ' + t('goalDone'));
            }
        }
        if (silent || !readyKnown || calm) readyKnown = ready;
        refreshTracker();
    }
    function pairReady() {
        var ad = packDogs().filter(canBreed);
        return ad.some(function (d) { return d.g.sex === 'm'; }) && ad.some(function (d) { return d.g.sex === 'f'; }) && freeDen() > 0;
    }

    var hintTimer = null;
    function hint(text, ms, ptr) {
        if (!hud.hint) return;
        hud.hint.textContent = text; hud.hint.style.display = 'block';
        pointer = ptr || null;
        if (hintTimer) clearTimeout(hintTimer);
        if (ms) hintTimer = setTimeout(hideHint, ms);
    }
    function hideHint() { if (hud.hint) hud.hint.style.display = 'none'; pointer = null; }
    function toast(text) {
        var n = el('div', { class: 'toast' }, text);
        uiEl.appendChild(n);
        setTimeout(function () { if (n.parentNode) n.parentNode.removeChild(n); }, 2500);
    }

    var panelEl = null, panelOnClose = null;
    function buildPanel(title, kids, onClose) {
        return { title: title, kids: kids, onClose: onClose };
    }
    /* still: redraw an open panel in place (a tab switch, a claim) without the pop-in */
    function showPanel(p, still) {
        var scroll = still === true && panelEl ? panelEl.querySelector('.body') : null, top = scroll ? scroll.scrollTop : 0;
        closePanel(true);
        panelOnClose = p.onClose || null;
        panelEl = el('div', { class: 'panel-wrap' + (still ? ' still' : ''), onclick: function () { closePanel(); } }, [
            el('div', { class: 'panel' + (still ? ' still' : '') }, [
                el('h2', null, [p.title, el('button', { class: 'x', onclick: function () { closePanel(); } }, '×')])
            ].concat(p.kids))
        ]);
        panelEl.firstChild.addEventListener('click', function (e) { e.stopPropagation(); });
        uiEl.appendChild(panelEl);
        if (top) { var b = panelEl.querySelector('.body'); if (b) b.scrollTop = top; }
    }
    function tabs(list) {
        return el('div', { class: 'tabs' }, list.map(function (x) {
            return el('button', { class: 'tab' + (x.on ? ' on' : ''), onclick: x.fn }, [x.label, x.dot ? el('span', { class: 'dot' }) : null]);
        }));
    }
    function closePanel(silent) {
        if (panelEl && panelEl.parentNode) panelEl.parentNode.removeChild(panelEl);
        panelEl = null;
        var cb = panelOnClose; panelOnClose = null;
        if (cb && !silent) cb();
    }

    /* ---- the village: a dog moves there and takes the job its genes suit, or comes back ---- */
    function toVillage(d) {
        if (villageDogs().length >= hutCap()) { toast(t('villageEmpty')); return false; }
        var taken = {};
        villageDogs().forEach(function (v) { if (v.job && !J.isMaker(v.job)) taken[v.job] = 1; });
        d.role = 'village'; d.job = J.best(d.g, era(), taken);
        syncDogs(); save(true); refreshHud();
        toast(d.name + ': ' + J.job(d.job).icon + ' ' + jobName(d.job));
        return true;
    }
    function toPack(d) {
        if (packDogs().length >= denCap()) { toast(t('denNoRoom')); return false; }
        d.role = 'pack'; delete d.job;
        syncDogs(); save(true); refreshHud();
        return true;
    }
    /* the Village: the pantry, the jobs, the village dogs and the scouts' finds */
    function openVillage(still) {
        var vd = villageDogs(), e = era(), body = el('div', { class: 'body' });
        var n = Math.floor(S.store || 0), cap = storeCap(), full = storeFull();
        body.appendChild(el('div', { class: 'store' + (full ? ' full' : '') }, [
            el('div', { class: 'big' }, '🦴 ' + t('storeLine', { n: n, m: Math.floor(cap) })),
            el('div', { class: 'bar' }, el('i', { style: 'width:' + (cap > 0 ? Math.min(100, n / cap * 100) : 0) + '%' })),
            el('div', { class: 'note' }, !vd.length ? t('noVillage') : full ? t('storeFull') :
                t('storeHours', { h: hours(J.storeHours(S.up.pouch, vd)) }) + '  ·  +' + W.i18n.num(villageRate(), 1) + ' 🦴' + t('perMin') + boostNote()),
            el('div', { class: 'row' }, [
                btn(t('collect') + (n >= 1 ? '  🦴 +' + n : ''), n >= 1 ? 'green' : 'gray', function () { if (collect(1)) openVillage(true); }, false, n < 1),
                n >= 20 && P.adsAvailable() ? btn(t('collect2') + '  🦴 +' + 2 * n, 'pink', function () {
                    rewarded('wtw-store2', function () { collect(2); openVillage(true); });
                }, true) : null
            ])
        ]));
        var bb = boostBtn(function () { openVillage(true); });
        if (bb) body.appendChild(bb);
        // the jobs, in the order dogs took them on in history
        body.appendChild(el('div', { class: 'cat' }, t('jobsTitle')));
        body.appendChild(el('div', { class: 'sub', style: 'padding:0 0 calc(var(--u)*8)' }, t('jobsHint')));
        J.JOBS.forEach(function (j) {
            var open = j.era <= e, cnt = vd.filter(function (d) { return d.job === j.id; }).length;
            body.appendChild(el('div', { class: 'up job' + (open ? '' : ' lock') }, [
                el('div', { class: 'ic' }, j.icon),
                el('div', { class: 'tx' }, [
                    el('b', null, jobName(j.id)),
                    el('span', null, open ? t(jobKey(j.id) + 'D') : '🔒 ' + t('jobLocked', { n: j.era })),
                    open ? el('span', { class: 'why' }, '💡 ' + t(jobKey(j.id) + 'F')) : null
                ]),
                el('div', { class: 'n' }, open ? String(cnt) : '')
            ]));
        });
        // the village dogs at their jobs
        body.appendChild(el('div', { class: 'cat' }, t('dogsTitle') + '  ·  ' + t('villageDogsN', { n: vd.length, m: hutCap() })));
        if (vd.length) body.appendChild(el('div', { class: 'grid' }, vd.map(function (d) {
            var j = J.job(d.job);
            return el('div', { class: 'card', onclick: function () { openVillageDog(d); } }, [
                el('div', { class: 'job' }, j.icon),
                portrait(d, 1),
                el('div', { class: 'nm' }, d.name),
                el('div', { class: 'mt' }, jobName(j.id) + ' ' + '★★★'.slice(0, J.stars(J.fit(j.id, d.g))))
            ]);
        })));
        else body.appendChild(el('div', { class: 'sub', style: 'padding:0' }, t('noVillage')));
        // the scouts' finds: the history of dogs and people
        var got = J.FINDS.filter(function (f) { return S.finds[f]; }).length;
        body.appendChild(el('div', { class: 'cat' }, '🧭 ' + t('findsTitle', { n: got, m: J.FINDS.length }) + (S.museum ? '  🏛️' : '')));
        body.appendChild(el('div', { class: 'finds' }, J.FINDS.map(function (f) {
            var has = !!S.finds[f];
            return el('div', { class: 'f' + (has ? '' : ' no'), onclick: function () {
                if (has) findCard(f, null, false, function () { openVillage(); }); else toast(t('findUnknown'));
            } }, [el('img', { src: 'img/find_' + f + '.webp', alt: '' }), el('span', null, has ? t(findKey(f)) : '?')]);
        })));
        showPanel(buildPanel('🏡 ' + t('village'), [body]), still);
    }
    /* a village dog: the jobs it could do (its stars for each), or back to the pack */
    function openVillageDog(d) {
        var cur = J.job(d.job);
        var list = J.open(era()).map(function (j) {
            var on = j.id === cur.id;
            return btn(j.icon + ' ' + jobName(j.id) + '  ' + '★★★'.slice(0, J.stars(J.fit(j.id, d.g))) + (on ? '  ✓' : ''), on ? 'green' : 'blue', function () {
                if (!on) { d.job = j.id; save(true); toast(d.name + ': ' + j.icon + ' ' + jobName(j.id)); }
                openVillage();
            });
        });
        showPanel(buildPanel(t('jobPick', { name: d.name }), [el('div', { class: 'body' }, [
            el('div', { class: 'row' }, [
                el('div', { style: 'width:calc(var(--u)*200)' }, portrait(d, 1, 200)),
                el('div', { style: 'flex:1' }, [
                    el('div', { style: 'font-size:calc(var(--u)*26);font-weight:900;color:#5a3a2a' }, t('jobNow', { job: cur.icon + ' ' + jobName(cur.id) })),
                    el('div', { class: 'sub', style: 'padding:calc(var(--u)*6) 0 0;text-align:left' }, t(jobKey(cur.id) + 'D'))
                ])
            ]),
            el('div', { class: 'gap' }),
            el('div', { class: 'jobs' }, list),
            el('div', { class: 'gap' }),
            el('div', { class: 'row' }, [
                btn(t('backToPack'), 'gray', function () { if (toPack(d)) openVillage(); }),
                btn(t('back'), 'blue', function () { openVillage(); })
            ])
        ])]));
    }

    /* ---- Pack ---- */
    function openPack() {
        var pack = packDogs();
        var pups = pack.filter(function (d) { return !d.adult; });
        var grid = el('div', { class: 'grid' }, pack.map(function (d) {
            var b = B.of(d.g);
            return el('div', { class: 'card', onclick: function () { openDog(d); } }, [
                el('div', { class: 'sx ' + d.g.sex }, d.g.sex === 'm' ? '♂' : '♀'),
                portrait(d, ageOf(d)),
                el('div', { class: 'nm' }, d.name),
                b ? el('div', { class: 'br' }, stars(b) + ' ' + bname(b)) : null,
                el('div', { class: 'mt' }, d.adult ? ('♥ ' + G.cuteness(d.g) + ' · ' + pct(d.g.tame)) : (t('growing') + ' ' + pct(Math.round(ageOf(d) * 100))))
            ]);
        }));
        var vill = villageDogs().length, waiting = Math.floor(S.store || 0);
        showPanel(buildPanel(t('navPack') + '  ' + pack.length + '/' + denCap(), [
            el('div', { class: 'sub' }, t('village') + ': ' + vill + '/' + hutCap() + '  ·  +' + W.i18n.num(villageRate(), 1) + ' 🦴' + t('perMin') + boostNote()),
            el('div', { class: 'body' }, [
                // the village: its pantry and jobs
                btn('🏡 ' + t('village') + '  ' + vill + '/' + hutCap() + (waiting >= 1 ? '  ·  🦴 ' + waiting + (storeFull() ? ' ' + t('storeFullShort') : '') : ''), 'blue', function () { openVillage(); }),
                el('div', { class: 'gap' }),
                pups.length ? btn(t('growNow'), 'pink', function () {
                    rewarded('wtw-grow', function () { pups.forEach(function (d) { d.born = Date.now() - d.grow; }); closePanel(); });
                }, true, !P.adsAvailable()) : null,
                pups.length ? el('div', { class: 'gap' }) : null,
                grid
            ])
        ]));
    }

    function boostNote() { var b = boostLeft(); return b > 0 ? '  ·  ⚡×2 ' + t('mins', { n: Math.ceil(b / 60000) }) : ''; }
    /* rewarded: the village earns double for a while (only worth it with a village) */
    function boostBtn(reopen) {
        if (!villageDogs().length || boostLeft() > 0 || !P.adsAvailable()) return null;
        return el('div', null, [btn('⚡ ' + t('boostBtn'), 'pink', function () {
            rewarded('wtw-boost', function () { S.boostUntil = Date.now() + BOOST_MS; toast('⚡ ' + t('boostOn')); refreshHud(); reopen(); });
        }, true), el('div', { class: 'gap' })]);
    }

    /* ---- Dog card ---- */
    function openDog(d) {
        var tr = G.traits(d.g);
        var cute = G.cuteness(d.g);
        var br = B.of(d.g);
        var kids = [
            el('div', { class: 'body' }, [
                el('div', { class: 'row' }, [
                    el('div', { style: 'width:calc(var(--u)*230)' }, portrait(d, ageOf(d), 230)),
                    el('div', { style: 'flex:1' }, [
                        el('div', { style: 'font-size:calc(var(--u)*24);color:#8a6450;font-weight:900' }, (d.g.sex === 'm' ? '♂ ' : '♀ ') + t('gen', { n: d.gen || 1 }) + ' · ' + t(G.stage(d.g.tame))),
                        meter(t('tameness'), d.g.tame, 'tame'),
                        meter(t('cuteness'), cute, ''),
                        !d.adult ? el('div', { class: 'sub', style: 'padding:0' }, t('growing') + ' ' + pct(Math.round(ageOf(d) * 100))) : null,
                        br ? el('div', { class: 'breed' }, stars(br) + ' ' + bname(br)) : null
                    ])
                ]),
                el('div', { class: 'traits' }, tr.length ? tr.map(function (k) { return el('span', { class: 'chip' }, W.i18n.trait(k)); }) : [el('span', { class: 'chip' }, t('stageWolf'))]),
                el('div', { class: 'gap' }),
                d.adult ? btn(t('toVillage') + '  ' + J.job(J.best(d.g, era(), {})).icon, 'blue', function () {
                    if (toVillage(d)) closePanel();
                }, false, villageDogs().length >= hutCap()) : btn(t('growNow'), 'pink', function () {
                    rewarded('wtw-grow', function () { packDogs().forEach(function (p) { if (!p.adult) p.born = Date.now() - p.grow; }); closePanel(); });
                }, true, !P.adsAvailable())
            ])
        ];
        showPanel(buildPanel(d.name, kids));
    }
    function meter(label, v, cls) {
        return el('div', { class: 'meter' }, [el('span', { style: 'width:calc(var(--u)*150)' }, label), el('div', { class: 'bar ' + cls }, el('i', { style: 'width:' + v + '%' })), el('span', null, v + '')]);
    }

    /* ---- Family ---- */
    function openFamily() {
        var adults = packDogs().filter(function (d) { return d.adult; });
        var males = adults.filter(function (d) { return d.g.sex === 'm'; }), females = adults.filter(function (d) { return d.g.sex === 'f'; });
        if (!males.length || !females.length) { showPanel(buildPanel(t('familyTitle'), [el('div', { class: 'body' }, el('div', { class: 'sub' }, t('needTwo')))])); return; }
        var pick = { m: null, f: null };
        // preselect the tamest ready pair: the right move, and the tutorial one
        var byTame = function (a, b) { return b.g.tame - a.g.tame; };
        pick.m = males.filter(canBreed).sort(byTame)[0] || null;
        pick.f = females.filter(canBreed).sort(byTame)[0] || null;
        var body = el('div', { class: 'body' });
        function render() {
            body.innerHTML = '';
            ['m', 'f'].forEach(function (sx) {
                var list = sx === 'm' ? males : females;
                body.appendChild(el('div', { class: 'cat' }, sx === 'm' ? '♂' : '♀'));
                body.appendChild(el('div', { class: 'grid' }, list.map(function (d) {
                    var ok = canBreed(d);
                    return el('div', { class: 'card' + (pick[sx] === d ? ' sel' : '') + (ok ? '' : ' off'), onclick: function () { if (ok) { pick[sx] = d; render(); } } }, [
                        portrait(d, 1),
                        el('div', { class: 'nm' }, d.name),
                        el('div', { class: 'mt' }, ok ? (t('tameness') + ' ' + pct(d.g.tame)) : t('resting'))
                    ]);
                })));
            });
            body.appendChild(el('div', { class: 'gap' }));
            if (freeDen() < 1) {
                body.appendChild(el('div', { class: 'sub', style: 'padding:0 0 calc(var(--u)*12)' }, t('denFull')));
                // one tap: the least tame grown dog (not one you picked) moves to the village
                var spare = packDogs().filter(function (d) { return d.adult && d !== pick.m && d !== pick.f; })
                    .sort(function (a, b) { return a.g.tame - b.g.tame; })[0];
                if (spare && villageDogs().length < hutCap()) {
                    body.appendChild(btn(t('sendName', { name: spare.name }), 'blue', function () {
                        if (toVillage(spare)) render();
                    }));
                    body.appendChild(el('div', { class: 'gap' }));
                } else if (!spare || villageDogs().length >= hutCap()) {
                    body.appendChild(el('div', { class: 'sub', style: 'padding:0 0 calc(var(--u)*12)' }, t('villageEmpty')));
                }
            }
            var can = pick.m && pick.f && freeDen() > 0;
            if (pick.m && pick.f) body.appendChild(oddsBox(pick.m, pick.f));
            body.appendChild(btn(t('breed') + (S.lucky > 0 ? ' 🍀' : ''), 'green', function () { breedPair(pick.m, pick.f); }, false, !can));
            if (S.litters >= 1 && S.lucky <= 0 && S.clover > 0) {
                body.appendChild(el('div', { class: 'gap' }));
                body.appendChild(btn('🍀 ' + t('luckyClover') + '  (' + S.clover + ')', 'blue', function () {
                    S.clover--; S.lucky = 1; save(true); toast(t('luckyOn')); render(); refreshHud();
                }));
            }
            if (S.litters >= 1 && S.lucky <= 0) {
                body.appendChild(el('div', { class: 'gap' }));
                body.appendChild(btn(t('lucky'), 'pink', function () {
                    rewarded('wtw-lucky', function () { S.lucky = 1; toast(t('luckyOn')); render(); });
                }, true, !P.adsAvailable()));
            }
        }
        render();
        showPanel(buildPanel(t('familyTitle'), [el('div', { class: 'sub' }, t('familyPick')), body]));
    }
    /* What could this pair give? A quick Monte Carlo of the real breeding code. */
    function odds(a, b) {
        var r = G.rngFrom(((a.id * 7919) ^ (b.id * 104729) ^ (S.litters * 31)) >>> 0);
        var N = 160, boost = (S.litters < 6 ? 1.8 : 1) * (S.lucky > 0 ? 2 : 1);
        var bc = {}, newT = 0, tameSum = 0;
        for (var i = 0; i < N; i++) {
            var g = G.breed(a.g, b.g, r, boost);
            tameSum += g.tame;
            if (G.traits(g).some(function (k) { return !S.seen[k]; })) newT++;
            B.match(g).forEach(function (x) { bc[x.id] = (bc[x.id] || 0) + 1; });
        }
        var n = Math.max(1, Math.min(freeDen(), 4));             // about how many pups
        var inLitter = function (cnt) { return 1 - Math.pow(1 - cnt / N, n); };
        var list = Object.keys(bc).map(function (id) { return { b: B.byId(id), p: inLitter(bc[id]) }; })
            .filter(function (x) { return x.p >= 0.03; })
            .sort(function (x, y) { return (S.breeds[x.b.id] ? 1 : 0) - (S.breeds[y.b.id] ? 1 : 0) || y.p - x.p; })
            .slice(0, 4);
        // the first litters and lucky ones always bring a new trait
        var sure = (S.litters < 3 || S.lucky > 0) && G.TOTAL > Object.keys(S.seen).length;
        return { tame: Math.round(tameSum / N), newT: sure ? 1 : inLitter(newT), breeds: list };
    }
    function oddsBox(a, b) {
        var o = odds(a, b);
        return el('div', { class: 'odds' }, [
            el('div', null, [el('b', null, t('newChance') + ': '), pct(Math.round(o.newT * 100)),
                el('span', { style: 'float:right' }, [el('b', null, t('tameness') + ' ≈ '), pct(o.tame)])]),
            o.breeds.length ? el('div', { class: 'traits' }, [el('b', { style: 'align-self:center' }, t('couldMake') + ':')].concat(o.breeds.map(function (x) {
                var nw = !S.breeds[x.b.id];
                return el('span', { class: 'chip' + (nw ? ' new' : '') }, [stars(x.b) + ' ' + bname(x.b) + ' ' + pct(Math.round(x.p * 100)), nw ? el('span', { class: 'nb' }, t('newTag')) : null]);
            }))) : null
        ]);
    }

    /* ---- Book ---- */
    var SHOW = { sex: 'f', tame: 50, ear: 3, tail: 1, snout: 0.5, eye: 0.55, round: 0.55, size: 0.6, coat: 'sable', pat: 'none', fur: 'short', eyeC: 'brown', brow: 0 };
    function showcase(key) {
        var g = Object.assign({}, SHOW), p = key.split(':');
        if (key.indexOf('ear') === 0) g.ear = +key.slice(3);
        else if (key.indexOf('tail') === 0) { g.tail = +key.slice(4); }
        else if (p[0] === 'coat') g.coat = p[1];
        else if (p[0] === 'pat') { g.pat = p[1]; g.coat = p[1] === 'spots' ? 'white' : 'golden'; }
        else if (p[0] === 'fur') g.fur = p[1];
        else if (p[0] === 'eye') { g.eyeC = p[1]; g.eye = 0.8; }
        else if (key === 'face:bigeyes') g.eye = 0.95;
        else if (key === 'face:round') g.round = 1;
        else if (key === 'face:button') g.snout = 0.1;
        else if (key === 'face:tiny') g.size = 0;
        else if (key === 'brow') { g.brow = 1; g.eye = 0.8; }
        return { g: g, seed: key.length * 31 };
    }
    function openBook(tab, still) {
        tab = tab || 'traits';
        var count = Object.keys(S.seen).length, nb = Object.keys(S.breeds).length;
        var body = el('div', { class: 'body' });
        if (tab === 'traits') {
            body.appendChild(el('div', { class: 'sub', style: 'padding:0 0 calc(var(--u)*6)' }, t('bookCount', { a: count, b: G.TOTAL })));
            body.appendChild(el('div', { class: 'bar', style: 'margin-bottom:calc(var(--u)*6)' }, el('i', { style: 'width:' + (count / G.TOTAL * 100) + '%' })));
            G.CATALOG.forEach(function (cat) {
                body.appendChild(el('div', { class: 'cat' }, t(cat.cat)));
                body.appendChild(el('div', { class: 'tiles' }, cat.keys.map(function (k, i) {
                    var got = !!S.seen[k];
                    return el('div', { class: 'tile' + (got ? '' : ' lock') }, got ? [portrait(showcase(k), 1, 120, false, true), W.i18n.trait(k)] :
                        [el('div', { style: 'height:calc(var(--u)*110);display:flex;align-items:center;justify-content:center;font-size:calc(var(--u)*48)' }, '?'), t('needTame', { n: cat.tiers[i] })]);
                })));
            });
        } else {
            body.appendChild(el('div', { class: 'sub', style: 'padding:0 0 calc(var(--u)*6)' }, t('breedCount', { a: nb, b: B.LIST.length })));
            body.appendChild(el('div', { class: 'bar', style: 'margin-bottom:calc(var(--u)*12)' }, el('i', { style: 'width:' + (nb / B.LIST.length * 100) + '%' })));
            // found ones first, then the easiest to find
            var list = B.LIST.slice().sort(function (a, b) { return (S.breeds[b.id] ? 1 : 0) - (S.breeds[a.id] ? 1 : 0) || a.stars - b.stars; });
            body.appendChild(el('div', { class: 'btiles' }, list.map(function (b) {
                var got = !!S.breeds[b.id];
                return el('div', { class: 'btile' + (got ? '' : ' lock') }, [
                    el('div', { class: 'pic' }, portrait({ g: b.show, seed: b.id.length * 97 + b.stars }, 1, 150, !got)),
                    el('div', { class: 'stars' }, stars(b)),
                    el('div', { class: 'bn' }, bname(b)),
                    got ? el('div', { class: 'bd' }, bdesc(b)) :
                        el('div', { class: 'req' }, b.need.map(function (n) { return el('span', { class: n.k && S.seen[n.k] ? 'ok' : '' }, B.label(n)); }))
                ]);
            })));
        }
        showPanel(buildPanel(t('bookTitle'), [tabs([
            { label: t('tabTraits') + ' ' + count, on: tab === 'traits', fn: function () { openBook('traits', 'tab'); } },
            { label: t('tabBreeds') + ' ' + nb, on: tab === 'breeds', fn: function () { openBook('breeds', 'tab'); } }
        ]), body]), still);
    }

    /* ---- Camp: the buildings, each with its painting now and at the next level ---- */
    function thumb(key, lv, px) {
        var cv = document.createElement('canvas');
        cv.width = px * 2; cv.height = px * 2;
        cv.style.width = 'calc(var(--u)*' + px + ')'; cv.style.height = 'calc(var(--u)*' + px + ')';
        var k = lookKey(key, lv), im = W.sprites && W.sprites.get(k === 'tent' ? 'tent_red' : k);
        if (im) {
            var c = cv.getContext('2d'), s = Math.min(px * 2 / im.width, px * 2 / im.height) * 0.92, w = im.width * s, h = im.height * s;
            c.imageSmoothingQuality = 'high';
            c.drawImage(im, (px * 2 - w) / 2, (px * 2 - h) / 2, w, h);
        }
        return cv;
    }
    function openCamp() {
        var body = el('div', { class: 'body' }), e = era();
        body.appendChild(el('div', { class: 'era' }, [
            el('b', null, '🏕️ ' + t('eraN', { n: e }) + ': ' + t('era' + e)),
            e < ERAS ? el('span', null, t('eraNext', { e: t('era' + (e + 1)) }) + ' · ' + t('eraOpens', { n: Math.min(6, e + 2) })) : null
        ]));
        function row(key, name, desc) {
            var lv = S.up[key], max = lv >= COST[key].length, locked = !max && lv >= capOf(key), cost = max ? 0 : COST[key][lv];
            var can = !max && !locked && S.bones >= cost;
            return el('div', { class: 'up build' }, [
                el('div', { class: 'pics' }, [thumb(key, lv, 78), max ? null : el('span', { class: 'arrow' }, '▶'),
                    max ? null : el('div', { class: 'next' + (locked ? ' lock' : '') }, thumb(key, lv + 1, 78))]),
                el('div', { class: 'tx' }, [
                    el('b', null, name + '  ' + lv + (max ? ' · ' + t('max') : '')),
                    el('span', { class: 'tier' }, tierName(key, lv) + (max ? '' : ' → ' + tierName(key, lv + 1))),
                    el('span', null, desc)
                ]),
                el('button', { class: 'btn ' + (can ? 'green' : 'gray'), style: 'min-width:calc(var(--u)*138)', onclick: function () {
                    if (max) return;
                    if (locked) { toast('🔒 ' + t('eraLocked')); return; }
                    if (S.bones >= cost) upgrade(key);
                } }, max ? '✓' : locked ? '🔒 ' + t('eraN', { n: e + 1 }) : '🦴 ' + cost)
            ]);
        }
        body.appendChild(row('huts', t('upHuts'), t('upHutsD', { n: HUTS[Math.min(S.up.huts, HUTS.length - 1)] })));
        body.appendChild(row('fire', t('upFire'), t('upFireD')));
        body.appendChild(row('den', t('upDen'), t('upDenD', { n: DEN[Math.min(S.up.den, DEN.length - 1)] })));
        body.appendChild(row('pouch', t('upPouch'), t('upPouchD', { n: POUCH[Math.min(S.up.pouch, POUCH.length - 1)], h: hours(J.storeHours(Math.min(S.up.pouch + 1, POUCH.length), villageDogs())) })));
        var bb = boostBtn(openCamp);
        if (bb) body.appendChild(bb);
        if (S.tut >= 5) {
            body.appendChild(btn(t('rareBtn'), 'pink', function () {
                if (visitor || packDogs().length >= denCap()) { toast(visitor ? t('tapEyes') : t('denFull')); return; }
                rewarded('wtw-rare', function () { closePanel(); spawnVisitor(['white', 'black', 'red', 'gold'][Math.floor(Math.random() * 4)]); });
            }, true, !P.adsAvailable()));
        }
        showPanel(buildPanel(t('campTitle'), [el('div', { class: 'sub' }, '🦴 ' + Math.floor(S.bones)), body]));
    }

    /* ---- Journey: chapters of goals, the daily gift and daily tasks ---- */
    function openJourney(tab, still) {
        tab = tab || 'journey';
        var body = el('div', { class: 'body' });
        if (tab === 'journey') renderJourney(body); else renderDaily(body);
        showPanel(buildPanel(t('journeyTitle'), [tabs([
            { label: '📜 ' + t('tabJourney'), on: tab === 'journey', fn: function () { openJourney('journey', 'tab'); }, dot: Q.readyGoals(S).length > 0 || Q.chapterComplete(S) },
            { label: '🎁 ' + t('tabDaily'), on: tab === 'daily', fn: function () { openJourney('daily', 'tab'); }, dot: Q.giftDue(S) || dailyClaimable() }
        ]), body]), still);
    }
    function goalRow(text, p, target, fmt, bones, got, onClaim) {
        var done = p >= target;
        return el('div', { class: 'goal' + (got ? ' got' : done ? ' ready' : '') }, [
            el('div', { class: 'gt' }, [
                el('b', null, text),
                el('div', { class: 'row' }, [el('div', { class: 'bar' }, el('i', { style: 'width:' + Math.min(100, p / target * 100) + '%' })), el('span', null, fmt(p) + ' / ' + fmt(target))])
            ]),
            got ? el('div', { class: 'ok' }, '✓') :
                done ? el('button', { class: 'btn green', onclick: onClaim }, t('claim') + ' 🦴' + bones) :
                    el('div', { class: 'rw' }, '🦴 ' + bones)
        ]);
    }
    function renderJourney(body) {
        var ch = Q.chapter(S);
        if (!ch) { body.appendChild(el('div', { class: 'big', style: 'font-size:calc(var(--u)*30)' }, '🏆 ' + t('journeyDone'))); return; }
        var got = ch.goals.filter(function (g) { return S.claimed[g.id]; }).length;
        body.appendChild(el('div', { class: 'chead' }, [t('chapterN', { n: S.ch + 1 }) + ': ' + t(ch.id), el('span', null, got + ' / ' + ch.goals.length)]));
        // finishing the chapter moves the camp into its next era
        body.appendChild(el('div', { class: 'era' }, [el('b', null, '🏕️ ' + t('era' + era()) + '  ▶  ' + t('era' + (era() + 1))), el('span', null, t('eraOpens', { n: Math.min(6, era() + 2) }))]));
        ch.goals.forEach(function (g) {
            var p = Math.min(g.target, Q.progress(S, g));
            body.appendChild(goalRow(goalText(g), p, g.target, function (v) { return fmtGoal(g, v); }, g.bones, !!S.claimed[g.id], function () {
                var n = Q.claim(S, g.id);
                if (!n) return;
                SFX.play('coin'); toast('+' + n + ' 🦴');
                save(true); refreshHud(); checkGoals(true);
                openJourney('journey', true);
            }));
        });
        var deco = t('deco' + ch.deco.charAt(0).toUpperCase() + ch.deco.slice(1));
        body.appendChild(el('div', { class: 'chreward' }, t('reward') + ':  🦴 ' + ch.bones + '  ·  🍀 ' + ch.clover + '  ·  ' + deco));
        if (Q.chapterComplete(S)) body.appendChild(btn(t('nextChapter') + ' ▶', 'pink', finishChapter));
    }
    function finishChapter() {
        var ch = Q.advance(S);
        if (!ch) return;
        save(true);
        closePanel(true);
        refreshHud(); checkGoals(true);
        // the celebration happens in the camp itself, then the reward card
        var spot = decoSpot(ch.deco), e = era();
        SFX.play('bond'); SFX.play('newTrait');
        FX.text(LW / 2, LH * 0.3, t('chapterDone'), '#ffe45c', 58);
        for (var i = 0; i < 5; i++) later(i * 0.22, function () { FX.confetti(80 + Math.random() * (LW - 160), LH * 0.42, 45); });
        later(0.5, function () { FX.sparkle(spot.x, spot.y, 34, '#fff6a0'); SFX.play('pop', 6); });
        // a new era for the camp: what it brings pops up around the camp
        later(1.0, function () {
            build = { key: 'era', t: 0 };
            FX.text(LW / 2, LH * 0.38, '🏕️ ' + t('era' + e), '#fff6a0', 44);
            PROPS.forEach(function (p) { if (p[1] === e) FX.sparkle(X(p[2]), propY(p[3]) - p[4] / 2, 18, '#fff6a0'); });
        });
        later(1.8, function () {
            var deco = t('deco' + ch.deco.charAt(0).toUpperCase() + ch.deco.slice(1));
            showPanel(buildPanel(t('chapterDone'), [el('div', { class: 'body center' }, [
                el('div', { class: 'era', style: 'text-align:center' }, [
                    el('b', null, '🏕️ ' + t('newEra') + '  ' + t('eraN', { n: e }) + ': ' + t('era' + e)),
                    el('span', null, t('eraStory' + e)),
                    el('span', { style: 'color:#2e8a3a;font-weight:900' }, '🔨 ' + t('eraUnlocks', { n: Math.min(6, e + 1) }))
                ]),
                el('div', { class: 'big' }, '🦴 +' + ch.bones + '    🍀 +' + ch.clover),
                el('div', { class: 'sub', style: 'padding:calc(var(--u)*6) 0;font-size:calc(var(--u)*26);font-weight:900;color:#5a3a2a' }, '✨ ' + t('newInCamp', { d: deco })),
                // the era opens a new village job, the one dogs took on in that age
                J.JOBS.filter(function (j) { return j.era === e; }).map(function (j) {
                    return el('div', { class: 'sub', style: 'padding:calc(var(--u)*6) 0;font-size:calc(var(--u)*26);font-weight:900;color:#2e7a8a' }, j.icon + ' ' + t('newJob', { job: jobName(j.id) }));
                }),
                [].concat(ch.unlock || []).map(function (u) {
                    return el('div', { class: 'sub', style: 'padding:calc(var(--u)*6) 0;font-size:calc(var(--u)*26);font-weight:900;color:#2e8a3a' }, '🔓 ' + t('unlock' + u.charAt(0).toUpperCase() + u.slice(1)));
                }),
                el('div', { class: 'gap' }),
                // the new era's buildings are the first thing to look at
                btn('🔨 ' + t('buildNow'), 'pink', function () { maybeInterstitial(function () { openCamp(); }); }),
                el('div', { class: 'gap' }),
                btn(Q.chapter(S) ? t('nextChapter') + ' ▶' : t('ok'), 'green', function () {
                    maybeInterstitial(function () { if (Q.chapter(S)) openJourney(); else closePanel(true); });
                })
            ])], function () { maybeInterstitial(); }));
        });
    }
    function renderDaily(body) {
        // the gift: a streak of seven days
        var day = Q.giftDay(S), due = Q.giftDue(S);
        body.appendChild(el('div', { class: 'cat', style: 'margin-top:0' }, '🎁 ' + t('giftTitle')));
        body.appendChild(el('div', { class: 'days' }, Q.GIFT.map(function (b, i) {
            var n = i + 1, cls = n < day || (n === day && !due) ? ' done' : n === day ? ' now' : '';
            return el('div', { class: 'day' + cls }, [el('b', null, n === 7 ? '🍀' : '🦴'), cls === ' done' ? '✓' : String(b)]);
        })));
        var takeGift = function (twice) {
            var g = Q.takeGift(S);
            if (!g) return;
            if (twice) S.bones += g.bones;
            SFX.play('coin'); SFX.play('newTrait');
            toast('+' + g.bones * (twice ? 2 : 1) + ' 🦴' + (g.clover ? '  +1 🍀' : ''));
            save(true); refreshHud();
            openJourney('daily', true);
        };
        if (due) {
            body.appendChild(btn(t('take') + '  🦴 ' + Q.GIFT[day - 1] + (day === 7 ? ' + 🍀' : ''), 'green', function () { takeGift(false); }));
            if (P.adsAvailable()) {
                body.appendChild(el('div', { class: 'gap' }));
                body.appendChild(btn(t('takeX2') + '  🦴 ' + 2 * Q.GIFT[day - 1], 'pink', function () { rewarded('wtw-gift2', function () { takeGift(true); }); }, true));
            }
        }
        else body.appendChild(el('div', { class: 'sub center', style: 'padding:0' }, t('giftBody')));
        body.appendChild(el('div', { class: 'gap' }));
        // three small tasks a day, and a chest for doing all three
        body.appendChild(el('div', { class: 'cat' }, '📅 ' + t('tabDaily')));
        if (!S.unlocks.daily) { body.appendChild(el('div', { class: 'sub', style: 'padding:0' }, '🔒 ' + t('dailyLocked'))); return; }
        Q.ensureDaily(S, Math.random);
        S.day.tasks.forEach(function (tk, i) {
            body.appendChild(goalRow(t(tk.text, { n: tk.target }), Q.dailyProgress(S, i), tk.target, String, tk.bones, !!S.day.got[i], function () {
                var n = Q.claimDaily(S, i);
                if (!n) return;
                SFX.play('coin'); toast('+' + n + ' 🦴');
                save(true); refreshHud();
                openJourney('daily', true);
            }));
        });
        var all = S.day.got.indexOf(0) < 0;
        var openChest = function (twice) {
            if (!Q.claimChest(S)) return;
            if (twice) S.bones += 100;
            SFX.play('bond'); SFX.play('coin');
            toast('+' + (twice ? 200 : 100) + ' 🦴  +1 🍀');
            save(true); refreshHud();
            openJourney('daily', true);
        };
        body.appendChild(btn(S.day.chest ? '✓ ' + t('tomorrow') : '🧰 ' + t('dailyChest'), S.day.chest ? 'gray' : 'pink', function () { openChest(false); }, false, !all || !!S.day.chest));
        if (all && !S.day.chest && P.adsAvailable()) {
            body.appendChild(el('div', { class: 'gap' }));
            body.appendChild(btn('🧰 ' + t('chestX2'), 'pink', function () { rewarded('wtw-chest2', function () { openChest(true); }); }, true));
        }
    }

    /* ---- a new breed: its own card, when things are calm ---- */
    function showBreedCard(q) {
        var b = q.b;
        SFX.play('newTrait');
        showPanel(buildPanel(t('newBreed'), [el('div', { class: 'body center' }, [
            el('div', { style: 'width:calc(var(--u)*270);margin:0 auto' }, portrait(q.d, 1, 270)),
            el('div', { class: 'stars', style: 'font-size:calc(var(--u)*34)' }, stars(b)),
            el('div', { class: 'big' }, bname(b)),
            el('div', { class: 'sub', style: 'padding:calc(var(--u)*4) calc(var(--u)*10) calc(var(--u)*10)' }, bdesc(b)),
            el('div', { class: 'big', style: 'font-size:calc(var(--u)*32);color:#8a5a00' }, t('earned', { n: BREED_BONES[b.stars] })),
            el('div', { class: 'gap' }),
            btn(t('ok'), 'green', function () { closePanel(); })
        ])]));
    }

    /* ---- Play: the menu of mini-games, one round at a time ---- */
    function inMini() { return !!(miniS && miniDef && scene === miniDef.id); }
    function playOpen() { return S.tut >= 6; }                 // after the tutorial
    function anyDogReady() { return packDogs().some(function (d) { return d.adult && Date.now() >= (d.play || 0); }); }
    function miniList() { return MINI_ORDER.filter(function (id) { return MINI[id]; }).map(function (id) { return MINI[id]; }); }
    function miniOpen(m) { return !m.unlock || !!S.unlocks[m.unlock]; }
    function miniBest(m) { return m.id === 'fetch' ? (S.cnt.fetchBest || 0) : (S.cnt['best_' + m.id] || 0); }
    function miniPlays(m) { return m.id === 'fetch' ? (S.cnt.fetch || 0) : (S.cnt['plays_' + m.id] || 0); }
    /* how well a dog suits a game, from its genes: 1-5 stars */
    function skillStars(m, d) {
        var k = m.skill ? clamp(m.skill(d.g), 0, 1) : 0.5;
        var n = 1 + Math.round(k * 4);
        return '★★★★★'.slice(0, n) + '☆☆☆☆☆'.slice(0, 5 - n);
    }
    function openPlay() {
        if (!playOpen()) { toast('🔒 ' + t('playLocked')); return; }
        var cards = miniList().map(function (m) {
            var open = miniOpen(m), best = miniBest(m), at = Q.unlockChapter(m.unlock);
            return el('div', { class: 'card game' + (open ? '' : ' off'), onclick: function () {
                if (open) pickDog(m); else toast('🔒 ' + t('unlockAt', { n: at }));
            } }, [
                el('div', { class: 'gicon' }, open ? m.icon : '🔒'),
                el('div', { class: 'nm' }, t(m.title)),
                el('div', { class: 'mt' }, open ? (best ? t('best') + ' ' + best : (miniPlays(m) ? '—' : t('newTag'))) : t('unlockAt', { n: at }))
            ]);
        });
        showPanel(buildPanel('🎮 ' + t('playTitle'), [
            el('div', { class: 'sub' }, t('playSub')),
            el('div', { class: 'body' }, el('div', { class: 'grid g2' }, cards))
        ]));
    }
    function pickDog(m) {
        var adults = packDogs().filter(function (d) { return d.adult; });
        if (!adults.length) { toast(t('needAdult')); return; }
        // rested dogs first, the best suited of them on top
        adults.sort(function (a, b) {
            var ra = Date.now() >= (a.play || 0), rb = Date.now() >= (b.play || 0);
            if (ra !== rb) return ra ? -1 : 1;
            if (!ra) return (a.play || 0) - (b.play || 0);
            return (m.skill ? m.skill(b.g) - m.skill(a.g) : 0);
        });
        var ads = P.adsAvailable();
        var grid = el('div', { class: 'grid' }, adults.map(function (d) {
            var ok = Date.now() >= (d.play || 0);
            return el('div', { class: 'card' + (ok ? '' : ads ? ' tired' : ' off'), onclick: function () {
                if (ok) startMini(m, d); else if (ads) wakeDog(m, d); else toast(t('tired', { name: d.name }));
            } }, [
                portrait(d, 1),
                el('div', { class: 'nm' }, d.name),
                el('div', { class: 'mt' }, ok ? [el('span', { class: 'skill' }, skillStars(m, d)), m.tag ? ' ' + m.tag(d) : null] : '💤 ' + t('mins', { n: restMins(d) })),
                !ok && ads ? el('span', { class: 'wake' }, '▶ AD') : null
            ]);
        }));
        var best = miniBest(m);
        showPanel(buildPanel(m.icon + ' ' + t(m.title), [
            el('div', { class: 'sub' }, t('pickDogFor') + (best ? '   ·   ' + t('best') + ' ' + best : '')),
            m.skillText ? el('div', { class: 'sub', style: 'padding-top:calc(var(--u)*4)' }, '★ ' + t(m.skillText)) : null,
            el('div', { class: 'body' }, grid)
        ]));
    }
    function restMins(d) { return Math.max(1, Math.ceil(((d.play || 0) - Date.now()) / 60000)); }
    /* rewarded: wake a resting dog and play at once */
    function wakeDog(m, d) {
        showPanel(buildPanel('💤 ' + d.name, [el('div', { class: 'body center' }, [
            el('div', { style: 'width:calc(var(--u)*220);margin:0 auto' }, portrait(d, 1, 220)),
            el('div', { class: 'sub', style: 'padding:calc(var(--u)*6) calc(var(--u)*10) calc(var(--u)*12)' }, t('wakeText', { name: d.name, t: t('mins', { n: restMins(d) }) })),
            btn(t('wakeBtn'), 'pink', function () {
                rewarded('wtw-wake', function () { d.play = 0; startMini(m, d); });
            }, true),
            el('div', { class: 'gap' }),
            btn(t('back'), 'blue', function () { pickDog(m); })
        ])]));
    }
    function startMini(m, d) {
        closePanel(true);
        miniDef = m;
        miniEnv = {
            LW: LW, LH: LH, clock: clock, first: miniPlays(m) === 0, emit: emit, S: S,
            onCatch: function () { emit('catch'); }, onEnd: miniOver
        };
        miniS = m.start(d, miniEnv);
        scene = m.id; hold = null;
        hideHint(); refreshHud();
        SFX.play('bark');
    }
    function miniOver(G) {
        var m = miniDef;
        if (!m || miniS !== G) return;
        var bones = Math.max(5, Math.round(m.bones(G)));
        var before = miniBest(m), isBest = G.score > before;
        S.bones += bones;
        G.d.play = Date.now() + REST_MS;
        if (m.id === 'fetch') { Q.max(S, 'fetchBest', G.score); emit('fetch'); }
        else { Q.max(S, 'best_' + m.id, G.score); emit('plays_' + m.id); }
        emit('play');
        if (m.done) m.done(G, S);            // what the round leaves behind (a dog's vocabulary, ...)
        save(true); refreshHud();
        if (isBest && before > 0) { FX.confetti(LW / 2, LH * 0.3, 70); FX.text(LW / 2, LH * 0.36, t('best') + ' ★', '#ffe45c', 48); SFX.play('newTrait'); }
        later(0.7, function () { if (miniS === G) showMiniResult(G, bones, isBest); });
    }
    function showMiniResult(G, bones, isBest) {
        var m = miniDef, best = miniBest(m);
        showPanel(buildPanel(t('roundOver'), [el('div', { class: 'body center' }, [
            el('div', { class: 'big' }, t('score') + ' ' + G.score + (isBest ? ' ★' : '')),
            el('div', { class: 'sub', style: 'padding:0' }, t('best') + ' ' + best + '   ·   ' + m.stats(G)),
            m.extra ? el('div', { class: 'sub', style: 'padding:0;font-weight:900;color:#2e8a3a' }, m.extra(G)) : null,
            el('div', { class: 'big', style: 'color:#8a5a00' }, t('earned', { n: bones })),
            m.fact ? el('div', { class: 'fact' }, '💡 ' + t(m.fact)) : null,
            el('div', { class: 'gap' }),
            btn(t('doubleIt'), 'pink', function () {
                rewarded('wtw-' + m.id + '2', function () { S.bones += bones; toast(t('earned', { n: bones })); refreshHud(); endMini(); });
            }, true, !P.adsAvailable()),
            el('div', { class: 'gap' }),
            el('div', { class: 'row' }, [
                btn(t('playAgain'), 'green', function () {
                    endMini();
                    maybeInterstitial(function () { if (anyDogReady() || P.adsAvailable()) pickDog(m); else toast(t('allTired')); });
                }, false, !anyDogReady() && !P.adsAvailable()),
                btn(t('back'), 'blue', function () { endMini(); maybeInterstitial(); })
            ])
        ])], function () { endMini(); maybeInterstitial(); }));
    }
    function endMini() {
        closePanel(true);
        if (miniDef && miniDef.stop && miniS) miniDef.stop(miniS);
        miniS = null; miniDef = null; scene = 'camp';
        refreshHud(); checkGoals();
    }

    /* ================================================================ input */
    var down = null;
    canvas.addEventListener('pointerdown', function (e) {
        SFX.unlock();
        if (paused) return;
        var p = toLogical(e);
        down = { p: p, t: performance.now() };
        if (scene === 'title') { startGame(); return; }
        if (inMini()) { if (miniDef.down) miniDef.down(miniS, p, miniEnv); return; }
        if (scene === 'litter') { if (litter && litter.finish) endLitter(); else if (litter) litter.t = Math.min(litter.t, 0.15); return; }
        if (scene === 'tame' && tame) {
            if (tame.phase === 'approach') { if (p.y < POS.hand.y - 20) tossAt(p); }
            else if (tame.phase === 'gaze') {
                var s = 0.72;
                if (Math.hypot(p.x - tame.x, p.y - (tame.y - 70 * s)) < 140) tame.holding = true;
            }
            return;
        }
        if (scene === 'camp') {
            // the pantry's bubble: collect what the village made
            var bp = bubblePos();
            if (bp && Math.abs(p.x - bp.x) < 72 && Math.abs(p.y - bp.y) < 46) { collect(1); return; }
            if (visitor && Math.hypot(p.x - visitor.x, p.y - (visitor.y - 40)) < 95) { startTame(); return; }
            var r = dogAt(p);
            if (r) { hold = { r: r, t: 0, fill: 0 }; r.st = 'idle'; r.timer = 2; return; }
            // the pantry itself: collect, or look at the village when nothing waits
            if (onPantry(p) && S.tut >= 6) { if ((S.store || 0) >= 1) collect(1); else openVillage(); }
        }
    });
    canvas.addEventListener('pointermove', function (e) {
        if (paused || !inMini() || !miniDef.move) return;
        miniDef.move(miniS, toLogical(e), miniEnv);
    });
    window.addEventListener('pointerup', function (e) {
        if (inMini() && miniDef.up) miniDef.up(miniS, toLogical(e), miniEnv);
        if (tame) tame.holding = false;
        if (hold) {
            if (hold.t < 0.35) pet(hold.r);
            hold.r.gaze = 0;
            hold = null;
        }
        down = null;
    });
    window.addEventListener('pointercancel', function (e) {
        if (inMini() && miniDef.up) miniDef.up(miniS, toLogical(e), miniEnv);
        if (tame) tame.holding = false; hold = null;
    });

    /* ================================================================ loop */
    var last = 0, raf = 0, flameAcc = 0, flyAcc = 0, hudAcc = 0, goalAcc = 0;
    var lastFrameAt = 0;
    function frame(now) {
        raf = 0;
        lastFrameAt = performance.now();
        if (paused) return;
        // one bad frame must never freeze the game: report it and keep going
        try { step(now); }
        catch (e) { W._lastError = e; if (errCount++ < 5) P.logError(e); }
        schedule();
    }
    var errCount = 0;
    function step(now) {
        var dt = Math.min(0.05, (now - (last || now)) / 1000);
        last = now;
        clock += dt; playMs += dt * 1000;
        if (scene !== 'title') dayT += dt;          // the title always shows the golden sunset
        if (S && scene !== 'title') {
            runTimers();
            updateDogs(dt); updateVisits(dt); updateHold(dt); updateVillage(dt); updateVillageDogs(dt);
            if (build && (build.t += dt) > 1.2) build = null;
            if (scene === 'tame') updateTame(dt);
            if (scene === 'litter' && litter) updateLitter(dt);
            if (inMini()) { miniEnv.LH = LH; miniEnv.clock = clock; miniDef.update(miniS, dt, miniEnv); }
            hudAcc += dt;
            if (hudAcc > 0.25) { hudAcc = 0; if (S.tut === 3) refreshHud(); }
            goalAcc += dt;
            if (goalAcc > 1) {
                goalAcc = 0;
                checkGoals();
                // a new breed gets its own card once the camp is calm again
                if (breedQueue.length && scene === 'camp' && !panelEl && !hold && S.tut >= 6) showBreedCard(breedQueue.shift());
            }
        }
        var lv = S ? S.up.fire : 1;
        flameAcc += dt * (9 + lv * 2);
        while (flameAcc > 1) { flameAcc--; FX.flame(POS.fire.x, POS.fire.y - 8, 0.9 + lv * 0.12); }
        flyAcc += dt;
        if (flyAcc > 0.5) { flyAcc = 0; if (nightAmt() > 0.3) { if (XL === 0) FX.firefly(LW, LH); else FX.firefly(VW, LH, XL); } }
        FX.update(dt);
        draw();
    }
    function schedule() { if (!raf && !paused) raf = requestAnimationFrame(frame); }
    // insurance: if a frame request was ever lost, ask again (a hidden tab simply keeps waiting)
    setInterval(function () {
        if (S && !paused && performance.now() - lastFrameAt > 2000) {
            if (raf) cancelAnimationFrame(raf);
            raf = 0; schedule();
        }
    }, 1000);

    /* ================================================================ boot */
    function startGame() {
        scene = 'camp';
        SFX.setMusic(S.music);
        if (S.tut === 0) { scheduleVisit(1.2); dayT = DAY_S * 0.5; }
        // reloaded during the first litter's reveal: the pups are already in the den
        if (S.tut === 4) { S.tut = 5; hint(t('tut5'), 0, 'pup'); }
        if (S.tut === 3) hint(t('tut4'), 0, 'family');
        refreshHud();
        checkGoals(true);
        // back after a while: the pantry, the finds, the wolves at the fire; a new day: the gift is waiting
        var gift = function () { if (S.tut >= 6 && Q.giftDue(S)) later(0.5, function () { if (scene === 'camp' && !panelEl) openJourney('daily'); }); };
        later(1.2, function () {
            // the daily gift opens next; the scouts' find cards wait until it is up
            var after = function () { gift(); later(0.8, function () { welcomed = true; }); };
            if (scene === 'camp' && !panelEl) welcomeBack(after); else { away = null; wolvesCome(); after(); }
        });
    }
    function migrate(s) {
        var f = fresh();
        Object.keys(f).forEach(function (k) { if (s[k] === undefined) s[k] = f[k]; });
        s.dogs = (s.dogs || []).filter(function (d) { return d && d.g; });
        Q.init(s);
        // every trait and breed a dog carries belongs in the Book
        s.dogs.forEach(function (d) {
            G.traits(d.g).forEach(function (k) { if (!s.seen[k]) s.seen[k] = Date.now(); });
            B.match(d.g).forEach(function (b) { if (!s.breeds[b.id]) s.breeds[b.id] = Date.now(); });
        });
        // village dogs from before the jobs take the job their genes suit (the pantry starts empty)
        var e = Math.min(ERAS, (s.ch || 0) + 1), taken = {};
        s.dogs.forEach(function (d) { if (d.role === 'village' && d.job && !J.isMaker(d.job)) taken[d.job] = 1; });
        s.dogs.forEach(function (d) {
            if (d.role !== 'village' || d.job) return;
            d.job = J.best(d.g, e, taken);
            if (!J.isMaker(d.job)) taken[d.job] = 1;
        });
        return s;
    }

    // resizing clears the canvas: repaint at once instead of showing a blank frame
    window.addEventListener('resize', function () { layout(); if (S) draw(); });
    P.onPause(function () {
        paused = true; SFX.suspend();
        if (S) save(true);
    });
    P.onResume(function () {
        paused = false; last = 0; if (!adBusy) SFX.resume(); schedule();
    });
    SFX.setEnabled(P.isAudioEnabled());
    P.onAudioChange(function (on) { SFX.setEnabled(on !== false); });

    layout();
    // first frame: the camp at dusk while the save loads
    S = null;
    (function firstPaint() {
        viewTransform(ctx);
        A.world(ctx, LW, LH, 0, 0.6, 0.4, 1);
        requestAnimationFrame(function () { P.firstFrameReady(); if (W.sprites) W.sprites.start(); });
    })();

    Promise.all([P.load(), P.getLanguage()]).then(function (res) {
        W.i18n.set(/^tr\b/i.test(res[1] || '') ? 'tr' : 'en');
        S = res[0] && res[0].v === 1 ? migrate(res[0]) : fresh();
        Q.init(S);
        workWhileAway();
        S.lastSeen = Date.now();
        buildHud();
        syncDogs();
        SFX.setMusic(S.music);
        SFX.fireLevel(S.up.fire);
        // returning players skip the title
        if (S.tut > 0) startGame(); else scene = 'title';
        refreshHud();
        schedule();
        requestAnimationFrame(function () { requestAnimationFrame(function () { P.gameReady(); }); });
    }).catch(function (e) { P.logError(e); });

    // test hook (local only)
    W._debug = {
        get S() { return S; }, get scene() { return scene; }, get tame() { return tame; }, get visitor() { return visitor; }, get dogs() { return dogs; }, get LH() { return LH; }, get view() { return { XL: XL, XR: XR, VW: VW, SPREAD: SPREAD }; },
        get fetchRound() { return miniDef && miniDef.id === 'fetch' ? miniS : null; }, get mini() { return miniS; }, get miniId() { return miniDef ? miniDef.id : null; },
        get breedQueue() { return breedQueue; }, get panel() { return panelEl; }, get litter() { return litter; }, get clock() { return clock; }, get paused() { return paused; },
        get ads() { return { lastAdAt: lastAdAt, playMs: playMs, busy: adBusy }; }, setPlayMs: function (v) { playMs = v; }, setLastAd: function (v) { lastAdAt = v; },
        spawn: spawnVisitor, dayT: function (v) { dayT = v; }, journey: openJourney, play: openPlay, book: openBook, family: openFamily, refresh: refreshHud,
        camp: openCamp, upgrade: upgrade, sync: syncDogs, get era() { return era(); }, get vdogs() { return vdogs; }, finishChapter: finishChapter,
        get village() {
            return { store: S.store, cap: storeCap(), base: villageBase(), full: storeFull(), bubble: bubblePos(), flying: flyBones.length, waitVis: S.waitVis || 0 };
        },
        villageTick: villageTick, found: found, villageOpen: openVillage, collect: collect
    };
})();
