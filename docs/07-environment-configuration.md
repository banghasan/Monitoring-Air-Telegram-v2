# Environment Configuration

## Prinsip

Configuration dibaca dari environment. Secret tidak ditulis ke source code, Dockerfile, atau image.

## Variable

```dotenv
# Runtime
NODE_ENV=development
APP_VERSION=0.1.0
PORT=3000
TIMEZONE=Asia/Jakarta
LOG_LEVEL=info

# Telegram
TELEGRAM_BOT_TOKEN=replace-me
TELEGRAM_MODE=polling
TELEGRAM_OWNER_ID=
TELEGRAM_ADMIN_IDS=

# Future webhook mode; tidak dipakai pada tahap polling
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
MONITOR_TARGETS_JSON=[]
```

## Station variable

- `WATER_STATION_QUERY` adalah selector semantik, bukan ID.
- `WATER_STATION_DISPLAY_NAME` hanya label UI.
- `ID_PINTU_AIR` dan `KODE_STASIUN` tidak disimpan sebagai konfigurasi identity.

## Monitoring variable

- `MONITOR_ENABLED` mengaktifkan worker monitoring.
- `MONITOR_INTERVAL_SECONDS` mengatur interval pemeriksaan XML; default awal 60 detik.
- `MONITOR_TARGETS_JSON` berisi satu atau beberapa target Telegram.

Contoh target:

```json
[
  {
    "chat_id": "-1001234567890",
    "thread_id": 42,
    "label": "Operasional"
  },
  {
    "chat_id": "@contoh_channel",
    "label": "Channel publik"
  }
]
```

`thread_id` bersifat optional. Konfigurasi internal ini nantinya dipetakan ke field thread/message Telegram sesuai schema pada [`telegram/api.md`](./telegram/api.md). Tidak semua tipe chat mendukung thread.

Worker awal dijalankan sebagai satu replica agar satu perubahan tidak dikirim berulang. Jika worker dibuat lebih dari satu replica, diperlukan distributed lock atau mekanisme deduplication bersama.

## Public access dan admin

Bot bersifat publik. Tidak ada `TELEGRAM_ALLOWED_CHAT_IDS` pada keputusan saat ini.

- `TELEGRAM_OWNER_ID` berisi satu Telegram user ID utama;
- `TELEGRAM_ADMIN_IDS` berisi daftar user ID admin yang dipisahkan koma;
- otorisasi memakai `from.id`, bukan username;
- `/system` hanya boleh diproses untuk owner/admin.

## Validasi startup

Saat startup, aplikasi perlu menolak konfigurasi yang:

- token Telegram kosong;
- mode tidak dikenal;
- angka duration bukan integer positif;
- owner/admin ID tidak dapat diparse;
- `WATER_STATION_QUERY` kosong;
- `MONITOR_INTERVAL_SECONDS` bukan integer positif jika monitoring diaktifkan;
- `MONITOR_TARGETS_JSON` bukan JSON array yang valid;
- target tidak memiliki `chat_id`;
- webhook configuration tidak lengkap jika mode webhook kelak diaktifkan.
