/* ============================================================================
 *  OmniMerge: Infinite AI Craft
 *  YouTube Playables · Phaser 3 · AI destekli sonsuz birleştirme
 * ----------------------------------------------------------------------------
 *  MİMARİ HARİTASI
 *    [1] CONFIG        — sabitler, palet, layout, tuning
 *    [2] YT            — YouTube Playables SDK adaptörü (dev fallback'li)
 *    [3] GameState     — tek kaynaklı oyun durumu + event bus
 *    [4] SaveManager   — loadData/saveData + debounce + sendScore throttle
 *    [5] Alchemy       — yerel tarif tablosu + deterministik çevrimdışı üretici
 *    [6] AI            — TamgaStudio /chat/completions istemcisi (cache'li)
 *    [7] Widgets       — ElementCard, LoadingOrb, Toast, Modal
 *    [8] BootScene     — doku üretimi, kayıt yükleme, firstFrameReady()
 *    [9] GameScene     — tahta, sürükle-bırak, overlap → birleştirme
 *   [10] UIScene       — HUD, kütüphane çekmecesi, modallar, reklam akışları
 *   [11] Bootstrap     — Phaser config + global hata yakalama
 * ==========================================================================*/

'use strict';

/* ============================================================================
 * [1] CONFIG
 * ==========================================================================*/

/** Tasarım çözünürlüğü (dikey). Phaser.Scale.FIT ile her ekrana ölçeklenir. */
/* Tasarım genişliği SABİT (720); yükseklik EKRANIN ORANINA GÖRE hesaplanır.
 * Sabit 720x1280 tasarım + Scale.FIT, 20:9 bir telefonda üstte ve altta siyah
 * bant bırakıyordu — hem çirkin hem de oyun alanından çalıyordu.
 * Yüksekliği ekranın oranıyla eşitleyince FIT tam ekranı doldurur (bant sıfır)
 * ve kazanılan piksellerin TAMAMI tahtaya gider.
 * Ölçüm (375x812 ekran): tahta 730 px → 989 px, %35 daha geniş oyun alanı. */
const DESIGN = { W: 720, H: 1280 };

/* ============================================================================
 * PALET — neden bu renkler?
 * ----------------------------------------------------------------------------
 *  Önceki palet "gri" okunuyordu çünkü DOYGUNLUK çok düşüktü:
 *    eski bg0 #070a16 → HSL(226°, 39%, 6%)   · neredeyse nötr siyah
 *    yeni bg0 #0b1038 → HSL(233°, 68%, 13%)  · gerçek renk taşıyan derin lacivert
 *
 *  Seçimin dayanağı renk psikolojisi değil, PRİMAT GÖRME EVRİMİ:
 *  insan üç renkli görüşü, yeşil yaprak arasındaki olgun meyveyi ayırt etmek
 *  üzere şekillendi — yani görsel sistemimiz SOĞUK/DOYGUN bir zemin üzerindeki
 *  SICAK/DOYGUN uyaranı en hızlı yakalar. Bu yüzden:
 *    · zemin  → derin, doygun, SOĞUK (menekşe-indigo-lacivert)
 *    · ödül   → SICAK (altın → turuncu), en nadir kademede en sıcak
 *  Nadirlik ekseni bilinçli olarak soğuktan sıcağa tırmanır; değerli olan
 *  şey aynı zamanda görsel olarak "olgun" görünür.
 * ==========================================================================*/
const PALETTE = {
  bg0:     0x0b1038,   // derin lacivert (zemin dibi)
  bg1:     0x2b2a8f,   // indigo
  bg2:     0x3a1f7a,   // derin menekşe (zemin tepesi)
  /* DEĞER HİYERARŞİSİ (kontrast için kritik)
   *   zemin  L≈30%  → parlak, renkli, dikkat çekmeyen
   *   tahta  L≈16%  → zeminden koyu, oyun alanını çerçeveler
   *   kart   L≈20%  → derin gövde; ÖNE ÇIKAN şey emoji + nadirlik kenarı
   * İlk denemede kart (#2c3a86, L34%) zemin ortasıyla (#2b2a8f, L36%) neredeyse
   * aynı değerdeydi ve kartlar zemine gömülüyordu. */
  panel:   0x141b46,
  card:    0x1e2a6b,
  cardHi:  0x3d4fbe,
  stroke:  0x4a5cd0,
  accent:  0x2ee0ff,   // camgöbeği
  accent2: 0xb866ff,   // menekşe
  accent3: 0xff4fd8,   // macenta
  ember:   0xffa63d,   // sıcak kehribar — kompozisyonun sıcak noktası
  text:    0xf0f4ff,
  dim:     0x9aa8e6,
  good:    0x2dffa6,
  warn:    0xffc43a,
  bad:     0xff5570,
};

/** Kütüphane çekmecesindeki sütun sayısı. */
const LIB_COLS = 5;

const LAYOUT = {
  hudH:       150,          // üst HUD yüksekliği (sabit)
  boardTop:   150,
  boardBottom: 880,         // hesaplanır (bkz. olculeriHesapla)
  drawerTop:  880,          // hesaplanır
  drawerH:    420,          // hesaplanır (bkz. olculeriHesapla)
  cardW:      130,
  cardH:      130,
  slotW:      120,          // çekmecedeki küçük kart genişliği
  slotH:      118,
};

/* Ekran oranına göre tasarım yüksekliğini ve tahta sınırlarını kurar.
 * Phaser başlatılmadan ÖNCE bir kez çağrılır. */
function olculeriHesapla() {
  const w = window.innerWidth || 720;
  const h = window.innerHeight || 1280;
  const oran = h / w;
  // Aşırı uçlarda (tablet, TV yatay) makul sınırlar içinde kal
  DESIGN.H = Math.round(Math.min(1900, Math.max(1040, DESIGN.W * oran)));

  /* Çekmece yüksekliği ORANSAL.
   * Sabit 420 px, uzun telefonda ekranın %26'sıydı ama kısa/geniş ekranda
   * (tablet, PC penceresi, TV) %40'ına çıkıp oyun alanını eziyordu.
   * Artık ekranın dörtte biri — tabanı 300 (en az 2 slot satırı görünsün),
   * tavanı 400 (çok uzun ekranda gereksiz büyümesin). */
  LAYOUT.drawerH = Math.round(Math.min(400, Math.max(300, DESIGN.H * 0.25)));
  LAYOUT.drawerTop = DESIGN.H - LAYOUT.drawerH;
  LAYOUT.boardBottom = LAYOUT.drawerTop;
}

const TUNING = {
  /** Kaç yeni keşifte bir geçiş reklamı (interstitial) istenecek. */
  adsEveryNDiscoveries: 10,
  /** Kutlama yapılacak keşif sayıları (kısa oturumlarda da hedef hissi verir). */
  milestones: [5, 10, 25, 50, 100, 200, 350, 500],
  /** Günlük hedef: kaç yeni keşifte bedava ipucu kazanılır. */
  dailyTarget: 5,

  /* ── MAĞAZA EKONOMİSİ ────────────────────────────────────────────────
   * Playables GERÇEK PARA ile satın almayı desteklemez; mağaza yumuşak para
   * (Öz) üzerine kurulur. Öz iki yoldan gelir: oynayarak ve reklam izleyerek.
   *
   * Tasarımın ödüllü reklam izlenmesini artırma mantığı:
   *   · ÇİFT FİYAT — her ürün "X Öz" VEYA "1 reklam". Oyuncu asla reklam
   *     izlemeye MECBUR değil (ilerleme kilitlenmez), ama reklam HIZLI yoldur.
   *     Her ürün böylece bir reklam fırsatına dönüşür.
   *   · ÖZ AKIŞI < TALEP — fiyatlar pasif kazançtan yüksek tutulur, mağaza
   *     oyun boyunca anlamlı kalır.
   *   · GERİ SAYIM — bedava Öz kesesinin bekleme süresi ekranda görünür;
   *     "45 sn sonra tekrar" dönüş sebebi yaratır.
   *   · TILSIM SKORA DOKUNUR — skor derinlik ağırlıklı olduğu için nadirlik
   *     tılsımı doğrudan liderlik tablosunu etkiler: gerçek değer.
   * Politika: ödüllü reklamlar DAİMA oyuncunun kendi isteğiyle başlar. */
  ozOdul: { kesif: true, gunluk: 25, reklamKese: 25 },
  ozKeseBekleme: 60000,          // bedava Öz kesesi bekleme süresi (ms)
  magaza: [
    { id: 'hint',  emoji: '💡', fiyat: 30,  reklam: true },
    { id: 'pack',  emoji: '🎁', fiyat: 80,  reklam: true },
    { id: 'charm', emoji: '🔮', fiyat: 120, reklam: true },
    { id: 'pouch', emoji: '⚡', fiyat: 0,   reklam: true },   // yalnızca reklam
  ],
  tilsimBirlestirme: 3,          // tılsım kaç birleştirme sürer
  tilsimKademe: 2,               // kaç kademe yükseltir
  paketAdet: 3,                  // element paketindeki keşif sayısı
  /** İki kartın birleşmesi için gereken minimum çakışma (overlap) oranı. */
  mergeOverlapRatio: 0.34,
  /** AI isteği zaman aşımı (ms). Aşılırsa çevrimdışı motora düşer.
   *  gemini-flash-lite-latest canlı ölçümü: 539 / 601 / 606 ms.
   *  6 sn = tipik sürenin ~10 katı; ağ tıkansa bile bol pay bırakır ama
   *  takılan bir isteğin oyuncuyu bekletmesini önler. */
  aiTimeoutMs: 6000,
  /** AI KALİTE hatası (soyut/tekrar sonuç) verirse kaç kez tekrar denensin. */
  aiRetries: 1,
  /** HTTP 429 (hız limiti) için AYRI, daha cömert yeniden deneme bütçesi. */
  aiRateLimitRetries: 3,
  /** Kayıt yazma debounce süresi (ms). */
  saveDebounceMs: 1200,
  /** sendScore çağrıları arası minimum süre (ms) — platform rate-limit'i için. */
  scoreThrottleMs: 4000,
  /** Kayıt boyutunu şişirmemek için saklanacak maksimum tarif sayısı. */
  maxStoredRecipes: 800,
};

/** Oyuncunun elindeki 4 temel element. Oyun BUNLARLA başlar. */
const BASE_IDS = ['water', 'fire', 'earth', 'air', 'concrete', 'tech'];

/* --- AI uç noktası ---------------------------------------------------------
 * !!! GÜVENLİK NOTU !!!
 * Aşağıdaki anahtar bir YER TUTUCUDUR. Gerçek API anahtarını ASLA istemci
 * koduna gömmeyin — Playables paketi kullanıcıya indirilir ve anahtar herkese
 * açık hale gelir. Üretimde kendi sunucunuzda ince bir "proxy" endpoint açın,
 * anahtar orada dursun; oyun sadece proxy'ye istek atsın.
 *
 * !!! AĞ ERİŞİMİ NOTU !!!
 * YouTube Playables, oyunu katı CSP'li bir sandbox iframe içinde çalıştırır.
 * Harici bir domain'e fetch atabilmek için o domain'in YouTube tarafında
 * izin listesine (allowlist) alınması gerekir; başvuru sırasında kullandığınız
 * tüm çalışma-anı endpoint'lerini beyan edin. Bu yüzden oyun, ağ engellenirse
 * ASLA kilitlenmez: Alchemy motoru (bkz. [5]) devreye girer ve oyun akmaya
 * devam eder.
 * ------------------------------------------------------------------------ */
/* ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  ★★★  API ANAHTARINI BURAYA YAZ  ★★★                                    ║
 * ║                                                                          ║
 * ║  1) AI_PROVIDER'ı kullanmak istediğin sağlayıcıya çevir                  ║
 * ║  2) AI_PROVIDERS içindeki o sağlayıcının apiKey alanına anahtarını yaz   ║
 * ║                                                                          ║
 * ║  Gemini anahtarını buradan alabilirsin:                                  ║
 * ║     https://aistudio.google.com/apikey                                   ║
 * ╚══════════════════════════════════════════════════════════════════════════╝ */

const AI_PROVIDER = 'proxy';        // 'proxy' | 'gemini' | 'tamga'  →  ÜRETİMDE 'proxy' OLMALI

const AI_PROVIDERS = {

  /* ---- GOOGLE GEMINI ----------------------------------------------------
   * Google'ın OpenAI-UYUMLU uç noktasını kullanıyoruz. Böylece istek gövdesi
   * (messages / model / stream / max_tokens) hiç değişmiyor; sadece adres,
   * anahtar ve model adı farklı. Tarayıcıdan doğrudan çağrılabilir (CORS açık).
   * -------------------------------------------------------------------- */
  gemini: {
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',

    // ↓↓↓ ANAHTARINI BURAYA YAPIŞTIR ↓↓↓
    apiKey: '',
    // ↑↑↑ ------------------------- ↑↑↑

    /* CANLI ÖLÇÜM (aynı anahtarla, aynı prompt):
     *   gemini-3.6-flash       → HTTP 429 "exceeded your current quota"
     *   gemini-3.1-flash-lite  → 998 ms
     *   gemini-3.5-flash-lite  → 655 ms
     *   gemini-flash-lite-latest → 582 ms   ← seçilen
     * Flash modelin kotası dolduğu için HER istek başarısız oluyor ve oyun
     * sessizce çevrimdışı motora düşüyordu; "Dev Bataklık" gibi anlamsız
     * isimlerin gerçek sebebi buydu. Lite model hem çalışıyor hem ~7x hızlı. */
    model: 'gemini-flash-lite-latest',

    /* max_tokens, DÜŞÜNME + ÇIKTI toplamını sınırlar.
     * Ölçtüğümüz değerler (Su + Ateş isteği, canlı):
     *   max_tokens 256          → finish_reason "length", JSON yarıda kesildi
     *                             (243 token düşünmeye gitti, çıktıya 9 kaldı)
     *   max_tokens 1024         → doğru JSON ama 17 SANİYE
     *   + reasoning_effort low  → doğru JSON, 3.2 saniye  ← seçtiğimiz ayar
     * 800 bırakıyoruz ki düşünme beklenenden uzun sürerse bile çıktıya yer kalsın. */
    maxTokens: 800,

    /* Sağlayıcıya özel ek gövde alanları. Gemini 3.x "düşünen" bir modeldir ve
     * varsayılan düşünme süresi bir birleştirme oyunu için çok uzundur.
     * reasoning_effort: 'low' bunu kısaltır. NOT: 'none' değeri Google
     * tarafından reddediliyor (HTTP 400 "invalid argument") — 'low' kullanın. */
    extraBody: { reasoning_effort: 'low' },
  },

  /* ---- PROXY (ÜRETİM İÇİN DOĞRU SEÇENEK) --------------------------------
   * Anahtar SUNUCUDA durur; oyun anahtarı hiç görmez. Kurulum: proxy/README.md
   * Yapman gereken tek şey: aşağıdaki endpoint'e Worker adresini yazmak ve
   * yukarıdaki AI_PROVIDER değerini 'proxy' yapmak. */
  proxy: {
    endpoint: 'https://omnimerge-ai.mtahayagmur.workers.dev',   // örn: https://omnimerge-ai.hesabin.workers.dev
    apiKey: '',                          // BOŞ KALACAK — anahtar sunucuda
    model: 'gemini-flash-lite-latest',
    maxTokens: 800,
    extraBody: { reasoning_effort: 'low' },
  },

  /* ---- TAMGASTUDIO ------------------------------------------------------ */
  tamga: {
    endpoint: 'https://tamga.studio/api/v1/chat/completions',
    apiKey: 'YOUR_API_KEY',
    model: 'tamgastudio/gpt-5',
    maxTokens: 64,
    extraBody: {},
  },
};

const AI_CONFIG = {
  get endpoint()  { return AI_PROVIDERS[AI_PROVIDER].endpoint; },
  get apiKey()    { return AI_PROVIDERS[AI_PROVIDER].apiKey; },
  get model()     { return AI_PROVIDERS[AI_PROVIDER].model; },
  get maxTokens() { return AI_PROVIDERS[AI_PROVIDER].maxTokens; },
  get extraBody() { return AI_PROVIDERS[AI_PROVIDER].extraBody || {}; },
  stream: false,

  get systemPrompt() { return (AI_LANG[LANG] || AI_LANG.en).system; },
  get formatRule()   { return (AI_LANG[LANG] || AI_LANG.en).format; },
  get strictRule()   { return (AI_LANG[LANG] || AI_LANG.en).strict; },
  get knownPrefix()  { return (AI_LANG[LANG] || AI_LANG.en).known; },

  /* NOT: Bu nesnede ESKİ Türkçe `formatRule` / `strictRule` düz özellikleri
   * duruyordu. JavaScript'te aynı nesne içinde bir getter'dan SONRA gelen düz
   * özellik getter'ı EZER — bu yüzden dil seçilse bile model hep Türkçe
   * yanıt veriyordu ("Technology + Sandwich → Dökümhane"). Alanlar kaldırıldı;
   * tüm prompt metinleri artık yalnızca AI_LANG içinden, aktif dile göre gelir. */
};

/* ============================================================================
 * [1b] I18N — ÇOK DİLLİ İÇERİK
 * ----------------------------------------------------------------------------
 *  Oyunun ANA DİLİ İngilizce. Türkçe, İspanyolca ve Portekizce (Brezilya)
 *  ayarlar menüsünden seçilebilir.
 *
 *  Dil seçimi neden İspanyolca + Portekizce? YouTube'un en büyük casual oyun
 *  kitleleri LatAm ve Brezilya'da. İkisi de Latin alfabesi kullandığı için
 *  sistem fontlarıyla sorunsuz çiziliyor ve RTL karmaşası yok.
 *
 *  MİMARİ: Elementler DİLDEN BAĞIMSIZ bir kimlikle (id) tanımlanır; görünen
 *  ad dile göre üretilir. Böylece dil değiştiğinde kütüphane, tarif tablosu ve
 *  tahtadaki kartlar anında yeniden adlandırılır — kayıt bozulmaz.
 *  Yapay zekânın ürettiği elementlerin kimliği yoktur; onlar keşfedildikleri
 *  dilde kalır (çevrilemezler, bu dürüst davranış).
 * ==========================================================================*/

const LANGS = [
  { kod: 'en', ad: 'English',    bayrak: '🇬🇧' },
  { kod: 'tr', ad: 'Türkçe',     bayrak: '🇹🇷' },
  { kod: 'es', ad: 'Español',    bayrak: '🇪🇸' },
  { kod: 'pt', ad: 'Português',  bayrak: '🇧🇷' },
];

/* Element sözlüğü: id → [emoji, en, tr, es, pt] */
const ELEMENTS = {
  /* --- temel --- */
  water:'💧|Water|Su|Agua|Água', fire:'🔥|Fire|Ateş|Fuego|Fogo',
  earth:'🌍|Earth|Toprak|Tierra|Terra', air:'💨|Air|Hava|Aire|Ar',
  concrete:'🧱|Concrete|Beton|Hormigón|Concreto', tech:'💻|Technology|Teknoloji|Tecnología|Tecnologia',
  /* --- 1. kuşak --- */
  steam:'♨️|Steam|Buhar|Vapor|Vapor', mud:'🟤|Mud|Çamur|Barro|Lama',
  fog:'🌫️|Fog|Sis|Niebla|Névoa', lava:'🌋|Lava|Lav|Lava|Lava',
  energy:'⚡|Energy|Enerji|Energía|Energia', dust:'🌪️|Dust|Toz|Polvo|Poeira',
  sea:'🌊|Sea|Deniz|Mar|Mar', sun:'☀️|Sun|Güneş|Sol|Sol',
  mountain:'⛰️|Mountain|Dağ|Montaña|Montanha', wind:'🌬️|Wind|Rüzgar|Viento|Vento',
  /* --- 2. kuşak --- */
  stone:'🪨|Stone|Taş|Piedra|Pedra', basalt:'🗿|Basalt|Bazalt|Basalto|Basalto',
  brick:'🧱|Brick|Tuğla|Ladrillo|Tijolo', sand:'🏖️|Sand|Kum|Arena|Areia',
  glass:'🪟|Glass|Cam|Vidrio|Vidro', metal:'⚙️|Metal|Metal|Metal|Metal',
  salt:'🧂|Salt|Tuz|Sal|Sal', plant:'🌱|Plant|Bitki|Planta|Planta',
  volcano:'🌋|Volcano|Volkan|Volcán|Vulcão', wave:'🏄|Wave|Dalga|Ola|Onda',
  geyser:'⛲|Geyser|Gayzer|Géiser|Gêiser', rainbow:'🌈|Rainbow|Gökkuşağı|Arcoíris|Arco-íris',
  clay:'🧱|Clay|Kil|Arcilla|Argila',
  /* --- 3. kuşak --- */
  tree:'🌳|Tree|Ağaç|Árbol|Árvore', coal:'⚫|Coal|Kömür|Carbón|Carvão',
  forest:'🌲|Forest|Orman|Bosque|Floresta', swamp:'🐸|Swamp|Bataklık|Pantano|Pântano',
  sword:'⚔️|Sword|Kılıç|Espada|Espada', hourglass:'⏳|Hourglass|Kum Saati|Reloj de Arena|Ampulheta',
  electricity:'🔌|Electricity|Elektrik|Electricidad|Eletricidade', wall:'🧱|Wall|Duvar|Muro|Muro',
  /* --- 4. kuşak --- */
  life:'🧬|Life|Hayat|Vida|Vida', human:'🧍|Human|İnsan|Humano|Humano',
  tool:'🔨|Tool|Alet|Herramienta|Ferramenta', family:'👨‍👩‍👦|Family|Aile|Familia|Família',
  robot:'🤖|Robot|Robot|Robot|Robô', ai:'🧠|AI|Yapay Zeka|IA|IA',
  ship:'🚢|Ship|Gemi|Barco|Navio', hunter:'🏹|Hunter|Avcı|Cazador|Caçador',
  fish:'🐟|Fish|Balık|Pez|Peixe', bird:'🐦|Bird|Kuş|Pájaro|Pássaro',
  screen:'📺|Screen|Ekran|Pantalla|Tela', game:'🎮|Game|Oyun|Juego|Jogo',
  /* --- beton --- */
  mortar:'🪣|Mortar|Harç|Mortero|Argamassa', lime:'⬜|Lime|Kireç|Cal|Cal',
  foundation:'🏗️|Foundation|Temel|Cimientos|Alicerce',
  cementdust:'🌫️|Cement Dust|Çimento Tozu|Polvo de Cemento|Pó de Cimento',
  building:'🏢|Building|Bina|Edificio|Prédio', skyscraper:'🏙️|Skyscraper|Gökdelen|Rascacielos|Arranha-céu',
  plaster:'🧴|Plaster|Sıva|Yeso|Reboco', dam:'🌊|Dam|Baraj|Presa|Represa',
  city:'🌆|City|Şehir|Ciudad|Cidade', builder:'👷|Builder|İnşaatçı|Albañil|Pedreiro',
  /* --- teknoloji --- */
  hydro:'⚡|Hydropower|Hidroelektrik|Hidroeléctrica|Hidrelétrica',
  engine:'🏭|Engine|Motor|Motor|Motor', tractor:'🚜|Tractor|Traktör|Tractor|Trator',
  drone:'🛸|Drone|Drone|Dron|Drone', internet:'🌐|Internet|İnternet|Internet|Internet',
  computer:'💻|Computer|Bilgisayar|Computadora|Computador',
  solarpanel:'🔆|Solar Panel|Güneş Paneli|Panel Solar|Painel Solar',
  smartcity:'🏙️|Smart City|Akıllı Şehir|Ciudad Inteligente|Cidade Inteligente',
  greenhouse:'🏡|Greenhouse|Sera|Invernadero|Estufa',
  biotech:'🧬|Biotech|Biyoteknoloji|Biotecnología|Biotecnologia',
  /* --- aynı element x2 --- */
  cloud:'☁️|Cloud|Bulut|Nube|Nuvem', sandstorm:'🌪️|Sandstorm|Kum Fırtınası|Tormenta de Arena|Tempestade de Areia',
  haze:'🌁|Haze|Pus|Bruma|Bruma', magma:'🌋|Magma|Magma|Magma|Magma',
  rock:'🗿|Rock|Kaya|Roca|Rocha', desert:'🏜️|Desert|Çöl|Desierto|Deserto',
  ocean:'🌊|Ocean|Okyanus|Océano|Oceano', range:'🏔️|Mountain Range|Sıradağlar|Cordillera|Cordilheira',
  hurricane:'🌀|Hurricane|Kasırga|Huracán|Furacão', supernova:'💥|Supernova|Süpernova|Supernova|Supernova',
  bush:'🌿|Bush|Çalılık|Arbusto|Arbusto', alloy:'🔩|Alloy|Alaşım|Aleación|Liga',
  mirror:'🪞|Mirror|Ayna|Espejo|Espelho', storm:'⛈️|Storm|Fırtına|Tormenta|Tempestade',
  /* --- 2. tur yükseltmeler --- */
  wetland:'🌿|Wetland|Sulak Alan|Humedal|Área Úmida', rain:'🌧️|Rain|Yağmur|Lluvia|Chuva',
  cliff:'🧗|Cliff|Uçurum|Acantilado|Penhasco', jungle:'🌴|Jungle|Cangıl|Selva|Selva',
  deepsea:'🐋|Deep Sea|Derin Su|Mar Profundo|Mar Profundo', oasis:'🏝️|Oasis|Vaha|Oasis|Oásis',
  metropolis:'🏙️|Metropolis|Metropol|Metrópolis|Metrópole',
  cyberspace:'🕸️|Cyberspace|Siber Uzay|Ciberespacio|Ciberespaço',
  robotarmy:'⚔️|Robot Army|Robot Ordusu|Ejército Robot|Exército Robô',
  core:'🌡️|Earth Core|Yer Çekirdeği|Núcleo Terrestre|Núcleo Terrestre',
  superstorm:'🌪️|Superstorm|Süper Fırtına|Supertormenta|Supertempestade',
  datacenter:'🖥️|Data Center|Veri Merkezi|Centro de Datos|Data Center',
  /* --- genişletme: doğa & yaşam --- */
  ash:'⬛|Ash|Kül|Ceniza|Cinza', ice:'🧊|Ice|Buz|Hielo|Gelo',
  snow:'❄️|Snow|Kar|Nieve|Neve', glacier:'🏔️|Glacier|Buzul|Glaciar|Geleira',
  river:'🛶|River|Nehir|Río|Rio', lake:'🏞️|Lake|Göl|Lago|Lago',
  island:'🏝️|Island|Ada|Isla|Ilha', wheat:'🌾|Wheat|Buğday|Trigo|Trigo',
  /* --- genişletme: insan & üretim --- */
  steel:'🔗|Steel|Çelik|Acero|Aço', farmer:'👨‍🌾|Farmer|Çiftçi|Granjero|Fazendeiro',
  fisherman:'🎣|Fisherman|Balıkçı|Pescador|Pescador', bread:'🍞|Bread|Ekmek|Pan|Pão',
  home:'🏠|Home|Ev|Casa|Casa', crowd:'👥|Crowd|Kalabalık|Multitud|Multidão',
  statue:'🗽|Statue|Heykel|Estatua|Estátua', farm:'🌻|Farm|Çiftlik|Granja|Fazenda',
  /* --- genişletme: makine & ulaşım --- */
  steamengine:'🚂|Steam Engine|Buharlı Makine|Máquina de Vapor|Máquina a Vapor',
  rail:'🛤️|Rail|Ray|Vía|Trilho', train:'🚆|Train|Tren|Tren|Trem',
  road:'🛣️|Road|Road|Carretera|Estrada', car:'🚗|Car|Araba|Coche|Carro',
  bridge:'🌉|Bridge|Köprü|Puente|Ponte', airplane:'✈️|Airplane|Uçak|Avión|Avião',
  /* --- genişletme: enerji & uzay --- */
  lamp:'💡|Lamp|Lamba|Lámpara|Lâmpada', battery:'🔋|Battery|Pil|Batería|Bateria',
  phone:'📱|Phone|Telefon|Teléfono|Telefone', satellite:'🛰️|Satellite|Uydu|Satélite|Satélite',
  rocket:'🚀|Rocket|Roket|Cohete|Foguete',
  astronaut:'👨‍🚀|Astronaut|Astronot|Astronauta|Astronauta',
  moon:'🌙|Moon|Ay|Luna|Lua', star:'⭐|Star|Yıldız|Estrella|Estrela',
};

/** Aktif dil. BootScene'de SDK'dan/kayıttan belirlenir. */
let LANG = 'en';
/* Dilin dizideki sırası (0 tabanlı).
 * DİKKAT: ELEMENTS satırları 'emoji|en|tr|es|pt' biçiminde olduğu için orada
 * +1 kaydırma gerekir; UI_STR satırları 'en|tr|es|pt' olduğu için kaydırma yok.
 * Bu ayrım tek bir sabitle yönetilmeye çalışılınca arayüz İspanyolca,
 * kütüphane Türkçe çıkıyordu — iki erişimci ayrı tutuluyor. */
const LANG_IDX = { en: 0, tr: 1, es: 2, pt: 3 };

function elemEmoji(id) { const r = ELEMENTS[id]; return r ? r.split('|')[0] : '✨'; }
function elemName(id) {
  const r = ELEMENTS[id];
  if (!r) return id;
  const p = r.split('|');
  return p[LANG_IDX[LANG] + 1] || p[1];   // +1: ilk alan emoji
}

/* Arayüz metinleri: anahtar → 'en|tr|es|pt'. {x} yer tutucuları t() ile doldurulur. */
const UI_STR = {
  score:        '🧪  {n} elements  ·  ⭐ {p} pts|🧪  {n} element  ·  ⭐ {p} puan|🧪  {n} elementos  ·  ⭐ {p} pts|🧪  {n} elementos  ·  ⭐ {p} pts',
  hintBtn:      '💡  Hint|💡  İpucu|💡  Pista|💡  Dica',
  library:      'LIBRARY|KÜTÜPHANE|BIBLIOTECA|BIBLIOTECA',
  libCount:     '{n} elements|{n} element|{n} elementos|{n} elementos',
  clear:        'Clear|Temizle|Limpiar|Limpar',
  settings:     '⚙️  Settings|⚙️  Ayarlar|⚙️  Ajustes|⚙️  Ajustes',
  language:     'Language|Dil|Idioma|Idioma',
  close:        'Close|Kapat|Cerrar|Fechar',
  audioInfo:    'Sound is controlled by the YouTube player button 🔈|Ses, YouTube oynatıcısının düğmesinden kontrol edilir 🔈|El sonido se controla desde el reproductor de YouTube 🔈|O som é controlado pelo player do YouTube 🔈',
  offline:      '⚡ offline alchemy mode|⚡ çevrimdışı simya modu|⚡ modo alquimia sin conexión|⚡ modo alquimia offline',
  tut1:         'Drag one element onto another 👆|Bir elementi diğerinin üstüne sürükle 👆|Arrastra un elemento sobre otro 👆|Arraste um elemento sobre outro 👆',
  tut2:         'You can also pull up from the library ⬆️|Kütüphaneden de yukarı çekebilirsin ⬆️|También puedes arrastrar desde la biblioteca ⬆️|Você também pode puxar da biblioteca ⬆️',
  working:      'Alchemy at work…|Simya çalışıyor…|Alquimia en proceso…|Alquimia em ação…',
  thinking:     'AI is thinking…|Yapay zeka düşünüyor…|La IA está pensando…|A IA está pensando…',
  error:        'Something went wrong, try again|Bir şeyler ters gitti, tekrar dene|Algo salió mal, inténtalo de nuevo|Algo deu errado, tente novamente',
  discovery:    '{r} DISCOVERY\n{e}  {n}|{r} KEŞİF\n{e}  {n}|DESCUBRIMIENTO {r}\n{e}  {n}|DESCOBERTA {r}\n{e}  {n}',
  known:        '{e}  {n} — already in your library|{e}  {n} — zaten kütüphanende|{e}  {n} — ya está en tu biblioteca|{e}  {n} — já está na sua biblioteca',
  milestone:    '🏆  {n} ELEMENTS|🏆  {n} ELEMENT|🏆  {n} ELEMENTOS|🏆  {n} ELEMENTOS',
  milestoneSub: 'Your alchemy library keeps growing!|Simya kütüphanen büyüyor!|¡Tu biblioteca sigue creciendo!|Sua biblioteca continua crescendo!',
  adLoading:    'Loading ad…|Reklam yükleniyor…|Cargando anuncio…|Carregando anúncio…',
  adRewarded:   'Loading rewarded ad…|Ödüllü reklam yükleniyor…|Cargando anuncio con recompensa…|Carregando anúncio premiado…',
  adDev:        '(dev) An interstitial ad would show here|(dev) Burada geçiş reklamı gösterilirdi|(dev) Aquí aparecería un anuncio|(dev) Aqui apareceria um anúncio',
  hintTitle:    '💡  Want a hint?|💡  İpucu ister misin?|💡  ¿Quieres una pista?|💡  Quer uma dica?',
  hintBody:     'Watch a short ad and we will reveal\na formula you have not found yet.|Kısa bir reklam izle, keşfetmediğin\nbir formülü açığa çıkaralım.|Mira un anuncio corto y revelaremos\nuna fórmula que aún no has encontrado.|Assista a um anúncio curto e revelaremos\numa fórmula que você ainda não achou.',
  hintWatch:    'Watch ad|Reklamı izle|Ver anuncio|Ver anúncio',
  cancel:       'Cancel|Vazgeç|Cancelar|Cancelar',
  hintRevealed: '🔮  Formula revealed|🔮  Formül açığa çıktı|🔮  Fórmula revelada|🔮  Fórmula revelada',
  great:        'Great!|Harika!|¡Genial!|Ótimo!',
  adNotDone:    'Ad not completed — no hint given|Reklam tamamlanmadı — ipucu verilemedi|Anuncio no completado — sin pista|Anúncio não concluído — sem dica',
  noHint:       'No hint right now — merge a few more elements!|Şu an verecek ipucu yok — birkaç element daha birleştir!|Sin pistas ahora — ¡combina más elementos!|Sem dicas agora — combine mais elementos!',
  unknown:      'Unknown|Bilinmeyen|Desconocido|Desconhecido',
  langChanged:  'Language changed|Dil değişti|Idioma cambiado|Idioma alterado',
  tvHint:       '⬅➡ move  ·  OK select  ·  OK again to merge|⬅➡ hareket  ·  OK seç  ·  tekrar OK birleştir|⬅➡ mover  ·  OK elegir  ·  OK de nuevo para unir|⬅➡ mover  ·  OK escolher  ·  OK de novo para unir',
  reset:        'Reset progress|İlerlemeyi sıfırla|Reiniciar progreso|Zerar progresso',
  resetTitle:   '⚠️  Reset progress?|⚠️  İlerleme sıfırlansın mı?|⚠️  ¿Reiniciar progreso?|⚠️  Zerar o progresso?',
  resetBody:    'Your {n} discovered elements will be\npermanently deleted. This cannot be undone.|Keşfettiğin {n} element kalıcı olarak\nsilinecek. Bu geri alınamaz.|Tus {n} elementos descubiertos se\nborrarán para siempre. No se puede deshacer.|Seus {n} elementos descobertos serão\napagados para sempre. Não dá para desfazer.',
  resetYes:     'Yes, reset|Evet, sıfırla|Sí, reiniciar|Sim, zerar',
  resetDone:    'Progress reset|İlerleme sıfırlandı|Progreso reiniciado|Progresso zerado',
  daily:        '🎯 {n} more today → free hint|🎯 bugün {n} keşif daha → bedava ipucu|🎯 {n} más hoy → pista gratis|🎯 mais {n} hoje → dica grátis',
  dailyDone:    '🎁 Daily goal complete — free hint earned!|🎁 Günlük hedef tamam — bedava ipucu kazandın!|🎁 ¡Meta diaria cumplida — pista gratis!|🎁 Meta diária concluída — dica grátis!',
  freeHint:     '🎁 {n} free hint ready|🎁 {n} bedava ipucu hazır|🎁 {n} pista gratis lista|🎁 {n} dica grátis pronta',
  hintFree:     '🎁  Free hint|🎁  Bedava ipucu|🎁  Pista gratis|🎁  Dica grátis',

  /* ── Mağaza ─────────────────────────────────────────────────────── */
  shop:         '🛒  Alchemy Shop|🛒  Simya Dükkânı|🛒  Tienda de Alquimia|🛒  Loja de Alquimia',
  balance:      'Balance: ✨ {n} Essence|Bakiye: ✨ {n} Öz|Saldo: ✨ {n} Esencia|Saldo: ✨ {n} Essência',
  watchAd:      'Watch|İzle|Ver|Assistir',
  noEssence:    'Not enough Essence|Yeterli Öz yok|No hay suficiente Esencia|Essência insuficiente',
  cooldown:     'Ready in {n}s|{n} sn sonra hazır|Listo en {n}s|Pronto em {n}s',
  gotEssence:   '✨ +{n} Essence|✨ +{n} Öz|✨ +{n} Esencia|✨ +{n} Essência',
  gotCharm:     '🔮 Rarity Charm active — next {n} merges|🔮 Nadirlik Tılsımı aktif — sonraki {n} birleştirme|🔮 Amuleto activo — próximas {n} uniones|🔮 Amuleto ativo — próximas {n} fusões',
  gotPack:      '🎁  Element Pack opened|🎁  Element Paketi açıldı|🎁  Paquete abierto|🎁  Pacote aberto',
  charmProc:    '🔮 Charm boosted this find — {n} left|🔮 Tılsım bu keşfi yükseltti — {n} kaldı|🔮 El amuleto mejoró este hallazgo — quedan {n}|🔮 O amuleto turbinou esta descoberta — restam {n}',
  packEmpty:    'No new formulas available right now|Şu an verilecek yeni formül yok|No hay fórmulas nuevas ahora|Sem fórmulas novas agora',

  shop_hint:    'Hint|İpucu|Pista|Dica',
  shopd_hint:   'Reveals a formula you have not found|Keşfetmediğin bir formülü açar|Revela una fórmula no encontrada|Revela uma fórmula não encontrada',
  shop_pack:    'Element Pack|Element Paketi|Paquete de Elementos|Pacote de Elementos',
  shopd_pack:   'Instantly discover 3 new elements|Anında 3 yeni element keşfet|Descubre 3 elementos al instante|Descubra 3 elementos na hora',
  shop_charm:   'Rarity Charm|Nadirlik Tılsımı|Amuleto de Rareza|Amuleto de Raridade',
  shopd_charm:  'Next 3 merges give rarer results (more points)|Sonraki 3 birleştirme daha nadir sonuç verir (daha çok puan)|Las próximas 3 uniones dan resultados más raros|As próximas 3 fusões dão resultados mais raros',
  shop_pouch:   'Essence Pouch|Öz Kesesi|Bolsa de Esencia|Bolsa de Essência',
  shopd_pouch:  'Free ✨25 Essence, once per minute|Bedava ✨25 Öz, dakikada bir|✨25 Esencia gratis, una vez por minuto|✨25 Essência grátis, uma vez por minuto',
  r0:           'BASIC|TEMEL|BÁSICO|BÁSICO',
  r1:           'COMMON|YAYGIN|COMÚN|COMUM',
  r2:           'RARE|NADİR|RARO|RARO',
  r3:           'EPIC|DESTANSI|ÉPICO|ÉPICO',
  r4:           'LEGENDARY|EFSANEVİ|LEGENDARIO|LENDÁRIO',
};

/** Metin çevirici. t('score', { n: 12, p: 40 }) */
function t(key, vars) {
  const row = UI_STR[key];
  if (!row) return key;
  const parts = row.split('|');
  let s = parts[LANG_IDX[LANG]] || parts[0];
  if (vars) for (const k in vars) s = s.split('{' + k + '}').join(vars[k]);
  return s;
}

/* Çevrimdışı motorun ürettiği isim ŞABLONLARI.
 * Şablon kullanmamızın sebebi kelime sırasının dile göre değişmesi:
 *   en "Water Factory"  ·  tr "Su Fabrikası"  ·  es "Fábrica de Agua"
 * (Bu yol AI çalışırken %2'den az tetiklenir ama dil tutarlılığı şart.) */
const SYNTH_TPL = {
  en: ['{n} Factory','{n} Workshop','{n} Field','{n} Garden','{n} Tower','{n} Bridge','{n} Mine','{n} Kiln','{n} Depot','{n} Master'],
  tr: ['{n} Fabrikası','{n} Atölyesi','{n} Tarlası','{n} Bahçesi','{n} Kulesi','{n} Köprüsü','{n} Madeni','{n} Fırını','{n} Deposu','{n} Ustası'],
  es: ['Fábrica de {n}','Taller de {n}','Campo de {n}','Jardín de {n}','Torre de {n}','Puente de {n}','Mina de {n}','Horno de {n}','Almacén de {n}','Maestro de {n}'],
  pt: ['Fábrica de {n}','Oficina de {n}','Campo de {n}','Jardim de {n}','Torre de {n}','Ponte de {n}','Mina de {n}','Forno de {n}','Depósito de {n}','Mestre de {n}'],
};

/** Aynı element x2 merdiveni (son çare). Boyut sıfatı değil, coğrafya/nicelik. */
const LADDER_TPL = {
  en: ['{n} Land','{n} Empire','{n} Realm'],
  tr: ['{n} Diyarı','{n} İmparatorluğu','{n} Ülkesi'],
  es: ['Tierra de {n}','Imperio de {n}','Reino de {n}'],
  pt: ['Terra de {n}','Império de {n}','Reino de {n}'],
};

/* AI sistem promptu ve kuralları — DİLE GÖRE.
 * Model, oyuncunun dilinde element üretmeli; aksi halde kütüphane karışır. */
const AI_LANG = {
  en: {
    system: 'You are an alchemy game. The player gives two words. You return one new word born from their logical combination, plus a fitting emoji.',
    format: 'OUTPUT RULE: Return ONLY one line of valid JSON, nothing else. Schema: {"name":"<one or at most two ENGLISH words>","emoji":"<single emoji>"}. Capitalise the name. The result MUST differ from both inputs; never repeat an input. If the SAME word is given twice, return a bigger/more advanced NEXT TIER of it (Beach + Beach = Coastline, Mud + Mud = Swamp, Stone + Stone = Rock). CONCRETENESS: the result must be a concrete thing you can point at — an object, creature, place, material, food, vehicle, building, job or event. Never abstract. BANNED WORDS: cosmic, universal, infinity, dimension, essence, soul, echo, core, absolute, divine, god, omni, singularity, consciousness, being, transcendent, eternal, ultimate, boundless, quantum. VARIETY: do not keep drifting into the same theme. No explanation, code block or markdown. FAMILY-FRIENDLY RULE: This game is played by all ages including children. The result must be suitable for a young audience: no sexual content, no drugs, alcohol or tobacco, no violence, gore, weapons glorification, self-harm, hate speech or slurs. If a combination would naturally lead somewhere inappropriate, return a harmless related object instead.',
    strict: 'YOUR PREVIOUS ATTEMPT WAS TOO ABSTRACT. Give something tangible and everyday: an animal, plant, tool, food, vehicle, building, job or geographic place. Abstract concepts and philosophical terms are strictly forbidden.',
    known: 'These names already exist, do not repeat them; produce something different: ',
  },
  tr: {
    system: 'Sen bir simya oyunusun. Oyuncu iki kelime verecek. Sen bu iki kelimenin mantıklı birleşiminden doğan yeni bir kelime ve ona uygun bir emoji döndüreceksin.',
    format: 'ÇIKTI KURALI: Sadece tek satırlık geçerli JSON döndür, başka hiçbir şey yazma. Şema: {"name":"<Türkçe tek kelime veya en fazla iki kelime>","emoji":"<tek emoji>"}. İsim Türkçe ve baş harfi büyük olsun. Sonuç girdilerden FARKLI olmalı, asla girdiyi tekrar etme. AYNI kelime iki kez verilirse o şeyin daha büyük/gelişmiş bir ÜST KADEMESİNİ döndür (Plaj + Plaj = Kıyı Şeridi, Çamur + Çamur = Bataklık, Taş + Taş = Kaya gibi). Emoji mutlaka isimle uyumlu olsun. SOMUTLUK KURALI: Sonuç, gerçek dünyada işaret edebileceğin SOMUT bir şey olmalı — bir nesne, canlı, yer, malzeme, yiyecek, araç, yapı, meslek ya da olay. Girdiler ne kadar soyut olursa olsun sen SOMUTA dön. ŞU KELİMELER YASAK: kozmik, evrensel, sonsuzluk, boyut, öz, ruh, yankı, çekirdek, mutlak, ilahi, tanrı, omni, tekillik, bilinç, varlık, oluşum, aşkın, ebedi, nihai, sınırsız, kuantum. ÇEŞİTLİLİK: Aynı temaya saplanma. Açıklama, kod bloğu veya markdown yok. AİLE DOSTU KURAL: Bu oyunu çocuklar dahil her yaştan insan oynuyor. Sonuç genç bir kitleye uygun olmalı: cinsel içerik yok, uyuşturucu/alkol/tütün yok, şiddet, kan, silah yüceltmesi, kendine zarar, nefret söylemi veya hakaret yok. Bir birleşim doğal olarak uygunsuz bir yere gidiyorsa, onun yerine zararsız ve ilgili bir nesne döndür.',
    strict: 'ÖNCEKİ DENEMEN FAZLA SOYUTTU. Bu sefer kesinlikle elle tutulur, gündelik, somut bir şey ver: bir hayvan, bitki, alet, yemek, araç, bina, meslek veya coğrafi yer. Soyut kavram ve felsefi terim KESİNLİKLE YASAK.',
    known: 'Şu isimler zaten bulundu, bunları tekrar etme; farklı bir şey üret: ',
  },
  es: {
    system: 'Eres un juego de alquimia. El jugador te da dos palabras. Devuelves una palabra nueva nacida de su combinación lógica, con un emoji adecuado.',
    format: 'REGLA DE SALIDA: Devuelve SOLO una línea de JSON válido, nada más. Esquema: {"name":"<una o como máximo dos palabras en ESPAÑOL>","emoji":"<un solo emoji>"}. Escribe el nombre con mayúscula inicial. El resultado DEBE ser distinto de ambas entradas; nunca repitas una entrada. Si se da DOS VECES la misma palabra, devuelve un NIVEL SUPERIOR de ella (Playa + Playa = Costa, Barro + Barro = Pantano, Piedra + Piedra = Roca). CONCRECIÓN: el resultado debe ser algo concreto que puedas señalar — objeto, criatura, lugar, material, comida, vehículo, edificio, oficio o suceso. Nunca abstracto. PALABRAS PROHIBIDAS: cósmico, universal, infinito, dimensión, esencia, alma, eco, núcleo, absoluto, divino, dios, omni, singularidad, conciencia, ser, trascendente, eterno, definitivo, ilimitado, cuántico. VARIEDAD: no te quedes siempre en el mismo tema. Sin explicación, bloque de código ni markdown. REGLA FAMILIAR: Este juego lo juegan todas las edades, incluidos niños. El resultado debe ser apropiado para un público joven: sin contenido sexual, sin drogas, alcohol ni tabaco, sin violencia, sangre, glorificación de armas, autolesiones, discurso de odio ni insultos. Si una combinación llevaría naturalmente a algo inapropiado, devuelve en su lugar un objeto inofensivo relacionado.',
    strict: 'TU INTENTO ANTERIOR FUE DEMASIADO ABSTRACTO. Da algo tangible y cotidiano: un animal, planta, herramienta, comida, vehículo, edificio, oficio o lugar geográfico. Los conceptos abstractos están terminantemente prohibidos.',
    known: 'Estos nombres ya existen, no los repitas; produce algo diferente: ',
  },
  pt: {
    system: 'Você é um jogo de alquimia. O jogador dá duas palavras. Você devolve uma palavra nova nascida da combinação lógica delas, com um emoji adequado.',
    format: 'REGRA DE SAÍDA: Devolva APENAS uma linha de JSON válido, nada mais. Esquema: {"name":"<uma ou no máximo duas palavras em PORTUGUÊS>","emoji":"<um único emoji>"}. Escreva o nome com inicial maiúscula. O resultado DEVE ser diferente das duas entradas; nunca repita uma entrada. Se a MESMA palavra for dada duas vezes, devolva um NÍVEL SUPERIOR dela (Praia + Praia = Litoral, Lama + Lama = Pântano, Pedra + Pedra = Rocha). CONCRETUDE: o resultado deve ser algo concreto que você possa apontar — objeto, criatura, lugar, material, comida, veículo, construção, profissão ou evento. Nunca abstrato. PALAVRAS PROIBIDAS: cósmico, universal, infinito, dimensão, essência, alma, eco, núcleo, absoluto, divino, deus, omni, singularidade, consciência, ser, transcendente, eterno, definitivo, ilimitado, quântico. VARIEDADE: não fique sempre no mesmo tema. Sem explicação, bloco de código ou markdown. REGRA PARA TODAS AS IDADES: Este jogo é jogado por todas as idades, incluindo crianças. O resultado deve ser adequado a um público jovem: sem conteúdo sexual, sem drogas, álcool ou tabaco, sem violência, sangue, glorificação de armas, automutilação, discurso de ódio ou insultos. Se uma combinação levaria naturalmente a algo inapropriado, devolva um objeto inofensivo relacionado.',
    strict: 'SUA TENTATIVA ANTERIOR FOI ABSTRATA DEMAIS. Dê algo tangível e cotidiano: um animal, planta, ferramenta, comida, veículo, construção, profissão ou lugar geográfico. Conceitos abstratos são terminantemente proibidos.',
    known: 'Estes nomes já existem, não os repita; produza algo diferente: ',
  },
};

/* ============================================================================
 * NADİRLİK KADEMELERİ
 * ----------------------------------------------------------------------------
 *  `tier` = elementin keşif derinliği (kaç birleştirme sonunda ortaya çıktı).
 *  Şimdiye kadar hesaplanıp kaydediliyor ama HİÇ GÖSTERİLMİYORDU; oyuncu
 *  açısından 100 kolay element ile 100 zor element aynı şeydi.
 *  Artık derinlik hem kartın çerçeve rengiyle görünüyor hem de skora yansıyor.
 * ==========================================================================*/
/* Nadirlik ekseni SOĞUK → SICAK tırmanır (bkz. PALETTE notu):
 * nötr soğuk → camgöbeği → yeşil → menekşe → ALTIN/TURUNCU.
 * En nadir kademe kompozisyondaki en sıcak ve en doygun renktir. */
const RARITY = [
  { renk: 0x93a3e0, cerceve: 0x5f6dc4, esik: 0,  puan: 1 },
  { renk: 0x2ee0ff, cerceve: 0x12a6dc, esik: 1,  puan: 2 },
  { renk: 0x2dffa6, cerceve: 0x0fc47c, esik: 3,  puan: 4 },
  { renk: 0xc96bff, cerceve: 0x8f28ee, esik: 6,  puan: 8 },
  { renk: 0xffc43a, cerceve: 0xff8400, esik: 10, puan: 16 },
];
/** Nadirlik adı aktif dilde ('r0'..'r4' anahtarları). */
function rarityName(tier) { return t('r' + rarityIndex(tier)); }

/** tier → RARITY dizinindeki indeks (0..4). */
function rarityIndex(tier) {
  const t = tier | 0;
  let i = 0;
  for (let k = 0; k < RARITY.length; k++) if (t >= RARITY[k].esik) i = k;
  return i;
}
function rarityOf(tier) { return RARITY[rarityIndex(tier)]; }

/* ============================================================================
 * İÇERİK GÜVENLİĞİ
 * ----------------------------------------------------------------------------
 *  Oyun, yapay zekânın ürettiği kelimeleri DOĞRUDAN ekrana basıyor. Playables
 *  geniş bir kitleye (çocuklar dahil) açık olduğu için bu, denetimsiz
 *  bırakılamaz. Üç katmanlı savunma:
 *    1) Prompt — her dilde "aile dostu" şartı (bkz. AI_LANG)
 *    2) Sağlayıcı — Gemini kendi güvenlik filtrelerini uygular
 *    3) İSTEMCİ — aşağıdaki liste (bu katman)
 *
 *  Bu liste kapsamlı bir küfür sözlüğü DEĞİL; amacı en olası kategorileri
 *  (cinsellik, uyuşturucu, silah/şiddet yüceltmesi, alkol) yakalamak.
 *  Kelime bazında ve dört dilde eşleşir. Yakalanan sonuç reddedilir ve model
 *  daha sıkı bir promptla tekrar denenir; ısrar ederse çevrimdışı motor devreye
 *  girer — yani oyuncu asla uygunsuz bir kart görmez.
 * ==========================================================================*/
const UYGUNSUZ_KELIMELER = [
  /* cinsellik */
  'seks', 'sex', 'sexo', 'porno', 'porn', 'erotik', 'erotic', 'erótico',
  'çıplak', 'naked', 'nude', 'desnudo', 'nu', 'fahişe', 'prostitute',
  'prostituta', 'genelev', 'brothel', 'burdel', 'bordel',
  /* uyuşturucu & alkol */
  'esrar', 'eroin', 'kokain', 'cocaine', 'heroin', 'heroína', 'cocaína',
  'meth', 'metanfetamina', 'uyuşturucu', 'drug', 'droga', 'esrarkeş',
  'içki', 'alkol', 'alcohol', 'álcool', 'votka', 'vodka', 'viski', 'whisky',
  'bira', 'beer', 'cerveza', 'cerveja', 'şarap', 'wine', 'vino', 'vinho',
  'sigara', 'cigarette', 'cigarrillo', 'cigarro',
  /* şiddet & silah yüceltmesi */
  'cinayet', 'murder', 'asesinato', 'assassinato', 'katil', 'killer',
  'asesino', 'assassino', 'tecavüz', 'rape', 'violación', 'estupro',
  'işkence', 'torture', 'tortura', 'intihar', 'suicide', 'suicidio',
  'suicídio', 'ceset', 'corpse', 'cadáver', 'kan', 'gore', 'katliam',
  'massacre', 'masacre', 'soykırım', 'genocide', 'genocidio',
  /* nefret & hakaret kategorisi */
  'ırkçı', 'racist', 'racista', 'nazi', 'faşist', 'fascist', 'fascista',
];

/** İsimde uygunsuz kelime var mı? (kelime bazında, dört dil) */
function uygunsuzMu(name) {
  const kelimeler = normKey(name).split(/[\s'-]+/);
  return kelimeler.some((k) => UYGUNSUZ_KELIMELER.indexOf(k) !== -1);
}

/* --- Anlamsal kaçış filtresi ----------------------------------------------
 * LLM'lerin simya oyunlarındaki klasik çöküş biçimi: girdi soyutlaştıkça çıktı
 * daha da soyutlaşır ve 40. hamlede her şey "Kozmik Evrensel Öz" bulamacına
 * döner. Ölçümde son 20 keşfin 14'ü 🌌 emojili soyut kavramdı.
 * Bu liste, sonucu istemcide reddedip modeli somuta zorlamak için kullanılır.
 * ------------------------------------------------------------------------ */
const BULAMAC_KELIMELER = [
  'kozmik', 'evrensel', 'evren', 'sonsuz', 'sonsuzluk', 'boyut', 'öz', 'özü',
  'ruh', 'ruhu', 'yankı', 'yankısı', 'çekirdek', 'çekirdeği', 'mutlak', 'ilahi',
  'tanrı', 'tanrısı', 'omni', 'tekillik', 'bilinç', 'bilinci', 'varlık',
  'varlığı', 'oluşum', 'aşkın', 'ebedi', 'ezeli', 'nihai', 'sınırsız',
  'kuantum', 'esans', 'töz', 'ilke', 'kavram',
];

/** İsim soyut bulamaç mı? (kelime bazında, normalize edilmiş) */
function bulamacMi(name) {
  const kelimeler = normKey(name).split(/\s+/);
  return kelimeler.some((k) => BULAMAC_KELIMELER.includes(k));
}

/* Küçük yardımcılar ------------------------------------------------------- */
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/** Türkçe'ye duyarlı normalizasyon: "ATEŞ" ile "ateş" aynı anahtar olsun. */
function normKey(s) {
  return String(s || '').trim().toLocaleLowerCase('tr-TR').replace(/\s+/g, ' ');
}
/** İki elementin sırasından bağımsız birleşim anahtarı: "ateş+su". */
function pairKey(a, b) {
  return [normKey(a), normKey(b)].sort().join('+');
}
/** Türkçe baş harf büyütme. */
function titleCase(s) {
  return String(s || '')
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toLocaleUpperCase('tr-TR') + w.slice(1).toLocaleLowerCase('tr-TR'))
    .join(' ');
}
/** Deterministik hash — aynı girdi her zaman aynı çıktıyı versin diye. */
function hash32(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/* ============================================================================
 * [2] YT — YouTube Playables SDK ADAPTÖRÜ
 * ----------------------------------------------------------------------------
 *  Oyun kodunun hiçbir yeri `ytgame` global'ine DOĞRUDAN dokunmaz; her şey bu
 *  adaptörden geçer. Üç faydası var:
 *    1) Yerel tarayıcıda (SDK yokken) oyun localStorage ile sorunsuz çalışır.
 *    2) SDK'nın sürüm farkları / eksik alanları tek yerde savunmacı sarılır.
 *    3) Sertifikasyon kurallarını (ses, pause, rate-limit) merkezî uygularız.
 * ==========================================================================*/
const YT = (function createYouTubeAdapter() {
  const sdk = (typeof window !== 'undefined' && window.ytgame) ? window.ytgame : null;
  /** Gerçekten YouTube iframe'i içinde miyiz? */
  const LIVE = !!(sdk && sdk.IN_PLAYABLES_ENV === true);

  const DEV_SAVE_KEY = 'omnimerge.devsave.v1';

  const safe = (fn, fallback) => {
    try { return fn(); } catch (e) { console.warn('[YT] çağrı hatası:', e); return fallback; }
  };

  /* --- Sağlık telemetrisi: YouTube panelinde hata oranını görürsünüz ------ */
  function logError(msg) {
    console.error('[OmniMerge]', msg);
    if (!LIVE || !sdk.health) return;
    // SDK sürümüne göre imza argümanlı ya da argümansız olabilir.
    try { sdk.health.logError(String(msg)); }
    catch (_) { try { sdk.health.logError(); } catch (__) {} }
  }
  function logWarning(msg) {
    console.warn('[OmniMerge]', msg);
    if (!LIVE || !sdk.health) return;
    try { sdk.health.logWarning(String(msg)); }
    catch (_) { try { sdk.health.logWarning(); } catch (__) {} }
  }

  /* --- Yaşam döngüsü ------------------------------------------------------
   * firstFrameReady(): ilk kare boyandığı anda çağrılmalı. YouTube bunu
   *   "yükleme spinner'ını kaldır" sinyali olarak kullanır.
   * gameReady(): oyun oynanabilir hale geldiğinde çağrılmalı. Bu çağrı
   *   yapılmadan reklam/veri API'leri güvenilir çalışmaz ve sertifikasyon
   *   testi düşer.
   * -------------------------------------------------------------------- */
  let _firstFrameSent = false;
  let _gameReadySent  = false;

  function firstFrameReady() {
    if (_firstFrameSent) return;
    _firstFrameSent = true;
    if (LIVE && sdk.game) safe(() => sdk.game.firstFrameReady());
    console.info('[YT] firstFrameReady');
  }
  function gameReady() {
    if (_gameReadySent) return;
    _gameReadySent = true;
    if (LIVE && sdk.game) safe(() => sdk.game.gameReady());
    console.info('[YT] gameReady');
  }

  /* --- SES ----------------------------------------------------------------
   * SERTİFİKASYON KURALI: Oyuncu YouTube arayüzündeki hoparlör düğmesiyle sesi
   * kapattığında oyun ANINDA susmalıdır. Oyunun kendi ses ayarı bunu EZEMEZ.
   * Başlangıç değeri de mutlaka isAudioEnabled()'dan okunmalıdır (varsayılan
   * "açık" kabul edilemez).
   * -------------------------------------------------------------------- */
  function isAudioEnabled() {
    if (LIVE && sdk.system && typeof sdk.system.isAudioEnabled === 'function') {
      return safe(() => sdk.system.isAudioEnabled() !== false, true);
    }
    return true;
  }
  function onAudioEnabledChange(cb) {
    if (LIVE && sdk.system && typeof sdk.system.onAudioEnabledChange === 'function') {
      return safe(() => sdk.system.onAudioEnabledChange(cb), () => {});
    }
    return () => {};
  }

  /* --- PAUSE / RESUME -----------------------------------------------------
   * SERTİFİKASYON KURALI: Oyuncu Shorts akışında kaydırdığında ya da sekme
   * arkaya düştüğünde onPause tetiklenir. O anda:
   *   · tüm sesler susmalı,
   *   · oyun döngüsü (fizik/tween/timer) durmalı,
   *   · CPU kullanımı düşmeli (pil ömrü kriteri).
   * Biz ayrıca uçuştaki AI yanıtlarını da kuyruğa alıp resume'da işliyoruz —
   * böylece oyuncu geri döndüğünde kartlar "geçmişte kalmış" gibi patlamıyor.
   * -------------------------------------------------------------------- */
  function onPause(cb) {
    if (LIVE && sdk.system && typeof sdk.system.onPause === 'function') {
      return safe(() => sdk.system.onPause(cb), () => {});
    }
    // Dev ortamı: sekme görünürlüğünü taklit et.
    const h = () => { if (document.hidden) cb(); };
    document.addEventListener('visibilitychange', h);
    return () => document.removeEventListener('visibilitychange', h);
  }
  function onResume(cb) {
    if (LIVE && sdk.system && typeof sdk.system.onResume === 'function') {
      return safe(() => sdk.system.onResume(cb), () => {});
    }
    const h = () => { if (!document.hidden) cb(); };
    document.addEventListener('visibilitychange', h);
    return () => document.removeEventListener('visibilitychange', h);
  }

  /* --- BULUT KAYIT --------------------------------------------------------
   * saveData(string) / loadData() -> Promise<string>
   * Veri YouTube hesabına bağlıdır; oyuncu telefondan TV'ye geçtiğinde
   * kütüphanesi onunla gelir. Payload'ı küçük tutun (platform boyut sınırı
   * uygular) — bu yüzden tarif sayısını TUNING.maxStoredRecipes ile kırpıyoruz.
   * -------------------------------------------------------------------- */
  function loadData() {
    if (LIVE && sdk.game && typeof sdk.game.loadData === 'function') {
      return Promise.resolve()
        .then(() => sdk.game.loadData())
        .catch((e) => { logWarning('loadData başarısız: ' + e); return ''; });
    }
    try { return Promise.resolve(localStorage.getItem(DEV_SAVE_KEY) || ''); }
    catch (_) { return Promise.resolve(''); }
  }
  function saveData(str) {
    if (LIVE && sdk.game && typeof sdk.game.saveData === 'function') {
      return Promise.resolve()
        .then(() => sdk.game.saveData(str))
        .catch((e) => { logWarning('saveData başarısız: ' + e); });
    }
    try { localStorage.setItem(DEV_SAVE_KEY, str); } catch (_) {}
    return Promise.resolve();
  }

  /* --- LİDERLİK TABLOSU ---------------------------------------------------
   * engagement.sendScore({ value }) — YouTube bunu Playables leaderboard'unda
   * ve arkadaş karşılaştırmasında kullanır. Rate-limit'lidir; SaveManager
   * içinde throttle ediyoruz.
   * -------------------------------------------------------------------- */
  function sendScore(value) {
    const v = Math.max(0, Math.floor(value || 0));
    if (LIVE && sdk.engagement && typeof sdk.engagement.sendScore === 'function') {
      return Promise.resolve()
        .then(() => sdk.engagement.sendScore({ value: v }))
        .catch((e) => { logWarning('sendScore başarısız: ' + e); });
    }
    console.info('[YT] (dev) sendScore →', v);
    return Promise.resolve();
  }

  /* --- REKLAMLAR ----------------------------------------------------------
   * !!! HARİCİ REKLAM AĞI (AdMob, Unity Ads, ironSource...) YASAK !!!
   * Playables'ta gelir paylaşımı yalnızca YouTube'un kendi ads API'siyle olur.
   *
   * requestInterstitialAd(): sadece DOĞAL duraklamalarda çağrılabilir
   *   (bölüm sonu, seviye geçişi...). Oyun ortasında çağırmak sertifikasyonu
   *   düşürür. Çağırmadan önce oyunu duraklatıp sesi kısmak ZORUNLUDUR.
   *
   * requestRewardedAd(callback): callback yalnızca oyuncu reklamı SONUNA kadar
   *   izlerse çalışır — ödülü SADECE orada verin. Promise'in resolve olması
   *   "ödül hak edildi" demek DEĞİLDİR (reklam atlanmış da olabilir).
   *   `placementId` bizim kendi telemetrimiz için etikettir ('hint-reward').
   * -------------------------------------------------------------------- */
  function adsAvailable() {
    return !!(LIVE && sdk.ads);
  }

  function requestInterstitialAd() {
    if (!adsAvailable()) {
      console.info('[YT] (dev) interstitial atlandı');
      return Promise.resolve({ shown: false, dev: true });
    }
    return Promise.resolve()
      .then(() => sdk.ads.requestInterstitialAd())
      .then(() => ({ shown: true }))
      .catch((e) => { logWarning('interstitial reddedildi: ' + e); return { shown: false, error: e }; });
  }

  function requestRewardedAd(placementId, onReward) {
    if (!adsAvailable()) {
      // Dev ortamında ödülü doğrudan ver ki akışı test edebilelim.
      console.info('[YT] (dev) rewarded ödülü otomatik verildi:', placementId);
      try { onReward(); } catch (e) { logError(e); }
      return Promise.resolve({ granted: true, dev: true });
    }
    let granted = false;
    return Promise.resolve()
      .then(() => sdk.ads.requestRewardedAd(function adBreakDone() {
        // Reklam sonuna kadar izlendi → ödülü SADECE burada ver.
        granted = true;
        try { onReward(); } catch (e) { logError(e); }
      }))
      .then(() => ({ granted }))
      .catch((e) => { logWarning('rewarded reddedildi (' + placementId + '): ' + e); return { granted, error: e }; });
  }

  function getLanguage() {
    if (LIVE && sdk.system && typeof sdk.system.getLanguage === 'function') {
      return safe(() => sdk.system.getLanguage(), 'tr');
    }
    return (navigator.language || 'tr').slice(0, 2);
  }

  return {
    LIVE, sdk,
    firstFrameReady, gameReady,
    isAudioEnabled, onAudioEnabledChange,
    onPause, onResume,
    loadData, saveData, sendScore,
    requestInterstitialAd, requestRewardedAd, adsAvailable,
    getLanguage, logError, logWarning,
  };
})();

/* ============================================================================
 * [3] GameState — tek kaynaklı durum + event bus
 * ==========================================================================*/
const GameState = {
  /** normKey(name) -> { name, emoji, tier, isBase, isNew } */
  discovered: new Map(),
  /** "ateş+su" -> normKey(sonuç adı)  (AI cevaplarının kalıcı cache'i) */
  recipes: new Map(),

  score: 0,
  hintsUsed: 0,
  mergesDone: 0,
  discoveriesSinceAd: 0,

  /* GÜNLÜK HEDEF — "yarın neden dönmeliyim?" sorusunun cevabı.
   * Playables tekrar oturumlarla yaşar ama oyunda dönmek için hiçbir sebep
   * yoktu. Günde N yeni keşif tamamlayan oyuncu REKLAMSIZ bir ipucu kazanır:
   * gerçek bir değer, üstelik reklam gelirini de düşürmez (zaten izlemeyecek
   * oyuncuyu geri getirir). */
  essence: 0,         // Öz — mağaza para birimi
  charmLeft: 0,       // kalan tılsımlı birleştirme
  pouchAt: 0,         // son bedava Öz kesesi zamanı (ms)

  dailyDay: 0,        // gün numarası (epoch/86400000)
  dailyCount: 0,      // bugünkü yeni keşif sayısı
  freeHints: 0,       // kazanılmış reklamsız ipucu

  audioEnabled: true,
  /** YouTube onPause ile gelen sistem duraklaması. */
  systemPaused: false,
  /** Reklam / modal gibi oyun-içi duraklamalar. */
  uiBlocked: false,

  bus: null,   // Phaser.Events.EventEmitter — boot'ta atanır

  isFrozen() { return this.systemPaused || this.uiBlocked; },

  has(name) { return this.discovered.has(normKey(name)); },
  get(name) { return this.discovered.get(normKey(name)); },

  /** Yeni element ekler. Zaten varsa false döner (skor artmaz). */
  add(name, emoji, tier, id) {
    const k = normKey(name);
    if (!k) return false;
    if (this.discovered.has(k)) return false;
    this.discovered.set(k, {
      name: titleCase(name),
      emoji: emoji || '✨',
      tier: tier || 0,
      id: id || null,        // dil-bağımsız kimlik (varsa) → dil değişince yeniden adlandırılır
      isBase: false,
      isNew: true,
    });
    this.score = this.discovered.size;
    this.discoveriesSinceAd++;
    this.gunKontrol();
    this.dailyCount++;
    return true;
  },

  list() { return Array.from(this.discovered.values()); },

  /** Bugünün gün numarası (yerel saat dilimine göre). */
  bugun() {
    const d = new Date();
    return Math.floor((d - d.getTimezoneOffset() * 60000) / 86400000);
  },

  /** Gün değiştiyse günlük sayacı sıfırla. Her keşifte ve açılışta çağrılır. */
  gunKontrol() {
    const g = this.bugun();
    if (this.dailyDay !== g) { this.dailyDay = g; this.dailyCount = 0; return true; }
    return false;
  },

  /* Liderlik tablosu puanı = keşif SAYISI değil, DERİNLİK AĞIRLIKLI toplam.
   * "Kolay 100 element" ile "zor 100 element" böylece ayrışır. */
  leaderboardScore() {
    let toplam = 0;
    this.discovered.forEach((e) => { toplam += rarityOf(e.tier).puan; });
    return toplam;
  },
};

/* ----------------------------------------------------------------------------
 * setLanguage — dili değiştirir ve TÜM içeriği yeniden adlandırır.
 * ----------------------------------------------------------------------------
 *  Kimliği olan elementler (temel 6 + 94 tarifin sonuçları) yeni dilde yeniden
 *  adlandırılır. Yapay zekânın ürettiği elementler kimliksizdir ve keşfedildikleri
 *  dilde kalır — bunları çevirmek yeni bir AI çağrısı gerektirirdi ve oyuncunun
 *  kütüphanesini sessizce değiştirmek dürüst olmazdı.
 *  Elementler yerinde (in-place) güncellendiği için tahtadaki kartlar aynı
 *  nesneye baktığından otomatik olarak yeni adı alır.
 * --------------------------------------------------------------------------*/
function setLanguage(kod) {
  if (LANG_IDX[kod] === undefined || kod === LANG) return false;
  LANG = kod;

  // 1) Kimliği olan elementleri yeniden adlandır ve haritayı yeni anahtarlarla kur
  const yeni = new Map();
  GameState.discovered.forEach((e) => {
    if (e.id && ELEMENTS[e.id]) { e.name = elemName(e.id); e.emoji = elemEmoji(e.id); }
    yeni.set(normKey(e.name), e);
  });
  GameState.discovered = yeni;
  GameState.score = yeni.size;

  // 2) Tarif önbelleği ad tabanlı olduğu için temizlenir; tablo zaten anında
  //    cevap veriyor, AI sonuçları da yeni dilde yeniden üretilecek.
  GameState.recipes.clear();

  // 3) Elle yazılmış tabloyu yeni dilde kur
  Alchemy.rebuild();

  SaveManager.requestSave();
  return true;
}

/* ============================================================================
 * [4] SaveManager — bulut kaydı + skor gönderimi
 * ----------------------------------------------------------------------------
 *  · Kayıt yazımı debounce'lu: her keşifte ağa yazmak yerine 1.2 sn toplar.
 *  · onPause geldiğinde ANINDA flush eder (oyuncu geri dönmeyebilir).
 *  · sendScore throttle'lı: platform rate-limit'ine takılmamak için.
 * ==========================================================================*/
const SaveManager = {
  _saveTimer: null,
  _lastScoreSentAt: 0,
  _lastScoreValue: -1,
  _scoreTimer: null,

  serialize() {
    // Kayıt boyutunu sınırla: en yeni tarifleri tut.
    const recipeEntries = Array.from(this._trimmedRecipes());
    return JSON.stringify({
      v: 2,
      s: GameState.score,
      h: GameState.hintsUsed,
      m: GameState.mergesDone,
      a: GameState.discoveriesSinceAd,
      lang: LANG,
      dd: GameState.dailyDay, dc: GameState.dailyCount, fh: GameState.freeHints,
      oz: GameState.essence, cl: GameState.charmLeft,
      // d: keşfedilen elementler [ad, emoji, tier, id]
      // id varsa dil değiştiğinde ad yeniden üretilir; AI elementlerinde id yoktur.
      d: GameState.list()
        .filter((e) => !e.isBase)
        .map((e) => [e.name, e.emoji, e.tier | 0, e.id || '']),
      // r: tarif cache'i { "ateş+su": "buhar" }
      r: Object.fromEntries(recipeEntries),
    });
  },

  /** Kayıt payload'ını sınırlamak için en yeni tarifleri döndürür. */
  _trimmedRecipes() {
    const all = Array.from(GameState.recipes.entries());
    if (all.length <= TUNING.maxStoredRecipes) return all;
    return all.slice(all.length - TUNING.maxStoredRecipes);
  },

  deserialize(raw) {
    // Temel elementler her zaman mevcut olmalı.
    GameState.discovered.clear();
    for (const id of BASE_IDS) {
      const ad = elemName(id);
      GameState.discovered.set(normKey(ad), {
        name: ad, emoji: elemEmoji(id), tier: 0, id, isBase: true, isNew: false,
      });
    }
    GameState.recipes.clear();

    if (!raw) { GameState.score = GameState.discovered.size; return false; }

    let data;
    try { data = JSON.parse(raw); }
    catch (e) { YT.logWarning('Kayıt bozuk, sıfırdan başlanıyor.'); data = null; }
    if (!data || typeof data !== 'object') {
      GameState.score = GameState.discovered.size;
      return false;
    }

    if (Array.isArray(data.d)) {
      for (const row of data.d) {
        if (!Array.isArray(row) || !row[0]) continue;
        const k0 = normKey(row[0]);
        if (GameState.discovered.has(k0)) continue;
        const id = row[3] || null;
        // Kimliği olan element AKTİF DİLDE adlandırılır (kayıt başka dilde yapılmış olabilir)
        const ad = id && ELEMENTS[id] ? elemName(id) : titleCase(row[0]);
        GameState.discovered.set(normKey(ad), {
          name: ad, emoji: id && ELEMENTS[id] ? elemEmoji(id) : (row[1] || '✨'),
          tier: row[2] | 0, id, isBase: false, isNew: false,
        });
      }
    }
    if (data.r && typeof data.r === 'object') {
      for (const [k, v] of Object.entries(data.r)) {
        if (typeof v === 'string') GameState.recipes.set(k, v);
      }
    }

    GameState.essence = data.oz | 0;
    GameState.charmLeft = data.cl | 0;
    GameState.dailyDay = data.dd | 0;
    GameState.dailyCount = data.dc | 0;
    GameState.freeHints = data.fh | 0;
    GameState.gunKontrol();          // yeni günse sayaç sıfırlanır
    GameState.hintsUsed = data.h | 0;
    GameState.mergesDone = data.m | 0;
    GameState.discoveriesSinceAd = data.a | 0;
    GameState.score = GameState.discovered.size;
    return true;
  },

  /** Debounce'lu kayıt. */
  requestSave() {
    if (this._saveTimer) clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => { this.flush(); }, TUNING.saveDebounceMs);
  },

  /** Platformun kabul ettiği üst sınır için güvenli tavan (bayt). */
  MAX_BYTES: 240 * 1024,

  /** Anında yaz (onPause / kritik anlar için). */
  flush() {
    if (this._saveTimer) { clearTimeout(this._saveTimer); this._saveTimer = null; }
    let payload = this.serialize();

    /* BOYUT KORUMASI
     * Platformun saveData sınırı belgelenmiş bir değer değil ve aşıldığında
     * yazma SESSİZCE başarısız olabilir — oyuncu yüzlerce keşfini kaybeder.
     * Bu yüzden kendi tavanımızı koyuyoruz: aşılırsa önce tarif önbelleğini
     * (yeniden üretilebilir veri), sonra en eski keşifleri kırpıyoruz.
     * Keşifler her zaman tariflerden önce korunur. */
    if (payload.length > this.MAX_BYTES) {
      const oncekiTarif = GameState.recipes.size;
      const yeni = new Map(Array.from(GameState.recipes.entries()).slice(-200));
      GameState.recipes = yeni;
      payload = this.serialize();
      YT.logWarning('Kayıt boyutu aşıldı; tarif önbelleği ' + oncekiTarif +
                    ' → ' + yeni.size + ' kırpıldı (' + payload.length + ' bayt)');
    }
    if (payload.length > this.MAX_BYTES) {
      YT.logError('Kayıt hâlâ sınır üstü: ' + payload.length + ' bayt');
    }
    return YT.saveData(payload);
  },

  /** Throttle'lı liderlik tablosu gönderimi. */
  pushScore() {
    const v = GameState.leaderboardScore();
    if (v === this._lastScoreValue) return;
    const dt = Date.now() - this._lastScoreSentAt;
    const send = () => {
      this._lastScoreSentAt = Date.now();
      this._lastScoreValue = GameState.leaderboardScore();
      this._scoreTimer = null;
      YT.sendScore(this._lastScoreValue);
    };
    if (dt >= TUNING.scoreThrottleMs) { send(); return; }
    if (this._scoreTimer) return;         // zaten kuyrukta
    this._scoreTimer = setTimeout(send, TUNING.scoreThrottleMs - dt);
  },
};

/* ============================================================================
 * [5] Alchemy — ÇEVRİMDIŞI YEDEK MOTOR
 * ----------------------------------------------------------------------------
 *  Neden var? Playables sandbox'ı ağı engelleyebilir, API yavaşlayabilir ya da
 *  oyuncunun bağlantısı kopabilir. Bir birleştirme oyununda "hiçbir şey olmadı"
 *  ekranı en kötü deneyimdir. Bu motor iki katman sunar:
 *    a) Elle yazılmış klasik simya tarifleri (kaliteli, tanıdık sonuçlar)
 *    b) Deterministik sentez (hash tabanlı) — tablo boşsa bile SONSUZ oyun.
 *  Deterministik olması kritik: aynı ikili her zaman aynı sonucu verir, yani
 *  çevrimdışı üretilen sonuç sonra AI ile çelişmez ve kayıt tutarlı kalır.
 * ==========================================================================*/
const Alchemy = (function buildAlchemy() {
  /* Tarifler DİLDEN BAĞIMSIZ kimliklerle yazılır; tablo aktif dile göre
   * kurulur. Dil değiştiğinde rebuild() ile yeniden adlandırılır. */
  const RECIPES = [];
  const table = new Map();
  const R = (a, b, r) => RECIPES.push([a, b, r]);

  function rebuild() {
    table.clear();
    RECIPES.forEach(([a, b, r]) => {
      table.set(pairKey(elemName(a), elemName(b)),
                { id: r, name: elemName(r), emoji: elemEmoji(r) });
    });
  }

  /* --- 1. kuşak ------------------------------------------------------- */
  R('water', 'fire', 'steam');
  R('water', 'earth', 'mud');
  R('water', 'air', 'fog');
  R('fire', 'earth', 'lava');
  R('fire', 'air', 'energy');
  R('earth', 'air', 'dust');
  R('water', 'water', 'sea');
  R('fire', 'fire', 'sun');
  R('earth', 'earth', 'mountain');
  R('air', 'air', 'wind');

  /* --- 2. kuşak ------------------------------------------------------- */
  R('lava', 'water', 'stone');
  R('lava', 'air', 'basalt');
  R('mud', 'fire', 'brick');
  R('sea', 'earth', 'sand');
  R('sand', 'fire', 'glass');
  R('stone', 'fire', 'metal');
  R('sea', 'sun', 'salt');
  R('earth', 'sun', 'plant');
  R('mountain', 'fire', 'volcano');
  R('wind', 'water', 'wave');
  R('steam', 'earth', 'geyser');
  R('fog', 'sun', 'rainbow');
  R('dust', 'water', 'clay');

  /* --- 3. kuşak ------------------------------------------------------- */
  R('plant', 'water', 'tree');
  R('tree', 'fire', 'coal');
  R('plant', 'mountain', 'forest');
  R('mud', 'plant', 'swamp');
  R('metal', 'fire', 'sword');
  R('glass', 'sand', 'hourglass');
  R('metal', 'energy', 'electricity');
  R('brick', 'brick', 'wall');

  /* --- BETON ----------------------------------------------------------- */
  R('concrete', 'water', 'mortar');
  R('concrete', 'fire', 'lime');
  R('concrete', 'earth', 'foundation');
  R('concrete', 'air', 'cementdust');
  R('concrete', 'concrete', 'building');
  R('concrete', 'metal', 'skyscraper');
  R('concrete', 'sand', 'plaster');
  R('concrete', 'energy', 'dam');
  R('concrete', 'building', 'city');
  R('concrete', 'human', 'builder');

  /* --- TEKNOLOJİ -------------------------------------------------------- */
  R('tech', 'water', 'hydro');
  R('tech', 'fire', 'engine');
  R('tech', 'earth', 'tractor');
  R('tech', 'air', 'drone');
  R('tech', 'tech', 'internet');
  R('tech', 'metal', 'robot');
  R('tech', 'energy', 'computer');
  R('tech', 'glass', 'screen');
  R('tech', 'sun', 'solarpanel');
  R('tech', 'concrete', 'smartcity');
  R('tech', 'plant', 'greenhouse');
  R('tech', 'life', 'biotech');


  /* ═══ GENİŞLETME: 74 yeni tarif ═══════════════════════════════════════
   * Elle yazılmış tarifler 0 ms'de cevap veriyor ve AI'dan daha tutarlı.
   * 94 tarif ilk oturumda çabuk tükeniyordu; yeni dallar açıyoruz:
   * buz/kar, tarım & yemek, demiryolu & ulaşım, uzay. */

  /* --- soğuk dalı --- */
  R('water', 'wind', 'ice');        R('ice', 'wind', 'snow');
  R('snow', 'mountain', 'glacier'); R('ice', 'sun', 'water');
  R('snow', 'snow', 'glacier');     R('glacier', 'sun', 'river');
  R('ice', 'ice', 'glacier');

  /* --- su yolları --- */
  R('mountain', 'rain', 'river');   R('river', 'earth', 'lake');
  R('river', 'sea', 'wetland');     R('lake', 'lake', 'sea');
  R('sea', 'earth', 'island');      R('island', 'plant', 'jungle');
  R('river', 'concrete', 'bridge'); R('bridge', 'metal', 'rail');

  /* --- tarım & yemek --- */
  R('plant', 'sun', 'wheat');       R('wheat', 'human', 'farmer');
  R('farmer', 'earth', 'farm');     R('wheat', 'stone', 'bread');
  R('bread', 'fire', 'bread');      R('farm', 'water', 'greenhouse');
  R('fish', 'human', 'fisherman');  R('fisherman', 'ship', 'ship');
  R('wheat', 'wheat', 'farm');      R('farm', 'tech', 'tractor');

  /* --- metal & yapı --- */
  R('metal', 'coal', 'steel');      R('steel', 'concrete', 'skyscraper');
  R('steel', 'fire', 'sword');      R('stone', 'tool', 'statue');
  R('statue', 'city', 'metropolis');R('human', 'building', 'home');
  R('home', 'home', 'city');        R('city', 'human', 'crowd');
  R('crowd', 'crowd', 'metropolis');R('steel', 'steel', 'alloy');

  /* --- ateş & kalıntı --- */
  R('forest', 'fire', 'ash');       R('ash', 'water', 'clay');
  R('ash', 'wind', 'dust');         R('coal', 'coal', 'ash');
  R('volcano', 'ash', 'ash');       R('ash', 'earth', 'clay');

  /* --- buhar çağı --- */
  R('steam', 'metal', 'steamengine');  R('steamengine', 'rail', 'train');
  R('rail', 'rail', 'road');           R('road', 'metal', 'car');
  R('car', 'tech', 'drone');           R('train', 'train', 'rail');
  R('steamengine', 'ship', 'ship');    R('road', 'city', 'metropolis');
  R('bridge', 'bridge', 'road');

  /* --- elektrik & cihaz --- */
  R('electricity', 'glass', 'lamp');   R('electricity', 'metal', 'battery');
  R('battery', 'tech', 'phone');       R('phone', 'internet', 'computer');
  R('lamp', 'lamp', 'city');           R('battery', 'sun', 'solarpanel');
  R('computer', 'computer', 'datacenter'); R('phone', 'phone', 'internet');

  /* --- uzay --- */
  R('metal', 'energy', 'rocket');      R('rocket', 'tech', 'satellite');
  R('satellite', 'internet', 'cyberspace'); R('rocket', 'human', 'astronaut');
  R('astronaut', 'stone', 'moon');     R('sun', 'sun', 'star');
  R('star', 'star', 'supernova');      R('moon', 'sea', 'wave');
  R('rocket', 'rocket', 'rocket');     R('satellite', 'satellite', 'datacenter');
  R('air', 'metal', 'airplane');       R('airplane', 'tech', 'drone');
  R('airplane', 'airplane', 'airplane');

  /* --- kalan boşluklar --- */
  R('bird', 'metal', 'airplane');      R('life', 'sun', 'plant');
  R('human', 'tech', 'computer');      R('human', 'fire', 'coal');
  R('tool', 'metal', 'engine');        R('glass', 'sun', 'lamp');

  /* --- Aynı element x2 → ÜST KADEME -----------------------------------
   * Oyuncunun en sık denediği hamle budur; "Plaj + Plaj = Plaj" gibi bir
   * sonuç oyunu anlamsızlaştırır. Yaygın elementler için elle yazılmış
   * anlamlı yükseltmeler; tabloda olmayanlar TIER_PREFIX merdivenine düşer. */
  R('steam', 'steam', 'cloud');
  R('mud', 'mud', 'swamp');
  R('dust', 'dust', 'sandstorm');
  R('fog', 'fog', 'haze');
  R('lava', 'lava', 'magma');
  R('stone', 'stone', 'rock');
  R('sand', 'sand', 'desert');
  R('sea', 'sea', 'ocean');
  R('mountain', 'mountain', 'range');
  R('wind', 'wind', 'hurricane');
  R('sun', 'sun', 'supernova');
  R('plant', 'plant', 'bush');
  R('tree', 'tree', 'forest');
  R('metal', 'metal', 'alloy');
  R('glass', 'glass', 'mirror');
  R('energy', 'energy', 'storm');
  /* 2. tur aynı-element yükseltmeleri: "Bataklık + Bataklık = Dev Bataklık"
   * gibi tembel sonuçlar oluşmasın diye ikinci kuşak da elle yazıldı. */
  R('swamp', 'swamp', 'wetland');
  R('cloud', 'cloud', 'rain');
  R('rock', 'rock', 'cliff');
  R('forest', 'forest', 'jungle');
  R('ocean', 'ocean', 'deepsea');
  R('desert', 'desert', 'oasis');
  R('building', 'building', 'city');
  R('city', 'city', 'metropolis');
  R('internet', 'internet', 'cyberspace');
  R('robot', 'robot', 'robotarmy');
  R('magma', 'magma', 'core');
  R('hurricane', 'hurricane', 'superstorm');
  R('computer', 'computer', 'datacenter');

  /* --- 4. kuşak ve ötesi ---------------------------------------------- */
  R('swamp', 'energy', 'life');
  R('life', 'earth', 'human');
  R('human', 'stone', 'tool');
  R('human', 'life', 'family');
  R('human', 'metal', 'robot');
  R('robot', 'energy', 'ai');
  R('human', 'sea', 'ship');
  R('human', 'forest', 'hunter');
  R('life', 'sea', 'fish');
  R('life', 'air', 'bird');
  R('electricity', 'glass', 'screen');
  R('screen', 'ai', 'game');

  /* --- Sonsuzluk garantisi: tabloda yoksa deterministik üretim ----------
   * Eski sürümün iki ciddi hatası vardı:
   *   a) Emoji, isimle ALAKASIZ bir havuzdan hash ile seçiliyordu →
   *      "Attali 🌾", "Haistali 🩵" gibi isim-görsel uyumsuzlukları.
   *   b) Aynı element iki kez birleşince portmanto KELİMENİN KENDİSİNİ
   *      üretiyordu: "Plaj" → "Pl" + "aj" = "Plaj". Yani hiçbir şey olmuyordu.
   * Yeni kurallar:
   *   · Emoji DAİMA ebeveynden miras alınır → uyumsuzluk imkânsız.
   *   · Aynı element + aynı element → HER ZAMAN bir üst kademe.
   *   · Üretilen isim gerçek kelimelerden oluşur, uydurma hece yığını değil.
   * ------------------------------------------------------------------- */
  /* Çevrimdışı ekler SOMUT olmalı. Eski liste ('Özü', 'Ruhu', 'Yankısı',
   * 'Çekirdeği') tam da AI'ın kaçtığı soyut bulamacı besliyordu. */
  const sablonlar = () => SYNTH_TPL[LANG] || SYNTH_TPL.en;
  const merdiven  = () => LADDER_TPL[LANG] || LADDER_TPL.en;

  /* Aynı-element merdiveni.
   * Eski sürüm "Büyük/Dev/Devasa X" diyordu — sadece boyut sıfatı eklemek
   * anlamsızdı ("Dev Bataklık"). Artık NİCELİK/COĞRAFYA kelimeleri kullanıyoruz:
   *   Bataklık → Bataklık Yığını → Bataklık Diyarı → Bataklık İmparatorluğu
   *            → Efsanevi Bataklık → Ölümsüz Bataklık → Bataklık Çekirdeği
   * NOT: Bu yalnızca SON ÇARE'dir — AI çalışırken (tipik 0.6 sn) buraya
   * hiç düşülmez ve "Bataklık + Bataklık = Turba Yatağı" gibi gerçek
   * sonuçlar gelir. */
  /** Şablondan isim üret: '{n} Land' + 'Swamp' → 'Swamp Land' */
  const uygula = (tpl, n) => tpl.split('{n}').join(n);

  /** Bir isim merdivenin hangi basamağında? (-1 = henüz basamakta değil) */
  function basamak(name) {
    const m = merdiven();
    for (let i = 0; i < m.length; i++) {
      const bos = uygula(m[i], '');
      if (bos && name.indexOf(bos.trim()) !== -1) return i;
    }
    return -1;
  }

  function upgradeName(name) {
    const m = merdiven();
    const i = basamak(name);
    if (i === -1) return uygula(m[0], name);
    if (i + 1 < m.length) {
      // Bir üst basamağa geç: mevcut ekleri temizleyip yenisini uygula
      const taban = name.replace(uygula(m[i], '').trim(), '').replace(/\s+/g, ' ').trim();
      return uygula(m[i + 1], taban);
    }
    return name;   // merdivenin tepesi
  }

  function synthesize(aName, bName, aEmoji, bEmoji) {
    const h = hash32(pairKey(aName, bName));

    // ── Aynı element iki kez → daima ÜST KADEME, emoji aynen korunur
    if (normKey(aName) === normKey(bName)) {
      return { name: upgradeName(titleCase(aName)), emoji: aEmoji || bEmoji || '✨', synthetic: true };
    }

    /* ── Farklı elementler.
     * DETERMİNİZM: girdileri pairKey ile AYNI düzende sıralıyoruz ki
     * "A'yı B'ye bırak" ile "B'yi A'ya bırak" aynı sonucu versin. */
    const sirali = [{ n: aName, e: aEmoji }, { n: bName, e: bEmoji }].sort((x, y) => {
      const nx = normKey(x.n), ny = normKey(y.n);
      return nx < ny ? -1 : nx > ny ? 1 : 0;
    });
    /* İSİM UZUNLUĞU SINIRI — kritik.
     * Taban adı olduğu gibi kullanılırsa ekler üst üste yığılıyor ve
     * "Savaş Gemisi Fırını Köprüsü Bahçesi Tarlası" gibi saçmalıklar çıkıyor
     * (ölçümde birebir görüldü). Bu yüzden tabandan yalnızca İLK KELİMEYİ
     * alıyoruz: sonuç her zaman tam 2 kelime olur. */
    const taban = sirali[h % 2];                  // hangisi taban olacak (deterministik)
    const digeri = sirali[(h + 1) % 2];
    // ✨ YAYILMASINI ENGELLE: taban jokerse diğer ebeveynin gerçek emojisini kullan.
    if (!taban.e || taban.e === '✨') taban.e = digeri.e || taban.e;
    const tabanAd = titleCase(taban.n).split(' ')[0];
    const tpl = sablonlar();
    const isim = uygula(tpl[(h >>> 3) % tpl.length], tabanAd);

    // Güvenlik ağı: sonuç asla girdilerden biriyle aynı olamaz
    if (normKey(isim) === normKey(aName) || normKey(isim) === normKey(bName)) {
      return { name: upgradeName(tabanAd), emoji: taban.e || '✨', synthetic: true };
    }
    return { name: isim, emoji: taban.e || '✨', synthetic: true };
  }

  return {
    rebuild,

    /** SADECE elle yazılmış tabloya bak. Yoksa null. */
    lookup(aName, bName) {
      const hit = table.get(pairKey(aName, bName));
      return hit ? { id: hit.id, name: hit.name, emoji: hit.emoji } : null;
    },

    /** Yerel tabloda ara; yoksa deterministik sentez. Asla null dönmez. */
    combine(aName, bName) {
      const hit = table.get(pairKey(aName, bName));
      if (hit) return { name: hit.name, emoji: hit.emoji, synthetic: false };
      // Emoji ebeveynden miras alınacağı için mevcut elementlerden okuyoruz.
      const ae = GameState.get(aName), be = GameState.get(bName);
      return synthesize(aName, bName, ae && ae.emoji, be && be.emoji);
    },
    /** İpucu sistemi için: henüz keşfedilmemiş bir tarif öner. */
    findUndiscoveredHint() {
      for (const [key, val] of table.entries()) {
        const [a, b] = key.split('+');
        // İki girdi de elimizde olmalı, sonuç ise henüz keşfedilmemiş olmalı.
        if (GameState.has(a) && GameState.has(b) && !GameState.has(val.name)) {
          const A = GameState.get(a), B = GameState.get(b);
          return { a: A, b: B, result: val };
        }
      }
      return null;
    },
    size: () => table.size,
  };
})();

/* ============================================================================
 * [6] AI — TamgaStudio /v1/chat/completions İSTEMCİSİ
 * ----------------------------------------------------------------------------
 *  Akış:
 *    combine(a, b)
 *      ├─ 1) Kalıcı cache (GameState.recipes) → anında dön (0 ms, 0 token)
 *      ├─ 2) Uçuştaki aynı istek varsa ona bağlan (de-duplication)
 *      ├─ 3) fetch POST → OpenAI uyumlu gövde, stream:false
 *      │      · AbortController ile TUNING.aiTimeoutMs zaman aşımı
 *      │      · başarısızsa TUNING.aiRetries kadar tekrar
 *      └─ 4) Hata / geçersiz JSON → Alchemy çevrimdışı motoruna düş
 *  Sonuç HER DURUMDA cache'lenir → aynı ikili hep aynı sonucu verir
 *  (birleştirme oyunlarında determinizm oynanış için şarttır).
 * ==========================================================================*/
const AI = {
  _inflight: new Map(),

  /* --- ADAPTİF HIZ SINIRLAYICI ------------------------------------------
   * Ücretsiz Gemini kotası dakikalık istek sınırı uygular. Hızlı oynayan
   * oyuncu bu sınıra takılıyor (ölçüm: 70 hamlede isteklerin %47'si HTTP 429)
   * ve her 429 çevrimdışı motora düşerek kalitesiz isim üretiyordu.
   * Sabit gecikme koymak yerine KENDİNİ AYARLIYORUZ: 429 geldikçe istekler
   * arası minimum süre artar, başarı geldikçe yavaşça iner. Kotası bol bir
   * anahtarda hiç gecikme olmaz; dar bir anahtarda istekler kuyruğa girer
   * ama çöpe gitmez. */
  _minInterval: 0,
  _lastCallAt: 0,

  async _throttle() {
    if (this._minInterval > 0) {
      const bekle = this._minInterval - (Date.now() - this._lastCallAt);
      if (bekle > 0) await new Promise((r) => setTimeout(r, bekle));
    }
    this._lastCallAt = Date.now();
  },
  _hizLimitiYendi() { this._minInterval = Math.min(4500, Math.max(900, this._minInterval * 1.6)); },
  _basarili() { if (this._minInterval > 0) this._minInterval = Math.max(0, this._minInterval - 150); },

  /** Oyun donmuşken (onPause / reklam) sonucu uygulamayı beklet. */
  _waitWhileFrozen() {
    if (!GameState.isFrozen()) return Promise.resolve();
    return new Promise((resolve) => {
      const onChange = () => {
        if (GameState.isFrozen()) return;
        GameState.bus.off('freeze-change', onChange);
        resolve();
      };
      GameState.bus.on('freeze-change', onChange);
    });
  },

  /**
   * İki elementi birleştirir.
   * @returns {Promise<{name,emoji,source:'cache'|'ai'|'offline'}>}
   */
  async combine(aName, bName) {
    const key = pairKey(aName, bName);

    /* --- 1) Kalıcı cache ------------------------------------------------ */
    const cachedKey = GameState.recipes.get(key);
    if (cachedKey) {
      const known = GameState.discovered.get(normKey(cachedKey));
      if (known) return { name: known.name, emoji: known.emoji, source: 'cache' };
      // Cache var ama element listeden düşmüş — cache'i tazele.
      GameState.recipes.delete(key);
    }

    /* --- 2) Elle yazılmış tarif tablosu ---------------------------------
     * 94 tarif elle küratörlendi ve AI'dan daha tutarlı (Beton+Ateş için AI
     * "Lav" diyebiliyor, tablo "Kireç" diyor). Üstelik 0 ms sürüyor: oyunun
     * ilk saatinde hiç bekleme olmuyor. AI, tablonun bittiği yerde —
     * yani sonsuz kuyrukta — devreye giriyor. */
    const tablo = Alchemy.lookup(aName, bName);
    if (tablo) {
      GameState.recipes.set(key, normKey(tablo.name));
      return { name: tablo.name, emoji: tablo.emoji, id: tablo.id, source: 'table' };
    }

    /* --- 3) Uçuştaki isteği paylaş -------------------------------------- */
    if (this._inflight.has(key)) return this._inflight.get(key);

    const p = this._resolvePair(aName, bName, key)
      .finally(() => this._inflight.delete(key));
    this._inflight.set(key, p);
    return p;
  },

  async _resolvePair(aName, bName, key) {
    let out = null;

    /* İki AYRI deneme bütçesi:
     *   · attempt        → KALİTE hataları (soyut sonuç, girdinin tekrarı)
     *   · hizLimitiDeneme → HTTP 429. Bu geçici bir durum; birkaç saniye
     *     beklemek, oyuncuya kalitesiz bir isim vermekten çok daha iyidir,
     *     bu yüzden kalite bütçesini harcamaz. */
    let hizLimitiDeneme = 0;
    let attempt = 0;

    while (attempt <= TUNING.aiRetries) {
      try {
        await this._throttle();
        // 2. denemede modele "somut ol" diye sert uyarı gönderilir.
        out = await this._callTamgaStudio(aName, bName, attempt > 0);
        this._basarili();
        if (out) break;
        attempt++;                       // sonuç reddedildi → sert denemeye geç
      } catch (err) {
        const hizLimiti = String(err).includes('429');
        const zamanAsimi = err && (err.name === 'AbortError' || String(err).includes('abort'));

        if (hizLimiti && hizLimitiDeneme < TUNING.aiRateLimitRetries) {
          this._hizLimitiYendi();
          hizLimitiDeneme++;
          await new Promise((r) => setTimeout(r, 900 * hizLimitiDeneme));
          continue;                      // kalite bütçesini HARCAMA
        }

        YT.logWarning('AI denemesi ' + (attempt + 1) + ' başarısız: ' + err);

        /* Zaman aşımında tekrar deneme yok: bir 6 sn daha beklemek oyuncuyu
         * 12 saniye kartsız bırakır; çevrimdışı motor anında cevap verir. */
        if (zamanAsimi) break;

        attempt++;
        if (attempt <= TUNING.aiRetries) {
          await new Promise((r) => setTimeout(r, 450 * attempt));
        }
      }
    }

    /* --- 4) Yedek motor -------------------------------------------------- */
    let source = 'ai';
    if (!out) {
      out = Alchemy.combine(aName, bName);
      source = 'offline';
    }

    // Sonucu kalıcı cache'e yaz (hem AI hem offline sonuçları için).
    GameState.recipes.set(key, normKey(out.name));

    // Oyun duraklatılmışsa sonucu geri döndürmeden önce resume'u bekle.
    await this._waitWhileFrozen();

    return { name: titleCase(out.name), emoji: out.emoji || '✨', source };
  },

  /* Modele "bunları zaten buldum" listesi göndermek, tekrar oranını düşüren
   * en etkili yöntem. Ölçümde model bir temaya saplanıp aynı isimleri üretmeye
   * başlıyordu (Mağara, Termal Havuz, Kaplıca birer kez tekrar etti) ve keşif
   * oranı 10/10'dan 6/10'a düşüyordu. 18 isim ≈ 40 token, gecikmeye etkisi yok. */
  _sonKesifler(limit) {
    return GameState.list().slice(-limit).map((e) => e.name);
  },

  /** Ham HTTP çağrısı. Başarısızsa throw eder. */
  async _callTamgaStudio(aName, bName, strict) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TUNING.aiTimeoutMs);

    try {
      const res = await fetch(AI_CONFIG.endpoint, {
        method: 'POST',
        signal: controller.signal,
        /* Anahtar BOŞSA Authorization başlığı hiç gönderilmez.
         * Proxy modunda anahtar sunucuda durur; istemcinin göndereceği bir şey
         * yoktur ve boş bir "Bearer " başlığı bazı ara sunucularda hataya yol
         * açar. Doğrudan sağlayıcı modunda (yerel geliştirme) başlık eklenir. */
        headers: AI_CONFIG.apiKey
          ? { 'Content-Type': 'application/json',
              'Authorization': 'Bearer ' + AI_CONFIG.apiKey }
          : { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.assign({
          model: AI_CONFIG.model,
          stream: AI_CONFIG.stream,          // false — tek seferde tam yanıt
          temperature: 0.95,   // biraz daha çeşitlilik (0.8'de tema saplanması ölçüldü)
          max_tokens: AI_CONFIG.maxTokens,   // sağlayıcıya göre (bkz. AI_PROVIDERS)
          /* MESAJ SIRASI KRİTİK.
           * "Zaten bulunanlar" listesini format kuralından SONRA koyduğumuzda
           * model listenin virgüllü biçimini taklit edip JSON yerine
           * "Çamur havuzu, Balçık Çukuru, ..." döndürüyordu (birebir ölçüldü) —
           * her yanıt ayrıştırılamayıp çevrimdışı motora düşüyordu (%54).
           * Çözüm: yasak liste ORTADA, ÇIKTI FORMATI en SON system mesajı.
           * Modeller son talimata daha güçlü uyar. */
          messages: (() => {
            const msg = [{ role: 'system', content: AI_CONFIG.systemPrompt }];

            /* Liste 18 → 30. Ölçümde tekrar oranı %30 çıkmıştı; modele daha
             * uzun bir "bunları zaten buldum" listesi vermek en etkili çare.
             * 30 kısa isim ≈ 70 token, gecikmeye etkisi ölçülemeyecek kadar az. */
            const bulunanlar = this._sonKesifler(30);
            if (bulunanlar.length >= 6) {
              msg.push({
                role: 'system',
                content: AI_CONFIG.knownPrefix + bulunanlar.map((n) => '"' + n + '"').join(' '),
              });
            }
            if (strict) msg.push({ role: 'system', content: AI_CONFIG.strictRule });

            // Format kuralı DAİMA en son system mesajı olmalı.
            msg.push({ role: 'system', content: AI_CONFIG.formatRule });
            /* Dil pekiştirmesi: sistem mesajı dili söylese de, "zaten bulunanlar"
             * listesi başka dilden isimler içerdiğinde model o dile kayabiliyor.
             * Kullanıcı mesajında hedef dili tekrar etmek bunu engelliyor. */
            const dilAdi = { en: 'English', tr: 'Turkish', es: 'Spanish', pt: 'Portuguese' }[LANG] || 'English';
            msg.push({
              role: 'user',
              content: titleCase(aName) + ' + ' + titleCase(bName) + '  (answer in ' + dilAdi + ')',
            });
            return msg;
          })(),
        }, AI_CONFIG.extraBody)),
      });

      if (!res.ok) {
        // Gövdeyi de oku: 400/401/403 sebebini konsolda net görebilmek için.
        let detail = '';
        try { detail = (await res.text()).slice(0, 300); } catch (_) {}
        throw new Error('HTTP ' + res.status + (detail ? ' — ' + detail : ''));
      }

      const json = await res.json();
      const content =
        (json && json.choices && json.choices[0] &&
         json.choices[0].message && json.choices[0].message.content) || '';

      /* Sağlayıcının kendi güvenlik filtresi devreye girdiyse içerik boş gelir
       * ve finish_reason bunu bildirir. Bu bir hata değil, beklenen davranış:
       * sessizce çevrimdışı motora düşülür. */
      const bitis = json && json.choices && json.choices[0] && json.choices[0].finish_reason;
      if (bitis === 'content_filter') {
        YT.logWarning('Sağlayıcı güvenlik filtresi devreye girdi');
        return null;
      }

      if (!content) {
        // En sık sebep: max_tokens düşük ve model (2.5 gibi) bütçeyi düşünmeye harcadı.
        YT.logWarning('Model boş içerik döndürdü — AI_PROVIDERS.' + AI_PROVIDER +
                      '.maxTokens değerini artırmayı deneyin.');
      }

      return this._parseResult(content, aName, bName);
    } finally {
      clearTimeout(timer);
    }
  },

  /** Model çıktısını güvenle ayrıştır: JSON → regex → başarısız (null). */
  _parseResult(raw, aName, bName) {
    if (!raw) return null;
    let text = String(raw).trim();

    // ```json ... ``` sarmalını temizle
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

    let name = null, emoji = null;

    // a) Düz JSON
    try {
      const obj = JSON.parse(text);
      if (obj && typeof obj === 'object') { name = obj.name; emoji = obj.emoji; }
    } catch (_) {
      // b) Metin içine gömülü JSON
      const m = text.match(/\{[\s\S]*\}/);
      if (m) {
        try { const obj = JSON.parse(m[0]); name = obj.name; emoji = obj.emoji; } catch (__) {}
      }
    }

    // c) Son çare: "Buhar ♨️" gibi serbest metin
    if (!name) {
      const emojiRe = /(\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic})*)/u;
      const em = text.match(emojiRe);
      if (em) emoji = em[1];
      const cleaned = text.replace(emojiRe, '').replace(/["'`{}:,]|name|emoji/gi, '').trim();
      if (cleaned && cleaned.length <= 32) name = cleaned;
    }

    if (!name || typeof name !== 'string') return null;
    name = titleCase(name.replace(/[^\p{L}\p{N}\s'-]/gu, '').trim()).slice(0, 28);
    if (!name) return null;

    // Model tembellik edip girdilerden birini geri verdiyse kabul etme.
    if (normKey(name) === normKey(aName) || normKey(name) === normKey(bName)) return null;

    // Soyut bulamaç → reddet; çağıran katman daha sert bir promptla tekrar dener.
    if (bulamacMi(name)) return null;

    /* İÇERİK GÜVENLİĞİ — uygunsuz sonucu ASLA gösterme.
     * Reddedilince üst katman sıkı promptla tekrar dener; o da uygunsuzsa
     * çevrimdışı motor devreye girer. Oyuncu hiçbir durumda görmez. */
    if (uygunsuzMu(name)) {
      YT.logWarning('Uygunsuz içerik reddedildi');
      return null;
    }

    if (!emoji || !/\p{Extended_Pictographic}/u.test(emoji)) emoji = '✨';
    // Tek emoji'ye indir (ZWJ dizilerini koru).
    const firstEmoji = emoji.match(
      /\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic}|[\u{1F3FB}-\u{1F3FF}])*/u
    );
    emoji = firstEmoji ? firstEmoji[0] : '✨';

    return { name, emoji, synthetic: false };
  },
};


/* ============================================================================
 * [6b] Sfx — SENTEZLENMİŞ SES MOTORU (0 byte asset)
 * ----------------------------------------------------------------------------
 *  Playables paketinde harici ses dosyası taşımak hem boyut hem "her şey yerel
 *  olmalı" kuralı açısından pahalıdır. Bunun yerine tüm efektleri çalışma
 *  anında WebAudio osilatörleriyle üretiyoruz: paket boyutu 0 bayt artıyor,
 *  yükleme süresi değişmiyor ve her sesi koda gömülü olarak ayarlayabiliyoruz.
 *
 *  SERTİFİKASYON: Kendi master gain'imiz var ve YouTube'un ses durumu
 *  değiştiğinde (onAudioEnabledChange) anında 0'a çekiliyor. onPause'da zaten
 *  AudioContext askıya alındığı için hiçbir ses sızmaz.
 * ==========================================================================*/
const Sfx = {
  ctx: null,
  master: null,
  hazir: false,
  seviye: 0.30,

  init(game) {
    try {
      const ctx = game.sound && game.sound.context;
      if (!ctx || typeof ctx.createGain !== 'function') return;   // NoAudio ortamı
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.master.gain.value = GameState.audioEnabled ? this.seviye : 0;
      this.master.connect(ctx.destination);
      this.hazir = true;
    } catch (e) { YT.logWarning('Ses motoru başlatılamadı: ' + e); }
  },

  setEnabled(on) {
    if (!this.hazir) return;
    try {
      this.master.gain.setTargetAtTime(on ? this.seviye : 0, this.ctx.currentTime, 0.015);
    } catch (_) {}
  },

  /** Tek nota. slideTo verilirse frekans kayar (whoosh/blip etkisi). */
  _ton({ freq, dur = 0.12, type = 'sine', vol = 1, gecikme = 0, slideTo = null }) {
    if (!this.hazir || this.ctx.state !== 'running') return;
    const t0 = this.ctx.currentTime + gecikme;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    // Kısa atak + üstel sönüm: "pop" hissi veren zarf
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t0 + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain); gain.connect(this.master);
    osc.start(t0); osc.stop(t0 + dur + 0.02);
  },

  /** Kısa gürültü patlaması (toz/parçacık hissi). */
  _gurultu({ dur = 0.18, vol = 0.25, gecikme = 0, hp = 900 }) {
    if (!this.hazir || this.ctx.state !== 'running') return;
    const t0 = this.ctx.currentTime + gecikme;
    const n = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const filt = this.ctx.createBiquadFilter(); filt.type = 'highpass'; filt.frequency.value = hp;
    const gain = this.ctx.createGain(); gain.gain.value = vol;
    src.connect(filt); filt.connect(gain); gain.connect(this.master);
    src.start(t0);
  },

  /* --- Oyun sesleri ---------------------------------------------------- */
  al()      { this._ton({ freq: 320, slideTo: 560, dur: 0.07, type: 'triangle', vol: 0.22 }); },
  birak()   { this._ton({ freq: 240, slideTo: 150, dur: 0.09, type: 'sine', vol: 0.20 }); },
  vurgula() { this._ton({ freq: 880, dur: 0.04, type: 'sine', vol: 0.10 }); },

  /** Birleşme başlangıcı: yükselen süpürme */
  birlesme() {
    this._ton({ freq: 200, slideTo: 700, dur: 0.22, type: 'sawtooth', vol: 0.16 });
    this._gurultu({ dur: 0.2, vol: 0.12, hp: 1400 });
  },

  /** Yeni keşif: nadirlik arttıkça daha uzun ve tiz arpej */
  kesif(kademe = 0) {
    const kok = [523.25, 587.33, 659.25, 698.46, 783.99][Math.min(4, kademe)];
    const akor = [1, 1.25, 1.5, 2];                      // majör triad + oktav
    akor.forEach((oran, i) => {
      this._ton({ freq: kok * oran, dur: 0.30, type: 'triangle', vol: 0.20, gecikme: i * 0.055 });
    });
    this._gurultu({ dur: 0.35, vol: 0.10, hp: 2600, gecikme: 0.02 });
  },

  /** Zaten bilinen sonuç: donuk çift vuruş */
  bilinen() {
    this._ton({ freq: 300, dur: 0.07, type: 'sine', vol: 0.13 });
    this._ton({ freq: 240, dur: 0.09, type: 'sine', vol: 0.11, gecikme: 0.09 });
  },

  /** Kilometre taşı fanfarı */
  donum() {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      this._ton({ freq: f, dur: 0.45, type: 'triangle', vol: 0.22, gecikme: i * 0.09 });
    });
  },

  tik()  { this._ton({ freq: 620, dur: 0.05, type: 'square', vol: 0.10 }); },
  hata() { this._ton({ freq: 180, slideTo: 120, dur: 0.18, type: 'sawtooth', vol: 0.16 }); },
};

/* ============================================================================
 * [7] Widgets — yeniden kullanılabilir görsel bileşenler
 * ==========================================================================*/

const FONTS = {
  ui: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  emoji: '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", "Twemoji Mozilla", sans-serif',
};

const hex = (n) => '#' + n.toString(16).padStart(6, '0');

/* ----------------------------------------------------------------------------
 * elementFaceTexture — PERFORMANSIN KALBİ
 * ----------------------------------------------------------------------------
 *  Her Phaser Text nesnesi KENDİ canvas'ını ve KENDİ WebGL dokusunu yaratır.
 *  Kart başına 2 Text (emoji + isim) demek, kart başına 2 ayrı doku demektir.
 *  GPU tek çizim yığınında en fazla `renderer.maxTextures` (tipik 16) doku
 *  bağlayabilir; sınır aşılınca Phaser yığını bölmek zorunda kalır ve çizim
 *  çağrısı sayısı patlar. 16 kart = 32 doku → mobilde belirgin kasma.
 *
 *  Çözüm: emoji + ismi element BAŞINA bir kez canvas'a çizip dokuyu
 *  önbelleğe alıyoruz. Aynı elementin 10 kopyası aynı dokuyu paylaşır;
 *  kütüphane slotu da aynı dokuyu kullanır. Böylece doku sayısı "kart sayısı"
 *  ile değil "benzersiz element sayısı" ile büyür ve yığın bölünmez.
 * --------------------------------------------------------------------------*/
const FaceTextures = {
  /* Aynı anda bellekte tutulacak en fazla yüz dokusu.
   * Her doku 130x130x4 = ~68 KB. Sınırsız bırakılırsa 200 keşifte ~14 MB,
   * 500 keşifte ~34 MB GPU belleği demektir — mobilde kaçınılmaz donma.
   * Ekranda aynı anda en fazla ~25 slot + ~40 kart olabildiği için 64 bol bol
   * yeter; atılan bir doku tekrar gerekirse anında yeniden çizilir. */
  MAX: 64,
  _lru: [],

  get(scene, elem) {
    const key = 'face:' + normKey(elem.name);
    const i = this._lru.indexOf(key);
    if (i >= 0) this._lru.splice(i, 1);
    this._lru.push(key);                       // en son kullanılan sona
    if (!scene.textures.exists(key)) this._draw(scene, elem, key);
    if (this._lru.length > this.MAX) this._evict(scene);
    return key;
  },

  /** Şu an EKRANDA kullanılan doku anahtarları — bunlar asla atılmaz. */
  _inUse(game) {
    const used = new Set();
    const gs = game.scene.getScene('Game');
    if (gs && gs.cards) {
      gs.cards.getChildren().forEach((c) => {
        if (c.face && c.face.texture) used.add(c.face.texture.key);
      });
    }
    const us = game.scene.getScene('UI');
    if (us && us._pool) {
      us._pool.forEach((v) => {
        if (v.visible && v.__face && v.__face.texture) used.add(v.__face.texture.key);
      });
    }
    return used;
  },

  _evict(scene) {
    const used = this._inUse(scene.game);
    let i = 0;
    while (this._lru.length > this.MAX && i < this._lru.length) {
      const k = this._lru[i];
      if (used.has(k)) { i++; continue; }      // ekranda, atlanır
      this._lru.splice(i, 1);
      if (scene.textures.exists(k)) scene.textures.remove(k);
    }
  },

  _draw(scene, elem, key) {
  const W = LAYOUT.cardW, H = LAYOUT.cardH;
  const tex = scene.textures.createCanvas(key, W, H);
  if (!tex) return key;
  const ctx = tex.getContext();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Emoji
  ctx.font = '52px ' + FONTS.emoji;
  ctx.fillText(elem.emoji || '✨', W / 2, H / 2 - 16);

  // İsim — sığana kadar küçült, hâlâ sığmıyorsa iki satıra böl
  ctx.fillStyle = hex(PALETTE.text);
  const maxW = W - 16;
  let size = 20;
  while (size > 11) {
    ctx.font = '600 ' + size + 'px ' + FONTS.ui;
    if (ctx.measureText(elem.name).width <= maxW) break;
    size--;
  }
  if (ctx.measureText(elem.name).width <= maxW) {
    ctx.fillText(elem.name, W / 2, H / 2 + 40);
  } else {
    const bos = elem.name.lastIndexOf(' ');
    const s1 = bos > 0 ? elem.name.slice(0, bos) : elem.name.slice(0, Math.ceil(elem.name.length / 2));
    const s2 = bos > 0 ? elem.name.slice(bos + 1) : elem.name.slice(Math.ceil(elem.name.length / 2));
    ctx.fillText(s1, W / 2, H / 2 + 32);
    ctx.fillText(s2, W / 2, H / 2 + 32 + size + 2);
  }

  tex.refresh();
  return key;
  },
};

/** Kısayol. */
function elementFaceTexture(scene, elem) { return FaceTextures.get(scene, elem); }

/* ----------------------------------------------------------------------------
 * ElementCard — tahtadaki sürüklenebilir element kartı
 * --------------------------------------------------------------------------*/
class ElementCard extends Phaser.GameObjects.Container {
  /**
   * @param {Phaser.Scene} scene
   * @param {{name:string, emoji:string, tier:number}} elem
   */
  constructor(scene, x, y, elem) {
    super(scene, x, y);
    /* elem KOPYALANIR (referans değil): kart kendi görüntüsünü taşır.
     * Bu yüzden `id` de kopyalanmalı — dil değiştiğinde kartı yeniden
     * adlandırabilmenin tek yolu bu. */
    this.elem = { name: elem.name, emoji: elem.emoji, tier: elem.tier | 0, id: elem.id || null };

    /** Birleşme sürecindeyken tekrar tetiklenmesin diye kilit. */
    this.busy = false;
    this.highlighted = false;

    const W = LAYOUT.cardW, H = LAYOUT.cardH;

    this.rarity = rarityIndex(this.elem.tier);

    /* Nadirlik aurası: Destansı (3) ve Efsanevi (4) kartlar sürekli hafif
     * parlar. Oyuncu tahtaya baktığında değerli olanı ANINDA ayırt eder —
     * çerçeve rengi tek başına yeterince güçlü bir sinyal değildi. */
    if (this.rarity >= 3) {
      this.aura = scene.add.image(0, 0, 'tex-glow')
        .setScale(1.5).setAlpha(0.30)
        .setTint(RARITY[this.rarity].renk)
        .setBlendMode(Phaser.BlendModes.ADD);
      scene.tweens.add({
        targets: this.aura, alpha: { from: 0.18, to: 0.42 }, scale: { from: 1.42, to: 1.62 },
        duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });
    }

    this.bg = scene.add.image(0, 0, 'tex-card-r' + this.rarity);
    // Parıltı yalnızca vurgulandığında görünür. setVisible(false) ile boşta
    // GPU'ya hiç gönderilmez (additive blend her karta ek dolgu maliyetidir).
    this.glow = scene.add.image(0, 0, 'tex-glow')
      .setScale(1.35).setAlpha(0).setVisible(false)
      .setBlendMode(Phaser.BlendModes.ADD);

    // Emoji + isim: element başına ÖNBELLEKLENMİŞ tek doku (bkz. yukarıdaki not)
    this.face = scene.add.image(0, 0, elementFaceTexture(scene, this.elem));

    this.add(this.aura ? [this.aura, this.glow, this.bg, this.face]
                       : [this.glow, this.bg, this.face]);
    this.setSize(W, H);

    scene.add.existing(this);

    /* --- Arcade fizik gövdesi (overlap tespiti için) --------------------
     * Phaser'ın Arcade Body'si gövde konumunu
     *   position = x + scaleX * (offset - displayOrigin)
     * formülüyle hesaplar. Container'da displayOrigin, setSize() ile verdiğimiz
     * boyutun yarısıdır (salt okunur getter: 130/2 = 65). Yani gövdeyi kartın
     * tam merkezine oturtmak için offset = (kart - gövde) / 2 olmalıdır. */
    scene.physics.add.existing(this);
    const bw = W * 0.82, bh = H * 0.82;
    this.body.setSize(bw, bh, false);
    this.body.setOffset((W - bw) / 2, (H - bh) / 2);
    this.body.setAllowGravity(false);
    this.body.setImmovable(true);

    /* --- Sürükle-bırak ---------------------------------------------------
     * DİKKAT: setInteractive(hitArea, callback, dropZone) imzasında ÜÇÜNCÜ
     * parametre `dropZone` (boolean). Oraya bir config nesnesi verilirse nesne
     * "truthy" olduğu için kart yanlışlıkla DROP ZONE'a dönüşür (sahte `drop`
     * olayları) ve `useHandCursor` hiç uygulanmaz. Doğrusu, tek argümanlı
     * config biçimidir: */
    this.setInteractive({
      /* HIT AREA KOORDİNAT SİSTEMİ — dikkat!
       * Phaser hit testinde noktayı önce nesnenin YEREL uzayına çevirir
       * (merkez = 0,0), sonra `pointWithinHitArea` içinde noktaya
       * displayOrigin'i EKLER:
       *     x += gameObject.displayOriginX;   // Container'da = width / 2
       * Yani callback'e ulaşan koordinatlar 0..width aralığındadır.
       * Bu yüzden dikdörtgen (0, 0, w, h) olmalıdır. (-w/2, -h/2, w, h)
       * verilirse alan yarım kart sola-yukarı kayar ve yalnızca SOL ÜST
       * çeyrek tıklanabilir olur. Phaser'ın kendi varsayılanı da
       * setHitAreaFromTexture() içinde new Rectangle(0, 0, w, h)'dir. */
      hitArea: new Phaser.Geom.Rectangle(0, 0, W, H),
      hitAreaCallback: Phaser.Geom.Rectangle.Contains,
      draggable: true,
      useHandCursor: true,
    });
  }

  /** Aura sonsuz tween kullanır; kart yok edilirken mutlaka durdurulmalı
   *  (LoadingOrb'da yaşadığımız sızıntının aynısı burada da oluşurdu). */
  destroy(fromScene) {
    if (this.aura && this.scene && this.scene.tweens) {
      this.scene.tweens.killTweensOf(this.aura);
    }
    super.destroy(fromScene);
  }

  /** Doğuş animasyonu. */
  popIn(delay = 0) {
    this.setScale(0.2).setAlpha(0);
    this.scene.tweens.add({
      targets: this, scale: 1, alpha: 1, delay,
      duration: 340, ease: 'Back.easeOut',
    });
    return this;
  }

  /** Sürüklenirken üstüne gelinen hedefi vurgula. */
  setHighlight(on) {
    if (this.highlighted === on) return;
    this.highlighted = on;
    this.bg.setTexture(on ? 'tex-card-hi' : 'tex-card-r' + this.rarity);
    if (on) this.glow.setVisible(true);
    this.scene.tweens.add({
      targets: this.glow, alpha: on ? 0.55 : 0, duration: 140,
      onComplete: () => { if (!on) this.glow.setVisible(false); },
    });
  }

  /** Birleşme sırasında merkeze doğru emilme animasyonu. */
  absorbTo(x, y, duration = 220) {
    this.busy = true;
    if (this.body) this.body.enable = false;
    this.disableInteractive();
    return new Promise((resolve) => {
      this.scene.tweens.add({
        targets: this, x, y, scale: 0.25, alpha: 0.15,
        duration, ease: 'Cubic.easeIn', onComplete: resolve,
      });
    });
  }

  /** Kartı yok et (küçülerek). */
  vanish(duration = 160) {
    if (this.body) this.body.enable = false;
    this.disableInteractive();
    this.scene.tweens.add({
      targets: this, scale: 0, alpha: 0, duration, ease: 'Quad.easeIn',
      onComplete: () => this.destroy(),
    });
  }
}

/* ----------------------------------------------------------------------------
 * LoadingOrb — AI yanıtı beklenirken gösterilen yükleme animasyonu
 * (API çağrısı 1-3 sn sürebilir; oyuncu "bir şey oluyor" hissini kaybetmemeli)
 * --------------------------------------------------------------------------*/
class LoadingOrb extends Phaser.GameObjects.Container {
  constructor(scene, x, y) {
    super(scene, x, y);

    this.halo = scene.add.image(0, 0, 'tex-glow')
      .setScale(1.9).setAlpha(0.35).setTint(PALETTE.accent2)
      .setBlendMode(Phaser.BlendModes.ADD);

    this.ring = scene.add.container(0, 0);
    const colors = [PALETTE.accent, PALETTE.accent2, PALETTE.accent3];
    this.dots = [];
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const d = scene.add.circle(Math.cos(a) * 30, Math.sin(a) * 30, 9, colors[i]);
      this.dots.push(d);
      this.ring.add(d);
    }

    this.caption = scene.add.text(0, 62, t('working'), {
      fontFamily: FONTS.ui, fontSize: '19px', color: hex(PALETTE.dim),
    }).setOrigin(0.5);

    this.add([this.halo, this.ring, this.caption]);
    scene.add.existing(this);
    this.setDepth(900);

    /* SONSUZ TWEEN'LER TEK LİSTEDE TOPLANIR.
     * Bunlar repeat:-1 olduğu için kendiliğinden BİTMEZ. Daha önce sadece
     * _spin ve _breathe kaldırılıyordu; 3 nokta nabzı listede olmadığı için
     * her birleştirmede 3 tween sızıyordu. Yok edilmiş nesneleri her karede
     * güncellemeye devam ettikleri için oyun oynadıkça giderek yavaşlıyordu
     * (ölçüm: 12 birleştirme = 36 kaçak tween). */
    this._loopTweens = [];

    // Dönüş
    this._loopTweens.push(scene.tweens.add({
      targets: this.ring, angle: 360, duration: 1100,
      repeat: -1, ease: 'Linear',
    }));
    // Nokta nabzı
    this.dots.forEach((d, i) => {
      this._loopTweens.push(scene.tweens.add({
        targets: d, scale: { from: 0.55, to: 1.25 },
        duration: 520, yoyo: true, repeat: -1, delay: i * 165, ease: 'Sine.easeInOut',
      }));
    });
    // Hale nefesi
    this._loopTweens.push(scene.tweens.add({
      targets: this.halo, scale: { from: 1.6, to: 2.2 }, alpha: { from: 0.22, to: 0.45 },
      duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    }));

    this.setScale(0.4).setAlpha(0);
    scene.tweens.add({ targets: this, scale: 1, alpha: 1, duration: 240, ease: 'Back.easeOut' });
  }

  setCaption(t) { this.caption.setText(t); return this; }

  /** Tüm sonsuz tween'leri durdurur. Birden fazla kez çağrılabilir. */
  _stopLoops() {
    if (!this._loopTweens) return;
    this._loopTweens.forEach((t) => { if (t && t.remove) t.remove(); });
    this._loopTweens.length = 0;
  }

  close() {
    this._stopLoops();
    this.scene.tweens.add({
      targets: this, scale: 0.3, alpha: 0, duration: 180,
      onComplete: () => this.destroy(),
    });
  }

  /** close() çağrılmadan yok edilirse (sahne kapanışı, hata yolu) de temizle. */
  destroy(fromScene) {
    this._stopLoops();
    super.destroy(fromScene);
  }
}

/* ----------------------------------------------------------------------------
 * UI yardımcıları
 * --------------------------------------------------------------------------*/
const UI = {
  /** Yuvarlak köşeli buton üretir. Container döner; .setEnabled(bool) taşır. */
  button(scene, x, y, label, opts = {}) {
    const w = opts.width || 220;
    const h = opts.height || 68;
    const radius = opts.radius || h / 2;
    const fill = opts.fill != null ? opts.fill : PALETTE.cardHi;
    const stroke = opts.stroke != null ? opts.stroke : PALETTE.stroke;
    const color = opts.color != null ? opts.color : PALETTE.text;

    const c = scene.add.container(x, y);
    const g = scene.add.graphics();
    const draw = (f, s) => {
      g.clear();
      g.fillStyle(f, 1); g.fillRoundedRect(-w / 2, -h / 2, w, h, radius);
      g.lineStyle(2, s, 1); g.strokeRoundedRect(-w / 2, -h / 2, w, h, radius);
    };
    draw(fill, stroke);

    const t = scene.add.text(0, 0, label, {
      fontFamily: FONTS.ui, fontSize: (opts.fontSize || 24) + 'px',
      fontStyle: '700', color: hex(color),
    }).setOrigin(0.5);

    /* ÖLÇEK ANİMASYONU İÇ KATMANDA
     * Butonun kendisini küçültmek (scale 0.94) hit area'yı da küçültür. Kenara
     * yakın basıldığında parmak bir anda butonun DIŞINDA kalır, Phaser
     * `pointerout` yollar, tıklama iptal olur — yani "kenarlara basınca tepki
     * vermiyor". Bu yüzden etkileşimli kök (c) hiç ölçeklenmez; sadece içindeki
     * görsel katman (inner) ölçeklenir. Hit area sabit kalır. */
    const inner = scene.add.container(0, 0);
    inner.add([g, t]);
    c.add(inner);
    c.setSize(w, h);
    // Hit area (0,0,w,h) olmalı — sebebi ElementCard'daki uzun nottadır.
    c.setInteractive({
      hitArea: new Phaser.Geom.Rectangle(0, 0, w, h),
      hitAreaCallback: Phaser.Geom.Rectangle.Contains,
      useHandCursor: true,
    });

    c.label = t;
    c.enabled = true;
    c.setEnabled = function (on) {
      this.enabled = on;
      this.setAlpha(on ? 1 : 0.42);
      if (on) this.setInteractive(); else this.disableInteractive();
      return this;
    };

    /* BASMA SEMANTİĞİ
     * Eskiden onClick doğrudan 'pointerup'a bağlıydı. İki sorun çıkarıyordu:
     *  a) Başka yerde başlayan bir sürüklemeyi buton üstünde bırakınca buton
     *     TIKLANMIŞ sayılıyordu (kartı sürükleyip İpucu'nun üstüne bırakınca
     *     reklam modalı açılıyordu).
     *  b) Basıp parmağı 1-2 piksel kaydırıp bırakınca hiçbir şey olmuyordu.
     * Çözüm: buton üstünde BASILIP yine buton üstünde BIRAKILIRSA tıklama. */
    let armed = false;
    const release = (fire) => {
      if (!armed) return;
      armed = false;
      draw(fill, stroke);
      scene.tweens.add({ targets: inner, scale: 1, duration: 90, ease: 'Back.easeOut' });
      if (fire && c.enabled && opts.onClick) opts.onClick();
    };

    c.on('pointerover', () => { if (c.enabled && !armed) draw(PALETTE.accent2, PALETTE.accent); });
    c.on('pointerout',  () => { if (armed) release(false); else draw(fill, stroke); });
    c.on('pointerdown', () => {
      if (!c.enabled) return;
      armed = true;
      Sfx.tik();
      draw(PALETTE.accent2, PALETTE.accent);
      scene.tweens.add({ targets: inner, scale: 0.94, duration: 70 });   // c DEĞİL, inner
    });
    c.on('pointerup', () => release(true));

    // Tuval dışında bırakılırsa butonu basılı kalmaktan kurtar
    const globalUp = () => release(false);
    scene.input.on('pointerupoutside', globalUp);
    c.once('destroy', () => { scene.input.off('pointerupoutside', globalUp); });

    return c;
  },

  /** Kısa bildirim balonu. */
  toast(scene, message, opts = {}) {
    const y = opts.y != null ? opts.y : LAYOUT.boardTop + 60;
    const c = scene.add.container(DESIGN.W / 2, y).setDepth(1500);

    const t = scene.add.text(0, 0, message, {
      fontFamily: FONTS.ui, fontSize: '22px', fontStyle: '600',
      color: hex(opts.color || PALETTE.text), align: 'center',
      wordWrap: { width: DESIGN.W - 140 },
    }).setOrigin(0.5);

    const pad = 22;
    const w = t.width + pad * 2, h = t.height + pad;
    const g = scene.add.graphics();
    g.fillStyle(PALETTE.bg0, 0.92); g.fillRoundedRect(-w / 2, -h / 2, w, h, h / 2);
    g.lineStyle(2, opts.color || PALETTE.stroke, 0.9);
    g.strokeRoundedRect(-w / 2, -h / 2, w, h, h / 2);

    c.add([g, t]);
    c.setAlpha(0).setScale(0.9);
    scene.tweens.add({ targets: c, alpha: 1, scale: 1, duration: 200, ease: 'Back.easeOut' });
    scene.tweens.add({
      targets: c, alpha: 0, y: y - 46, delay: opts.duration || 1900, duration: 320,
      onComplete: () => c.destroy(),
    });
    return c;
  },
};

/* ============================================================================
 * [8] BootScene — dokuları üret, bulut kaydını yükle, SDK'ya hazır sinyali ver
 * ==========================================================================*/
class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  init() {
    /* SERTİFİKASYON: firstFrameReady() ilk kare EKRANA BASILDIĞI anda
     * çağrılmalı. Erken çağırmak (create içinde) boş ekranı "hazır" göstermek
     * demektir; geç çağırmak YouTube'un yükleme spinner'ını uzatır. Bu yüzden
     * motorun POST_RENDER olayına tek seferlik bağlanıyoruz. */
    this.game.events.once(Phaser.Core.Events.POST_RENDER, () => {
      YT.firstFrameReady();
      const splash = document.getElementById('boot-splash');
      if (splash) {
        splash.classList.add('hidden');
        setTimeout(() => splash.remove(), 400);
      }
    });
  }

  create() {
    GameState.bus = new Phaser.Events.EventEmitter();

    this._buildTextures();

    // Boot ekranında basit bir arka plan (splash HTML'i üstte duruyor).
    this.add.graphics()
      .fillGradientStyle(PALETTE.bg1, PALETTE.bg1, PALETTE.bg0, PALETTE.bg0, 1)
      .fillRect(0, 0, DESIGN.W, DESIGN.H);

    /* --- Ses durumunu SDK'dan oku (varsayılan "açık" KABUL EDİLEMEZ) ----- */
    GameState.audioEnabled = YT.isAudioEnabled();
    this.sound.mute = !GameState.audioEnabled;
    Sfx.init(this.game);
    Sfx.setEnabled(GameState.audioEnabled);

    /* --- SDK yaşam döngüsü dinleyicileri -------------------------------- */
    this._wireSdkLifecycle();

    /* --- Bulut kaydını yükle, sonra oyunu başlat ------------------------ */
    YT.loadData()
      .then((raw) => {
        /* DİL SEÇİMİ ÖNCELİĞİ
         *   1) Oyuncunun daha önce ayarlardan seçtiği dil (kayıtta)
         *   2) YouTube'un bildirdiği cihaz dili (desteklediklerimizden biriyse)
         *   3) İngilizce — oyunun ana dili
         * Kayıt çözülmeden ÖNCE belirlenmeli: temel elementler o dilde adlanır. */
        let kayitliDil = null;
        try { const j = JSON.parse(raw || '{}'); kayitliDil = j.lang; } catch (_) {}
        /* OTOMATİK DİL ALGILAMA
         *   1) Oyuncunun ayarlardan seçtiği dil (kayıtta) — her zaman kazanır
         *   2) YouTube'un bildirdiği cihaz dili (desteklediklerimizden biriyse)
         *   3) İngilizce — oyunun ana dili
         * Oyuncu ayarlardan bir kez seçim yaptığında kayda yazılır ve cihaz
         * dili artık ezmez; bu, bilinçli tercihin otomatiğe üstün olması içindir. */
        const sdkDil = (YT.getLanguage() || 'en').slice(0, 2).toLowerCase();
        LANG = (LANG_IDX[kayitliDil] !== undefined) ? kayitliDil
             : (LANG_IDX[sdkDil]     !== undefined) ? sdkDil
             : 'en';

        Alchemy.rebuild();
        console.info('[OmniMerge] dil →', LANG,
                     '(kayıtlı:', kayitliDil || 'yok', '| cihaz:', sdkDil + ')');

        const restored = SaveManager.deserialize(raw);
        console.info('[OmniMerge] kayıt', restored ? 'yüklendi' : 'yok (yeni oyun)',
                     '| element:', GameState.score, '| tarif:', GameState.recipes.size);
      })
      .catch((e) => {
        YT.logWarning('Kayıt yüklenemedi: ' + e);
        SaveManager.deserialize(null);
      })
      .then(() => {
        this.scene.start('Game');
        this.scene.launch('UI');

        /* SERTİFİKASYON: gameReady() yalnızca oyun GERÇEKTEN oynanabilir
         * olduğunda çağrılmalı. Bu çağrıdan sonra reklam ve veri API'leri
         * güvenle kullanılabilir. */
        YT.gameReady();

        // İlk skor senkronu (liderlik tablosunda yer alsın).
        SaveManager.pushScore();
      });
  }

  /* --------------------------------------------------------------------
   * SDK yaşam döngüsü — SES ve PAUSE/RESUME
   * ------------------------------------------------------------------ */
  _wireSdkLifecycle() {
    /* SES: YouTube arayüzündeki hoparlör düğmesi. Oyunun kendi ayarı bunu
     * ezemez; bu callback tek otoritedir. */
    YT.onAudioEnabledChange((enabled) => {
      GameState.audioEnabled = !!enabled;
      this.game.sound.mute = !enabled;
      Sfx.setEnabled(!!enabled);   // kendi master gain'imiz de anında sussun
      // Global ses kaynağını da kapat (WebAudio context'i askıya alır).
      if (this.game.sound.context) {
        if (!enabled && this.game.sound.context.state === 'running') {
          this.game.sound.context.suspend().catch(() => {});
        } else if (enabled && this.game.sound.context.state === 'suspended') {
          this.game.sound.context.resume().catch(() => {});
        }
      }
      GameState.bus.emit('audio-change', GameState.audioEnabled);
      console.info('[YT] ses →', enabled ? 'AÇIK' : 'KAPALI');
    });

    /* PAUSE: Shorts akışında kaydırma, sekme değişimi, telefon kilidi...
     * Yapılması gerekenler: sesi sustur + oyun döngüsünü durdur + kaydet. */
    YT.onPause(() => {
      if (GameState.systemPaused) return;
      GameState.systemPaused = true;

      this.game.sound.mute = true;
      this.game.sound.pauseAll();
      Sfx.setEnabled(false);
      if (this.game.sound.context && this.game.sound.context.state === 'running') {
        this.game.sound.context.suspend().catch(() => {});
      }

      /* Tween/timer/fizik dursun.
       * !!! sys.pause() KULLANILIYOR, scene.pause() DEĞİL !!!
       * ScenePlugin.pause() işlemi SceneManager kuyruğuna yazar ve ancak bir
       * sonraki SceneManager.update()'te uygulanır. Hemen ardından
       * game.loop.sleep() çağırdığımız için o update HİÇ gelmez: sahne
       * duraklamaz, kuyrukta bekler ve resume anında işlenerek oyunu
       * geri döndüğümüzde DONMUŞ bırakır. sys.pause() ise anında etki eder. */
      const g = this.game.scene.getScene('Game');
      if (g && g.sys.isActive()) g.sys.pause();
      const u = this.game.scene.getScene('UI');
      if (u && u.sys.isActive()) u.sys.pause();

      // Ana döngüyü uyut → CPU/pil tüketimi düşer (Playables performans kriteri).
      this.game.loop.sleep();

      // Oyuncu geri dönmeyebilir: ilerlemeyi ANINDA yaz.
      SaveManager.flush();

      GameState.bus.emit('freeze-change');
      console.info('[YT] onPause → oyun donduruldu');
    });

    /* RESUME: Her şeyi geri al. Sesi AÇARKEN mutlaka isAudioEnabled()'a bak —
     * oyuncu arkadayken sesi kapatmış olabilir. */
    YT.onResume(() => {
      if (!GameState.systemPaused) return;
      GameState.systemPaused = false;

      this.game.loop.wake();

      const g = this.game.scene.getScene('Game');
      if (g && g.sys.isPaused()) g.sys.resume();
      const u = this.game.scene.getScene('UI');
      if (u && u.sys.isPaused()) u.sys.resume();

      // Sesi açarken DAİMA SDK'nın güncel durumuna bak: oyuncu arka plandayken
      // YouTube'un hoparlör düğmesini kapatmış olabilir.
      GameState.audioEnabled = YT.isAudioEnabled();
      this.game.sound.mute = !GameState.audioEnabled;
      Sfx.setEnabled(GameState.audioEnabled);
      if (GameState.audioEnabled) {
        if (this.game.sound.context && this.game.sound.context.state === 'suspended') {
          this.game.sound.context.resume().catch(() => {});
        }
        this.game.sound.resumeAll();
      }

      GameState.bus.emit('freeze-change');
      console.info('[YT] onResume → oyun devam ediyor');
    });
  }

  /* --------------------------------------------------------------------
   * Dokular kod ile üretiliyor: Playables'ta paket boyutu ve "harici asset
   * yok" kuralı kritik. Tek bir PNG bile yüklemiyoruz.
   * ------------------------------------------------------------------ */
  _buildTextures() {
    /* Kart dokuları Phaser Graphics yerine CANVAS 2D ile çiziliyor.
     * Sebebi: gerçek doğrusal gradyan, yumuşak iç gölge ve çift kenarlık
     * Graphics API'siyle mümkün değil. Sonuç yine tek doku olduğu için
     * çizim maliyeti değişmiyor — sadece görünüm derinlik kazanıyor. */
    const css = (n, a) => 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
    const yol = (ctx, x, y, w, h, r) => {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
    };

    const roundedTex = (key, w, h, fill, stroke, r) => {
      if (this.textures.exists(key)) return;
      const tex = this.textures.createCanvas(key, w, h);
      if (!tex) return;
      const ctx = tex.getContext();

      // 1) Gövde: üstten alta hafif açılan gradyan → hacim
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, css(fill, 1));
      grad.addColorStop(0.55, css(fill, 0.92));
      grad.addColorStop(1, css(0x141a4d, 0.96));   // nötr siyah değil, renkli dip
      yol(ctx, 1.5, 1.5, w - 3, h - 3, r);
      ctx.fillStyle = grad; ctx.fill();

      // 2) Üst kenar parlaması → cam hissi
      const parlak = ctx.createLinearGradient(0, 0, 0, h * 0.5);
      parlak.addColorStop(0, 'rgba(255,255,255,0.10)');
      parlak.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.save(); yol(ctx, 1.5, 1.5, w - 3, h - 3, r); ctx.clip();
      ctx.fillStyle = parlak; ctx.fillRect(0, 0, w, h * 0.5);
      ctx.restore();

      // 3) Nadirlik kenarlığı: dışta koyu, içte renkli ince çizgi
      yol(ctx, 1.5, 1.5, w - 3, h - 3, r);
      ctx.lineWidth = 3; ctx.strokeStyle = css(stroke, 0.95); ctx.stroke();
      yol(ctx, 4, 4, w - 8, h - 8, r - 2.5);
      ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(255,255,255,0.09)'; ctx.stroke();

      /* ERİŞİLEBİLİRLİK: nadirlik SADECE renkle anlatılırsa renk körü oyuncular
       * kademeleri ayırt edemez (dünya nüfusunun ~%8'i, ağırlıklı kırmızı-yeşil).
       * Bu yüzden sol üst köşeye kademe sayısı kadar NOKTA basıyoruz:
       * Temel 0 · Yaygın 1 · Nadir 2 · Destansı 3 · Efsanevi 4. */
      const kademe = typeof key === 'string' && key.indexOf('-r') !== -1
        ? parseInt(key.slice(key.lastIndexOf('-r') + 2), 10) : 0;
      if (kademe > 0) {
        for (let i = 0; i < kademe; i++) {
          ctx.beginPath();
          ctx.arc(15 + i * 11, 15, 3.4, 0, Math.PI * 2);
          ctx.fillStyle = css(stroke, 1); ctx.fill();
          ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.stroke();
        }
      }

      tex.refresh();
    };

    /* Arka plan: tek seferlik canvas dokusu — dikey gradyan + üstte sıcak
     * ışıma. Her karede yeniden çizilen Graphics yerine tek sprite. */
    if (!this.textures.exists('tex-bg')) {
      const bw = 360, bh = 640;                 // yarı çözünürlük, gerilerek çizilir
      const bt = this.textures.createCanvas('tex-bg', bw, bh);
      if (bt) {
        const c = bt.getContext();
        /* Dört renk durağı: menekşe → indigo → derin lacivert → dip.
         * Tek yönlü koyulaşma yerine HUE de kayıyor; gözün "renksiz" diye
         * okuduğu düz gradyan böyle kırılıyor. */
        const gr = c.createLinearGradient(0, 0, 0, bh);
        gr.addColorStop(0.00, '#3a1f7a');
        gr.addColorStop(0.30, '#2b2a8f');
        gr.addColorStop(0.68, '#14205e');
        gr.addColorStop(1.00, '#0b1038');
        c.fillStyle = gr; c.fillRect(0, 0, bw, bh);

        /* Dört radyal ışıma farklı hue'larda — kompozisyona renk çeşitliliği
         * katıyor. Sonuncusu SICAK (kehribar): soğuk zeminde tek sıcak nokta,
         * bakışı tahtanın ortasına çeker. */
        const isima = (x, y, yaricap, renk, guc) => {
          const rg = c.createRadialGradient(x, y, 0, x, y, yaricap);
          rg.addColorStop(0, 'rgba(' + renk + ',' + guc + ')');
          rg.addColorStop(1, 'rgba(' + renk + ',0)');
          c.fillStyle = rg; c.fillRect(0, 0, bw, bh);
        };
        isima(bw * 0.50, bh * 0.08, bw * 0.95, '63,233,255', 0.18);   // turkuaz, tepe
        isima(bw * 0.88, bh * 0.26, bw * 0.70, '255,79,216', 0.12);   // macenta, sağ üst
        isima(bw * 0.10, bh * 0.72, bw * 0.80, '155,92,255', 0.14);   // menekşe, sol alt
        isima(bw * 0.50, bh * 0.52, bw * 0.55, '255,166,61', 0.07);   // kehribar, merkez
        bt.refresh();
      }
    }

    roundedTex('tex-card',    LAYOUT.cardW, LAYOUT.cardH, PALETTE.card,   PALETTE.stroke,  24);
    roundedTex('tex-card-hi', LAYOUT.cardW, LAYOUT.cardH, PALETTE.cardHi, PALETTE.accent,  24);
    roundedTex('tex-slot',    LAYOUT.slotW, LAYOUT.slotH, PALETTE.panel,  PALETTE.stroke,  20);

    /* Nadirlik başına birer kart/slot dokusu (toplam 10 doku, sabit).
     * Çerçeve rengi elementin derinliğini bir bakışta anlatır. */
    RARITY.forEach((r, i) => {
      roundedTex('tex-card-r' + i, LAYOUT.cardW, LAYOUT.cardH, PALETTE.card,  r.cerceve, 24);
      roundedTex('tex-slot-r' + i, LAYOUT.slotW, LAYOUT.slotH, PALETTE.panel, r.cerceve, 20);
    });

    // Yumuşak ışıma (glow) — radyal gradyan canvas dokusu
    if (!this.textures.exists('tex-glow')) {
      const size = 160;
      const canvasTex = this.textures.createCanvas('tex-glow', size, size);
      const ctx = canvasTex.getContext();
      const grd = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      grd.addColorStop(0.00, 'rgba(255,255,255,0.95)');
      grd.addColorStop(0.45, 'rgba(255,255,255,0.28)');
      grd.addColorStop(1.00, 'rgba(255,255,255,0)');
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, size, size);
      canvasTex.refresh();
    }

    // Parçacık kıvılcımı
    if (!this.textures.exists('tex-spark')) {
      const g = this.add.graphics();
      g.fillStyle(0xffffff, 1);
      g.fillCircle(8, 8, 8);
      g.generateTexture('tex-spark', 16, 16);
      g.destroy();
    }
  }
}

/* ============================================================================
 * [9] GameScene — TAHTA · SÜRÜKLE-BIRAK · OVERLAP · BİRLEŞTİRME
 * ==========================================================================*/
class GameScene extends Phaser.Scene {
  constructor() { super('Game'); }

  create() {
    this._drawBackground();

    /** Tahtadaki tüm kartlar. */
    this.cards = this.add.group();
    /** Aynı anda kaç birleştirme uçuşta (AI bekliyor). */
    this.pendingMerges = 0;

    this._setupOverlap();
    this._setupTvInput();
    this._setupDragAndDrop();
    this._wireBus();

    this._dealStartingElements();

    // İlk oynayışta minik yönlendirme
    if (GameState.mergesDone === 0) {
      this.time.delayedCall(600, () => {
        UI.toast(this, t('tut1'),
                 { duration: 2800, color: PALETTE.accent });
      });
      this.time.delayedCall(3800, () => {
        if (!this._alive || GameState.mergesDone > 0) return;
        UI.toast(this, t('tut2'),
                 { duration: 2800, color: PALETTE.accent2, y: LAYOUT.boardBottom - 90 });
      });
    }
  }

  /* --------------------------------------------------------------------
   * Arka plan + tahta alanı
   * ------------------------------------------------------------------ */
  _drawBackground() {
    this.add.image(0, 0, 'tex-bg').setOrigin(0, 0).setDisplaySize(DESIGN.W, DESIGN.H);

    /* AURORA — iki büyük additive ışıma, çok yavaş süzülüyor.
     * Statik gradyan bir süre sonra "duvar kâğıdı" gibi ölür; hafif hareket
     * arka planı canlı tutar. Maliyet: 2 sprite, 4 tween — ölçülemeyecek kadar
     * az (kare süresi ölçümünde fark görünmedi). */
    this._aurora = [];
    [[0.28, 0.22, PALETTE.accent3, 3.2, 26000],
     [0.74, 0.62, PALETTE.accent,  3.6, 32000]].forEach(([px, py, renk, olcek, sure]) => {
      const a = this.add.image(DESIGN.W * px, DESIGN.H * py, 'tex-glow')
        .setScale(olcek).setAlpha(0.13).setTint(renk)
        .setBlendMode(Phaser.BlendModes.ADD).setDepth(-10);
      this._aurora.push(a);
      this.tweens.add({ targets: a, x: a.x + DESIGN.W * 0.22, y: a.y - DESIGN.H * 0.10,
                        duration: sure, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.tweens.add({ targets: a, alpha: { from: 0.09, to: 0.19 },
                        duration: sure * 0.4, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    });

    // Yıldız tozu (dekoratif, statik → performans dostu)
    const stars = this.add.graphics();
    const rnd = new Phaser.Math.RandomDataGenerator(['omnimerge']);
    for (let i = 0; i < 70; i++) {
      stars.fillStyle(0xffffff, rnd.realInRange(0.07, 0.26));
      stars.fillCircle(rnd.between(0, DESIGN.W), rnd.between(0, DESIGN.H), rnd.realInRange(1, 2.4));
    }

    // Tahta çerçevesi
    const bt = LAYOUT.boardTop, bb = LAYOUT.boardBottom;
    const board = this.add.graphics();
    board.fillStyle(0x0c1138, 0.55);
    board.fillRoundedRect(16, bt + 8, DESIGN.W - 32, bb - bt - 16, 28);
    board.lineStyle(2, PALETTE.stroke, 0.35);
    board.strokeRoundedRect(16, bt + 8, DESIGN.W - 32, bb - bt - 16, 28);
  }

  /* --------------------------------------------------------------------
   * OVERLAP KURULUMU
   * Gerçek bir Arcade "overlap" collider'ı kuruyoruz. Her fizik adımında
   * çakışan kart çiftlerini işaretler; ama BİRLEŞTİRMEYİ ANINDA YAPMAZ —
   * sadece adayı kaydeder. Birleştirme parmak kaldırıldığında (dragend)
   * gerçekleşir. Böylece oyuncu kartı sürüklerken üstünden geçtiği her
   * karta yapışmaz; hedefi görüp bırakır.
   * ------------------------------------------------------------------ */
  _setupOverlap() {
    /* Collider her fizik adımında TÜM kart çiftlerini (N²) kontrol eder.
     * Oysa çakışma bilgisi yalnızca bir kart SÜRÜKLENİRKEN gerekli. Bu yüzden
     * collider'ı varsayılan olarak KAPALI tutup dragstart'ta açıyor,
     * dragend'de kapatıyoruz. Boşta duran tahtada sıfır fizik işi yapılır. */
    this._overlapCollider = this.physics.add.overlap(
      this.cards, this.cards,
      (a, b) => this._onCardsOverlap(a, b),
      (a, b) => a !== b && !a.busy && !b.busy,   // processCallback (ön filtre)
      this
    );
    this._overlapCollider.active = false;
  }

  _onCardsOverlap(a, b) {
    const frame = this.game.loop.frame;
    // Sadece sürüklenen kart için aday kaydediyoruz.
    if (a.dragging) this._recordCandidate(a, b, frame);
    if (b.dragging) this._recordCandidate(b, a, frame);
  }

  _recordCandidate(dragged, other, frame) {
    const area = this._overlapArea(dragged, other);
    if (dragged._ovFrame !== frame) {
      dragged._ovFrame = frame;
      dragged._ovTarget = null;
      dragged._ovArea = 0;
    }
    if (area > dragged._ovArea) {
      dragged._ovArea = area;
      dragged._ovTarget = other;
    }
  }

  /** Kartın gerçek dikdörtgeni.
   *  Container.getBounds() KULLANILMAZ: kartın içindeki 'glow' görseli
   *  1.35 ölçekli olduğu için sınırları şişirir ve çakışma oranını bozar. */
  _cardRect(c, out) {
    const w = LAYOUT.cardW * (c.scaleX || 1);
    const h = LAYOUT.cardH * (c.scaleY || 1);
    return out.setTo(c.x - w / 2, c.y - h / 2, w, h);
  }

  /** İki kartın kesişim ORANI (0..1). */
  _overlapArea(a, b) {
    const ra = this._cardRect(a, GameScene._r1);
    const rb = this._cardRect(b, GameScene._r2);
    const w = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
    const h = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
    if (w <= 0 || h <= 0) return 0;
    return (w * h) / (LAYOUT.cardW * LAYOUT.cardH);
  }

  /** dragend anında geçerli hedefi bul. Fizik adımı gecikirse sınır
   *  kesişimine düşen bir yedek yol da var (garantili çalışsın diye). */
  _resolveDropTarget(card) {
    const frame = this.game.loop.frame;
    if (card._ovTarget && card._ovTarget.active &&
        frame - (card._ovFrame || -99) <= 2 &&
        card._ovArea >= TUNING.mergeOverlapRatio) {
      return card._ovTarget;
    }
    // Yedek: doğrudan geometrik tarama
    let best = null, bestArea = TUNING.mergeOverlapRatio;
    this.cards.getChildren().forEach((other) => {
      if (other === card || !other.active || other.busy) return;
      const area = this._overlapArea(card, other);
      if (area > bestArea) { bestArea = area; best = other; }
    });
    return best;
  }

  /* --------------------------------------------------------------------
   * SÜRÜKLE-BIRAK
   * ------------------------------------------------------------------ */
  _setupDragAndDrop() {
    this.input.dragDistanceThreshold = 4;

    this.input.on('dragstart', (pointer, obj) => {
      if (!(obj instanceof ElementCard) || obj.busy) return;
      obj.dragging = true;
      Sfx.al();
      this.children.bringToTop(obj);
      obj.setDepth(500);
      if (this._overlapCollider) this._overlapCollider.active = true;   // fizik AÇ
      this._sonVurgu = null;
      this.tweens.add({ targets: obj, scale: 1.12, duration: 130, ease: 'Back.easeOut' });
    });

    this.input.on('drag', (pointer, obj, dragX, dragY) => {
      if (!(obj instanceof ElementCard) || obj.busy) return;
      // Kart tahtanın dışına çıkmasın.
      obj.x = clamp(dragX, LAYOUT.cardW / 2 + 22, DESIGN.W - LAYOUT.cardW / 2 - 22);
      obj.y = clamp(dragY, LAYOUT.boardTop + LAYOUT.cardH / 2 + 18,
                           LAYOUT.boardBottom - LAYOUT.cardH / 2 - 18);

      /* Hedef vurgusu.
       * Eskiden her fare hareketinde TÜM kartlar dolaşılıp setHighlight
       * çağrılıyordu. Artık yalnızca değişen iki kart güncelleniyor:
       * eski vurgulanan söndürülür, yenisi yakılır. */
      const t = this._resolveDropTarget(obj);
      if (t !== this._sonVurgu) {
        if (this._sonVurgu && this._sonVurgu.active) this._sonVurgu.setHighlight(false);
        if (t && t !== obj) { t.setHighlight(true); Sfx.vurgula(); }
        this._sonVurgu = t;
      }
    });

    /* Harici (kütüphaneden başlayan) sürüklemenin sürücüsü. */
    this.input.on('pointermove', (pointer) => {
      const card = this._extDrag;
      if (!card || !card.active) return;
      card.x = clamp(pointer.worldX, LAYOUT.cardW / 2 + 22, DESIGN.W - LAYOUT.cardW / 2 - 22);
      card.y = clamp(pointer.worldY, LAYOUT.boardTop + LAYOUT.cardH / 2 + 18,
                                      LAYOUT.boardBottom - LAYOUT.cardH / 2 - 18);
      const t = this._resolveDropTarget(card);
      if (t !== this._sonVurgu) {
        if (this._sonVurgu && this._sonVurgu.active) this._sonVurgu.setHighlight(false);
        if (t && t !== card) { t.setHighlight(true); Sfx.vurgula(); }
        this._sonVurgu = t;
      }
    });

    const bitirHariciSurukleme = (pointer) => {
      const card = this._extDrag;
      if (!card) return;
      this._extDrag = null;
      if (!card.active) return;

      // Kütüphaneden çıkarıp geri bıraktıysa: kartı iptal et
      if (pointer && pointer.worldY > LAYOUT.boardBottom - 10) {
        if (this._sonVurgu && this._sonVurgu.active) this._sonVurgu.setHighlight(false);
        this._sonVurgu = null;
        if (this._overlapCollider) this._overlapCollider.active = false;
        Sfx.birak();
        card.vanish(120);
        return;
      }
      card.dragging = false;
      card.setDepth(0);
      this.tweens.add({ targets: card, scale: 1, duration: 150, ease: 'Back.easeOut' });

      const target = this._resolveDropTarget(card);
      if (this._sonVurgu && this._sonVurgu.active) this._sonVurgu.setHighlight(false);
      this._sonVurgu = null;
      if (this._overlapCollider) this._overlapCollider.active = false;

      if (target && !target.busy && !card.busy) this.mergeCards(card, target);
      else { Sfx.birak(); this._nudgeApart(card); }
    };
    this.input.on('pointerup', bitirHariciSurukleme);
    this.input.on('pointerupoutside', bitirHariciSurukleme);

    this.input.on('dragend', (pointer, obj) => {
      if (!(obj instanceof ElementCard)) return;
      obj.dragging = false;
      obj.setDepth(0);
      this.tweens.add({ targets: obj, scale: 1, duration: 150, ease: 'Back.easeOut' });

      const target = this._resolveDropTarget(obj);
      if (this._sonVurgu && this._sonVurgu.active) this._sonVurgu.setHighlight(false);
      this._sonVurgu = null;
      if (this._overlapCollider) this._overlapCollider.active = false;  // fizik KAPAT

      /* TEK KART SİLME — kartı aşağı, çekmecenin üstüne bırak.
       * Daha önce yalnızca "hepsini temizle" vardı; tahtayı düzenlemenin
       * tek yolu her şeyi silmekti. Parmağın bıraktığı NOKTA çekmecedeyse
       * kart kütüphaneye geri konur (kütüphaneden zaten silinmez). */
      if (pointer && pointer.worldY > LAYOUT.boardBottom - 10 && !obj.busy) {
        Sfx.birak();
        this._burst(obj.x, obj.y, false);
        obj.vanish(150);
        obj._ovTarget = null; obj._ovArea = 0;
        return;
      }

      if (target && !target.busy && !obj.busy) {
        this.mergeCards(obj, target);
      } else {
        Sfx.birak();
      }
      obj._ovTarget = null; obj._ovArea = 0;
    });
  }

  /* --------------------------------------------------------------------
   * Event bus bağlantıları (UIScene ile iletişim)
   * ------------------------------------------------------------------ */
  _wireBus() {
    this._alive = true;

    /* DİNLEYİCİ KAYDI — bağlamla değil, FONKSİYON REFERANSIYLA kaldırılmalı.
     * EventEmitter3'te `off(olay, null, bağlam)` çağrısı, fonksiyon verilmediği
     * için bağlamı YOK SAYAR ve o olayın TÜM dinleyicilerini siler. Bu yüzden
     * GameScene kapandığında UIScene'in 'language-change' dinleyicisi de
     * siliniyordu; dil değişince arayüz metinleri güncellenmiyordu.
     * Artık her kaydı saklıyor ve tam referansıyla kaldırıyoruz. */
    this._busKayit = [];
    const on = (k, fn) => { GameState.bus.on(k, fn, this); this._busKayit.push([k, fn]); };

    on('spawn-element', (name) => {
      const e = GameState.get(name);
      if (!e) return;
      // Tahtada boş bir yere koy.
      const p = this._findFreeSpot();
      const c = this.spawnCard(e, p.x, p.y);
      c.popIn();
      this._nudgeApart(c);
    });

    /* Kütüphaneden gelen sürükleme: kartı doğur ve parmağa yapıştır.
     * Phaser'ın kendi drag'ı sahneler arası devredilemediği için sürüklemeyi
     * burada elle yürütüyoruz (aşağıdaki pointermove/pointerup). */
    on('drag-spawn', ({ name, x, y }) => {
      const e = GameState.get(name);
      if (!e || this._extDrag) return;
      const cx = clamp(x, LAYOUT.cardW / 2 + 22, DESIGN.W - LAYOUT.cardW / 2 - 22);
      const cy = clamp(y, LAYOUT.boardTop + LAYOUT.cardH / 2 + 18,
                          LAYOUT.boardBottom - LAYOUT.cardH / 2 - 18);
      const card = this.spawnCard(e, cx, cy);
      card.setScale(0.3).setAlpha(0.9);
      this.tweens.add({ targets: card, scale: 1.12, alpha: 1, duration: 150, ease: 'Back.easeOut' });
      card.dragging = true;
      card.setDepth(500);
      this.children.bringToTop(card);
      this._extDrag = card;
      this._sonVurgu = null;
      if (this._overlapCollider) this._overlapCollider.active = true;
      Sfx.al();
    });

    /* Dil değişti: tahtadaki kartların yüz dokusunu yenile. Element nesneleri
     * setLanguage() içinde yerinde güncellendiği için ad zaten yeni. */
    on('language-change', () => {
      this.cards.getChildren().forEach((c) => {
        if (!c.active) return;
        // Kimliği olan kart yeni dilde yeniden adlandırılır; AI kartları aynen kalır.
        if (c.elem.id && ELEMENTS[c.elem.id]) {
          c.elem.name = elemName(c.elem.id);
          c.elem.emoji = elemEmoji(c.elem.id);
        }
        c.face.setTexture(FaceTextures.get(this, c.elem));
        c.rarity = rarityIndex(c.elem.tier);
        c.bg.setTexture('tex-card-r' + c.rarity);
      });
    });

    on('clear-board', () => {
      this.cards.getChildren().slice().forEach((c) => { if (!c.busy) c.vanish(140); });
      this.time.delayedCall(200, () => this._dealStartingElements());
    });

    // Sahne kapanırken dinleyicileri bırak (bellek sızıntısı olmasın).
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this._alive = false;
      // Aurora sonsuz tween kullanıyor — sahne kapanırken mutlaka durdur.
      if (this._aurora) this.tweens.killTweensOf(this._aurora);
      this._busKayit.forEach(([k, fn]) => GameState.bus.off(k, fn, this));
      this._busKayit.length = 0;
    });
  }

  /* --------------------------------------------------------------------
   * Kart üretimi ve yerleşim
   * ------------------------------------------------------------------ */
  spawnCard(elem, x, y) {
    const card = new ElementCard(this, x, y, elem);
    this.cards.add(card);
    return card;
  }

  _dealStartingElements() {
    // OYUN BURADAN BAŞLAR: sadece 4 temel element.
    const cx = DESIGN.W / 2;
    const cy = (LAYOUT.boardTop + LAYOUT.boardBottom) / 2;
    /* 6 element → 3 sütun x 2 satır.
     * SATIR ARALIĞI ASLA KART YÜKSEKLİĞİNDEN KÜÇÜK OLAMAZ. Önceki sürüm
     * aralığı tahtanın oranından hesaplıyordu; kısa ekranda (tablet/TV, tahta
     * 470 px) aralık 113 px'e düşüyor ve 130 px'lik kartlar ÜST ÜSTE BİNİYORDU.
     * Artık taban kart yüksekliği + 26 px; blok tahtada dikey ortalanıp
     * hafifçe yukarı alınıyor, altta keşiflere alan kalıyor. */
    const bH = LAYOUT.boardBottom - LAYOUT.boardTop;
    const ara = Math.max(LAYOUT.cardH + 26, bH * 0.22);
    const merkez = LAYOUT.boardTop + bH * 0.42;
    const y1 = merkez - ara / 2;
    const y2 = merkez + ara / 2;
    const sx = Math.min(190, (DESIGN.W - LAYOUT.cardW) / 2 - 30);
    const spots = [
      { x: cx - sx, y: y1 }, { x: cx, y: y1 }, { x: cx + sx, y: y1 },
      { x: cx - sx, y: y2 }, { x: cx, y: y2 }, { x: cx + sx, y: y2 },
    ];
    BASE_IDS.forEach((id, i) => {
      const e = GameState.get(elemName(id));
      if (!e) return;
      this.spawnCard(e, spots[i].x, spots[i].y).popIn(i * 70);
    });
  }

  /** Mevcut kartlarla çakışmayan bir konum bul. */
  _findFreeSpot() {
    const minX = LAYOUT.cardW / 2 + 34;
    const maxX = DESIGN.W - LAYOUT.cardW / 2 - 34;
    const minY = LAYOUT.boardTop + LAYOUT.cardH / 2 + 28;
    const maxY = LAYOUT.boardBottom - LAYOUT.cardH / 2 - 28;

    for (let tries = 0; tries < 40; tries++) {
      const x = Phaser.Math.Between(minX, maxX);
      const y = Phaser.Math.Between(minY, maxY);
      const clash = this.cards.getChildren().some(
        (c) => Phaser.Math.Distance.Between(c.x, c.y, x, y) < LAYOUT.cardW * 0.95
      );
      if (!clash) return { x, y };
    }
    return { x: Phaser.Math.Between(minX, maxX), y: Phaser.Math.Between(minY, maxY) };
  }


  /* ====================================================================
   * TV / KUMANDA DESTEĞİ
   * --------------------------------------------------------------------
   *  Playables yalnızca telefonda değil TELEVİZYONDA da çalışır. Sürükle-bırak
   *  temelli bir oyun D-pad ile oynanamaz; bu bir sertifikasyon riskidir.
   *
   *  Android TV kumandaları tarayıcıya ok tuşları + Enter olarak ulaşır, bu
   *  yüzden klavye yeterlidir (gamepad de açık tutuluyor).
   *
   *  ETKİLEŞİM MODELİ — iki adımlı, sürüklemesiz:
   *    Ok tuşları  → odağı en yakın karta taşı (yön duyarlı)
   *    Enter/Space → 1. basış: kaynağı seç · 2. basış: odaktaki kartla birleştir
   *    Aşağı ok    → tahtanın altından kütüphaneye geç
   *    Enter       → kütüphanede: elementi tahtaya bırak
   *    Esc/Backsp. → seçimi iptal et / tahtaya dön
   *
   *  Arayüz yalnızca ilk tuşa basıldığında görünür: dokunmatik oyuncu hiçbir
   *  şey fark etmez.
   * ==================================================================*/
  _setupTvInput() {
    this._tvAktif = false;
    this._tvBolge = 'board';      // 'board' | 'library'
    this._tvOdak = null;          // odaktaki kart (tahta)
    this._tvLibIdx = 0;           // odaktaki kütüphane sırası
    this._tvKaynak = null;        // seçili kaynak kart

    const kb = this.input.keyboard;
    if (!kb) return;

    // Tarayıcı sayfayı kaydırmasın
    kb.addCapture(['UP', 'DOWN', 'LEFT', 'RIGHT', 'SPACE', 'ENTER', 'ESC', 'BACKSPACE']);

    this._tvHalka = this.add.graphics().setDepth(600).setVisible(false);

    kb.on('keydown', (e) => {
      if (GameState.isFrozen()) return;
      const k = e.key;
      const yonler = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };

      if (!this._tvAktif) {
        // İlk tuş: TV modunu aç, odağı ilk karta koy
        if (!yonler[k] && k !== 'Enter' && k !== ' ') return;
        this._tvAktif = true;
        this._tvOdak = this.cards.getChildren()[0] || null;
        this._tvCiz();
        UI.toast(this, t('tvHint'), { y: LAYOUT.boardTop + 56, duration: 3200, color: PALETTE.accent });
        return;
      }

      if (yonler[k]) { e.preventDefault(); this._tvHareket(yonler[k][0], yonler[k][1]); }
      else if (k === 'Enter' || k === ' ') { e.preventDefault(); this._tvOnayla(); }
      else if (k === 'Escape' || k === 'Backspace') { e.preventDefault(); this._tvIptal(); }
    });
  }

  /** Yön duyarlı en yakın kart: önce o yönde olanlar, sonra en yakın olan. */
  _tvEnYakin(dx, dy) {
    const o = this._tvOdak;
    if (!o) return this.cards.getChildren()[0] || null;
    let en = null, enSkor = Infinity;
    this.cards.getChildren().forEach((c) => {
      if (c === o || !c.active) return;
      const vx = c.x - o.x, vy = c.y - o.y;
      const ileri = vx * dx + vy * dy;              // istenen yöndeki mesafe
      if (ileri <= 8) return;                        // yanlış yönde
      const yan = Math.abs(vx * dy - vy * dx);       // yana sapma
      const skor = ileri + yan * 2.2;                // sapmayı cezalandır
      if (skor < enSkor) { enSkor = skor; en = c; }
    });
    return en;
  }

  _tvHareket(dx, dy) {
    Sfx.vurgula();

    if (this._tvBolge === 'library') {
      const ui = this.game.scene.getScene('UI');
      const toplam = ui.libItems.length;
      if (dy < 0 && this._tvLibIdx < LIB_COLS) { this._tvBolge = 'board'; ui._tvHalkaGizle(); this._tvCiz(); return; }
      let i = this._tvLibIdx + (dx !== 0 ? dx : dy * LIB_COLS);
      this._tvLibIdx = clamp(i, 0, toplam - 1);
      ui._tvOdakla(this._tvLibIdx);
      return;
    }

    const hedef = this._tvEnYakin(dx, dy);
    if (hedef) { this._tvOdak = hedef; this._tvCiz(); return; }

    // Tahtanın altından kütüphaneye geç
    if (dy > 0) {
      this._tvBolge = 'library';
      this._tvHalka.setVisible(false);
      this.game.scene.getScene('UI')._tvOdakla(this._tvLibIdx);
    }
  }

  _tvOnayla() {
    if (this._tvBolge === 'library') {
      const ui = this.game.scene.getScene('UI');
      const elem = ui.libItems[this._tvLibIdx];
      if (!elem) return;
      if (elem.isNew) elem.isNew = false;
      GameState.bus.emit('spawn-element', elem.name);
      Sfx.al();
      // Yeni kart tahtada; odağı ona ver
      this.time.delayedCall(60, () => {
        this._tvBolge = 'board';
        ui._tvHalkaGizle();
        this._tvOdak = this.cards.getChildren().slice(-1)[0] || this._tvOdak;
        this._tvCiz();
      });
      return;
    }

    const o = this._tvOdak;
    if (!o || o.busy) return;

    if (!this._tvKaynak) {                    // 1. basış: kaynağı seç
      this._tvKaynak = o;
      o.setHighlight(true);
      Sfx.al();
      this._tvCiz();
    } else if (this._tvKaynak === o) {        // aynı karta basış: seçimi bırak
      this._tvIptal();
    } else {                                  // 2. basış: birleştir
      const kaynak = this._tvKaynak;
      this._tvKaynak = null;
      kaynak.setHighlight(false);
      this._tvHalka.setVisible(false);
      this.mergeCards(kaynak, o);
      this.time.delayedCall(120, () => {
        this._tvOdak = this.cards.getChildren()[0] || null;
        this._tvCiz();
      });
    }
  }

  _tvIptal() {
    if (this._tvKaynak) { this._tvKaynak.setHighlight(false); this._tvKaynak = null; }
    if (this._tvBolge === 'library') {
      this._tvBolge = 'board';
      this.game.scene.getScene('UI')._tvHalkaGizle();
    }
    this._tvCiz();
  }

  /** Odak halkasını çiz. Seçili kaynak varsa renk değişir. */
  _tvCiz() {
    const g = this._tvHalka;
    g.clear();
    if (!this._tvAktif || this._tvBolge !== 'board' || !this._tvOdak || !this._tvOdak.active) {
      g.setVisible(false);
      return;
    }
    const c = this._tvOdak;
    const w = LAYOUT.cardW + 16, h = LAYOUT.cardH + 16;
    const renk = this._tvKaynak ? PALETTE.accent3 : PALETTE.accent;
    g.lineStyle(4, renk, 1);
    g.strokeRoundedRect(c.x - w / 2, c.y - h / 2, w, h, 28);
    g.setVisible(true);
  }

  /* --------------------------------------------------------------------
   * BİRLEŞTİRME AKIŞI — oyunun kalbi
   * --------------------------------------------------------------------
   *  1. İki kart merkeze doğru emilir ve yok edilir
   *  2. Yerlerinde LoadingOrb (AI yanıtı bekleniyor) döner
   *  3. AI.combine() → cache / TamgaStudio / çevrimdışı motor
   *  4. Sonuç kartı doğar, parçacıklar patlar, kütüphane güncellenir
   *  5. Kayıt + liderlik tablosu + (gerekiyorsa) reklam tetiklenir
   * ------------------------------------------------------------------ */
  async mergeCards(dragged, target) {
    if (dragged.busy || target.busy) return;

    const a = { name: dragged.elem.name, emoji: dragged.elem.emoji, tier: dragged.elem.tier };
    const b = { name: target.elem.name,  emoji: target.elem.emoji,  tier: target.elem.tier };

    const mx = (dragged.x + target.x) / 2;
    const my = (dragged.y + target.y) / 2;

    dragged.busy = true;
    target.busy = true;
    this.pendingMerges++;
    GameState.bus.emit('merge-state', true);

    let orb = null;
    let slowTimer = null;

    try {
      // 1) Emilme animasyonu
      await Promise.all([dragged.absorbTo(mx, my), target.absorbTo(mx, my)]);
      if (!this._alive) return;
      dragged.destroy();
      target.destroy();

      Sfx.birlesme();

      // 2) YÜKLEME ANİMASYONU — API yanıtı gelene kadar ekranda kalır
      orb = new LoadingOrb(this, mx, my);
      slowTimer = this.time.delayedCall(2400, () => {
        if (orb && orb.active) orb.setCaption(t('thinking'));
      });

      // 3) AI (veya cache / çevrimdışı motor)
      const result = await AI.combine(a.name, b.name);

      if (slowTimer) { slowTimer.remove(); slowTimer = null; }
      if (!this._alive) return;

      orb.close();
      orb = null;

      // 4-5) Sonucu uygula
      this._applyMergeResult(a, b, result, mx, my);
    } catch (err) {
      YT.logError('Birleştirme hatası: ' + (err && err.message ? err.message : err));
      if (slowTimer) slowTimer.remove();
      if (orb) orb.close();
      if (this._alive) {
        Sfx.hata();
        UI.toast(this, t('error'), { color: PALETTE.bad });
      }
    } finally {
      this.pendingMerges = Math.max(0, this.pendingMerges - 1);
      GameState.bus.emit('merge-state', this.pendingMerges > 0);
    }
  }

  _applyMergeResult(a, b, result, x, y) {
    /* Nadirlik tılsımı aktifse sonuç kademesi yükselir → daha nadir kart,
     * daha çok puan ve daha çok Öz.
     *
     * ÖNEMLİ: Tılsım YALNIZCA gerçekten yeni bir keşif çıktığında harcanır.
     * İlk sürümde sonuç zaten kütüphanedeyse tılsım tükeniyor ama hiçbir işe
     * yaramıyordu (mevcut elementin kademesi korunur) — ücretli bir üründe
     * bu kabul edilemez. Artık ödeme, ancak fayda üretildiğinde alınır. */
    const temelTier = Math.max(a.tier | 0, b.tier | 0) + 1;
    const tilsimVar = GameState.charmLeft > 0;
    const tier = tilsimVar ? temelTier + TUNING.tilsimKademe : temelTier;

    const isNew = GameState.add(result.name, result.emoji, tier, result.id);
    const tilsimliMi = tilsimVar && isNew;
    if (tilsimliMi) GameState.charmLeft--;
    const elem = GameState.get(result.name);

    GameState.mergesDone++;

    // Sonuç kartı doğar
    const card = this.spawnCard(elem, x, y);
    card.popIn();
    this._burst(x, y, isNew);

    /* Yeni kart başka bir kartın tam üstüne düşerse alttaki kart TIKLANAMAZ
     * hale gelir (Phaser topOnly) ve oyuncu "tepki vermiyor" diye algılar.
     * Bu yüzden çakışan komşuları nazikçe iteliyoruz. */
    this._nudgeApart(card);

    if (isNew) {
      // Keşif Öz kazandırır; derin keşif daha çok kazandırır.
      GameState.essence += rarityOf(elem.tier).puan;
      Sfx.kesif(rarityIndex(elem.tier));
      const nad = rarityOf(elem.tier);

      /* Nadir (2) ve üstü keşiflerde toast yetmiyor: bulgu ekranın ortasında
       * kartıyla birlikte açılıyor. Yaygın keşiflerde akışı kesmemek için
       * eski hafif bildirim korunuyor — kutlama enflasyonu heyecanı öldürür. */
      // Tılsımla gelen keşif ayrıca vurgulanır — ödemenin karşılığı görünsün
      if (tilsimliMi) {
        UI.toast(this, t('charmProc', { n: GameState.charmLeft }),
                 { y: LAYOUT.boardTop + 60, color: PALETTE.accent2, duration: 2000 });
      }
      if (rarityIndex(elem.tier) >= 2) this._kesifAcilisi(elem, nad);
      else UI.toast(this, t('discovery', { r: rarityName(elem.tier), e: elem.emoji, n: elem.name }),
                    { color: nad.renk, duration: 2000 });
      GameState.bus.emit('discovery', elem);

      // BULUT KAYDI + LİDERLİK TABLOSU
      SaveManager.requestSave();
      SaveManager.pushScore();

      // Reklamı hemen değil, keşif kutlaması bittikten sonra iste:
      // bu "doğal duraklama" kuralının pratikteki karşılığıdır.
      this.time.delayedCall(1000, () => this._maybeRequestAd());
    } else {
      Sfx.bilinen();
      UI.toast(this, t('known', { e: elem.emoji, n: elem.name }),
               { color: PALETTE.dim, duration: 1400 });
      SaveManager.requestSave();
    }

    if (result.source === 'offline') GameState.bus.emit('ai-offline');
    GameState.bus.emit('state-change');

    // Günlük hedef tamamlandı mı?
    if (isNew && GameState.dailyCount === TUNING.dailyTarget) {
      GameState.freeHints++;
      SaveManager.requestSave();
      this.time.delayedCall(700, () => {
        if (!this._alive) return;
        Sfx.donum();
        GameState.essence += TUNING.ozOdul.gunluk;
      GameState.bus.emit('daily-done');
      });
    }

    // Kilometre taşı: kısa oturumda bile "bir yere vardım" hissi
    if (isNew && TUNING.milestones.indexOf(GameState.score) !== -1) {
      this.time.delayedCall(500, () => {
        if (!this._alive) return;
        Sfx.donum();
        GameState.bus.emit('milestone', GameState.score);
      });
    }
  }

  /** Nadir+ keşif için ekranın ortasında kısa kart açılışı. */
  _kesifAcilisi(elem, nad) {
    const cx = DESIGN.W / 2;
    const cy = (LAYOUT.boardTop + LAYOUT.boardBottom) / 2 - 40;
    const c = this.add.container(cx, cy).setDepth(1450);

    const halka = this.add.image(0, 0, 'tex-glow')
      .setScale(3.4).setAlpha(0).setTint(nad.renk).setBlendMode(Phaser.BlendModes.ADD);
    const kart = this.add.image(0, 0, 'tex-card-r' + rarityIndex(elem.tier)).setScale(1.55);
    const yuz  = this.add.image(0, 0, FaceTextures.get(this, elem)).setScale(1.55);
    const etiket = this.add.text(0, 132, rarityName(elem.tier), {
      fontFamily: FONTS.ui, fontSize: '22px', fontStyle: '800', color: hex(nad.renk),
    }).setOrigin(0.5);

    c.add([halka, kart, yuz, etiket]);
    c.setScale(0.4).setAlpha(0);

    this.tweens.add({ targets: c, scale: 1, alpha: 1, duration: 330, ease: 'Back.easeOut' });
    this.tweens.add({ targets: halka, alpha: 0.55, duration: 300, yoyo: true, hold: 500 });
    this.tweens.add({ targets: c, angle: { from: -4, to: 4 }, duration: 900, yoyo: true, ease: 'Sine.easeInOut' });
    this.tweens.add({
      targets: c, alpha: 0, scale: 0.85, y: cy - 50, delay: 1250, duration: 350,
      onComplete: () => { this.tweens.killTweensOf([c, halka]); c.destroy(); },
    });
  }

  /** Çakışan komşuları iterek her kartın tıklanabilir kalmasını sağlar. */
  _nudgeApart(card) {
    const minDist = LAYOUT.cardW * 0.94;
    const minX = LAYOUT.cardW / 2 + 26, maxX = DESIGN.W - LAYOUT.cardW / 2 - 26;
    const minY = LAYOUT.boardTop + LAYOUT.cardH / 2 + 20;
    const maxY = LAYOUT.boardBottom - LAYOUT.cardH / 2 - 20;

    this.cards.getChildren().forEach((o) => {
      if (o === card || !o.active || o.busy || o.dragging) return;
      const d = Phaser.Math.Distance.Between(card.x, card.y, o.x, o.y);
      if (d >= minDist) return;
      const ang = (d < 1)
        ? Phaser.Math.FloatBetween(0, Math.PI * 2)
        : Math.atan2(o.y - card.y, o.x - card.x);
      const push = (minDist - d) + 8;
      this.tweens.add({
        targets: o,
        x: clamp(o.x + Math.cos(ang) * push, minX, maxX),
        y: clamp(o.y + Math.sin(ang) * push, minY, maxY),
        duration: 240, ease: 'Cubic.easeOut',
      });
    });
  }

  /** Kutlama parçacıkları. */
  _burst(x, y, big) {
    const qty = big ? 36 : 16;
    const em = this.add.particles(x, y, 'tex-spark', {
      speed:    { min: 90, max: big ? 400 : 230 },
      angle:    { min: 0, max: 360 },
      scale:    { start: big ? 0.95 : 0.6, end: 0 },
      alpha:    { start: 1, end: 0 },
      lifespan: { min: 320, max: big ? 950 : 620 },
      blendMode: 'ADD',
      tint: [PALETTE.accent, PALETTE.accent2, PALETTE.accent3, 0xffffff],
      emitting: false,
    });
    em.setDepth(800);
    em.explode(qty);
    this.time.delayedCall(1200, () => em.destroy());
  }

  /* --------------------------------------------------------------------
   * REKLAM TETİKLEYİCİ (interstitial)
   * --------------------------------------------------------------------
   *  Playables kuralı: geçiş reklamı YALNIZCA doğal duraklamalarda.
   *  Bizim doğal duraklamamız = "10 yeni element keşfedildi, kutlama bitti,
   *  ekranda uçuşta başka birleştirme yok". Bu üç koşul sağlanmazsa reklam
   *  istenmez. Reklamın kendisini UIScene yönetir (oyunu duraklatır, susturur).
   * ------------------------------------------------------------------ */
  _maybeRequestAd() {
    if (!this._alive) return;
    if (GameState.discoveriesSinceAd < TUNING.adsEveryNDiscoveries) return;
    if (this.pendingMerges > 0) return;      // hâlâ AI bekleyen birleştirme var
    if (GameState.isFrozen()) return;        // zaten donmuş (pause/modal)

    GameState.discoveriesSinceAd = 0;
    SaveManager.requestSave();
    GameState.bus.emit('request-interstitial');
  }
}

/** Çakışma hesabı için yeniden kullanılan geçici dikdörtgenler (GC dostu). */
GameScene._r1 = new Phaser.Geom.Rectangle();
GameScene._r2 = new Phaser.Geom.Rectangle();

/* ============================================================================
 * [10] UIScene — HUD · KÜTÜPHANE · MODALLAR · REKLAM AKIŞLARI
 * ----------------------------------------------------------------------------
 *  GameScene ile paralel çalışır. Ayrı sahne olmasının sebebi: reklam ya da
 *  modal sırasında GameScene'i `scene.pause()` ile tamamen dondururken
 *  arayüzün canlı kalabilmesi.
 * ==========================================================================*/
class UIScene extends Phaser.Scene {
  constructor() { super('UI'); }

  create() {
    this._alive = true;
    this.libItems = [];      // veri (tüm keşifler)
    this._pool = [];         // görünüm havuzu (yalnızca ekrandakiler)

    this._buildHud();
    this._buildDrawer();
    this._buildLibrary();
    this._wireBus();

    this._refreshHud();
  }

  /* ====================================================================
   * HUD (üst şerit)
   * ==================================================================*/
  _buildHud() {
    const g = this.add.graphics();
    g.fillStyle(PALETTE.bg0, 0.88);
    g.fillRect(0, 0, DESIGN.W, LAYOUT.hudH);
    // Alt kenarda ince renkli çizgi — HUD'u tahtadan ayırır
    g.fillStyle(PALETTE.accent, 0.35);
    g.fillRect(0, LAYOUT.hudH - 2, DESIGN.W, 2);
    g.fillStyle(PALETTE.accent2, 0.18);
    g.fillRect(0, LAYOUT.hudH, DESIGN.W, 6);

    this.add.text(28, 26, 'OmniMerge', {
      fontFamily: FONTS.ui, fontSize: '30px', fontStyle: '800', color: hex(PALETTE.accent),
    });
    this.subtitle = this.add.text(30, 64, 'INFINITE AI CRAFT', {
      fontFamily: FONTS.ui, fontSize: '12px', fontStyle: '700', color: hex(PALETTE.dim),
    });

    // Skor rozeti (= keşfedilen toplam element = liderlik tablosu skoru)
    this.scoreText = this.add.text(30, 96, '', {
      fontFamily: FONTS.ui, fontSize: '22px', fontStyle: '700', color: hex(PALETTE.text),
    });

    /* SES GÖSTERGESİ — bilinçli olarak SALT OKUNUR.
     * Playables'ta ses kontrolünün tek sahibi YouTube arayüzüdür; oyun içinde
     * ikinci bir "unmute" düğmesi koymak SDK durumunu ezme riski taşır ve
     * sertifikasyonda sorun çıkarır. Biz sadece durumu yansıtıyoruz. */
    // MAĞAZA düğmesi
    this.shopBtn = this.add.text(DESIGN.W - 140, 34, '🛒', {
      fontFamily: FONTS.emoji, fontSize: '26px',
    }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
    this.shopBtn.on('pointerup', () => { Sfx.tik(); this._magazaAc(); });

    // AYARLAR düğmesi — dil seçimi burada
    this.settingsBtn = this.add.text(DESIGN.W - 92, 34, '⚙️', {
      fontFamily: FONTS.emoji, fontSize: '26px',
    }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
    this.settingsBtn.on('pointerup', () => { Sfx.tik(); this._ayarlarAc(); });

    this.audioIcon = this.add.text(DESIGN.W - 44, 34, '🔊', {
      fontFamily: FONTS.emoji, fontSize: '26px',
    }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
    this.audioIcon.on('pointerup', () => {
      UI.toast(this, t('audioInfo'),
               { y: LAYOUT.hudH + 60, duration: 2400, color: PALETTE.dim });
    });

    // İPUCU düğmesi → ödüllü reklam
    /* HUD dikey yerleşimi (yükseklik 150):
     *    34–60   ikonlar (🛒 ⚙️ 🔊)
     *    65–123  İpucu düğmesi
     *   126–147  Öz bakiyesi (sağ) / günlük hedef (sol)
     * Öz bakiyesi ilk sürümde y=66'daydı ve İpucu düğmesinin üstüne biniyordu. */
    this.hintBtn = UI.button(this, DESIGN.W - 132, 94, t('hintBtn'), {
      width: 200, height: 58, fontSize: 22,
      fill: PALETTE.card, stroke: PALETTE.accent2,
      onClick: () => this._openHintModal(),
    });

    // Öz bakiyesi — günlük hedef satırıyla aynı hizada, sağa yaslı
    this.essenceText = this.add.text(DESIGN.W - 30, 127, '', {
      fontFamily: FONTS.ui, fontSize: '17px', fontStyle: '800', color: hex(PALETTE.warn),
    }).setOrigin(1, 0);

    // Günlük hedef / bedava ipucu satırı
    this.dailyText = this.add.text(30, 126, '', {
      fontFamily: FONTS.ui, fontSize: '15px', fontStyle: '600', color: hex(PALETTE.dim),
    });

    // Yalnızca AI çevrimdışına düştüğünde görünen küçük rozet
    this.offlineBadge = this.add.text(DESIGN.W / 2, LAYOUT.hudH - 22, t('offline'), {
      fontFamily: FONTS.ui, fontSize: '14px', color: hex(PALETTE.warn),
    }).setOrigin(0.5).setAlpha(0);
  }

  _refreshHud() {
    this.scoreText.setText(t('score', { n: GameState.score, p: GameState.leaderboardScore() }));

    // Öz bakiyesi + aktif tılsım
    if (this.essenceText) {
      let s = '✨ ' + GameState.essence;
      if (GameState.charmLeft > 0) s += '   🔮 ×' + GameState.charmLeft;
      this.essenceText.setText(s);
    }

    // Günlük hedef çubuğu / bedava ipucu göstergesi
    if (this.dailyText) {
      if (GameState.freeHints > 0) {
        this.dailyText.setText(t('freeHint', { n: GameState.freeHints })).setColor(hex(PALETTE.good));
      } else {
        const kalan = Math.max(0, TUNING.dailyTarget - GameState.dailyCount);
        this.dailyText.setText(t('daily', { n: kalan })).setColor(hex(PALETTE.dim));
      }
    }
    if (this.hintBtn) {
      this.hintBtn.label.setText(GameState.freeHints > 0 ? t('hintFree') : t('hintBtn'));
    }
    this.audioIcon.setText(GameState.audioEnabled ? '🔊' : '🔇');
    if (this.libCount) this.libCount.setText(t('libCount', { n: GameState.score }));
  }

  /* ====================================================================
   * KÜTÜPHANE ÇEKMECESİ (alt panel) — keşfedilen her element burada
   * ==================================================================*/
  _buildDrawer() {
    const top = LAYOUT.drawerTop;
    const h = DESIGN.H - top;

    const g = this.add.graphics();
    g.fillStyle(PALETTE.bg0, 0.94);
    g.fillRoundedRect(0, top, DESIGN.W, h + 40, { tl: 30, tr: 30, bl: 0, br: 0 });
    g.lineStyle(2, PALETTE.accent2, 0.30);
    g.strokeRoundedRect(0, top, DESIGN.W, h + 40, { tl: 30, tr: 30, bl: 0, br: 0 });

    // Tutamaç
    const grip = this.add.graphics();
    grip.fillStyle(PALETTE.stroke, 0.9);
    grip.fillRoundedRect(DESIGN.W / 2 - 34, top + 12, 68, 6, 3);

    this.libTitle = this.add.text(28, top + 28, t('library'), {
      fontFamily: FONTS.ui, fontSize: '16px', fontStyle: '800', color: hex(PALETTE.dim),
    });
    this.libCount = this.add.text(28, top + 50, '', {
      fontFamily: FONTS.ui, fontSize: '14px', color: hex(PALETTE.accent),
    });

    this.clearBtn = UI.button(this, DESIGN.W - 92, top + 44, t('clear'), {
      width: 140, height: 46, fontSize: 18,
      fill: PALETTE.panel, stroke: PALETTE.stroke,
      onClick: () => GameState.bus.emit('clear-board'),
    });

    /* --- Kaydırılabilir içerik alanı + maske ------------------------- */
    this.viewTop = top + 76;
    this.viewH = DESIGN.H - this.viewTop - 10;

    this.libContent = this.add.container(0, this.viewTop);

    const maskShape = this.make.graphics();
    maskShape.fillStyle(0xffffff);
    maskShape.fillRect(0, this.viewTop, DESIGN.W, this.viewH);
    this.libContent.setMask(maskShape.createGeometryMask());

    this._setupDrawerScroll();
  }

  /** Parmakla dikey kaydırma. Kısa dokunuş = seçim, uzun sürükleme = kaydırma. */
  _setupDrawerScroll() {
    const inDrawer = (p) => p.y >= this.viewTop && p.y <= DESIGN.H;

    this.input.on('pointerdown', (p) => {
      if (!inDrawer(p)) return;
      this._scrolling = true;
      this._grabY = p.y;
      this._grabContentY = this.libContent.y;
      this._dragDist = 0;
    });

    this.input.on('pointermove', (p) => {
      if (!this._scrolling || !p.isDown) return;
      const dy = p.y - this._grabY;
      this._dragDist = Math.max(this._dragDist, Math.abs(dy));
      this.libContent.y = clamp(this._grabContentY + dy, this._minContentY(), this.viewTop);
      this._syncLibrary();          // görünür pencereye yeni slotları bağla
    });

    const release = () => { this._scrolling = false; };
    this.input.on('pointerup', release);
    this.input.on('pointerupoutside', release);

    // Masaüstünde tekerlek desteği
    this.input.on('wheel', (p, objs, dx, dy) => {
      if (!inDrawer(p)) return;
      this.libContent.y = clamp(this.libContent.y - dy * 0.6, this._minContentY(), this.viewTop);
      this._syncLibrary();
    });
  }

  _minContentY() {
    const rows = Math.ceil(this.libItems.length / LIB_COLS);
    const contentH = rows * (LAYOUT.slotH + 10);
    return Math.min(this.viewTop, this.viewTop + this.viewH - contentH - 8);
  }

  /* --- Slot yerleşimi --------------------------------------------------- */
  _slotPos(i) {
    const GAP = 10;
    const rowW = LIB_COLS * LAYOUT.slotW + (LIB_COLS - 1) * GAP;
    const startX = (DESIGN.W - rowW) / 2 + LAYOUT.slotW / 2;
    return {
      x: startX + (i % LIB_COLS) * (LAYOUT.slotW + GAP),
      y: Math.floor(i / LIB_COLS) * (LAYOUT.slotH + GAP) + LAYOUT.slotH / 2 + 6,
    };
  }

  /* --------------------------------------------------------------------
   * SANALLAŞTIRILMIŞ KÜTÜPHANE
   * --------------------------------------------------------------------
   *  Önceki sürüm her keşif için KALICI bir slot nesnesi yaratıyordu. Ölçüm:
   *    223 keşif → 226 etkileşimli nesne, 446 sprite, 241 doku (~15 MB)
   *  Phaser her fare hareketinde TÜM etkileşimli nesneleri hit-test eder ve
   *  maskelenmiş de olsa tüm sprite'ları her kare işler. Yani oyun oynadıkça
   *  ağırlaşıp donuyordu.
   *
   *  Artık çekmecede yalnızca EKRANA SIĞAN kadar görünüm var (~25 adet) ve
   *  bunlar kaydırdıkça geri dönüştürülüyor. Maliyet keşif sayısından tamamen
   *  bağımsız: 10 keşifle 10.000 keşif aynı hızda çalışır.
   * ------------------------------------------------------------------ */
  /* Kütüphane sırası — AKIŞ İÇİN KRİTİK.
   * Doğal sıra (eskiden yeniye) 200 elementte şu sorunu yaratıyor: az önce
   * keşfettiğin ve hemen denemek istediğin şey listenin en dibinde kalıyor,
   * ona ulaşmak için kaydırman gerekiyor. Oyuncunun ritmi kırılıyor.
   * Çözüm: 6 temel element hep en üstte sabit (sürekli lazım olurlar),
   * arkasından keşifler EN YENİDEN eskiye. Yeni bulduğun şey daima ilk satırda. */
  _libSirala() {
    const hepsi = GameState.list();
    const temel = hepsi.filter((e) => e.isBase);
    const kesifler = hepsi.filter((e) => !e.isBase).reverse();   // en yeni önce
    return temel.concat(kesifler);
  }

  _buildLibrary() {
    this.libItems = this._libSirala();

    const satirYuksek = LAYOUT.slotH + 10;
    const gorunurSatir = Math.ceil(this.viewH / satirYuksek) + 2;   // +2 tampon satır
    const havuzBoyu = LIB_COLS * gorunurSatir;
    for (let i = 0; i < havuzBoyu; i++) this._pool.push(this._makeSlotView());

    this._syncLibrary();
  }

  /** Havuzdaki tek bir yeniden kullanılabilir slot görünümü. */
  _makeSlotView() {
    const c = this.add.container(0, 0);
    const bg = this.add.image(0, 0, 'tex-slot-r0');   // nadirliğe göre değişir
    const face = this.add.image(0, 0, 'tex-slot-r0')
      .setDisplaySize(LAYOUT.slotW - 6, LAYOUT.slotH - 6);

    /* YENİ rozeti — `isNew` bayrağı şimdiye kadar hiç okunmuyordu.
     * Oyuncu keşfettiği ama henüz kullanmadığı elementi bir bakışta görsün. */
    const yeni = this.add.circle(LAYOUT.slotW / 2 - 12, -LAYOUT.slotH / 2 + 12, 7, PALETTE.accent3)
      .setVisible(false);

    c.add([bg, face, yeni]);
    c.setSize(LAYOUT.slotW, LAYOUT.slotH);
    c.setInteractive({
      hitArea: new Phaser.Geom.Rectangle(0, 0, LAYOUT.slotW, LAYOUT.slotH),
      hitAreaCallback: Phaser.Geom.Rectangle.Contains,
      useHandCursor: true,
    });

    c.__bg = bg;
    c.__face = face;
    c.__yeni = yeni;
    c.__elem = null;
    c.__armed = false;

    /* Dokunuş = tahtaya kopya bırak. Kaydırmayla karışmasın diye: slotun
     * üstünde basılmış olmalı ve o basıştan beri parmak 14 px'den az kaymalı. */
    c.on('pointerdown', (p) => {
      c.__armed = true;
      c.__basY = p.y;
      c.__cikti = false;          // bu jestte tahtaya kart doğurduk mu?
      bg.setTint(0x8fa2ff);
    });
    c.on('pointerout', () => { c.__armed = false; bg.clearTint(); });

    /* KÜTÜPHANEDEN DOĞRUDAN SÜRÜKLEME
     * Eskiden akış üç adımdı: slota dokun → kart rastgele bir yere düşer →
     * kartı bul, sürükle. Artık tek jest: slota bas, yukarı çek, hedefin
     * üstünde bırak. Parmak çekmeceden yukarı çıktığı anda kart doğuyor ve
     * sürükleme GameScene'e devrediliyor. */
    c.on('pointermove', (p) => {
      if (!c.__armed || c.__cikti || !c.__elem || !p.isDown) return;
      if (p.y > c.__basY - 26) return;            // henüz yeterince yukarı çekilmedi
      if (GameState.isFrozen()) return;
      c.__cikti = true;
      c.__armed = false;
      this._scrolling = false;                    // bu jest kaydırma değil
      bg.clearTint();
      if (c.__elem.isNew) { c.__elem.isNew = false; c.__yeni.setVisible(false); }
      GameState.bus.emit('drag-spawn', { name: c.__elem.name, x: p.worldX, y: p.worldY });
    });
    c.on('pointerup', () => {
      const basiliydi = c.__armed;
      c.__armed = false;
      bg.clearTint();
      if (!basiliydi || !c.__elem) return;
      if (this._dragDist > 14) return;
      if (GameState.isFrozen()) return;
      if (c.__elem.isNew) { c.__elem.isNew = false; c.__yeni.setVisible(false); }
      GameState.bus.emit('spawn-element', c.__elem.name);
      // Hit area'yı oynatmamak için kökü değil içeriği ölçekle.
      this.tweens.add({ targets: bg, scale: { from: 0.88, to: 1 }, duration: 200, ease: 'Back.easeOut' });
    });

    this.libContent.add(c);
    return c;
  }

  /** Görünür pencereyi hesaplayıp havuzu o aralığa bağlar. */
  _syncLibrary() {
    if (!this._pool.length) return;
    const toplam = this.libItems.length;
    const satirYuksek = LAYOUT.slotH + 10;

    // İçerik koordinatında görünür alanın üst kenarı
    const ustOfset = Math.max(0, this.viewTop - this.libContent.y);
    const ilkSatir = Math.max(0, Math.floor(ustOfset / satirYuksek) - 1);
    const baslangic = ilkSatir * LIB_COLS;

    for (let p = 0; p < this._pool.length; p++) {
      const view = this._pool[p];
      const idx = baslangic + p;

      if (idx >= toplam) {
        if (view.visible) {
          view.setVisible(false);
          view.disableInteractive();
          view.__elem = null;
        }
        continue;
      }

      const elem = this.libItems[idx];
      const pos = this._slotPos(idx);
      view.setPosition(pos.x, pos.y);
      if (!view.visible) { view.setVisible(true); view.setInteractive(); }

      if (view.__elem !== elem) {
        view.__elem = elem;
        view.__bg.setTexture('tex-slot-r' + rarityIndex(elem.tier));
        view.__face
          .setTexture(FaceTextures.get(this, elem))
          .setDisplaySize(LAYOUT.slotW - 6, LAYOUT.slotH - 6);
        // YENİ rozeti: henüz görülmemiş keşifler işaretli kalır
        view.__yeni.setVisible(!!elem.isNew);
      }
    }
  }

  /** Yeni keşif: veriyi tazele, sona kaydır, havuzu yeniden bağla. */
  _onDiscovery() {
    this.libItems = this._libSirala();
    // Yeni keşif zaten en üstte (temel elementlerin hemen ardında):
    // listeyi başa kaydırmak yeterli, dibe inmeye gerek yok.
    this.tweens.add({
      targets: this.libContent, y: this.viewTop,
      duration: 380, ease: 'Cubic.easeOut',
      onUpdate: () => this._syncLibrary(),
      onComplete: () => this._syncLibrary(),
    });
    this._syncLibrary();
  }

  /* ====================================================================
   * EVENT BUS
   * ==================================================================*/
  _wireBus() {
    const bus = GameState.bus;
    // Bkz. GameScene._wireBus: dinleyiciler fonksiyon referansıyla kaldırılmalı.
    this._busKayit = [];
    const on = (k, fn) => { bus.on(k, fn, this); this._busKayit.push([k, fn]); };

    on('discovery', () => { this._onDiscovery(); this._refreshHud(); });
    on('state-change', () => this._refreshHud());
    on('audio-change', () => this._refreshHud());

    on('ai-offline', () => {
      if (this.offlineBadge.alpha > 0.5) return;
      this.tweens.add({ targets: this.offlineBadge, alpha: 1, duration: 200 });
      this.tweens.add({ targets: this.offlineBadge, alpha: 0, delay: 3200, duration: 400 });
    });

    on('merge-state', (busy) => {
      // AI beklerken ipucu düğmesini kilitle (üst üste reklam istenmesin).
      this.hintBtn.setEnabled(!busy);
    });

    on('daily-done', () => this._gunlukTamam());
    on('language-change', () => this._dilYenile());
    on('milestone', (n) => this._kilometreTasi(n));
    on('request-interstitial', () => this._showInterstitial());

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this._alive = false;
      this._busKayit.forEach(([k, fn]) => bus.off(k, fn, this));
      this._busKayit.length = 0;
    });
  }

  /* --------------------------------------------------------------------
   * TV odağı — kütüphane tarafı
   * --------------------------------------------------------------------
   *  Kütüphane SANALLAŞTIRILMIŞ olduğu için odaklanan sıra ekranda görünür
   *  olmayabilir; önce o satırı görünür alana kaydırıyor, sonra havuzdaki
   *  karşılık gelen görünümün üstüne halkayı çiziyoruz.
   * ------------------------------------------------------------------ */
  _tvOdakla(idx) {
    if (!this._tvHalka) this._tvHalka = this.add.graphics().setDepth(1200);

    const satirYuksek = LAYOUT.slotH + 10;
    const satir = Math.floor(idx / LIB_COLS);

    // Odaklanan satırı görünür alana kaydır
    const satirUst = satir * satirYuksek;
    const gorunurUst = this.viewTop - this.libContent.y;
    const gorunurAlt = gorunurUst + this.viewH - satirYuksek;
    if (satirUst < gorunurUst)      this.libContent.y = this.viewTop - satirUst;
    else if (satirUst > gorunurAlt) this.libContent.y = this.viewTop - (satirUst - this.viewH + satirYuksek);
    this.libContent.y = clamp(this.libContent.y, this._minContentY(), this.viewTop);
    this._syncLibrary();

    const pos = this._slotPos(idx);
    const dx = pos.x, dy = pos.y + this.libContent.y;   // içerik kaydırması dahil
    const w = LAYOUT.slotW + 12, h = LAYOUT.slotH + 12;
    const g = this._tvHalka;
    g.clear();
    g.lineStyle(4, PALETTE.accent, 1);
    g.strokeRoundedRect(dx - w / 2, dy - h / 2, w, h, 24);
    g.setVisible(true);
  }

  _tvHalkaGizle() { if (this._tvHalka) this._tvHalka.setVisible(false); }

  /** İlerlemeyi sıfırla — geri alınamaz olduğu için ayrı onay ister. */
  _sifirlaOnay() {
    this._modal({
      title: t('resetTitle'),
      body: t('resetBody', { n: GameState.score }),
      primary: t('resetYes'),
      secondary: t('cancel'),
      onPrimary: () => {
        SaveManager.deserialize(null);
        GameState.mergesDone = 0;
        GameState.hintsUsed = 0;
        GameState.discoveriesSinceAd = 0;
        SaveManager.flush();
        SaveManager.pushScore();
        GameState.bus.emit('language-change');   // kütüphane + tahta tazelensin
        GameState.bus.emit('clear-board');
        Sfx.donum();
        UI.toast(this, t('resetDone'), { y: LAYOUT.boardTop + 60, color: PALETTE.good });
      },
    });
  }

  /** Dil değişti: tüm sabit metinleri ve kütüphaneyi yeniden çiz. */
  _dilYenile() {
    this.hintBtn.label.setText(t('hintBtn'));
    this.libTitle.setText(t('library'));
    this.clearBtn.label.setText(t('clear'));
    this.offlineBadge.setText(t('offline'));
    this._refreshHud();

    /* Kart yüzü dokusunun anahtarı element ADINDAN türetilir ('face:su' →
     * 'face:water'), yani dil değişince anahtar da değişir ve yeni doku
     * kendiliğinden üretilir. Eski dokuları ELLE SİLMEK YANLIŞTI: hâlâ o
     * dokuya bakan sprite'lar null dokuya düşüp render'ı çökertiyordu
     * ("Cannot read properties of null (reading 'glTexture')").
     * Kullanılmayan eski dokular zaten LRU ile atılıyor. */
    this.libItems = this._libSirala();
    this._pool.forEach((v) => { v.__elem = null; });   // yeniden bağlanmaya zorla
    this._syncLibrary();

    UI.toast(this, t('langChanged'), { y: LAYOUT.boardTop + 60, color: PALETTE.good });
  }

  /** Kilometre taşı kutlaması — tam ekran modal değil, akışı kesmeyen bir şerit. */
  _kilometreTasi(n) {
    const c = this.add.container(DESIGN.W / 2, LAYOUT.boardTop + 150).setDepth(1600);
    const g = this.add.graphics();
    const w = DESIGN.W - 120, h = 128;
    g.fillStyle(PALETTE.bg0, 0.95);
    g.fillRoundedRect(-w / 2, -h / 2, w, h, 22);
    g.lineStyle(3, PALETTE.warn, 0.95);
    g.strokeRoundedRect(-w / 2, -h / 2, w, h, 22);

    const t1 = this.add.text(0, -26, t('milestone', { n }), {
      fontFamily: FONTS.ui, fontSize: '30px', fontStyle: '800', color: hex(PALETTE.warn),
    }).setOrigin(0.5);
    const t2 = this.add.text(0, 22, t('milestoneSub'), {
      fontFamily: FONTS.ui, fontSize: '18px', color: hex(PALETTE.dim),
    }).setOrigin(0.5);

    c.add([g, t1, t2]);
    c.setScale(0.7).setAlpha(0);
    this.tweens.add({ targets: c, scale: 1, alpha: 1, duration: 300, ease: 'Back.easeOut' });
    this.tweens.add({
      targets: c, alpha: 0, y: c.y - 40, delay: 2200, duration: 400,
      onComplete: () => c.destroy(),
    });

    // Parçacık yağmuru
    const em = this.add.particles(DESIGN.W / 2, LAYOUT.boardTop + 40, 'tex-spark', {
      speed: { min: 60, max: 200 }, angle: { min: 250, max: 290 },
      scale: { start: 0.8, end: 0 }, alpha: { start: 1, end: 0 },
      lifespan: { min: 700, max: 1400 }, blendMode: 'ADD',
      tint: [PALETTE.warn, PALETTE.accent, PALETTE.accent3], emitting: false,
    }).setDepth(1590);
    em.explode(40);
    this.time.delayedCall(1600, () => em.destroy());
  }


  /* ====================================================================
   * MAĞAZA — "Simya Dükkânı"
   * --------------------------------------------------------------------
   *  Her ürünün İKİ fiyatı var: Öz veya bir ödüllü reklam.
   *  Bu, ödüllü reklam izlenmesini artırmanın en dürüst yolu: oyuncu asla
   *  reklam izlemeye mecbur değil (Öz biriktirerek her şeye ulaşır), ama
   *  reklam anında verir. Böylece HER ürün bir reklam fırsatına dönüşür ve
   *  kimse ilerlemesi kilitlendiği için değil, İSTEDİĞİ için izler.
   * ==================================================================*/
  _magazaAc() {
    if (GameState.isFrozen()) return;
    GameState.uiBlocked = true;
    GameState.bus.emit('freeze-change');

    const layer = this.add.container(0, 0).setDepth(2100);
    const dim = this.add.graphics();
    dim.fillStyle(0x000000, 0.74);
    dim.fillRect(0, 0, DESIGN.W, DESIGN.H);
    const blocker = this.add.zone(DESIGN.W / 2, DESIGN.H / 2, DESIGN.W, DESIGN.H).setInteractive();

    /* Panel yüksekliği ekrana göre kısılır: kısa ekranda 700 px'lik sabit
     * panel taşıyor ve alttaki ürünler görünmüyordu. Satır yüksekliği de
     * buna göre daralır, böylece 4 ürün her cihazda tam görünür. */
    const pw = DESIGN.W - 70;
    const ph = Math.min(700, DESIGN.H - 90);
    const satirY = Math.min(118, (ph - 250) / TUNING.magaza.length);
    const panel = this.add.container(DESIGN.W / 2, DESIGN.H / 2);
    const pg = this.add.graphics();
    pg.fillStyle(PALETTE.panel, 1);
    pg.fillRoundedRect(-pw / 2, -ph / 2, pw, ph, 28);
    pg.lineStyle(3, PALETTE.warn, 0.9);
    pg.strokeRoundedRect(-pw / 2, -ph / 2, pw, ph, 28);

    const baslik = this.add.text(0, -ph / 2 + 46, t('shop'), {
      fontFamily: FONTS.ui, fontSize: '28px', fontStyle: '800', color: hex(PALETTE.text),
    }).setOrigin(0.5);
    const bakiye = this.add.text(0, -ph / 2 + 88, '', {
      fontFamily: FONTS.ui, fontSize: '20px', fontStyle: '700', color: hex(PALETTE.warn),
    }).setOrigin(0.5);

    panel.add([pg, baslik, bakiye]);

    const kapat = (sonra) => {
      this.tweens.add({
        targets: layer, alpha: 0, duration: 160,
        onComplete: () => {
          layer.destroy();
          GameState.uiBlocked = false;
          GameState.bus.emit('freeze-change');
          this._refreshHud();
          if (sonra) sonra();
        },
      });
    };

    /* Her ürün için bir satır: ikon + ad + açıklama + iki düğme. */
    const satirlar = [];
    TUNING.magaza.forEach((urun, i) => {
      const y = -ph / 2 + 132 + satirY / 2 + i * satirY;
      const satir = this.add.container(0, y);

      const kutu = this.add.graphics();
      kutu.fillStyle(PALETTE.card, 0.85);
      const kh = satirY - 16;
      kutu.fillRoundedRect(-pw / 2 + 18, -kh / 2, pw - 36, kh, 18);
      kutu.lineStyle(2, PALETTE.stroke, 0.7);
      kutu.strokeRoundedRect(-pw / 2 + 18, -kh / 2, pw - 36, kh, 18);

      const ust = -satirY / 2 + 10;
      const ikon = this.add.text(-pw / 2 + 54, ust + 18, urun.emoji, {
        fontFamily: FONTS.emoji, fontSize: '32px',
      }).setOrigin(0.5);
      const ad = this.add.text(-pw / 2 + 88, ust, t('shop_' + urun.id), {
        fontFamily: FONTS.ui, fontSize: '19px', fontStyle: '700', color: hex(PALETTE.text),
      });
      const acik = this.add.text(-pw / 2 + 88, ust + 24, t('shopd_' + urun.id), {
        fontFamily: FONTS.ui, fontSize: '14px', color: hex(PALETTE.dim),
        wordWrap: { width: pw - 200 },
      });

      satir.add([kutu, ikon, ad, acik]);

      // Öz ile al (fiyatı olan ürünler)
      if (urun.fiyat > 0) {
        const ozBtn = UI.button(this, -pw / 4 + 22, satirY / 2 - 30, '✨ ' + urun.fiyat, {
          width: pw / 2 - 70, height: 40, fontSize: 16,
          fill: PALETTE.card, stroke: PALETTE.warn, color: PALETTE.warn,
          onClick: () => {
            if (GameState.essence < urun.fiyat) { Sfx.hata(); this._magazaUyari(t('noEssence')); return; }
            GameState.essence -= urun.fiyat;
            SaveManager.requestSave();
            kapat(() => this._urunVer(urun.id));
          },
        });
        satir.add(ozBtn);
        satirlar.push({ urun, ozBtn });
      }

      // Reklam izleyerek al — her ürün için mevcut
      const rBtn = UI.button(this, urun.fiyat > 0 ? pw / 4 - 22 : 0, satirY / 2 - 30,
        '▶  ' + t('watchAd'), {
        width: urun.fiyat > 0 ? pw / 2 - 70 : pw - 90, height: 40, fontSize: 16,
        fill: PALETTE.cardHi, stroke: PALETTE.accent, color: PALETTE.accent,
        onClick: () => {
          if (urun.id === 'pouch') {
            const kalan = TUNING.ozKeseBekleme - (Date.now() - GameState.pouchAt);
            if (kalan > 0) { Sfx.hata(); this._magazaUyari(t('cooldown', { n: Math.ceil(kalan / 1000) })); return; }
          }
          kapat(() => this._reklamlaAl(urun.id));
        },
      });
      satir.add(rBtn);
      satirlar.push({ urun, rBtn });

      panel.add(satir);
    });

    panel.add(UI.button(this, 0, ph / 2 - 46, t('close'), {
      width: pw - 90, height: 54, fontSize: 20,
      fill: PALETTE.card, stroke: PALETTE.stroke,
      onClick: () => kapat(),
    }));

    // Bakiye ve düğme durumlarını tazele
    const tazele = () => {
      bakiye.setText(t('balance', { n: GameState.essence }));
      satirlar.forEach(({ urun, ozBtn }) => {
        if (ozBtn) ozBtn.setEnabled(GameState.essence >= urun.fiyat);
      });
    };
    tazele();

    this._magazaUyariMetni = this.add.text(0, ph / 2 - 92, '', {
      fontFamily: FONTS.ui, fontSize: '15px', color: hex(PALETTE.bad),
    }).setOrigin(0.5);
    panel.add(this._magazaUyariMetni);

    layer.add([dim, blocker, panel]);
    panel.setScale(0.86);
    layer.setAlpha(0);
    this.tweens.add({ targets: layer, alpha: 1, duration: 180 });
    this.tweens.add({ targets: panel, scale: 1, duration: 260, ease: 'Back.easeOut' });
  }

  _magazaUyari(metin) {
    if (!this._magazaUyariMetni || !this._magazaUyariMetni.active) return;
    this._magazaUyariMetni.setText(metin).setAlpha(1);
    this.tweens.add({ targets: this._magazaUyariMetni, alpha: 0, delay: 1800, duration: 400 });
  }

  /** Ödüllü reklam izleyip ürünü al. Ödül SADECE reklam tamamlanırsa verilir. */
  async _reklamlaAl(id) {
    this._freezeGameplay();
    const veil = this._veil(t('adRewarded'));
    let odul = false;
    try {
      await YT.requestRewardedAd('shop-' + id, () => { odul = true; });
    } catch (e) {
      YT.logWarning('mağaza reklamı: ' + e);
    } finally {
      veil.destroy();
      this._unfreezeGameplay();
    }
    if (!this._alive) return;
    if (!odul) { UI.toast(this, t('adNotDone'), { y: 320, color: PALETTE.warn }); return; }
    this._urunVer(id);
  }

  /** Ürün etkisini uygula. */
  async _urunVer(id) {
    if (id === 'hint') {
      GameState.hintsUsed++;
      SaveManager.requestSave();
      this._bedavaIpucu();
      return;
    }

    if (id === 'pouch') {
      GameState.essence += TUNING.ozOdul.reklamKese;
      GameState.pouchAt = Date.now();
      SaveManager.requestSave();
      this._refreshHud();
      Sfx.kesif(1);
      UI.toast(this, t('gotEssence', { n: TUNING.ozOdul.reklamKese }),
               { y: LAYOUT.boardTop + 80, color: PALETTE.warn });
      return;
    }

    if (id === 'charm') {
      GameState.charmLeft += TUNING.tilsimBirlestirme;
      SaveManager.requestSave();
      this._refreshHud();
      Sfx.donum();
      UI.toast(this, t('gotCharm', { n: TUNING.tilsimBirlestirme }),
               { y: LAYOUT.boardTop + 80, color: PALETTE.accent2, duration: 2600 });
      return;
    }

    if (id === 'pack') {
      /* Element paketi: elle yazılmış tablodan, malzemeleri elde OLAN ama
       * henüz keşfedilmemiş tarifleri veriyoruz. Böylece paket her zaman
       * oyuncunun ilerlemesine BAĞLI ve anlamlı sonuçlar üretir. */
      const veril = [];
      for (let i = 0; i < TUNING.paketAdet; i++) {
        const h = Alchemy.findUndiscoveredHint();
        if (!h) break;
        GameState.add(h.result.name, h.result.emoji, 2, h.result.id);
        veril.push(h.result.emoji + ' ' + h.result.name);
        GameState.essence += rarityOf(2).puan;
      }
      if (!veril.length) { UI.toast(this, t('packEmpty'), { y: 320, color: PALETTE.warn }); return; }
      SaveManager.requestSave();
      SaveManager.pushScore();
      GameState.bus.emit('discovery');
      Sfx.donum();
      this._modal({
        title: t('gotPack'),
        body: veril.join('\n'),
        primary: t('great'),
      });
    }
  }

  /* ====================================================================
   * AYARLAR — dil seçimi
   * ==================================================================*/
  _ayarlarAc() {
    if (GameState.isFrozen()) return;
    GameState.uiBlocked = true;
    GameState.bus.emit('freeze-change');

    const layer = this.add.container(0, 0).setDepth(2100);
    const dim = this.add.graphics();
    dim.fillStyle(0x000000, 0.72);
    dim.fillRect(0, 0, DESIGN.W, DESIGN.H);
    const blocker = this.add.zone(DESIGN.W / 2, DESIGN.H / 2, DESIGN.W, DESIGN.H).setInteractive();

    const pw = DESIGN.W - 110, ph = 560;
    const panel = this.add.container(DESIGN.W / 2, DESIGN.H / 2);
    const pg = this.add.graphics();
    pg.fillStyle(PALETTE.panel, 1);
    pg.fillRoundedRect(-pw / 2, -ph / 2, pw, ph, 28);
    pg.lineStyle(3, PALETTE.accent2, 0.85);
    pg.strokeRoundedRect(-pw / 2, -ph / 2, pw, ph, 28);

    const baslik = this.add.text(0, -ph / 2 + 52, t('settings'), {
      fontFamily: FONTS.ui, fontSize: '28px', fontStyle: '800', color: hex(PALETTE.text),
    }).setOrigin(0.5);
    const altBaslik = this.add.text(0, -ph / 2 + 108, t('language'), {
      fontFamily: FONTS.ui, fontSize: '17px', fontStyle: '700', color: hex(PALETTE.dim),
    }).setOrigin(0.5);

    panel.add([pg, baslik, altBaslik]);

    const kapat = (sonra) => {
      this.tweens.add({
        targets: layer, alpha: 0, duration: 160,
        onComplete: () => {
          layer.destroy();
          GameState.uiBlocked = false;
          GameState.bus.emit('freeze-change');
          if (sonra) sonra();
        },
      });
    };

    // Dil düğmeleri
    LANGS.forEach((L, i) => {
      const secili = L.kod === LANG;
      const b = UI.button(this, 0, -ph / 2 + 168 + i * 78, L.bayrak + '   ' + L.ad, {
        width: pw - 90, height: 64, fontSize: 22,
        fill: secili ? PALETTE.cardHi : PALETTE.card,
        stroke: secili ? PALETTE.accent : PALETTE.stroke,
        color: secili ? PALETTE.accent : PALETTE.text,
        onClick: () => {
          if (L.kod === LANG) { kapat(); return; }
          kapat(() => {
            setLanguage(L.kod);
            Sfx.kesif(1);
            GameState.bus.emit('language-change');
          });
        },
      });
      panel.add(b);
    });

    // İlerlemeyi sıfırla — iki aşamalı onay (yanlışlıkla basmaya karşı)
    panel.add(UI.button(this, 0, ph / 2 - 130, t('reset'), {
      width: pw - 90, height: 58, fontSize: 19,
      fill: PALETTE.card, stroke: PALETTE.bad, color: PALETTE.bad,
      onClick: () => kapat(() => this._sifirlaOnay()),
    }));

    panel.add(UI.button(this, 0, ph / 2 - 56, t('close'), {
      width: pw - 90, height: 60, fontSize: 21,
      fill: PALETTE.card, stroke: PALETTE.stroke,
      onClick: () => kapat(),
    }));

    layer.add([dim, blocker, panel]);
    panel.setScale(0.85);
    layer.setAlpha(0);
    this.tweens.add({ targets: layer, alpha: 1, duration: 180 });
    this.tweens.add({ targets: panel, scale: 1, duration: 260, ease: 'Back.easeOut' });
  }

  /* ====================================================================
   * REKLAMLAR
   * ==================================================================*/

  /** Oyunu güvenle dondur (reklam / modal öncesi). */
  _freezeGameplay() {
    GameState.uiBlocked = true;
    const g = this.game.scene.getScene('Game');
    // sys.pause(): ScenePlugin kuyruğunu atlayıp anında durdurur (bkz. BootScene notu).
    if (g && g.sys.isActive()) g.sys.pause();
    // SERTİFİKASYON: reklamdan önce oyun sesi MUTLAKA susmalı.
    this.game.sound.mute = true;
    this.game.sound.pauseAll();
    GameState.bus.emit('freeze-change');
  }

  /** Dondurmayı geri al. Sesi açarken SDK'nın son durumuna bak. */
  _unfreezeGameplay() {
    GameState.uiBlocked = false;
    const g = this.game.scene.getScene('Game');
    if (g && g.sys.isPaused() && !GameState.systemPaused) g.sys.resume();
    GameState.audioEnabled = YT.isAudioEnabled();
    this.game.sound.mute = !GameState.audioEnabled || GameState.systemPaused;
    if (!this.game.sound.mute) this.game.sound.resumeAll();
    GameState.bus.emit('freeze-change');
    this._refreshHud();
  }

  /**
   * GEÇİŞ REKLAMI (interstitial)
   * Her 10 yeni keşifte, kutlama bittikten sonra çağrılır.
   */
  async _showInterstitial() {
    if (GameState.uiBlocked || GameState.systemPaused) return;
    if (!YT.adsAvailable()) {
      // Dev ortamı: akışı görebilmek için sahte bir bilgi balonu.
      UI.toast(this, t('adDev'), { y: 300, color: PALETTE.warn });
      return;
    }

    this._freezeGameplay();
    const veil = this._veil(t('adLoading'));

    try {
      await YT.requestInterstitialAd();
    } catch (e) {
      YT.logWarning('interstitial hata: ' + e);
    } finally {
      veil.destroy();
      this._unfreezeGameplay();
    }
  }

  /**
   * ÖDÜLLÜ REKLAM (rewarded) → 'hint-reward'
   * Oyuncu isteğe bağlı olarak izler; karşılığında keşfetmediği bir formülü
   * görür. Ödül SADECE reklam sonuna kadar izlenirse verilir.
   */
  _openHintModal() {
    if (GameState.isFrozen()) return;

    /* Günlük hedefi tamamlayan oyuncunun bedava ipucu hakkı var:
     * reklam adımı tamamen atlanır. Kazanılmış ödülü reklamla ödetmek
     * hediyeyi anlamsızlaştırırdı. */
    if (GameState.freeHints > 0) {
      if (!this._ipucuVarMi()) {
        UI.toast(this, t('noHint'), { y: 320, color: PALETTE.warn });
        return;
      }
      GameState.freeHints--;
      GameState.hintsUsed++;
      SaveManager.requestSave();
      this._refreshHud();
      this._bedavaIpucu();
      return;
    }

    const hint = this._ipucuVarMi();
    if (!hint) {
      UI.toast(this, t('noHint'),
               { y: 320, color: PALETTE.warn });
      return;
    }

    this._modal({
      title: t('hintTitle'),
      body: t('hintBody'),
      primary: t('hintWatch'),
      secondary: t('cancel'),
      onPrimary: () => this._watchHintAd(),
    });
  }

  async _watchHintAd() {
    this._freezeGameplay();
    const veil = this._veil(t('adRewarded'));
    let rewarded = false;

    try {
      // İkinci argüman ödül callback'i: YALNIZCA reklam tamamlanırsa çalışır.
      await YT.requestRewardedAd('hint-reward', () => { rewarded = true; });
    } catch (e) {
      YT.logWarning('rewarded hata: ' + e);
    } finally {
      veil.destroy();
      this._unfreezeGameplay();
    }

    if (!this._alive) return;

    if (rewarded) {
      GameState.hintsUsed++;
      SaveManager.requestSave();

      // Ödül verildi: gerçek formülü şimdi çöz (gerekirse AI'a sor)
      const bekle = this._veil(t('working'));
      const hint = await this._ipucuCoz();
      bekle.destroy();
      if (!this._alive) return;
      if (!hint) { UI.toast(this, t('noHint'), { y: 320, color: PALETTE.warn }); return; }

      this._modal({
        title: t('hintRevealed'),
        body: hint.a.emoji + ' ' + hint.a.name + '   +   ' + hint.b.emoji + ' ' + hint.b.name +
              '\n\n↓\n\n' + hint.result.emoji + '  ' + hint.result.name,
        primary: t('great'),
        onPrimary: () => {
          // Kolaylık: iki bileşeni de tahtaya bırak.
          GameState.bus.emit('spawn-element', hint.a.name);
          GameState.bus.emit('spawn-element', hint.b.name);
        },
      });
    } else {
      UI.toast(this, t('adNotDone'),
               { y: 320, color: PALETTE.warn });
    }
  }

  /* İpucu üretimi — İKİ AŞAMALI
   * 1) Elle yazılmış tablodan keşfedilmemiş bir tarif (anında, en kaliteli)
   * 2) Tablo tükendiyse: denenmemiş bir ikili seçip SONUCU AI'DAN SOR.
   *    Eskiden bu durumda sonuç "Bilinmeyen ❓" olarak gösteriliyordu —
   *    oyuncu ödüllü reklam izleyip karşılığında hiçbir bilgi almıyordu.
   *    Ödül zaten hak edildiği için ~0.7 sn'lik AI çağrısı fazlasıyla değer.
   * ------------------------------------------------------------------ */

  /** Ucuz kontrol: gösterilebilecek bir ipucu VAR MI? (reklam öncesi) */
  _ipucuVarMi() {
    if (Alchemy.findUndiscoveredHint()) return true;
    return this._denenmemisIkili() !== null;
  }

  /** Henüz birleştirilmemiş bir element ikilisi bul. */
  _denenmemisIkili() {
    const list = GameState.list();
    if (list.length < 2) return null;
    for (let i = 0; i < 80; i++) {
      const a = Phaser.Utils.Array.GetRandom(list);
      const b = Phaser.Utils.Array.GetRandom(list);
      if (GameState.recipes.has(pairKey(a.name, b.name))) continue;
      return { a, b };
    }
    return null;
  }

  /** Bedava ipucu akışı — reklam yok, doğrudan formül. */
  async _bedavaIpucu() {
    const bekle = this._veil(t('working'));
    const hint = await this._ipucuCoz();
    bekle.destroy();
    if (!this._alive) return;
    if (!hint) { UI.toast(this, t('noHint'), { y: 320, color: PALETTE.warn }); return; }
    Sfx.kesif(2);
    this._modal({
      title: t('hintRevealed'),
      body: hint.a.emoji + ' ' + hint.a.name + '   +   ' + hint.b.emoji + ' ' + hint.b.name +
            '\n\n↓\n\n' + hint.result.emoji + '  ' + hint.result.name,
      primary: t('great'),
      onPrimary: () => {
        GameState.bus.emit('spawn-element', hint.a.name);
        GameState.bus.emit('spawn-element', hint.b.name);
      },
    });
  }

  /** Günlük hedef tamamlandı kutlaması. */
  _gunlukTamam() {
    this._refreshHud();
    UI.toast(this, t('dailyDone'), {
      y: LAYOUT.boardTop + 110, duration: 3000, color: PALETTE.good,
    });
  }

  /** Ödül verildikten SONRA çağrılır; gerekirse AI'a sorar. */
  async _ipucuCoz() {
    const local = Alchemy.findUndiscoveredHint();
    if (local) return local;

    const ikili = this._denenmemisIkili();
    if (!ikili) return null;
    try {
      const r = await AI.combine(ikili.a.name, ikili.b.name);
      return { a: ikili.a, b: ikili.b, result: { name: r.name, emoji: r.emoji } };
    } catch (e) {
      YT.logWarning('İpucu AI hatası: ' + e);
      return { a: ikili.a, b: ikili.b, result: { name: t('unknown'), emoji: '❓' } };
    }
  }

  /* ====================================================================
   * Modal / perde yardımcıları
   * ==================================================================*/
  _veil(text) {
    const c = this.add.container(0, 0).setDepth(2000);
    const g = this.add.graphics();
    g.fillStyle(PALETTE.bg0, 0.86);
    g.fillRect(0, 0, DESIGN.W, DESIGN.H);
    const t = this.add.text(DESIGN.W / 2, DESIGN.H / 2, text, {
      fontFamily: FONTS.ui, fontSize: '24px', color: hex(PALETTE.dim),
    }).setOrigin(0.5);
    c.add([g, t]);
    return c;
  }

  _modal({ title, body, primary, secondary, onPrimary, onSecondary }) {
    GameState.uiBlocked = true;
    GameState.bus.emit('freeze-change');

    const layer = this.add.container(0, 0).setDepth(2100);

    const dim = this.add.graphics();
    dim.fillStyle(0x000000, 0.72);
    dim.fillRect(0, 0, DESIGN.W, DESIGN.H);

    /* Arkadaki tıklamaları engelleyen katman.
     * Graphics'te Origin bileşeni YOKTUR → displayOriginX undefined → hit test
     * NaN üretir ve perde hiçbir şeyi engellemez. Bu iş için doğru nesne
     * Zone'dur: boyutu ve origin'i vardır, hiçbir şey çizmez. */
    const blocker = this.add.zone(DESIGN.W / 2, DESIGN.H / 2, DESIGN.W, DESIGN.H)
      .setInteractive();

    const pw = DESIGN.W - 110, ph = 430;
    const panel = this.add.container(DESIGN.W / 2, DESIGN.H / 2);
    const pg = this.add.graphics();
    pg.fillStyle(PALETTE.panel, 1);
    pg.fillRoundedRect(-pw / 2, -ph / 2, pw, ph, 28);
    pg.lineStyle(3, PALETTE.accent2, 0.85);
    pg.strokeRoundedRect(-pw / 2, -ph / 2, pw, ph, 28);

    const tt = this.add.text(0, -ph / 2 + 58, title, {
      fontFamily: FONTS.ui, fontSize: '28px', fontStyle: '800',
      color: hex(PALETTE.text), align: 'center', wordWrap: { width: pw - 60 },
    }).setOrigin(0.5);

    const bt = this.add.text(0, -10, body, {
      fontFamily: FONTS.ui, fontSize: '22px', color: hex(PALETTE.dim),
      align: 'center', lineSpacing: 8, wordWrap: { width: pw - 60 },
    }).setOrigin(0.5);

    panel.add([pg, tt, bt]);

    const close = (cb) => {
      this.tweens.add({
        targets: layer, alpha: 0, duration: 160,
        onComplete: () => {
          layer.destroy();
          GameState.uiBlocked = false;
          GameState.bus.emit('freeze-change');
          if (cb) cb();
        },
      });
    };

    const btnY = ph / 2 - 62;
    if (secondary) {
      panel.add(UI.button(this, -pw / 4 - 6, btnY, secondary, {
        width: pw / 2 - 30, height: 62, fontSize: 21,
        fill: PALETTE.card, stroke: PALETTE.stroke,
        onClick: () => close(onSecondary),
      }));
      panel.add(UI.button(this, pw / 4 + 6, btnY, primary, {
        width: pw / 2 - 30, height: 62, fontSize: 21,
        fill: PALETTE.cardHi, stroke: PALETTE.accent,
        onClick: () => close(onPrimary),
      }));
    } else {
      panel.add(UI.button(this, 0, btnY, primary, {
        width: pw - 90, height: 62, fontSize: 22,
        fill: PALETTE.cardHi, stroke: PALETTE.accent,
        onClick: () => close(onPrimary),
      }));
    }

    layer.add([dim, blocker, panel]);
    panel.setScale(0.85);
    layer.setAlpha(0);
    this.tweens.add({ targets: layer, alpha: 1, duration: 180 });
    this.tweens.add({ targets: panel, scale: 1, duration: 260, ease: 'Back.easeOut' });

    return layer;
  }
}

/* ============================================================================
 * [11] BOOTSTRAP — Phaser konfigürasyonu ve global koruma
 * ==========================================================================*/
(function bootstrap() {
  function fatal(msg) {
    const el = document.getElementById('fatal');
    const m = document.getElementById('fatal-msg');
    if (m) m.textContent = msg;
    if (el) el.classList.add('show');
    const s = document.getElementById('boot-splash');
    if (s) s.remove();
  }

  if (typeof Phaser === 'undefined') {
    fatal('Phaser yüklenemedi. src/vendor/phaser.min.js dosyasını kontrol edin.');
    return;
  }

  if (!YT.LIVE) {
    console.info(
      '%c[OmniMerge] YouTube Playables ortamı algılanmadı — GELİŞTİRME MODU.\n' +
      'Kayıt localStorage\'a yazılıyor, reklamlar simüle ediliyor.',
      'color:#7ee7ff'
    );
  }

  /* Yakalanmamış hataları YouTube sağlık telemetrisine bildir. Playables
   * panelinde crash oranı yüksek çıkarsa oyun dağıtımdan düşürülür. */
  window.addEventListener('error', (e) => {
    YT.logError('window.onerror: ' + (e && e.message ? e.message : e));
  });
  window.addEventListener('unhandledrejection', (e) => {
    YT.logError('unhandledrejection: ' + (e && e.reason ? e.reason : e));
  });

  /* Sayfa gizlenirken son bir kayıt (mobilde 'pagehide' güvenilirdir). */
  window.addEventListener('pagehide', () => { SaveManager.flush(); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) SaveManager.flush();
  });

  // Sahneler kurulmadan ÖNCE: tasarım yüksekliğini ekrana göre belirle
  olculeriHesapla();

  const config = {
    type: Phaser.AUTO,
    parent: 'game-root',
    backgroundColor: '#070a16',

    /* Dikey tasarım + FIT: Playables hem telefonda hem TV'de çalışır, bu yüzden
     * sabit tasarım çözünürlüğü + orantılı ölçekleme en güvenli yaklaşımdır. */
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: DESIGN.W,
      height: DESIGN.H,
      expandParent: true,
    },

    physics: {
      default: 'arcade',
      arcade: { gravity: { x: 0, y: 0 }, debug: false },
    },

    render: {
      antialias: true,
      roundPixels: false,
      powerPreference: 'high-performance',
      // Playables paketinde WebGL bağlamı kaybı yaşanırsa canvas'a düşsün
      failIfMajorPerformanceCaveat: false,
    },

    // Ses: SDK durumu BootScene'de uygulanır. Burada motoru kapatmıyoruz,
    // sadece mute ile yönetiyoruz ki onAudioEnabledChange anında etki etsin.
    audio: { disableWebAudio: false },

    /* GİRİŞ
     * Phaser dokunmatik yöneticisini yalnızca cihaz "touch destekliyor" olarak
     * algılanırsa kurar. Playables ağırlıklı olarak TELEFONDA oynanır, bu yüzden
     * mouse ve touch'ı AÇIKÇA istiyoruz — algılama yanlış çıkarsa oyun tamamen
     * tepkisiz kalırdı. activePointers:1 → aynı anda tek sürükleme (iki parmakla
     * iki kartı birden sürükleyip birleştirme mantığını bozmak mümkün olmasın). */
    input: {
      mouse: true,
      touch: true,
      activePointers: 1,
      windowEvents: true,
      // TV kumandaları tarayıcıya ok tuşu + Enter olarak ulaşır.
      keyboard: true,
      gamepad: true,
    },

    fps: { target: 60, min: 30 },
    banner: false,
    autoFocus: true,

    scene: [BootScene, GameScene, UIScene],
  };

  window.omniMergeGame = new Phaser.Game(config);
})();
