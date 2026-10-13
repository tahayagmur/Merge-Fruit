# Faz 2 — İnceleme, Eksik Listesi, Plan ve Geri Dönüş

## 1. Mevcut durum (Faz 1 sonunda, commit `906e571`)

Çalışan ve korunacak parçalar:

- Kimlik doğrulama: Supabase Auth, sunucu tarafı `getUser()` doğrulaması (proxy + sayfa + API), e-posta izin listesi.
- Veri: `projects`, `tasks`, `automations`, `activity_logs` (RLS, bileşik FK, tetikleyiciyle yazılan denetim kaydı),
  `project_overview` view, `command_center_summary()` RPC.
- Ekranlar: Command Center, Projects (+ görev panosu), Automation Center (katalog), Activity Logs, kısmi Settings,
  dört modül için yol haritası sayfaları.
- API: Zod doğrulama, tek tip hata gövdesi, aynı köken / içerik türü / gövde boyutu kontrolleri.
- Testler: 142 Vitest (birim, bileşen, RLS), 13 Playwright E2E (test emülatörüne karşı).

## 2. Tespit edilen eksikler ve riskler

| # | Tür | Bulgu | Faz 2'de |
| --- | --- | --- | --- |
| 1 | Güvenlik | Oturum çerezleri `@supabase/ssr` varsayılanıyla `httpOnly: false` ve 400 gün geçerli; tarayıcı istemcisi kullanılmadığı halde JS'den okunabilir | `httpOnly`, üretimde `secure`, kısa (kayan) ömür |
| 2 | Güvenlik | Beklenmeyen hatalar `console.error` ile ham yazılıyor; ileride token/anahtar içeren nesneler loglanabilir | Hassas alanları maskeleyen yapılandırılmış logger |
| 3 | Güvenlik | Uygulama tarafında giriş denemesi sınırı yok (yalnızca Supabase'in kendi sınırı) | Giriş ve parola değişimi için hız sınırı |
| 4 | Güvenlik | Rol kavramı yok: sistem ayarı / entegrasyon gibi çalışma alanı düzeyindeki işlemler için yetki ayrımı yapılamıyor | `profiles` + `owner/admin/member` rolleri, RLS ile zorlanan yetki |
| 5 | Veri | Users/Profiles, System Settings, Integration Configurations, Agent Definitions, Agent Task Records yok | Ek migration |
| 6 | Veri | `automations.n8n_workflow_id` tek sağlayıcıya bağlı | Sağlayıcıdan bağımsız `provider` + `external_workflow_id` |
| 7 | Veri | Demo verisi yalnızca isim önekiyle (`[Demo] `) ayrılıyor | `is_demo` sütunu, arayüzde rozet, metriklerde ayrı tutma |
| 8 | Ürün | Arama yok, proje listesinde sayfalama yok | Global arama, liste aramaları, sayfalama |
| 9 | Ürün | Game Studio, SaaS & Business, AI Agent Hub, Integrations yalnızca plan gösteriyor | İç verilerle çalışan ekranlar (harici bağlantı olmadan) |
| 10 | Ürün | "Bugün"/gecikme hesapları UTC'ye sabit | Çalışma alanı saat dilimi ayarı |
| 11 | Entegrasyon | Yalnızca n8n'e özel durum nesnesi; ortak arayüz yok | Modüler entegrasyon kaydı ve ortak durum modeli |
| 12 | Dağıtım | Dockerfile, standalone çıktı, hazır olma (readiness) kontrolü, sunucu dokümantasyonu yok | Hepsi eklenecek (sunucuya dokunmadan) |
| 13 | Arayüz | Tablo, durum göstergesi, sayfalama, arama, yazılı onay gibi ortak bileşenler eksik; hareket azaltma tercihi yok | Tasarım sistemi tamamlanacak |

## 3. Uygulama planı (küçük, doğrulanabilir adımlar)

1. **Sertleştirme:** çerez ayarları, maskeleyen logger, hız sınırı, `/api/health/ready`, standalone çıktı, Dockerfile +
   Compose. → birim testleri + derleme.
2. **Veri modeli (ek migration):** profiller/roller, sistem ayarları, entegrasyon yapılandırmaları, ajan tanımları,
   ajan görev kayıtları, iş akışı meta verisi (`automations` genelleştirmesi), `is_demo`, saat dilimi. → RLS testleri
   (PGlite + gerçek PostgreSQL).
3. **Sunucu katmanı:** entegrasyon kaydı ve durum hesaplama (gerçek bağlantı testi olmadan asla "Connected" değil),
   yeni veri erişim fonksiyonları ve API uçları, demo veri yükleme/kaldırma, arama, sayfalama. → birim + route testleri.
4. **Arayüz:** ortak bileşenler, üst gezinti (arama + konum), dokuz ekranın tamamlanması. → E2E testleri.
5. **Dokümantasyon ve kontrol:** dağıtım kontrol listesi, tasarım sistemi, güvenlik, gizli bilgi taraması, tüm testler.

Kapsam dışı (bu fazda **yapılmayacak**): n8n, Claude/AI API'leri, oyun/mağaza platformları, SaaS/müşteri sistemleri,
harici webhook'lar ve kullanıcının sunucusuna herhangi bir bağlantı veya işlem.

## 4. Geri dönüş (rollback) planı

- **Kod:** Faz 1'in son hali commit `906e571`. Faz 2 ayrı commit'ler hâlinde gelir; gerekirse
  `git revert <faz2-commitleri>` veya dağıtımda bir önceki imaja (etiket) dönülür.
- **Veritabanı:** Faz 2 değişiklikleri yalnızca **yeni** bir migration dosyasıyla gelir; Faz 1 migration'ı değiştirilmez.
  Geri almak için `supabase/rollback/20261014120000_phase2_core_down.sql` çalıştırılır: yeni tablolar/fonksiyonlar
  kaldırılır, `automations` sütunları eski adlarına döner. **Uyarı:** geri alma, Faz 2'de eklenen verileri (profiller,
  ayarlar, ajanlar, entegrasyon ayarları) siler; öncesinde yedek alınmalıdır (bkz. `docs/DEPLOYMENT.md`).
- **Sıra:** önce uygulamayı Faz 1 sürümüne döndür, sonra down migration'ı çalıştır (Faz 1 kodu yeni sütun adlarını
  tanımaz).
