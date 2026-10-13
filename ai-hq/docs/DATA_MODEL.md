# Veri Modeli

Kaynaklar: `supabase/migrations/20261013120000_phase1_foundation.sql` (Faz 1) ve
`supabase/migrations/20261014120000_phase2_core.sql` (Faz 2). TypeScript türleri bu şemadan üretilir
(`src/lib/database.types.ts`, `npm run db:types`); uygulama alan adları `src/lib/domain.ts` içindedir.

## İlişkiler

```text
auth.users ─1:1─ profiles (rol)
     │
     └─ owner_id ─┬─ projects ─┬─ tasks              (project_id, owner_id) → projects
                  │            ├─ automations        (project_id, owner_id) → projects, NULL olabilir
                  │            └─ agent_task_records (project_id, owner_id) → projects, NULL olabilir
                  ├─ agent_definitions ── agent_task_records (agent_id, owner_id) → agent_definitions
                  └─ activity_logs (yalnızca tetikleyiciler yazar)

system_settings      tek satır (çalışma alanı adı, saat dilimi)
integration_configs  entegrasyon başına bir satır (gizli olmayan ayarlar)
```

Çocuk kayıtlar ebeveynlerine **bileşik yabancı anahtarla** `(id, owner_id)` bağlıdır: bir kullanıcı, başka
birinin projesine veya ajanına kayıt ekleyemez — bu veritabanı düzeyinde imkânsızdır.

## Tablolar

| Tablo | Amaç | Önemli alanlar ve kurallar |
| --- | --- | --- |
| `profiles` | Kullanıcı profili ve rolü | `role` (`owner`/`admin`/`member`), `display_name` (1–80), `email` (auth'tan eşlenir). Auth kullanıcısı oluşunca tetikleyiciyle oluşur; ilk kullanıcı owner. Rol yalnızca `set_workspace_role()` ile değişir |
| `system_settings` | Çalışma alanı ayarları | Tek satır (`id = true`). `workspace_name` (1–60), `timezone` (geçerli IANA adı — tetikleyici doğrular), `updated_by` |
| `integration_configs` | Entegrasyon ayarları (gizli olmayan) | `key`, `enabled`, `settings` (JSON nesnesi, ≤16 KB). `last_test_*`, `tested_settings_hash` yalnızca gerçek bağlantı testi (servis rolü / connector) tarafından yazılır; kullanıcıların bu sütunlarda yetkisi yoktur |
| `projects` | Projeler | `status`, `category` (`general`/`automation`/`game`/`saas`/`ai_agent`), `priority`, `due_date`, `is_demo` |
| `tasks` | Görevler | `status`, `priority`, `due_date`, `completed_at` (otomatik), `is_demo` |
| `automations` | İş akışı meta verisi (katalog) | `trigger_type`, `trigger_notes`, `provider` (ör. `n8n`) + `external_workflow_id` (yalnızca `[A-Za-z0-9_-]{1,64}`, URL/anahtar değil; kimlik varsa sağlayıcı zorunlu), `status` (`draft`/`ready`/`paused`), `is_demo` |
| `agent_definitions` | AI ajan tanımları | `instructions` (≤20 000), `provider`, `model`, `capabilities[]`, `status` (`draft`/`ready`/`disabled`), `version` (talimat, sağlayıcı, model veya yetenekler değişince otomatik artar), `is_demo` |
| `agent_task_records` | Ajan görev kayıtları | `title`, `input`, `status` (`queued`/`running`/`succeeded`/`failed`/`cancelled`), `agent_version`, `output`, `error_message`, `started_at`, `completed_at`, `is_demo` |
| `activity_logs` | Denetim kaydı | `entity_type` (8 tür), `entity_id`, `action`, `summary`, `metadata`. Yalnızca `SECURITY DEFINER` tetikleyiciler yazar; kullanıcı için salt okunur |

## Ajan görevi kuralları (`guard_agent_task_record` tetikleyicisi)

- Yeni görev yalnızca **Ready** durumundaki ajana eklenebilir ve `queued` olarak, sonuçsuz başlar.
- Kullanıcı yalnızca `queued` görevi düzenleyebilir veya **iptal** edebilir.
- `output`, `error_message`, `started_at`, `completed_at`, `agent_version` alanlarını yalnızca ajan çalışma
  ortamı yazabilir (Faz 4). İhlaller `AHQ01` kodlu, kullanıcıya gösterilebilir mesajla reddedilir (API: `422`).

## Görünüm ve fonksiyonlar

| Nesne | Açıklama |
| --- | --- |
| `project_overview` (view, `security_invoker`) | Projeler + görev sayaçları (toplam, biten, bloklu, geciken) |
| `command_center_summary(include_demo)` | Command Center sayıları; demo veriler varsayılan olarak hariç; "bugün" çalışma alanı saat dilimine göre |
| `workspace_today()` | Çalışma alanı saat dilimindeki tarih |
| `set_workspace_role(target_user, new_role)` | Yalnızca owner; son owner düşürülemez |
| `is_workspace_admin()`, `workspace_role_of_current_user()` | RLS politikalarında kullanılan yardımcılar |

## Erişim kuralları (RLS + sütun yetkileri)

| Tablo | Okuma | Yazma |
| --- | --- | --- |
| `projects`, `tasks`, `automations`, `agent_definitions`, `agent_task_records` | Yalnızca sahibi | Yalnızca sahibi |
| `activity_logs` | Yalnızca sahibi | Kimse (yalnızca tetikleyiciler) |
| `profiles` | Kendi satırı; admin/owner herkesi | Yalnızca kendi `display_name` alanı (sütun yetkisi) |
| `system_settings` | Tüm oturum açmış kullanıcılar | Admin/owner; yalnızca `workspace_name`, `timezone` |
| `integration_configs` | Tüm oturum açmış kullanıcılar | Admin/owner; yalnızca `key`, `enabled`, `settings` (test sonucu sütunları hariç) |

`anon` rolünün hiçbir tabloya, görünüme veya fonksiyona erişimi yoktur.

## İndeksler (seçilmiş)

`projects (owner_id, updated_at desc)`, `tasks (project_id, status)`, `tasks (owner_id, status, due_date)`,
`automations (owner_id, updated_at desc)`, `agent_definitions (owner_id, updated_at desc)`,
`agent_task_records (agent_id, created_at desc)`, `agent_task_records (owner_id, status)`,
`activity_logs (owner_id, created_at desc, id desc)`, `activity_logs (entity_type, entity_id)`, `profiles (role)`.

## Demo ve gerçek veri ayrımı

`projects`, `tasks`, `automations`, `agent_definitions`, `agent_task_records` tablolarında `is_demo` bayrağı
vardır. Demo yükleyici (`src/lib/demo`) ve seed betiği yalnızca bayraklı kayıt üretir; kaldırma yalnızca
bayraklı kayıtları siler. Faz 1'deki `[Demo] ` önekli kayıtlar migration sırasında bayrağa taşınır.

## Testler

`tests/db/rls.test.ts`, `tests/db/phase2.test.ts` ve `tests/db/rollback.test.ts` bu kuralları gerçek SQL ile
doğrular (PGlite; `TEST_DATABASE_URL` ile PostgreSQL 16 ve Supabase PostgreSQL 17 üzerinde de çalıştırıldı).
