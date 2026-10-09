/* Wolf to Woof - genetics.
 *
 * Modelled on the Belyaev/Trut silver-fox experiment: the player only ever
 * selects for friendliness ("tame"), yet the "domestication syndrome" follows:
 * floppy ears, curled tails, new coat colours and patterns, shorter snouts,
 * bigger eyes and rounder faces. Each trait unlocks once the lineage is tame
 * enough and then appears by mutation and passes on to the pups.
 */
(function () {
    'use strict';
    var W = window.WTW = window.WTW || {};

    function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
    function gauss(r) { return (r() + r() + r() - 1.5) / 1.5; }   // ~N(0, 0.45), cheap

    /* minimum tameness for each trait value to be able to appear */
    var EAR_TIER = [0, 4, 22, 28, 48];                 // erect, tipped, folded, floppy, long floppy
    var TAIL_TIER = [0, 5, 26, 48];                    // straight, sickle, curly, double curl
    var COAT_TIER = { wild: 0, sable: 3, red: 6, black: 20, golden: 26, cream: 30, white: 40, choc: 44, blue: 52 };
    var PAT_TIER = { none: 0, mask: 4, saddle: 18, pie: 28, brindle: 40, merle: 50, tux: 60, spots: 66 };
    var FUR_TIER = { short: 0, fluffy: 24, wiry: 40, curly: 46 };
    var EYE_TIER = { amber: 0, brown: 3, hazel: 22, blue: 50, hetero: 70 };
    var BROW_TIER = 70;

    var CATALOG = [
        { cat: 'catEar', keys: ['ear1', 'ear2', 'ear3', 'ear4'], tiers: [4, 22, 28, 48] },
        { cat: 'catTail', keys: ['tail1', 'tail2', 'tail3'], tiers: [5, 26, 48] },
        { cat: 'catCoat', keys: ['coat:sable', 'coat:red', 'coat:black', 'coat:golden', 'coat:cream', 'coat:white', 'coat:choc', 'coat:blue'], tiers: [3, 6, 20, 26, 30, 40, 44, 52] },
        { cat: 'catPat', keys: ['pat:mask', 'pat:saddle', 'pat:pie', 'pat:brindle', 'pat:merle', 'pat:tux', 'pat:spots'], tiers: [4, 18, 28, 40, 50, 60, 66] },
        { cat: 'catFur', keys: ['fur:fluffy', 'fur:wiry', 'fur:curly'], tiers: [24, 40, 46] },
        { cat: 'catEye', keys: ['eye:brown', 'eye:hazel', 'eye:blue', 'eye:hetero'], tiers: [3, 22, 50, 70] },
        { cat: 'catFace', keys: ['face:bigeyes', 'face:round', 'face:button', 'face:tiny'], tiers: [20, 25, 40, 55] },
        { cat: 'catSpecial', keys: ['brow'], tiers: [70] }
    ];
    var TOTAL = CATALOG.reduce(function (n, c) { return n + c.keys.length; }, 0);

    function rngFrom(seed) {                     // mulberry32
        var a = seed >>> 0;
        return function () {
            a = (a + 0x6D2B79F5) >>> 0;
            var t = a;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    function pickUnlocked(tierMap, tame, current, r) {
        var opts = Object.keys(tierMap).filter(function (k) { return k !== current && tierMap[k] <= tame; });
        if (!opts.length) return current;
        // favour the most recently unlocked values: they are the exciting ones
        var w = opts.map(function (k) { return 1 + tierMap[k] / 25; });
        var sum = w.reduce(function (a, b) { return a + b; }, 0), x = r() * sum;
        for (var i = 0; i < opts.length; i++) { x -= w[i]; if (x <= 0) return opts[i]; }
        return opts[opts.length - 1];
    }

    /* A wild visitor at the edge of the firelight. */
    function wild(r, kind) {
        var g = {
            sex: r() < 0.5 ? 'm' : 'f',
            tame: 2 + Math.floor(r() * 7),
            ear: 0, tail: 0,
            snout: 0.86 + r() * 0.14,
            eye: 0.04 + r() * 0.12,
            round: 0.08 + r() * 0.14,
            size: 0.85 + r() * 0.15,
            coat: 'wild', pat: 'none', fur: 'short', eyeC: 'amber', brow: 0
        };
        // real wolf colour morphs: arctic white, black, red; "golden" is our fantasy rare
        if (kind === 'white') { g.coat = 'white'; g.tame += 6; }
        if (kind === 'black') { g.coat = 'black'; g.tame += 6; }
        if (kind === 'red') { g.coat = 'red'; g.tame += 8; }
        if (kind === 'gold') { g.coat = 'golden'; g.tame += 12; g.eye += 0.1; }
        return g;
    }

    /* Two parents make a pup. `boost` > 1 raises every mutation chance. */
    function breed(a, b, r, boost) {
        boost = boost || 1;
        var avg = function (k) { return (a[k] + b[k]) / 2; };
        // Domestic variants are dominant here: once a colour, a pattern or a floppy
        // ear appears in the line it spreads instead of washing out. (Many domestic
        // traits are dominant or polygenic; it also keeps progress visible.)
        var WILD = { coat: 'wild', pat: 'none', fur: 'short', eyeC: 'amber' };
        var pick = function (k) {
            var x = a[k], y = b[k];
            if (x === y) return x;
            var xDom = typeof x === 'number' ? x > y : (y === WILD[k] && x !== WILD[k]);
            var yDom = typeof y === 'number' ? y > x : (x === WILD[k] && y !== WILD[k]);
            if (xDom) return r() < 0.7 ? x : y;
            if (yDom) return r() < 0.7 ? y : x;
            return r() < 0.5 ? x : y;
        };
        // Tameness is heritable with some spread; the player's choice of the
        // friendliest parents does the selecting. The spread shrinks near 100.
        var ta = avg('tame');
        var tame = clamp(ta + (r() * 5 - 1.1) * (1.1 - ta / 100), 0, 100);
        var d = tame / 100;
        var chance = function (base) { return r() < Math.min(0.9, base * (0.6 + d) * boost); };
        var g = { sex: r() < 0.5 ? 'm' : 'f', tame: Math.round(tame) };

        // quantitative traits drift toward the "baby face" as tameness rises
        g.snout = clamp(avg('snout') + gauss(r) * 0.04 - 0.012 - 0.03 * d, 0.05, 1);
        g.eye = clamp(avg('eye') + gauss(r) * 0.04 + 0.012 + 0.03 * d, 0, 1);
        g.round = clamp(avg('round') + gauss(r) * 0.04 + 0.012 + 0.03 * d, 0, 1);
        g.size = clamp(avg('size') + gauss(r) * 0.05 - 0.02 * d, 0, 1);

        g.ear = pick('ear');
        if (g.ear < 4 && tame >= EAR_TIER[g.ear + 1] && chance(0.10)) g.ear++;
        g.tail = pick('tail');
        if (g.tail < 3 && tame >= TAIL_TIER[g.tail + 1] && chance(0.08)) g.tail++;
        g.coat = pick('coat');
        if (chance(0.06)) g.coat = pickUnlocked(COAT_TIER, tame, g.coat, r);
        // real litters come in mixed colours: now and then a pup shows another colour
        // the line can already carry, which keeps the camp colourful
        else if (r() < 0.14 + 0.1 * d) g.coat = pickUnlocked(COAT_TIER, tame, g.coat, r);
        g.pat = pick('pat');
        if (chance(0.06)) g.pat = pickUnlocked(PAT_TIER, tame, g.pat, r);
        else if (r() < 0.08 + 0.08 * d) g.pat = pickUnlocked(PAT_TIER, tame, g.pat, r);
        g.fur = pick('fur');
        if (chance(0.04)) g.fur = pickUnlocked(FUR_TIER, tame, g.fur, r);
        g.eyeC = pick('eyeC');
        if (chance(0.05)) g.eyeC = pickUnlocked(EYE_TIER, tame, g.eyeC, r);
        // the "puppy-dog eyes" brow muscle (Kaminski et al., PNAS 2019)
        g.brow = (a.brow || b.brow) ? (r() < 0.6 ? 1 : 0) : 0;
        if (!g.brow && tame >= BROW_TIER && chance(0.01)) g.brow = 1;
        return g;
    }

    /* Keys of every notable trait a genome shows (used by the Trait Book). */
    function traits(g) {
        var k = [];
        if (g.ear > 0) k.push('ear' + g.ear);
        if (g.tail > 0) k.push('tail' + g.tail);
        if (g.coat !== 'wild') k.push('coat:' + g.coat);
        if (g.pat !== 'none') k.push('pat:' + g.pat);
        if (g.fur !== 'short') k.push('fur:' + g.fur);
        if (g.eyeC !== 'amber') k.push('eye:' + g.eyeC);
        if (g.eye > 0.62) k.push('face:bigeyes');
        if (g.round > 0.62) k.push('face:round');
        if (g.snout < 0.38) k.push('face:button');
        if (g.size < 0.4) k.push('face:tiny');
        if (g.brow) k.push('brow');
        return k;
    }

    /* Force one trait the player has not seen yet (first litter, lucky litters). With `prefer`
       (key -> bool) the choice favours the traits it likes, when there are any: the game asks for
       the ones that change how the pup looks, so the first litters show the change. */
    function forceNew(g, seen, r, maxTier, prefer) {
        var cands = [];
        CATALOG.forEach(function (c) {
            c.keys.forEach(function (key, i) { if (!seen[key] && c.tiers[i] <= maxTier) cands.push(key); });
        });
        if (!cands.length) return false;
        if (prefer) { var liked = cands.filter(prefer); if (liked.length) cands = liked; }
        var key = cands[Math.floor(r() * cands.length)];
        apply(g, key);
        return key;
    }
    /* give a genome one trait of the catalogue */
    function apply(g, key) {
        var p = key.split(':');
        if (key.indexOf('ear') === 0) g.ear = Math.max(g.ear, +key.slice(3));
        else if (key.indexOf('tail') === 0) g.tail = Math.max(g.tail, +key.slice(4));
        else if (p[0] === 'coat') g.coat = p[1];
        else if (p[0] === 'pat') g.pat = p[1];
        else if (p[0] === 'fur') g.fur = p[1];
        else if (p[0] === 'eye') g.eyeC = p[1];
        else if (key === 'face:bigeyes') g.eye = Math.max(g.eye, 0.66);
        else if (key === 'face:round') g.round = Math.max(g.round, 0.66);
        else if (key === 'face:button') g.snout = Math.min(g.snout, 0.34);
        else if (key === 'face:tiny') g.size = Math.min(g.size, 0.36);
        else if (key === 'brow') g.brow = 1;
        return key;
    }

    /* Baby-schema score 0-100 (big eyes, short snout, round head, small body...). */
    function cuteness(g) {
        var fur = { short: 0, fluffy: 1, curly: 0.8, wiry: 0.45 }[g.fur] || 0;
        var pat = { none: 0, mask: 0.4, saddle: 0.5, pie: 0.9, merle: 0.9, brindle: 0.6, spots: 1, tux: 0.8 }[g.pat] || 0;
        var v = 0.24 * g.eye + 0.18 * (1 - g.snout) + 0.14 * g.round + 0.10 * (1 - g.size) +
            0.12 * (g.ear / 4) + 0.08 * fur + 0.06 * pat + 0.08 * g.brow;
        return Math.round(clamp(v, 0, 1) * 100);
    }

    function stage(tame) {
        return tame < 20 ? 'stageWolf' : tame < 45 ? 'stageWolfdog' : tame < 75 ? 'stageDog' : 'stageFriend';
    }

    W.gen = {
        wild: wild, breed: breed, traits: traits, forceNew: forceNew, applyTrait: apply,
        cuteness: cuteness, stage: stage, rngFrom: rngFrom,
        CATALOG: CATALOG, TOTAL: TOTAL, clamp: clamp
    };
})();
