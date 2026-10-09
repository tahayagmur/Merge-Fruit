/* Wolf to Woof - village jobs: the idle side of the game.
 * Every dog sent to the village takes the job its genes suit, the way the mini-games favour some
 * genes: a big dog hunts, a long snout scouts, a cute face looks after the pups, a tame dog herds,
 * upright ears keep watch. Jobs open era by era, in the order dogs took them on in history. What the
 * village earns piles up in the pantry until you come and collect it; a full pantry stops the work. */
(function () {
    'use strict';
    var W = window.WTW = window.WTW || {};
    function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
    function cute(g) { return W.gen.cuteness(g); }

    // the era each job opens in, its icon, how well a genome suits it (0-1) and the bones it brings
    // against the dog's base (villagers share more with a cute dog, as they always did)
    var JOBS = [
        { id: 'hunter', era: 1, icon: '🍖', fit: function (g) { return clamp(g.size, 0, 1); }, mul: function (f) { return 0.7 + 0.6 * f; } },
        { id: 'scout', era: 2, icon: '👃', fit: function (g) { return clamp(g.snout, 0, 1); }, mul: function () { return 0.5; } },
        { id: 'nanny', era: 3, icon: '🍼', fit: function (g) { return clamp(cute(g) / 100, 0, 1); }, mul: function () { return 0.5; } },
        { id: 'herder', era: 4, icon: '🐐', fit: function (g) { return clamp(g.tame / 100, 0, 1); }, mul: function (f) { return 0.8 + 0.8 * f; } },
        { id: 'guard', era: 5, icon: '🛡️', fit: function (g) { return clamp(1 - g.ear / 4, 0, 1); }, mul: function () { return 0.5; } }
    ];
    var BY = {};
    JOBS.forEach(function (j) { BY[j.id] = j; });
    var MAKERS = { hunter: 1, herder: 1 };          // the jobs that are about bones; the others do something else
    // the scout's finds, oldest first: the history of dogs and people
    var FINDS = ['mammoth', 'flint', 'tooth', 'sled', 'rock', 'grain', 'collar', 'vase', 'tile'];
    var STORE_H = [3, 4, 6, 8];                     // hours of work the pantry holds, by its level

    function open(era) { return JOBS.filter(function (j) { return j.era <= era; }); }
    function job(id) { return BY[id] || BY.hunter; }
    function fit(id, g) { return job(id).fit(g); }
    function stars(f) { return f >= 0.7 ? 3 : f >= 0.4 ? 2 : 1; }
    function base(g) { return 1 + cute(g) / 30; }
    /* bones a minute from one village dog at its job. The bone jobs pay by fit on top of the dog's
       base; the other jobs do their own work and bring only a little on the side, so even a very
       cute nanny brings fewer bones than a hunter */
    function rate(d) {
        var j = job(d.job);
        return MAKERS[j.id] ? base(d.g) * j.mul(j.fit(d.g)) : j.mul() * (1 + cute(d.g) / 90);
    }
    /* the job a newcomer takes: the best bone job, unless it is clearly made for a job nobody does yet */
    function best(g, era, taken) {
        var prod = null, spec = null;
        open(era).forEach(function (j) {
            var f = j.fit(g);
            if (MAKERS[j.id]) { var v = j.mul(f); if (!prod || v > prod.v) prod = { id: j.id, v: v, f: f }; }
            else if (!(taken && taken[j.id]) && (!spec || f > spec.f)) spec = { id: j.id, f: f };
        });
        return spec && spec.f >= 0.6 && spec.f > prod.f + 0.15 ? spec.id : prod.id;
    }
    function sum(dogs, id, per) {
        return dogs.reduce(function (s, d) { return s + (d.job === id ? per(fit(id, d.g)) : 0); }, 0);
    }
    /* nannies: pups grow and tired dogs rest this much faster (0.5 = half again as fast), at most twice */
    function nanny(dogs) { return Math.min(1, sum(dogs, 'nanny', function (f) { return 0.3 * (0.5 + f); })); }
    /* guards: extra hours the pantry holds, at most 4 */
    function guardHours(dogs) { return Math.min(4, sum(dogs, 'guard', function (f) { return 0.5 + f; })); }
    function storeHours(pouch, dogs) { return STORE_H[clamp(pouch, 1, STORE_H.length) - 1] + guardHours(dogs); }
    /* a scout's chance a minute to dig something up (one find in about half an hour for a good nose) */
    function findChance(d) { return d.job === 'scout' ? 0.025 * (0.5 + fit('scout', d.g)) : 0; }
    /* what a scout finds: a piece of history the village has not got yet, a clover, or a cache of bones */
    function roll(finds, rnd, era) {
        var r = rnd(), missing = FINDS.filter(function (f) { return !(finds && finds[f]); });
        if (r < 0.25 && missing.length) return { kind: 'find', id: missing[Math.floor(rnd() * missing.length)] };
        if (r < 0.5) return { kind: 'clover' };
        return { kind: 'cache', n: 15 + 5 * era + Math.floor(rnd() * 10) };
    }

    W.jobs = {
        JOBS: JOBS, FINDS: FINDS, STORE_H: STORE_H, open: open, job: job, fit: fit, stars: stars, base: base, rate: rate, best: best,
        nanny: nanny, guardHours: guardHours, storeHours: storeHours, findChance: findChance, roll: roll,
        isMaker: function (id) { return !!MAKERS[id]; }
    };
})();
