# Sunucuya Dağıtım — Kontrol Listesi

> Bu belge **plan ve talimattır; hiçbir adımı uygulanmadı.** Sunucunuza bağlanılmadı, komut çalıştırılmadı,
> DNS / güvenlik duvarı / ters vekil (reverse proxy) ayarlarına dokunulmadı ve üretimde dağıtım yapılmadı.
> Sunucu bilgileri geldiğinde adımlar birlikte, sizin onayınızla uygulanacak.

## 1. Mimari

```text
İnternet ──TLS──▶ Ters vekil (Caddy / Nginx / Traefik, sunucuda)
                        │  http://127.0.0.1:3000
                        ▼
                 ai-hq konteyneri (Next.js standalone, kullanıcı "node", salt okunur dosya sistemi)
                        │  HTTPS
                        ▼
                 Supabase (barındırılan proje veya ayrı yönetilen self-hosted Supabase)
```

- Uygulama **durumsuzdur** (stateless): tüm veri Supabase'dedir. Konteyner silinip yeniden kurulabilir.
- Uygulama yalnızca `127.0.0.1:3000` adresini dinler; dışarıya yalnızca ters vekil açılır.
- Aynı imaj staging ve production'da çalışır; fark yalnızca ortam değişkenleridir. İmaja sır gömülmez.

## 2. Sunucudan önce gerekenler (sizden)

| Bilgi / karar | Neden |
| --- | --- |
| Sunucunun işletim sistemi, Docker / Docker Compose sürümü | Kurulum komutları buna göre |
| Alan adı (ör. `hq.ornek.com`) ve DNS'i kimin yönettiği | TLS sertifikası ve Supabase "Site URL" |
| Sunucuda halihazırda çalışan servisler ve kullanılan portlar (özellikle 80/443) | Mevcut servisleri bozmamak için |
| Mevcut ters vekil (varsa hangisi) | Yeni bir vekil kurmak yerine mevcut olana bir site eklemek |
| Supabase: barındırılan proje mi, self-hosted mı | Bağlantı adresi ve yedekleme yöntemi |
| İzinli e-postalar | `AI_HQ_ALLOWED_EMAILS` |

## 3. Ortam değişkenleri

Sunucuda `ai-hq/.env.production` dosyasına (izin `600`, sahibi dağıtım kullanıcısı; **git'e girmez**) ya da
sır yöneticisine yazılır.

| Değişken | Üretim değeri | Not |
| --- | --- | --- |
| `APP_ENV` | `production` | Zorunlu. Üretim kurallarını açar (https, yerel olmayan Supabase, zorunlu izin listesi, demo veri yükleme kapalı) |
| `SUPABASE_URL` | `https://<proje-ref>.supabase.co` | Yalnızca üretim projesi |
| `SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_…` | Secret/service_role anahtarı girilirse uygulama başlamaz |
| `AI_HQ_ALLOWED_EMAILS` | `siz@ornek.com` | Zorunlu |
| `AI_HQ_PORT` | `3000` (isteğe bağlı) | Yalnızca `127.0.0.1` üzerinde yayınlanır |
| `AI_HQ_VERSION` | ör. `2.0.0` | İmaj etiketi; geri dönüş için |
| `SUPABASE_SECRET_KEY`, `DEV_*` | **tanımlamayın** | Yalnızca geliştirme seed betiği içindir |
| Entegrasyon sırları (`N8N_API_KEY` vb.) | **şimdilik boş** | Bu fazda hiçbir connector yok; ilgili faz geldiğinde eklenir |

## 4. Supabase üretim projesi

1. Ayrı bir proje açın (`ai-hq-prod`); geliştirme projesiyle **paylaşmayın**.
2. Migration'ları uygulayın: `npx supabase link --project-ref <prod-ref> && npm run db:push`
   (geliştirme makinesinden; sunucuda Supabase CLI gerekmez).
3. Authentication → Providers: e-posta açık, **yeni kayıt kapalı**; parola en az 12 karakter, büyük/küçük harf ve
   rakam; sızdırılmış parola koruması açık.
4. Authentication → URL Configuration: **Site URL** = `https://hq.ornek.com`.
5. İlk kullanıcınızı panelden ekleyin — ilk kullanıcı otomatik **owner** olur. Seed **çalıştırmayın**.
6. Authentication → Multi-Factor: **TOTP (Authenticator app)** açık olsun (barındırılan projelerde varsayılan).
   İlk girişten sonra Settings → Security'den iki adımlı girişi açın.

## 5. Kurulum adımları (sunucu bilgileri geldikten sonra)

```bash
# 1) Kodu sunucuya alın (yalnızca ai-hq klasörü yeterlidir)
git clone <depo> && cd <depo>/ai-hq        # veya CI'da üretilmiş imajı çekin

# 2) Ortam dosyası
cp .env.example .env.production && chmod 600 .env.production
#    → 3. bölümdeki değerleri girin

# 3) İmajı derleyip başlatın
AI_HQ_VERSION=2.0.0 docker compose build
AI_HQ_VERSION=2.0.0 docker compose up -d

# 4) Doğrulayın
docker compose ps                       # STATUS: healthy
curl -fsS http://127.0.0.1:3000/api/health        # {"status":"ok",...}
curl -fsS http://127.0.0.1:3000/api/health/ready  # {"status":"ready",...}
```

Kurumsal bir TLS denetim vekilinin arkasında derleme yapılıyorsa kök sertifika **build secret** olarak verilir
(katmana yazılmaz): `docker build --secret id=npm_ca,src=/yol/ca.pem .`

Konteyner güvenlik ayarları (`docker-compose.yml`): `read_only`, `cap_drop: ALL`, `no-new-privileges`,
yalnızca `/tmp` ve `.next/cache` için tmpfs, ayrıcalıksız `node` kullanıcısı, sağlık kontrolü.

## 6. Ters vekil örneği (yalnızca belge — uygulanmadı)

Mevcut bir ters vekiliniz varsa ona yalnızca aşağıdakine benzer **bir site bloğu** eklenir; diğer siteler
değiştirilmez.

**Caddy** (sertifikayı kendisi alır):

```text
hq.ornek.com {
    encode zstd gzip
    reverse_proxy 127.0.0.1:3000
    header Strict-Transport-Security "max-age=31536000; includeSubDomains"
}
```

**Nginx** (sertifika certbot vb. ile):

```text
server {
    listen 443 ssl http2;
    server_name hq.ornek.com;
    ssl_certificate     /etc/letsencrypt/live/hq.ornek.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/hq.ornek.com/privkey.pem;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    client_max_body_size 1m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

Önemli: uygulama hız sınırlaması için istemci adresini önce `X-Real-IP`, yoksa `X-Forwarded-For` başlığının
**son** değerinden (vekilin eklediği) okur; istemcinin gönderebileceği önceki değerler yok sayılır. Bu nedenle
vekil `X-Real-IP`'yi gerçek adresle **üzerine yazmalı** (Nginx örneğindeki gibi) ve uygulamanın portu doğrudan
internete açılmamalıdır. Caddy, güvenilmeyen istemcilerden gelen `X-Forwarded-*` başlıklarını varsayılan olarak
yeniden yazar.

Güvenlik duvarı (öneri, uygulanmadı): dışarıya yalnızca 22 (tercihen kısıtlı), 80 ve 443; 3000 kapalı.

## 7. Sağlık kontrolleri ve izleme

| Uç | Anlamı | Kullanım |
| --- | --- | --- |
| `GET /api/health` | Süreç ayakta, yapılandırma geçerli mi | Dockerfile `HEALTHCHECK`, canlılık (liveness) |
| `GET /api/health/ready` | Yapılandırma geçerli **ve** Supabase Auth 2,5 sn içinde yanıt veriyor | Compose sağlık kontrolü, harici çalışma süresi izleme |

Her iki uç da yalnızca kontrol adlarını ve sonuçlarını döner (URL, sürüm, hata ayrıntısı yok). Harici bir
izleyiciyi (UptimeRobot, Better Stack vb.) `https://hq.ornek.com/api/health/ready` adresine 1–5 dakikada bir
yönlendirmeniz önerilir. Not: Supabase erişilemezse konteyner "unhealthy" görünür ama yeniden başlatılmaz;
bu bilinçli bir tercihtir (sorun uygulamada değil).

## 8. Günlükler (logging)

- Uygulama günlükleri **tek satırlık JSON** olarak stdout/stderr'e yazılır (`src/lib/logger.ts`):
  `{"time","level","msg",...}`. Parola, token, API anahtarı, çerez ve `authorization` alanları ile JWT,
  `sb_…` anahtarları, `Bearer …` ve URL içindeki kimlik bilgileri otomatik maskelenir.
- Docker `json-file` sürücüsü günlükleri döndürür: dosya başına 10 MB, en fazla 5 dosya.
- Görüntüleme: `docker compose logs -f --since 1h ai-hq`
- Önemli olaylar: `auth.sign_in_failed`, `auth.sign_in_rate_limited`, `auth.sign_in_not_allowlisted`,
  `account.password_changed`, `account.signed_out_everywhere`, `auth.mfa_verified`, `auth.mfa_code_rejected`,
  `account.mfa_enabled`, `account.mfa_disabled`, `api.unexpected_error` (`requestId` ile),
  `health.auth_unreachable`.
- Uzun süreli saklama gerekiyorsa günlükler sunucudaki mevcut toplayıcıya (Loki, Vector, journald) yönlendirilebilir.

## 9. Yedekleme

Uygulama durumsuz olduğu için yedeklenecek tek şey **Supabase veritabanıdır**.

- **Barındırılan Supabase:** ücretli planlarda günlük otomatik yedek ve (eklenti ile) zamana göre geri yükleme
  vardır. Ek olarak haftalık mantıksal yedek önerilir:
  ```bash
  npx supabase db dump --linked -f backup-$(date +%F)-schema.sql
  npx supabase db dump --linked --data-only -f backup-$(date +%F)-data.sql
  ```
- **Self-hosted Supabase:** `pg_dump -Fc` ile günlük yedek, en az 7 günlük + 4 haftalık saklama; yedekler başka
  bir makinede veya nesne depolamada şifreli tutulur.
- Yedekten geri yükleme **ayda bir test edilmelidir** (boş bir projeye yükleyip uygulamayı ona bağlayarak).
- Ortam dosyası (`.env.production`) ayrıca parola yöneticisinde saklanmalıdır.

## 10. Güncelleme ve geri dönüş (rollback)

**Güncelleme:**

1. Veritabanı yedeği alın (9. bölüm).
2. Yeni migration varsa önce uygulayın (`npm run db:push`). Migration'lar geriye uyumlu yazılır.
3. Yeni imajı yeni etiketle derleyin/çekin ve başlatın: `AI_HQ_VERSION=<yeni> docker compose up -d`.
4. `/api/health/ready` ve kısa bir duman testi (giriş, Command Center, bir proje açma).

**Geri dönüş — yalnızca uygulama:** bir önceki etikete dönün: `AI_HQ_VERSION=<önceki> docker compose up -d`.
Eski imajlar silinmemelidir (en az son 3 sürüm saklanır).

**Geri dönüş — Faz 2 veritabanı değişiklikleri:**

1. Yedek alın (Faz 2 verisi — profiller, ayarlar, ajanlar, entegrasyon ayarları — silinecek).
2. Önce uygulamayı Faz 1 sürümüne döndürün.
3. Geri alma betiklerini **yeniden eskiye** sırayla çalıştırın (SQL Editor veya `psql`):
   `supabase/rollback/20261015120000_workspace_audit_down.sql`, ardından
   `supabase/rollback/20261014120000_phase2_core_down.sql`.
4. Supabase migration geçmişinden bu kayıtları kaldırın
   (`npx supabase migration repair --status reverted 20261015120000 20261014120000`).

Yalnızca çalışma alanı denetim görünümünü geri almak için 3. adımda ilk betik yeterlidir
(`migration repair --status reverted 20261015120000`); veri silinmez.

Geri alma betiği `tests/db/rollback.test.ts` ile test edilir.

## 11. Yayın öncesi kontrol listesi

- [ ] Üretim Supabase projesi ayrı; migration'lar uygulandı; kayıt kapalı; Site URL doğru.
- [ ] `.env.production`: `APP_ENV=production`, doğru URL, publishable anahtar, izin listesi; secret anahtar **yok**.
- [ ] `npm run check` ve E2E testleri yeşil (CI veya geliştirme makinesi).
- [ ] İmaj sürüm etiketiyle derlendi; bir önceki imaj saklanıyor.
- [ ] Konteyner `healthy`; `/api/health/ready` → `ready`.
- [ ] Ters vekil yalnızca bu siteyi ekledi; HTTPS ve HSTS çalışıyor; 3000 portu dışarıya kapalı.
- [ ] İlk giriş yapıldı; kullanıcı **Owner** rozetini görüyor; Settings → Environment "Production" gösteriyor.
- [ ] Owner hesabında iki adımlı giriş (Settings → Security) açık.
- [ ] Integrations sayfasında hiçbir servis "Connected" değil (bu fazda beklenen).
- [ ] Yedekleme planı etkin; geri yükleme denendi.
- [ ] Harici çalışma süresi izleme `/api/health/ready` adresine kuruldu.
