# AI HQ Geliştirme Planı

Uygulamadaki "Planned next" kartları ve Roadmap sayfası bu planı `src/lib/roadmap.ts` dosyasından okur; bu belge
onun okunabilir özetidir. İkisi birlikte güncellenmelidir (`tests/unit/navigation.test.ts` menü ile plan
arasındaki tutarlılığı denetler).

## Fazlar

| Faz | Başlık | Hedef | Durum |
| --- | --- | --- | --- |
| 1 | Çalışan temel | Kimlik doğrulama, veritabanı, Command Center, Projeler ve görevler, Automation Center (katalog), aktivite kaydı | **Teslim edildi** |
| 2 | Çekirdek sistem | Roller, çalışma alanı ayarları, AI ajan tanımları ve görev kuyruğu, entegrasyon altyapısı, demo veri ayrımı, arama ve sayfalama, dokuz ekranın tamamı, Docker paketleme ve dağıtım belgeleri | **Teslim edildi** |
| 3 | n8n bağlantısı | Mevcut n8n Cloud akışlarınıza sunucu tarafından bağlanmak, otomasyon kayıtlarıyla eşlemek, tetiklemek ve çalışmaları kaydetmek. AI HQ akış oluşturmaz | Sıradaki |
| 4 | Ajan çalışma ortamı | Kuyruktaki ajan görevlerini **Hermes Agent** üzerinden (Runs API) Hermes'te ayarlı modelle, ör. Gemini, çalıştırmak; durum, çıktı ve kullanımı kaydetmek ([HERMES.md](HERMES.md)) | Daha sonra |
| 5 | Oyun platformları | Google Play Console ve App Store Connect'ten sürüm ve inceleme durumu (Game Studio) | Daha sonra |
| 6 | İş verileri | Salt okunur gelir, kayıp (churn) ve müşteri verileri (SaaS & Business) | Daha sonra |

## Menü durumu

| Menü | Durum | Bugün | Sonraki |
| --- | --- | --- | --- |
| Command Center | Çalışıyor | Canlı sayılar (demo hariç), yaklaşan görevler, aktivite, ajan kuyruğu, sistem durumu | Faz 3'te n8n çalışma özetleri |
| Projects | Çalışıyor | Proje/görev yönetimi, arama, filtre, sayfalama, hazır kontrol listeleri | — |
| Automation Center | Çalışıyor (katalog) | Kayıtlar, motor + workflow kimliği, durum, arama, filtre, sayfalama | Faz 3: mevcut akışlara bağlama ve tetikleme |
| Game Studio | Kısmi | Oyun projeleri durum hattı, yayın kontrol listesi, mağaza entegrasyon durumu | Faz 5: mağaza verisi |
| SaaS & Business | Kısmi | SaaS projeleri, lansman kontrol listesi, gelir için dürüst boş durum | Faz 6: salt okunur ödeme verisi |
| AI Agent Hub | Kısmi | Ajan tanımları (sürümlü), görev kuyruğu, iptal | Faz 4: Hermes Agent ile çalıştırma |
| Integrations | Kısmi | 8 servisin kataloğu (Hermes Agent dahil), durum, ayarlar (admin), sır varlığı | Faz 3–6: connector'lar ve bağlantı testleri |
| Activity Logs | Çalışıyor | Değiştirilemez denetim kaydı, 8 tür, arama | Faz 3'te n8n çalışmaları |
| Settings | Çalışıyor | Profil, parola, oturumlar, çalışma alanı, roller, demo veri, ortam | MFA, bildirim tercihleri, veri dışa aktarma |

## Sıradaki faz için sizden gerekenler

- Bağlanacak mevcut n8n akışlarınızın listesi (ad + workflow kimliği) ve tetiklenme zamanları.
- n8n Cloud örnek adresi ve API anahtarı (anahtar yalnızca sunucu ortam değişkeni olarak).
- Sunucu bilgileri (bkz. [DEPLOYMENT.md](DEPLOYMENT.md#2-sunucudan-önce-gerekenler-sizden)).
