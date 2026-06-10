/* ===================================================================
   TypeRush — Yazma Yarışı
   Tek oyunculu vs. botlar. İlk bitişe ulaşan kazanır.
=================================================================== */

/* ---------- METİN HAVUZLARI ---------- */
const TEXTS = {
  quotes: [
    "Başarı küçük çabaların her gün sabırla tekrarlanmasıyla elde edilir ve gerçek fark yetenekte değil yıllarca süren disiplinde gizlidir çünkü en parlak fikirler bile uygulanmadıkça yalnızca birer hayal olarak kalmaya mahkumdur.",
    "Hayal kurmaktan asla vazgeçme çünkü bugün imkansız görünen şey yarın sıradan bir gerçeğe dönüşebilir ve insanlığın bütün büyük buluşları bir zamanlar herkesin imkansız dediği o cesur düşüncelerin peşinden gitmekten doğmuştur.",
    "Gerçek bilgelik ne kadar az şey bildiğini fark ettiğinde başlar ve oradan itibaren her yeni gün öğrenmeye açık kaldığın sürece seni daha bilge bir insana dönüştürür çünkü öğrenmenin sonu yoktur ve merak en değerli pusuladır.",
    "Zaman herkese eşit dağıtılan tek hazinedir ve onu nasıl kullandığın geleceğini belirler bu yüzden bugünün küçük seçimlerini hafife alma çünkü yıllar sonra geriye dönüp baktığında seni bugünkü kararlarının şekillendirdiğini göreceksin.",
    "Düşmeden yürümeyi öğrenen kimse yoktur bu yüzden her hatadan yeni bir ders çıkar ayağa kalk ve devam et çünkü başarısızlık bir son değil yalnızca daha iyi bir denemeye doğru atılmış zorunlu ve değerli bir adımdan ibarettir.",
    "Mutluluk sahip olduğun şeylerin çokluğunda değil onların değerini bilmende saklıdır ve çoğu zaman aradığımız huzur uzak diyarlarda değil tam da görmezden geldiğimiz o sıradan anların içinde bizi sessizce beklemektedir.",
  ],
  tech: [
    "Yapay zeka modelleri büyük veri kümeleri üzerinde eğitilir ve milyonlarca örnekten örüntüleri tahmin etmeyi öğrenir ancak bir modelin gerçekten güçlü olması için yalnızca çok veriye değil aynı zamanda temiz dengeli ve önyargısız verilere de ihtiyacı vardır.",
    "Temiz kod yazmak sadece programın çalışması için değil aylar sonra o koda dönen bir başkasının ya da kendinin onu kolayca okuyup anlayabilmesi için önemlidir çünkü yazılım çoğu zaman bir kez yazılır ama defalarca okunur ve sürekli bakım gerektirir.",
    "İnternet protokolleri sayesinde dünyanın dört bir yanındaki milyonlarca cihaz aynı anda güvenli bir biçimde veri alışverişi yapar ve gönderdiğimiz her mesaj saniyeden kısa sürede sayısız sunucu üzerinden geçerek hedefine ulaşır bu da modern hayatın görünmez bir mucizesidir.",
    "Bir algoritmanın verimliliği genellikle harcadığı zaman ve kullandığı bellek miktarıyla birlikte değerlendirilir çünkü küçük veri kümelerinde fark edilmeyen bir yavaşlık veri büyüdükçe sistemin tamamen kilitlenmesine yol açabilir ve bu yüzden ölçeklenebilirlik en kritik tasarım kararıdır.",
    "Bulut bilişim donanım maliyetlerini azaltarak girişimcilerin küçük bir bütçeyle bile dünya çapında ölçeklenebilir uygulamalar geliştirmesini kolaylaştırır ve ihtiyaç duyulduğunda kaynakları anında artırıp azaltma esnekliği sayesinde işletmeler ani talep dalgalanmalarına rahatça uyum sağlayabilir.",
    "Şifreleme algoritmaları verilerimizi yetkisiz erişime karşı korur ve doğru uygulandığında en güçlü bilgisayarların bile çözmesi yüzyıllar alacak kadar güvenli bir kalkan oluşturur bu yüzden dijital gizliliğimiz büyük ölçüde matematiğin görünmez ama sarsılmaz duvarlarına emanet edilmiştir.",
  ],
  random: [
    "Sabah erken kalkan küçük bir kuş gökyüzünde özgürce süzülürken pencereden içeri taze bir bahar esintisi doluyor ve uyanmaya başlayan şehir yavaş yavaş günün ilk seslerini biriktirirken her şey yeni bir başlangıcın tarifsiz tazeliğiyle parıldıyordu.",
    "Kahve fincanının üzerinde yükselen ince buhar yavaşça dağılırken masanın kenarında duran açık kitabın sayfaları aralık pencereden giren rüzgarla hafifçe titriyor ve odanın içini sıcacık bir huzur kaplarken zaman sanki bir an için nazikçe yavaşlıyordu.",
    "Şehrin sayısız ışığı gece boyunca yorulmadan parlamaya devam ederken ıssız sokaklarda yankılanan adım sesleri gitgide azalıyor ve uzakta bir yerlerde çalan kısık bir müzik bu geç saatin yorgun ama dingin atmosferine eşlik ederek geceyi tamamlıyordu.",
    "Dağların ardından usulca doğan güneş bütün vadiyi yumuşak bir altın renge boyarken ağaçların arasında saklanan kuşlar neşeyle ötmeye başlıyor ve çiy damlalarıyla kaplı yapraklar ilk ışıkla birlikte minik elmaslar gibi parıldayarak yeni günü selamlıyordu.",
    "Deniz kenarındaki küçük balıkçı kasabasında sabahın erken saatlerinde ağlarını toplayan yorgun balıkçıların üzerinde gürültüyle dönen martılar bağrışırken ufukta beliren tekneler dalgaların sakin ritmine uyarak limana doğru ağır ağır yol alıyordu.",
    "Ormanın derinliklerinde yaprakların arasından süzülen güneş ışıkları toprağa benekli desenler çizerken uzaktan gelen bir derenin şırıltısı sessizliği nazikçe bölüyor ve serin havayı dolduran ıslak toprak kokusu insana doğanın hiç bitmeyen huzurunu hatırlatıyordu.",
  ],
};

const BOT_NAMES = ["Şimşek", "Tufan", "Volkan", "Yıldız", "Roket", "Kasırga", "Fırtına", "Yıldırım"];
const BOT_ICONS = ["🤖", "👾", "🐱", "🦊", "🐼", "🦅", "🐺", "🐯"];

/* difficulty → bot ortalama WPM + dağılım */
const DIFFICULTY = {
  easy:   { base: 38, spread: 10, label: "Botlar acemi (~38 WPM). Rahat bir başlangıç." },
  medium: { base: 55, spread: 12, label: "Botlar ortalama hızda yazar (~55 WPM)." },
  hard:   { base: 75, spread: 14, label: "Botlar hızlı (~75 WPM). Parmaklarını hazırla." },
  insane: { base: 95, spread: 16, label: "Botlar canavar (~95 WPM). İyi şanslar!" },
};

/* ---------- DURUM ---------- */
const state = {
  difficulty: "medium",
  botCount: 3,
  textType: "quotes",
  text: "",
  racers: [],          // {id,name,icon,isYou,wpm,progress(0-1),finished,finishTime,rank}
  startTime: 0,
  raceActive: false,
  rafId: null,
  // typing
  typed: "",
  correctChars: 0,
  totalKeystrokes: 0,
  soundOn: true,
};

/* ---------- DOM ---------- */
const $ = (s) => document.querySelector(s);
const screens = {
  menu: $("#menuScreen"),
  race: $("#raceScreen"),
  result: $("#resultScreen"),
};

/* ---------- SES (WebAudio, dosya gerektirmez) ---------- */
let audioCtx = null;
function beep(freq = 440, dur = 0.05, type = "sine", vol = 0.08) {
  if (!state.soundOn) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.value = vol;
    o.connect(g); g.connect(audioCtx.destination);
    o.start();
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + dur);
    o.stop(audioCtx.currentTime + dur);
  } catch (e) {}
}

/* ---------- EKRAN GEÇİŞİ ---------- */
function showScreen(name) {
  Object.values(screens).forEach((s) => s.classList.remove("active"));
  screens[name].classList.add("active");
}

/* ---------- MENÜ: SEGMENT BUTONLARI ---------- */
function bindSegment(id, onChange) {
  const seg = $(id);
  seg.addEventListener("click", (e) => {
    const btn = e.target.closest(".seg-btn");
    if (!btn) return;
    seg.querySelectorAll(".seg-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    beep(520, 0.04, "square", 0.05);
    onChange(btn.dataset.val);
  });
}
bindSegment("#difficultySeg", (v) => {
  state.difficulty = v;
  $("#difficultyHint").textContent = DIFFICULTY[v].label;
});
bindSegment("#botSeg", (v) => (state.botCount = parseInt(v, 10)));
bindSegment("#textSeg", (v) => (state.textType = v));

/* ===================================================================
   OYUNCU PROFİLİ & İLERLEME (localStorage)
=================================================================== */
const RINGS = ["#6c5ce7", "#00d2ff", "#2ecc71", "#ff5470", "#ffb443", "#ffd24a"];

// Ücretsiz + kilitli avatarlar (kilitliler coin ile açılır)
const AVATAR_CATALOG = [
  { e: "🚀", cost: 0 }, { e: "🏎️", cost: 0 }, { e: "⚡", cost: 0 }, { e: "🔥", cost: 0 },
  { e: "🐱", cost: 0 }, { e: "🐶", cost: 0 }, { e: "🦊", cost: 0 }, { e: "🐼", cost: 0 },
  { e: "🦄", cost: 50 }, { e: "🐉", cost: 80 }, { e: "👽", cost: 60 }, { e: "🤖", cost: 60 },
  { e: "👑", cost: 120 }, { e: "💎", cost: 150 }, { e: "🦅", cost: 100 }, { e: "🐺", cost: 100 },
  { e: "🦁", cost: 130 }, { e: "🐯", cost: 130 }, { e: "🎮", cost: 90 }, { e: "🌟", cost: 90 },
  { e: "💀", cost: 110 }, { e: "🧠", cost: 140 }, { e: "🦖", cost: 160 }, { e: "🏆", cost: 200 },
];

const DEFAULT_PROFILE = {
  name: "", avatar: "🚀", ring: "#6c5ce7",
  xp: 0, coins: 0, level: 1,
  streak: 0, lastPlayed: "", winStreak: 0,
  bestWpm: 0, games: 0, wins: 0,
  unlocked: ["🚀","🏎️","⚡","🔥","🐱","🐶","🦊","🐼"],
  achievements: [],
};

let profile = loadProfile();

function loadProfile() {
  try {
    const raw = localStorage.getItem("typerush_profile");
    if (raw) return Object.assign({}, DEFAULT_PROFILE, JSON.parse(raw));
  } catch (e) {}
  return JSON.parse(JSON.stringify(DEFAULT_PROFILE));
}
function saveProfile() {
  localStorage.setItem("typerush_profile", JSON.stringify(profile));
}

/* seviye eğrisi: n. seviye için gereken toplam XP */
function xpForLevel(n) { return Math.round(60 * n * (n + 1) / 2); } // birikimli
function levelFromXp(xp) {
  let lvl = 1;
  while (xp >= xpForLevel(lvl)) lvl++;
  return lvl;
}

/* günlük seri kontrolü */
function updateDailyStreak() {
  const today = new Date().toDateString();
  if (profile.lastPlayed === today) return;
  const yesterday = new Date(Date.now() - 864e5).toDateString();
  if (profile.lastPlayed === yesterday) profile.streak += 1;
  else profile.streak = 1;
  profile.lastPlayed = today;
  saveProfile();
}

/* tüm profil arayüzünü tazele */
function renderProfile() {
  const lvl = levelFromXp(profile.xp);
  profile.level = lvl;
  const prevReq = lvl === 1 ? 0 : xpForLevel(lvl - 1);
  const nextReq = xpForLevel(lvl);
  const pct = Math.round(((profile.xp - prevReq) / (nextReq - prevReq)) * 100);

  $("#lvlNum").textContent = lvl;
  $("#xpFill").style.width = Math.max(2, Math.min(100, pct)) + "%";
  $("#coinNum").textContent = profile.coins;
  $("#streakNum").textContent = profile.streak;

  $("#profileAvatar").textContent = profile.avatar;
  $("#profileAvatar").style.borderColor = profile.ring;
  if (document.activeElement !== $("#profileName")) $("#profileName").value = profile.name;
  $("#pGames").textContent = profile.games;
  $("#pWins").textContent = profile.wins;
  $("#pBest").textContent = profile.bestWpm;
}

/* ---------- BAŞARIMLAR ---------- */
const ACHIEVEMENTS = [
  { id: "first_race", ico: "🏁", title: "İlk Yarış", desc: "İlk yarışını tamamla", check: (p) => p.games >= 1 },
  { id: "first_win",  ico: "🥇", title: "İlk Zafer", desc: "İlk yarışını kazan", check: (p) => p.wins >= 1 },
  { id: "wpm60",      ico: "⚡", title: "Hızlı Parmaklar", desc: "60 WPM'i geç", check: (p) => p.bestWpm >= 60 },
  { id: "wpm100",     ico: "🚀", title: "Şimşek", desc: "100 WPM'i geç", check: (p) => p.bestWpm >= 100 },
  { id: "win3",       ico: "🔥", title: "Galibiyet Serisi", desc: "Üst üste 3 kez kazan", check: (p) => p.winStreak >= 3 },
  { id: "streak3",    ico: "📅", title: "Sadık Oyuncu", desc: "3 gün üst üste oyna", check: (p) => p.streak >= 3 },
  { id: "games10",    ico: "🎮", title: "Tecrübeli", desc: "10 yarış tamamla", check: (p) => p.games >= 10 },
  { id: "rich",       ico: "💰", title: "Zengin", desc: "200 coin biriktir", check: (p) => p.coins >= 200 },
];

function checkAchievements() {
  ACHIEVEMENTS.forEach((a) => {
    if (!profile.achievements.includes(a.id) && a.check(profile)) {
      profile.achievements.push(a.id);
      showToast(a.ico, "Başarım Açıldı!", a.title);
    }
  });
  saveProfile();
}

function showToast(ico, title, sub) {
  const t = document.createElement("div");
  t.className = "toast";
  t.innerHTML = `<span class="t-ico">${ico}</span><div><div class="t-title">${title}</div><div class="t-sub">${sub}</div></div>`;
  $("#toastWrap").appendChild(t);
  beep(880, 0.12, "sine", 0.08);
  setTimeout(() => t.remove(), 4000);
}

/* ---------- SES TOGGLE ---------- */
$("#soundToggle").addEventListener("click", () => {
  state.soundOn = !state.soundOn;
  $("#soundToggle").textContent = state.soundOn ? "🔊" : "🔇";
  if (state.soundOn) beep(660, 0.06);
});

/* ===================================================================
   YARIŞ KURULUMU
=================================================================== */
function setupRace() {
  const pool = TEXTS[state.textType];
  state.text = pool[Math.floor(Math.random() * pool.length)];

  // racers
  state.racers = [];
  state.racers.push({
    id: "you", name: profile.name || "Sen", icon: profile.avatar || "🚀", isYou: true,
    wpm: 0, progress: 0, finished: false, finishTime: 0, rank: 0,
  });

  // botlara benzersiz isim/ikon ve hedef WPM ata
  const d = DIFFICULTY[state.difficulty];
  const names = [...BOT_NAMES].sort(() => Math.random() - 0.5);
  const icons = [...BOT_ICONS].sort(() => Math.random() - 0.5);
  for (let i = 0; i < state.botCount; i++) {
    const targetWpm = Math.max(15, d.base + (Math.random() * 2 - 1) * d.spread);
    state.racers.push({
      id: "bot" + i, name: names[i], icon: icons[i], isYou: false,
      wpm: 0, targetWpm, progress: 0, finished: false, finishTime: 0, rank: 0,
      // bot "ritmi" için anlık dalgalanma
      momentum: targetWpm,
    });
  }

  // reset typing state
  state.typed = "";
  state.correctChars = 0;
  state.totalKeystrokes = 0;
  $("#hiddenInput").value = "";   // önceki yarıştan kalan metni temizle

  buildTrack();
  buildTextDisplay();
  updateStats();
}

/* ---------- PİST ÇİZİMİ ---------- */
function buildTrack() {
  const track = $("#track");
  track.innerHTML = "";
  state.racers.forEach((r) => {
    const lane = document.createElement("div");
    lane.className = "lane";
    lane.innerHTML = `
      <span class="lane-name ${r.isYou ? "you" : ""}">${r.isYou ? "SEN" : r.name}</span>
      <div class="lane-track-line"></div>
      <span class="racer ${r.isYou ? "you" : ""}" data-id="${r.id}">${r.icon}</span>
      <span class="finish-flag">🏁</span>
    `;
    track.appendChild(lane);
  });
  positionRacers();
}

function positionRacers() {
  state.racers.forEach((r) => {
    const el = document.querySelector(`.racer[data-id="${r.id}"]`);
    if (!el) return;
    const lane = el.closest(".lane");
    const line = lane.querySelector(".lane-track-line");
    const start = line.offsetLeft;
    const span = line.offsetWidth - 10;
    el.style.left = start + r.progress * span + "px";
  });
}

/* ---------- METİN GÖSTERİMİ ---------- */
function buildTextDisplay() {
  const disp = $("#textDisplay");
  disp.innerHTML = "";
  [...state.text].forEach((ch, i) => {
    const span = document.createElement("span");
    span.className = "char";
    span.textContent = ch;
    span.dataset.i = i;
    disp.appendChild(span);
  });
}

function renderTyping() {
  const chars = $("#textDisplay").querySelectorAll(".char");
  const typed = state.typed;
  chars.forEach((c, i) => {
    c.classList.remove("correct", "wrong", "current");
    if (i < typed.length) {
      c.classList.add(typed[i] === state.text[i] ? "correct" : "wrong");
    } else if (i === typed.length) {
      c.classList.add("current");
    }
  });
}

/* ===================================================================
   GERİ SAYIM & BAŞLATMA
=================================================================== */
function startCountdown() {
  const overlay = $("#countdown");
  const num = $("#countNum");
  overlay.classList.add("show");
  let n = 3;
  num.textContent = n;
  beep(440, 0.12);
  const iv = setInterval(() => {
    n--;
    if (n > 0) {
      num.textContent = n;
      num.style.animation = "none";
      void num.offsetWidth;
      num.style.animation = "pop .6s ease";
      beep(440, 0.12);
    } else {
      num.textContent = "BAŞLA!";
      num.style.animation = "none";
      void num.offsetWidth;
      num.style.animation = "pop .6s ease";
      beep(880, 0.2, "sawtooth", 0.12);
      setTimeout(() => {
        overlay.classList.remove("show");
        beginRace();
      }, 600);
      clearInterval(iv);
    }
  }, 1000);
}

function beginRace() {
  state.raceActive = true;
  state.startTime = performance.now();
  $("#textDisplay").classList.add("live");
  $("#typeHint").textContent = "Yaz! İlk bitişe ulaşan kazanır 🏁";
  $("#hiddenInput").focus();
  renderTyping();
  loop();
}

/* ===================================================================
   ANA DÖNGÜ — botları ilerlet, statları güncelle
=================================================================== */
function loop() {
  if (!state.raceActive) return;
  const now = performance.now();
  const elapsedMin = (now - state.startTime) / 60000;
  const totalChars = state.text.length;

  // --- BOT İLERLEMESİ ---
  state.racers.forEach((r) => {
    if (r.isYou || r.finished) return;
    // momentum'a hafif rastgele dalgalanma (insansı ritim)
    r.momentum += (r.targetWpm - r.momentum) * 0.05 + (Math.random() * 2 - 1) * 1.5;
    r.momentum = Math.max(10, r.momentum);
    // WPM = (karakter/5) / dakika  →  karakter = wpm*5*dakika
    const charsTyped = r.momentum * 5 * elapsedMin;
    r.progress = Math.min(1, charsTyped / totalChars);
    r.wpm = Math.round(r.momentum);
    if (r.progress >= 1 && !r.finished) finishRacer(r, now);
  });

  // --- SENİN STATLARIN ---
  const you = state.racers.find((r) => r.isYou);
  if (!you.finished) {
    you.progress = Math.min(1, state.correctChars / totalChars);
    const grossWpm = elapsedMin > 0 ? (state.typed.length / 5) / elapsedMin : 0;
    you.wpm = Math.round(Math.max(0, grossWpm));
  }

  updateStats();
  positionRacers();

  // Sen bitirmediysen ama tüm rakipler bitirdiyse yarış otomatik biter (sonuncu sen).
  if (!you.finished) {
    const allBotsDone = state.racers.every((r) => r.isYou || r.finished);
    if (allBotsDone) {
      finishRacer(you, now);   // seni son sıraya yerleştirir ve endRace çağırır
      return;
    }
  }

  state.rafId = requestAnimationFrame(loop);
}

function updateStats() {
  const you = state.racers.find((r) => r.isYou);
  const elapsed = state.raceActive ? (performance.now() - state.startTime) / 1000 : 0;
  const acc = state.totalKeystrokes > 0
    ? Math.round((state.correctChars / state.totalKeystrokes) * 100)
    : 100;

  $("#statWpm").textContent = you.wpm;
  $("#statAcc").innerHTML = acc + "<small>%</small>";
  $("#statTime").innerHTML = elapsed.toFixed(1) + "<small>s</small>";

  // sıralama (ilerlemeye göre)
  const sorted = [...state.racers].sort((a, b) => {
    if (a.finished && b.finished) return a.finishTime - b.finishTime;
    if (a.finished) return -1;
    if (b.finished) return 1;
    return b.progress - a.progress;
  });
  const pos = sorted.findIndex((r) => r.isYou) + 1;
  $("#statPos").textContent = pos + ".";
}

/* ---------- BİR YARIŞMACI BİTİRDİ ---------- */
function finishRacer(r, now) {
  r.finished = true;
  r.progress = 1;
  r.finishTime = now - state.startTime;
  const finishedCount = state.racers.filter((x) => x.finished).length;
  r.rank = finishedCount;
  if (r.isYou) {
    beep(880, 0.25, "sawtooth", 0.12);
    endRace();
  }
}

/* ===================================================================
   KLAVYE GİRİŞİ
=================================================================== */
const hidden = $("#hiddenInput");

// pist ekranına tıklayınca input'a odaklan
$("#raceScreen").addEventListener("click", () => {
  if (state.raceActive) hidden.focus();
});

// yarış sırasında odak kaybolursa "dokun" uyarısı göster
hidden.addEventListener("blur", () => {
  if (state.raceActive) $("#refocusOverlay").classList.add("show");
});
hidden.addEventListener("focus", () => {
  $("#refocusOverlay").classList.remove("show");
});
$("#refocusOverlay").addEventListener("click", () => hidden.focus());

hidden.addEventListener("input", (e) => {
  if (!state.raceActive) { hidden.value = ""; return; }
  const val = hidden.value;
  const you = state.racers.find((r) => r.isYou);
  if (you.finished) return;

  // yeni karakter mi eklendi?
  if (val.length > state.typed.length) {
    const idx = val.length - 1;
    const expected = state.text[idx];
    const got = val[idx];
    state.totalKeystrokes++;
    if (got === expected) {
      state.correctChars++;
      beep(600 + Math.random() * 80, 0.025, "sine", 0.04);
    } else {
      beep(180, 0.06, "square", 0.06);
    }
  }

  // metni aşma
  state.typed = val.slice(0, state.text.length);
  if (val.length > state.text.length) hidden.value = state.typed;

  renderTyping();

  // bitti mi? (tam ve doğru yazıldıysa)
  if (state.typed.length === state.text.length) {
    // doğru karakter sayısını yeniden hesapla
    let correct = 0;
    for (let i = 0; i < state.text.length; i++) {
      if (state.typed[i] === state.text[i]) correct++;
    }
    state.correctChars = correct;
    you.progress = correct / state.text.length;
    // tüm karakterler doğruysa bitir
    if (correct === state.text.length) {
      finishRacer(you, performance.now());
    }
  }
});

/* ===================================================================
   YARIŞ SONU
=================================================================== */
function endRace() {
  state.raceActive = false;
  cancelAnimationFrame(state.rafId);

  // botları bitiş zamanına göre tahminle (bitmemiş olanlara süre ekle)
  const elapsed = performance.now() - state.startTime;
  state.racers.forEach((r) => {
    if (!r.finished) {
      // kalan mesafeye göre tahmini bitiş
      const remaining = (1 - r.progress);
      const est = r.isYou ? elapsed : elapsed + remaining * (state.text.length / (r.momentum * 5 / 60000));
      r.finishTime = est;
    }
  });

  // final sıralama
  const ranked = [...state.racers].sort((a, b) => a.finishTime - b.finishTime);
  ranked.forEach((r, i) => (r.rank = i + 1));

  const you = state.racers.find((r) => r.isYou);
  const won = you.rank === 1;

  setTimeout(() => showResult(you, ranked, won), 500);
}

function quitRace() {
  state.raceActive = false;
  cancelAnimationFrame(state.rafId);
  $("#textDisplay").classList.remove("live");
  $("#refocusOverlay").classList.remove("show");
  showScreen("menu");
}

/* ---------- SONUÇ EKRANI ---------- */
function showResult(you, ranked, won) {
  $("#textDisplay").classList.remove("live");
  $("#refocusOverlay").classList.remove("show");
  showScreen("result");

  const acc = state.totalKeystrokes > 0
    ? Math.round((state.correctChars / state.totalKeystrokes) * 100)
    : 100;
  const timeSec = (you.finishTime / 1000).toFixed(1);

  // badge & başlık
  const badges = ["🏆", "🥈", "🥉", "🎖️", "🎖️"];
  $("#resultBadge").textContent = won ? "🏆" : badges[you.rank - 1] || "🎖️";
  $("#resultTitle").textContent = won ? "Kazandın! 🎉" : `${you.rank}. Oldun`;
  $("#resultSub").textContent = won
    ? "Klavyenin hakimi sensin. Botlar tozunu yuttu!"
    : "Fena değil! Tekrar dene ve birinciliği kap.";

  $("#rWpm").textContent = you.wpm;
  $("#rAcc").textContent = acc + "%";
  $("#rTime").textContent = timeSec + "s";

  /* ---- ÖDÜLLER & PROFİL GÜNCELLEME ---- */
  // XP: hız + isabet + galibiyet bonusu, zorluk çarpanıyla
  const diffMult = { easy: 1, medium: 1.3, hard: 1.7, insane: 2.2 }[state.difficulty];
  let xpGain = Math.round((you.wpm * (acc / 100) + (won ? 40 : 0)) * diffMult);
  let coinGain = Math.round((you.wpm / 4 + (won ? 20 : 5)) * diffMult);

  // galibiyet serisi bonusu
  if (won) {
    profile.winStreak += 1;
    if (profile.winStreak >= 2) {
      const bonus = profile.winStreak * 5;
      coinGain += bonus;
      xpGain += bonus;
    }
  } else {
    profile.winStreak = 0;
  }

  const prevLevel = levelFromXp(profile.xp);
  const prevBest = profile.bestWpm;
  profile.xp += xpGain;
  profile.coins += coinGain;
  profile.games += 1;
  if (won) profile.wins += 1;
  if (you.wpm > profile.bestWpm) profile.bestWpm = you.wpm;
  const newLevel = levelFromXp(profile.xp);

  saveProfile();
  renderProfile();
  checkAchievements();

  if (you.wpm > prevBest && you.wpm > 0) $("#resultSub").textContent += " 🔥 Yeni rekor!";
  if (newLevel > prevLevel) {
    setTimeout(() => showToast("🆙", "Seviye Atladın!", `Seviye ${newLevel}`), 600);
  }

  // ödül çipleri
  $("#rewardRow").innerHTML = `
    <div class="reward-chip xp">+${xpGain} XP</div>
    <div class="reward-chip coin">+${coinGain} 🪙</div>
    ${won && profile.winStreak >= 2 ? `<div class="reward-chip">🔥 ${profile.winStreak}'li seri</div>` : ""}
  `;

  // leaderboard
  const lb = $("#leaderboard");
  lb.innerHTML = "";
  ranked.forEach((r) => {
    const row = document.createElement("div");
    row.className = "lb-row" + (r.isYou ? " you" : "");
    row.innerHTML = `
      <span class="lb-rank">${r.rank}.</span>
      <span class="lb-icon">${r.icon}</span>
      <span class="lb-name">${r.isYou ? "Sen" : r.name}</span>
      <span class="lb-wpm"><strong>${r.wpm}</strong> WPM · ${(r.finishTime / 1000).toFixed(1)}s</span>
    `;
    lb.appendChild(row);
  });

  beep(won ? 880 : 330, 0.3, won ? "sawtooth" : "sine", 0.1);
  if (won) setTimeout(() => beep(1100, 0.3, "sawtooth", 0.1), 150);
}

/* ===================================================================
   BUTON BAĞLANTILARI
=================================================================== */
$("#startBtn").addEventListener("click", () => {
  beep(660, 0.08);
  setupRace();
  showScreen("race");
  // layout otursun diye küçük gecikme
  setTimeout(() => { positionRacers(); startCountdown(); }, 100);
});

$("#quitBtn").addEventListener("click", quitRace);
$("#rematchBtn").addEventListener("click", () => {
  beep(660, 0.08);
  setupRace();
  showScreen("race");
  setTimeout(() => { positionRacers(); startCountdown(); }, 100);
});
$("#menuBtn").addEventListener("click", () => showScreen("menu"));

// pencere yeniden boyutlanınca yarışçıları yeniden konumla
window.addEventListener("resize", () => { if (screens.race.classList.contains("active")) positionRacers(); });

/* ===================================================================
   PROFİL ADI & AVATAR MODALI
=================================================================== */
$("#profileName").addEventListener("input", (e) => {
  profile.name = e.target.value.trim().slice(0, 14);
  saveProfile();
});

const avatarModal = $("#avatarModal");
let pendingAvatar = profile.avatar;
let pendingRing = profile.ring;

function openAvatarModal() {
  pendingAvatar = profile.avatar;
  pendingRing = profile.ring;
  buildRingRow();
  buildAvatarGrid();
  updateAvatarPreview();
  avatarModal.classList.add("show");
  beep(620, 0.06);
}
function closeAvatarModal() {
  // seçilenleri uygula
  profile.avatar = pendingAvatar;
  profile.ring = pendingRing;
  saveProfile();
  renderProfile();
  avatarModal.classList.remove("show");
}

function updateAvatarPreview() {
  const p = $("#avatarPreview");
  p.textContent = pendingAvatar;
  p.style.borderColor = pendingRing;
}

function buildRingRow() {
  const row = $("#ringRow");
  row.innerHTML = "";
  RINGS.forEach((c) => {
    const d = document.createElement("div");
    d.className = "ring-dot" + (c === pendingRing ? " active" : "");
    d.style.background = c;
    d.addEventListener("click", () => {
      pendingRing = c;
      buildRingRow();
      updateAvatarPreview();
      beep(520, 0.04, "square", 0.05);
    });
    row.appendChild(d);
  });
}

function buildAvatarGrid() {
  const grid = $("#avatarGrid");
  grid.innerHTML = "";
  AVATAR_CATALOG.forEach((item) => {
    const owned = profile.unlocked.includes(item.e);
    const cell = document.createElement("div");
    cell.className = "avatar-cell"
      + (item.e === pendingAvatar ? " selected" : "")
      + (owned ? "" : " locked");
    cell.innerHTML = item.e
      + (owned ? "" : `<span class="lock-ico">🔒</span><span class="lock-cost">${item.cost}</span>`);
    cell.addEventListener("click", () => {
      if (owned) {
        pendingAvatar = item.e;
        buildAvatarGrid();
        updateAvatarPreview();
        beep(660, 0.05);
      } else {
        // satın al
        if (profile.coins >= item.cost) {
          profile.coins -= item.cost;
          profile.unlocked.push(item.e);
          pendingAvatar = item.e;
          saveProfile();
          renderProfile();
          buildAvatarGrid();
          updateAvatarPreview();
          showToast("🎉", "Avatar Açıldı!", item.e + " senin oldu");
        } else {
          showToast("🪙", "Yetersiz Coin", `${item.cost - profile.coins} coin daha gerekli`);
          beep(180, 0.08, "square", 0.06);
        }
      }
    });
    grid.appendChild(cell);
  });
}

$("#openAvatarBtn").addEventListener("click", openAvatarModal);
$("#closeAvatarBtn").addEventListener("click", closeAvatarModal);
avatarModal.addEventListener("click", (e) => { if (e.target === avatarModal) closeAvatarModal(); });

/* ---------- BAŞARIMLAR MODALI ---------- */
const achModal = $("#achModal");
function openAchModal() {
  const list = $("#achList");
  list.innerHTML = "";
  ACHIEVEMENTS.forEach((a) => {
    const owned = profile.achievements.includes(a.id);
    const item = document.createElement("div");
    item.className = "ach-item" + (owned ? "" : " locked");
    item.innerHTML = `
      <span class="a-ico">${a.ico}</span>
      <div><div class="a-title">${a.title}</div><div class="a-desc">${a.desc}</div></div>
      <span class="a-state">${owned ? "✅" : "🔒"}</span>
    `;
    list.appendChild(item);
  });
  $("#achCount").textContent = `${profile.achievements.length}/${ACHIEVEMENTS.length}`;
  achModal.classList.add("show");
  beep(620, 0.06);
}
$("#openAchBtn").addEventListener("click", openAchModal);
$("#closeAchBtn").addEventListener("click", () => achModal.classList.remove("show"));
achModal.addEventListener("click", (e) => { if (e.target === achModal) achModal.classList.remove("show"); });

/* ---------- BAŞLAT ---------- */
updateDailyStreak();
renderProfile();
checkAchievements();

/* ---------- PWA: SERVICE WORKER KAYDI ----------
   Yalnızca http/https üzerinden çalışır (file:// üzerinde atlanır). */
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js").catch(() => {});
  });
}
