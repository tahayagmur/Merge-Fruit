/* Wolf to Woof - Point! Catch your dog's eye, then point: it runs the way you show.
 * Dogs follow a human point; wolves and chimpanzees mostly do not (Hare et al., Science
 * 2002). Belyaev's foxes, bred only for tameness, followed it as well as dogs (Hare et al.,
 * Current Biology 2005). And a dog follows a cue best right after a look into its eyes
 * (Téglás et al., Current Biology 2012). So: hold for eye contact, swipe, let go.
 * Treats hide in the grass; crows come for them. 45 seconds. */
(function () {
    'use strict';
    var W = window.WTW;
    var A = W.art, FX = W.fx, SFX = W.sfx, K = W.minikit;
    var t = function (k, p) { return W.i18n.t(k, p); };
    var TIME = 45, CATCH_R = 66, MAX_ITEMS = 5, DASH = 900;
    var PTS = { treat: 10, ball: 15, gold: 40 };

    function home(env) { return { x: env.LW / 2, y: env.LH - 210 }; }
    function field(env) { return { x0: 80, x1: env.LW - 80, y0: env.LH * 0.42, y1: env.LH * 0.70 }; }
    function gauss() { return (Math.random() + Math.random() + Math.random() - 1.5) * 1.15; }

    function start(d, env) {
        var tame = K.clamp(d.g.tame / 100, 0, 1), H = home(env);
        var G = {
            d: d, s: 0.74 * (0.82 + 0.3 * d.g.size), x: H.x, y: H.y, flip: 1, hop: 0, hopP: 0,
            st: 'ready', eye: 0, aim: null, dir: 0, carry: null, wait: 0, dashLeft: 0,
            eyeRate: 1 / (0.25 + 0.6 * (1 - tame)),             // eye contact takes 0.25 s (tame) .. 0.85 s (wolf)
            spread: (2 + 16 * (1 - tame)) * Math.PI / 180,      // how far it strays from your point
            ignore: 0.3 * (1 - tame) * (1 - tame),              // a wolfish dog sometimes follows its nose instead
            speed: 560 + 140 * (1 - d.g.size),
            items: [], crows: [], spawnT: 1.2, crowT: 3.5,
            time: TIME, score: 0, combo: 0, finds: 0, stolen: 0, over: false, t: 0, hint: !!env.first
        };
        for (var i = 0; i < 3; i++) spawnItem(G, env);
        return G;
    }
    function live(G) { return G.items.filter(function (it) { return !it.taken; }); }
    function spawnItem(G, env) {
        var F = field(env), x = 0, y = 0;
        for (var tries = 0; tries < 24; tries++) {
            x = F.x0 + Math.random() * (F.x1 - F.x0); y = F.y0 + Math.random() * (F.y1 - F.y0);
            var ok = live(G).every(function (it) { return Math.hypot(it.x - x, it.y - y) > 130; });
            if (ok && Math.hypot(x - env.LW / 2, y - (env.LH - 210)) > 170) break;
        }
        var r = Math.random(), kind = r < 0.1 ? 'gold' : r < 0.32 ? 'ball' : 'treat';
        G.items.push({ x: x, y: y, kind: kind, t: 0, life: kind === 'gold' ? 7 : 1e9, taken: false, ph: Math.random() * 6, crow: null });
    }
    function spawnCrow(G, env) {
        var free = live(G).filter(function (it) { return !it.crow; });
        if (!free.length) return;
        var it = free[Math.floor(Math.random() * free.length)];
        var left = Math.random() < 0.5;
        var cw = { x: left ? -50 : env.LW + 50, y: env.LH * (0.2 + Math.random() * 0.1), target: it, st: 'fly', flip: left ? 1 : -1,
            speed: 105 + Math.min(95, (TIME - G.time) * 2.4), flap: Math.random() * 6, peck: 0, carry: null };
        it.crow = cw; G.crows.push(cw);
        SFX.play('caw');
    }

    /* ---- pointer: hold for eye contact, swipe to point, let go ---- */
    function down(G, p) {
        if (G.over || G.st !== 'ready') return;
        G.st = 'look'; G.eye = 0; G.eyeDone = false; G.aim = { sx: p.x, sy: p.y, x: p.x, y: p.y }; G.hint = false;
    }
    function move(G, p) { if (G.st === 'look' && G.aim) { G.aim.x = p.x; G.aim.y = p.y; } }
    function up(G, p) {
        if (G.st !== 'look' || !G.aim) return;
        if (p) { G.aim.x = p.x; G.aim.y = p.y; }
        var dx = G.aim.x - G.aim.sx, dy = G.aim.y - G.aim.sy, len = Math.hypot(dx, dy);
        G.aim = null;
        if (G.eye < 1) {                                   // a point without a look first means little to a dog
            G.st = 'ready';
            FX.text(G.x, G.y - 150, t('pointLookFirst'), '#ffe0c0', 32); SFX.play('wrong');
            return;
        }
        if (len < 36) { G.st = 'ready'; return; }
        var ang = Math.atan2(dy, dx);
        if (Math.random() < G.ignore) {
            var near = nearest(G);
            ang = near ? Math.atan2(near.y - G.y, near.x - G.x) + (Math.random() - 0.5) * 0.7 : ang + (Math.random() - 0.5) * 1.2;
            FX.text(G.x, G.y - 150, t('pointOwnWay'), '#ffd6a0', 30);
        } else ang += gauss() * G.spread;
        G.dir = ang; G.st = 'dash'; G.dashLeft = DASH;
        SFX.play('whoosh');
    }
    function nearest(G) {
        var best = null, bd = 1e9;
        live(G).forEach(function (it) { var dd = Math.hypot(it.x - G.x, it.y - G.y); if (dd < bd) { bd = dd; best = it; } });
        return best;
    }

    function grab(G, it) {
        it.taken = true; G.finds++; G.combo++;
        var pts = PTS[it.kind] + 5 * (G.combo - 1);
        G.score += pts; G.st = 'grab'; G.wait = 0.25; G.carry = it.kind;
        var gold = it.kind === 'gold';
        FX.text(it.x, it.y - 70, (gold ? t('pointGold') : t('pointFound')) + ' +' + pts, gold ? '#fff36b' : '#b9ff8a', gold ? 42 : 36);
        if (G.combo >= 2) FX.text(it.x, it.y - 118, t('combo', { n: G.combo }), '#ffb3d9', 30);
        FX.confetti(it.x, it.y - 30, 14 + G.combo * 6);
        if (gold) FX.sparkle(it.x, it.y - 30, 18, '#fff6a0');
        SFX.play('good'); SFX.play('pop', 2 + G.combo * 2);
        if (it.crow) { it.crow.st = 'leave'; it.crow.target = null; }
    }
    function finish(G, env) {
        if (G.over) return;
        G.over = true; G.aim = null;
        if (G.st === 'look' || G.st === 'dash') G.st = 'return';
        if (env.onEnd) env.onEnd(G);
    }

    function update(G, dt, env) {
        var H = home(env);
        G.t += dt;
        if (!G.over) { G.time -= dt; if (G.time <= 0) { G.time = 0; finish(G, env); } }
        if (G.st === 'look') {
            G.eye = Math.min(1, G.eye + dt * G.eyeRate);
            if (G.eye >= 1 && !G.eyeDone) { G.eyeDone = true; SFX.play('heart'); FX.text(G.x, G.y - 160, '♥', '#ff7fb4', 40); }
        }
        // treats come and go, crows come for them
        G.items.forEach(function (it) {
            it.t += dt;
            if (it.kind === 'gold' && !it.taken && it.t > it.life) { it.taken = true; if (it.crow) { it.crow.st = 'leave'; it.crow.target = null; } }
        });
        G.items = G.items.filter(function (it) { return !it.taken; });
        if (!G.over) {
            G.spawnT -= dt;
            if (G.spawnT <= 0) { if (live(G).length < MAX_ITEMS) spawnItem(G, env); G.spawnT = 1.5 + Math.random() * 1.1; }
            G.crowT -= dt;
            if (G.crowT <= 0) { spawnCrow(G, env); G.crowT = Math.max(1.7, 4.2 - (TIME - G.time) * 0.055) + Math.random() * 0.8; }
        }
        G.crows.forEach(function (cw) {
            cw.flap += dt * 14; cw.age = (cw.age || 0) + dt;
            if (cw.st === 'fly') {
                var it = cw.target;
                if (!it || it.taken) { cw.st = 'leave'; return; }
                var dx = it.x - cw.x, dy = it.y - 16 - cw.y, dist = Math.hypot(dx, dy);
                if (dist < 6) { cw.st = 'peck'; cw.peck = 0.75; }
                else { var st = Math.min(dist, cw.speed * dt); cw.x += dx / dist * st; cw.y += dy / dist * st; cw.flip = dx < 0 ? -1 : 1; }
            } else if (cw.st === 'peck') {
                cw.peck -= dt;
                if (!cw.target || cw.target.taken) cw.st = 'leave';
                else if (cw.peck <= 0) {
                    cw.target.taken = true; cw.carry = cw.target.kind; cw.target = null;
                    G.stolen++; G.combo = 0;
                    FX.text(cw.x, cw.y - 46, t('pointStolen'), '#ffb0b0', 32); SFX.play('caw');
                    cw.st = 'leave';
                }
            } else if (cw.st === 'leave') {
                cw.y -= 170 * dt; cw.x += cw.flip * 130 * dt;
                if (cw.y < -90) cw.gone = true;
            }
        });
        G.crows = G.crows.filter(function (cw) { return !cw.gone; });

        switch (G.st) {
            case 'dash':
                var stp = G.speed * dt;
                G.x += Math.cos(G.dir) * stp; G.y += Math.sin(G.dir) * stp; G.dashLeft -= stp;
                G.flip = Math.cos(G.dir) < 0 ? -1 : 1; G.hopP += dt * 15; G.hop = Math.abs(Math.sin(G.hopP)) * 10; G.walking = 2;
                var hit = null;
                live(G).forEach(function (it) { if (!hit && Math.hypot(it.x - G.x, it.y - G.y) < CATCH_R) hit = it; });
                if (hit) grab(G, hit);
                else if (G.dashLeft <= 0 || G.x < 40 || G.x > env.LW - 40 || G.y < env.LH * 0.36 || G.y > env.LH - 140) {
                    G.combo = 0; G.st = 'sniff'; G.wait = 0.45;
                    FX.text(G.x, G.y - 130, t('pointNothing'), '#ffe0c0', 28); SFX.play('flee');
                }
                break;
            case 'grab':
                G.wait -= dt; G.hop = Math.max(0, G.hop - dt * 300);
                if (G.wait <= 0) G.st = 'return';
                break;
            case 'sniff':
                G.wait -= dt; G.hop = 0;
                if (G.wait <= 0) G.st = 'return';
                break;
            case 'return':
                if (K.moveTo(G, H.x, H.y, 640, dt)) {
                    G.st = 'ready'; G.hop = 0;
                    if (G.carry) { G.carry = null; SFX.play('munch'); }
                }
                break;
        }
    }

    /* ---------------------------------------------------------------- drawing */
    function drawItem(c, it, clock) {
        var x = it.x, y = it.y, tw = 0.5 + 0.5 * Math.sin(clock * 5 + it.ph);
        if (it.kind === 'gold') {
            var left = Math.max(0, it.life - it.t);
            var gr = c.createRadialGradient(x, y - 8, 4, x, y - 8, 60);
            gr.addColorStop(0, 'rgba(255,236,120,' + (0.55 + 0.25 * tw) + ')'); gr.addColorStop(1, 'rgba(255,236,120,0)');
            c.fillStyle = gr; c.fillRect(x - 64, y - 72, 128, 128);
            if (left < 2.5 && Math.floor(clock * 8) % 2) return;     // blinks before it is gone
        }
        c.save();
        var pic = { treat: ['it_treat', 46, 0], ball: ['it_ball', 44, 0], gold: ['it_gold', 54, -0.3] }[it.kind];
        if (W.sprites && W.sprites.item(c, pic[0], x, y - 12, pic[1], { rot: pic[2] })) { /* painted */ }
        else if (it.kind === 'treat') A.treat(c, x, y - 8, 1.8);
        else if (it.kind === 'ball') {
            A.ell(c, x, y - 12, 18, 18); c.fillStyle = '#ff5f6d'; c.fill(); c.lineWidth = 3; c.strokeStyle = A.INK; c.stroke();
            c.beginPath(); c.arc(x, y - 12, 18, -0.9, 0.9); c.strokeStyle = '#fff4dc'; c.lineWidth = 4; c.stroke();
        } else {
            A.bone(c, x, y - 10, 2.2, -0.3);
            c.globalCompositeOperation = 'source-atop';
            c.fillStyle = 'rgba(255,196,40,0.55)'; c.fillRect(x - 40, y - 40, 80, 60);
            c.globalCompositeOperation = 'source-over';
        }
        // it hides in a tuft of tall grass
        c.strokeStyle = '#3f8f35'; c.lineCap = 'round'; c.lineWidth = 5;
        for (var i = -3; i <= 3; i++) {
            var bx = x + i * 9, h = 30 + (i % 2 ? 7 : 0) + Math.abs(i) * -2;
            c.beginPath(); c.moveTo(bx, y + 4); c.quadraticCurveTo(bx + i * 2, y - h * 0.6, bx + i * 3 + Math.sin(clock * 2 + i) * 2, y - h); c.stroke();
        }
        c.restore();
        A.star(c, x + 18, y - 44, 10 + 6 * tw, 'rgba(255,251,224,' + (0.65 + 0.35 * tw) + ')');
        A.star(c, x - 16, y - 30, 5 + 3 * (1 - tw), 'rgba(255,251,224,' + (0.5 + 0.4 * (1 - tw)) + ')');
    }
    function carried(c, kind, x, y, k) {
        var pic = { treat: 'it_treat', ball: 'it_ball', gold: 'it_gold' }[kind] || 'it_gold';
        return W.sprites && W.sprites.item(c, pic, x, y, 34 * k);
    }
    var FLAP = [0, 1, 3, 1];                          // wings up, half, down, half: one beat of the wings
    /* a wide screen shows the sky the crows come from: there they fade in instead of popping up */
    function drawCrow(c, cw) {
        if (A.viewX(720)[0] < 0 && (cw.age || 0) < 0.35) { c.save(); c.globalAlpha *= (cw.age || 0) / 0.35; crowArt(c, cw); c.restore(); }
        else crowArt(c, cw);
    }
    function crowArt(c, cw) {
        // in the air: the painted wing beat (frames line up on the body, facing left like the standing crow)
        var fr = cw.st !== 'peck' && W.sprites && W.sprites.get('fly_crow_' + FLAP[Math.floor(cw.flap / (Math.PI / 2)) % 4]);
        if (fr) {
            var h = 96, w = h * fr.width / fr.height;
            c.save(); c.imageSmoothingQuality = 'high';
            c.translate(cw.x, cw.y + 16); c.scale(cw.flip > 0 ? -1 : 1, 1);
            c.drawImage(fr, -w * 0.547, -h * 0.988, w, h);
            c.restore();
            if (cw.carry) carried(c, cw.carry, cw.x + cw.flip * 14, cw.y + 24, 1);
            return;
        }
        if (W.sprites && W.sprites.get('crow')) {
            // on the ground: the standing crow dips its head to peck
            var dip = cw.st === 'peck' ? Math.max(0, Math.sin(cw.flap * 1.3)) : 0;
            W.sprites.item(c, 'crow', cw.x, cw.y, 78, { flip: cw.flip > 0, rot: cw.flip * 0.28 * dip });
            if (cw.carry) carried(c, cw.carry, cw.x + cw.flip * 40, cw.y + 22, 1);
            return;
        }
        c.save(); c.translate(cw.x, cw.y); c.scale(cw.flip * 1.45, 1.45);
        var w = Math.sin(cw.flap) * 0.8;
        c.fillStyle = '#2b2733'; c.strokeStyle = A.INK; c.lineWidth = 2.5;
        c.beginPath(); c.moveTo(-6, -4); c.lineTo(-34, -10 - w * 26); c.lineTo(-14, 4); c.closePath(); c.fill(); c.stroke();
        A.ell(c, 0, 0, 20, 12); c.fill(); c.stroke();
        A.ell(c, 18, -6, 10, 9); c.fill(); c.stroke();
        c.fillStyle = '#ffcf3f'; c.beginPath(); c.moveTo(26, -7); c.lineTo(38, -3); c.lineTo(26, -1); c.closePath(); c.fill(); c.stroke();
        c.fillStyle = '#ffffff'; A.ell(c, 20, -8, 2.6, 2.6); c.fill();
        c.beginPath(); c.moveTo(4, -4); c.lineTo(-22, -14 + w * 26); c.lineTo(-6, 5); c.closePath(); c.fillStyle = '#3a3542'; c.fill(); c.stroke();
        c.restore();
        if (cw.carry) { if (cw.carry === 'treat') A.treat(c, cw.x + cw.flip * 42, cw.y + 14, 1.3); else A.bone(c, cw.x + cw.flip * 42, cw.y + 14, 1.4, 0); }
    }
    function headY(G) { return K.headY(G); }

    function draw(c, G, env) {
        var LW = env.LW, LH = env.LH, clock = env.clock;
        A.world(c, LW, LH, clock, 0, 0.05, 1);
        live(G).forEach(function (it) { drawItem(c, it, clock); });
        var looking = G.st === 'look';
        // where the dog will run: your pointing arrow
        if (looking && G.aim) {
            var dx = G.aim.x - G.aim.sx, dy = G.aim.y - G.aim.sy, len = Math.hypot(dx, dy);
            if (len > 18) {
                var a = Math.atan2(dy, dx), ready = G.eye >= 1, L = 300, x0 = G.x, y0 = G.y - 30;
                var x1 = x0 + Math.cos(a) * L, y1 = y0 + Math.sin(a) * L;
                c.save();
                c.lineCap = 'round'; c.setLineDash(ready ? [] : [14, 12]);
                c.strokeStyle = ready ? 'rgba(255,228,92,0.95)' : 'rgba(255,255,255,0.55)'; c.lineWidth = ready ? 12 : 8;
                c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); c.setLineDash([]);
                c.fillStyle = c.strokeStyle;
                c.beginPath(); c.moveTo(x1 + Math.cos(a) * 26, y1 + Math.sin(a) * 26);
                c.lineTo(x1 + Math.cos(a + 2.4) * 26, y1 + Math.sin(a + 2.4) * 26); c.lineTo(x1 + Math.cos(a - 2.4) * 26, y1 + Math.sin(a - 2.4) * 26);
                c.closePath(); c.fill();
                c.restore();
            }
        }
        // a soft spot marks where the dog waits for you
        var H = home(env);
        if (G.st === 'ready' && !G.over) {
            var pul = 0.5 + 0.5 * Math.sin(clock * 6);
            c.strokeStyle = 'rgba(255,245,200,' + (0.4 + 0.4 * pul) + ')'; c.lineWidth = 5;
            c.beginPath(); c.ellipse(H.x, H.y + 4, 70 + pul * 6, 22 + pul * 2, 0, 0, Math.PI * 2); c.stroke();
        }
        K.drawDog(c, G, {
            t: clock, mood: G.carry || looking ? 'happy' : 'calm', wag: looking ? 1 : 0.6, flip: G.flip, hop: G.hop,
            lookX: looking ? 0 : G.flip * 0.5, lookY: looking ? 0.35 : 0, gaze: looking ? G.eye : 0, brow: looking ? G.eye : 0
        });
        if (G.carry) {
            var my = K.mouthY(G), mx = K.mouthX(G);
            if (carried(c, G.carry, mx, my, 1)) { /* painted */ }
            else if (G.carry === 'treat') A.treat(c, mx, my, 1.1);
            else if (G.carry === 'ball') { A.ell(c, mx, my, 12, 12); c.fillStyle = '#ff5f6d'; c.fill(); c.lineWidth = 2.5; c.strokeStyle = A.INK; c.stroke(); }
            else A.bone(c, mx, my, 1.4, 0);
        }
        // the eye-contact ring fills around its head
        if (looking) {
            var hy = headY(G);
            c.save(); c.lineCap = 'round';
            c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 8;
            c.beginPath(); c.arc(G.x, hy, 52, 0, Math.PI * 2); c.stroke();
            c.strokeStyle = G.eye >= 1 ? '#ff7fb4' : '#fff4dc'; c.lineWidth = 8;
            c.beginPath(); c.arc(G.x, hy, 52, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * G.eye); c.stroke();
            c.restore();
            if (G.eye >= 1) A.heart(c, G.x + 48, hy - 46, 1.3 + 0.12 * Math.sin(clock * 10), '#ff5f9e');
        }
        G.crows.forEach(function (cw) { drawCrow(c, cw); });
        K.hud(c, LW, G, TIME);
        if (G.hint) K.hintBox(c, LW, LH, t('pointHint'), 0.33);
    }

    W.minis = W.minis || [];
    W.minis.push({
        id: 'point', icon: '👉', title: 'pointTitle', fact: 'factPoint', skillText: 'skillPoint', unlock: null,
        skill: function (g) { return g.tame / 100; },
        start: start, update: update, draw: draw, down: down, move: move, up: up,
        stats: function (G) { return t('pointFinds') + ' ' + G.finds + '   ·   🐦 ' + G.stolen; },
        bones: function (G) { return G.score * 0.25; }
    });
})();
