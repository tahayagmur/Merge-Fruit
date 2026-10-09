/* Wolf to Woof - Night Eyes. Eyes shine in the dark around the camp; their pupils give the
 * animals away (Banks et al., Science Advances 2015): vertical slits belong to ambush
 * hunters like the fox, round pupils to chasers like the wolf, horizontal bars to grazers
 * like deer and goats. Tap a hunter's eyes and your dog barks it away before it reaches the
 * fish rack. Leave the grazers alone. Barking at night was one of the first jobs dogs did
 * for people. Upright ears hear a hunter coming: a "!" warns you sooner. 50 seconds. */
(function () {
    'use strict';
    var W = window.WTW;
    var A = W.art, FX = W.fx, SFX = W.sfx, K = W.minikit;
    var t = function (k, p) { return W.i18n.t(k, p); };
    var TIME = 50, FISH = 3, MAX_EYES = 6;
    // r: eye radius, gap: distance between the eyes (in r), tilt: a hunter's slanted eyes
    var KINDS = {
        fox: { threat: true, pupil: 'slit', color: '#d6ff6e', r: 19, gap: 2.7, tilt: 0.28, emoji: '🦊', from: 1, go: 1 },
        wolf: { threat: true, pupil: 'round', color: '#ffd84d', r: 20, gap: 3.0, tilt: 0.14, emoji: '🐺', from: 2, go: 1.1 },
        bear: { threat: true, pupil: 'round', color: '#ffa94d', r: 15, gap: 3.6, tilt: 0, emoji: '🐻', from: 3, go: 0.8 },
        deer: { threat: false, pupil: 'bar', color: '#e4ffd6', r: 21, gap: 4.3, tilt: -0.05, emoji: '🦌', from: 1 },
        goat: { threat: false, pupil: 'bar', color: '#ffe89a', r: 20, gap: 3.8, tilt: 0, emoji: '🐐', from: 2 }
    };
    // the bushes the eyes peek out of: x, y as a fraction of LH, size
    var BUSHES = [[95, 0.425, 1.1], [255, 0.4, 0.9], [430, 0.43, 1.2], [615, 0.405, 1.0], [165, 0.535, 1.0], [365, 0.555, 0.95], [565, 0.525, 1.1]];

    function fire(env) { return { x: env.LW / 2, y: env.LH - 250 }; }
    function rack(env) { return { x: env.LW - 135, y: env.LH - 228 }; }
    function home(env) { return { x: 165, y: env.LH - 178 }; }
    function edge(env) { return env.LH - 420; }                       // where the firelight starts

    function start(d, env) {
        var H = home(env), ear = K.clamp(d.g.ear, 0, 4);
        return {
            d: d, s: 0.74 * (0.82 + 0.3 * d.g.size), x: H.x, y: H.y, flip: 1, hop: 0, hopP: 0,
            warn: 0.4 + 1.6 * (1 - ear / 4),                              // upright ears hear a hunter sooner
            eyes: [], spawnT: 1.2, level: 1, elapsed: 0, bark: 0, lookX: 0,
            fish: FISH, chased: 0, mistakes: 0, lost: 0,
            time: TIME, score: 0, combo: 0, over: false, t: 0, hint: !!env.first
        };
    }

    /* ---------------------------------------------------------------- the animals */
    function pickKind(G) {
        var threat = Math.random() < 0.56;
        var names = Object.keys(KINDS).filter(function (k) { return KINDS[k].threat === threat && KINDS[k].from <= G.level; });
        return names[Math.floor(Math.random() * names.length)];
    }
    function spawn(G, env) {
        var used = G.eyes.map(function (e) { return e.bush; });
        var free = BUSHES.map(function (_, i) { return i; }).filter(function (i) { return used.indexOf(i) < 0; });
        if (!free.length || G.eyes.length >= MAX_EYES) return;
        var bi = free[Math.floor(Math.random() * free.length)], b = BUSHES[bi], kind = pickKind(G), Kd = KINDS[kind];
        var x = b[0] + (Math.random() - 0.5) * 30, y = env.LH * b[1] - 14 * b[2];
        G.eyes.push({
            kind: kind, threat: Kd.threat, bush: bi, x: x, y: y, x0: x, y0: y, s: 0.85, u: 0,
            tx: x * 0.55 + env.LW / 2 * 0.45, ty: edge(env),
            dur: (7.2 - 0.55 * (G.level - 1)) / (Kd.go || 1),               // how long a hunter needs to reach the light
            life: 3.6 + Math.random() * 1.6,                                // how long a grazer stays
            open: 0, age: 0, blink: 0, nextBlink: 1 + Math.random() * 2, st: 'watch', reveal: 0, warnT: Kd.threat ? G.warn : 0
        });
        if (Kd.threat && G.warn > 1) SFX.play('tap');
    }
    function down(G, p, env) {
        if (G.over) return;
        if (G.hint) { G.hint = false; SFX.play('tap'); return; }          // the first tap only closes the hint
        var best = null, bd = 1e9;
        G.eyes.forEach(function (e) {
            if (e.st !== 'watch' || e.open < 0.3) return;
            var dd = Math.hypot(p.x - e.x, p.y - e.y);
            if (dd < 90 * e.s && dd < bd) { bd = dd; best = e; }
        });
        if (!best) return;
        best.st = 'flee'; best.reveal = 1;
        G.bark = 0.5; G.lookX = K.clamp((best.x - G.x) / 300, -1, 1);
        SFX.play('bark');
        FX.text(G.x + 10, G.y - 150, t('eyesWoof'), '#fff4dc', 34);
        if (best.threat) {
            G.combo++; G.chased++;
            var pts = 10 + (best.u < 0.5 ? 5 : 0) + (G.combo >= 3 ? Math.min(10, G.combo) : 0);
            G.score += pts;
            FX.text(best.x, best.y - 70, '+' + pts, '#b9ff8a', 40);
            FX.sparkle(best.x, best.y, 12, '#fff6a0');
            SFX.play('good');
        } else {
            G.combo = 0; G.mistakes++; G.time = Math.max(0, G.time - 2);
            FX.text(best.x, best.y - 70, t('eyesJust_' + best.kind), '#ffd0c0', 32);
            SFX.play('wrong');
        }
    }

    function update(G, dt, env) {
        var F = fire(env), H = home(env);
        G.t += dt;
        G.bark = Math.max(0, G.bark - dt);
        G.hop = G.bark > 0 ? Math.abs(Math.sin(G.t * 16)) * 10 : 0;
        if (!G.over && !G.hint) {
            G.time -= dt; G.elapsed += dt;
            G.level = Math.min(5, 1 + Math.floor(G.elapsed / 11));
            G.spawnT -= dt;
            if (G.spawnT <= 0) { spawn(G, env); G.spawnT = [1.9, 1.6, 1.35, 1.15, 1.0][G.level - 1] * (0.8 + Math.random() * 0.4); }
            if (G.time <= 0) { G.time = 0; end(G, env); }
        }
        G.lookX *= Math.pow(0.3, dt);
        for (var i = G.eyes.length - 1; i >= 0; i--) {
            var e = G.eyes[i];
            e.age += dt; e.warnT = Math.max(0, e.warnT - dt);
            e.reveal = Math.max(0, e.reveal - dt * 1.1);
            e.nextBlink -= dt;
            if (e.nextBlink <= 0) { e.blink = 0.14; e.nextBlink = 2 + Math.random() * 2.5; }
            e.blink = Math.max(0, e.blink - dt);
            if (e.st === 'watch') {
                e.open = Math.min(1, e.open + dt * 3);
                if (G.over || G.hint) continue;
                if (e.threat) {
                    e.u += dt / e.dur;
                    var k = e.u * e.u * (3 - 2 * e.u);
                    e.x = e.x0 + (e.tx - e.x0) * k; e.y = e.y0 + (e.ty - e.y0) * k; e.s = 0.85 + 0.5 * k;
                    if (e.u >= 1) steal(G, e, env);
                } else if (e.age > e.life) e.st = 'leave';
            } else if (e.st === 'flee') {
                e.open = Math.max(0, e.open - dt * 1.4); e.y -= 120 * dt; e.x += (e.x < F.x ? -1 : 1) * 60 * dt;
                if (e.open <= 0 && e.reveal <= 0) G.eyes.splice(i, 1);
            } else {                                                     // 'leave' / 'stole': the eyes close and go
                e.open = Math.max(0, e.open - dt * 2.5);
                if (e.open <= 0 && e.reveal <= 0) G.eyes.splice(i, 1);
            }
        }
        K.moveTo(G, H.x, H.y, 300, dt);
    }
    function steal(G, e, env) {
        var R = rack(env);
        e.st = 'stole'; e.reveal = 1;
        G.fish = Math.max(0, G.fish - 1); G.lost++; G.combo = 0;
        FX.text(Math.min(R.x, env.LW - 220), R.y - 190, t('eyesStole', { animal: t('eyesA_' + e.kind) }), '#ffd0c0', 30);
        SFX.play('flee');
        if (G.fish <= 0) end(G, env);
    }
    function end(G, env) {
        if (G.over) return;
        G.over = true;
        if (env.onEnd) env.onEnd(G);
    }

    /* ---------------------------------------------------------------- drawing */
    function rgba(hex, a) {
        var n = parseInt(hex.slice(1), 16);
        return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
    }
    function eye(c, x, y, r, tilt, Kd, open) {
        c.save(); c.translate(x, y); c.rotate(tilt);
        var gr = c.createRadialGradient(0, 0, r * 0.4, 0, 0, r * 2.7);
        gr.addColorStop(0, rgba(Kd.color, 0.5)); gr.addColorStop(1, rgba(Kd.color, 0));
        c.fillStyle = gr; A.ell(c, 0, 0, r * 2.7, r * 2.7 * Math.max(0.35, open)); c.fill();
        c.fillStyle = Kd.color; A.ell(c, 0, 0, r, r * 0.82 * open); c.fill();
        c.fillStyle = '#140a1c';
        if (Kd.pupil === 'slit') { A.ell(c, 0, 0, r * 0.24, r * 0.74 * open); c.fill(); }
        else if (Kd.pupil === 'round') { A.ell(c, 0, 0, r * 0.44, r * 0.44 * open); c.fill(); }
        else { A.roundRect(c, -r * 0.74, -r * 0.19 * open, r * 1.48, r * 0.38 * open, r * 0.18 * open); c.fill(); }
        c.fillStyle = 'rgba(255,255,255,0.85)'; A.ell(c, -r * 0.38, -r * 0.3 * open, r * 0.17, r * 0.17 * open); c.fill();
        c.restore();
    }
    function pair(c, e, clock) {
        var Kd = KINDS[e.kind], open = e.open * (e.blink > 0 ? 0.08 : 1), r = Kd.r * e.s, half = Kd.gap * r / 2;
        if (open <= 0.01) return;
        eye(c, e.x - half, e.y, r, Kd.tilt, Kd, open);
        eye(c, e.x + half, e.y, r, -Kd.tilt, Kd, open);
    }
    function bush(c, x, y, s) {
        c.save(); c.translate(x, y); c.scale(s, s);
        c.fillStyle = '#16233f';
        [[-46, 6, 34], [0, -8, 44], [46, 6, 34], [-22, 14, 30], [24, 14, 30]].forEach(function (b) { A.ell(c, b[0], b[1], b[2], b[2] * 0.82); c.fill(); });
        c.fillStyle = 'rgba(90,120,170,0.18)';
        [[-40, -6, 18], [4, -26, 22], [44, -8, 16]].forEach(function (b) { A.ell(c, b[0], b[1], b[2], b[2] * 0.6); c.fill(); });
        c.restore();
    }
    function fishRack(c, x, y, n, clock) {
        if (W.sprites && W.sprites.get('rack')) {
            W.sprites.item(c, 'rack', x, y + 6, 176, { bottom: true });
            for (var k = 0; k < n; k++) W.sprites.item(c, 'fish', x - 44 + k * 44, y - 104, 74, { rot: Math.sin(clock * 2 + k) * 0.08 });
            return;
        }
        c.save(); c.translate(x, y);
        c.lineCap = 'round'; c.strokeStyle = A.INK; c.lineWidth = 11;
        c.beginPath(); c.moveTo(-70, 0); c.lineTo(-56, -150); c.moveTo(70, 0); c.lineTo(56, -150); c.moveTo(-74, -142); c.lineTo(74, -142); c.stroke();
        c.strokeStyle = '#9a6236'; c.lineWidth = 6; c.stroke();
        for (var i = 0; i < FISH; i++) {
            var fx = -44 + i * 44, sw = Math.sin(clock * 2 + i) * 0.08;
            c.save(); c.translate(fx, -142); c.rotate(sw);
            c.strokeStyle = 'rgba(40,24,40,0.6)'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, 16); c.stroke();
            if (i < n) {
                c.translate(0, 52); c.lineWidth = 3; c.strokeStyle = A.INK; c.fillStyle = '#8ec9e8';
                A.ell(c, 0, 0, 14, 34); c.fill(); c.stroke();
                c.beginPath(); c.moveTo(0, 30); c.lineTo(-14, 50); c.lineTo(14, 50); c.closePath(); c.fill(); c.stroke();
                c.fillStyle = A.INK; A.ell(c, -5, -20, 3, 3); c.fill();
                c.fillStyle = 'rgba(255,255,255,0.5)'; A.ell(c, 5, -4, 4, 16); c.fill();
            }
            c.restore();
        }
        c.restore();
    }
    function legend(c, LW, clock) {
        var y = 318;
        [{ x: LW / 2 - 168, kinds: ['fox', 'wolf'], txt: t('eyesBark'), col: '#ffb3b3' }, { x: LW / 2 + 168, kinds: ['deer'], txt: t('eyesLeave'), col: '#c8ffc0' }].forEach(function (L) {
            c.save();
            A.roundRect(c, L.x - 150, y - 30, 300, 60, 30); c.fillStyle = 'rgba(16,12,40,0.72)'; c.fill(); c.lineWidth = 3; c.strokeStyle = L.col; c.stroke();
            L.kinds.forEach(function (k, i) {
                var Kd = KINDS[k], cx = L.x - 112 + i * 56;
                eye(c, cx, y, 17, 0, Kd, 1);
            });
            c.restore();
            K.label(c, L.txt, L.x + (L.kinds.length > 1 ? 40 : 10), y + 1, 26, L.col, 'center');
        });
    }

    function draw(c, G, env) {
        var LW = env.LW, LH = env.LH, clock = env.clock, F = fire(env), R = rack(env);
        A.world(c, LW, LH, clock, 1, 0, 1);
        BUSHES.forEach(function (b) { bush(c, b[0], LH * b[1], b[2]); });
        // the night beyond the firelight
        var fl = 1 + Math.sin(clock * 6.1) * 0.02 + Math.sin(clock * 11.7) * 0.012, rad = LH * 0.47 * fl;
        var gr = c.createRadialGradient(F.x, F.y - 40, rad * 0.3, F.x, F.y - 40, rad);
        gr.addColorStop(0, 'rgba(10,8,38,0)'); gr.addColorStop(0.55, 'rgba(10,8,38,0.3)'); gr.addColorStop(1, 'rgba(10,8,38,0.74)');
        var V = A.viewX(LW);                         // a wide screen: the night goes on to the sides
        c.fillStyle = gr; c.fillRect(V[0], 0, V[1] - V[0], LH);
        A.fireGlow(c, F.x, F.y - 30, 260, clock, 0.9);
        // eyes, then whoever was caught in the light
        G.eyes.forEach(function (e) { pair(c, e, clock); });
        G.eyes.forEach(function (e) {
            if (e.reveal > 0) {
                var u = e.reveal, sz = 84 * e.s * (u > 0.8 ? 1 + (u - 0.8) * 2 : 1);
                c.save(); c.globalAlpha = Math.min(1, u * 2.5);
                var lg = c.createRadialGradient(e.x, e.y, 10, e.x, e.y, 110 * e.s);
                lg.addColorStop(0, 'rgba(255,240,190,0.55)'); lg.addColorStop(1, 'rgba(255,240,190,0)');
                c.fillStyle = lg; A.ell(c, e.x, e.y, 110 * e.s, 110 * e.s); c.fill();
                c.font = Math.round(sz) + 'px system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
                if (!(W.sprites && W.sprites.item(c, 'an_' + e.kind, e.x, e.y + 4, sz * 1.3))) c.fillText(KINDS[e.kind].emoji, e.x, e.y + 4);
                c.restore();
            }
            if (e.st === 'watch' && e.warnT > 0 && e.open > 0.3) {
                var p = 0.75 + 0.25 * Math.sin(clock * 14), wy = e.y - 62 * e.s;
                c.save(); A.ell(c, e.x, wy, 22 * p, 22 * p); c.fillStyle = '#ff4d5e'; c.fill(); c.lineWidth = 3; c.strokeStyle = A.INK; c.stroke(); c.restore();
                K.label(c, '!', e.x, wy + 1, 30 * p, '#fff8ec');
            }
        });
        A.campfire(c, F.x, F.y, 0.9);
        A.flames(c, F.x, F.y - 6, 0.62, clock);
        for (var i = 0; i < 7; i++) {                                   // embers (the camp's own sparks stay at the camp)
            var u = (clock * 0.55 + i * 0.37) % 1;
            c.fillStyle = 'rgba(255,200,90,' + (1 - u) + ')';
            c.fillRect(F.x + Math.sin(clock * 1.7 + i * 2.1) * 34 * (0.4 + u), F.y - 70 - u * 150, 4, 4);
        }
        fishRack(c, R.x, R.y, G.fish, clock);
        K.drawDog(c, G, { t: clock, mood: G.bark > 0 ? 'happy' : 'calm', wag: G.bark > 0 ? 1 : 0.4, flip: G.lookX < -0.1 ? -1 : 1, hop: G.hop, lookX: G.lookX, lookY: -0.4 });
        legend(c, LW, clock);
        K.label(c, '🐟 ' + G.fish + '/' + FISH, R.x, R.y + 46, 30, G.fish > 1 ? '#fff4dc' : '#ffb3b3');
        K.hud(c, LW, G, TIME);
        if (G.hint) K.hintBox(c, LW, LH, t('eyesHint'), 0.52);
    }

    W.minis = W.minis || [];
    W.minis.push({
        id: 'eyes', icon: '🌙', title: 'eyesTitle', fact: 'factEyes', skillText: 'skillEyes', unlock: 'eyes',
        skill: function (g) { return 1 - g.ear / 4; },
        start: start, update: update, draw: draw, down: down,
        stats: function (G) { return t('eyesChased') + ' ' + G.chased + '   ·   🐟 ' + G.fish + '/' + FISH; },
        bones: function (G) { return G.score * 0.2; }
    });
})();
