/* =========================================================================
 * main.js  —  Önyükleme. Modüller yüklendikten sonra oyunu başlatır.
 * ========================================================================= */
(function () {
  "use strict";
  function boot() {
    // ayarları sese uygula
    const s = CF.save.get().settings;
    CF.audio.setSound(s.sound);
    CF.audio.setMusic(false); // müzik ilk kullanıcı etkileşiminde başlar

    // ilk kullanıcı dokunuşunda WebAudio'yu çöz + müziği başlat
    const kick = () => {
      CF.audio.resume();
      if (CF.save.get().settings.music) CF.audio.startMusic();
      window.removeEventListener("pointerdown", kick);
      window.removeEventListener("keydown", kick);
    };
    window.addEventListener("pointerdown", kick);
    window.addEventListener("keydown", kick);

    CF.ui.init();

    // Native (Capacitor) ortamda gerçek AdMob'u bağla (web'de no-op)
    if (CF.native && CF.native.init) CF.native.init();

    // başarım kontrolü (ör. mevcut coin ile "zengin")
    CF.achievements.check();

    // ilk çalıştırma günlük ödül hatırlatması
    if (CF.save.get().firstRun) {
      CF.save.get().firstRun = false; CF.save.persist();
      setTimeout(() => CF.ui.toast("Welcome! Don't forget your daily reward 🎁"), 1200);
    }
    CF.analytics.track("app_open", { source: "organic" });
    CF.analytics.track("session_start", {});
    window.addEventListener("beforeunload", () => CF.analytics.track("session_end", {}));
  }

  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
