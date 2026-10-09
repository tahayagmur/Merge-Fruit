/* Wolf to Woof - painted sprites (generated art, cut out and packed as WebP in img/).
 * Every dog is still bred from its genes; its picture is the painting that fits those genes:
 * its breed, else a wolf (wild colours, nothing domestic yet), a coat pattern, or a coat colour
 * with upright or floppy ears. Pictures load in the background; until one has arrived the dog
 * is drawn by code as before, so the first frame never waits for them. */
(function () {
    'use strict';
    var W = window.WTW = window.WTW || {};
    var IMG = {}, OK = {}, started = false;

    var DOGS = ['w_wild', 'w_white', 'w_black', 'w_red', 'w_gold',
        'w_wild_side', 'w_white_side', 'w_black_side', 'w_red_side', 'w_gold_side',
        'b_ember', 'b_sable', 'b_shadow', 'b_golden', 'b_patch', 'b_tiger', 'b_whisker', 'b_cloud', 'b_truffle', 'b_velvet',
        'b_silver', 'b_marble', 'b_tux', 'b_husky', 'b_spotted', 'b_cotton', 'b_button', 'b_oddeye', 'b_heart', 'b_friend',
        'm_wild_down', 'm_sable_down', 'm_golden_up', 'm_cream_up', 'm_cream_down', 'm_black_down', 'm_choc_up', 'm_choc_down',
        'm_blue_up', 'm_white_down', 'p_pie_up', 'p_brindle_up', 'p_tux_up', 'p_spots_up'];
    var ITEMS = ['toy_ball', 'toy_duck', 'toy_bone', 'toy_ring', 'toy_star', 'toy_cube', 'toy_carrot', 'toy_fish', 'toy_disc', 'toy_rope',
        'toy_sock', 'toy_drum', 'kid', 'kid_cheer', 'jar', 'mitten', 'rack', 'fish', 'crow', 'it_treat', 'it_ball', 'it_gold', 'stick',
        'an_fox', 'an_wolf', 'an_bear', 'an_deer', 'an_goat', 'tent_red', 'tent_blue', 'nest', 'doghouse', 'totem', 'statue', 'lantern', 'campfire',
        'tree_pine', 'tree_spruce', 'tree_fir', 'tree_pine2', 'tree_oak', 'tree_bush',
        // the camp through the ages: homes, fire, puppy den, pantry, and what a village adds
        'house_2', 'house_3', 'house_4', 'house_5', 'house_6', 'fire_2', 'fire_3', 'fire_4', 'fire_5',
        'nest_2', 'nest_3', 'nest_4', 'nest_5', 'nest_6', 'pantry_1', 'pantry_3', 'pantry_4',
        'fence', 'well', 'sign', 'garden', 'flowers',
        // the crow's wing beat in Point!
        'fly_crow_0', 'fly_crow_1', 'fly_crow_2', 'fly_crow_3'];

    function load(k) {
        var im = new Image();
        im.decoding = 'async';
        im.onload = function () { OK[k] = true; };
        im.src = 'img/' + k + '.webp';
        IMG[k] = im;
    }
    /* call once the first frame is up: the pictures never hold up the start */
    function start() {
        if (started) return;
        started = true;
        DOGS.concat(ITEMS).forEach(load);
    }
    function get(k) { return OK[k] ? IMG[k] : null; }

    /* ---- genes -> picture ---- */
    var WOLF = { wild: 'w_wild', white: 'w_white', black: 'w_black', red: 'w_red', golden: 'w_gold' };
    // [upright ears, floppy ears]; where a breed already looks the part its painting is shared
    var PATTERN = { pie: ['p_pie_up', 'b_patch'], brindle: ['p_brindle_up', 'b_tiger'], merle: ['b_marble', 'b_marble'], tux: ['p_tux_up', 'b_tux'], spots: ['p_spots_up', 'b_spotted'] };
    var COAT = {
        wild: ['w_wild', 'm_wild_down'], sable: ['b_sable', 'm_sable_down'], red: ['b_ember', 'b_velvet'], golden: ['m_golden_up', 'b_golden'],
        cream: ['m_cream_up', 'm_cream_down'], black: ['b_shadow', 'm_black_down'], choc: ['m_choc_up', 'm_choc_down'], blue: ['m_blue_up', 'b_silver'],
        white: ['b_cloud', 'm_white_down']
    };
    var cache = typeof WeakMap === 'function' ? new WeakMap() : null;
    function lookOf(g) {
        var c = cache && cache.get(g);
        if (c && c.t === g.tame) return c.k;                 // genes are set at birth; only tameness grows
        // the ears' first fold already shows as floppy ears: it is the first change a breeder sees
        var k, b = W.breeds && W.breeds.of(g), down = g.ear >= 1 ? 1 : 0;
        if (b) k = 'b_' + b.id;
        else if (WOLF[g.coat] && g.ear < 1 && !g.tail && (g.pat === 'none' || g.pat === 'mask') && g.fur === 'short' && g.tame < 20) k = WOLF[g.coat];
        else if (PATTERN[g.pat]) k = PATTERN[g.pat][down];
        else k = (COAT[g.coat] || COAT.wild)[down];
        if (cache) cache.set(g, { t: g.tame, k: k });
        return k;
    }

    /* ---- walking: side-view cycles (js/walks.js), four frames walking to the right ---- */
    var WALK = W.walks || {}, WF = {};
    /* a look's walk frames, asked for on its first drawing: f = side view (4, walking right),
       f.front / f.back = towards the viewer / away (2 each) where painted; null until the side ones are in */
    function walkFrames(k) {
        var f = WF[k];
        if (!f) {
            if (!WALK[k] || !started) return null;
            f = WF[k] = [];
            f.n = 0;
            var get = function (list, name, i, count) {
                var im = new Image();
                im.decoding = 'async';
                im.onload = function () { list[i] = im; if (count) f.n++; else list.n = (list.n || 0) + 1; };
                im.src = 'img/' + name + '.webp';
            };
            [0, 1, 2, 3].forEach(function (i) { get(f, 'wk_' + k + '_' + i, i, true); });
            if (WALK[k].front) { f.front = []; [0, 1].forEach(function (i) { get(f.front, 'wf_' + k + '_' + i, i); }); }
            if (WALK[k].back) { f.back = []; [0, 1].forEach(function (i) { get(f.back, 'wb_' + k + '_' + i, i); }); }
        }
        return f.n === 4 ? f : null;
    }
    /* where each dog was last drawn: the frames follow the ground it covers (no sliding feet), it
       faces the way it goes, and it settles when it stops. A drawing with an older clock or at
       another spot in the same frame (a portrait, a card) is not the dog on the move. */
    var STEP = 22;                                            // ground covered per frame at scale 1 (4 frames = 1 stride)
    var moves = cache ? new WeakMap() : null, poses = cache ? new WeakMap() : null;
    function track(g, x, y, t, s, walking, flip) {
        if (!moves || typeof t !== 'number') return null;
        var m = moves.get(g);
        if (!m) { m = { x: x, y: y, t: t, vx: 0, vy: 0, sp: 0, ph: 0, face: flip, view: 'side', on: false, end: -9 }; moves.set(g, m); }
        var dt = t - m.t;
        if (dt < 0 || (dt === 0 && (x !== m.x || y !== m.y))) return null;
        if (dt > 0) {
            var dx = x - m.x, dy = y - m.y, dist = Math.sqrt(dx * dx + dy * dy);
            if (dt > 0.5 || dist > 160 * s + 40 + 1400 * dt) { dx = 0; dy = 0; dist = 0; }   // a pause, or put somewhere else
            var a = Math.min(1, dt / 0.12);
            m.vx += (dx / dt - m.vx) * a;
            m.vy += (dy / dt - m.vy) * a;
            m.sp += (dist / dt - m.sp) * a;
            if (walking) m.ph += Math.min(dist / (STEP * s), dt * 14);
            if (Math.abs(m.vx) > 0.3 * m.sp && m.sp > 8) m.face = m.vx < 0 ? -1 : 1;
            // which way it is seen: side-on, coming towards the viewer (down the screen) or going away;
            // a little stickiness so a diagonal walk does not flicker between the two
            var ax = Math.abs(m.vx), ay = Math.abs(m.vy);
            if (m.sp > 8) {
                if (m.view === 'side') { if (ay > ax * 1.35) m.view = m.vy > 0 ? 'front' : 'back'; }
                else if (ax > ay * 1.05) m.view = 'side';
                else m.view = m.vy > 0 ? 'front' : 'back';
            }
        }
        if (!walking) m.face = flip;
        if (m.on && !walking) m.end = t;
        m.on = !!walking;
        m.x = x; m.y = y; m.t = t;
        return m;
    }
    /* mouth and head of the dog as last drawn, for what it carries and what floats over it */
    function pose(g) { return poses && poses.get(g) || null; }

    /* ---- a dog: same call as art.dog; false when its picture is not here yet.
       o.walk: it is on the move (side-view walk cycle); o.hop above a step's height is a leap ---- */
    var H1 = 158;                                             // a grown dog's height at scale 1, like the drawn ones
    function drawDog(c, d, x, y, s, o) {
        o = o || {};
        if (!W.sprites.on || o.code) return false;
        var look = lookOf(d.g), k = look;
        var wf = walkFrames(look);
        if (o.away && OK[k + '_side']) k += '_side';
        var im = get(k);
        if (!im) return false;
        var t = o.t || 0, mood = o.mood || 'calm', flip = o.flip || 1, hop = o.hop || 0, seed = d.seed || 0;
        var pup = 1 - (d.age === undefined ? 1 : Math.max(0, Math.min(1, d.age)));
        var h = H1 * s * (1 + 0.1 * pup);
        var m = track(d.g, x, y, o.t, s, o.walk && !o.away, flip);
        var walking = !!(m && m.on), air = walking && hop > 22 * s;
        c.save();
        c.imageSmoothingQuality = 'high';                       // big paintings shrink a lot on a phone
        if (walking && wf) {
            // painted walk cycle: side-on (4 frames), or towards / away from the viewer (2 steps each)
            // when it walks mostly up or down the screen; the body bobs at each step, a run stretches it
            var info = WALK[look], face = m.face || flip, run = m.sp > 230 * s;
            var view = !air && m.view !== 'side' && wf[m.view] && wf[m.view].n === 2 ? m.view : 'side';
            var vi = view === 'side' ? info : info[view], f, fr;
            if (view === 'side') { f = air ? 1 : Math.floor(m.ph) % 4; fr = wf[f]; }
            else { f = Math.floor(m.ph / 2) % 2; fr = wf[view][f]; face = 1; }
            var up = Math.abs(Math.sin((m.ph - 0.5) * Math.PI / 2));
            var bob = air ? hop : up * (run ? 6 : 2.2) * s;
            var wsx = run ? 1 + 0.035 * (1 - up) : 1, wsy = run ? 1 - 0.035 * (1 - up) : 1;
            var hh = h * vi.k, ww = hh * fr.width / fr.height;
            c.fillStyle = 'rgba(30,20,40,0.22)';
            c.beginPath(); c.ellipse(x, y + 2 * s, Math.max(1, ww * (view === 'side' ? 0.36 : 0.3) * (1 - Math.min(0.3, bob / (80 * s + 1)))), Math.max(1, 7 * s), 0, 0, Math.PI * 2); c.fill();
            c.translate(x, y - bob);
            c.scale(face * wsx, wsy);
            c.drawImage(fr, -vi.cx * ww, -vi.g * hh, ww, hh);
            c.restore();
            if (poses) poses.set(d.g, {                         // hy: the middle of the head, as for a sitting dog
                mx: x + face * (vi.mouth[f][0] - vi.cx) * ww * wsx, my: y - bob - (vi.g - vi.mouth[f][1]) * hh * wsy,
                hy: y - bob - (vi.g - vi.head[f] - 0.27) * hh * wsy, face: face, walking: true, view: view
            });
            return true;
        }
        var w = h * im.width / im.height;
        var sx = 1, sy = 1 + Math.sin(t * 2.2 + seed) * 0.018, rot = 0;
        if (walking) {
            // no walk cycle painted for this look: a springy trot that follows the ground covered (no rocking)
            if (!air) hop = Math.abs(Math.sin(m.ph * Math.PI / 2)) * 6 * s;
            var land = 1 - Math.abs(Math.sin(m.ph * Math.PI / 2));
            sy *= 1 - 0.06 * land * land; sx = 1 + 0.05 * land * land;
            flip = m.face || flip;
        } else {
            if (o.wag) rot += Math.sin(t * (6 + 8 * o.wag)) * 0.022 * o.wag;
            if (mood === 'happy') hop += Math.max(0, Math.sin(t * 7 + seed)) * 4 * s;
            else if (mood === 'scared') { sy *= 0.93; sx = 1.03; }          // crouches (a flinch is shaken by the caller)
            else if (mood === 'sleep') { rot = 0.12 * flip; sy *= 0.9; sx = 1.04; }
            else if (mood === 'howl') { sy *= 1.05 + Math.sin(t * 6) * 0.02; sx = 0.97; }
            if (m && t - m.end < 0.2) {                          // just stopped walking: it settles onto its haunches
                var e = Math.sin((t - m.end) / 0.2 * Math.PI);
                sy *= 1 - 0.07 * e; sx *= 1 + 0.05 * e;
            }
        }
        c.fillStyle = 'rgba(30,20,40,0.22)';
        c.beginPath(); c.ellipse(x, y + 2 * s, Math.max(1, w * 0.34 * (1 - Math.min(0.3, hop / (80 * s + 1)))), Math.max(1, 7 * s), 0, 0, Math.PI * 2); c.fill();
        c.translate(x, y - hop);
        c.rotate(rot);
        c.scale(flip * sx, sy);
        c.drawImage(im, -w / 2, -h, w, h);
        c.restore();
        if (poses && m) poses.set(d.g, { mx: x, my: y - hop - 80 * s, hy: y - hop - 104 * s, face: flip, walking: walking });
        return true;
    }

    /* ---- an object: its height h; centred on (x, y), or standing on y with o.bottom ---- */
    function item(c, k, x, y, h, o) {
        var im = get(k);
        if (!im || !W.sprites.on) return false;
        o = o || {};
        var w = h * im.width / im.height;
        c.save();
        c.imageSmoothingQuality = 'high';
        c.translate(x, y);
        if (o.rot) c.rotate(o.rot);
        if (o.flip) c.scale(-1, 1);
        if (o.alpha !== undefined) c.globalAlpha *= o.alpha;
        c.drawImage(im, -w / 2, o.bottom ? -h : -h / 2, w, h);
        c.restore();
        return true;
    }

    function has(d) { return !!(W.sprites.on && d && d.g && get(lookOf(d.g))); }

    W.sprites = {
        on: true, start: start, get: get, has: has, lookOf: lookOf, drawDog: drawDog, item: item, pose: pose,
        keys: DOGS.concat(ITEMS),
        loaded: function () { return Object.keys(OK).length; },
        walks: function () { return Object.keys(WALK); },
        walkReady: function (k) { return !!(WF[k] && WF[k].n === 4); }
    };
})();
