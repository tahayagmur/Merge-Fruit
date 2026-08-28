/* =========================================================================
 * audio.js  —  WebAudio ile prosedürel ASMR ses (ikili dosya yok).
 *   Dökme sesi (renge göre perde), "pop", tamamlama çanı, ambiyans müzik.
 * ========================================================================= */
window.CF = window.CF || {};

CF.audio = (function () {
  "use strict";
  let ctx = null;
  let master = null;
  let musicGain = null;
  let sfxGain = null;
  let musicNodes = [];
  let musicOn = true;
  let soundOn = true;

  function ensure() {
    if (ctx) return;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
      musicGain = ctx.createGain(); musicGain.gain.value = 0.18; musicGain.connect(master);
      sfxGain = ctx.createGain(); sfxGain.gain.value = 0.9; sfxGain.connect(master);
    } catch (e) { ctx = null; }
  }

  // Tarayıcı otomatik-durdurmasını kullanıcı etkileşiminde çöz.
  function resume() { ensure(); if (ctx && ctx.state === "suspended") ctx.resume(); }

  function tone(freq, dur, type, gain, when) {
    if (!ctx || !soundOn) return;
    const t0 = (when || ctx.currentTime);
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type || "sine";
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain || 0.25, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(sfxGain);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }

  /* Dökme sesi — renge göre perde değişir + hafif "su" gürültüsü. */
  function pour(colorId, count) {
    ensure(); if (!ctx || !soundOn) return;
    const base = 220 + (colorId % 12) * 28;
    const t0 = ctx.currentTime;
    // akışkan gliss
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(base, t0);
    o.frequency.linearRampToValueAtTime(base * 1.5, t0 + 0.18 + count * 0.04);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.16, t0 + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.22 + count * 0.05);
    o.connect(g); g.connect(sfxGain);
    o.start(t0); o.stop(t0 + 0.4 + count * 0.05);
    // hafif gürültü katmanı
    noiseBurst(0.12, 0.05);
  }

  function noiseBurst(dur, gain) {
    if (!ctx || !soundOn) return;
    const n = ctx.createBufferSource();
    const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    n.buffer = buf;
    const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 900;
    const g = ctx.createGain(); g.gain.value = gain || 0.06;
    n.connect(bp); bp.connect(g); g.connect(sfxGain);
    n.start();
  }

  function pop() { tone(520, 0.08, "triangle", 0.2); }
  function tubeComplete() { // bir tüp bitince kısa yükselen üçlü
    ensure(); if (!ctx) return;
    const t = ctx.currentTime;
    [523, 659, 784].forEach((f, i) => tone(f, 0.18, "sine", 0.22, t + i * 0.06));
  }
  function win() { // zafer çanı arpeji
    ensure(); if (!ctx) return;
    const t = ctx.currentTime;
    [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.4, "sine", 0.28, t + i * 0.09));
  }
  function coin() { tone(880, 0.09, "square", 0.15); tone(1320, 0.09, "square", 0.12, (ctx ? ctx.currentTime + 0.05 : 0)); }
  function error() { tone(160, 0.15, "sawtooth", 0.18); }
  function click() { tone(660, 0.05, "triangle", 0.12); }

  /* Lo-fi ambiyans müzik — yumuşak akor döngüsü. */
  function startMusic() {
    ensure(); if (!ctx || !musicOn) return;
    stopMusic();
    const chords = [[220, 277, 330], [196, 247, 294], [174, 220, 261], [233, 293, 349]];
    let i = 0;
    const playChord = () => {
      if (!ctx || !musicOn) return;
      const t = ctx.currentTime;
      chords[i % chords.length].forEach((f) => {
        const o = ctx.createOscillator(); const g = ctx.createGain();
        o.type = "sine"; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.09, t + 0.6);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 3.4);
        o.connect(g); g.connect(musicGain);
        o.start(t); o.stop(t + 3.6);
        musicNodes.push(o);
      });
      i++;
    };
    playChord();
    const id = setInterval(playChord, 3200);
    musicNodes.push({ stop: () => clearInterval(id), _timer: true });
  }
  function stopMusic() {
    musicNodes.forEach((n) => { try { n.stop && n.stop(); } catch (e) {} });
    musicNodes = [];
  }

  function setSound(on) { soundOn = on; }
  function setMusic(on) { musicOn = on; if (on) startMusic(); else stopMusic(); }

  return {
    resume, pour, pop, tubeComplete, win, coin, error, click,
    startMusic, stopMusic, setSound, setMusic,
    get soundOn() { return soundOn; }, get musicOn() { return musicOn; },
  };
})();
