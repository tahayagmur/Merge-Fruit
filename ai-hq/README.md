# AI HQ — Faz 2: Çekirdek Sistem

AI HQ; projeleri, görevleri, otomasyon kayıtlarını, AI ajan tanımlarını ve ileride bağlanacak dış servisleri
tek yerden yöneten özel bir komuta merkezidir. Bu klasör **bağımsız bir projedir**: depodaki Tamga Studio
sitesi ve oyunlarla hiçbir dosya paylaşmaz, onlara dokunmaz.

> **Bu fazda hiçbir dış sistem bağlı değildir.** n8n, Claude/OpenAI, oyun mağazaları, ödeme sistemleri ve
> webhook'lar için yalnızca güvenli, modüler altyapı hazırlandı; hiçbirine istek gönderilmez ve hiçbir
> entegrasyon gerçek bir bağlantı testi geçmeden "Connected" gösterilmez.

| Katman | Teknoloji |
| --- | --- |
| Uygulama | Next.js 16.4 (App Router, Cache Components, standalone çıktı), React 19.3, TypeScript 5.9 |
| Arayüz | Tailwind CSS 4.3, shadcn/ui (Radix), lucide-react, Geist yazı tipi — [tasarım sistemi](docs/DESIGN_SYSTEM.md) |
| Veri & kimlik | Supabase PostgreSQL + Supabase Auth (`@supabase/ssr`), satır düzeyi güvenlik (RLS), roller |
| Doğrulama | Zod 4 |
| Test | Vitest 5 (birim, bileşen, veritabanı), PGlite, Playwright 1.64 (uçtan uca) |
| Dağıtım | Dockerfile + Docker Compose (yalnızca uygulama) — [dağıtım kontrol listesi](docs/DEPLOYMENT.md) |

Sürümler `package-lock.json` ile kilitlidir. Node.js **22.13+** (veya 24+) gerekir.

---

## İçindekiler

1. [Neler hazır?](#neler-hazır)
2. [Hızlı başlangıç](#hızlı-başlangıç)
3. [Ortam değişkenleri](#ortam-değişkenleri)
4. [Roller](#roller)
5. [Gerçek veri ve demo veri](#gerçek-veri-ve-demo-veri)
6. [Entegrasyonlar](#entegrasyonlar)
7. [Veritabanı ve migration'lar](#veritabanı-ve-migrationlar)
8. [Komutlar](#komutlar)
9. [Testler](#testler)
10. [Üretime alma](#üretime-alma)
11. [Güvenlik modeli](#güvenlik-modeli)
12. [API](#api)
13. [Klasör yapısı](#klasör-yapısı)

Ek belgeler: [DEPLOYMENT](docs/DEPLOYMENT.md) · [DATA_MODEL](docs/DATA_MODEL.md) ·
[DESIGN_SYSTEM](docs/DESIGN_SYSTEM.md) · [GUVENLIK](docs/GUVENLIK.md) · [ROADMAP](docs/ROADMAP.md) ·
[N8N](docs/N8N.md) · [HERMES](docs/HERMES.md) · [PHASE2_PLAN](docs/PHASE2_PLAN.md)

---

## Neler hazır?

| Menü | Durum | Bugün çalışanlar | Dış bağlantı gerektiren (sonraki fazlar) |
| --- | --- | --- | --- |
| Command Center | Çalışıyor | Canlı sayılar (projeler, açık/süren/bloklu/geciken görevler, 7 günde bitenler, ajan kuyruğu), yaklaşan görevler, son aktivite, aktif projeler, sistem ve entegrasyon durumu. Demo veriler varsayılan olarak **hariç**; anahtarla dahil edilebilir | — |
| Projects | Çalışıyor | Oluştur/düzenle/sil, durum + kategori filtreleri, arama, sayfalama, görev panosu, hazır kontrol listeleri (oyun yayını, SaaS lansmanı) | — |
| Automation Center | Çalışıyor (katalog) | Mevcut otomasyonlarınızın kaydı: tetikleyici, proje, iş akışı motoru (ör. n8n) ve workflow **kimliği**, durum, arama, filtre, sayfalama. **Hiçbir şey çalıştırmaz** | Faz 3: mevcut n8n akışlarınıza bağlanma |
| Game Studio | Kısmi | Oyun projeleri durum hattında, yayın kontrol listesi, mağaza entegrasyonlarının gerçek yapılandırma durumu | Faz 5: Google Play / App Store verisi |
| SaaS & Business | Kısmi | SaaS projeleri, lansman kontrol listesi. Gelir verisi bağlı kaynak olmadan **hiç gösterilmez** (tahmini/örnek sayı yok) | Faz 6: salt okunur ödeme verisi |
| AI Agent Hub | Kısmi | Ajan tanımları (talimat, sağlayıcı, model, yetenekler, sürüm), görev kuyruğu (kuyruğa alma, iptal, silme), arama, filtre, sayfalama | Faz 4: ajan çalıştırma ortamı |
| Integrations | Kısmi | 8 entegrasyonun kataloğu (n8n, Hermes Agent, Claude, OpenAI, webhook'lar, Google Play, App Store, Stripe), durum (Not configured / Ready to configure / Connected / Error), eksik ayar ve sunucu sırrı (yalnızca **var/yok**), yöneticiler için gizli olmayan ayarlar | Faz 3+: bağlantı testleri (connector'lar) |
| Activity Logs | Çalışıyor | Değiştirilemez denetim kaydı; 8 kayıt türüne göre filtre, arama, sayfalama | — |
| Settings | Çalışıyor | Profil, parola değişimi (mevcut parola tekrar doğrulanır), **iki adımlı giriş (kimlik doğrulayıcı uygulaması)**, tüm cihazlardan çıkış, çalışma alanı adı + saat dilimi, kullanıcılar ve roller, demo veri yükle/kaldır, ortam bilgisi | Kurtarma kodları |

Üst çubukta global arama (projeler, görevler, otomasyonlar, ajanlar), çalışma alanı adı, ortam rozeti ve rol
rozeti bulunur.

---

## Hızlı başlangıç

### A) Yerel Supabase (Docker ile)

```bash
cd ai-hq
npm ci
npm run db:start          # Supabase'i Docker'da başlatır ve migration'ları uygular
cp .env.example .env.local
# .env.local içinde:
#   APP_ENV=development
#   SUPABASE_URL=http://127.0.0.1:54321
#   SUPABASE_PUBLISHABLE_KEY=<db:start çıktısındaki publishable key>
#   SUPABASE_SECRET_KEY=<db:start çıktısındaki secret key>   (yalnızca seed için)
npm run db:seed:dev       # geliştirme kullanıcısı + etiketli demo veri (yalnızca development)
npm run dev               # http://localhost:3000
```

Seed betiği, `DEV_SEED_PASSWORD` boşsa rastgele bir parola üretir ve **bir kez** yazar. Kayıt (sign-up)
kapalıdır; hesapları yönetici oluşturur. **İlk oluşturulan kullanıcı çalışma alanı sahibi (owner) olur**,
sonrakiler üye (member).

### B) Barındırılan (hosted) bir geliştirme projesi

1. Supabase'de **yalnızca geliştirme için** bir proje açın (ör. `ai-hq-dev`).
2. `npx supabase login && npx supabase link --project-ref <dev-ref> && npm run db:push`
3. Authentication → Sign In / Providers: e-posta girişi açık, **yeni kayıt kapalı**.
4. `.env.local` dosyasını doldurun, kullanıcıyı panelden veya `npm run db:seed:dev` ile oluşturun
   (`DEV_SUPABASE_PROJECT_REF` gerekir), `npm run dev`.

---

## Ortam değişkenleri

Tam liste: [`.env.example`](.env.example). Hiçbir değişken `NEXT_PUBLIC_` önekli değildir; **hiçbiri
tarayıcıya gönderilmez**. Üretim için ayrıntılı tablo: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md#3-ortam-değişkenleri).

| Değişken | Zorunlu | Not |
| --- | --- | --- |
| `APP_ENV` | Üretimde evet | `development` / `staging` / `production` |
| `SUPABASE_URL` | Evet | O ortamın Supabase projesi; üretimde `https` ve yerel olmayan adres |
| `SUPABASE_PUBLISHABLE_KEY` | Evet | Publishable/anon anahtar. Secret/service_role anahtarı girilirse uygulama **başlamaz** |
| `AI_HQ_ALLOWED_EMAILS` | Üretimde evet | Virgülle ayrılmış izinli e-postalar |
| `SUPABASE_SECRET_KEY`, `DEV_SUPABASE_PROJECT_REF`, `DEV_SEED_EMAIL`, `DEV_SEED_PASSWORD` | Hayır | Yalnızca geliştirme seed betiği; üretime **konmaz** |
| `N8N_API_KEY`, `HERMES_API_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `WEBHOOK_SIGNING_SECRET`, `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`, `APP_STORE_CONNECT_PRIVATE_KEY`, `STRIPE_RESTRICTED_KEY`, `N8N_WEBHOOK_SIGNING_SECRET` | Hayır | **Şu an kullanılmaz.** Integrations sayfası yalnızca tanımlı olup olmadıklarını gösterir; değerleri okunmaz, gösterilmez, kaydedilmez |

Bu depoya hiçbir gerçek anahtar, URL veya webhook adresi eklenmedi.

---

## Roller

| İşlem | Owner | Admin | Member |
| --- | :-: | :-: | :-: |
| Kendi projeleri, görevleri, otomasyonları, ajanları, ajan görevleri | ✓ | ✓ | ✓ |
| Kendi profili, parola, oturumlar, kendi demo verisi | ✓ | ✓ | ✓ |
| Entegrasyon ve çalışma alanı ayarlarını görmek | ✓ | ✓ | ✓ (salt okunur) |
| Entegrasyon ayarlarını değiştirmek / sıfırlamak, çalışma alanı adı ve saat dilimi | ✓ | ✓ | ✗ |
| Kullanıcı listesini görmek | ✓ | ✓ | ✗ |
| Rol değiştirmek (son owner kendini düşüremez) | ✓ | ✗ | ✗ |

Her kural **üç katmanda** uygulanır: arayüz (buton gösterilmez), API (`403`), veritabanı (RLS, sütun
yetkileri ve `set_workspace_role()` fonksiyonu). Arayüzde gizlemek tek başına güvenlik sayılmaz; testler API'yi
doğrudan çağırarak denetler.

---

## Gerçek veri ve demo veri

- Demo kayıtları `is_demo = true` bayrağı ve `[Demo] ` önekiyle işaretlidir; listelerde **DEMO** rozetiyle görünür.
- Command Center sayıları demo veriyi **dışarıda tutar**; "Include demo data" anahtarı açılırsa uyarı gösterilir.
- Demo veri **Settings → Demo data** ile yüklenir/kaldırılır (kaldırma yalnızca bayraklı kayıtları siler) ya da
  `npm run db:seed:dev` ile. Üretimde (`APP_ENV=production`) demo veri yükleme reddedilir.
- Boş durumlar gerçek boşluğu gösterir; hiçbir ekranda uydurma istatistik yoktur.

---

## Entegrasyonlar

Altyapı `src/lib/integrations/` altındadır: her servis tek bir tanımdır (`registry.ts`), bağlantı kodu
(connector) ayrı eklenir (`connectors.ts` — **bu fazda boş**). Durum kuralları (`status.ts`):

| Durum | Ne zaman |
| --- | --- |
| Not configured | Zorunlu ayar veya sunucu sırrı eksik |
| Ready to configure | Ayarlar ve sırlar tamam, ama bağlantı doğrulanmadı (connector yok ya da test yapılmadı) |
| Connected | **Yalnızca** connector var + entegrasyon açık + mevcut ayarlarla yapılan son gerçek bağlantı testi başarılı |
| Error | Kayıtlı ayarlar geçersiz ya da mevcut ayarlarla yapılan son test başarısız |

Gizli olmayan ayarlar (URL, kimlik, mod) veritabanında; sırlar yalnızca sunucu ortam değişkeninde tutulur.
Ayar şemaları bilinmeyen alanları reddeder, böylece formdan anahtar kaydedilemez. Yeni bir servis eklemek için
bir tanım (ve bağlanma zamanı gelince bir connector) yeterlidir. n8n için ayrıca: [docs/N8N.md](docs/N8N.md).

---

## Veritabanı ve migration'lar

| Dosya | İçerik |
| --- | --- |
| `supabase/migrations/20261013120000_phase1_foundation.sql` | Faz 1: projeler, görevler, otomasyonlar, aktivite kaydı |
| `supabase/migrations/20261014120000_phase2_core.sql` | Faz 2: profiller/roller, sistem ayarları, entegrasyon yapılandırmaları, ajan tanımları ve görev kayıtları, iş akışı meta verisi, demo bayrakları, saat dilimine göre "bugün" |
| `supabase/rollback/20261014120000_phase2_core_down.sql` | Faz 2'yi geri alır (Faz 2 verisini siler — önce yedek) |

Tablolar, ilişkiler, indeksler ve erişim kuralları: [docs/DATA_MODEL.md](docs/DATA_MODEL.md).
Şema değişince türleri yenileyin: `npm run db:start && npm run db:types`.

---

## Komutlar

| Komut | Ne yapar |
| --- | --- |
| `npm run dev` | Geliştirme sunucusu |
| `npm run build` / `npm start` | Üretim derlemesi / standalone sunucuyu çalıştırma |
| `npm run lint` / `npm run typecheck` | ESLint / route türleri + `tsc --noEmit` |
| `npm test` | Tüm Vitest projeleri (birim + bileşen + veritabanı) |
| `npm run test:unit` / `npm run test:db` | Birim+bileşen / veritabanı (RLS) testleri |
| `npm run test:e2e` | Playwright, test emülatörüne karşı |
| `npm run test:e2e:supabase` | Playwright, **gerçek yerel Supabase**'e karşı (`npm run db:start` gerekir) |
| `npm run check` | lint + typecheck + test + build |
| `npm run db:start` / `db:stop` / `db:reset` / `db:push` / `db:types` | Supabase CLI işlemleri |
| `npm run db:seed:dev` | Geliştirme kullanıcısı + demo veri (üretimde reddeder) |

---

## Testler

| Paket | Kapsam |
| --- | --- |
| `tests/unit` (Node) | ortam doğrulama, izin listesi, güvenli yönlendirme, Zod şemaları, API sarmalayıcı (401/403/415/413/400/422/503/500, CSRF), yönetici uçları, proxy oturumu, çerez ayarları, maskeleyen logger, hız sınırlayıcı, sağlık uçları, entegrasyon durum kuralları, demo servis, menü–sayfa–plan tutarlılığı, seed koruması |
| `tests/unit/*.test.tsx` (jsdom) | menü, aktivite akışı, filtre/sayfalama/arama bileşenleri |
| `tests/db` | iki migration'ı uygulayıp RLS, rol yetkileri, sütun yetkileri, tetikleyiciler, ajan görev kuralları, RPC'ler, geri alma (rollback) betiği — PGlite'ta; `TEST_DATABASE_URL` ile gerçek PostgreSQL'de |
| `tests/e2e` | giriş/çıkış, iki adımlı giriş, CSP ihlali olmaması, çerez güvenliği, izin listesi, kullanıcılar arası izolasyon, CSRF, rol kısıtları (API'yi doğrudan çağırarak), dokuz ekranın akışları, arama/filtre/sayfalama, demo veri, entegrasyon ayarları |

Uçtan uca testler iki hedefte çalışır: depodaki test emülatörü (Docker gerekmez) veya gerçek yerel Supabase
(`npm run test:e2e:supabase`). Emülatör yalnızca testler içindir; gerçek Supabase ile doğrulamanın yerini tutmaz.

```bash
npm test
npx playwright install chromium   # bir kez (veya PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH)
npm run test:e2e
```

---

## Üretime alma

Sunucunuza **hiçbir işlem yapılmadı**. Uygulama taşınabilir hazırlandı: tek bir Docker imajı, tüm ayarlar
ortam değişkeninden, sağlık uçları `/api/health` (canlılık) ve `/api/health/ready` (Supabase Auth erişimi).
Adım adım kontrol listesi, ters vekil sunucu örneği, günlükler, yedekleme ve geri dönüş:
**[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**.

---

## Güvenlik modeli

- Oturum her istekte sunucuda `supabase.auth.getUser()` ile doğrulanır: proxy, her sayfa ve her API ucu.
- Oturum çerezleri `httpOnly`, `SameSite=Lax`, üretimde `Secure`, en fazla 7 gün.
- İsteğe bağlı **iki adımlı giriş (TOTP)**: açıksa parola oturumu (`aal1`) kod girilene kadar hiçbir sayfaya veya API'ye erişemez (proxy + sayfalar + API).
- İçerik Güvenlik Politikası (CSP): betik, stil, bağlantı yalnızca bu siteden; çerçeveleme ve eklentiler kapalı.
- İzin listesi proxy'de, API'lerde ve girişte uygulanır. Giriş ve parola değişiminde başarısız deneme sınırı.
- Uygulama yalnızca publishable anahtarla çalışır; tüm sorgular kullanıcı olarak RLS'ye tabidir.
- Yönetici/owner işlemleri API'de rol kontrolü + veritabanında RLS ve sütun yetkileriyle korunur.
- Durum değiştiren isteklerde aynı köken, `application/json`, 64 KB gövde sınırı, katı Zod şemaları.
- Hata yanıtları tek biçimlidir, veritabanı mesajı/yığın izi sızdırmaz; iş kuralı ihlalleri `422` ile anlaşılır
  mesaj döner. Günlükler JSON satırlarıdır ve parola/token/anahtar alanlarını maskeler.

Ayrıntı ve bilinen sınırlar: [docs/GUVENLIK.md](docs/GUVENLIK.md).

---

## API

Tüm uçlar oturum ister (aksi `401`); izin listesi dışı hesaplar `403` alır. Başarılı yanıt `{ "data": ... }`
(silmede `204`). Listeler `{ items, total, page, pageSize }` döner.

| Yöntem | Yol | Açıklama |
| --- | --- | --- |
| GET | `/api/health`, `/api/health/ready` | Herkese açık canlılık / hazır olma |
| GET / POST | `/api/projects` | Listele (`?status`, `?category`, `?q`, `?page`) / oluştur |
| GET / PATCH / DELETE | `/api/projects/:id` | Getir / güncelle / sil |
| POST | `/api/projects/:id/template` | Hazır kontrol listesini görev olarak ekle (`game_release`, `saas_launch`) |
| GET / POST | `/api/projects/:id/tasks` · PATCH / DELETE `/api/tasks/:id` | Görevler |
| GET / POST | `/api/automations` · PATCH / DELETE `/api/automations/:id` | Otomasyon kayıtları (`?status`, `?q`, `?page`) |
| GET / POST | `/api/agents` · GET / PATCH / DELETE `/api/agents/:id` | Ajan tanımları (`?status`, `?q`, `?page`) |
| GET / POST | `/api/agents/:id/tasks` · PATCH / DELETE `/api/agent-tasks/:id` | Ajan görev kuyruğu (yalnızca iptal ve düzenleme) |
| GET | `/api/integrations` · GET `/api/integrations/:key` | Entegrasyon durumu (sır değeri içermez) |
| PATCH / DELETE | `/api/integrations/:key` | Ayarları kaydet / sıfırla — **admin** |
| GET / PATCH | `/api/settings` | Çalışma alanı ayarları (PATCH **admin**) |
| GET / PATCH | `/api/profile` | Kendi profilin |
| GET | `/api/users` | Kullanıcılar — **admin** |
| PATCH | `/api/users/:id/role` | Rol değiştir — **owner** |
| GET / POST / DELETE | `/api/demo-data` | Demo veri durumu / yükle / kaldır |
| GET | `/api/search?q=` | Global arama |
| GET | `/api/activity` | Aktivite (`?limit`, `?before`, `?entityType`, `?q`) |

Hata kodları: `VALIDATION_ERROR`, `INVALID_JSON` (400) · `UNAUTHENTICATED`, `MFA_REQUIRED` (401) · `FORBIDDEN` (403) ·
`NOT_FOUND` (404) · `CONFLICT` (409) · `PAYLOAD_TOO_LARGE` (413) · `UNSUPPORTED_MEDIA_TYPE` (415) ·
`RULE_VIOLATION` (422) · `INTERNAL_ERROR` (500, `requestId` ile) · `CONFIGURATION_ERROR` (503).

---

## Klasör yapısı

```text
ai-hq/
├─ src/
│  ├─ app/
│  │  ├─ (hq)/            # oturum gerektiren ekranlar (9 modül + arama + yol haritası)
│  │  ├─ api/             # JSON API (Route Handler'lar)
│  │  ├─ actions/         # Server Action'lar (giriş, çıkış, parola, tüm oturumlar)
│  │  └─ login/
│  ├─ components/         # ui/ (shadcn), common/ (durum, filtre, sayfalama, onay), layout/, modül bileşenleri
│  ├─ lib/
│  │  ├─ api/             # hata türleri, route sarmalayıcı, PostgREST hata eşleme
│  │  ├─ auth/            # oturum, izin listesi, roller (workspace.ts)
│  │  ├─ data/            # veri erişim katmanı (tek yer)
│  │  ├─ demo/            # etiketli demo veri seti ve yükleyici
│  │  ├─ integrations/    # entegrasyon kaydı, durum kuralları, connector arayüzü (boş)
│  │  ├─ supabase/        # sunucu istemcisi, çerez ayarları, proxy oturum yenileme
│  │  ├─ validation/      # Zod şemaları
│  │  ├─ logger.ts        # maskeleyen JSON logger
│  │  ├─ rate-limit.ts    # bellek içi hız sınırlayıcı
│  │  └─ roadmap.ts       # geliştirme planı
│  └─ proxy.ts
├─ supabase/              # config.toml, migrations/, rollback/
├─ scripts/               # seed-dev.ts, e2e-local-supabase.mjs, prepare-standalone.mjs
├─ tests/                 # unit/, db/, e2e/
├─ Dockerfile, docker-compose.yml
└─ docs/
```
