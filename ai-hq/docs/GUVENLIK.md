# Güvenlik Modeli

## Kimlik doğrulama ve oturum

- Supabase Auth, e-posta + parola. Kayıt (sign-up) kapalıdır; hesapları yönetici oluşturur.
- Oturum çerezleri `@supabase/ssr` ile yönetilir. `src/proxy.ts` her istekte `supabase.auth.getUser()`
  çağırır: erişim belirteci Supabase Auth sunucusunda doğrulanır ve gerekirse yenilenir.
- Proxy tek savunma hattı değildir: her sayfa (`requireUser`) ve her API ucu (`apiRoute`) oturumu
  yeniden doğrular.
- Giriş, Next.js Server Action ile sunucuda yapılır (yerleşik köken kontrolü). Yanlış e-posta ve yanlış
  parola aynı mesajı verir. Girişten sonra yönlendirme yalnızca aynı sitedeki yollara yapılır.

## Yetkilendirme

1. **İzin listesi** — `AI_HQ_ALLOWED_EMAILS`. Üretimde zorunlu. Listede olmayan hesap girişte reddedilir
   ve oturumu kapatılır; proxy ve API'ler de 403 döner.
2. **Satır düzeyi güvenlik (RLS)** — her tabloda açık. Kullanıcı yalnızca `owner_id = auth.uid()` olan
   satırları görür ve değiştirir. Uygulama yalnızca publishable anahtarı kullandığı için RLS her sorguda
   geçerlidir.
3. **Bileşik yabancı anahtarlar** — `tasks` ve `automations`, projeye `(project_id, owner_id)` ile bağlıdır;
   başka birinin projesine kayıt eklemek veritabanı düzeyinde imkânsızdır.
4. **Değiştirilemez aktivite kaydı** — `activity_logs` yalnızca `SECURITY DEFINER` tetikleyici tarafından
   yazılır; `authenticated` rolünün ekleme/güncelleme/silme yetkisi yoktur.
5. **anon rolü** — hiçbir tabloya, view'a veya fonksiyona erişemez.
6. **API girdileri** — katı Zod şemaları bilinmeyen alanları reddeder; sahiplik her zaman oturumdan gelir.

## İstek sertleştirme

- Durum değiştiren isteklerde aynı köken (`Origin` / `Sec-Fetch-Site`) kontrolü, `application/json`
  zorunluluğu, 64 KB gövde sınırı. Oturum çerezleri `SameSite=Lax`.
- Hata yanıtları veritabanı mesajı veya yığın izi içermez; beklenmeyen hatalar `requestId` ile sunucu
  günlüğüne yazılır.
- Yanıtlar `Cache-Control: no-store`; güvenlik başlıkları `next.config.ts` içinde.

## Sırlar

- Depoda gerçek anahtar yoktur. `.env*` dosyaları git dışıdır, yalnızca `.env.example` izlenir.
- Hiçbir ortam değişkeni `NEXT_PUBLIC_` önekli değildir; tarayıcıya hiçbir yapılandırma değeri gönderilmez.
- `SUPABASE_PUBLISHABLE_KEY` alanına secret/service_role anahtarı girilirse uygulama başlamayı reddeder.
- `SUPABASE_SECRET_KEY` yalnızca geliştirme seed betiği içindir ve üretimde tanımlanmamalıdır.

## Doğrulanan senaryolar (testler)

- `tests/db/rls.test.ts`: anonim erişim yok; kullanıcılar birbirinin verisini göremez/değiştiremez; sahiplik
  devredilemez; başkasının projesine görev/otomasyon eklenemez; aktivite kaydı yazılamaz/düzenlenemez;
  view ve RPC yalnızca kendi verisini sayar; hesap silindiğinde tüm veri temizlenir.
- `tests/unit/api-route.test.ts`, `proxy-session.test.ts`, `project-routes.test.ts`: 401/403, CSRF, içerik
  türü, gövde sınırı, doğrulama, yapılandırma hatası, hata sızıntısı, açık yönlendirme.
- `tests/e2e/security.spec.ts`: iki gerçek oturumla kullanıcılar arası izolasyon ve CSRF.

## Bilinen sınırlar / sonraki adımlar

- İçerik Güvenlik Politikası (CSP) henüz yok (Next.js satır içi betikleri için nonce gerektirir).
- Uygulama düzeyinde hız sınırlama yok; giriş denemelerini Supabase Auth'un kendi sınırları korur.
- MFA henüz arayüzde yok (Settings yol haritasında).
- Uçtan uca testler gerçek Supabase yerine test emülatörüne karşı çalışır. İlk kurulumda gerçek geliştirme
  projesinde elle kısa bir duman testi (giriş, proje oluşturma, ikinci kullanıcıyla izolasyon) önerilir.
