# Güvenlik Modeli

## Kimlik doğrulama ve oturum

- Supabase Auth, e-posta + parola. Kayıt (sign-up) kapalıdır; hesapları yönetici oluşturur. Parola politikası:
  en az 12 karakter, büyük/küçük harf ve rakam (`supabase/config.toml`; barındırılan projede panelden).
- Oturum çerezleri `@supabase/ssr` ile yönetilir ve sunucu tarafında sıkılaştırılır
  (`src/lib/supabase/cookie-options.ts`): `httpOnly` (JavaScript okuyamaz), `SameSite=Lax`, development dışında
  `Secure`, en fazla **7 gün** (kütüphanenin 400 günlük varsayılanı kısaltılır).
- `src/proxy.ts` her istekte `supabase.auth.getUser()` çağırır: belirteç Supabase Auth'ta doğrulanır ve gerekirse
  yenilenir. Proxy tek savunma hattı değildir: her sayfa (`requireUser` / `requireWorkspace`) ve her API ucu
  (`apiRoute`) oturumu yeniden doğrular.
- Giriş Server Action ile sunucuda yapılır. Yanlış e-posta ve yanlış parola aynı mesajı verir. Yönlendirme
  yalnızca aynı sitedeki yollara yapılır.
- **Hız sınırı** (`src/lib/rate-limit.ts`): başarısız girişler adres başına 15 dakikada 20, e-posta başına 8;
  parola değişiminde mevcut parolanın yanlış girilmesi kullanıcı başına 15 dakikada 5. Yalnızca **başarısız**
  denemeler sayılır. Adres, ters vekilin ayarladığı `X-Real-IP` veya `X-Forwarded-For`'un son değerinden alınır
  (istemcinin taklit edebileceği önceki değerler yok sayılır). Sınırlayıcı bellek içidir (tek sunucu için
  yeterli); Supabase Auth'un kendi sınırları da geçerlidir.
- Parola değişimi mevcut parolanın yeniden doğrulanmasını ister ve diğer tüm oturumları kapatır.
  "Sign out everywhere" tüm cihazlardaki oturumları iptal eder.

## Yetkilendirme

1. **İzin listesi** — `AI_HQ_ALLOWED_EMAILS` (üretimde zorunlu). Listede olmayan hesabın oturumu girişte kapatılır;
   proxy ve API'ler `403` döner.
2. **Roller** — `owner` / `admin` / `member` (`profiles.role`). Çalışma alanı ayarları ve entegrasyonlar yalnızca
   admin/owner, roller yalnızca owner tarafından değiştirilebilir. Her kural üç katmanda uygulanır:
   - arayüz: yetkisiz kullanıcıya düzenleme formu gösterilmez (salt okunur görünüm),
   - API: `assertWorkspaceAdmin` / `assertWorkspaceOwner` → `403`,
   - veritabanı: RLS politikaları, sütun düzeyinde yetkiler ve `set_workspace_role()` (son owner korunur).
   Arayüzde gizleme tek başına güvenlik sayılmaz; E2E testleri bu uçları üye oturumuyla **doğrudan** çağırır.
3. **Satır düzeyi güvenlik (RLS)** — her tabloda açık. Kişisel kayıtlar (projeler, görevler, otomasyonlar,
   ajanlar, ajan görevleri, aktivite) yalnızca sahibine görünür. Uygulama yalnızca publishable anahtarı kullanır.
4. **Bileşik yabancı anahtarlar** — çocuk kayıtlar ebeveynlerine `(id, owner_id)` ile bağlıdır.
5. **Değiştirilemez aktivite kaydı** — yalnızca `SECURITY DEFINER` tetikleyiciler yazar.
6. **Sahte "Connected" engeli** — entegrasyon test sonucu sütunlarına kullanıcıların yazma yetkisi yoktur; durum
   sunucuda hesaplanır ve connector + başarılı gerçek test olmadan "Connected" olamaz.
7. **anon rolü** — hiçbir tabloya, görünüme veya fonksiyona erişemez.

## Girdi doğrulama ve istek sertleştirme

- Tüm API gövdeleri ve sorgu parametreleri katı Zod şemalarıyla doğrulanır; bilinmeyen alanlar reddedilir,
  sahiplik her zaman oturumdan gelir (`owner_id` istemciden alınmaz).
- Arama terimleri yalnızca harf, rakam, boşluk ve birkaç güvenli simgeye indirgenir (PostgREST filtresine güvenle
  gömülür, kullanıcı LIKE joker karakteri kullanamaz).
- Entegrasyon ayarları servis başına şemayla doğrulanır: URL'ler yalnızca `https`, kimlik bilgisi / sorgu dizesi
  içeremez; bilinmeyen alan (ör. `apiKey`) reddedilir → formdan sır kaydedilemez.
- Otomasyonlarda yalnızca workflow **kimliği** kabul edilir; URL veya anahtar reddedilir.
- Durum değiştiren isteklerde aynı köken (`Origin` / `Sec-Fetch-Site`), `application/json` zorunluluğu, 64 KB
  gövde sınırı. Hassas işlemler onay penceresi ister; entegrasyon sıfırlama **yazılı onay** ister.

## Hata yönetimi ve günlükler

- Hata yanıtları tek biçimlidir: `{ "error": { "code", "message", "details?", "requestId?" } }`. Veritabanı
  mesajı, yığın izi veya iç adres sızdırılmaz; yalnızca `AHQ01` kodlu iş kuralı mesajları (ör. "The agent must be
  Ready to accept tasks.") kullanıcıya iletilir (`422`).
- Sayfa hataları genel bir mesaj ve yalnızca `digest` referansı gösterir.
- Günlükler JSON satırlarıdır (`src/lib/logger.ts`). `password`, `token`, `secret`, `apiKey`, `authorization`,
  `cookie` vb. anahtarlı alanlar ile metin içindeki JWT'ler, `sb_…` anahtarları, `Bearer …` değerleri ve URL
  kimlik bilgileri maskelenir. Beklenmeyen hatalar `requestId` ile günlüğe yazılır.
- Sağlık uçları yalnızca kontrol adlarını ve sonuçlarını döner (URL, sürüm, hata ayrıntısı yok).

## Sırlar

- Depoda gerçek anahtar yoktur. `.env*` dosyaları git dışıdır; yalnızca `.env.example` (değersiz) izlenir.
- Hiçbir değişken `NEXT_PUBLIC_` önekli değildir; tarayıcıya yapılandırma değeri gönderilmez.
- `SUPABASE_PUBLISHABLE_KEY` alanına secret/service_role anahtarı girilirse uygulama başlamaz.
- `SUPABASE_SECRET_KEY` yalnızca geliştirme seed betiği içindir; üretimde tanımlanmaz.
- Entegrasyon sırları yalnızca sunucu ortam değişkenidir; uygulama yalnızca **var olup olmadıklarını** kontrol
  eder (`src/lib/integrations/secrets.ts`), değerlerini okumaz, göstermez, kaydetmez.
- Docker imajına sır gömülmez; TLS denetim vekili sertifikası gerekiyorsa build secret olarak verilir.

## Güvenlik başlıkları ve İçerik Güvenlik Politikası (CSP)

Tüm yanıtlarda (`src/lib/security-headers.ts`): `Content-Security-Policy`, `X-Frame-Options: DENY`,
`X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`
(kamera, mikrofon, konum, ödeme kapalı), `Cross-Origin-Opener-Policy: same-origin`; `X-Powered-By` kapalı;
API yanıtları `Cache-Control: no-store`. HSTS ters vekilde verilir (bkz. DEPLOYMENT).

CSP yalnızca bu siteye izin verir: başka sitelerden betik, stil, görsel, yazı tipi, çerçeve ve bağlantı yok;
`object-src 'none'`, `frame-ancestors 'none'`, `base-uri 'self'`, `form-action 'self'`. Tarayıcı yalnızca kendi
kökenine istek atabilir (Supabase çağrıları sunucudadır). Üretimde `eval` yasaktır.

Bilinen sınır: betikler için `'unsafe-inline'` açıktır. Next.js, istek başına nonce'u yalnızca tüm sayfalar her
istekte yeniden üretildiğinde ekleyebilir; bu, uygulamanın kullandığı Partial Prerendering ile uyumsuzdur
(Next.js belgesi). Uygulama `dangerouslySetInnerHTML` kullanmaz ve React tüm çıktıyı kaçışlar; CSP ek olarak
dışarıdan betik yüklenmesini ve veri sızdırılmasını engeller. E2E testi gerçek tarayıcıda CSP ihlali olmadığını
doğrular.

## Doğrulanan senaryolar (testler)

- `tests/db/rls.test.ts`, `tests/db/phase2.test.ts`: anonim erişim yok; kullanıcılar arası izolasyon; sahiplik
  devredilemez; üye rol/ayar/entegrasyon değiştiremez; test sonucu sütunları yazılamaz; son owner düşürülemez;
  ajan görev kuralları; aktivite kaydı yazılamaz; RPC'ler yalnızca kendi verisini sayar.
- `tests/db/rollback.test.ts`: geri alma betiği Faz 1 şemasını geri getirir.
- `tests/unit`: API sarmalayıcı (401/403/415/413/400/422/503/500, CSRF), yönetici uçlarının rol kontrolü,
  çerez ayarları, logger maskeleme, hız sınırlayıcı ve adres tespiti, entegrasyon durum kuralları ("Connected"
  yalnızca gerçek testle), sağlık uçları, açık yönlendirme, seed koruması.
- `tests/e2e/security.spec.ts`: iki gerçek oturumla izolasyon, CSRF, üye hesabıyla admin/owner uçlarının doğrudan
  çağrılması (`403`), entegrasyon ayarına sır eklenememesi, ajan kuralları.
- `tests/e2e/auth.spec.ts`: çerezlerin `httpOnly`/`Lax`/≤7 gün olduğu ve `document.cookie` ile okunamadığı.

## Bilinen sınırlar / sonraki adımlar

- CSP'de betikler için `'unsafe-inline'` (nonce, Partial Prerendering ile uyumsuz; yukarıya bakın).
- Hız sınırlayıcı bellek içidir; birden fazla uygulama örneği çalıştırılırsa paylaşılan bir depoya (ör. Redis)
  taşınmalıdır.
- MFA arayüzde yok (Settings yol haritasında).
- Aktivite kayıtları kişiseldir; admin için çalışma alanı genelinde denetim görünümü henüz yok.
