/* Wolf to Woof - Howl Chorus. The pack howls on a moonlit hill. Hold a finger on a line to
 * howl that note, slide to change it. Wolves in a chorus keep to different notes, which
 * makes a few wolves sound like many to a rival pack (the "Beau Geste" effect: Harrington
 * 1989, Theberge & Falls 1967). Singing a note nobody else holds scores; singing on top of a
 * pack mate (unison) scores nothing. Wilder dogs have more breath for long howls. 40 s. */
(function () {
    'use strict';
    var W = window.WTW;
    var A = W.art, FX = W.fx, SFX = W.sfx, K = W.minikit;
    var t = function (k, p) { return W.i18n.t(k, p); };
    var TIME = 40, LANES = 6, TICK = 0.25;
    var NOTES = [220, 261.63, 293.66, 329.63, 392, 440];               // A minor pentatonic, low to high
    var COLORS = ['#7fd4ff', '#ff9ad5', '#9dff8a', '#c6a6ff'];
    var SPOTS = [[150, 238], [570, 238], [262, 262], [458, 262]];        // pack mates: x, height above the bottom
    var GHOSTS = [[52, 300], [668, 300], [96, 330], [624, 330]];        // the pack the rivals think they hear

    function laneTop() { return 396; }
    function laneBot(env) { return env.LH - 430; }
    function laneY(env, i) { return laneBot(env) - (laneBot(env) - laneTop()) * i / (LANES - 1); }   // 0 = lowest
    function laneAt(env, y) { return K.clamp(Math.round((laneBot(env) - y) / (laneBot(env) - laneTop()) * (LANES - 1)), 0, LANES - 1); }
    function gap(env) { return (laneBot(env) - laneTop()) / (LANES - 1); }

    function start(d, env) {
        var tame = K.clamp(d.g.tame / 100, 0, 1);
        var mates = ((env.S && env.S.dogs) || []).filter(function (o) { return o !== d && o.role === 'pack' && o.adult; });
        K.shuffle(mates);
        var ai = SPOTS.map(function (sp, i) {
            var m = mates[i] || { name: t('howlWild'), g: W.gen.wild(Math.random), seed: 1 + Math.floor(Math.random() * 99999) };
            return {
                d: m, name: m.name, x: sp[0], h: sp[1], color: COLORS[i], on: i < 2, st: 'rest', timer: 0.6 + i * 0.8,
                lane: -1, next: -1, last: -1, amp: 0, hop: 0,
                voice: SFX.voice({ vol: 0.03, lp: 1300, vib: 6 })
            };
        });
        SFX.duck(true);
        return {
            d: d, s: 0.72 * (0.82 + 0.3 * d.g.size), ai: ai, ghosts: GHOSTS.map(function () { return { g: W.gen.wild(Math.random), seed: Math.floor(Math.random() * 99999), a: 0 }; }),
            B: 3 + 3 * (1 - tame), breath: 3 + 3 * (1 - tame),           // wilder dogs hold a howl longer
            howl: false, lane: 2, howlT: 0, dirty: false, clash: false, clashT: 0, tickT: 0, amp: 0, shake: 0,
            rival: 0, goal: 80, backs: 0, chorusMax: 1, howls: 0, unisons: 0,
            voice: SFX.voice({ vol: 0.055, lp: 1800, vib: 8 }),
            time: TIME, score: 0, combo: 0, over: false, t: 0, hint: !!env.first
        };
    }

    /* ---------------------------------------------------------------- the pack */
    function pickLane(G, a) {
        var taken = G.ai.filter(function (o) { return o !== a && o.on; }).map(function (o) { return o.st === 'sing' ? o.lane : o.next; });
        var free = [];
        for (var i = 0; i < LANES; i++) if (taken.indexOf(i) < 0 && i !== a.last) free.push(i);
        return free.length ? free[Math.floor(Math.random() * free.length)] : Math.floor(Math.random() * LANES);
    }
    function updateAI(G, a, dt) {
        a.timer -= dt;
        if (a.st === 'sing') {
            if (a.timer <= 0) { a.st = 'rest'; a.timer = 0.45 + Math.random() * 0.6; a.voice.off(); a.last = a.lane; a.lane = -1; }
        } else {
            if (a.next < 0 && a.timer <= 0.7) a.next = pickLane(G, a);    // shown as a dotted line: it sings here next
            if (a.timer <= 0) {
                a.st = 'sing'; a.lane = a.next >= 0 ? a.next : pickLane(G, a); a.next = -1;
                a.timer = 1.4 + Math.random() * 1.6; a.voice.on(NOTES[a.lane]);
            }
        }
    }
    function chorus(G) {                                                // different notes sung right now
        var seen = {};
        G.ai.forEach(function (a) { if (a.on && a.st === 'sing') seen[a.lane] = 1; });
        if (G.howl) seen[G.lane] = 1;
        return Object.keys(seen).length;
    }
    function sounds(n) { return n >= 2 ? n * 2 : n; }                   // rivals hear about twice as many wolves

    /* ---------------------------------------------------------------- input */
    function down(G, p, env) {
        if (G.over) return;
        if (G.hint) { G.hint = false; SFX.play('tap'); return; }        // the first tap only closes the hint
        if (G.breath < 0.35) { FX.text(env.LW / 2, env.LH - 330, t('howlBreath'), '#ffe0c0', 30); return; }
        G.howl = true; G.lane = laneAt(env, p.y); G.howlT = 0; G.dirty = false; G.clash = false; G.clashT = 0; G.tickT = 0;
        G.voice.on(NOTES[G.lane]);
    }
    function move(G, p, env) {
        if (!G.howl || G.over) return;
        var l = laneAt(env, p.y);
        if (l !== G.lane) { G.lane = l; G.voice.set(NOTES[l] * (G.clash ? 1.035 : 1)); }
    }
    function up(G, p, env) { if (G.howl && !G.over) endHowl(G, env, false); }
    function endHowl(G, env, outOfBreath) {
        G.howl = false; G.voice.off(); G.howls++;
        var y = laneY(env, G.lane) - 46;
        if (G.howlT >= 1 && !G.dirty) {
            G.combo++;
            var b = 5 * Math.min(6, G.combo);
            G.score += b; G.rival += b;
            FX.text(env.LW / 2, y, t('howlHarmony', { n: b }), '#fff36b', 36);
            SFX.play('heart');
        }
        if (outOfBreath) FX.text(env.LW / 2, y - 46, t('howlOut'), '#ffe0c0', 30);
    }

    function update(G, dt, env) {
        G.t += dt;
        G.shake = Math.max(0, G.shake - dt);
        G.amp += ((G.howl ? 1 : 0) - G.amp) * Math.min(1, dt * 10);
        G.ai.forEach(function (a) { a.amp += ((a.on && a.st === 'sing' ? 1 : 0) - a.amp) * Math.min(1, dt * 8); a.hop = Math.max(0, a.hop - dt * 40); });
        var ch = chorus(G);
        G.ghosts.forEach(function (o, i) { o.a += (((ch >= 3 && i < ch - 1) ? 0.38 : 0) - o.a) * Math.min(1, dt * 3); });
        if (G.over || G.hint) return;
        G.time -= dt;
        if (G.time <= 0) { G.time = 0; finish(G, env); return; }
        G.ai.forEach(function (a) { if (a.on) updateAI(G, a, dt); });
        var clash = G.howl && G.ai.some(function (a) { return a.on && a.st === 'sing' && a.lane === G.lane; });
        if (clash !== G.clash) { G.clash = clash; if (G.howl) G.voice.set(NOTES[G.lane] * (clash ? 1.035 : 1)); }   // unison beats
        if (G.howl) {
            G.howlT += dt; G.breath -= dt;
            G.clashT = clash ? G.clashT + dt : 0;              // sliding across a pack mate's note is not a unison
            if (G.clashT > 0.18 && !G.dirty) {
                G.dirty = true; G.combo = 0; G.unisons++; G.shake = 0.35;
                FX.text(env.LW / 2, laneY(env, G.lane) - 46, t('howlUnison'), '#ffb3b3', 34); SFX.play('wrong');
            }
            G.tickT += dt;
            while (G.tickT >= TICK) {
                G.tickT -= TICK;
                if (!clash) {
                    G.score += ch; G.rival += ch;
                    if (Math.random() < 0.7) FX.text(70 + Math.random() * 580, laneY(env, G.lane) - 24, '♪', '#fff6a0', 28 + ch * 3);
                }
            }
            if (G.breath <= 0) { G.breath = 0; endHowl(G, env, true); }
        } else G.breath = Math.min(G.B, G.breath + dt * 1.5);
        G.chorusMax = Math.max(G.chorusMax, chorus(G));
        if (G.rival >= G.goal) {                                         // the rivals think the pack is huge
            G.rival = 0; G.backs++; G.goal += 40; G.score += 40;
            FX.text(env.LW / 2, laneTop() + 50, t('howlRivals'), '#fff36b', 36); FX.confetti(env.LW / 2, laneTop() + 60, 30); SFX.play('bond');
            var join = G.ai.filter(function (a) { return !a.on; })[0];
            if (join) {
                join.on = true; join.st = 'rest'; join.timer = 0.9; join.hop = 18;
                FX.text(join.x, env.LH - join.h - 120, t('howlJoin', { name: join.name }), '#c8ffc0', 28);
                FX.hearts(join.x, env.LH - join.h - 70, 4);
            }
        }
    }
    function finish(G, env) {
        if (G.over) return;
        G.over = true; G.howl = false;
        G.voice.off(); G.ai.forEach(function (a) { a.voice.off(); });
        if (env.onEnd) env.onEnd(G);
    }
    function stop(G) {
        G.voice.stop(); G.ai.forEach(function (a) { a.voice.stop(); });
        SFX.duck(false);
    }

    /* ---------------------------------------------------------------- drawing */
    function wave(c, env, lane, color, width, amp, ph, clock, jitter, dashed) {
        if (amp <= 0.02) return;
        var y0 = laneY(env, lane), A0 = gap(env) * 0.17 * amp;
        c.save();
        c.lineCap = 'round'; c.lineJoin = 'round';
        if (dashed) c.setLineDash([14, 14]);
        c.beginPath();
        for (var x = 40; x <= env.LW - 40; x += 14) {
            var y = y0 + Math.sin(x * 0.03 - clock * 6 + ph) * A0 + (jitter ? (Math.random() - 0.5) * A0 * 1.2 : 0);
            if (x === 40) c.moveTo(x, y); else c.lineTo(x, y);
        }
        c.globalAlpha = dashed ? 0.55 : 0.35; c.strokeStyle = color; c.lineWidth = width * 2.2; c.stroke();
        c.globalAlpha = dashed ? 0.8 : 1; c.lineWidth = width; c.stroke();
        if (!dashed) { c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineWidth = Math.max(2, width * 0.3); c.stroke(); }
        c.restore();
    }
    function moon(c, x, y, r, clock) {
        var gr = c.createRadialGradient(x, y, r * 0.8, x, y, r * 2.4);
        gr.addColorStop(0, 'rgba(255,246,200,0.35)'); gr.addColorStop(1, 'rgba(255,246,200,0)');
        c.fillStyle = gr; A.ell(c, x, y, r * 2.4, r * 2.4); c.fill();
        c.fillStyle = '#fff6d5'; A.ell(c, x, y, r, r); c.fill();
        c.fillStyle = 'rgba(214,200,160,0.5)';
        [[-0.35, -0.2, 0.18], [0.3, 0.25, 0.14], [0.1, -0.45, 0.1], [-0.15, 0.4, 0.09]].forEach(function (q) { A.ell(c, x + q[0] * r, y + q[1] * r, q[2] * r, q[2] * r); c.fill(); });
    }
    function hill(c, LW, LH) {
        var V = A.viewX(LW), wide = V[0] < 0;          // a wide screen: the ground goes on flat to the sides
        c.save();
        c.fillStyle = '#1d1a3e';
        c.beginPath(); c.moveTo(0, LH - 250); c.quadraticCurveTo(LW / 2, LH - 380, LW, LH - 250); c.lineTo(LW, LH); c.lineTo(0, LH); c.closePath(); c.fill();
        if (wide) { c.fillRect(V[0], LH - 250, 1 - V[0], 250); c.fillRect(LW - 1, LH - 250, V[1] - LW + 1, 250); }
        c.strokeStyle = 'rgba(190,200,255,0.35)'; c.lineWidth = 4;
        c.beginPath(); c.moveTo(0, LH - 250); c.quadraticCurveTo(LW / 2, LH - 380, LW, LH - 250); c.stroke();
        if (wide) { c.beginPath(); c.moveTo(V[0], LH - 250); c.lineTo(0, LH - 250); c.moveTo(LW, LH - 250); c.lineTo(V[1], LH - 250); c.stroke(); }
        c.restore();
    }
    function infoRow(c, G, LW) {
        var ch = chorus(G), n = sounds(ch), y = 318;
        c.save();
        A.roundRect(c, 40, y - 28, 330, 56, 28); c.fillStyle = 'rgba(16,12,40,0.7)'; c.fill(); c.lineWidth = 3; c.strokeStyle = ch >= 3 ? '#ffd23f' : 'rgba(255,255,255,0.35)'; c.stroke();
        A.roundRect(c, 390, y - 28, 290, 56, 28); c.fillStyle = 'rgba(16,12,40,0.7)'; c.fill(); c.strokeStyle = 'rgba(255,255,255,0.35)'; c.stroke();
        var k = K.clamp(G.rival / G.goal, 0, 1);
        A.roundRect(c, 520, y - 11, 140, 22, 11); c.fillStyle = 'rgba(255,255,255,0.15)'; c.fill();
        if (k > 0) { A.roundRect(c, 520, y - 11, Math.max(22, 140 * k), 22, 11); c.fillStyle = '#ff9a5a'; c.fill(); }
        c.restore();
        K.label(c, n === 1 ? t('howlSounds1') : t('howlSounds', { n: n }), 205, y + 1, ch >= 3 ? 26 : 24, ch >= 3 ? '#ffd23f' : '#fff4dc');
        K.label(c, t('howlRivalsLbl'), 456, y + 1, 22, '#ffd0b0');
    }

    function draw(c, G, env) {
        var LW = env.LW, LH = env.LH, clock = env.clock;
        A.world(c, LW, LH, clock, 1, 0, 1);
        var V = A.viewX(LW);                         // a wide screen: the night goes on to the sides
        c.fillStyle = 'rgba(12,10,40,0.45)'; c.fillRect(V[0], 0, V[1] - V[0], LH);
        moon(c, LW / 2, LH * 0.36, 128, clock);
        // the note lines
        var sx = G.shake > 0 ? Math.sin(clock * 60) * 6 : 0;
        c.save(); c.translate(sx, 0);
        for (var i = 0; i < LANES; i++) {
            var y = laneY(env, i), h = Math.min(56, gap(env) * 0.62), mine = G.howl && G.lane === i;
            A.roundRect(c, 24, y - h / 2, LW - 48, h, h / 2);
            c.fillStyle = mine ? (G.clash ? 'rgba(255,90,100,0.22)' : 'rgba(255,214,90,0.2)') : 'rgba(255,255,255,0.06)'; c.fill();
            c.fillStyle = 'rgba(255,255,255,0.4)'; A.ell(c, 44, y, 5 + i * 1.3, 5 + i * 1.3); c.fill();
        }
        G.ai.forEach(function (a, i) {
            if (!a.on) return;
            if (a.next >= 0) wave(c, env, a.next, a.color, 6, 0.6, i * 1.7, clock, false, true);
            if (a.lane >= 0 || a.amp > 0.02) wave(c, env, a.lane >= 0 ? a.lane : (a.last >= 0 ? a.last : 0), a.color, 8, a.amp, i * 1.7, clock);
        });
        if (G.amp > 0.02) wave(c, env, G.lane, G.clash ? '#ff4d5e' : '#ffd23f', 13, G.amp, 0, clock, G.clash);
        c.restore();
        // the hill, the pack and the pack the rivals imagine
        hill(c, LW, LH);
        G.ghosts.forEach(function (o, i) {
            if (o.a <= 0.02) return;
            c.save(); c.globalAlpha = o.a;
            A.dog(c, { g: o.g, seed: o.seed, age: 1 }, GHOSTS[i][0], LH - GHOSTS[i][1], 0.42, { t: clock, mood: 'howl', blink: 1 });
            c.restore();
        });
        G.ai.forEach(function (a) {
            var y = LH - a.h, singing = a.on && a.st === 'sing';
            c.save(); c.globalAlpha = a.on ? 0.75 : 0.25; A.ell(c, a.x, y + 3, 44, 11); c.fillStyle = a.color; c.fill(); c.restore();
            c.save(); if (!a.on) c.globalAlpha = 0.55;
            A.dog(c, { g: a.d.g, seed: a.d.seed, age: 1 }, a.x, y, 0.5, { t: clock, mood: singing ? 'howl' : 'calm', blink: singing ? 1 : 0, wag: 0.3, hop: a.hop, lookY: -0.5 });
            c.restore();
        });
        var px = LW / 2, py = LH - 205;
        G.x = px; G.y = py;
        K.drawDog(c, G, { t: clock, mood: G.howl ? 'howl' : 'calm', blink: G.howl ? 1 : 0, wag: 0.5, lookY: -0.5 });
        if (G.howl) {                                                    // sound rings from the singer
            for (var r = 0; r < 3; r++) {
                var u = (clock * 1.6 + r / 3) % 1;
                c.save(); c.globalAlpha = (1 - u) * 0.7; c.strokeStyle = G.clash ? '#ff8a8a' : '#fff3a0'; c.lineWidth = 4;
                c.beginPath(); c.arc(px, py - 150 * G.s, 30 + u * 70, Math.PI * 1.15, Math.PI * 1.85); c.stroke(); c.restore();
            }
        }
        // breath
        var bw = 220, bx = px - bw / 2, by = LH - 112, k = K.clamp(G.breath / G.B, 0, 1);
        c.save();
        A.roundRect(c, bx, by, bw, 18, 9); c.fillStyle = 'rgba(255,255,255,0.18)'; c.fill();
        if (k > 0) { A.roundRect(c, bx, by, Math.max(18, bw * k), 18, 9); c.fillStyle = k < 0.25 ? '#ff8a8a' : '#8fd8ff'; c.fill(); }
        A.roundRect(c, bx, by, bw, 18, 9); c.lineWidth = 3; c.strokeStyle = A.INK; c.stroke();
        c.restore();
        K.label(c, '💨', bx - 26, by + 9, 28, '#ffffff');
        infoRow(c, G, LW);
        K.hud(c, LW, G, TIME);
        if (G.hint) K.hintBox(c, LW, LH, t('howlHint'), 0.5);
    }

    W.minis = W.minis || [];
    W.minis.push({
        id: 'howl', icon: '🌕', title: 'howlTitle', fact: 'factHowl', skillText: 'skillHowl', unlock: 'howl',
        skill: function (g) { return 1 - g.tame / 100; },
        start: start, update: update, draw: draw, down: down, move: move, up: up, stop: stop,
        stats: function (G) { var n = sounds(G.chorusMax); return (n === 1 ? t('howlBest1') : t('howlBest', { n: n })) + '   ·   ' + t('howlBacks', { n: G.backs }); },
        bones: function (G) { return G.score * 0.14; }
    });
})();
