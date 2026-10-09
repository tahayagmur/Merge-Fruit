/* Wolf to Woof - procedural art. Every canine is drawn from its genome, so the
 * domestication syndrome is visible: ears droop, tails curl, eyes grow, snouts
 * shorten, coats and patterns appear. Also: the camp, the fire and effects. */
(function () {
    'use strict';
    var W = window.WTW = window.WTW || {};
    var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
    var TAU = Math.PI * 2;
    var INK = '#3b2a24';

    var COAT = {
        wild:   { base: '#8f8b87', light: '#ece2d2', dark: '#5c5854' },
        sable:  { base: '#b87a45', light: '#f3dfc4', dark: '#6e4524' },
        red:    { base: '#d26b33', light: '#f8dfc8', dark: '#8a3e1a' },
        golden: { base: '#e6b157', light: '#fdedcc', dark: '#b77f2f' },
        cream:  { base: '#f2e1be', light: '#fff8ea', dark: '#cfb68d' },
        black:  { base: '#38322f', light: '#9a8b80', dark: '#1d1a19' },
        choc:   { base: '#7a4832', light: '#d1a687', dark: '#4a2a1b' },
        blue:   { base: '#7f8da6', light: '#e2e8f1', dark: '#56627a' },
        white:  { base: '#f7f4ef', light: '#ffffff', dark: '#d8d1c6' }
    };
    var IRIS = { amber: '#e0a02e', brown: '#6a4122', hazel: '#8c7a38', blue: '#5fb4ec', hetero: '#5fb4ec' };

    function rng(seed) { return W.gen.rngFrom(seed); }
    function ell(c, x, y, rx, ry, rot) { c.beginPath(); c.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot || 0, 0, TAU); }
    function fillStroke(c, fill, lw) { c.fillStyle = fill; c.fill(); if (lw) { c.lineWidth = lw; c.strokeStyle = INK; c.stroke(); } }

    /* ------------------------------------------------------------------ canine */
    /* x, y: ground point under the dog. s: scale (1 = an adult of normal size).
       o: { t, mood: calm|happy|scared|sleep, lookX, lookY (-1..1), gaze 0..1,
            wag 0..1, blink 0..1, flip 1|-1, hop px, brow 0..1 } */
    function dog(c, d, x, y, s, o) {
        if (W.sprites && W.sprites.drawDog(c, d, x, y, s, o)) return;   // its painting, once loaded
        o = o || {};
        var g = d.g, t = o.t || 0;
        var pup = clamp(1 - (d.age === undefined ? 1 : d.age), 0, 1);
        var pal = COAT[g.coat] || COAT.wild;
        var lw = Math.max(1.2, 3.2 * s);
        var R = 46 * s * (1 + 0.12 * pup);
        var flip = o.flip || 1;
        var mood = o.mood || 'calm';
        var newborn = pup > 0.8;                       // puppies are born with their eyes shut
        var fluffy = g.fur === 'fluffy', curly = g.fur === 'curly', wiry = g.fur === 'wiry';
        var r = rng(d.seed || 1);
        var hop = o.hop || 0;
        var breathe = Math.sin(t * 2.2 + (d.seed || 0)) * 1.2 * s;

        var bodyW = R * (1.5 + 0.35 * g.size - 0.35 * pup);
        var bodyH = R * (1.22 + 0.25 * g.size - 0.28 * pup) + breathe;
        var by = y - bodyH * 0.52 - hop;               // body centre
        var hx = x + (o.lookX || 0) * R * 0.06;
        var hy = by - bodyH * 0.42 - R * 0.6 - (mood === 'scared' ? -R * 0.12 : 0) - (mood === 'howl' ? R * 0.14 : 0);

        c.save();
        // shadow
        c.fillStyle = 'rgba(30,20,40,0.22)';
        ell(c, x, y + 2 * s, bodyW * 0.62 * (1 - hop / (80 * s + 1) * 0.3), 7 * s); c.fill();

        drawTail(c, g, pal, x + flip * bodyW * 0.36, by + bodyH * 0.2, R, flip, t, o.wag || 0, lw, mood);

        // haunches + hind paws
        [-1, 1].forEach(function (sd) {
            ell(c, x + sd * bodyW * 0.33, y - bodyH * 0.2 - hop, bodyW * 0.24, bodyH * 0.22); fillStroke(c, pal.base, lw);
            ell(c, x + sd * bodyW * 0.42, y - 4 * s - hop, R * 0.24, R * 0.13); fillStroke(c, pawColor(g, pal, sd), lw);
        });

        // body
        ell(c, x, by, bodyW * 0.5, bodyH * 0.5); fillStroke(c, pal.base, lw);
        c.save(); ell(c, x, by, bodyW * 0.5, bodyH * 0.5); c.clip();
        bodyPattern(c, g, pal, x, by, bodyW, bodyH, r);
        // chest bib (wolves and most dogs are lighter underneath)
        var bibW = g.pat === 'tux' ? 0.34 : 0.26;
        ell(c, x, by + bodyH * 0.12, bodyW * bibW, bodyH * 0.45);
        c.fillStyle = g.pat === 'tux' || g.pat === 'pie' ? '#fffdf8' : pal.light; c.fill();
        if (fluffy) { scallops(c, x, by - bodyH * 0.28, bodyW * 0.3, 7, R * 0.12, pal.light); }
        if (curly) curls(c, x, by, bodyW * 0.45, bodyH * 0.45, R * 0.09, pal, r, 16);
        c.restore();
        ell(c, x, by, bodyW * 0.5, bodyH * 0.5); c.lineWidth = lw; c.strokeStyle = INK; c.stroke();

        // front legs + paws
        [-1, 1].forEach(function (sd) {
            var lx = x + sd * bodyW * 0.16;
            roundRect(c, lx - R * 0.15, by + bodyH * 0.05, R * 0.3, (y - hop) - (by + bodyH * 0.05) - 4 * s, R * 0.14);
            fillStroke(c, g.pat === 'tux' ? '#fffdf8' : pal.base, lw);
            ell(c, lx, y - 5 * s - hop, R * 0.21, R * 0.13); fillStroke(c, pawColor(g, pal, sd), lw);
            c.beginPath(); c.moveTo(lx - R * 0.06, y - 9 * s - hop); c.lineTo(lx - R * 0.06, y - 3 * s - hop);
            c.moveTo(lx + R * 0.06, y - 9 * s - hop); c.lineTo(lx + R * 0.06, y - 3 * s - hop);
            c.lineWidth = lw * 0.6; c.strokeStyle = INK; c.stroke();
        });

        // ---- head ----
        var tilt = (o.lookX || 0) * 0.08 + (mood === 'happy' ? Math.sin(t * 3) * 0.05 : 0);
        c.save();
        c.translate(hx, hy); c.rotate(tilt);
        var hrx = R * (1.02 + 0.1 * (1 - g.round)), hry = R * (0.9 + 0.1 * g.round);

        if (g.ear <= 2) ears(c, g, pal, R, lw, 'back', mood, t);

        // wolves have cheek ruffs; they shrink as the face rounds out
        if (g.round < 0.45 && !curly) {
            var ruff = 1 - g.round / 0.45;
            [-1, 1].forEach(function (sd) {
                c.beginPath();
                c.moveTo(sd * hrx * 0.72, hry * 0.12);
                c.lineTo(sd * hrx * (0.98 + 0.08 * ruff), hry * 0.38);
                c.lineTo(sd * hrx * 0.84, hry * 0.46);
                c.lineTo(sd * hrx * (0.92 + 0.06 * ruff), hry * 0.62);
                c.lineTo(sd * hrx * 0.58, hry * 0.72);
                c.closePath(); fillStroke(c, pal.light, lw);
            });
        }

        // head shape
        if (fluffy) { scallopEllipse(c, 0, 0, hrx * 1.02, hry * 1.02, 16, R * 0.08); }
        else ell(c, 0, 0, hrx, hry);
        fillStroke(c, pal.base, lw);

        c.save(); ell(c, 0, 0, hrx, hry); c.clip();
        facePattern(c, g, pal, R, hrx, hry, r);
        c.restore();

        // muzzle: a wolf's long snout reads as a pale bridge running up between the eyes
        var sn = g.snout;
        var my = R * (0.3 + 0.12 * sn), mrx = R * (0.38 + 0.1 * sn), mry = R * (0.22 + 0.26 * sn);
        var mfill = (g.pat === 'pie' || g.pat === 'tux') ? '#fffdf8' : pal.light;
        if (sn > 0.45) {
            c.beginPath();
            c.moveTo(-mrx * 0.45, my); c.quadraticCurveTo(-mrx * 0.3, -R * 0.2, 0, -R * 0.28);
            c.quadraticCurveTo(mrx * 0.3, -R * 0.2, mrx * 0.45, my); c.closePath();
            c.globalAlpha = (sn - 0.45) * 1.6; c.fillStyle = mfill; c.fill(); c.globalAlpha = 1;
        }
        ell(c, 0, my, mrx, mry);
        c.fillStyle = mfill; c.fill();
        if (wiry) {                                      // beard
            c.beginPath();
            for (var i = -3; i <= 3; i++) { c.moveTo(i * mrx * 0.22, my + mry * 0.6); c.lineTo(i * mrx * 0.26, my + mry * 1.25); }
            c.lineWidth = lw * 0.8; c.strokeStyle = pal.dark; c.stroke();
        }

        // eyes
        // baby schema: the eyes grow and sit lower (a bigger forehead) as the face neotenises
        var eyeF = clamp(g.eye + pup * 0.35, 0, 1.3);
        var er = R * (0.12 + 0.19 * eyeF);
        var ey = -R * 0.04 + R * 0.12 * eyeF;
        var ex = R * (0.36 + 0.04 * eyeF);
        var wildness = clamp(1 - eyeF * 1.5, 0, 1);
        var blink = mood === 'sleep' || newborn ? 1 : (o.blink || 0);
        [-1, 1].forEach(function (sd) {
            var iris = g.eyeC === 'hetero' && sd > 0 ? IRIS.brown : (IRIS[g.eyeC] || IRIS.amber);
            eye(c, sd * ex, ey, er, iris, wildness, blink, o, sd, lw, mood, g.brow ? (o.brow || 0) : 0, pal, newborn);
        });
        if (g.brow) brows(c, ex, ey, er, o.brow || 0, pal, lw);
        if (wiry) {
            [-1, 1].forEach(function (sd) {
                c.beginPath(); c.moveTo(sd * (ex - er), ey - er * 1.3); c.lineTo(sd * (ex + er * 0.9), ey - er * 1.55);
                c.lineWidth = lw * 1.6; c.strokeStyle = pal.dark; c.lineCap = 'round'; c.stroke();
            });
        }

        // blush
        var cute = W.gen.cuteness(g);
        if (cute > 35 || mood === 'happy' || pup > 0.3) {
            c.fillStyle = 'rgba(255,120,150,' + (mood === 'happy' ? 0.45 : 0.28) + ')';
            [-1, 1].forEach(function (sd) { ell(c, sd * ex * 1.18, ey + er * 1.45, er * 0.75, er * 0.42); c.fill(); });
        }

        // nose + mouth: a button nose sits right under the eyes, a wolf's sits low
        var ny = my - mry * (0.4 - 0.35 * sn), nr = R * (0.14 + 0.05 * (1 - sn));
        c.beginPath();
        c.moveTo(-nr, ny - nr * 0.45);
        c.quadraticCurveTo(0, ny - nr * 0.85, nr, ny - nr * 0.45);
        c.quadraticCurveTo(nr * 0.9, ny + nr * 0.5, 0, ny + nr * 0.7);
        c.quadraticCurveTo(-nr * 0.9, ny + nr * 0.5, -nr, ny - nr * 0.45);
        c.closePath(); c.fillStyle = '#2a1f1d'; c.fill();
        c.fillStyle = 'rgba(255,255,255,0.55)'; ell(c, -nr * 0.3, ny - nr * 0.3, nr * 0.32, nr * 0.18); c.fill();
        mouth(c, ny + nr * 0.7, mrx, mry, my, lw, mood, R, t);

        if (g.ear >= 3) ears(c, g, pal, R, lw, 'front', mood, t);
        if (curly) curls(c, 0, -hry * 0.75, hrx * 0.55, hry * 0.3, R * 0.11, pal, r, 9);
        if (fluffy) { scallops(c, 0, -hry * 0.92, hrx * 0.22, 3, R * 0.1, pal.base); }
        c.restore();

        c.restore();
    }

    function pawColor(g, pal, sd) {
        if (g.pat === 'tux' || (g.pat === 'pie' && sd > 0)) return '#fffdf8';
        return g.coat === 'wild' ? pal.light : pal.base;
    }

    function roundRect(c, x, y, w, h, r) {
        r = Math.min(r, w / 2, Math.abs(h) / 2);
        c.beginPath();
        c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.quadraticCurveTo(x + w, y, x + w, y + r);
        c.lineTo(x + w, y + h - r); c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        c.lineTo(x + r, y + h); c.quadraticCurveTo(x, y + h, x, y + h - r);
        c.lineTo(x, y + r); c.quadraticCurveTo(x, y, x + r, y); c.closePath();
    }

    function scallopEllipse(c, cx, cy, rx, ry, n, bump) {
        c.beginPath();
        for (var i = 0; i <= n; i++) {
            var a0 = i / n * TAU, a1 = (i + 0.5) / n * TAU;
            var x0 = cx + Math.cos(a0) * rx, y0 = cy + Math.sin(a0) * ry;
            var x1 = cx + Math.cos(a1) * (rx + bump), y1 = cy + Math.sin(a1) * (ry + bump);
            if (i === 0) c.moveTo(x0, y0);
            else c.quadraticCurveTo(x1p, y1p, x0, y0);
            var x1p = x1, y1p = y1;
        }
        c.closePath();
    }
    function scallops(c, cx, cy, halfW, n, rad, color) {
        c.fillStyle = color;
        for (var i = 0; i < n; i++) {
            var px = cx - halfW + (i + 0.5) * (2 * halfW / n);
            ell(c, px, cy + Math.abs(i - (n - 1) / 2) * rad * 0.35, rad, rad * 1.1); c.fill();
        }
    }
    function curls(c, cx, cy, rx, ry, rad, pal, r, n) {
        for (var i = 0; i < n; i++) {
            var a = r() * TAU, d = Math.sqrt(r());
            var px = cx + Math.cos(a) * rx * d, py = cy + Math.sin(a) * ry * d;
            ell(c, px, py, rad, rad); c.fillStyle = pal.base; c.fill();
            c.beginPath(); c.arc(px, py, rad * 0.55, 0.3, 4.5); c.lineWidth = rad * 0.35; c.strokeStyle = pal.dark; c.stroke();
        }
    }

    function bodyPattern(c, g, pal, x, by, bw, bh, r) {
        if (g.coat === 'wild') {                      // wolf "saddle" of darker guard hair
            ell(c, x, by - bh * 0.45, bw * 0.55, bh * 0.35); c.fillStyle = pal.dark; c.globalAlpha = 0.35; c.fill(); c.globalAlpha = 1;
        }
        switch (g.pat) {
            case 'saddle': ell(c, x, by - bh * 0.42, bw * 0.6, bh * 0.38); c.fillStyle = pal === COAT.black ? '#6b5a4e' : '#2e2724'; c.fill(); break;
            case 'pie':
                c.fillStyle = '#fffdf8';
                for (var i = 0; i < 3; i++) { ell(c, x + (r() - 0.5) * bw * 0.8, by + (r() - 0.5) * bh * 0.7, bw * (0.16 + r() * 0.14), bh * (0.12 + r() * 0.12), r() * 3); c.fill(); }
                break;
            case 'merle':
                c.fillStyle = 'rgba(40,30,30,0.55)';
                for (var j = 0; j < 9; j++) { ell(c, x + (r() - 0.5) * bw, by + (r() - 0.5) * bh, bw * (0.05 + r() * 0.08), bh * (0.04 + r() * 0.07), r() * 3); c.fill(); }
                break;
            case 'brindle':
                c.strokeStyle = 'rgba(40,25,20,0.5)'; c.lineWidth = bw * 0.035;
                for (var k = -4; k <= 4; k++) { c.beginPath(); c.moveTo(x + k * bw * 0.12 - bw * 0.1, by - bh * 0.6); c.quadraticCurveTo(x + k * bw * 0.12 + bw * 0.05, by, x + k * bw * 0.12 - bw * 0.05, by + bh * 0.6); c.stroke(); }
                break;
            case 'spots':
                c.fillStyle = '#231c1a';
                for (var m = 0; m < 14; m++) { ell(c, x + (r() - 0.5) * bw * 0.95, by + (r() - 0.5) * bh * 0.9, bw * 0.035, bw * 0.03); c.fill(); }
                break;
        }
    }
    function facePattern(c, g, pal, R, hrx, hry, r) {
        if (g.coat === 'wild') {
            ell(c, 0, -hry * 0.55, hrx * 0.5, hry * 0.45); c.fillStyle = pal.dark; c.globalAlpha = 0.35; c.fill(); c.globalAlpha = 1;
            [-1, 1].forEach(function (sd) { ell(c, sd * hrx * 0.62, hry * 0.35, hrx * 0.42, hry * 0.4); c.fillStyle = pal.light; c.fill(); });
        }
        if (g.pat === 'mask') {
            c.fillStyle = 'rgba(35,25,22,0.75)';
            [-1, 1].forEach(function (sd) { ell(c, sd * R * 0.36, -R * 0.02, R * 0.3, R * 0.24, sd * 0.3); c.fill(); });
        }
        if (g.pat === 'pie') { c.fillStyle = '#fffdf8'; ell(c, R * 0.35, -R * 0.1, R * 0.45, R * 0.55, 0.3); c.fill(); }
        if (g.pat === 'tux') { c.fillStyle = '#fffdf8'; c.beginPath(); c.moveTo(-R * 0.1, -hry); c.lineTo(R * 0.1, -hry); c.lineTo(R * 0.2, R * 0.2); c.lineTo(-R * 0.2, R * 0.2); c.closePath(); c.fill(); }
        if (g.pat === 'merle') {
            c.fillStyle = 'rgba(40,30,30,0.5)';
            for (var j = 0; j < 4; j++) { ell(c, (r() - 0.5) * hrx * 1.4, (r() - 0.7) * hry, R * (0.08 + r() * 0.1), R * (0.06 + r() * 0.08), r() * 3); c.fill(); }
        }
        if (g.pat === 'spots') {
            c.fillStyle = '#231c1a';
            for (var k = 0; k < 6; k++) { ell(c, (r() - 0.5) * hrx * 1.5, (r() - 0.65) * hry * 1.2, R * 0.05, R * 0.045); c.fill(); }
        }
    }

    function ears(c, g, pal, R, lw, layer, mood, t) {
        // a wolf's ear is lined with pale fur; pink skin shows as ears soften
        var inner = g.ear === 0 && g.tame < 25 ? pal.light : (g.coat === 'black' || g.coat === 'choc' ? '#8a5a55' : '#f0a7a0');
        var earCol = g.pat === 'mask' ? '#3a2e2a' : pal.base;
        var back = mood === 'scared' ? 0.35 : 0;
        [-1, 1].forEach(function (sd) {
            c.save();
            c.translate(sd * R * 0.56, -R * 0.52);
            if (layer === 'back') {
                c.rotate(sd * (0.18 + back));
                var h = g.ear === 0 ? R * 0.85 : g.ear === 1 ? R * 0.72 : R * 0.5;
                var w = R * 0.34;
                c.beginPath(); c.moveTo(-w, R * 0.12); c.quadraticCurveTo(-w * 0.35, -h * 0.6, 0, -h); c.quadraticCurveTo(w * 0.35, -h * 0.6, w, R * 0.12); c.closePath();
                fillStroke(c, earCol, lw);
                c.beginPath(); c.moveTo(-w * 0.55, R * 0.06); c.quadraticCurveTo(-w * 0.2, -h * 0.45, 0, -h * 0.72); c.quadraticCurveTo(w * 0.2, -h * 0.45, w * 0.55, R * 0.06); c.closePath();
                c.fillStyle = inner; c.fill();
                if (g.ear >= 1) {                       // the tip (tipped) or the whole top (folded) flops forward
                    var fh = g.ear === 1 ? h * 0.35 : h * 0.62;
                    c.beginPath(); c.moveTo(-w * (g.ear === 1 ? 0.42 : 0.8), -h + fh);
                    c.quadraticCurveTo(0, -h + fh * 0.2, w * (g.ear === 1 ? 0.42 : 0.8), -h + fh);
                    c.quadraticCurveTo(sd * w * 0.5, -h + fh * 1.9, -w * 0.1 * sd, -h + fh * 1.6);
                    c.closePath(); fillStroke(c, earCol, lw);
                }
            } else {
                // floppy ears hang from the top corners, beside the eyes, not over them
                var len = g.ear === 3 ? R * 0.95 : R * 1.45;
                var sway = Math.sin(t * 2.5 + sd) * 0.04 + (mood === 'happy' ? Math.sin(t * 8) * 0.06 : 0);
                c.translate(sd * R * 0.26, R * 0.02);
                c.rotate(sd * (0.1 + sway));
                var ew = R * (g.ear === 3 ? 0.3 : 0.34);
                c.beginPath();
                c.moveTo(-sd * ew * 0.6, -R * 0.04);
                c.quadraticCurveTo(sd * ew * 1.5, -R * 0.2, sd * ew * 1.25, len * 0.5);
                c.quadraticCurveTo(sd * ew * 1.15, len * 1.02, sd * ew * 0.2, len * 0.95);
                c.quadraticCurveTo(-sd * ew * 0.55, len * 0.55, -sd * ew * 0.6, -R * 0.04);
                c.closePath(); fillStroke(c, earCol, lw);
                c.beginPath();
                c.moveTo(sd * ew * 0.1, R * 0.05);
                c.quadraticCurveTo(sd * ew * 0.95, len * 0.3, sd * ew * 0.55, len * 0.8);
                c.lineWidth = lw * 0.7; c.strokeStyle = 'rgba(59,42,36,0.35)'; c.stroke();
            }
            c.restore();
        });
    }

    function eye(c, x, y, er, iris, wildness, blink, o, sd, lw, mood, brow, pal, newborn) {
        c.save();
        c.translate(x, y);
        if (blink > 0.6) {
            c.beginPath();
            if (mood === 'happy') c.arc(0, er * 0.2, er * 0.75, Math.PI * 1.1, Math.PI * 1.9);
            else { c.moveTo(-er * 0.8, 0); c.quadraticCurveTo(0, er * (newborn ? 0.45 : 0.3), er * 0.8, 0); }
            c.lineWidth = lw * 1.1; c.lineCap = 'round'; c.strokeStyle = INK; c.stroke();
            c.restore(); return;
        }
        var scared = mood === 'scared';
        var w = er * (1.08 - 0.12 * wildness), h = er * (1 - 0.3 * wildness);
        ell(c, 0, 0, w, h); fillStroke(c, '#fffdf6', lw * 0.8);
        c.save(); ell(c, 0, 0, w, h); c.clip();
        var lx = (o.lookX || 0) * er * 0.28, ly = (o.lookY || 0) * er * 0.22 + er * 0.08;
        var ir = er * (0.8 - 0.1 * wildness);
        ell(c, lx, ly, ir, ir); c.fillStyle = iris; c.fill();
        var pr = ir * (scared ? 0.38 : 0.58 - 0.18 * wildness + 0.12 * brow);
        ell(c, lx, ly, pr, pr); c.fillStyle = '#1b1414'; c.fill();
        // lids narrow a wolf's eye into an almond; the outer corner sits higher
        if (wildness > 0.05) {
            c.beginPath();
            c.moveTo(-w * 1.2, -h * 1.2); c.lineTo(w * 1.2, -h * 1.2);
            c.lineTo(w * 1.2, -h * (0.9 - 0.9 * wildness) - sd * h * 0.25 * wildness);
            c.quadraticCurveTo(0, -h * (0.2 - 0.9 * wildness) , -w * 1.2, -h * (0.9 - 0.9 * wildness) + sd * h * 0.25 * wildness);
            c.closePath(); c.fillStyle = pal.base; c.fill();
        }
        if (blink > 0) { c.fillStyle = pal.base; c.fillRect(-w * 1.2, -h * 1.2, w * 2.4, h * 2.4 * blink); }
        c.restore();
        // sparkle: bigger when it gazes at you (the oxytocin loop)
        var gz = o.gaze || 0;
        c.fillStyle = '#ffffff';
        ell(c, lx - er * 0.28, ly - er * 0.3, er * (0.26 + 0.12 * gz + 0.08 * brow), er * (0.26 + 0.12 * gz + 0.08 * brow)); c.fill();
        ell(c, lx + er * 0.28, ly + er * 0.28, er * 0.11, er * 0.11); c.fill();
        if (gz > 0.5) {
            c.globalAlpha = (gz - 0.5) * 2; star(c, lx + er * 0.45, ly - er * 0.55, er * 0.28, '#ffffff'); c.globalAlpha = 1;
        }
        c.restore();
    }

    function brows(c, ex, ey, er, raise, pal, lw) {
        // the levator anguli oculi medialis: the inner brow lifts
        var col = pal === COAT.white || pal === COAT.cream ? '#c9a27a' : '#fff1d8';
        [-1, 1].forEach(function (sd) {
            c.beginPath();
            var ix = sd * (ex - er * 0.8), ox = sd * (ex + er * 0.7);
            var iy = ey - er * (1.45 + 0.45 * raise), oy = ey - er * 1.35;
            c.moveTo(ox, oy); c.quadraticCurveTo(sd * ex, ey - er * (1.75 + 0.2 * raise), ix, iy);
            c.lineWidth = lw * 1.5; c.lineCap = 'round'; c.strokeStyle = col; c.stroke();
        });
    }

    function mouth(c, y, mrx, mry, my, lw, mood, R, t) {
        c.strokeStyle = INK; c.lineWidth = lw * 0.8; c.lineCap = 'round';
        var w = mrx * 0.42;
        c.beginPath(); c.moveTo(0, y); c.lineTo(0, y + R * 0.06); c.stroke();
        if (mood === 'happy') {
            c.beginPath(); c.moveTo(-w, y + R * 0.02);
            c.quadraticCurveTo(0, y + R * 0.34, w, y + R * 0.02); c.closePath();
            c.fillStyle = '#7a2b2b'; c.fill(); c.stroke();
            c.beginPath(); ell(c, 0, y + R * 0.2 + Math.sin(t * 9) * R * 0.02, w * 0.5, R * 0.12); c.fillStyle = '#ff8fa3'; c.fill();
        } else if (mood === 'scared') {
            c.beginPath(); c.moveTo(-w * 0.6, y + R * 0.1); c.lineTo(w * 0.6, y + R * 0.1); c.stroke();
        } else if (mood === 'howl') {                    // the Howl Chorus: a round, open mouth
            ell(c, 0, y + R * 0.2, w * 0.62, R * 0.2); c.fillStyle = '#7a2b2b'; c.fill(); c.stroke();
        } else {
            c.beginPath();
            c.moveTo(-w, y + R * 0.02); c.quadraticCurveTo(-w * 0.5, y + R * 0.13, 0, y + R * 0.06);
            c.quadraticCurveTo(w * 0.5, y + R * 0.13, w, y + R * 0.02); c.stroke();
        }
    }

    function drawTail(c, g, pal, ax, ay, R, flip, t, wag, lw, mood) {
        var a = Math.sin(t * (6 + 10 * wag)) * (0.08 + 0.35 * wag);
        if (mood === 'scared') a = 0;
        var tip = (g.pat === 'pie' || g.pat === 'tux') ? '#fffdf8' : (g.coat === 'wild' ? pal.dark : pal.light);
        c.save(); c.translate(ax, ay); c.scale(flip, 1); c.rotate(a);
        c.lineCap = 'round';
        function stroke2(path, width, color) {
            path(); c.lineWidth = width + lw * 2; c.strokeStyle = INK; c.stroke();
            path(); c.lineWidth = width; c.strokeStyle = color; c.stroke();
        }
        if (g.tail === 0) {
            var down = mood === 'scared' ? 0.8 : 0;
            c.rotate(down);
            c.beginPath(); c.moveTo(0, 0);
            c.quadraticCurveTo(R * 0.9, R * 0.1, R * 1.05, R * 0.6);
            c.quadraticCurveTo(R * 0.7, R * 0.55, 0, R * 0.25); c.closePath();
            fillStroke(c, pal.base, lw);
            ell(c, R * 0.98, R * 0.52, R * 0.12, R * 0.12); c.fillStyle = tip; c.fill();
        } else if (g.tail === 1) {
            stroke2(function () { c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(R * 0.8, -R * 0.1, R * 0.7, -R * 0.85); }, R * 0.28, pal.base);
            c.beginPath(); c.arc(R * 0.7, -R * 0.85, R * 0.12, 0, TAU); c.fillStyle = tip; c.fill();
        } else {
            // a short stem up, then a loop over the back (two loops for a double curl)
            var pts = [];
            for (var i = 0; i <= 10; i++) { var u = i / 10; pts.push([R * 0.5 * u * (2 - u), -R * 0.6 * u * u - R * 0.07 * u]); }
            var cx0 = R * 0.3, cy0 = -R * 0.66, last = pts[pts.length - 1];
            var a0 = Math.atan2(last[1] - cy0, last[0] - cx0), rad0 = Math.hypot(last[0] - cx0, last[1] - cy0);
            var turns = g.tail === 3 ? 1.75 : 1.1, shrink = g.tail === 3 ? 0.6 : 0.3;
            for (var j = 1; j <= 32; j++) {
                var v = j / 32, ang = a0 - v * turns * TAU, rad = rad0 * (1 - shrink * v);
                pts.push([cx0 + Math.cos(ang) * rad, cy0 + Math.sin(ang) * rad]);
            }
            stroke2(function () {
                c.beginPath(); c.moveTo(pts[0][0], pts[0][1]);
                for (var k = 1; k < pts.length; k++) c.lineTo(pts[k][0], pts[k][1]);
            }, R * 0.19, pal.base);
            var tp = pts[pts.length - 1];
            c.beginPath(); c.arc(tp[0], tp[1], R * 0.1, 0, TAU); c.fillStyle = tip; c.fill();
        }
        c.restore();
    }

    /* ------------------------------------------------------------------ small shapes */
    function heart(c, x, y, s, color) {
        c.save(); c.translate(x, y); c.scale(s, s);
        c.beginPath();
        c.moveTo(0, 6); c.bezierCurveTo(-14, -4, -8, -16, 0, -8); c.bezierCurveTo(8, -16, 14, -4, 0, 6); c.closePath();
        c.fillStyle = color || '#ff5f9e'; c.fill();
        c.lineWidth = 2 / s; c.strokeStyle = INK; c.stroke();
        c.fillStyle = 'rgba(255,255,255,0.7)'; ell(c, -4.5, -7, 2.6, 1.8, -0.6); c.fill();
        c.restore();
    }
    function star(c, x, y, r, color) {
        c.beginPath();
        for (var i = 0; i < 8; i++) { var a = i * Math.PI / 4, rr = i % 2 ? r * 0.35 : r; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
        c.closePath(); c.fillStyle = color; c.fill();
    }
    function bone(c, x, y, s, rot) {
        c.save(); c.translate(x, y); c.rotate(rot || 0); c.scale(s, s);
        c.beginPath();
        c.moveTo(-8, -3); c.lineTo(8, -3); c.arc(10, -4, 4, Math.PI * 0.8, Math.PI * 2.3); c.arc(10, 4, 4, Math.PI * 1.7, Math.PI * 1.2 + TAU, false);
        c.lineTo(-8, 3); c.arc(-10, 4, 4, Math.PI * 0.2 - TAU, Math.PI * 1.3 - TAU, false); c.arc(-10, -4, 4, Math.PI * 0.7, Math.PI * 1.8);
        c.closePath(); c.fillStyle = '#fff4dc'; c.fill(); c.lineWidth = 2 / s; c.strokeStyle = INK; c.stroke();
        c.restore();
    }
    function treat(c, x, y, s) {                       // a bit of meat on a bone
        if (W.sprites && W.sprites.item(c, 'it_treat', x, y, 26 * s)) return;
        c.save(); c.translate(x, y); c.scale(s, s);
        ell(c, 0, 0, 11, 8, -0.3); fillStroke(c, '#c8563b', 2 / s);
        c.fillStyle = '#f08a6c'; ell(c, -3, -3, 5, 3, -0.3); c.fill();
        bone(c, 9, 5, 0.45, 0.6);
        c.restore();
    }

    /* ------------------------------------------------------------------ world */
    /* the part of the world on screen, left to right, when the screen is wider than the game (a desktop,
       a turned phone): the 720-wide game stays in the middle and the world goes on to either side.
       null on a tall screen, where exactly the game's width is drawn. */
    var VIEW = null;
    function setView(x0, x1) { VIEW = x0 < 0 ? { x0: x0, x1: x1 } : null; }
    function viewX(w) { return VIEW ? [VIEW.x0, VIEW.x1] : [0, w]; }
    var sceneryCache = null;
    function scenery(w, h) {
        if (sceneryCache && sceneryCache.w === w && sceneryCache.h === h) return sceneryCache;
        var r = rng(4242), trees = [], flowers = [], tufts = [], stars = [], hills = [];
        for (var i = 0; i < 26; i++) trees.push({ x: -20 + i * 30 + r() * 20, s: 0.7 + r() * 0.6, d: r() });
        var colors = ['#ff6b9d', '#ffd23f', '#ffffff', '#b28dff', '#ff8c42', '#6ec6ff'];
        for (var j = 0; j < 46; j++) flowers.push({ x: r() * w, y: h * (0.46 + r() * 0.42), c: colors[Math.floor(r() * colors.length)], s: 0.7 + r() * 0.7 });
        for (var k = 0; k < 40; k++) tufts.push({ x: r() * w, y: h * (0.42 + r() * 0.5), s: 0.6 + r() * 0.8 });
        for (var m = 0; m < 90; m++) stars.push({ x: r() * w, y: r() * h * 0.32, s: 0.5 + r() * 1.6, p: r() * TAU });
        for (var n = 0; n <= 12; n++) hills.push(r());
        // which painted tree each one is: mostly conifers, an oak here and there, bushes in front
        // (a separate sequence, so everything above stays where it was)
        var r2 = rng(777);
        trees.forEach(function (tr) {
            var v = r2();
            tr.kind = tr.d > 0.6 && v < 0.22 ? 'tree_bush' : v < 0.34 ? 'tree_pine' : v < 0.52 ? 'tree_fir' : v < 0.68 ? 'tree_spruce' : v < 0.86 ? 'tree_pine2' : 'tree_oak';
            tr.flip = r2() < 0.5;
        });
        sceneryCache = { w: w, h: h, trees: trees, flowers: flowers, tufts: tufts, stars: stars, hills: hills };
        return sceneryCache;
    }
    /* the same forest edge and meadow further out, one game-width at a time (tile j; j < 0 is to the
       left): each tile has its own random sequence, so the middle stays exactly as it is */
    var sideCache = {};
    function sideScenery(j, w, h) {
        var key = j + ':' + w + ':' + h;
        if (sideCache[key]) return sideCache[key];
        var r = rng(4242 + 7919 * (j + 100)), trees = [], flowers = [], tufts = [], stars = [];
        for (var i = 0; i < 23; i++) trees.push({ x: j * w + 30 + i * 30 + r() * 20, s: 0.7 + r() * 0.6, d: r() });
        var colors = ['#ff6b9d', '#ffd23f', '#ffffff', '#b28dff', '#ff8c42', '#6ec6ff'];
        for (var f = 0; f < 46; f++) flowers.push({ x: j * w + r() * w, y: h * (0.46 + r() * 0.42), c: colors[Math.floor(r() * colors.length)], s: 0.7 + r() * 0.7 });
        for (var k = 0; k < 40; k++) tufts.push({ x: j * w + r() * w, y: h * (0.42 + r() * 0.5), s: 0.6 + r() * 0.8 });
        for (var m = 0; m < 90; m++) stars.push({ x: j * w + r() * w, y: r() * h * 0.32, s: 0.5 + r() * 1.6, p: r() * TAU });
        var r2 = rng(777 + 31 * (j + 100));
        trees.forEach(function (tr) {
            var v = r2();
            tr.kind = tr.d > 0.6 && v < 0.22 ? 'tree_bush' : v < 0.34 ? 'tree_pine' : v < 0.52 ? 'tree_fir' : v < 0.68 ? 'tree_spruce' : v < 0.86 ? 'tree_pine2' : 'tree_oak';
            tr.flip = r2() < 0.5;
        });
        sideCache[key] = { trees: trees, flowers: flowers, tufts: tufts, stars: stars };
        return sideCache[key];
    }
    /* the side tiles on screen between x0 and x1 */
    function sides(w, h, x0, x1) {
        var list = [];
        for (var j = Math.floor(x0 / w); j <= Math.floor((x1 - 1) / w); j++) if (j !== 0) list.push(sideScenery(j, w, h));
        return list;
    }

    /* the tree line in its paintings, drawn once into a canvas at screen resolution, plus the same
       shapes in dusk and night colours to lay over it; null until all six trees have arrived */
    var TREE_H = { tree_pine: 104, tree_spruce: 92, tree_fir: 98, tree_pine2: 86, tree_oak: 90, tree_bush: 42 };
    var treeArt = null;
    function paintedTrees(c, w, h, sc, horizon, vx0, vx1, side) {
        if (!W.sprites || !W.sprites.on || typeof document === 'undefined') return null;
        var k = Math.min(2.5, c.getTransform ? c.getTransform().a : c.canvas.width / w);
        if (treeArt && treeArt.w === w && treeArt.h === h && Math.abs(treeArt.k - k) < 0.01 && treeArt.v0 === vx0 && treeArt.v1 === vx1) return treeArt;
        var list = [], ok = true, all = sc.trees;
        side.forEach(function (s) { all = all.concat(s.trees); });
        all.forEach(function (tr) {
            var im = W.sprites.get(tr.kind);
            if (!im) { ok = false; return; }
            var th = TREE_H[tr.kind] * tr.s * (0.86 + 0.14 * tr.d), tw = th * im.width / im.height;
            list.push({ im: im, x: tr.x, y: horizon + 18 + tr.d * 26, w: tw, h: th, d: tr.d, flip: tr.flip });
        });
        if (!ok) return null;
        list.sort(function (a, b) { return a.y - b.y; });           // back to front
        var x0 = Math.min(-60, vx0 - 60), x1 = Math.max(w + 60, vx1 + 60), y0 = Infinity, y1 = -Infinity;
        list.forEach(function (t) { y0 = Math.min(y0, t.y - t.h); y1 = Math.max(y1, t.y); });
        y0 = Math.floor(y0 - 2); y1 = Math.ceil(y1 + 2);
        var cw = Math.ceil((x1 - x0) * k), ch = Math.ceil((y1 - y0) * k);
        function canvas(wd, ht) { var cv = document.createElement('canvas'); cv.width = wd; cv.height = ht; return cv; }
        var day = canvas(cw, ch), dc = day.getContext('2d');
        dc.imageSmoothingQuality = 'high';
        var tmp = canvas(1, 1), tc = tmp.getContext('2d');
        list.forEach(function (t) {
            // each tree on its own: farther ones fade a little into the haze of the hills
            var pw = Math.ceil(t.w * k) + 2, ph = Math.ceil(t.h * k) + 2;
            if (tmp.width < pw || tmp.height < ph) { tmp.width = Math.max(tmp.width, pw); tmp.height = Math.max(tmp.height, ph); tc = tmp.getContext('2d'); }
            tc.setTransform(1, 0, 0, 1, 0, 0); tc.globalCompositeOperation = 'source-over'; tc.globalAlpha = 1;
            tc.clearRect(0, 0, tmp.width, tmp.height);
            tc.imageSmoothingQuality = 'high';
            if (t.flip) { tc.translate(pw, 0); tc.scale(-1, 1); }
            tc.drawImage(t.im, 1, 1, t.w * k, t.h * k);
            tc.setTransform(1, 0, 0, 1, 0, 0);
            tc.globalCompositeOperation = 'source-atop'; tc.globalAlpha = 0.3 * (1 - t.d);
            tc.fillStyle = '#a9c8d8'; tc.fillRect(0, 0, pw, ph);
            dc.drawImage(tmp, 0, 0, pw, ph, (t.x - t.w / 2 - x0) * k - 1, (t.y - t.h - y0) * k - 1, pw, ph);
        });
        function tint(color) {
            var cv = canvas(cw, ch), cc = cv.getContext('2d');
            cc.drawImage(day, 0, 0);
            cc.globalCompositeOperation = 'source-in'; cc.fillStyle = color; cc.fillRect(0, 0, cw, ch);
            return cv;
        }
        treeArt = { w: w, h: h, k: k, v0: vx0, v1: vx1, x: x0, y: y0, cw: x1 - x0, ch: y1 - y0, day: day, dusk: tint('#8a6c3e'), night: tint('#0f2419') };
        return treeArt;
    }
    /* accepts "#rrggbb" and "rgb(r,g,b)", so mixes can be nested */
    function rgbOf(s) {
        if (s.charAt(0) === '#') { var p = parseInt(s.slice(1), 16); return [(p >> 16) & 255, (p >> 8) & 255, p & 255]; }
        var m = s.match(/[\d.]+/g);
        return [+m[0], +m[1], +m[2]];
    }
    function mix(a, b, t) {
        var x = rgbOf(a), y = rgbOf(b);
        return 'rgb(' + Math.round(x[0] + (y[0] - x[0]) * t) + ',' + Math.round(x[1] + (y[1] - x[1]) * t) + ',' + Math.round(x[2] + (y[2] - x[2]) * t) + ')';
    }
    /* night: 0 = full day, 1 = full night; dusk: 0..1 warm glow near the horizon */
    function world(c, w, h, t, night, dusk, fire) {
        var sc = scenery(w, h), V = viewX(w), x0 = V[0], x1 = V[1], side = VIEW ? sides(w, h, x0, x1) : [];
        var horizon = h * 0.34;
        var sky = c.createLinearGradient(0, 0, 0, horizon + 40);
        sky.addColorStop(0, mix(mix('#6ec3ff', '#ff8fa3', dusk), '#2a2470', night));
        sky.addColorStop(1, mix(mix('#d8f3ff', '#ffd08a', dusk), '#5a3d9a', night));
        c.fillStyle = sky; c.fillRect(x0, 0, x1 - x0, horizon + 40);
        if (night > 0.05) {
            var starAt = function (s) {
                c.globalAlpha = night * (0.5 + 0.5 * Math.sin(t * 2 + s.p));
                c.fillStyle = '#fff8d6'; c.fillRect(s.x, s.y, s.s, s.s);
            };
            sc.stars.forEach(starAt);
            side.forEach(function (sd) { sd.stars.forEach(starAt); });
            c.globalAlpha = night; c.fillStyle = '#fff6d5';
            ell(c, w * 0.8, h * 0.09, 26, 26); c.fill();
            c.fillStyle = mix('#6ec3ff', '#171235', night); ell(c, w * 0.8 - 11, h * 0.09 - 6, 22, 22); c.fill();
            c.globalAlpha = 1;
        }
        if (night < 0.95) {                                  // sun
            c.globalAlpha = 1 - night; c.fillStyle = mix('#fff3b0', '#ffb36b', dusk);
            ell(c, w * 0.2, h * (0.1 + 0.16 * dusk), 30, 30); c.fill(); c.globalAlpha = 1;
        }
        // mountains
        [['#9fb6e8', '#3b3170', 0.6, h * 0.25], ['#7fa0d8', '#2c2560', 1, h * 0.29]].forEach(function (L, li) {
            c.fillStyle = mix(mix(L[0], '#c98fa6', dusk * 0.6), L[1], night);
            c.beginPath(); c.moveTo(x0, horizon + 10);
            // the ridge repeats every 13 peaks out to the sides
            for (var i = Math.floor(x0 / w * 12), i1 = Math.ceil(x1 / w * 12); i <= i1; i++) {
                var px = i / 12 * w, py = L[3] - sc.hills[((i + li * 5) % 13 + 13) % 13] * h * 0.07 * L[2];
                c.lineTo(px, py);
            }
            c.lineTo(x1, horizon + 10); c.closePath(); c.fill();
        });
        // meadow
        var grass = c.createLinearGradient(0, horizon, 0, h);
        grass.addColorStop(0, mix(mix('#8fd35c', '#c7b35a', dusk * 0.5), '#2f5a4a', night));
        grass.addColorStop(1, mix(mix('#5fb043', '#8e8a3e', dusk * 0.4), '#244a3e', night));
        c.fillStyle = grass; c.fillRect(x0, horizon, x1 - x0, h - horizon);
        // tree line (the forest the wolves come from)
        var pt = paintedTrees(c, w, h, sc, horizon, x0, x1, side);
        if (pt) {
            c.save();
            c.drawImage(pt.day, pt.x, pt.y, pt.cw, pt.ch);
            if (dusk > 0.01) { c.globalAlpha = dusk * 0.3; c.drawImage(pt.dusk, pt.x, pt.y, pt.cw, pt.ch); }
            if (night > 0.01) { c.globalAlpha = night * 0.8; c.drawImage(pt.night, pt.x, pt.y, pt.cw, pt.ch); }
            c.restore();
        } else {
            var drawnTree = function (tr) {
                var tx = tr.x, ty = horizon + 18 + tr.d * 26, s = tr.s * 1.25;
                c.fillStyle = mix(mix('#2f7d4f', '#5d6a3a', dusk * 0.5), '#0f2419', night * (0.9 + 0.1 * tr.d));
                for (var k = 0; k < 3; k++) {
                    c.beginPath(); c.moveTo(tx, ty - (70 - k * 18) * s); c.lineTo(tx - (22 + k * 7) * s, ty - (28 - k * 16) * s); c.lineTo(tx + (22 + k * 7) * s, ty - (28 - k * 16) * s); c.closePath(); c.fill();
                }
                c.fillStyle = mix('#5a3a2a', '#1a120e', night); c.fillRect(tx - 4 * s, ty - 14 * s, 8 * s, 14 * s);
            };
            sc.trees.forEach(drawnTree);
            side.forEach(function (sd) { sd.trees.forEach(drawnTree); });
        }
        c.fillStyle = mix('#3f8f45', '#132a1d', night);
        c.fillRect(x0, horizon + 38, x1 - x0, 10);
        var tuft = function (g) {
            c.strokeStyle = mix('#4f9d3a', '#17301f', night); c.lineWidth = 2.5 * g.s; c.lineCap = 'round';
            c.beginPath(); c.moveTo(g.x - 6 * g.s, g.y); c.lineTo(g.x - 9 * g.s, g.y - 12 * g.s);
            c.moveTo(g.x, g.y); c.lineTo(g.x, g.y - 16 * g.s); c.moveTo(g.x + 6 * g.s, g.y); c.lineTo(g.x + 10 * g.s, g.y - 11 * g.s); c.stroke();
        };
        sc.tufts.forEach(tuft);
        side.forEach(function (sd) { sd.tufts.forEach(tuft); });
        var flower = function (f) {
            c.fillStyle = f.c; c.globalAlpha = 1 - night * 0.6;
            for (var p = 0; p < 5; p++) { ell(c, f.x + Math.cos(p * 1.256) * 4 * f.s, f.y + Math.sin(p * 1.256) * 4 * f.s, 3 * f.s, 3 * f.s); c.fill(); }
            c.fillStyle = '#ffe066'; ell(c, f.x, f.y, 2.2 * f.s, 2.2 * f.s); c.fill(); c.globalAlpha = 1;
        };
        sc.flowers.forEach(flower);
        side.forEach(function (sd) { sd.flowers.forEach(flower); });
    }

    function tent(c, x, y, s, color, night) {
        if (W.sprites && W.sprites.item(c, color === '#5aa7d8' ? 'tent_blue' : 'tent_red', x, y + 6 * s, 122 * s, { bottom: true })) return;
        c.save(); c.translate(x, y); c.scale(s, s);
        c.beginPath(); c.moveTo(-70, 0); c.lineTo(0, -110); c.lineTo(70, 0); c.closePath();
        fillStroke(c, mix(color, '#2a2040', night * 0.6), 4);
        c.beginPath(); c.moveTo(-22, 0); c.lineTo(0, -60); c.lineTo(22, 0); c.closePath(); fillStroke(c, mix('#5a3a2a', '#1a1010', night * 0.5), 3);
        c.strokeStyle = INK; c.lineWidth = 4;
        c.beginPath(); c.moveTo(0, -110); c.lineTo(-10, -130); c.moveTo(0, -110); c.lineTo(12, -128); c.stroke();
        c.fillStyle = 'rgba(255,255,255,0.18)';
        c.beginPath(); c.moveTo(-40, -8); c.lineTo(-8, -92); c.lineTo(-2, -85); c.lineTo(-30, -8); c.closePath(); c.fill();
        c.restore();
    }
    function nest(c, x, y, s, night) {
        if (W.sprites && W.sprites.item(c, 'nest', x, y - 2 * s, 100 * s)) return;
        c.save(); c.translate(x, y); c.scale(s, s);
        ell(c, 0, 0, 80, 26); fillStroke(c, mix('#e9b44c', '#5a4320', night * 0.6), 4);
        c.strokeStyle = mix('#b77f2f', '#3a2a10', night * 0.6); c.lineWidth = 3;
        for (var i = -6; i <= 6; i++) { c.beginPath(); c.moveTo(i * 11, -18); c.lineTo(i * 11 + 9, 16); c.stroke(); }
        c.restore();
    }

    /* The campfire. `level` 1-5 scales it; flames come from W.fx particles. */
    function campfire(c, x, y, s, t) {
        if (W.sprites && W.sprites.item(c, 'campfire', x, y + 4 * s, 88 * s)) return;
        c.save(); c.translate(x, y); c.scale(s, s);
        for (var i = 0; i < 8; i++) {
            var a = i / 8 * TAU;
            ell(c, Math.cos(a) * 52, Math.sin(a) * 16 + 4, 14, 10); fillStroke(c, i % 2 ? '#9a938c' : '#b8b0a6', 3);
        }
        c.save(); c.rotate(0.35); roundRect(c, -46, -10, 92, 18, 8); fillStroke(c, '#7a4a2a', 3); c.restore();
        c.save(); c.rotate(-0.35); roundRect(c, -46, -10, 92, 18, 8); fillStroke(c, '#8a5632', 3); c.restore();
        c.restore();
    }
    /* Cartoon flames: three tongues in three layers, flickering. */
    function flames(c, x, y, s, t) {
        c.save(); c.translate(x, y); c.scale(s, s);
        var layers = [['#ff4d2e', 1.0, true], ['#ff9a1f', 0.74, false], ['#ffe45c', 0.46, false], ['#fffbe0', 0.22, false]];
        layers.forEach(function (L, i) {
            var h = 150 * L[1], w = 62 * L[1];
            c.beginPath();
            for (var k = -1; k <= 1; k++) {
                var off = k * w * 0.62;
                var hh = h * (k === 0 ? 1 : 0.7) * (1 + 0.1 * Math.sin(t * (8 + i * 1.3) + k * 2.1) + 0.05 * Math.sin(t * 17 + k));
                var sway = Math.sin(t * (4.5 + i) + k * 1.7) * 9 * L[1];
                c.moveTo(off - w * 0.52, 0);
                c.bezierCurveTo(off - w * 0.62, -hh * 0.45, off + sway - w * 0.12, -hh * 0.72, off + sway, -hh);
                c.bezierCurveTo(off + sway + w * 0.12, -hh * 0.72, off + w * 0.62, -hh * 0.45, off + w * 0.52, 0);
                c.closePath();
            }
            c.moveTo(w * 1.05, -h * 0.08); c.ellipse(0, -h * 0.08, w * 1.05, h * 0.16, 0, 0, TAU);
            c.fillStyle = L[0]; c.fill();
            if (L[2]) { c.lineWidth = 4; c.strokeStyle = 'rgba(122,30,20,0.55)'; c.stroke(); c.fillStyle = L[0]; c.fill(); }
        });
        c.restore();
    }
    function fireGlow(c, x, y, rad, t, strength) {
        var fl = 1 + Math.sin(t * 7) * 0.03 + Math.sin(t * 13.3) * 0.02;
        var gr = c.createRadialGradient(x, y, 0, x, y, rad * fl);
        gr.addColorStop(0, 'rgba(255,190,90,' + 0.55 * strength + ')');
        gr.addColorStop(0.4, 'rgba(255,140,60,' + 0.22 * strength + ')');
        gr.addColorStop(1, 'rgba(255,120,40,0)');
        c.fillStyle = gr; c.fillRect(x - rad * 1.2, y - rad * 1.2, rad * 2.4, rad * 2.4);
    }
    /* Night: everything darkens except a pool of firelight. */
    function darkness(c, w, h, fx, fy, rad, night, t) {
        if (night <= 0.01) return;
        // a blue night, not a black one: the scene stays colourful
        var fl = 1 + Math.sin(t * 6.1) * 0.025 + Math.sin(t * 11.7) * 0.015;
        var gr = c.createRadialGradient(fx, fy, rad * 0.3 * fl, fx, fy, rad * fl);
        gr.addColorStop(0, 'rgba(30,24,90,0)');
        gr.addColorStop(0.6, 'rgba(30,24,90,' + 0.16 * night + ')');
        gr.addColorStop(1, 'rgba(30,24,90,' + 0.46 * night + ')');
        var V = viewX(w);
        c.fillStyle = gr; c.fillRect(V[0], 0, V[1] - V[0], h);
    }

    /* ------------------------------------------------------------------ fetch + camp decorations */
    function stick(c, x, y, s, rot) {
        if (W.sprites && W.sprites.item(c, 'stick', x, y, 66 * s, { rot: (rot || 0) + 0.785 })) return;   // the painted stick lies diagonally
        c.save(); c.translate(x, y); c.rotate(rot || 0); c.scale(s, s);
        c.lineCap = 'round';
        c.beginPath(); c.moveTo(16, -3); c.lineTo(28, -17);
        c.lineWidth = 9; c.strokeStyle = INK; c.stroke(); c.lineWidth = 4; c.strokeStyle = '#a8703f'; c.stroke();
        roundRect(c, -46, -7, 92, 14, 7); fillStroke(c, '#b57b45', 3);
        c.fillStyle = 'rgba(255,255,255,0.3)'; roundRect(c, -38, -4, 58, 3, 1.5); c.fill();
        c.fillStyle = '#7a4a2a'; ell(c, -24, 1, 2.5, 2); c.fill(); ell(c, 10, 2, 2, 1.6); c.fill();
        c.restore();
    }
    /* a flag garland between two points, sagging, flapping a little */
    function bunting(c, x1, y1, x2, y2, t, night) {
        var cols = ['#ff5f9e', '#ffd23f', '#6ec6ff', '#9ff07a', '#b28dff', '#ff8c42'];
        var mx = (x1 + x2) / 2, my = Math.max(y1, y2) + 70, n = 12;
        c.save();
        c.strokeStyle = mix('#5a3a2a', '#1a1010', night * 0.5); c.lineWidth = 3;
        c.beginPath(); c.moveTo(x1, y1); c.quadraticCurveTo(mx, my, x2, y2); c.stroke();
        for (var i = 1; i < n; i++) {
            var u = i / n, v = 1 - u;
            var px = v * v * x1 + 2 * v * u * mx + u * u * x2, py = v * v * y1 + 2 * v * u * my + u * u * y2;
            c.save(); c.translate(px, py); c.rotate(Math.sin(t * 3 + i * 1.7) * 0.14);
            c.beginPath(); c.moveTo(-13, 0); c.lineTo(13, 0); c.lineTo(0, 30); c.closePath();
            fillStroke(c, mix(cols[i % cols.length], '#2a2040', night * 0.5), 2.5);
            c.restore();
        }
        c.restore();
    }
    function doghouse(c, x, y, s, night) {
        if (W.sprites && W.sprites.item(c, 'doghouse', x, y + 6 * s, 132 * s, { bottom: true })) return;
        var dim = night * 0.5;
        c.save(); c.translate(x, y); c.scale(s, s);
        c.fillStyle = 'rgba(30,20,40,0.22)'; ell(c, 0, 2, 72, 12); c.fill();
        c.beginPath(); c.rect(-55, -62, 110, 62); fillStroke(c, mix('#e8a45c', '#2a2040', dim), 4);
        c.strokeStyle = mix('#c07a3a', '#1a1030', dim); c.lineWidth = 2;
        for (var i = 1; i < 4; i++) { c.beginPath(); c.moveTo(-53, -i * 15.5); c.lineTo(53, -i * 15.5); c.stroke(); }
        c.beginPath(); c.moveTo(-72, -56); c.lineTo(0, -118); c.lineTo(72, -56); c.closePath();
        fillStroke(c, mix('#e0574f', '#2a2040', dim), 4);
        c.fillStyle = 'rgba(255,255,255,0.22)';
        c.beginPath(); c.moveTo(-58, -60); c.lineTo(-4, -106); c.lineTo(2, -100); c.lineTo(-46, -60); c.closePath(); c.fill();
        c.beginPath(); c.moveTo(-23, 0); c.lineTo(-23, -30); c.arc(0, -30, 23, Math.PI, 0); c.lineTo(23, 0); c.closePath();
        fillStroke(c, mix('#3a2418', '#0e0a14', dim), 3);
        bone(c, 0, -76, 1.2, 0);
        c.restore();
    }
    function lantern(c, x, y, s, t, night) {
        if (W.sprites && W.sprites.item(c, 'lantern', x + 8 * s, y + 4 * s, 150 * s, { bottom: true, flip: true })) return;   // its lamp on the right, where the glow is
        var wood = mix('#7a4a2a', '#1a1010', night * 0.5);
        c.save(); c.translate(x, y); c.scale(s, s);
        c.fillStyle = 'rgba(30,20,40,0.2)'; ell(c, 0, 2, 16, 5); c.fill();
        roundRect(c, -6, -124, 12, 124, 5); fillStroke(c, wood, 3);
        c.lineCap = 'round';
        c.beginPath(); c.moveTo(0, -118); c.lineTo(28, -118); c.lineWidth = 8; c.strokeStyle = INK; c.stroke();
        c.lineWidth = 4; c.strokeStyle = wood; c.stroke();
        c.translate(26, -116); c.rotate(Math.sin(t * 1.8 + x * 0.01) * 0.1);
        c.beginPath(); c.moveTo(0, 0); c.lineTo(0, 8); c.lineWidth = 2.5; c.strokeStyle = INK; c.stroke();
        roundRect(c, -13, 9, 26, 32, 9); fillStroke(c, mix('#ffd86b', '#fff0a8', night), 3);
        c.fillStyle = 'rgba(255,255,255,0.55)'; roundRect(c, -8, 13, 5, 22, 2.5); c.fill();
        roundRect(c, -15, 5, 30, 7, 3); fillStroke(c, '#c0392b', 2.5);
        roundRect(c, -12, 38, 24, 6, 3); fillStroke(c, '#c0392b', 2.5);
        c.restore();
    }
    function lanternGlow(c, x, y, s, t, night) {
        if (night < 0.05) return;
        var gx = x + 26 * s, gy = y - 91 * s, rad = 95 * s * (1 + Math.sin(t * 5 + x) * 0.04);
        c.save(); c.globalCompositeOperation = 'lighter';
        var gr = c.createRadialGradient(gx, gy, 0, gx, gy, rad);
        gr.addColorStop(0, 'rgba(255,215,120,' + 0.5 * night + ')'); gr.addColorStop(1, 'rgba(255,190,90,0)');
        c.fillStyle = gr; c.fillRect(gx - rad, gy - rad, rad * 2, rad * 2);
        c.restore();
    }
    /* carved pole: a wolf below, a dog above - the whole game in one totem */
    function totem(c, x, y, s, t, night) {
        if (W.sprites && W.sprites.item(c, 'totem', x, y + 6 * s, 190 * s, { bottom: true })) return;
        var dim = night * 0.5, wood = mix('#c08450', '#2a2040', dim), dark = mix('#86542f', '#1a1030', dim);
        c.save(); c.translate(x, y); c.scale(s, s);
        c.fillStyle = 'rgba(30,20,40,0.22)'; ell(c, 0, 2, 40, 9); c.fill();
        // wolf ears, then the pole
        [-1, 1].forEach(function (sd) {
            c.beginPath(); c.moveTo(sd * 12, -86); c.lineTo(sd * 36, -116); c.lineTo(sd * 26, -80); c.closePath(); fillStroke(c, wood, 3);
        });
        roundRect(c, -25, -172, 50, 172, 10); fillStroke(c, wood, 4);
        c.fillStyle = mix('#3fa0d8', '#1a1030', dim); c.fillRect(-23, -28, 46, 8);
        c.fillStyle = mix('#ff5f9e', '#1a1030', dim); c.fillRect(-23, -100, 46, 8);
        // wolf face: slanted eyes, long nose
        c.fillStyle = INK;
        [-1, 1].forEach(function (sd) { c.beginPath(); c.moveTo(sd * 17, -70); c.lineTo(sd * 5, -64); c.lineTo(sd * 16, -61); c.closePath(); c.fill(); });
        ell(c, 0, -44, 6, 4.5); c.fill();
        c.strokeStyle = INK; c.lineWidth = 2.5; c.beginPath(); c.moveTo(0, -40); c.lineTo(0, -34); c.stroke();
        // dog face: floppy ears, big round eyes, a smile
        [-1, 1].forEach(function (sd) { ell(c, sd * 31, -140, 10, 21, sd * -0.3); fillStroke(c, dark, 3); });
        [-1, 1].forEach(function (sd) {
            c.fillStyle = '#fffdf8'; ell(c, sd * 10, -146, 7.5, 7.5); c.fill();
            c.fillStyle = INK; ell(c, sd * 10, -145, 4.5, 4.5); c.fill();
        });
        ell(c, 0, -131, 5, 3.5); c.fill();
        c.beginPath(); c.moveTo(-8, -127); c.arc(-4, -127, 4, Math.PI, 0, true); c.moveTo(0, -127); c.arc(4, -127, 4, Math.PI, 0, true); c.stroke();
        // feather
        c.save(); c.translate(8, -170); c.rotate(0.35 + Math.sin(t * 2) * 0.08);
        ell(c, 0, -20, 7, 20); fillStroke(c, mix('#ffd23f', '#2a2040', dim), 2.5);
        c.strokeStyle = mix('#e0a800', '#1a1030', dim); c.lineWidth = 2; c.beginPath(); c.moveTo(0, -2); c.lineTo(0, -36); c.stroke();
        c.restore();
        c.restore();
    }
    /* stone statue of the first dog: drawn once, tinted like stone */
    var statueCv = null;
    function statue(c, x, y, s, t, night) {
        if (W.sprites && W.sprites.item(c, 'statue', x, y + 6 * s, 205 * s, { bottom: true })) return;
        if (!statueCv) {
            statueCv = document.createElement('canvas'); statueCv.width = 440; statueCv.height = 460;
            var q = statueCv.getContext('2d'); q.scale(2, 2);
            var g = { sex: 'f', tame: 99, ear: 3, tail: 2, snout: 0.32, eye: 0.8, round: 0.8, size: 0.5, coat: 'white', pat: 'none', fur: 'fluffy', eyeC: 'brown', brow: 1 };
            dog(q, { g: g, seed: 3, age: 1 }, 110, 222, 1.25, { t: 0.4, mood: 'calm', flip: 1, gaze: 1 });
            q.globalCompositeOperation = 'source-atop';
            var gr = q.createLinearGradient(0, 0, 0, 230); gr.addColorStop(0, 'rgba(222,216,206,0.78)'); gr.addColorStop(1, 'rgba(160,152,142,0.82)');
            q.fillStyle = gr; q.fillRect(0, 0, 220, 230);
        }
        var dim = night * 0.5;
        c.save(); c.translate(x, y); c.scale(s, s);
        c.fillStyle = 'rgba(30,20,40,0.22)'; ell(c, 0, 2, 78, 13); c.fill();
        roundRect(c, -62, -46, 124, 46, 8); fillStroke(c, mix('#b9b2a8', '#3a3550', dim), 4);
        roundRect(c, -74, -60, 148, 18, 7); fillStroke(c, mix('#d8d1c6', '#4a4560', dim), 4);
        c.fillStyle = mix('#9a9288', '#2a2540', dim); roundRect(c, -34, -36, 68, 22, 5); c.fill();
        heart(c, 0, -24, 0.8, mix('#ff8fb8', '#5a3050', dim));
        c.drawImage(statueCv, -88, -58 - 184 + 4, 176, 184);
        c.restore();
    }

    /* ------------------------------------------------------------------ particles */
    var parts = [];
    var fx = {
        add: function (p) { p.age = 0; parts.push(p); if (parts.length > 700) parts.splice(0, parts.length - 700); return p; },
        flame: function (x, y, s) {                 // the flames are drawn by art.flames; these are the sparks above them
            if (Math.random() < 0.3) fx.add({ k: 'flame', x: x + (Math.random() - 0.5) * 30 * s, y: y - 60 * s, vx: (Math.random() - 0.5) * 20, vy: -(60 + Math.random() * 60) * s, life: 0.35 + Math.random() * 0.3, r: (5 + Math.random() * 5) * s });
            fx.add({ k: 'ember', x: x + (Math.random() - 0.5) * 40 * s, y: y - 30 * s, vx: (Math.random() - 0.5) * 40, vy: -(90 + Math.random() * 120) * s, life: 1.2 + Math.random(), r: 2 + Math.random() * 2.5 });
        },
        hearts: function (x, y, n, big) {
            for (var i = 0; i < n; i++) fx.add({ k: 'heart', x: x + (Math.random() - 0.5) * 40, y: y, vx: (Math.random() - 0.5) * 80, vy: -(80 + Math.random() * 90), life: 1 + Math.random() * 0.6, s: (big ? 1.3 : 0.8) + Math.random() * 0.5 });
        },
        sparkle: function (x, y, n, color) {
            for (var i = 0; i < n; i++) {
                var a = Math.random() * TAU, v = 80 + Math.random() * 220;
                fx.add({ k: 'spark', x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.6 + Math.random() * 0.6, r: 3 + Math.random() * 4, c: color || '#fff3a0' });
            }
        },
        confetti: function (x, y, n) {
            var cols = ['#ff5f9e', '#ffd23f', '#6ec6ff', '#9ff07a', '#b28dff', '#ff8c42'];
            for (var i = 0; i < n; i++) {
                var a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2, v = 250 + Math.random() * 350;
                fx.add({ k: 'conf', x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1.6 + Math.random(), c: cols[i % cols.length], rot: Math.random() * 6, vr: (Math.random() - 0.5) * 12, w: 8 + Math.random() * 6 });
            }
        },
        text: function (x, y, str, color, size) { fx.add({ k: 'text', x: x, y: y, vx: 0, vy: -60, life: 1.3, str: str, c: color || '#ffffff', size: size || 40 }); },
        firefly: function (w, h, x0) { fx.add({ k: 'fly', x: (x0 || 0) + Math.random() * w, y: h * (0.36 + Math.random() * 0.3), vx: (Math.random() - 0.5) * 30, vy: (Math.random() - 0.5) * 20, life: 4 + Math.random() * 4, ph: Math.random() * 6 }); },
        update: function (dt) {
            for (var i = parts.length - 1; i >= 0; i--) {
                var p = parts[i];
                p.age += dt;
                if (p.age >= p.life) { parts.splice(i, 1); continue; }
                p.x += p.vx * dt; p.y += p.vy * dt;
                if (p.k === 'conf') { p.vy += 600 * dt; p.vx *= 0.99; p.rot += p.vr * dt; }
                else if (p.k === 'spark') { p.vx *= 0.92; p.vy = p.vy * 0.92 + 120 * dt; }
                else if (p.k === 'heart') { p.vx *= 0.96; p.vy *= 0.985; }
                else if (p.k === 'fly') { p.vx += (Math.random() - 0.5) * 40 * dt; p.vy += (Math.random() - 0.5) * 40 * dt; }
            }
        },
        draw: function (c, night, layer) {
            for (var i = 0; i < parts.length; i++) {
                var p = parts[i], u = p.age / p.life;
                if ((layer === 'fire') !== (p.k === 'flame' || p.k === 'ember')) continue;
                switch (p.k) {
                    case 'flame':
                        c.globalCompositeOperation = 'lighter';
                        var col = u < 0.3 ? 'rgba(255,240,170,' : u < 0.6 ? 'rgba(255,160,60,' : 'rgba(230,70,40,';
                        c.fillStyle = col + (0.75 * (1 - u)) + ')';
                        ell(c, p.x, p.y, p.r * (1 - u * 0.6), p.r * (1.3 - u * 0.5)); c.fill();
                        c.globalCompositeOperation = 'source-over';
                        break;
                    case 'ember':
                        c.fillStyle = 'rgba(255,200,90,' + (1 - u) + ')'; c.fillRect(p.x, p.y, p.r, p.r); break;
                    case 'heart': c.globalAlpha = 1 - u * u; heart(c, p.x, p.y, p.s * (u < 0.15 ? u / 0.15 : 1)); c.globalAlpha = 1; break;
                    case 'spark': c.globalAlpha = 1 - u; star(c, p.x, p.y, p.r * (1 - u * 0.5), p.c); c.globalAlpha = 1; break;
                    case 'conf':
                        c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.globalAlpha = 1 - Math.max(0, u - 0.7) / 0.3;
                        c.fillStyle = p.c; c.fillRect(-p.w / 2, -p.w / 4, p.w, p.w / 2); c.restore(); break;
                    case 'text':
                        c.save(); c.globalAlpha = 1 - Math.max(0, u - 0.6) / 0.4;
                        var sz = p.size * (u < 0.12 ? 0.6 + u / 0.12 * 0.5 : 1.1 - Math.min(0.1, (u - 0.12)));
                        c.font = '900 ' + sz + 'px "Trebuchet MS", system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
                        c.lineWidth = 8; c.strokeStyle = INK; c.lineJoin = 'round'; c.strokeText(p.str, p.x, p.y);
                        c.fillStyle = p.c; c.fillText(p.str, p.x, p.y); c.restore(); break;
                    case 'fly':
                        if (night < 0.2) break;
                        var a = night * (0.5 + 0.5 * Math.sin(p.age * 4 + p.ph)) * Math.min(1, (p.life - p.age));
                        c.fillStyle = 'rgba(210,255,120,' + a * 0.35 + ')'; ell(c, p.x, p.y, 9, 9); c.fill();
                        c.fillStyle = 'rgba(240,255,170,' + a + ')'; ell(c, p.x, p.y, 2.5, 2.5); c.fill();
                        break;
                }
            }
        },
        clear: function () { parts.length = 0; }
    };

    W.art = {
        dog: dog, heart: heart, star: star, bone: bone, treat: treat,
        world: world, setView: setView, viewX: viewX, tent: tent, nest: nest, campfire: campfire, flames: flames, fireGlow: fireGlow, darkness: darkness,
        roundRect: roundRect, ell: ell, COAT: COAT, INK: INK, mix: mix,
        stick: stick, bunting: bunting, doghouse: doghouse, lantern: lantern, lanternGlow: lanternGlow, totem: totem, statue: statue
    };
    W.fx = fx;
})();
