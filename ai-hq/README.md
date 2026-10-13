# AI HQ — Faz 1: Çalışan Temel

AI HQ; projeleri, görevleri ve otomasyonları tek yerden yöneten özel bir komuta merkezidir.
Bu klasör **bağımsız bir projedir**: depodaki Tamga Studio sitesi ve oyunlarla hiçbir dosya
paylaşmaz, onlara dokunmaz. İsterseniz klasörü olduğu gibi ayrı bir depoya taşıyabilirsiniz.

| Katman | Teknoloji |
| --- | --- |
| Uygulama | Next.js 16.4 (App Router, Cache Components), React 19.3, TypeScript 5.9 |
| Arayüz | Tailwind CSS 4.3, shadcn/ui (new-york, Radix), lucide-react, Geist yazı tipi |
| Veri & kimlik | Supabase PostgreSQL + Supabase Auth (`@supabase/ssr`), satır düzeyi güvenlik (RLS) |
| Doğrulama | Zod 4 |
| Test | Vitest 5 (birim, bileşen, veritabanı), PGlite (Docker'sız Postgres), Playwright 1.64 (uçtan uca) |

Sürümler `package-lock.json` ile kilitlidir. Node.js **22.13+** (veya 24+) gerekir.

---

## İçindekiler

1. [Neler hazır?](#neler-hazır)
2. [Hızlı başlangıç (yerel geliştirme)](#hızlı-başlangıç-yerel-geliştirme)
3. [Ortam değişkenleri](#ortam-değişkenleri)
4. [Geliştirme ve üretim ortamlarını ayırma](#geliştirme-ve-üretim-ortamlarını-ayırma)
5. [Veritabanı ve migration'lar](#veritabanı-ve-migrationlar)
6. [Komutlar](#komutlar)
7. [Testler](#testler)
8. [Üretime alma](#üretime-alma)
9. [Güvenlik modeli](#güvenlik-modeli)
10. [API](#api)
11. [Klasör yapısı](#klasör-yapısı)
12. [n8n](#n8n)

Ek belgeler: [docs/ROADMAP.md](docs/ROADMAP.md) · [docs/GUVENLIK.md](docs/GUVENLIK.md) · [docs/N8N.md](docs/N8N.md)

---

## Neler hazır?

| Menü | Durum | Açıklama |
| --- | --- | --- |
| Command Center | **Çalışıyor** | Canlı sayılar (aktif proje, açık/bloklu/geciken görev, 7 günde biten), yaklaşan görevler, son aktiviteler, aktif projelerin ilerlemesi, sistem durumu |
| Projects | **Çalışıyor** | Proje oluştur/düzenle/sil, durum ve kategori filtreleri, proje sayfasında görev panosu (Yapılacak / Sürüyor / Bloklu / Bitti), hızlı görev ekleme, görev düzenleme/silme, proje aktivitesi |
| Automation Center | **Çalışıyor (katalog)** | n8n'de zaten çalışan otomasyonlarınızı kayıt olarak tutar: ad, açıklama, tetikleyici, bağlı proje, isteğe bağlı n8n workflow kimliği, durum. **Hiçbir şey çalıştırmaz**; bağlantı Faz 2'de |
| Activity Logs | Çalışıyor | Veritabanı tetikleyicilerinin yazdığı, değiştirilemeyen denetim kaydı; türe göre filtre ve sayfalama |
| Settings | Kısmi | Hesap, ortam ve erişim politikası (salt okunur) + çıkış. Kalanı yol haritasında |
| Game Studio, SaaS & Business, AI Agent Hub, Integrations | Planlı | Sahte ekran yok: her biri "bugün ne var / ne planlı / neye bağlı" bilgisini gösteren gerçek geliştirme planına bağlı ([docs/ROADMAP.md](docs/ROADMAP.md)) |

---

## Hızlı başlangıç (yerel geliştirme)

İki seçenek var. Docker kuruluysa **A**, değilse **B**.

### A) Yerel Supabase (Docker ile)

```bash
cd ai-hq
npm ci
npm run db:start          # Supabase'i Docker'da başlatır ve migration'ları uygular
```

`db:start` çıktısındaki **API URL** ve **Publishable key** değerlerini kullanın:

```bash
cp .env.example .env.local
# .env.local içinde:
#   APP_ENV=development
#   SUPABASE_URL=http://127.0.0.1:54321
#   SUPABASE_PUBLISHABLE_KEY=<db:start çıktısındaki publishable key>
#   SUPABASE_SECRET_KEY=<db:start çıktısındaki secret key>   (yalnızca seed için)
npm run db:seed:dev       # geliştirme kullanıcısı + örnek veri (yalnızca development'ta çalışır)
npm run dev               # http://localhost:3000
```

Seed betiği, `DEV_SEED_PASSWORD` boşsa rastgele bir parola üretir ve **bir kez** ekrana yazar.
Yerel Supabase'de kayıt (sign-up) kapalıdır (`supabase/config.toml`); hesaplar yalnızca yönetici
tarafından oluşturulur.

### B) Barındırılan (hosted) bir geliştirme projesi

1. [supabase.com](https://supabase.com) üzerinde **yalnızca geliştirme için** bir proje açın (ör. `ai-hq-dev`).
2. Migration'ları uygulayın (CLI ile, proje ref'iniz ve veritabanı parolanızla):
   ```bash
   cd ai-hq && npm ci
   npx supabase login
   npx supabase link --project-ref <dev-proje-ref>
   npm run db:push
   ```
   Alternatif: `supabase/migrations/*.sql` dosyasının içeriğini Supabase panelindeki SQL Editor'da çalıştırın.
3. Panelde **Authentication → Sign In / Providers**: e-posta ile girişi açık, **"Allow new users to sign up" kapalı** bırakın.
4. `.env.local` dosyasını doldurun (`SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `APP_ENV=development`).
5. Geliştirme kullanıcısı oluşturun: ya panelde **Authentication → Users → Add user**, ya da
   `SUPABASE_SECRET_KEY` + `DEV_SUPABASE_PROJECT_REF=<dev-proje-ref>` ayarlayıp `npm run db:seed:dev`.
6. `npm run dev`

---

## Ortam değişkenleri

Tam liste ve açıklamalar: [`.env.example`](.env.example). Hiçbir değişken `NEXT_PUBLIC_` önekli değildir;
yani **hiçbiri tarayıcıya gönderilmez**. Tüm Supabase çağrıları sunucuda yapılır.

| Değişken | Zorunlu | Nerede kullanılır | Not |
| --- | --- | --- | --- |
| `APP_ENV` | Üretimde evet | Uygulama | `development` / `staging` / `production` |
| `SUPABASE_URL` | Evet | Uygulama | O ortama ait Supabase projesi. Uzak adresler `https` olmalı |
| `SUPABASE_PUBLISHABLE_KEY` | Evet | Uygulama | Publishable (`sb_publishable_…`) veya eski anon anahtarı. Secret/service_role anahtarı girilirse uygulama **başlamaz** |
| `AI_HQ_ALLOWED_EMAILS` | Üretimde evet | Uygulama | Virgülle ayrılmış izinli e-postalar |
| `SUPABASE_SECRET_KEY` | Hayır | Sadece seed betiği | Geliştirme projesinin secret anahtarı. Üretime **konmaz** |
| `DEV_SUPABASE_PROJECT_REF` | Uzak dev projeye seed atarken | Sadece seed betiği | Hedefin gerçekten geliştirme projesi olduğunu teyit eder |
| `DEV_SEED_EMAIL`, `DEV_SEED_PASSWORD` | Hayır | Sadece seed betiği | Boşsa `dev@ai-hq.local` ve rastgele parola |
| `N8N_BASE_URL`, `N8N_API_KEY`, `N8N_WEBHOOK_SIGNING_SECRET` | Hayır | Faz 2 | Faz 1'de bağlantı kurulmaz; yalnızca biçim doğrulanır |

Yapılandırma eksik/hatalıysa: API'ler `503 CONFIGURATION_ERROR` döner, sayfalar giriş ekranına
yönlenir; geliştirme derlemesinde giriş ekranı hangi değişkenin eksik olduğunu (değerini değil) listeler.

**Sağlanmayan kimlik bilgileri:** Bu depoya hiçbir gerçek anahtar, URL veya webhook adresi eklenmedi.
Supabase projelerinizi açtıktan sonra değerleri yalnızca `.env.local` (yerel) ve barındırma
sağlayıcınızın şifreli ortam ayarlarına (üretim) girin.

---

## Geliştirme ve üretim ortamlarını ayırma

- **Ayrı Supabase projeleri:** geliştirme için yerel Supabase veya `ai-hq-dev`, üretim için `ai-hq-prod`.
  Her ortamın kendi `SUPABASE_URL` ve anahtarı vardır; veriler fiziksel olarak ayrıdır.
- **`APP_ENV` kontrolleri:** `production` modunda yerel Supabase adresi, `http` ve boş izin listesi reddedilir.
  Arayüzün üst çubuğunda ortam rozeti (Development / Staging / Production) her zaman görünür.
- **Örnek veri yalnızca geliştirmede:** `npm run db:seed:dev` yalnızca `APP_ENV=development` iken ve hedef
  yerel Supabase ya da `DEV_SUPABASE_PROJECT_REF` ile açıkça belirtilmiş geliştirme projesiyse çalışır;
  aksi halde reddeder. Örnek kayıtlar `[Demo] ` önekiyle işaretlenir. Migration'larda hiç örnek veri yoktur
  ve `config.toml` içinde SQL seed kapalıdır.
- **Secret anahtar üretime girmez:** uygulama çalışma zamanında yalnızca publishable anahtarı kullanır.

---

## Veritabanı ve migration'lar

Migration: [`supabase/migrations/20261013120000_phase1_foundation.sql`](supabase/migrations/20261013120000_phase1_foundation.sql)

| Nesne | Açıklama |
| --- | --- |
| `projects` | ad, açıklama, durum, kategori, öncelik, bitiş tarihi, sahip |
| `tasks` | projeye bağlı görevler; `done` olunca `completed_at` otomatik |
| `automations` | otomasyon katalog kayıtları; isteğe bağlı proje ve n8n workflow **kimliği** (URL/anahtar kabul edilmez) |
| `activity_logs` | yalnızca tetikleyicilerin yazdığı, kullanıcının değiştiremediği denetim kaydı |
| `project_overview` (view) | görev sayaçlarıyla projeler (`security_invoker`, RLS geçerli) |
| `command_center_summary()` | Command Center sayıları tek sorguda (`security invoker`) |

Güvenlik kuralları: her tabloda RLS açık; satır yalnızca sahibine (`auth.uid()`) görünür;
`tasks`/`automations` projeye `(project_id, owner_id)` bileşik yabancı anahtarıyla bağlı (başkasının
projesine kayıt eklenemez); `anon` rolünün hiçbir erişimi yok; `activity_logs` kullanıcı için salt okunur.
Ayrıntı: [docs/GUVENLIK.md](docs/GUVENLIK.md).

Şema değişince türleri yenileyin: `npm run db:start && npm run db:types`.

---

## Komutlar

| Komut | Ne yapar |
| --- | --- |
| `npm run dev` | Geliştirme sunucusu |
| `npm run build` / `npm start` | Üretim derlemesi / çalıştırma |
| `npm run lint` | ESLint |
| `npm run typecheck` | Route türlerini üretir + `tsc --noEmit` |
| `npm test` | Tüm Vitest projeleri (birim + bileşen + veritabanı) |
| `npm run test:unit` / `npm run test:db` | Sadece birim+bileşen / sadece veritabanı (RLS) testleri |
| `npm run test:e2e` | Playwright uçtan uca testler (üretim derlemesi + test emülatörü) |
| `npm run check` | lint + typecheck + test + build |
| `npm run db:start` / `db:stop` / `db:reset` | Yerel Supabase (Docker gerekir) |
| `npm run db:push` | Migration'ları bağlı (linked) Supabase projesine uygular |
| `npm run db:types` | Yerel veritabanından TypeScript türleri üretir |
| `npm run db:seed:dev` | Geliştirme kullanıcısı + örnek veri (üretimde reddeder) |

---

## Testler

| Paket | Kapsam | Gereksinim |
| --- | --- | --- |
| `tests/unit` | ortam doğrulama, izin listesi, açık yönlendirme koruması, Zod şemaları, API sarmalayıcı (401/403/415/413/400/503/500, CSRF), proxy oturum kontrolü, proje/görev route'ları, n8n katmanının ağa çıkmadığı, menü–sayfa–yol haritası tutarlılığı, seed koruması | yok |
| `tests/unit/*.test.tsx` | menü aktif durumu ve "Planned" etiketleri, aktivite akışı (jsdom) | yok |
| `tests/db` | migration'ı uygulayıp RLS, yetkiler, tetikleyiciler, view/RPC ve hesap silmeyi gerçek SQL ile test eder | yok (PGlite). `TEST_DATABASE_URL` verilirse gerçek PostgreSQL'de çalışır; adı `test` içermeyen veritabanını reddeder |
| `tests/e2e` | giriş/çıkış, yönlendirmeler, izin listesi, kullanıcılar arası izolasyon, CSRF, menü gezintisi, proje/görev/otomasyon akışları ve kalıcılık | Playwright tarayıcısı (`npx playwright install chromium`) |

Uçtan uca testler, uygulamanın üretim derlemesini **test amaçlı bir Supabase emülatörüne** karşı çalıştırır
(`tests/e2e/support/supabase-emulator.ts`): Supabase Auth ve PostgREST'in bu uygulamanın kullandığı alt
kümesini, gerçek migration'ların yüklendiği PGlite üzerinde ve PostgREST'in yaptığı gibi rol + JWT claim'leriyle
çalıştırır; böylece RLS'yi Postgres uygular. Bu emülatör yalnızca testler içindir, uygulama asla kullanmaz ve
gerçek Supabase ile doğrulamanın yerini tutmaz.

```bash
npm test
npx playwright install chromium   # bir kez
npm run test:e2e
# Önceden kurulu bir Chromium kullanmak için:
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/yol/chromium npm run test:e2e
```

---

## Üretime alma

Önerilen: Vercel (veya Node.js 22 çalıştırabilen herhangi bir platform).

1. Üretim için **ayrı** bir Supabase projesi açın (`ai-hq-prod`), migration'ı `npm run db:push` ile uygulayın,
   Auth'ta kayıt olmayı kapatın ve kendi kullanıcınızı panelden ekleyin. Seed **çalıştırmayın**.
2. Vercel'de projeyi bu depodan içe aktarın ve **Root Directory = `ai-hq`** seçin.
3. Ortam değişkenleri (Production): `APP_ENV=production`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`,
   `AI_HQ_ALLOWED_EMAILS`. `SUPABASE_SECRET_KEY` **eklemeyin**.
4. Supabase → Authentication → URL Configuration: **Site URL** olarak üretim adresinizi girin.
5. Önerilir: Supabase'de MFA, sızdırılmış parola koruması ve yeterli parola uzunluğu.

Not: Bu klasör depo kökündeki statik siteyle (GitHub Pages) aynı depodadır. GitHub Pages, ana dala
birleştirildiğinde bu klasördeki kaynak dosyaları da statik dosya olarak yayınlayabilir (gizli bilgi
içermezler). Bunu istemiyorsanız klasörü ayrı bir depoya taşımanız en temiz çözümdür.

---

## Güvenlik modeli

- Oturum her istekte **sunucuda** `supabase.auth.getUser()` ile Supabase Auth'a doğrulatılır
  (çerez içeriğine körü körüne güvenilmez): önce `src/proxy.ts`, sonra her sayfa ve her API ucunda yeniden.
- İzin listesi (`AI_HQ_ALLOWED_EMAILS`) proxy'de, API'lerde ve giriş anında uygulanır; listede olmayan hesabın
  oturumu giriş sırasında kapatılır.
- Uygulama yalnızca publishable anahtarla çalışır, yani tüm sorgular kullanıcı olarak RLS'ye tabidir.
- Durum değiştiren API isteklerinde: aynı köken kontrolü, `application/json` zorunluluğu, 64 KB gövde sınırı,
  bilinmeyen alanları reddeden katı Zod şemaları (`owner_id` gibi alanlar istemciden alınmaz).
- Hata yanıtları tek biçimdedir ve veritabanı mesajlarını, yığın izlerini sızdırmaz:
  `{ "error": { "code", "message", "details?", "requestId?" } }`.
- Güvenlik başlıkları (`X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, COOP).

Ayrıntı ve bilinen sınırlar: [docs/GUVENLIK.md](docs/GUVENLIK.md).

---

## API

Tüm uçlar oturum ister (aksi: `401`), izin listesi dışı hesaplara `403` döner. Gövdeler JSON'dur.
Başarılı yanıt: `{ "data": ... }` (silmede `204`).

| Yöntem | Yol | Açıklama |
| --- | --- | --- |
| GET | `/api/health` | Herkese açık; yalnızca yapılandırmanın geçerli olup olmadığını söyler |
| GET / POST | `/api/projects` | Listele (`?status=`, `?category=`) / oluştur |
| GET / PATCH / DELETE | `/api/projects/:projectId` | Getir / güncelle / sil |
| GET / POST | `/api/projects/:projectId/tasks` | Görevleri listele / görev ekle |
| PATCH / DELETE | `/api/tasks/:taskId` | Görev güncelle / sil |
| GET / POST | `/api/automations` | Otomasyon kayıtlarını listele / ekle |
| PATCH / DELETE | `/api/automations/:automationId` | Güncelle / sil |
| GET | `/api/activity` | Aktivite (`?limit=1..100`, `?before=<id>`, `?entityType=`) |

Hata kodları: `VALIDATION_ERROR`, `INVALID_JSON` (400) · `UNAUTHENTICATED` (401) · `FORBIDDEN` (403) ·
`NOT_FOUND` (404) · `CONFLICT` (409) · `PAYLOAD_TOO_LARGE` (413) · `UNSUPPORTED_MEDIA_TYPE` (415) ·
`INTERNAL_ERROR` (500, `requestId` ile) · `CONFIGURATION_ERROR` (503).

---

## Klasör yapısı

```text
ai-hq/
├─ src/
│  ├─ app/
│  │  ├─ (hq)/            # oturum gerektiren ekranlar (sidebar düzeni)
│  │  ├─ api/             # Route Handler'lar (JSON API)
│  │  ├─ actions/         # Server Action'lar (giriş / çıkış)
│  │  └─ login/           # giriş ekranı
│  ├─ components/         # ui/ (shadcn), layout/, projects/, tasks/, automations/, ...
│  ├─ lib/
│  │  ├─ api/             # hata türleri, route sarmalayıcı, PostgREST hata eşleme
│  │  ├─ auth/            # oturum doğrulama, izin listesi, güvenli yönlendirme
│  │  ├─ data/            # veri erişim katmanı (tek yer)
│  │  ├─ integrations/n8n # bağlantısız n8n servis katmanı (Faz 2 için)
│  │  ├─ supabase/        # sunucu istemcisi, proxy oturum yenileme
│  │  ├─ validation/      # Zod şemaları
│  │  ├─ env.ts           # ortam doğrulama
│  │  └─ roadmap.ts       # geliştirme planı (planlı menüler bunu gösterir)
│  └─ proxy.ts            # her istekten önce oturum kontrolü (Next 16'da middleware'in yeni adı)
├─ supabase/              # config.toml + migrations/
├─ scripts/               # seed-dev.ts (yalnızca geliştirme)
├─ tests/                 # unit/, db/, e2e/
└─ docs/                  # ROADMAP, GUVENLIK, N8N
```

---

## n8n

Faz 1'de n8n'e **bağlanılmaz** ve AI HQ **hiçbir n8n akışı oluşturmaz/düzenlemez**. Akışlarınız
(ör. Telegram mesajlarını yanıtlama) sizde hazır; Faz 2'de AI HQ yalnızca bu mevcut akışlara sunucu
tarafından bağlanacak. Plan ve güvenlik kuralları: [docs/N8N.md](docs/N8N.md).
