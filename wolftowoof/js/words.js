/* Wolf to Woof - Word Genius. A child asks for toys by their (silly) names; you remember
 * which toy is which and tap it, your dog brings it. When a name nobody has said yet comes
 * up, the answer is the one toy nobody has named: that is how the border collie Rico learnt
 * new words in one go, by exclusion ("fast mapping", Kaminski, Call & Fischer, Science 2004).
 * Chaser knew 1,022 toy names (Pilley & Reid 2011). Each dog keeps the words it learns.
 * Every toy on the blanket has its own shape and a name of its own (no "Fizzy Block" next to a
 * "Jelly Block"), so the only question is which name goes with which toy. 60 seconds. */
(function () {
    'use strict';
    var W = window.WTW;
    var A = W.art, FX = W.fx, SFX = W.sfx, K = W.minikit;
    var t = function (k, p) { return W.i18n.t(k, p); };
    var TIME = 60, TEACH_S = 1.5, MAX_TOYS = 12, NUDGE_S = 3.2;
    var SHAPES = ['ball', 'duck', 'bone', 'ring', 'star', 'cube', 'carrot', 'fish', 'disc', 'rope', 'sock', 'drum'];
    var COLORS = ['#ff5f6d', '#ffd23f', '#6ec6ff', '#7fe08a', '#b28dff', '#ff8c42', '#ff7fb4', '#5fd3c6'];

    function child(env) { return { x: 150, y: env.LH * 0.335 }; }
    function home(env) { return { x: env.LW / 2, y: env.LH - 200 }; }
    function slot(env, i) { return { x: 130 + (i % 4) * 153, y: env.LH * (0.47 + Math.floor(i / 4) * 0.095) }; }

    /* Turkish accusative of a name: "Pıtır’ı", "Zuzu’yu", "Cimcime’yi" (vowel harmony, y after a vowel) */
    var VOWELS = 'aeıioöuüAEIİOÖUÜ', HARMONY = { a: 'ı', 'ı': 'ı', o: 'u', u: 'u', e: 'i', i: 'i', 'ö': 'ü', 'ü': 'ü', A: 'ı', I: 'ı', O: 'u', U: 'u', E: 'i', 'İ': 'i', 'Ö': 'ü', 'Ü': 'ü' };
    function accusative(name) {
        if (W.i18n.lang() !== 'tr') return name;
        var last = '';
        for (var i = name.length - 1; i >= 0; i--) if (VOWELS.indexOf(name.charAt(i)) >= 0) { last = name.charAt(i); break; }
        return name + '’' + (VOWELS.indexOf(name.charAt(name.length - 1)) >= 0 ? 'y' : '') + (HARMONY[last] || 'i');
    }

    function start(d, env) {
        var tame = K.clamp(d.g.tame / 100, 0, 1), H = home(env);
        var G = {
            d: d, s: 0.6 * (0.82 + 0.3 * d.g.size), x: H.x, y: H.y, flip: 1, hop: 0, hopP: 0,
            speed: 650 + 450 * tame, st: 'home', target: null, carry: null,
            names: K.shuffle(t('wordsAdj').split(',')), nextId: 1,
            toys: [], queue: [], req: null, phase: 'teach', phaseT: 0, sinceAdd: 0, askedAt: 0, lastAsk: null,
            time: TIME, score: 0, combo: 0, learned: 0, correct: 0, wrong: 0, over: false, t: 0, hint: !!env.first,
            kid: { mood: 'happy', shake: 0, cheer: 0 }, bubble: null
        };
        for (var i = 0; i < 3; i++) addToy(G, env, false);
        return G;
    }
    function addToy(G, env, silent) {
        if (G.toys.length >= MAX_TOYS) return null;
        // a shape no other toy has: the toys never look alike, only their names must be learnt
        var free = SHAPES.filter(function (sh) { return !G.toys.some(function (o) { return o.shape === sh; }); });
        var shape = free[Math.floor(Math.random() * free.length)];
        var name = G.names[(G.nextId - 1) % G.names.length];
        var toy = {
            id: G.nextId++, shape: shape, color: COLORS[Math.floor(Math.random() * COLORS.length)],
            name: name, asked: accusative(name),                         // Turkish: "Pıtır’ı getir!"
            known: false, silent: !!silent, slot: G.toys.length, pop: 0, flash: 0, tag: 0, st: 'slot'
        };
        var p = slot(env, toy.slot); toy.x = p.x; toy.y = p.y; toy.hx = p.x; toy.hy = p.y;
        G.toys.push(toy);
        if (silent) { SFX.play('pop', 4); G.queue.unshift({ toy: toy, isNew: true }); }   // its name comes next
        else G.queue.push({ teach: toy });
        return toy;
    }
    function nextStep(G, env) {
        G.req = null; G.bubble = null;
        var q = G.queue.shift();
        if (q && q.teach) { G.phase = 'teach'; G.phaseT = TEACH_S; G.teach = q.teach; G.teach.known = true; G.teach.flash = TEACH_S; G.teach.tag = TEACH_S + 0.6; G.bubble = t('wordsTeach', { name: q.teach.name }); SFX.play('heart'); return; }
        G.phase = 'ask';
        if (q && q.isNew) G.req = { toy: q.toy, isNew: true };
        else {
            var known = G.toys.filter(function (o) { return o.known && o !== G.lastAsk; });
            if (!known.length) known = G.toys.filter(function (o) { return o.known; });
            G.req = { toy: known[Math.floor(Math.random() * known.length)], isNew: false };
        }
        G.lastAsk = G.req.toy; G.askedAt = G.t;
        G.bubble = t('wordsAsk', { name: G.req.toy.asked });
    }

    function down(G, p) {
        if (G.over || G.phase !== 'ask' || !G.req || G.st === 'toToy' || G.st === 'toKid') return;
        var hit = null;
        G.toys.forEach(function (o) { if (o.st === 'slot' && Math.hypot(p.x - o.x, p.y - o.y) < 62) hit = o; });
        if (!hit) return;
        G.hint = false;
        var req = G.req, ok = hit === req.toy, fast = G.t - G.askedAt < 2.5;
        G.req = null; G.phase = 'wait';
        if (ok) {
            G.combo++; G.correct++;
            var pts = (req.isNew ? 25 : 10) + (fast ? 5 : 0) + (G.combo >= 3 ? Math.min(10, G.combo) : 0);
            G.score += pts;
            if (!hit.learnt) { hit.learnt = true; G.learned++; }
            hit.known = true; hit.silent = false;
            var msg = req.isNew ? t('wordsFastMap') : fast ? t('wordsFast') : t('wordsRight');
            FX.text(hit.x, hit.y - 70, msg + ' +' + pts, req.isNew ? '#fff36b' : '#b9ff8a', req.isNew ? 40 : 34);
            if (G.combo >= 2) FX.text(hit.x, hit.y - 116, t('combo', { n: G.combo }), '#ffb3d9', 28);
            SFX.play(req.isNew ? 'newTrait' : 'good');
            G.kid.cheer = 0.9; G.sinceAdd++;
        } else {
            G.combo = 0; G.wrong++;
            FX.text(hit.x, hit.y - 70, t('wordsWrong'), '#ffd0c0', 32); SFX.play('wrong');
            G.kid.shake = 0.8; req.toy.flash = 1.4; req.toy.tag = 1.8;   // shows which one it was, and its name
            if (req.isNew) { req.toy.silent = false; req.toy.known = true; }
        }
        G.target = hit; G.st = 'toToy'; G.okLast = ok;
        SFX.play('whoosh');
    }

    function update(G, dt, env) {
        var H = home(env), C = child(env);
        G.t += dt;
        if (!G.over) { G.time -= dt; if (G.time <= 0) { G.time = 0; G.over = true; G.req = null; if (env.onEnd) env.onEnd(G); } }
        G.kid.shake = Math.max(0, G.kid.shake - dt); G.kid.cheer = Math.max(0, G.kid.cheer - dt);
        G.toys.forEach(function (o) {
            o.pop = Math.min(1, o.pop + dt * 4); o.flash = Math.max(0, o.flash - dt); o.tag = Math.max(0, o.tag - dt);
            if (o.st === 'back') { if (K.moveTo(o, o.hx, o.hy, 900, dt)) o.st = 'slot'; }
        });
        if (G.phase === 'teach') {
            G.phaseT -= dt;
            if (G.phaseT <= 0 && !G.over) nextStep(G, env);
        }
        if (G.phase === 'start' || (G.phase === 'teach' && !G.teach)) nextStep(G, env);
        switch (G.st) {
            case 'toToy':
                if (K.moveTo(G, G.target.x, G.target.y + 24, G.speed, dt)) {
                    G.carry = G.target; G.carry.st = 'carried'; G.st = 'toKid';
                }
                break;
            case 'toKid':
                if (G.carry) {                                   // a painted dog walking side-on holds it in its mouth
                    var P = K.pose(G);
                    if (P && P.walking) { G.carry.x = P.mx + P.face * 14 * G.s / 0.6; G.carry.y = P.my + 16 * G.s / 0.6; }
                    else { G.carry.x = G.x; G.carry.y = G.y - 70 * G.s / 0.6; }
                }
                if (K.moveTo(G, C.x + 90, C.y + 70, G.speed, dt)) {
                    var toy = G.carry; G.carry = null;
                    if (toy) { toy.st = 'back'; }
                    G.st = 'home';
                    if (!G.over) {
                        // a new toy every two right answers; some arrive without a name
                        if (G.okLast && G.sinceAdd >= 2 && G.toys.length < MAX_TOYS) {
                            G.sinceAdd = 0;
                            addToy(G, env, G.toys.length >= 4 && Math.random() < 0.45);
                        }
                        nextStep(G, env);
                    }
                }
                break;
            case 'home':
                if (K.moveTo(G, H.x, H.y, G.speed * 0.6, dt)) G.hop = 0;
                break;
        }
    }

    /* ---------------------------------------------------------------- drawing */
    function drawToy(c, o, clock, nudge) {
        var sc = 0.4 + 0.6 * o.pop, x = o.x, y = o.y;
        c.save(); c.translate(x, y); c.scale(sc, sc);
        if (nudge) { c.rotate(Math.sin(clock * 14) * 0.18); c.scale(1.08, 1.08); }   // still thinking? it wiggles
        if (o.flash > 0 && Math.floor(clock * 10) % 2 === 0) {
            c.fillStyle = 'rgba(255,240,140,0.7)'; A.ell(c, 0, 0, 58, 50); c.fill();
        }
        c.lineWidth = 3.5; c.strokeStyle = A.INK; c.fillStyle = o.color; c.lineJoin = 'round';
        if (!(W.sprites && W.sprites.item(c, 'toy_' + o.shape, 0, 0, 82))) switch (o.shape) {
            case 'ball': A.ell(c, 0, 0, 30, 30); c.fill(); c.stroke(); c.beginPath(); c.arc(0, 0, 30, -1, 1); c.lineWidth = 5; c.strokeStyle = '#fff'; c.stroke(); break;
            case 'duck':
                A.ell(c, -4, 8, 32, 22); c.fill(); c.stroke(); A.ell(c, 16, -16, 16, 15); c.fill(); c.stroke();
                c.fillStyle = '#ff9a1f'; c.beginPath(); c.moveTo(30, -18); c.lineTo(44, -13); c.lineTo(30, -9); c.closePath(); c.fill(); c.stroke();
                c.fillStyle = A.INK; A.ell(c, 19, -20, 3, 3); c.fill(); break;
            case 'bone': A.bone(c, 0, 0, 2.4, -0.3); c.globalCompositeOperation = 'source-atop'; c.globalAlpha = 0.55; c.fillRect(-34, -24, 68, 48); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; break;
            case 'ring': c.beginPath(); c.arc(0, 0, 28, 0, Math.PI * 2); c.lineWidth = 16; c.strokeStyle = A.INK; c.stroke(); c.lineWidth = 10; c.strokeStyle = o.color; c.stroke(); break;
            case 'star': A.star(c, 0, 0, 36, o.color); c.lineWidth = 3; c.strokeStyle = A.INK; c.stroke(); break;
            case 'cube': A.roundRect(c, -26, -26, 52, 52, 10); c.fill(); c.stroke(); c.fillStyle = 'rgba(255,255,255,0.75)'; A.ell(c, -10, -10, 5, 5); c.fill(); A.ell(c, 10, 10, 5, 5); c.fill(); break;
            case 'carrot':
                c.beginPath(); c.moveTo(-16, -18); c.lineTo(16, -18); c.lineTo(0, 34); c.closePath(); c.fill(); c.stroke();
                c.fillStyle = '#4fbf55'; c.beginPath(); c.moveTo(-10, -18); c.lineTo(-16, -38); c.lineTo(0, -22); c.lineTo(14, -38); c.lineTo(8, -18); c.closePath(); c.fill(); c.stroke(); break;
            case 'fish':
                A.ell(c, -4, 0, 30, 18); c.fill(); c.stroke();
                c.beginPath(); c.moveTo(24, 0); c.lineTo(40, -16); c.lineTo(40, 16); c.closePath(); c.fill(); c.stroke();
                c.fillStyle = A.INK; A.ell(c, -18, -4, 3.5, 3.5); c.fill(); break;
            case 'disc': A.ell(c, 0, 0, 34, 14); c.fill(); c.stroke(); A.ell(c, 0, -2, 20, 7); c.fillStyle = 'rgba(255,255,255,0.45)'; c.fill(); break;
            case 'rope':
                c.lineCap = 'round'; c.beginPath(); c.moveTo(-28, 12); c.bezierCurveTo(-10, -26, 10, 26, 28, -12);
                c.lineWidth = 14; c.strokeStyle = A.INK; c.stroke(); c.lineWidth = 9; c.strokeStyle = o.color; c.stroke();
                A.ell(c, -30, 13, 9, 9); c.fillStyle = o.color; c.fill(); c.lineWidth = 3; c.strokeStyle = A.INK; c.stroke();
                A.ell(c, 30, -13, 9, 9); c.fill(); c.stroke(); break;
            case 'sock':
                c.beginPath(); c.moveTo(-12, -32); c.lineTo(10, -32); c.lineTo(10, 8); c.quadraticCurveTo(34, 10, 30, 26); c.lineTo(-6, 26); c.quadraticCurveTo(-14, 26, -12, 10); c.closePath();
                c.fill(); c.stroke(); c.fillStyle = 'rgba(255,255,255,0.7)'; c.fillRect(-11, -30, 20, 8); break;
            case 'drum':
                c.fillRect(-26, -12, 52, 34); c.strokeRect(-26, -12, 52, 34);
                A.ell(c, 0, -12, 26, 9); c.fillStyle = '#fff4dc'; c.fill(); c.stroke();
                c.beginPath(); c.moveTo(-26, 4); c.lineTo(-10, 18); c.lineTo(6, 4); c.lineTo(22, 18); c.lineWidth = 2.5; c.stroke(); break;
        }
        c.restore();
        if (o.tag > 0 && o.st === 'slot') {                   // its name, while it is being taught
            c.save(); c.globalAlpha = Math.min(1, o.tag * 3);
            K.label(c, o.name, x, y + 50, 24, '#fff36b');
            c.restore();
        }
        if (o.silent && o.st === 'slot') {                   // nobody has said its name yet
            c.save(); c.font = '900 30px "Trebuchet MS", system-ui, sans-serif'; c.textAlign = 'center';
            c.lineWidth = 6; c.strokeStyle = A.INK; c.strokeText('?', x + 30, y - 30); c.fillStyle = '#ffe45c'; c.fillText('?', x + 30, y - 30);
            c.restore();
        }
    }
    function drawKid(c, x, y, kid, clock) {
        var shake = kid.shake > 0 ? Math.sin(clock * 40) * 6 : 0, cheer = kid.cheer > 0;
        if (W.sprites && W.sprites.item(c, cheer ? 'kid_cheer' : 'kid', x + shake, y + 106, 168, { bottom: true, rot: kid.shake > 0 ? Math.sin(clock * 40) * 0.04 : 0 })) return;
        c.save(); c.translate(x, y);
        c.lineWidth = 3.5; c.strokeStyle = A.INK; c.lineJoin = 'round';
        // body + arms
        c.fillStyle = '#6ec6ff'; A.roundRect(c, -30, 30, 60, 74, 22); c.fill(); c.stroke();
        c.lineCap = 'round'; c.lineWidth = 10;
        [-1, 1].forEach(function (sd) {
            c.strokeStyle = A.INK; c.beginPath(); c.moveTo(sd * 26, 46); c.lineTo(sd * 46, cheer ? 2 : 74); c.stroke();
            c.lineWidth = 6; c.strokeStyle = '#f2c79c'; c.stroke(); c.lineWidth = 10;
        });
        // head
        c.translate(shake, 0);
        c.lineWidth = 3.5; c.strokeStyle = A.INK;
        c.fillStyle = '#f2c79c'; A.ell(c, 0, 0, 34, 34); c.fill(); c.stroke();
        c.fillStyle = '#7a4832'; c.beginPath(); c.arc(0, -6, 35, Math.PI * 1.05, Math.PI * 1.95); c.closePath(); c.fill(); c.stroke();
        c.fillStyle = A.INK; A.ell(c, -11, 4, 3.5, 4.5); c.fill(); A.ell(c, 11, 4, 3.5, 4.5); c.fill();
        c.beginPath();
        if (kid.shake > 0) c.arc(0, 22, 8, Math.PI * 1.15, Math.PI * 1.85); else c.arc(0, 14, 9, 0.15 * Math.PI, 0.85 * Math.PI);
        c.lineWidth = 3; c.stroke();
        c.fillStyle = 'rgba(255,120,140,0.35)'; A.ell(c, -20, 14, 6, 4); c.fill(); A.ell(c, 20, 14, 6, 4); c.fill();
        c.restore();
    }
    function bubble(c, x, y, str, LW) {
        c.save();
        c.font = '900 34px "Trebuchet MS", system-ui, sans-serif';
        var w = Math.min(LW - x - 30, c.measureText(str).width + 48), h = 66;
        A.roundRect(c, x, y - h / 2, w, h, 26); c.fillStyle = '#fff8ec'; c.fill(); c.lineWidth = 4; c.strokeStyle = A.INK; c.stroke();
        c.beginPath(); c.moveTo(x + 4, y + 2); c.lineTo(x - 22, y + 18); c.lineTo(x + 6, y + 18); c.closePath(); c.fillStyle = '#fff8ec'; c.fill();
        c.beginPath(); c.moveTo(x + 2, y + 6); c.lineTo(x - 22, y + 18); c.lineTo(x + 8, y + 20); c.stroke();
        c.fillStyle = '#5a3a2a'; c.textAlign = 'left'; c.textBaseline = 'middle';
        var size = 34; while (c.measureText(str).width > w - 40 && size > 20) { size -= 2; c.font = '900 ' + size + 'px "Trebuchet MS", system-ui, sans-serif'; }
        c.fillText(str, x + 24, y + 1);
        c.restore();
    }

    function draw(c, G, env) {
        var LW = env.LW, LH = env.LH, clock = env.clock, C = child(env);
        A.world(c, LW, LH, clock, 0, 0.12, 1);
        // the picnic blanket where the toys lie
        var top = LH * 0.415, bot = LH * 0.745;
        c.save();
        A.roundRect(c, 40, top, LW - 80, bot - top, 36); c.fillStyle = '#ffe9d1'; c.fill(); c.lineWidth = 5; c.strokeStyle = A.INK; c.stroke();
        c.save(); A.roundRect(c, 40, top, LW - 80, bot - top, 36); c.clip();
        c.fillStyle = 'rgba(255,127,180,0.28)';
        for (var gx = 40; gx < LW; gx += 80) c.fillRect(gx, top, 40, bot - top);
        for (var gy = top; gy < bot; gy += 80) c.fillRect(40, gy, LW - 80, 40);
        c.restore();
        c.restore();
        var nudge = G.phase === 'ask' && G.req && G.t - G.askedAt > NUDGE_S ? G.req.toy : null;
        G.toys.forEach(function (o) { if (o.st !== 'carried') drawToy(c, o, clock, o === nudge); });
        drawKid(c, C.x, C.y, G.kid, clock);
        if (G.bubble) bubble(c, C.x + 70, C.y - 28, G.bubble, LW);
        K.drawDog(c, G, { t: clock, mood: G.st === 'home' ? 'calm' : 'happy', wag: 1, flip: G.flip, hop: G.hop, lookX: G.flip * 0.4 });
        if (G.carry) drawToy(c, G.carry, clock);
        var known = G.d.words || 0;
        K.label(c, '🧠 ' + (known + G.learned), LW - 70, LH - 120, 32, '#fff4dc', 'right');
        K.hud(c, LW, G, TIME);
        if (G.hint) K.hintBox(c, LW, LH, t('wordsHint'), 0.2);
    }

    W.minis = W.minis || [];
    W.minis.push({
        id: 'words', icon: '🧸', title: 'wordsTitle', fact: 'factWords', skillText: 'skillWords', unlock: null,
        skill: function (g) { return g.tame / 100; },
        tag: function (d) { return '🧠 ' + (d.words || 0); },
        start: start, update: update, draw: draw, down: down,
        stats: function (G) { return t('wordsRightN') + ' ' + G.correct + '/' + (G.correct + G.wrong); },
        extra: function (G) {
            var n = (G.d.words || 0);
            var m = n >= 1022 ? 'wordsChaser' : n >= 200 ? 'wordsRico' : null;
            return '🧠 ' + t('wordsKnows', { name: G.d.name, n: n }) + (m ? '  ' + t(m) : '');
        },
        done: function (G) { G.d.words = (G.d.words || 0) + G.learned; },
        bones: function (G) { return G.score * 0.12; }
    });
})();
