# Tasarım Sistemi

AI HQ yalnızca koyu temalıdır: grafit / neredeyse siyah yüzeyler, ölçülü turkuaz vurgu, ince çizgili kenarlıklar.
Hedef; uzun süre bakılan bir komuta ekranında düşük göz yorgunluğu ve **durumun her zaman tek bakışta
anlaşılması**dır. Kaynaklar: `src/app/globals.css` (token'lar), `src/components/ui` (shadcn/ui temel bileşenleri),
`src/components/common` (uygulamaya özgü ortak bileşenler).

## Renk token'ları

Tüm renkler OKLCH ile tanımlıdır ve shadcn/ui adlandırmasını izler; bileşenlerde ham renk kodu kullanılmaz.

| Token | Kullanım |
| --- | --- |
| `background` | Sayfa zemini (grafit, `oklch(0.155 …)`) |
| `card`, `popover`, `sidebar` | Yükseltilmiş yüzeyler; kenar çubuğu zeminden bir ton koyu |
| `foreground`, `muted-foreground` | Birincil ve ikincil metin (WCAG AA kontrastı sağlanır) |
| `primary` | Turkuaz vurgu: birincil eylem, etkin menü, odak halkası. **Ölçülü** kullanılır |
| `accent` | Üzerine gelme / seçili satır zemini |
| `success`, `info`, `warning`, `destructive` | Yalnızca durum anlatımı için |
| `border`, `input`, `ring` | Saydam beyaz kenarlıklar (%7–11), odak halkası %55 turkuaz |

## Durum dili

Her durum tek bir **ton**a eşlenir (`common/status-indicator.tsx` → `StatusIndicator`); ekran başına renk seçilmez.

| Ton | Anlam | Örnekler |
| --- | --- | --- |
| `neutral` | Başlamadı / kapalı / bilgi yok | Not configured, Draft, Member, Cancelled |
| `info` | Bekliyor / hazırlanabilir | Ready to configure, Queued, Admin |
| `accent` | Etkin / devam ediyor | Ready, Running, Owner, Active |
| `success` | Tamamlandı / doğrulandı | Connected (yalnızca gerçek testle), Succeeded, Done |
| `warning` | Dikkat | Disabled ajan, eksik zorunlu sır, geciken görev |
| `danger` | Hata / engel | Error, Failed, Blocked |

- **Demo rozeti** (`DemoBadge`): kesikli sarı çerçeve, `DEMO` yazısı. Demo kayıt gösteren her yerde zorunludur.
- Renk tek başına anlam taşımaz: her rozette metin vardır; ikonlar `aria-hidden`.

## Tipografi ve boşluk

- Geist Sans (metin), Geist Mono (kimlikler, sayılar, tarih, ortam değişkeni adları).
- Başlık hiyerarşisi: sayfa `h1` (2xl/3xl, `PageHeader`), kart başlığı (`CardTitle`), bölüm etiketi
  (`.hq-label`: mono, büyük harf, geniş harf aralığı).
- Boşluk ölçeği Tailwind'in 4 px tabanlı ölçeğidir; kartlar arası `gap-6`, kart içi `gap-3/4`.
- Köşe yarıçapı `--radius` = 10 px (kartlar `rounded-xl`, kontroller `rounded-md`).

## Yerleşim

- Masaüstü öncelikli: sol kenar çubuğu (9 menü, 3 grup) + yapışkan üst çubuk (global arama, çalışma alanı adı,
  ortam rozeti, rol rozeti, hesap menüsü). Mobilde kenar çubuğu çekmece menüye dönüşür.
- İçerik genişliği sınırlı; ızgaralar `grid-cols-1` → `md`/`lg`/`xl` kırılımlarında genişler.
- Sayfa iskeleti: `PageHeader` (üst başlık, başlık, açıklama, eylemler) → içerik. Veri yüklenen her bölüm
  `Suspense` + `Skeleton` iskeletiyle sarılır.

## Ortak bileşenler (`src/components/common`)

| Bileşen | Görev |
| --- | --- |
| `StatusIndicator`, `DemoBadge`, `status-badges.tsx` | Tek tip durum rozetleri (proje, görev, öncelik, otomasyon, entegrasyon, ajan, ajan görevi, rol) |
| `EmptyState` | Gerçek boş durum: ikon, başlık, açıklama, isteğe bağlı eylem. Filtreli ve filtresiz metinler ayrıdır |
| `FilterChips` | URL tabanlı filtre grubu (`aria-current`); sayfa numarasını sıfırlar, diğer filtreleri korur |
| `SearchForm` | URL tabanlı arama (`role="search"`), temizleme düğmesi; sayfa numarasını sıfırlar |
| `Pagination` | "11–20 of 25" bilgisi, önceki/sonraki bağlantıları, uçlarda devre dışı |
| `ConfirmDelete` | Onay penceresi; hassas işlemlerde **yazılı onay** (`confirmPhrase`) ve "default" tonu |
| `FormField`, `OptionSelect` | Etiket–alan–hata/ipucu düzeni; tipli seçim kutusu |

Formlar sunucu doğrulamasını esas alır: API'nin döndürdüğü alan hataları ilgili alanın altında gösterilir,
genel hata `sonner` bildirimiyle verilir. Alan kimlikleri `useId()` ile üretilir (aynı form iki kez DOM'da
bulunsa da etiketler doğru alana bağlanır).

## Yükleme, boş ve hata durumları

| Durum | Davranış |
| --- | --- |
| Yükleniyor | Bölüm boyutunda `Skeleton` (`aria-busy`) |
| Boş | `EmptyState`; uydurma sayı veya örnek kart **yok** |
| Bulunamadı | `not-found` sayfası ("Nothing here") — başka kullanıcının kaydı da aynı yanıtı alır |
| Hata | `(hq)/error.tsx`: genel mesaj + "Try again"; yalnızca `digest` referansı gösterilir, ayrıntı sızmaz |
| Dış sistem yok | Bilgi kutusu (`Alert variant="info"`): neyin bağlı olmadığı ve hangi fazda geleceği |

## Hareket

- Yalnızca kısa geçişler (renk, opaklık; pencere açılışı). Dikkat dağıtan animasyon yoktur.
- `prefers-reduced-motion: reduce` etkinse tüm animasyon ve geçişler kapatılır (`globals.css`).

## Erişilebilirlik

- Klavye ile tam gezinme; görünür odak halkası (`focus-visible:ring`).
- Anlamlı yer işaretleri: `navigation` (Main, Settings sections, Pagination), `search`, `banner`, bölgeler
  (`region` + başlık), tablolar için `th`.
- Simge düğmelerinde `aria-label` (ör. "Delete Notes for 1.4.0", "Actions for …").
- Hata kutuları `role="alert"` ile duyurulur; statik bilgi kutuları `role="note"` (ekran okuyucuyu bölmez).
- Form alanlarında `aria-invalid` ve etiket bağlantısı; renk tek başına bilgi taşımaz.
- E2E testleri seçicileri erişilebilir rol ve adlarla yazar; bu, erişilebilirliğin sürekli denetlenmesini sağlar.
