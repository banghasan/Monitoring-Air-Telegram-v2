# Docker dan Docker Compose

## Tujuan deployment

Bot dibuild menjadi satu Docker image dan dijalankan sebagai dua service Compose: `bot` untuk polling Telegram dan `monitor` untuk pemantauan berkala. Polling tidak membutuhkan endpoint publik Telegram, tetapi setiap service tetap menyediakan endpoint health check untuk kebutuhan operasional.

## File deployment

```text
Dockerfile
docker-compose.example.yml
.dockerignore
.env.example
.env                 # lokal/production, tidak di-commit
```

Contoh Compose yang memakai image GHCR tersedia di [`docker-compose.example.yml`](../docker-compose.example.yml) dan dijelaskan di [deployment Compose GHCR](./deployment/01-compose-ghcr.md). File tersebut sengaja memakai placeholder melalui `.env`, sehingga secret tetap berada di host.

## Environment

Docker Compose memuat environment production melalui `env_file`. Secret hanya diberikan saat container dijalankan dan tidak dimasukkan ke layer image.

File `.env.example` berisi nama variable dan contoh aman. File `.env` asli harus berada di `.gitignore` dan dikelola di host/deployment secret store.

File contoh root yang dapat dipakai setelah image tersedia adalah [`docker-compose.example.yml`](../docker-compose.example.yml). Secara default ia membaca `.env`; gunakan `ENV_FILE=.env.example` hanya untuk memvalidasi struktur Compose dengan placeholder.

## Image

Nama image repository saat ini:

```text
ghcr.io/banghasan/monitoring-air-telegram-v2:<tag>
```

Workflow GitHub mengambil `${{ github.repository }}` secara dinamis lalu menormalkannya menjadi lowercase agar valid sebagai nama image Docker.

Rancangan Dockerfile:

- gunakan base image Bun yang versinya dipin;
- install dependency dari lockfile;
- gunakan multi-stage build jika hasilnya mengurangi ukuran image;
- jangan menyalin `.env` ke image;
- jalankan process dengan user non-root bila memungkinkan;
- sediakan endpoint `/health` untuk pemeriksaan container.

Sebelum build image, pemeriksaan lokal yang digunakan adalah:

```bash
bun run check
```

Build Docker tidak menggantikan unit test, lint, atau type-check. Quality gate tetap dijalankan melalui `bun run check` sebelum build/publish image.

## Runtime polling

Service `bot` menjalankan:

- Elysia HTTP server;
- grammY polling loop;
- cache untuk command `/air`.

Jangan menjalankan dua container polling dengan token bot yang sama kecuali mekanisme koordinasi update sudah dirancang.

## Runtime monitoring

Service `monitor` memakai image aplikasi yang sama, tetapi entrypoint/role berbeda. Worker:

- tidak menjalankan polling update Telegram;
- mengambil XML sesuai `MONITOR_INTERVAL_SECONDS`;
- membandingkan snapshot sekarang dengan state terakhir;
- mengirim Rich Message jika `STATUS_SIAGA` berubah;
- mengirim ke semua target pada `MONITOR_TARGETS_JSON`;
- menyimpan state minimal agar restart tidak otomatis menganggap data lama sebagai perubahan baru.

Bot dan worker menulis log terstruktur ke console. Docker Compose tidak perlu menyimpan file log di dalam container; pengelolaan log dilakukan dari stdout/stderr melalui Docker logging driver atau platform deployment.

Deployment awal sebaiknya hanya menjalankan satu replica `monitor`. Service bot dan monitor boleh berbagi source code/image, tetapi lifecycle dan health check-nya dipisahkan.

Kedua service membaca `env_file` yang sama, tetapi `APP_ROLE` dan lifecycle process harus berbeda. Service `monitor` tetap membutuhkan token Telegram karena ia mengirim notifikasi, namun tidak boleh menjalankan `bot.start()` atau menerima update polling.

## Retry, dry-run, dan health

- Fetch upstream mencoba maksimal tiga kali per siklus dengan backoff yang dapat diatur environment.
- Pengiriman ke target mencoba maksimal tiga kali per target; kegagalan satu target tidak menghentikan target lain.
- `MONITOR_DRY_RUN=true` menjalankan alur monitoring dan menulis payload/event ke log, tetapi tidak memanggil API Telegram.
- `/health` menunjukkan process hidup.
- `/ready` menunjukkan konfigurasi minimum valid dan dependency internal siap; status upstream yang sedang gagal dicatat sebagai kondisi monitoring, bukan alasan mengirim broadcast error.
- Compose memakai `restart: unless-stopped` agar process yang berhenti dapat dijalankan kembali oleh Docker.

Health endpoint bukan pengganti `/system`. Endpoint tersebut dipakai Docker/orchestrator, sedangkan `/system` merangkum kondisi operasional untuk owner/admin.

## Rotasi log Docker

Aplikasi menulis NDJSON satu baris per event ke stdout/stderr. Compose perlu membatasi ukuran log agar `docker logs` tidak memenuhi disk host. Rancangan konfigurasi service:

```yaml
logging:
  driver: json-file
  options:
    max-size: "10m"
    max-file: "5"
```

Angka rotasi adalah default awal dan dapat disesuaikan dengan kebijakan host. Jangan mengubah log aplikasi menjadi pretty-print multiline karena akan menyulitkan pemrosesan event JSON.

## State worker

Cache memory saja cukup untuk command on-demand, tetapi notifikasi perubahan memerlukan minimal state perubahan terakhir. Keputusan awal memakai SQLite melalui `bun:sqlite` pada named volume milik service `monitor`. Detail schema, migration, dan backup ada di [konsep SQLite](./concepts/18-sqlite-state-and-migrations.md).

Tanpa state persisten, worker dapat mengirim notifikasi ulang setelah restart atau kehilangan perubahan yang terjadi selama worker mati.

Service `bot` tidak membuka file SQLite monitor secara langsung. Jika `/system` membutuhkan status worker, bot mengambil ringkasan melalui internal status endpoint pada jaringan Compose dengan service token.

## Webhook opsional

Jika `TELEGRAM_WEBHOOK_ENABLED=true`, port container perlu berada di belakang domain HTTPS atau reverse proxy. Port Compose saja tidak membuat URL webhook menjadi publik. Jika `false`, bot otomatis memakai polling.
