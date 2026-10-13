# n8n Entegrasyonu

## Faz 1'de durum

- n8n'e **hiçbir bağlantı kurulmaz**; n8n API'sine istek atılmaz, webhook adresi tanımlanmaz.
- AI HQ **hiçbir n8n akışı oluşturmaz, düzenlemez veya silmez** — bu yetenek bilerek yoktur. Akışlarınız
  (ör. Telegram mesajlarını yanıtlama) sizde hazırdır; AI HQ ileride yalnızca onlara bağlanır.
- Automation Center'daki kayıtlar AI HQ veritabanında tutulan **katalog girdileridir**; isteğe bağlı olarak
  bir n8n workflow **kimliği** (yalnızca harf, rakam, `-`, `_`) taşıyabilir. URL veya anahtar kabul edilmez.

## Servis katmanı (`src/lib/integrations/n8n/`)

| Dosya | Görev |
| --- | --- |
| `config.ts` | `N8N_BASE_URL` (yalnızca `https`, kimlik bilgisi/sorgu dizesi içeremez), `N8N_API_KEY`, `N8N_WEBHOOK_SIGNING_SECRET` doğrulaması |
| `service.ts` | `N8nService` arayüzü (`listWorkflows`, `dispatchAutomation`) ve Faz 1 uygulaması: her çağrıyı ağa çıkmadan `IntegrationUnavailableError` ile reddeder. Arayüze gösterilen durum nesnesi URL veya anahtar içermez |

Dosyalar `server-only` ile işaretlidir; tarayıcı paketine giremez. `tests/unit/n8n.test.ts` hiçbir
`fetch` çağrısı yapılmadığını ve durum nesnesinde sır bulunmadığını doğrular.

## Faz 2 planı (sizin akışlarınız geldikten sonra)

1. Sizden gelen akış listesine göre her otomasyon kaydını ilgili workflow kimliğiyle eşlemek.
2. Sunucuda bir HTTP adaptörü (`N8nService` uygulaması): yalnızca `N8N_BASE_URL` sunucusuna, zaman aşımı
   ve sınırlı yeniden deneme ile; API anahtarı yalnızca sunucu ortam değişkeninde.
3. Tetikleme isteklerinde idempotency anahtarı; her tetikleme ve sonucu `activity_logs`'a yazılır.
4. n8n'den gelen geri bildirimler için HMAC imzalı webhook ucu (`N8N_WEBHOOK_SIGNING_SECRET`), zaman damgası
   kontrolü ve tekrar oynatma koruması.
5. Integrations sayfasında bağlantı testi ve akış listesi (salt okunur).
