/* Wolf to Woof - shared pieces for the mini-games in the Play menu.
 * Every mini-game registers itself in W.minis with the same shape:
 *   { id, icon, title, hint, fact,                  i18n keys (title, first-round hint, "did you know")
 *     unlock,                                        S.unlocks key that opens it (null: open from the start)
 *     start(d, env) -> G, update(G, dt, env), draw(c, G, env),
 *     down(G, p, env), move(G, p, env), up(G, p, env),   pointer in logical pixels (720 x LH)
 *     stats(G) -> string, bones(G) -> number,        for the result panel
 *     stop(G) }                                      optional: silence voices when the round is left
 * A round ends by setting G.over and calling env.onEnd(G) once. */
(function () {
    'use strict';
    var W = window.WTW;
    var A = W.art;
    var t = function (k, p) { return W.i18n.t(k, p); };

    function label(c, str, x, y, size, color, align) {
        c.font = '900 ' + size + 'px "Trebuchet MS", system-ui, sans-serif'; c.textAlign = align || 'center'; c.textBaseline = 'middle';
        c.lineJoin = 'round'; c.lineWidth = Math.max(6, size / 4.5); c.strokeStyle = A.INK;
        c.strokeText(str, x, y); c.fillStyle = color; c.fillText(str, x, y);
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
    /* the cream speech card used for first-round hints */
    function hintBox(c, LW, LH, str, yFrac) {
        c.save();
        c.font = '900 26px "Trebuchet MS", system-ui, sans-serif';
        var lines = wrap(c, str, LW - 110), lh = 34;
        var w = lines.reduce(function (m, s) { return Math.max(m, c.measureText(s).width); }, 0) + 44;
        var h = lines.length * lh + 26, top = LH * (yFrac || 0.29) - h / 2;
        A.roundRect(c, LW / 2 - w / 2, top, w, h, 26); c.fillStyle = '#fff8ec'; c.fill(); c.lineWidth = 4; c.strokeStyle = A.INK; c.stroke();
        c.fillStyle = '#5a3a2a'; c.textAlign = 'center'; c.textBaseline = 'middle';
        lines.forEach(function (s, i) { c.fillText(s, LW / 2, top + 13 + lh * (i + 0.5)); });
        c.restore();
    }
    /* score, combo and the time left, just under the HTML pills */
    function hud(c, LW, G, total) {
        c.save();
        label(c, t('score') + ' ' + G.score, LW / 2, 196, 44, '#ffd23f');
        if (total) {
            var w = 300, x = LW / 2 - w / 2, y = 232, k = Math.max(0, Math.min(1, G.time / total));
            A.roundRect(c, x, y, w, 16, 8); c.fillStyle = 'rgba(40,24,40,0.35)'; c.fill();
            if (k > 0) { A.roundRect(c, x, y, Math.max(16, w * k), 16, 8); c.fillStyle = k < 0.2 ? '#ff6b6b' : '#7fe08a'; c.fill(); }
            A.roundRect(c, x, y, w, 16, 8); c.lineWidth = 3; c.strokeStyle = A.INK; c.stroke();
        }
        if (G.combo >= 2) label(c, t('combo', { n: G.combo }), LW / 2, 272, 30, '#ffb3d9');
        c.restore();
    }
    /* walk o towards (tx, ty); true once there. Sets o.flip and a little hop, and marks it walking
       for the next drawing (o.walking counts down in drawDog, so a dog that stops sits down) */
    function moveTo(o, tx, ty, sp, dt) {
        var dx = tx - o.x, dy = ty - o.y, dist = Math.hypot(dx, dy);
        if (dist < 1.5) { o.hop = 0; return true; }
        var st = Math.min(dist, sp * dt);
        o.x += dx / dist * st; o.y += dy / dist * st;
        if (Math.abs(dx) > 3) o.flip = dx < 0 ? -1 : 1;
        o.hopP = (o.hopP || 0) + dt * 13; o.hop = Math.abs(Math.sin(o.hopP)) * 8;
        o.walking = 2;
        return dist - st < 1.5;
    }
    /* the dog of the round, drawn the way the camp draws it */
    function drawDog(c, G, o) {
        o.walk = (G.walking || 0) > 0;
        if (G.walking) G.walking--;
        A.dog(c, { g: G.d.g, seed: G.d.seed, age: 1 }, G.x, G.y, G.s, o);
    }
    function painted(G) { return !!(W.sprites && W.sprites.has(G.d)); }
    /* the painted dog as last drawn (sitting, or side-on while it walks), else the drawn one */
    function pose(G) { return painted(G) && W.sprites.pose ? W.sprites.pose(G.d.g) : null; }
    function headY(G) { var P = pose(G); return P ? P.hy : G.y - (G.hop || 0) - (painted(G) ? 104 : 95) * G.s; }
    function mouthY(G) { var P = pose(G); return P ? P.my : G.y - (G.hop || 0) - (painted(G) ? 80 : 65) * G.s; }
    function mouthX(G) { var P = pose(G); return P ? P.mx : G.x; }
    function shuffle(a, rnd) {
        for (var i = a.length - 1; i > 0; i--) { var j = Math.floor((rnd || Math.random)() * (i + 1)); var x = a[i]; a[i] = a[j]; a[j] = x; }
        return a;
    }
    function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

    W.minikit = { label: label, wrap: wrap, hintBox: hintBox, hud: hud, moveTo: moveTo, drawDog: drawDog, headY: headY, mouthY: mouthY, mouthX: mouthX, pose: pose, shuffle: shuffle, clamp: clamp };
    W.minis = W.minis || [];
})();
