# Hermes Agent Entegrasyonu (plan)

> **Bugünkü durum:** Hermes Agent, Integrations kataloğuna yalnızca **tanım** olarak eklendi. AI HQ Hermes'e
> istek göndermez; bağlantı kodu (connector) yoktur ve durum hiçbir zaman "Connected" olamaz. Bu belge,
> Hermes'in açık kaynak kodu ve belgeleri ([NousResearch/hermes-agent](https://github.com/NousResearch/hermes-agent),
> `website/docs/user-guide/features/api-server.md`) incelenerek hazırlandı; bilgisayarınızdaki kurulumunuza
> erişilmedi.

## Neden Hermes?

- Bilgisayarınızda veya sunucunuzda çalışan, kendi kendine barındırılan bir ajan çalışma ortamı.
- Model olarak **Gemini** kullanabilir (`gemini` sağlayıcısı). Gemini anahtarı **Hermes'in kendi** ayar dosyasında
  (`~/.hermes/.env` içinde `GEMINI_API_KEY` veya `GOOGLE_API_KEY`) durur. **AI HQ'nun Gemini anahtarını bilmesine gerek
  yoktur**; AI HQ yalnızca Hermes API sunucusunun anahtarını tutar.
- Dış sistemlerin iş göndermesi için hazır bir HTTP API'si var: **Runs API**.

## Nasıl çalışacak (Faz 4)

```text
AI Agent Hub (AI HQ)                           Hermes Agent (API server)
─────────────────────                          ─────────────────────────
Görev "Queued"  ── POST /v1/runs ──────────▶   run başlar (Gemini ile)
                   Idempotency-Key: <görev id>
                   { input, instructions, model?, provider? }
"Running"       ◀─ { run_id }
                ── GET /v1/runs/{run_id} ──▶   durum, çıktı, token kullanımı
"Succeeded" /   ◀─ status: completed / failed / cancelled
"Failed"
"Cancelled"     ── POST /v1/runs/{id}/stop ▶   çalışma durdurulur
```

| AI HQ | Hermes |
| --- | --- |
| Ajanın talimatları (`instructions`) | `instructions` (Hermes'in kendi sistem talimatının üstüne eklenir) |
| Görevin girdisi (`input`) | `input` |
| Ajanın modeli / Integrations'taki varsayılanlar | `model`, `provider` (ör. `gemini`) |
| Görev kimliği | `Idempotency-Key` başlığı → aynı görev iki kez çalıştırılmaz (yeniden denemede aynı `run_id` döner) |
| Görev durumu | `GET /v1/runs/{id}` → `status`, `output`, `usage`, `runtime` |
| İptal | `POST /v1/runs/{id}/stop` |
| Bağlantı testi | `GET /v1/capabilities` (anahtarla) → `run_submission`, `run_status`, `run_stop` özellikleri var mı |

Hermes'te bir komut onay gerektirirse çalışma `waiting_for_approval` durumunda bekler ve
`POST /v1/runs/{id}/approval` ile onaylanır/reddedilir. Faz 4'te bu, AI Agent Hub'da bir onay kartı olarak
gösterilecek (görev durumlarına "onay bekliyor" eklenecek).

## Güvenlik kuralları

Hermes API sunucusu, ajanın **tüm araçlarına (terminal komutları dahil)** erişim verir. Bu yüzden:

1. **`API_SERVER_KEY` zorunludur.** AI HQ'da aynı değer `HERMES_API_KEY` ortam değişkeni olarak durur; veritabanına,
   tarayıcıya veya günlüklere yazılmaz.
2. **8642 portu internete açılmaz.** Hermes varsayılan olarak yalnızca `127.0.0.1` adresini dinler. AI HQ'daki
   "API server URL" ayarı `http://` adresini **yalnızca** localhost, yerel ağ (10.x, 172.16–31.x, 192.168.x),
   Tailscale (100.64–127.x, `*.ts.net`) veya Docker servis adı için kabul eder; diğer adreslerde `https://` zorunludur.
3. **Ayrı bir Hermes profili önerilir** (ör. `aihq`): yalnızca gereken araçlar açık, kişisel e-posta / banka
   hesapları açık olmayan ayrı bir tarayıcı profili.
4. **Onay modu açık kalmalı** (`approvals.mode` kapatılmamalı, YOLO kullanılmamalı); tehlikeli komutlar AI HQ'dan
   onaylanacak.
5. AI HQ'da yalnızca **Ready** durumundaki ajanların görevleri gönderilir; her gönderim ve sonuç Activity Logs'a yazılır.

## Nerede çalışmalı?

| Seçenek | Ne zaman | Not |
| --- | --- | --- |
| **AI HQ ile aynı sunucu** (önerilen) | AI HQ sunucuya kurulduğunda | `API_SERVER_HOST=127.0.0.1`; AI HQ `http://127.0.0.1:8642` ile bağlanır. Bilgisayarınız kapalıyken de çalışır |
| **Kendi bilgisayarınız** (bugünkü kurulum) | Sunucu henüz yokken | AI HQ sunucudaysa bilgisayarınıza yalnızca özel bir ağ (Tailscale / WireGuard) üzerinden ulaşılmalı. Bilgisayar kapalıyken görevler kuyrukta bekler |

## Şimdi yapılanlar

- Integrations kataloğuna **Hermes Agent** eklendi: ayarlar (API sunucu adresi, Hermes'teki sağlayıcı adı ör. `gemini`,
  varsayılan model, zaman aşımı) ve sunucu sırrı `HERMES_API_KEY`. Ayar şeması gizli alanları ve güvensiz adresleri reddeder.
- AI Agent Hub'da ajanlar "Runtime / provider" olarak **Hermes Agent** seçebilir.
- Yol haritasında Faz 4 artık "Hermes Agent ile ajan çalışma ortamı" olarak tanımlı.

## Faz 4 için sizden gerekenler

1. Hermes'in nerede çalışacağı (sunucu mu, bilgisayarınız mı + özel ağ).
2. Hermes'te API sunucusunun açılması (`API_SERVER_ENABLED=true`, güçlü bir `API_SERVER_KEY`) ve Gemini'nin
   `hermes model` ile seçilmesi — bunları siz yaparsınız; anahtarlar bana iletilmez.
3. AI HQ sunucusuna `HERMES_API_KEY` ortam değişkeninin eklenmesi.
