# Environment Configuration

## Prinsip

Configuration dibaca dari environment. Secret tidak ditulis ke source code, Dockerfile, atau image.

## Variable

```dotenv
# Runtime
NODE_ENV=development
# APP_VERSION=0.1.0  # optional; must match package.json when provided
PORT=3000
APP_ROLE=bot
TIMEZONE=Asia/Jakarta
LOG_LEVEL=info
LOG_FORMAT=json

# Telegram
TELEGRAM_BOT_TOKEN=replace-me
TELEGRAM_WEBHOOK_ENABLED=false
TELEGRAM_OWNER_ID=
TELEGRAM_ADMIN_IDS=

# Isi URL dan secret hanya jika TELEGRAM_WEBHOOK_ENABLED=true
TELEGRAM_WEBHOOK_URL=
TELEGRAM_WEBHOOK_SECRET=

# Source and station selector
WATER_SOURCE_URL=https://poskobanjir.dsdadki.web.id/xmldata.xml
WATER_STATION_QUERY=Angke Hulu
WATER_STATION_DISPLAY_NAME=P.S. Angke Hulu (Baru)

# Cache and upstream
CACHE_TTL_SECONDS=60
CACHE_REFRESH_SECONDS=60
STALE_IF_ERROR_SECONDS=900
MAX_DATA_AGE_SECONDS=600
UPSTREAM_TIMEOUT_SECONDS=5

# Monitoring worker
MONITOR_INTERVAL_SECONDS=60
MONITOR_ENABLED=true
MONITOR_DRY_RUN=false
MONITOR_TARGETS_JSON=[]
MONITOR_STATE_DB_PATH=./data/state/monitor.sqlite
UPSTREAM_MAX_ATTEMPTS=3
UPSTREAM_RETRY_BACKOFF_SECONDS=5,15
TELEGRAM_SEND_MAX_ATTEMPTS=3
TELEGRAM_SEND_RETRY_BACKOFF_SECONDS=5,15

# Internal bot <-> monitor status
INTERNAL_STATUS_URL=http://127.0.0.1:3001/internal/status
INTERNAL_STATUS_TOKEN=replace-with-random-secret

# Public command protection
PUBLIC_COMMAND_COOLDOWN_SECONDS=1
```

## Station variable

- `WATER_STATION_QUERY` adalah selector semantik, bukan ID.
- `WATER_STATION_DISPLAY_NAME` hanya fallback label; output utama menampilkan nama record XML apa adanya.
- `ID_PINTU_AIR` dan `KODE_STASIUN` tidak disimpan sebagai konfigurasi identity.
- `APP_VERSION` untuk runtime sebaiknya diambil dari `package.json`; environment tidak boleh menjadi sumber versi kedua yang berbeda.
- `APP_ROLE` menentukan role container: `bot` atau `monitor`.
- `TELEGRAM_WEBHOOK_ENABLED=false` menurunkan mode menjadi polling.
- `TELEGRAM_WEBHOOK_ENABLED=true` menurunkan mode menjadi webhook dan mewajibkan URL serta secret.
- Nilai webhook flag selain `true` atau `false` ditolak saat startup; tidak otomatis dianggap `false`.
- `TELEGRAM_MODE` sudah tidak digunakan; jika masih ada pada environment lama, startup menolaknya agar migrasi tidak ambigu.

`PORT` adalah port HTTP Elysia untuk health check dan webhook opsional. Variable ini dipakai baik saat lokal maupun di Docker; mode polling tidak membutuhkan port publik Telegram.

## Path lokal dan path container

`MONITOR_STATE_DB_PATH` mengikuti filesystem process yang membukanya, sehingga nilainya perlu dibedakan menurut runtime:

| Runtime | Nilai | Arti |
| --- | --- | --- |
| `bun run dev` atau `bun run start:monitor` di host | `./data/state/monitor.sqlite` | File di dalam project, relatif terhadap current working directory. Directory dibuat otomatis oleh repository SQLite. |
| service `monitor` pada Compose | `/data/state/monitor.sqlite` | File di dalam container pada mount `/data/state`. |

Pada Compose, named volume `monitor_state` dipasang ke `/data/state`, sehingga file tidak berada di layer image dan tetap ada ketika container dibuat ulang. `/data/state/monitor.sqlite` bukan path host yang harus dibuat manual. Lokasi fisik host dikelola Docker; gunakan `docker volume inspect` jika perlu memeriksanya.

Service `bot` tidak membuka database ini. Hanya service `monitor` yang memakai `MONITOR_STATE_DB_PATH` untuk state worker.

## Monitoring variable

- `MONITOR_ENABLED` mengaktifkan worker monitoring.
- `MONITOR_INTERVAL_SECONDS` mengatur interval pemeriksaan XML; default awal 60 detik.
- `MONITOR_DRY_RUN=true` menjalankan fetch, parsing, compare, dan logging tanpa mengirim request Telegram. State baseline tetap diperbarui agar dry-run tidak menghasilkan event yang sama berulang setiap siklus.
- `MONITOR_TARGETS_JSON` untuk MVP berisi tepat satu group forum beserta `thread_id`.
- `MONITOR_STATE_DB_PATH` menunjuk database SQLite worker; gunakan path lokal saat development dan `/data/state/monitor.sqlite` saat service Compose.
- `UPSTREAM_MAX_ATTEMPTS` mengatur jumlah percobaan fetch dalam satu siklus; default 3.
- `UPSTREAM_RETRY_BACKOFF_SECONDS` mengatur jeda retry upstream, misalnya `5,15` detik.
- `TELEGRAM_SEND_MAX_ATTEMPTS` mengatur jumlah percobaan pengiriman per target; default 3.
- `TELEGRAM_SEND_RETRY_BACKOFF_SECONDS` mengatur jeda retry pengiriman, misalnya `5,15` detik.

Retry memiliki batas dan tidak boleh membuat worker menunggu tanpa batas. Kegagalan setelah seluruh percobaan tidak dikirim sebagai notifikasi ke target; detailnya masuk log JSON dan `/system`.

Contoh target:

```json
[
  {
    "chat_id": "-1001234567890",
    "thread_id": 42,
    "label": "Operasional"
  }
]
```

`thread_id` diwajibkan untuk target MVP. Konfigurasi multi-target dan channel menjadi perluasan berikutnya. Field internal ini nantinya dipetakan ke parameter thread/message Telegram sesuai schema pada [`telegram/api.md`](./telegram/api.md).

Worker awal dijalankan sebagai satu replica agar satu perubahan tidak dikirim berulang. Jika worker dibuat lebih dari satu replica, diperlukan distributed lock atau mekanisme deduplication bersama.

## Public command rate limit

`PUBLIC_COMMAND_COOLDOWN_SECONDS` membatasi pemanggilan command publik dari user/chat yang sama. Nilai awal satu detik cukup untuk mencegah spam ringan tanpa menghambat penggunaan normal. Rate limit ini tidak menggantikan cache dan tidak mengubah aturan notifikasi worker.

## Internal status variable

- `INTERNAL_STATUS_URL` hanya dipakai service `bot` untuk membaca ringkasan status monitor. Di host lokal gunakan `http://127.0.0.1:3001/internal/status` jika monitor dijalankan pada port 3001; di Compose gunakan `http://monitor:3000/internal/status` karena `monitor` adalah nama service.
- `INTERNAL_STATUS_TOKEN` wajib sama pada bot dan monitor, tetapi tidak boleh ditampilkan pada `/system` atau log.
- File SQLite hanya dibuka oleh monitor. Bot tidak menggunakan `MONITOR_STATE_DB_PATH` untuk membaca database secara langsung.

## Public access dan admin

Bot bersifat publik. Tidak ada `TELEGRAM_ALLOWED_CHAT_IDS` pada keputusan saat ini.

- `TELEGRAM_OWNER_ID` berisi satu Telegram user ID utama;
- `TELEGRAM_ADMIN_IDS` berisi daftar user ID admin yang dipisahkan koma;
- otorisasi memakai `from.id`, bukan username;
- `/system`, `/notify`, dan `/notifyair` hanya boleh diproses untuk owner/admin;
- bagian command owner/admin pada `/start` dan `/help` hanya ditampilkan jika `from.id` terotorisasi.

## Validasi startup

Saat startup, aplikasi perlu menolak konfigurasi yang:

- token Telegram kosong;
- mode tidak dikenal;
- angka duration bukan integer positif;
- owner/admin ID tidak dapat diparse;
- `WATER_STATION_QUERY` kosong;
- `APP_ROLE` bukan `bot` atau `monitor`;
- `MONITOR_INTERVAL_SECONDS` bukan integer positif jika monitoring diaktifkan;
- `MONITOR_DRY_RUN` bukan boolean yang valid;
- `MONITOR_TARGETS_JSON` bukan JSON array yang valid;
- target tidak memiliki `chat_id` atau `thread_id` pada konfigurasi MVP;
- monitoring aktif dan bukan dry-run tetapi jumlah target bukan tepat satu;
- konfigurasi retry memiliki jumlah attempt/backoff yang tidak konsisten;
- `PUBLIC_COMMAND_COOLDOWN_SECONDS` bukan angka duration yang valid;
- status endpoint internal aktif tetapi URL/token tidak lengkap;
- role `monitor` tidak memiliki path state SQLite yang dapat dibuka dan ditulis;
- webhook configuration tidak lengkap jika `TELEGRAM_WEBHOOK_ENABLED=true`.

Saat role `monitor` mulai, aplikasi membuka database SQLite, membuat parent directory jika diperlukan, menjalankan migration, dan menyiapkan WAL. Rangkaian ini sekaligus memvalidasi kemampuan baca/tulis path state. Jika gagal, aplikasi menulis log JSON event `state.database.init_failed`, menetapkan exit code gagal, dan tidak menjalankan HTTP server maupun scheduler monitoring.
