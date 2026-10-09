/* Wolf to Woof - Fetch! Throw the stick where your dog is about to be.
 * Retrieving is a domestication story of its own: most wolves ignore a thrown
 * ball, yet a few wolf pups bring it back (Hansen Wheat & Temrin, iScience 2020).
 * The dog runs along a track; a stick that lands close enough ahead of it is
 * caught in the air. Catches in a row build a combo. Five sticks per round. */
(function () {
    'use strict';
    var W = window.WTW;
    var A = W.art, FX = W.fx, SFX = W.sfx;
    var t = function (k, p) { return W.i18n.t(k, p); };
    var STICKS = 5, CATCH_R = 72, PERFECT_R = 24, LEAP_T = 0.3, SPEED = 255, SPEED_SMALL = 80, SPEED_UP = 0.09;

    function hand(env) { return { x: env.LW / 2, y: env.LH - 190 }; }
    function newLane(env) { return env.LH * (0.45 + Math.random() * 0.17); }

    function start(d, env) {
        var base = SPEED + SPEED_SMALL * (1 - d.g.size);   // small dogs are nippy
        var lane = newLane(env), H = hand(env);
        return {
            d: d, s: 0.78 * (0.82 + 0.3 * d.g.size),
            x: H.x, y: H.y - 40, flip: 1, vx: 1, lane: lane, base: base, speed: base,
            st: 'out', tx: 110, ty: lane, stick: null, ground: null, carry: false, leap: null,
            left: STICKS, score: 0, combo: 0, catches: 0, over: false,
            // eager retrievers leap a little further: 50% tameness is the original tuning
            reach: 0.9 + 0.2 * Math.max(0, Math.min(1, d.g.tame / 100)),
            hop: 0, hopP: 0, t: 0, wait: 0, landT: 0, hint: !!env.first, ph: Math.random() * 6
        };
    }

    /* where the dog will be in `sec` seconds if it keeps running its track */
    function ahead(F, sec, LW) {
        var x = F.x, vx = F.vx, left = sec;
        while (left > 0) {
            var st = Math.min(left, 0.02);
            x += vx * F.speed * st;
            if (x < 90) { x = 90; vx = 1; }
            if (x > LW - 90) { x = LW - 90; vx = -1; }
            left -= st;
        }
        return { x: x, y: F.lane + Math.sin((F.t + sec) * 2.2 + F.ph) * 14 };
    }
    function moveTo(F, tx, ty, sp, dt) {
        var dx = tx - F.x, dy = ty - F.y, dist = Math.hypot(dx, dy);
        if (dist < 1.5) return true;
        var st = Math.min(dist, sp * dt);
        F.x += dx / dist * st; F.y += dy / dist * st;
        if (Math.abs(dx) > 3) F.flip = dx < 0 ? -1 : 1;
        F.hopP += dt * 13; F.hop = Math.abs(Math.sin(F.hopP)) * 9;
        return dist - st < 1.5;
    }

    /* a tap throws the stick at that spot (only while the dog is on its track) */
    function tap(F, p, env) {
        if (F.over || F.stick || F.left <= 0 || F.st !== 'run') return false;
        var H = hand(env);
        var x = Math.max(40, Math.min(env.LW - 40, p.x)), y = Math.max(env.LH * 0.38, Math.min(env.LH * 0.74, p.y));
        var dist = Math.hypot(x - H.x, y - H.y);
        F.stick = { sx: H.x, sy: H.y - 30, x: x, y: y, t: 0, dur: 0.5 + dist / 1500 };
        F.left--; F.hint = false;
        SFX.play('whoosh');
        return true;
    }

    function caught(F, env) {
        F.combo++; F.catches++;
        var perfect = F.leap.d0 < PERFECT_R;
        var pts = 10 * F.combo + (perfect ? 5 : 0);
        F.score += pts;
        F.carry = true; F.st = 'land'; F.landT = 0.18; F.leap = null;
        var y = F.y - 150 - F.hop;
        FX.text(F.x, y, (perfect ? t('perfect') : t('catchTxt')) + ' +' + pts, perfect ? '#fff36b' : '#b9ff8a', perfect ? 44 : 40);
        if (F.combo >= 2) FX.text(F.x, y - 52, t('combo', { n: F.combo }), '#ffb3d9', 32);
        FX.confetti(F.x, F.y - 90 - F.hop, 16 + F.combo * 8);
        if (perfect) FX.sparkle(F.x, F.y - 90 - F.hop, 16, '#fff6a0');
        SFX.play('good'); SFX.play('pop', 2 + F.combo * 2);
        if (env.onCatch) env.onCatch(F);
    }

    function update(F, dt, env) {
        var LW = env.LW, H = hand(env);
        F.t += dt;
        var S = F.stick;
        if (S) {
            S.t += dt;
            var rem = S.dur - S.t;
            // just before it lands the dog decides, once: will I be there? Then it jumps for it
            if (F.st === 'run' && !S.judged && rem < LEAP_T) {
                S.judged = true;
                var at = ahead(F, rem, LW);
                var dd = Math.hypot(S.x - at.x, S.y - at.y);
                if (dd < CATCH_R * F.reach) {
                    F.st = 'leap'; F.leap = { sx: F.x, sy: F.y, tx: S.x, ty: S.y, t: 0, dur: Math.max(0.05, rem), d0: dd };
                    F.flip = S.x < F.x ? -1 : 1;
                    SFX.play('yip', 1.25);
                }
            }
            if (rem <= 0) {
                F.stick = null;
                if (F.st === 'leap') caught(F, env);
                else {
                    F.ground = { x: S.x, y: S.y }; F.combo = 0; F.st = 'chase';
                    SFX.play('land');
                    FX.text(S.x, S.y - 50, t('missed'), '#ffe0c0', 30);
                }
            }
        }
        switch (F.st) {
            case 'out':
                if (moveTo(F, F.tx, F.ty, 460, dt)) { F.st = 'run'; F.vx = F.x < LW / 2 ? 1 : -1; }
                break;
            case 'run':
                F.x += F.vx * F.speed * dt;
                if (F.x < 90) { F.x = 90; F.vx = 1; }
                if (F.x > LW - 90) { F.x = LW - 90; F.vx = -1; }
                F.y = F.lane + Math.sin(F.t * 2.2 + F.ph) * 14;
                F.flip = F.vx; F.hopP += dt * 14; F.hop = Math.abs(Math.sin(F.hopP)) * 10;
                break;
            case 'leap':
                var L = F.leap; L.t += dt;
                var k = Math.min(1, L.t / L.dur);
                F.x = L.sx + (L.tx - L.sx) * k; F.y = L.sy + (L.ty - L.sy) * k;
                F.hop = Math.sin(k * Math.PI * 0.72) * 95;
                break;
            case 'land':
                F.landT -= dt; F.hop = Math.max(0, F.hop - dt * 420);
                if (F.landT <= 0 && F.hop <= 0) F.st = 'return';
                break;
            case 'chase':
                if (moveTo(F, F.ground.x, F.ground.y, F.speed * 1.2, dt)) {
                    F.ground = null; F.carry = true; F.score += 2; F.st = 'return';
                    FX.text(F.x, F.y - 120, '+2', '#ffffff', 28);
                    SFX.play('munch');
                }
                break;
            case 'return':
                if (moveTo(F, H.x, H.y - 40, 540, dt)) { F.st = 'drop'; F.wait = 0.3; F.hop = 0; SFX.play('bark', 1.1); }
                break;
            case 'drop':
                F.wait -= dt;
                if (F.wait <= 0) {
                    F.carry = false;
                    if (F.left <= 0) { F.st = 'done'; F.over = true; if (env.onEnd) env.onEnd(F); }
                    else {
                        F.lane = newLane(env);
                        F.tx = Math.random() < 0.5 ? 110 : LW - 110; F.ty = F.lane;
                        F.speed = F.base * (1 + SPEED_UP * (STICKS - F.left));   // a little faster every throw
                        F.st = 'out';
                    }
                }
                break;
        }
    }

    function label(c, str, x, y, size, color, align) {
        c.font = '900 ' + size + 'px "Trebuchet MS", system-ui, sans-serif'; c.textAlign = align || 'center'; c.textBaseline = 'middle';
        c.lineJoin = 'round'; c.lineWidth = Math.max(6, size / 4.5); c.strokeStyle = A.INK;
        c.strokeText(str, x, y); c.fillStyle = color; c.fillText(str, x, y);
    }

    function draw(c, F, env) {
        var LW = env.LW, LH = env.LH, clock = env.clock, H = hand(env);
        A.world(c, LW, LH, clock, 0, 0.08, 1);
        // the dog's running track, worn into the grass
        c.save();
        c.fillStyle = 'rgba(255,250,210,0.16)'; A.roundRect(c, 60, F.lane - 24, LW - 120, 48, 24); c.fill();
        c.setLineDash([16, 14]); c.lineDashOffset = -clock * 40; c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 3;
        c.beginPath(); c.moveTo(80, F.lane); c.lineTo(LW - 80, F.lane); c.stroke(); c.setLineDash([]);
        c.restore();
        if (F.ground) A.stick(c, F.ground.x, F.ground.y, 0.75, 0.35);
        var S = F.stick, u = 0, gx = 0, gy = 0;
        if (S) {
            u = Math.min(1, S.t / S.dur); gx = S.sx + (S.x - S.sx) * u; gy = S.sy + (S.y - S.sy) * u;
            c.save();
            c.strokeStyle = 'rgba(255,255,255,' + (0.45 + 0.45 * u) + ')'; c.lineWidth = 4;
            c.beginPath(); c.ellipse(S.x, S.y, 40 * (1.3 - u * 0.5), 15 * (1.3 - u * 0.5), 0, 0, Math.PI * 2); c.stroke();
            c.fillStyle = 'rgba(30,20,40,0.2)'; A.ell(c, gx, gy, 24, 7); c.fill();
            c.restore();
        }
        var g = F.d.g;
        A.dog(c, { g: g, seed: F.d.seed, age: 1 }, F.x, F.y, F.s, {
            t: clock, mood: 'happy', wag: 1, flip: F.flip, hop: F.hop,
            lookX: F.flip * 0.5, lookY: F.st === 'leap' ? -0.7 : 0, gaze: F.st === 'drop' ? 1 : 0,
            walk: F.st === 'out' || F.st === 'run' || F.st === 'chase' || F.st === 'return' || F.st === 'leap' || F.st === 'land'
        });
        if (F.carry) {
            // the stick sits across the mouth (a painted dog: where its mouth is in this pose)
            var R = 46 * F.s, bodyH = R * (1.22 + 0.25 * g.size);
            var painted = W.sprites && W.sprites.has(F.d);
            var my = painted ? W.minikit.mouthY(F) : F.y - F.hop - bodyH * 0.94 - R * 0.12;
            A.stick(c, painted ? W.minikit.mouthX(F) : F.x, my, F.s * 0.95, 0.06 * Math.sin(clock * 9));
        }
        if (S) A.stick(c, gx, gy - Math.sin(u * Math.PI) * 170, 0.75, S.t * 13);

        // the next stick in your hand
        var ready = F.st === 'run' && !S && F.left > 0;
        c.save();
        if (ready) {
            var pul = 0.5 + 0.5 * Math.sin(clock * 6);
            c.strokeStyle = 'rgba(255,245,200,' + (0.45 + 0.4 * pul) + ')'; c.lineWidth = 5;
            c.beginPath(); c.arc(H.x, H.y, 52 + pul * 6, 0, Math.PI * 2); c.stroke();
        }
        if (F.left > 0 && !S) A.stick(c, H.x, H.y, 0.9, -0.5);
        label(c, '× ' + F.left, H.x + 80, H.y + 6, 34, '#fff4dc');
        c.restore();

        // score + combo, under the HTML pills
        c.save();
        label(c, t('score') + ' ' + F.score, LW / 2, 200, 44, '#ffd23f');
        if (F.combo >= 2) label(c, t('combo', { n: F.combo }), LW / 2, 252, 30, '#ffb3d9');
        if (F.hint) {
            c.font = '900 26px "Trebuchet MS", system-ui, sans-serif';
            var lines = wrap(c, t('fetchHint'), LW - 110), lh = 34;
            var w = lines.reduce(function (m, s) { return Math.max(m, c.measureText(s).width); }, 0) + 44;
            var h = lines.length * lh + 26, top = LH * 0.29 - h / 2;
            A.roundRect(c, LW / 2 - w / 2, top, w, h, 26); c.fillStyle = '#fff8ec'; c.fill(); c.lineWidth = 4; c.strokeStyle = A.INK; c.stroke();
            c.fillStyle = '#5a3a2a'; c.textAlign = 'center'; c.textBaseline = 'middle';
            lines.forEach(function (s, i) { c.fillText(s, LW / 2, top + 13 + lh * (i + 0.5)); });
        }
        c.restore();
    }
    function wrap(c, str, maxW) {
        var lines = [], cur = '';
        str.split(' ').forEach(function (w) {
            var test = cur ? cur + ' ' + w : w;
            if (cur && c.measureText(test).width > maxW) { lines.push(cur); cur = w; } else cur = test;
        });
        if (cur) lines.push(cur);
        return lines;
    }

    W.fetch = { start: start, update: update, draw: draw, tap: tap, STICKS: STICKS };
    W.minis = W.minis || [];
    W.minis.push({
        id: 'fetch', icon: '🎾', title: 'fetchTitle', fact: 'factFetch', skillText: 'skillFetch', unlock: null,
        skill: function (g) { return g.tame / 100; },
        start: start, update: update, draw: draw,
        down: function (F, p, env) { tap(F, p, env); },
        stats: function (F) { return t('catches') + ' ' + F.catches + '/' + STICKS; },
        bones: function (F) { return F.score / 2; }
    });
})();
