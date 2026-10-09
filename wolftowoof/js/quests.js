/* Wolf to Woof - the journey (chapters of goals), daily tasks and the daily gift.
 * Counters grow with game events; a chapter's counting goals start from the
 * counter values the chapter began with, state goals read the save directly.
 * Every chapter finished also starts the camp's next era (game.js), so from chapter 2 on one
 * goal is to build that era's homes, den or fire. */
(function () {
    'use strict';
    var W = window.WTW = window.WTW || {};

    function bestTame(S) { return S.dogs.reduce(function (m, d) { return Math.max(m, d.g.tame); }, 0); }
    function nVillage(S) { return S.dogs.filter(function (d) { return d.role === 'village'; }).length; }
    function nTraits(S) { return Object.keys(S.seen).length; }
    function nBreeds(S) { return Object.keys(S.breeds || {}).length; }

    // c: counter goal (events since the chapter started); s: state goal (reads the save)
    function c(id, key, target, bones, text) { return { id: id, key: key, target: target, bones: bones, text: text }; }
    function s(id, fn, target, bones, text) { return { id: id, fn: fn, target: target, bones: bones, text: text }; }

    var CHAPTERS = [
        { id: 'ch1', deco: 'bunting', bones: 150, clover: 1, unlock: 'scent', goals: [
            c('c1a', 'tame', 3, 30, 'gTame'),
            c('c1b', 'litter', 1, 30, 'gLitter'),
            c('c1c', 'grow', 3, 40, 'gGrow'),
            c('c1d', 'pet', 15, 30, 'gPet'),
            s('c1e', nTraits, 5, 50, 'gTraits'),
            s('c1f', function (S) { return S.up.den; }, 2, 40, 'gDen')
        ] },
        { id: 'ch2', deco: 'doghouse', bones: 250, clover: 2, unlock: ['daily', 'eyes'], goals: [
            c('c2a', 'fetch', 3, 50, 'gFetch'),
            c('c2b', 'catch', 5, 50, 'gCatch'),
            c('c2c', 'tameNight', 1, 60, 'gTameNight'),
            s('c2d', nBreeds, 1, 80, 'gBreeds'),
            s('c2e', bestTame, 20, 80, 'gTameness'),
            s('c2f', nVillage, 2, 60, 'gVillage'),
            s('c2g', function (S) { return S.up.huts; }, 3, 60, 'gHuts')
        ] },
        { id: 'ch3', deco: 'lanterns', bones: 400, clover: 2, unlock: 'howl', goals: [
            s('c3a', bestTame, 35, 100, 'gTameness'),
            s('c3b', nBreeds, 3, 120, 'gBreeds'),
            s('c3c', nTraits, 12, 100, 'gTraits'),
            s('c3d', function (S) { return S.up.fire; }, 3, 100, 'gFire'),
            s('c3e', function (S) { return S.cnt.fetchBest || 0; }, 60, 100, 'gFetchScore'),
            c('c3f', 'tameRare', 1, 120, 'gTameRare'),
            s('c3g', function (S) { return S.up.den; }, 4, 100, 'gDen')
        ] },
        { id: 'ch4', deco: 'totem', bones: 600, clover: 3, goals: [
            s('c4a', bestTame, 55, 150, 'gTameness'),
            s('c4b', function (S) { return S.bestCute; }, 60, 150, 'gCute'),
            s('c4c', nBreeds, 6, 180, 'gBreeds'),
            s('c4d', nTraits, 20, 150, 'gTraits'),
            c('c4e', 'litter', 15, 150, 'gLitter'),
            s('c4f', nVillage, 8, 150, 'gVillage'),
            s('c4g', function (S) { return S.up.huts; }, 5, 150, 'gHuts')
        ] },
        { id: 'ch5', deco: 'statue', bones: 1000, clover: 5, goals: [
            s('c5a', bestTame, 80, 250, 'gTameness'),
            s('c5b', nBreeds, 10, 250, 'gBreeds'),
            s('c5c', nTraits, 28, 250, 'gTraits'),
            s('c5d', function (S) { return S.seen.brow ? 1 : 0; }, 1, 300, 'gBrow'),
            s('c5e', function (S) { return S.bestCute; }, 85, 300, 'gCute'),
            s('c5f', nBreeds, 15, 400, 'gBreeds'),
            s('c5g', function (S) { return S.up.fire; }, 5, 250, 'gFire')
        ] }
    ];

    var DAILY_POOL = [
        { key: 'tame', target: 2, bones: 50, text: 'gTame' },
        { key: 'litter', target: 2, bones: 60, text: 'gLitter' },
        { key: 'fetch', target: 2, bones: 50, text: 'gFetch' },
        { key: 'pet', target: 20, bones: 40, text: 'gPet' },
        { key: 'gaze', target: 3, bones: 50, text: 'gGaze' },
        { key: 'grow', target: 3, bones: 50, text: 'gGrow' },
        { key: 'catch', target: 6, bones: 60, text: 'gCatch' },
        { key: 'play', target: 3, bones: 60, text: 'gPlay' }
    ];
    var GIFT = [40, 60, 90, 120, 160, 220, 300];
    function unlocksOf(ch) { return [].concat(ch.unlock || []); }

    function dayStr(d) { return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
    function today() { return dayStr(new Date()); }
    function yesterday() { var y = new Date(); y.setDate(y.getDate() - 1); return dayStr(y); }

    var Q = {
        CHAPTERS: CHAPTERS,
        GIFT: GIFT,
        init: function (S) {
            if (!S.cnt) S.cnt = {};
            if (!S.breeds) S.breeds = {};
            if (S.ch === undefined) S.ch = 0;
            if (!S.chBase) S.chBase = {};
            if (!S.claimed) S.claimed = {};
            if (!S.deco) S.deco = [];
            if (S.clover === undefined) S.clover = 0;
            if (!S.unlocks) S.unlocks = {};
            // what finished chapters open (also for saves from before a chapter's reward changed)
            for (var i = 0; i < Math.min(S.ch, CHAPTERS.length); i++) unlocksOf(CHAPTERS[i]).forEach(function (u) { S.unlocks[u] = 1; });
        },
        /* the chapter (1-based) whose reward opens `key` */
        unlockChapter: function (key) {
            for (var i = 0; i < CHAPTERS.length; i++) if (unlocksOf(CHAPTERS[i]).indexOf(key) >= 0) return i + 1;
            return 0;
        },
        chapter: function (S) { return CHAPTERS[S.ch] || null; },
        progress: function (S, goal) {
            if (goal.fn) return goal.fn(S);
            return (S.cnt[goal.key] || 0) - (S.chBase[goal.key] || 0);
        },
        done: function (S, goal) { return Q.progress(S, goal) >= goal.target; },
        /* An event happened: count it. Returns the goals that just became complete. */
        on: function (S, key, n) {
            var ch = Q.chapter(S);
            var before = ch ? ch.goals.filter(function (g) { return !S.claimed[g.id] && Q.done(S, g); }).map(function (g) { return g.id; }) : [];
            S.cnt[key] = (S.cnt[key] || 0) + (n === undefined ? 1 : n);
            if (S.day && S.day.d === today()) S.day.prog[key] = (S.day.prog[key] || 0) + (n === undefined ? 1 : n);
            return Q.newlyDone(S, before);
        },
        max: function (S, key, v) { S.cnt[key] = Math.max(S.cnt[key] || 0, v); },
        newlyDone: function (S, before) {
            var ch = Q.chapter(S);
            if (!ch) return [];
            return ch.goals.filter(function (g) { return !S.claimed[g.id] && Q.done(S, g) && before.indexOf(g.id) < 0; });
        },
        readyGoals: function (S) {
            var ch = Q.chapter(S);
            return ch ? ch.goals.filter(function (g) { return !S.claimed[g.id] && Q.done(S, g); }) : [];
        },
        /* the goal shown in the HUD: something to claim, else the closest one to finish */
        focus: function (S) {
            var ch = Q.chapter(S);
            if (!ch) return null;
            var open = ch.goals.filter(function (g) { return !S.claimed[g.id]; });
            var ready = open.filter(function (g) { return Q.done(S, g); });
            if (ready.length) return ready[0];
            return open.sort(function (a, b) { return Q.progress(S, b) / b.target - Q.progress(S, a) / a.target; })[0] || null;
        },
        claim: function (S, id) {
            var ch = Q.chapter(S);
            var g = ch && ch.goals.find(function (x) { return x.id === id; });
            if (!g || S.claimed[id] || !Q.done(S, g)) return 0;
            S.claimed[id] = 1;
            S.bones += g.bones;
            return g.bones;
        },
        chapterComplete: function (S) {
            var ch = Q.chapter(S);
            return !!ch && ch.goals.every(function (g) { return S.claimed[g.id]; });
        },
        /* finish the chapter: reward, decoration, unlock; the next one starts counting now */
        advance: function (S) {
            var ch = Q.chapter(S);
            if (!ch || !Q.chapterComplete(S)) return null;
            S.bones += ch.bones; S.clover += ch.clover;
            if (ch.deco && S.deco.indexOf(ch.deco) < 0) S.deco.push(ch.deco);
            unlocksOf(ch).forEach(function (u) { S.unlocks[u] = 1; });
            S.ch++;
            S.chBase = JSON.parse(JSON.stringify(S.cnt));
            return ch;
        },

        /* ---- daily ---- */
        today: today,
        ensureDaily: function (S, rnd) {
            var d = today();
            if (S.day && S.day.d === d) return false;
            var pool = DAILY_POOL.slice(), tasks = [];
            while (tasks.length < 3 && pool.length) tasks.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]);
            S.day = { d: d, tasks: tasks, prog: {}, got: [0, 0, 0], chest: 0 };
            return true;
        },
        dailyProgress: function (S, i) { var tk = S.day.tasks[i]; return Math.min(tk.target, S.day.prog[tk.key] || 0); },
        claimDaily: function (S, i) {
            var tk = S.day.tasks[i];
            if (S.day.got[i] || Q.dailyProgress(S, i) < tk.target) return 0;
            S.day.got[i] = 1; S.bones += tk.bones;
            return tk.bones;
        },
        claimChest: function (S) {
            if (S.day.chest || S.day.got.indexOf(0) >= 0) return false;
            S.day.chest = 1; S.bones += 100; S.clover += 1;
            return true;
        },
        /* the daily gift: a streak of 7 */
        giftDue: function (S) { return !S.gift || S.gift.last !== today(); },
        /* which day of the streak today's gift is (or was, once taken) */
        giftDay: function (S) {
            if (!Q.giftDue(S)) return S.gift.streak;
            return S.gift && S.gift.last === yesterday() ? (S.gift.streak % 7) + 1 : 1;
        },
        takeGift: function (S) {
            if (!Q.giftDue(S)) return null;
            var streak = Q.giftDay(S);
            S.gift = { last: today(), streak: streak };
            var bones = GIFT[streak - 1];
            S.bones += bones;
            if (streak === 7) S.clover += 1;
            return { streak: streak, bones: bones, clover: streak === 7 };
        }
    };
    W.quests = Q;
})();
