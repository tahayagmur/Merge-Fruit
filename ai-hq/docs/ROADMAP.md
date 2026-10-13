# AI HQ Geliştirme Planı

Uygulama içindeki planlı menüler bu planı `src/lib/roadmap.ts` dosyasından okur; bu belge onun
okunabilir özetidir. İkisi değişirse birlikte güncellenmelidir (`tests/unit/navigation.test.ts`
menü ile plan arasındaki tutarlılığı denetler).

## Fazlar

| Faz | Başlık | Hedef | Durum |
| --- | --- | --- | --- |
| 1 | Çalışan temel | Kimlik doğrulama, veritabanı, Command Center, Projeler ve görevler, Automation Center (katalog), aktivite kaydı | **Teslim edildi** |
| 2 | n8n bağlantısı | Sizin **mevcut** n8n Cloud akışlarınıza sunucu tarafından bağlanmak, otomasyon kayıtlarıyla eşlemek, tetiklemek ve çalışmaları kaydetmek. AI HQ akış oluşturmaz | Sıradaki |
| 3 | AI Agent Hub | Ajan kaydı, sürümlü komutlar, sunucu tarafında çalıştırma, maliyet ve sonuç takibi | Daha sonra |
| 4 | Game Studio | Oyun projeleri için üretim hattı: kilometre taşları, build'ler, mağaza sayfaları, oyun testleri | Daha sonra |
| 5 | SaaS & Business | Gelir, müşteri ve KPI takibi (salt okunur finans entegrasyonları) | Daha sonra |

## Menü durumu

| Menü | Durum | Bugün kullanılabilen | Planlanan |
| --- | --- | --- | --- |
| Command Center | Çalışıyor | Canlı özet, yaklaşan görevler, aktivite, sistem durumu | Faz 2'de n8n çalışma özetleri |
| Projects | Çalışıyor | Proje ve görev yönetimi | — |
| Automation Center | Çalışıyor (katalog) | Otomasyon kayıtları, durum, proje ve workflow kimliği bağlama | Faz 2: kayıtları mevcut akışlarınıza bağlayıp tetikleme |
| Game Studio | Planlı (Faz 4) | Projeler'de "Game" kategorisi | Kilometre taşı şablonları, build/sürüm kaydı, mağaza kontrol listesi, oyun testi geri bildirimi, mevcut n8n akışlarınızı tetikleme |
| SaaS & Business | Planlı (Faz 5) | Projeler'de "SaaS & Business" kategorisi | Ürün kataloğu, MRR/gelir panosu (salt okunur), müşteri görünümü, haftalık KPI raporunu mevcut bir akışınıza bağlama |
| AI Agent Hub | Planlı (Faz 3) | Projeler'de "AI Agent" kategorisi | Ajan kaydı, sürümlü komutlar, yalnızca sunucuda çalıştırma, çalışma geçmişi ve maliyet |
| Integrations | Planlı (Faz 2) | Bağlantısız n8n servis katmanı ve yapılandırma doğrulaması | Bağlantı testi, mevcut akışları listeleme, eşleme, tetikleme, imzalı webhook'lar |
| Activity Logs | Çalışıyor | Değiştirilemez denetim kaydı | Faz 2'de n8n çalışmaları |
| Settings | Kısmi | Hesap/ortam/erişim bilgisi (salt okunur), çıkış | Parola değişimi ve MFA, bildirim tercihleri, veri dışa aktarma |

## Faz 2 için sizden gerekenler

- Bağlanacak mevcut n8n akışlarınızın listesi (ad + workflow kimliği) ve her birinin ne zaman tetikleneceği.
- n8n Cloud API anahtarı ve temel adres — yalnızca sunucu ortam değişkeni olarak (`N8N_BASE_URL`, `N8N_API_KEY`).
- Akışlar sonuç bildirecekse: webhook imzalama sırrı (`N8N_WEBHOOK_SIGNING_SECRET`).
