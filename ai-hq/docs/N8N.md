# n8n Entegrasyonu

## Bugünkü durum (Faz 2)

- n8n'e **hiçbir bağlantı kurulmaz**; n8n API'sine istek atılmaz, webhook adresi tanımlanmaz.
- AI HQ **hiçbir n8n akışı oluşturmaz, düzenlemez veya silmez** — bu yetenek bilerek yoktur ve planlanmamıştır.
  Akışlarınız (ör. Telegram mesajlarını yanıtlama) sizde hazırdır; AI HQ ileride yalnızca **mevcut** akışlara
  bağlanır.
- Automation Center kayıtları AI HQ veritabanındaki **katalog girdileridir**: iş akışı motoru (`provider`, ör.
  `n8n`) ve workflow **kimliği** (`external_workflow_id`, yalnızca harf, rakam, `-`, `_`). URL veya anahtar
  kabul edilmez; kimlik girilirse motor seçimi zorunludur.
- Faz 1'deki n8n'e özel servis katmanı kaldırıldı; yerine tüm servisler için ortak entegrasyon altyapısı geldi
  (`src/lib/integrations/`). n8n bu katalogdaki bir tanımdır:
  - gizli olmayan ayarlar (Integrations → n8n Cloud, yalnızca admin): **Instance URL** (yalnızca `https`, kimlik
    bilgisi/sorgu dizesi içeremez), istek zaman aşımı;
  - sunucu sırları (yalnızca ortam değişkeni; uygulama yalnızca var olup olmadığına bakar): `N8N_API_KEY`
    (zorunlu), `N8N_WEBHOOK_SIGNING_SECRET` (geri bildirimler için);
  - durum: ayar + sır eksikse **Not configured**, tamamsa **Ready to configure**. Connector olmadığı için
    **Connected olamaz**.

## Faz 3 planı (sizin akış listeniz geldikten sonra)

1. Sizden gelen akış listesine göre otomasyon kayıtlarını ilgili workflow kimlikleriyle eşlemek.
2. `connectors.ts` içine n8n connector'ı: yalnızca ayarlardaki Instance URL'e, zaman aşımı ve sınırlı yeniden
   deneme ile; API anahtarı yalnızca sunucu ortam değişkeninde. Bağlantı testi sonucu ve test edilen ayarların
   özeti (`tested_settings_hash`) sunucu tarafından yazılır; ancak bundan sonra durum **Connected** olabilir.
3. Integrations sayfasında "Test connection" düğmesi ve mevcut akışların salt okunur listesi.
4. Tetikleme isteklerinde idempotency anahtarı; her tetikleme ve sonucu `activity_logs`'a yazılır.
5. n8n'den gelen geri bildirimler için HMAC imzalı webhook ucu (`N8N_WEBHOOK_SIGNING_SECRET`), zaman damgası
   kontrolü ve tekrar oynatma koruması.

## Faz 3 için sizden gerekenler

- Bağlanacak mevcut akışların listesi (ad + workflow kimliği) ve her birinin ne zaman tetikleneceği.
- n8n Cloud örnek adresiniz (ayar olarak girilir) ve API anahtarı (yalnızca sunucu ortam değişkeni).
- Akışlar sonuç bildirecekse: webhook imzalama sırrı.
