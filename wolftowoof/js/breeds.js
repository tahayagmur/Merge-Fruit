/* Wolf to Woof - breeds: named combinations of traits.
 * Breeding only for tameness is the start; breeds give the player a reason to
 * choose particular parents. Every recipe is shown in the book, so each locked
 * breed is a concrete goal. */
(function () {
    'use strict';
    var W = window.WTW = window.WTW || {};
    var G = W.gen;

    function has(key) { return { k: key, f: function (g, tr) { return tr.indexOf(key) >= 0; } }; }
    function req(label, f, p) { return { label: label, p: p, f: f }; }
    var EARS_UP = req('reqEarsUp', function (g) { return g.ear <= 1; });
    var EARS_DOWN = req('reqEarsDown', function (g) { return g.ear >= 3; });
    var CURL = req('reqCurl', function (g) { return g.tail >= 2; });
    var ANY_TAIL = req('reqTailUp', function (g) { return g.tail >= 1; });
    var SHORT = req('reqShortFur', function (g) { return g.fur === 'short'; });
    var LIGHT = req('reqLight', function (g) { return g.coat === 'cream' || g.coat === 'white'; });
    var BLUE_EYES = req('reqBlueEyes', function (g) { return g.eyeC === 'blue' || g.eyeC === 'hetero'; });
    var WARM_EYES = req('reqWarmEyes', function (g) { return g.eyeC === 'brown' || g.eyeC === 'hazel'; });
    function tameMin(n) { return req('reqTame', function (g) { return g.tame >= n; }, { n: n }); }
    function cuteMin(n) { return req('reqCute', function (g, tr, cute) { return cute >= n; }, { n: n }); }

    // show: a genome that fits the recipe, drawn in the book
    var BASE = { sex: 'f', tame: 60, ear: 1, tail: 1, snout: 0.55, eye: 0.5, round: 0.5, size: 0.6, coat: 'sable', pat: 'none', fur: 'short', eyeC: 'brown', brow: 0 };
    function show(o) { var g = {}; for (var k in BASE) g[k] = BASE[k]; for (var j in o) g[j] = o[j]; return g; }

    var LIST = [
        { id: 'ember', stars: 1, need: [has('coat:red'), has('pat:mask'), req('reqSickle', function (g) { return g.tail === 1; }), EARS_UP],
          show: show({ coat: 'red', pat: 'mask', tail: 1, ear: 0, snout: 0.6, eye: 0.45 }) },
        { id: 'sable', stars: 1, need: [has('coat:sable'), has('pat:saddle'), EARS_UP],
          show: show({ coat: 'sable', pat: 'saddle', ear: 0, tail: 0, snout: 0.7 }) },
        { id: 'shadow', stars: 2, need: [has('coat:black'), EARS_UP, WARM_EYES, tameMin(20)],
          show: show({ coat: 'black', ear: 0, tail: 1, eyeC: 'brown' }) },
        { id: 'golden', stars: 2, need: [has('coat:golden'), EARS_DOWN, WARM_EYES],
          show: show({ coat: 'golden', ear: 3, tail: 1, eyeC: 'brown', eye: 0.6, round: 0.6 }) },
        { id: 'patch', stars: 2, need: [has('pat:pie'), EARS_DOWN, ANY_TAIL],
          show: show({ coat: 'sable', pat: 'pie', ear: 3, tail: 1 }) },
        { id: 'tiger', stars: 2, need: [has('pat:brindle'), SHORT, req('reqNotLong', function (g) { return g.ear <= 2; })],
          show: show({ coat: 'golden', pat: 'brindle', ear: 2, tail: 0, snout: 0.45 }) },
        { id: 'whisker', stars: 2, need: [has('fur:wiry'), req('reqHalfEars', function (g) { return g.ear === 1 || g.ear === 2; })],
          show: show({ coat: 'cream', fur: 'wiry', ear: 1, tail: 1 }) },
        { id: 'cloud', stars: 3, need: [LIGHT, has('fur:fluffy'), CURL],
          show: show({ coat: 'white', fur: 'fluffy', tail: 2, ear: 0, eye: 0.6, round: 0.7 }) },
        { id: 'truffle', stars: 3, need: [has('coat:choc'), has('fur:curly')],
          show: show({ coat: 'choc', fur: 'curly', ear: 3, tail: 1, eye: 0.6 }) },
        { id: 'velvet', stars: 3, need: [has('ear4'), req('reqWarmCoat', function (g) { return g.coat === 'choc' || g.coat === 'golden' || g.coat === 'red'; }), SHORT],
          show: show({ coat: 'red', ear: 4, tail: 0, snout: 0.6, eye: 0.6 }) },
        { id: 'silver', stars: 3, need: [has('coat:blue'), SHORT, req('reqPaleEyes', function (g) { return g.eyeC === 'hazel' || g.eyeC === 'blue'; })],
          show: show({ coat: 'blue', ear: 3, eyeC: 'hazel', tail: 0 }) },
        { id: 'marble', stars: 3, need: [has('pat:merle'), BLUE_EYES],
          show: show({ coat: 'blue', pat: 'merle', eyeC: 'blue', ear: 2, tail: 1, fur: 'fluffy' }) },
        { id: 'tux', stars: 3, need: [has('coat:black'), has('pat:tux')],
          show: show({ coat: 'black', pat: 'tux', ear: 2, tail: 1 }) },
        { id: 'husky', stars: 4, need: [req('reqGreyCoat', function (g) { return g.coat === 'blue' || g.coat === 'wild' || g.coat === 'white'; }), has('pat:mask'), BLUE_EYES, CURL, EARS_UP],
          show: show({ coat: 'wild', pat: 'mask', eyeC: 'blue', tail: 2, ear: 0, fur: 'fluffy', eye: 0.55 }) },
        { id: 'spotted', stars: 4, need: [has('coat:white'), has('pat:spots'), SHORT],
          show: show({ coat: 'white', pat: 'spots', ear: 3, tail: 0, eye: 0.6 }) },
        { id: 'cotton', stars: 4, need: [has('fur:curly'), has('face:tiny')],
          show: show({ coat: 'cream', fur: 'curly', size: 0.2, ear: 3, eye: 0.7, round: 0.7 }) },
        { id: 'button', stars: 4, need: [has('face:button'), has('face:round'), has('face:bigeyes')],
          show: show({ coat: 'golden', snout: 0.2, round: 0.85, eye: 0.85, ear: 2, tail: 3, size: 0.4 }) },
        { id: 'oddeye', stars: 4, need: [has('eye:hetero'), req('reqWhiteOrMerle', function (g) { return g.coat === 'white' || g.pat === 'merle'; })],
          show: show({ coat: 'white', pat: 'merle', eyeC: 'hetero', ear: 1, tail: 2, eye: 0.7 }) },
        { id: 'heart', stars: 5, need: [has('brow'), has('face:bigeyes'), cuteMin(80)],
          show: show({ coat: 'cream', pat: 'pie', brow: 1, eye: 0.95, round: 0.9, snout: 0.2, size: 0.3, ear: 3, fur: 'fluffy', tail: 2 }) },
        { id: 'friend', stars: 5, need: [has('brow'), tameMin(95)],
          show: show({ coat: 'golden', brow: 1, tame: 99, eye: 0.85, round: 0.8, snout: 0.3, ear: 3, fur: 'fluffy', tail: 2 }) }
    ];

    function match(g) {
        var tr = G.traits(g), cute = G.cuteness(g);
        return LIST.filter(function (b) { return b.need.every(function (n) { return n.f(g, tr, cute); }); });
    }
    /* the breed a dog is shown as: its rarest match */
    function of(g) {
        var m = match(g);
        if (!m.length) return null;
        return m.sort(function (a, b) { return b.stars - a.stars; })[0];
    }
    function label(n) {
        if (n.k) return W.i18n.trait(n.k);
        return W.i18n.t(n.label, n.p);
    }

    W.breeds = { LIST: LIST, match: match, of: of, label: label, byId: function (id) { return LIST.find(function (b) { return b.id === id; }); } };
})();
