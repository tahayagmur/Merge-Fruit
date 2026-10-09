/* Wolf to Woof - every sound is synthesized with WebAudio (no audio files).
   The context starts on the first touch; YouTube's pause and sound switch
   go through setEnabled / suspend / resume. */
(function () {
    'use strict';
    var W = window.WTW = window.WTW || {};

    var ctx = null, master = null, fireGain = null, fireNode = null, musicGain = null;
    var enabled = true, suspended = false, musicOn = true;
    var noiseBuf = null;
    var PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];

    function ensure() {
        if (ctx) return ctx;
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        try { ctx = new AC(); } catch (_) { ctx = null; return null; }
        master = ctx.createGain();
        master.gain.value = enabled ? 0.8 : 0;
        master.connect(ctx.destination);
        var n = ctx.sampleRate * 1.5;
        noiseBuf = ctx.createBuffer(1, n, ctx.sampleRate);
        var d = noiseBuf.getChannelData(0);
        for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
        // the fire's loop is a sound source: it waits until YouTube's sound is on and the game runs
        if (enabled && !suspended) startFire(); else ctx.suspend().catch(function () {});
        startMusic();
        return ctx;
    }
    /* sound allowed again: wake the context and light the fire's loop if it never started */
    function wake() {
        if (!ctx || !enabled || suspended) return;
        if (ctx.state === 'suspended') ctx.resume().catch(function () {});
        if (!fireNode) startFire();
    }
    function now() { return ctx.currentTime; }
    function hz(semi, base) { return (base || 440) * Math.pow(2, semi / 12); }

    function tone(o) {
        if (!ctx || !enabled || suspended) return;
        var t0 = now() + (o.delay || 0);
        var osc = ctx.createOscillator(), g = ctx.createGain();
        osc.type = o.type || 'sine';
        osc.frequency.setValueAtTime(o.f, t0);
        if (o.f2) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.f2), t0 + (o.glide || o.dur));
        var a = o.attack || 0.008, v = o.vol || 0.2;
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(v, t0 + a);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
        if (o.vib) {
            var lfo = ctx.createOscillator(), lg = ctx.createGain();
            lfo.frequency.value = o.vib; lg.gain.value = o.vibDepth || 18;
            lfo.connect(lg); lg.connect(osc.frequency); lfo.start(t0); lfo.stop(t0 + o.dur + 0.05);
        }
        osc.connect(g); g.connect(o.out || master);
        osc.start(t0); osc.stop(t0 + o.dur + 0.05);
    }
    function noise(o) {
        if (!ctx || !enabled || suspended) return;
        var t0 = now() + (o.delay || 0);
        var src = ctx.createBufferSource(); src.buffer = noiseBuf;
        var f = ctx.createBiquadFilter(); f.type = o.filter || 'bandpass';
        f.frequency.setValueAtTime(o.f || 1200, t0);
        if (o.f2) f.frequency.exponentialRampToValueAtTime(o.f2, t0 + o.dur);
        f.Q.value = o.q || 1;
        var g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(o.vol || 0.2, t0 + (o.attack || 0.005));
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
        src.connect(f); f.connect(g); g.connect(o.out || master);
        src.start(t0, Math.random() * 1.2); src.stop(t0 + o.dur + 0.05);
    }

    /* ---- the campfire: soft roar + random crackles ---- */
    function startFire() {
        fireGain = ctx.createGain(); fireGain.gain.value = 0.10; fireGain.connect(master);
        var src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
        var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420;
        src.connect(lp); lp.connect(fireGain); src.start();
        fireNode = src;
        (function crackle() {
            if (ctx && enabled && !suspended && Math.random() < 0.9) {
                noise({ f: 1800 + Math.random() * 2500, q: 4, dur: 0.03 + Math.random() * 0.05, vol: 0.05 + Math.random() * 0.07, out: fireGain });
            }
            setTimeout(crackle, 90 + Math.random() * 380);
        })();
    }

    /* ---- gentle pentatonic music box, random walk ---- */
    function startMusic() {
        musicGain = ctx.createGain(); musicGain.gain.value = 0.35; musicGain.connect(master);
        var step = 4, beat = 0;
        (function play() {
            if (ctx && enabled && !suspended && musicOn) {
                step = Math.max(0, Math.min(PENTA.length - 1, step + [-2, -1, -1, 1, 1, 2, 0][Math.floor(Math.random() * 7)]));
                if (beat % 2 === 0 || Math.random() < 0.5) {
                    tone({ f: hz(PENTA[step] - 5, 440), type: 'triangle', dur: 0.9, vol: 0.05, out: musicGain });
                }
                if (beat % 8 === 0) tone({ f: hz(PENTA[step % 5] - 29, 440), type: 'sine', dur: 2.2, vol: 0.06, attack: 0.2, out: musicGain });
                beat++;
            }
            setTimeout(play, 420);
        })();
    }

    /* ---- a held voice for the Howl Chorus: slides between notes with a little vibrato ---- */
    function voice(o) {
        o = o || {};
        var osc = null, lfo = null, lp = null, g = null, cur = 300, live = false;
        function build() {
            if (osc) return true;
            if (!ctx) return false;
            osc = ctx.createOscillator(); osc.type = o.type || 'triangle'; osc.frequency.value = cur;
            lfo = ctx.createOscillator(); lfo.frequency.value = 4.6 + Math.random() * 1.2;
            var lg = ctx.createGain(); lg.gain.value = o.vib || 7;
            lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = o.lp || 1500; lp.Q.value = 0.8;
            g = ctx.createGain(); g.gain.value = 0;
            lfo.connect(lg); lg.connect(osc.frequency); osc.connect(lp); lp.connect(g); g.connect(master);
            osc.start(); lfo.start(); live = true;
            return true;
        }
        return {
            on: function (f) {                                      // a howl starts low and slides up
                cur = f; if (!enabled || suspended || !build()) return;   // no new sound while YouTube has it off or paused
                var t0 = now();
                osc.frequency.cancelScheduledValues(t0); osc.frequency.setValueAtTime(f * 0.8, t0); osc.frequency.setTargetAtTime(f, t0, 0.09);
                g.gain.cancelScheduledValues(t0); g.gain.setTargetAtTime(o.vol || 0.05, t0, 0.07);
            },
            set: function (f) { cur = f; if (osc) osc.frequency.setTargetAtTime(f, now(), 0.05); },
            off: function () {                                      // ... and falls away at the end
                if (!osc) return;
                var t0 = now();
                osc.frequency.setTargetAtTime(cur * 0.86, t0, 0.2); g.gain.cancelScheduledValues(t0); g.gain.setTargetAtTime(0, t0, 0.1);
            },
            stop: function () {
                if (!osc || !live) return;
                live = false;
                var t0 = now(), O = osc, L = lfo, G = g;
                G.gain.cancelScheduledValues(t0); G.gain.setTargetAtTime(0, t0, 0.04);
                try { O.stop(t0 + 0.3); L.stop(t0 + 0.3); } catch (_) {}
                setTimeout(function () { try { O.disconnect(); L.disconnect(); G.disconnect(); } catch (_) {} }, 600);
                osc = lfo = lp = g = null;
            }
        };
    }

    var SFX = {
        tap: function () { tone({ f: 880, f2: 1320, dur: 0.07, vol: 0.08, type: 'triangle' }); },
        whoosh: function () { noise({ f: 600, f2: 2400, q: 0.8, dur: 0.25, vol: 0.12, filter: 'bandpass' }); },
        land: function () { noise({ f: 300, f2: 120, q: 1, dur: 0.12, vol: 0.18, filter: 'lowpass' }); },
        munch: function () { for (var i = 0; i < 3; i++) noise({ f: 900 + i * 200, q: 2, dur: 0.06, vol: 0.14, delay: i * 0.11 }); },
        yip: function (pitch) {
            var p = pitch || 1;
            tone({ f: 700 * p, f2: 1250 * p, glide: 0.09, dur: 0.16, vol: 0.14, type: 'triangle', vib: 30, vibDepth: 40 });
        },
        bark: function () { tone({ f: 420, f2: 260, glide: 0.12, dur: 0.18, vol: 0.16, type: 'sawtooth' }); noise({ f: 800, q: 1, dur: 0.1, vol: 0.06 }); },
        howl: function () { tone({ f: 330, f2: 520, glide: 0.8, dur: 1.4, vol: 0.07, type: 'sine', vib: 5, vibDepth: 10, attack: 0.25 }); },
        heart: function () { tone({ f: hz(PENTA[5 + Math.floor(Math.random() * 5)], 523), dur: 0.35, vol: 0.09, type: 'sine' }); },
        flee: function () { tone({ f: 600, f2: 180, dur: 0.35, vol: 0.1, type: 'triangle' }); },
        wrong: function () { tone({ f: 300, f2: 220, dur: 0.18, vol: 0.1, type: 'square' }); },
        good: function () { tone({ f: 660, dur: 0.12, vol: 0.1 }); tone({ f: 990, dur: 0.18, vol: 0.1, delay: 0.08 }); },
        bond: function () { [0, 4, 7, 12, 16].forEach(function (s, i) { tone({ f: hz(s, 523), dur: 0.4, vol: 0.11, delay: i * 0.08, type: 'triangle' }); }); },
        pop: function (i) { tone({ f: 900 + (i || 0) * 90, f2: 320, dur: 0.14, vol: 0.14, type: 'sine' }); },
        newTrait: function () {
            [0, 7, 12, 16, 19, 24].forEach(function (s, i) { tone({ f: hz(s, 659), dur: 0.3, vol: 0.09, delay: i * 0.06, type: 'triangle' }); });
            for (var i = 0; i < 6; i++) tone({ f: 2600 + Math.random() * 1600, dur: 0.12, vol: 0.03, delay: 0.3 + i * 0.05 });
        },
        coin: function () { tone({ f: 1320, dur: 0.08, vol: 0.08 }); tone({ f: 1760, dur: 0.14, vol: 0.08, delay: 0.06 }); },
        grow: function () { tone({ f: 523, f2: 1046, glide: 0.3, dur: 0.4, vol: 0.1, type: 'triangle' }); },
        caw: function () {                               // a crow
            tone({ f: 560, f2: 380, glide: 0.18, dur: 0.22, vol: 0.07, type: 'sawtooth', vib: 38, vibDepth: 70 });
            noise({ f: 1400, q: 1.5, dur: 0.16, vol: 0.05 });
        }
    };

    W.sfx = {
        unlock: function () { if (ensure()) wake(); },
        play: function (name, arg) { if (ctx && SFX[name]) { try { SFX[name](arg); } catch (_) {} } },
        setEnabled: function (on) {
            enabled = !!on;
            if (!ctx) return;
            master.gain.setTargetAtTime(enabled ? 0.8 : 0, ctx.currentTime, 0.05);
            if (enabled) wake(); else if (ctx.state === 'running') ctx.suspend().catch(function () {});   // sound off: the engine sleeps
        },
        enabled: function () { return enabled; },
        setMusic: function (on) { musicOn = !!on; },
        music: function () { return musicOn; },
        suspend: function () { suspended = true; if (ctx && ctx.state === 'running') ctx.suspend().catch(function () {}); },
        resume: function () { suspended = false; wake(); },          // stays asleep while YouTube's sound is off
        voice: voice,
        /* the music box steps aside while the pack howls */
        duck: function (on) { if (musicGain) musicGain.gain.setTargetAtTime(on ? 0 : 0.35, ctx.currentTime, 0.2); },
        /* the fire roars louder when it is bigger */
        fireLevel: function (lv) { if (fireGain) fireGain.gain.setTargetAtTime(0.07 + lv * 0.02, ctx.currentTime, 0.3); }
    };
})();
