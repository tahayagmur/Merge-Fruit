/* Wolf to Woof - Scent Match. Every smell is drawn as a little ring of molecules; tap the
 * jar that smells exactly like the lost mitten and your dog runs over to sniff it. Police
 * dogs really work scent line-ups with jars like these. Primates lost many smell genes as
 * colour vision came in (Gilad et al., PLoS Biology 2004): the dog became our nose. Long
 * nosed dogs beat short-nosed breeds in a natural detection task (Polgar et al., PLoS ONE
 * 2016), so a long snout earns more sniff hints. 45 seconds. */
(function () {
    'use strict';
    var W = window.WTW;
    var A = W.art, FX = W.fx, SFX = W.sfx, K = W.minikit;
    var t = function (k, p) { return W.i18n.t(k, p); };
    var TIME = 45, DASH = 1400;
    var MCOL = ['#ff4d5e', '#ffd23f', '#3fa9ff', '#46d16a', '#a66bff'];
    var NSHAPE = 5;                                           // circle, triangle, square, star, heart

    function home(env) { return { x: env.LW / 2, y: env.LH - 190 }; }
    function nose(env) { return { x: 96, y: env.LH - 205 }; }
    function targetY(env) { return env.LH * 0.335; }
    /* sniff hints: 1 for a flat face, up to 4 for a wolf's long snout */
    function hintsFor(g) { return 1 + Math.round(K.clamp((g.snout - 0.3) / 0.6, 0, 1) * 3); }

    function start(d, env) {
        var H = home(env);
        var G = {
            d: d, s: 0.6 * (0.82 + 0.3 * d.g.size), x: H.x, y: H.y, flip: 1, hop: 0, hopP: 0,
            st: 'home', jar: null, wait: 0, sniffT: 0,
            hints: hintsFor(d.g),                                     // a long snout smells more
            level: 1, matches: 0, wrongs: 0, target: null, cands: [], roundT: 0,
            time: TIME, score: 0, combo: 0, over: false, t: 0, hint: !!env.first
        };
        newRound(G, env);
        return G;
    }

    /* ---------------------------------------------------------------- the puzzle */
    function randSig(k) {
        var s = [];
        for (var i = 0; i < k; i++) s.push({ shape: Math.floor(Math.random() * NSHAPE), color: Math.floor(Math.random() * MCOL.length) });
        return s;
    }
    function eq(a, b, off) {
        for (var i = 0; i < a.length; i++) { var m = a[i], n = b[(i + off) % b.length]; if (m.shape !== n.shape || m.color !== n.color) return false; }
        return true;
    }
    /* the same smell, also when the ring is turned (once rings rotate, a turned copy is the same smell) */
    function same(a, b, turned) {
        if (a.length !== b.length) return false;
        for (var o = 0; o < (turned ? a.length : 1); o++) if (eq(a, b, o)) return true;
        return false;
    }
    /* a near miss: the target with one or two molecules changed */
    function decoy(target, changes) {
        var s = target.map(function (m) { return { shape: m.shape, color: m.color }; });
        K.shuffle(target.map(function (_, i) { return i; })).slice(0, changes).forEach(function (i) {
            if (Math.random() < 0.5) s[i].color = (s[i].color + 1 + Math.floor(Math.random() * (MCOL.length - 1))) % MCOL.length;
            else s[i].shape = (s[i].shape + 1 + Math.floor(Math.random() * (NSHAPE - 1))) % NSHAPE;
        });
        return s;
    }
    function rules(L) {
        return { n: L === 1 ? 4 : 6, k: L <= 2 ? 3 : 4, turned: L >= 3, one: L >= 4, spin: L >= 5 };
    }
    function newRound(G, env) {
        var R = rules(G.level);
        G.target = randSig(R.k);
        var sigs = [{ sig: G.target, ok: true }], tries = 0;
        while (sigs.length < R.n && tries++ < 400) {
            var s = decoy(G.target, R.one ? 1 : (Math.random() < 0.5 ? 1 : 2));
            if (sigs.some(function (m) { return same(m.sig, s, R.turned); })) continue;
            sigs.push({ sig: s, ok: false });
        }
        K.shuffle(sigs);
        // two rows between the mitten and the dog; the jars shrink a little on short screens
        var cols = R.n === 4 ? 2 : 3, y0 = targetY(env) + 100, y1 = env.LH - 290, rowH = (y1 - y0) / 2;
        var k = Math.min(R.n === 4 ? 1.25 : 1.1, rowH / 205);
        G.cands = sigs.map(function (c, i) {
            var col = i % cols, row = Math.floor(i / cols);
            return {
                sig: c.sig, ok: c.ok, k: k,
                x: cols === 2 ? env.LW / 2 + (col ? 150 : -150) : env.LW / 2 + (col - 1) * 220,
                y: y0 + rowH * (row + 0.5) + 60 * k,
                rot: R.turned ? Math.random() * Math.PI * 2 : 0, spin: R.spin ? (Math.random() < 0.5 ? -1 : 1) * 0.7 : 0,
                off: false, cross: false, shake: 0, pop: 0, delay: i * 0.05
            };
        });
        G.roundT = 0;
    }

    /* ---------------------------------------------------------------- input */
    function down(G, p, env) {
        if (G.over) return;
        if (G.hint) { G.hint = false; SFX.play('tap'); return; }          // the first tap only closes the hint
        var N = nose(env);
        if (Math.hypot(p.x - N.x, p.y - N.y) < 72) { sniffHint(G); return; }
        if (G.st === 'toJar' || G.st === 'sniff' || G.st === 'sneeze') return;
        var hit = null;
        G.cands.forEach(function (c) {
            if (!c.off && Math.abs(p.x - c.x) < 95 * c.k && p.y > c.y - 165 * c.k && p.y < c.y + 50 * c.k) hit = c;
        });
        if (!hit) return;
        G.jar = hit; G.st = 'toJar';
        SFX.play('tap');
    }
    function sniffHint(G) {
        if (G.hints <= 0) { FX.text(170, G.y - 150, t('scentNoHints'), '#ffe0c0', 28); SFX.play('wrong'); return; }
        var wrong = G.cands.filter(function (c) { return !c.ok && !c.off; });
        if (wrong.length < 2) return;                                    // nothing left worth ruling out
        G.hints--;
        K.shuffle(wrong).slice(0, Math.min(2, wrong.length - 1)).forEach(function (c) { c.off = true; c.shake = 0.4; });
        SFX.play('munch'); FX.sparkle(96, G.y - 60, 14, '#fff6a0');
    }
    function judge(G, env) {
        var c = G.jar;
        if (c.ok) {
            G.combo++; G.matches++;
            var pts = 10 + G.level * 2 + (G.combo >= 3 ? Math.min(10, G.combo) : 0) + (G.roundT < 3 ? 4 : 0);
            G.score += pts;
            FX.text(c.x, c.y - 200 * c.k, t('scentRight') + ' +' + pts, '#b9ff8a', 38);
            FX.confetti(c.x, c.y - 100 * c.k, 18 + G.combo * 4); FX.sparkle(c.x, c.y - 100 * c.k, 10, '#fff6a0'); SFX.play('good');
            if (G.matches % 3 === 0) {
                G.level++;
                FX.text(env.LW / 2, targetY(env) + 110, t('scentLevelUp', { n: G.level }), '#fff36b', 40); SFX.play('grow');
            }
            G.st = 'happy'; G.wait = 0.35;
            if (!G.over) newRound(G, env);
        } else {
            G.combo = 0; G.wrongs++; G.time = Math.max(0, G.time - 2);
            c.off = true; c.cross = true; c.shake = 0.5;
            FX.text(c.x, c.y - 200 * c.k, t('scentWrong'), '#ffd0c0', 36); SFX.play('wrong');
            G.st = 'sneeze'; G.wait = 0.45;
        }
    }

    function update(G, dt, env) {
        var H = home(env);
        G.t += dt;
        if (!G.over && !G.hint) {
            G.roundT += dt; G.time -= dt;
            if (G.time <= 0) { G.time = 0; G.over = true; if (env.onEnd) env.onEnd(G); }
        }
        G.cands.forEach(function (c) {
            if (c.delay > 0) c.delay -= dt; else c.pop = Math.min(1, c.pop + dt * 5);
            c.shake = Math.max(0, c.shake - dt); c.rot += c.spin * dt;
        });
        switch (G.st) {
            case 'toJar':
                if (K.moveTo(G, G.jar.x, G.jar.y + 72 * G.jar.k, DASH, dt)) { G.st = 'sniff'; G.wait = 0.28; G.hop = 0; SFX.play('munch'); }
                break;
            case 'sniff':
                G.wait -= dt; G.sniffT += dt;
                if (G.sniffT > 0.07) { G.sniffT = 0; FX.add({ k: 'spark', x: G.jar.x + (Math.random() - 0.5) * 50, y: G.jar.y - 40 * G.jar.k, vx: (G.x - G.jar.x) * 0.5, vy: 160, life: 0.35, r: 4, c: '#ffffff' }); }
                if (G.wait <= 0) { if (G.over) G.st = 'back'; else judge(G, env); }   // time up: the last sniff does not count
                break;
            case 'happy':
                G.wait -= dt; G.hop = Math.abs(Math.sin(G.t * 14)) * 12;
                if (G.wait <= 0) { G.hop = 0; G.st = 'back'; }
                break;
            case 'sneeze':
                G.wait -= dt;
                if (G.wait <= 0) G.st = 'back';
                break;
            case 'back':
                if (K.moveTo(G, H.x, H.y, DASH * 0.7, dt)) { G.st = 'home'; G.hop = 0; }
                break;
        }
    }

    /* ---------------------------------------------------------------- drawing */
    function molecule(c, x, y, r, m) {
        c.beginPath();
        switch (m.shape) {
            case 0: c.arc(x, y, r, 0, Math.PI * 2); break;
            case 1: c.moveTo(x, y - r * 1.15); c.lineTo(x + r * 1.1, y + r * 0.85); c.lineTo(x - r * 1.1, y + r * 0.85); c.closePath(); break;
            case 2: c.rect(x - r * 0.88, y - r * 0.88, r * 1.76, r * 1.76); break;
            case 3:
                for (var i = 0; i < 10; i++) { var a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.5 : r * 1.2; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
                c.closePath(); break;
            case 4:
                c.moveTo(x, y + r * 1.05);
                c.bezierCurveTo(x - r * 1.5, y - r * 0.1, x - r * 0.8, y - r * 1.35, x, y - r * 0.5);
                c.bezierCurveTo(x + r * 0.8, y - r * 1.35, x + r * 1.5, y - r * 0.1, x, y + r * 1.05);
                c.closePath(); break;
        }
        c.fillStyle = MCOL[m.color]; c.fill(); c.lineWidth = Math.max(2, r / 4.5); c.strokeStyle = A.INK; c.stroke();
    }
    function cloud(c, x, y, R, clock, ph) {
        var b = 1 + 0.03 * Math.sin(clock * 2.4 + ph);
        c.save(); c.fillStyle = 'rgba(255,250,240,0.93)';
        [[0, 0, 1], [-0.62, 0.16, 0.68], [0.62, 0.16, 0.68], [-0.32, -0.36, 0.64], [0.36, -0.3, 0.6]].forEach(function (q) {
            A.ell(c, x + q[0] * R, y + q[1] * R, R * q[2] * b, R * q[2] * 0.86 * b); c.fill();
        });
        c.restore();
    }
    function ring(c, x, y, R, r, s, rot, clock, ph) {
        var pts = s.map(function (_, i) {
            var a = rot + i * Math.PI * 2 / s.length - Math.PI / 2;
            return { x: x + Math.cos(a) * R, y: y + Math.sin(a) * R + Math.sin(clock * 3 + ph + i) * r * 0.08 };
        });
        c.save(); c.strokeStyle = 'rgba(90,58,42,0.45)'; c.lineWidth = Math.max(2, r / 4); c.setLineDash([r * 0.5, r * 0.4]);
        c.beginPath(); pts.forEach(function (p, i) { if (i) c.lineTo(p.x, p.y); else c.moveTo(p.x, p.y); }); c.closePath(); c.stroke();
        c.restore();
        s.forEach(function (m, i) { molecule(c, pts[i].x, pts[i].y, r, m); });
    }
    function jar(c, cd, clock) {
        var dx = cd.shake > 0 ? Math.sin(clock * 50) * 6 : 0;
        var painted = W.sprites && W.sprites.item(c, 'jar', cd.x + dx, cd.y - 10 * cd.k, 106 * cd.k, { alpha: cd.off ? 0.4 : 1 });
        c.save(); c.translate(cd.x + dx, cd.y); c.scale(cd.k, cd.k);
        if (!painted) {
            c.globalAlpha = cd.off ? 0.4 : 1;
            c.lineWidth = 4; c.strokeStyle = A.INK; c.lineJoin = 'round';
            A.roundRect(c, -38, -42, 76, 80, 18); c.fillStyle = 'rgba(205,238,255,0.92)'; c.fill(); c.stroke();
            A.roundRect(c, -42, -58, 84, 20, 8); c.fillStyle = '#c4874e'; c.fill(); c.stroke();
            c.fillStyle = 'rgba(255,255,255,0.65)'; A.roundRect(c, -27, -30, 9, 52, 4); c.fill();
            c.fillStyle = '#f4dcb6'; A.roundRect(c, -22, -2, 44, 26, 7); c.fill(); c.lineWidth = 2.5; c.stroke();
            c.globalAlpha = 1;
        }
        if (cd.cross) {
            c.strokeStyle = '#ff4d5e'; c.lineWidth = 10; c.lineCap = 'round';
            c.beginPath(); c.moveTo(-30, -36); c.lineTo(30, 30); c.moveTo(30, -36); c.lineTo(-30, 30); c.stroke();
        }
        c.restore();
    }
    function mitten(c, x, y, clock) {
        if (W.sprites && W.sprites.item(c, 'mitten', x, y, 122, { rot: -0.22 + Math.sin(clock * 1.6) * 0.05 })) return;
        c.save(); c.translate(x, y); c.rotate(-0.22 + Math.sin(clock * 1.6) * 0.05); c.scale(1.25, 1.25);
        c.lineWidth = 4; c.strokeStyle = A.INK; c.lineJoin = 'round'; c.fillStyle = '#e8463c';
        c.beginPath(); c.moveTo(-26, 34); c.lineTo(-28, -10); c.quadraticCurveTo(-28, -42, 0, -42); c.quadraticCurveTo(26, -42, 26, -6); c.lineTo(24, 34); c.closePath(); c.fill(); c.stroke();
        c.beginPath(); c.moveTo(25, 2); c.quadraticCurveTo(48, -4, 45, 14); c.quadraticCurveTo(42, 28, 24, 22); c.closePath(); c.fill(); c.stroke();
        c.fillStyle = '#fff4dc';
        [[-12, -18], [8, -8], [-6, 8]].forEach(function (q) { A.ell(c, q[0], q[1], 5, 5); c.fill(); });
        A.roundRect(c, -31, 26, 60, 17, 6); c.fill(); c.stroke();
        c.restore();
    }

    function draw(c, G, env) {
        var LW = env.LW, LH = env.LH, clock = env.clock, ty = targetY(env);
        A.world(c, LW, LH, clock, 0, 0.18, 1);
        // the line-up table
        var top = ty + 90, bot = LH - 282;
        c.save();
        A.roundRect(c, 30, top, LW - 60, bot - top, 34); c.fillStyle = 'rgba(255,233,209,0.88)'; c.fill(); c.lineWidth = 5; c.strokeStyle = A.INK; c.stroke();
        c.restore();
        G.cands.forEach(function (cd, i) {
            if (cd.pop <= 0) return;
            var e = cd.pop < 1 ? 1 + Math.sin(cd.pop * Math.PI) * 0.15 : 1;
            c.save(); c.translate(cd.x, cd.y); c.scale(cd.pop * e, cd.pop * e); c.translate(-cd.x, -cd.y);
            jar(c, cd, clock);
            if (!cd.off) {
                cloud(c, cd.x, cd.y - 112 * cd.k, 60 * cd.k, clock, i);
                ring(c, cd.x, cd.y - 112 * cd.k, 32 * cd.k, 15 * cd.k, cd.sig, cd.rot, clock, i);
            }
            c.restore();
        });
        // the lost mitten and its smell, big
        mitten(c, LW / 2 - 165, ty + 12, clock);
        cloud(c, LW / 2 + 70, ty - 4, 106, clock, 0);
        ring(c, LW / 2 + 70, ty - 4, 54, 23, G.target, 0, clock, 0);
        K.label(c, t('scentFind'), LW / 2 - 165, ty - 74, 28, '#fff4dc');
        // the nose button: sniff hints left
        var N = nose(env), on = G.hints > 0;
        c.save();
        if (on) { c.globalAlpha = 0.35 + 0.25 * Math.sin(clock * 4); A.ell(c, N.x, N.y, 66, 66); c.fillStyle = '#fff36b'; c.fill(); c.globalAlpha = 1; }
        A.ell(c, N.x, N.y, 54, 54); c.fillStyle = on ? '#fff8ec' : 'rgba(255,248,236,0.55)'; c.fill(); c.lineWidth = 5; c.strokeStyle = A.INK; c.stroke();
        c.globalAlpha = on ? 1 : 0.5;
        c.font = '52px system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('👃', N.x, N.y + 3);
        c.restore();
        K.label(c, '× ' + G.hints, N.x + 62, N.y + 36, 30, on ? '#fff4dc' : '#c8b8a8', 'left');
        var mood = G.st === 'happy' ? 'happy' : G.st === 'sneeze' ? 'scared' : 'calm';
        K.drawDog(c, G, { t: clock, mood: mood, wag: G.st === 'happy' ? 1 : 0.5, flip: G.flip, hop: G.hop, lookY: G.st === 'sniff' ? -0.6 : 0 });
        K.label(c, t('scentLevel', { n: G.level }), LW - 50, LH - 140, 30, '#fff4dc', 'right');
        K.hud(c, LW, G, TIME);
        if (G.hint) K.hintBox(c, LW, LH, t('scentHint'), (top + bot) / 2 / LH);
    }

    W.minis = W.minis || [];
    W.minis.push({
        id: 'scent', icon: '👃', title: 'scentTitle', fact: 'factScent', skillText: 'skillScent', unlock: 'scent',
        skill: function (g) { return (g.snout - 0.3) / 0.6; },
        tag: function (d) { return '👃×' + hintsFor(d.g); },
        start: start, update: update, draw: draw, down: down,
        stats: function (G) { return t('scentMatches') + ' ' + G.matches + '   ·   ' + t('scentLevel', { n: G.level }); },
        bones: function (G) { return G.score * 0.18; }
    });
})();
