# PMAM — Proje Yönetim Uygulaması Mimari ve Tasarım Spesifikasyonu

**Tarih:** 2026-11-17
**Durum:** Onaylandı (İnceleme Aşamasında)

## 1. Amaç ve Kapsam

PMAM; birden fazla projenin yönetilebildiği, modern ve minimalist arayüze sahip, aynı görev verisi üzerinde hem **Kanban Board** hem de **MS Project benzeri (WBS, Gantt, Bağımlılıklar, Kilometre Taşları, Kritik Yol, İş Yükü)** görünümleri sunan çok kullanıcılı bir proje yönetim uygulamasıdır.

- **Web & Mobil Hazırlığı:** Tüm iş mantığı versiyonlu bir REST API (`/api/v1/*`) arkasında sunulur; ileride geliştirilecek mobil uygulama doğrudan aynı API katmanını ve OpenAPI sözleşmesini kullanır.
- **Altyapı:** Docker Compose ile ayağa kalkar, mevcut Docker `mssql` (`mcr.microsoft.com/mssql/server:2022-latest`, port `1433`) sunucusunu kullanır ve tek bir HTTP giriş noktası üzerinden `cloudflared` ile bir subdomain'e bağlanmaya hazırdır.
- **Bildirimler:** Yaklaşan/geciken görevler, görev atamaları, yorumlar ve özel hatırlatmalar için arka plan zamanlayıcısı üzerinden **Web Push (VAPID/PWA)** ve **ntfy** bildirimleri gönderir; ileride mobil push token'ları (FCM/APNs) için hazırdır.

---

## 2. Sistem Mimarisi ve Docker Dağıtımı

### 2.1. Monorepo Yapısı
```text
pmam/
├── apps/
│   ├── api/                 # Fastify + TypeScript + Prisma (MSSQL) + OpenAPI + Push Scheduler
│   └── web/                 # React 19 + TypeScript + Vite + Tailwind CSS + PWA
├── docker-compose.yml       # pmam-api ve pmam-web (Nginx reverse proxy)
├── .env.example             # MSSQL, JWT, VAPID, ntfy ve port ayarları
└── docs/superpowers/specs/
```

### 2.2. Ağ, `mssql` ve `cloudflared` Topolojisi
- **`pmam-web` (Nginx):** Dışarıya `127.0.0.1:3600:80` (`.env` ile değiştirilebilir) portundan hizmet verir.
  - `/` -> React SPA statik dosyaları (PWA `manifest.webmanifest` ve `sw.js` dahil).
  - `/api/*` -> İç Docker ağındaki `pmam-api:4000` servisine proxy.
  - `/docs/*` -> `pmam-api:4000/docs` Swagger/OpenAPI arayüzüne proxy.
- **`pmam-api`:** Host veya Docker ağı üzerindeki mevcut `mssql` (`host.docker.internal:1433` veya ortak Docker ağı) sunucusuna `pmam` veritabanı adıyla bağlanır. İlk başlangıçta `pmam` veritabanı yoksa otomatik oluşturulur ve Prisma migration'ları uygulanır.
- **`cloudflared`:** Tek bir tünel kuralı (`pm.alanadiniz.com -> http://host.docker.internal:3600`) ile hem Web arayüzü hem de `/api/v1` mobil/web API'si HTTPS üzerinden yayınlanır.

---

## 3. Veritabanı Şeması (MSSQL / Prisma)

### 3.1. Temel Varlıklar
1. **`User`**
   - `id` (UUID), `email` (unique), `passwordHash`, `name`, `avatarColor`, `role` (`ADMIN` | `MEMBER`), `dailyCapacityHours` (float, varsayılan `8`), `ntfyTopic` (nullable string), `createdAt`, `updatedAt`.
2. **`RefreshToken`**
   - `id` (UUID), `userId`, `tokenHash`, `expiresAt`, `revokedAt`, `createdAt`.
3. **`Project`**
   - `id` (UUID), `name`, `key` (ör. `PM`, unique veya kullanıcı/sistem içi kısa kod), `description`, `color`, `status` (`ACTIVE` | `ARCHIVED`), `taskSeq` (int, `PM-1`, `PM-2` üretimi için), `createdAt`, `updatedAt`.
4. **`ProjectMember`**
   - `id` (UUID), `projectId`, `userId`, `role` (`OWNER` | `EDITOR` | `VIEWER`), `createdAt`. (`[projectId, userId]` unique).
5. **`BoardColumn`**
   - `id` (UUID), `projectId`, `name`, `order` (int), `wipLimit` (int nullable), `mappedStatus` (`TODO` | `IN_PROGRESS` | `REVIEW` | `DONE`), `color` (nullable).
6. **`Task`**
   - `id` (UUID), `projectId`, `code` (ör. `PM-12`), `parentId` (nullable self-relation — WBS alt görev hiyerarşisi), `columnId` (BoardColumn FK), `order` (int).
   - `title`, `description`, `priority` (`LOW` | `MEDIUM` | `HIGH` | `URGENT`), `status` (`TODO` | `IN_PROGRESS` | `REVIEW` | `DONE`).
   - `startDate` (DateTime), `dueDate` (DateTime), `estimatedHours` (float, varsayılan `0`), `progress` (int `0-100`), `isMilestone` (boolean, varsayılan `false`).
   - `assigneeId` (nullable User FK), `creatorId` (User FK), `createdAt`, `updatedAt`.
7. **`TaskDependency`**
   - `id` (UUID), `predecessorId` (Task FK), `successorId` (Task FK), `type` (`FS` | `SS` | `FF` | `SF`, varsayılan `FS`), `lagDays` (int, varsayılan `0`). (`[predecessorId, successorId]` unique).
8. **`TaskComment`**
   - `id` (UUID), `taskId`, `userId`, `body`, `createdAt`, `updatedAt`.
9. **`TaskActivity`**
   - `id` (UUID), `taskId`, `userId`, `action` (ör. `STATUS_CHANGED`, `ASSIGNED`, `DATES_UPDATED`), `metadata` (JSON string), `createdAt`.
10. **`Reminder`**
    - `id` (UUID), `taskId`, `userId`, `remindAt` (DateTime), `message` (nullable), `sentAt` (nullable DateTime), `createdAt`.
11. **`Notification`**
    - `id` (UUID), `userId`, `taskId` (nullable), `type` (`ASSIGNED` | `REMINDER` | `DUE_SOON` | `OVERDUE` | `COMMENT`), `title`, `body`, `isRead` (boolean), `createdAt`.
12. **`PushSubscription`**
    - `id` (UUID), `userId`, `platform` (`WEB` | `IOS` | `ANDROID`), `endpoint` (nullable), `p256dh` (nullable), `auth` (nullable), `deviceToken` (nullable), `createdAt`.

*Not:* MSSQL'de çoklu cascade path kısıtlamaları nedeniyle self-relation (`Task.parentId`) ve çift yönlü görev ilişkilerinde (`TaskDependency`) `onDelete: NoAction` kullanılıp silme işlemleri API katmanında transaction ile yönetilecektir.

---

## 4. API Katmanı ve İş Mantığı (`/api/v1`)

### 4.1. Kimlik Doğrulama ve Yetkilendirme
- `POST /api/v1/auth/register` — İlk kayıt olan kullanıcı otomatik `ADMIN` olur; sonrakiler `MEMBER`.
- `POST /api/v1/auth/login` — Access Token (15 dk) + Refresh Token (30 gün) döner.
- `POST /api/v1/auth/refresh` — Refresh Token rotasyonu.
- `POST /api/v1/auth/logout` — Refresh Token iptali.
- `GET /api/v1/auth/me` & `PATCH /api/v1/auth/me` — Profil, `dailyCapacityHours`, `ntfyTopic` güncelleme.
- **Yetki Kuralları:**
  - `VIEWER`: Proje, görev, Gantt, iş yükü görüntüleme ve yorum yapma.
  - `EDITOR`: Görev/sütun/bağımlılık oluşturma, düzenleme, taşıma.
  - `OWNER` / `ADMIN`: Proje ayarları, üye ekleme/çıkarma, proje arşivleme/silme.

### 4.2. Proje, Kanban, Gantt & Planlama Endpoint'leri
- `GET/POST /api/v1/projects`, `GET/PATCH/DELETE /api/v1/projects/:id`
- `GET/POST/DELETE /api/v1/projects/:id/members`
- `GET/POST/PATCH/DELETE /api/v1/projects/:id/columns` + `POST /api/v1/projects/:id/columns/reorder`
- `GET/POST /api/v1/projects/:id/tasks` (filtreler: `assigneeId`, `priority`, `status`, `search`, `overdue`)
- `GET/PATCH/DELETE /api/v1/tasks/:id`
- `POST /api/v1/tasks/:id/move` (`columnId`, `order` — Kanban sürükle-bırak için; sütunun `mappedStatus` değerine göre görevin `status` alanını günceller, `DONE` ise opsiyonel `%100` veya mevcut ilerlemeyi korur)
- `POST /api/v1/tasks/:id/dependencies` & `DELETE /api/v1/dependencies/:id` (DFS ile döngüsel bağımlılık engelleme)
- `GET /api/v1/projects/:id/schedule/critical-path` — İleri/Geri Geçiş (Forward/Backward Pass CPM) algoritmasıyla her görev için `earlyStart`, `earlyFinish`, `lateStart`, `lateFinish`, `slackDays` ve `isCritical` hesaplar.
- `GET /api/v1/projects/:id/workload?from=...&to=...` — Tarih aralığında kişi bazlı günlük saat dağılımını (`estimatedHours / iş günü` veya görev süresine eşit dağıtım) ve kapasite aşımını (`allocatedHours > dailyCapacityHours`) döner.
- `GET/POST /api/v1/tasks/:id/comments`, `GET /api/v1/tasks/:id/activity`

### 4.3. Bildirim ve Zamanlayıcı Mimarisi
- `GET /api/v1/notifications`, `PATCH /api/v1/notifications/:id/read`, `POST /api/v1/notifications/read-all`
- `GET/POST/DELETE /api/v1/tasks/:id/reminders`
- `GET /api/v1/push/vapid-public-key`, `POST /api/v1/push/subscribe`, `DELETE /api/v1/push/subscribe`, `POST /api/v1/push/test`
- **Arka Plan Zamanlayıcısı (Her 60 saniyede bir):**
  1. Zamanı gelmiş (`remindAt <= now` ve `sentAt IS NULL`) `Reminder` kayıtlarını işler.
  2. Bitişine 24 saat kalan (`DUE_SOON`) ve süresi geçmiş (`OVERDUE`) tamamlanmamış görevler için günde en fazla 1 kez bildirim üretir (tekrar bildirimleri önlemek için `Notification` kontrolü yapar).
  3. Üretilen her bildirimi kullanıcının aktif `PushSubscription` (`WEB`) kayıtlarına `web-push` ile ve tanımlıysa `ntfyTopic` adresine (`NTFY_URL` üzerinden HTTP POST) iletir.

---

## 5. Kullanıcı Arayüzü (UI/UX) Tasarımı

- **Tasarım Dili:** Minimalist, yüksek okunabilirlikli (Inter / system-ui, monospace kod etiketleri), ince kenarlıklar (`1px`), sade renk paleti, Açık/Koyu tema desteği.
- **Giriş & Kayıt Ekranı (`/login`):** Ortalanmış kart, form doğrulama, hata geri bildirimi.
- **Ana Çalışma Alanı:**
  - **Sol Kenar Çubuğu:** Marka başlığı, "Görevlerim" görünümü, Projeler listesi (+ Yeni Proje modalı), alt kısımda Bildirimler, Profil/Bildirim Ayarları ve Çıkış.
  - **Proje Üst Çubuğu:** Proje adı & rengi, filtre çubuğu (arama, atanan kişi, öncelik), görünüm seçici sekmeler (**Kanban**, **Gantt & WBS**, **İş Yükü**, **Ayarlar**) ve **+ Yeni Görev** butonu.
- **Kanban Board:**
  - Sütun başlıklarında görev sayısı ve WIP limiti göstergesi (aşılırsa uyarı rengi).
  - `@dnd-kit` ile sütun içi sıralama ve sütunlar arası taşıma.
  - Kartlarda: Görev kodu (`PM-12`), öncelik göstergesi, başlık, alt görev sayısı (`2/4`), milestone elmas ikonu, bitiş tarihi, ilerleme çubuğu (`%`), atanan kişi avatarı.
- **MS Project Benzeri Gantt & WBS:**
  - Bölünmüş ekran: Solda WBS hiyerarşik görev tablosu (aç/kapa, WBS numarası `1`, `1.1`, başlangıç-bitiş, süre, `%`, atanan), sağda etkileşimli zaman çizelgesi.
  - Gün / Hafta / Ay ölçek seçenekleri, "Bugün" dikey çizgisi.
  - Görev çubuklarını sürükleyerek tarih kaydırma, uçlarından çekerek süre değiştirme.
  - Kilometre taşı (`◆`) gösterimi ve görevler arası SVG bağımlılık okları (`FS/SS/FF/SF`).
  - **"Kritik Yolu Göster"** anahtarı: Kritik görevleri ve kritik bağımlılık oklarını belirgin kırmızı/turuncu tonla vurgular.
- **İş Yükü (Workload) Görünümü:**
  - Satırlarda proje üyeleri (günlük kapasite bilgisiyle), sütunlarda günler.
  - Her hücrede o güne düşen tahmini saat; kapasiteyi aşan günler kırmızı, normal günler yeşil/mavi tonla gösterilir.
- **Detaylı Görev Çekmecesi (Task Drawer):**
  - Hem Kanban kartından hem Gantt satırından açılır: tüm alanları düzenleme, alt görev ekleme, bağımlılık yönetme, hatırlatma kurma, yorum yazma ve aktivite geçmişini görme.

---

## 6. Test ve Doğrulama Stratejisi

- **Backend Unit & Integration Testleri (Vitest):**
  - CPM (Kritik Yol) algoritması, döngüsel bağımlılık engelleme, iş yükü hesaplama ve bildirim zamanlayıcısı mantığı.
  - Auth, Project, Task, Kanban Move ve Dependency API endpoint testleri.
- **Frontend Build & Smoke Testleri:**
  - TypeScript tip kontrolü (`tsc --noEmit`) ve Vite production build.
- **Docker Doğrulaması:**
  - `docker compose up -d --build` ile container'ların sağlıklı ayağa kalkması, mevcut Docker `mssql` üzerinde `pmam` veritabanının oluşması ve `/api/v1/health` + `/docs` + Web arayüzünün `127.0.0.1:3600` üzerinden yanıt vermesi.
