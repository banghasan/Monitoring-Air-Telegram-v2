# Docker dan Docker Compose

## Tujuan deployment

Bot dibuild menjadi satu Docker image dan dijalankan sebagai dua service Compose: `bot` untuk polling Telegram dan `monitor` untuk pemantauan berkala. Polling tidak membutuhkan endpoint publik Telegram, tetapi setiap service tetap menyediakan endpoint health check untuk kebutuhan operasional.

## File yang direncanakan

```text
Dockerfile
docker-compose.yml
.dockerignore
.env.example
.env                 # lokal/production, tidak di-commit
```

## Environment

Docker Compose memuat environment production melalui `env_file`. Secret hanya diberikan saat container dijalankan dan tidak dimasukkan ke layer image.

File `.env.example` berisi nama variable dan contoh aman. File `.env` asli harus berada di `.gitignore` dan dikelola di host/deployment secret store.

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

Sebelum build image, pemeriksaan lokal yang direncanakan adalah:

```bash
bun run check
```

Build Docker tidak menggantikan unit test, lint, atau type-check. Workflow build manual boleh menambahkan quality gate sebagai job terpisah setelah source aplikasi tersedia.

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

Kedua service membaca `env_file` yang sama, tetapi role process harus berbeda. Service `monitor` tetap membutuhkan token Telegram karena ia mengirim notifikasi, namun tidak boleh menjalankan `bot.start()` atau menerima update polling.

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

Cache memory saja cukup untuk command on-demand, tetapi notifikasi perubahan memerlukan minimal state perubahan terakhir. Pilihan penyimpanan state dicatat sebagai issue terpisah: volume lokal/SQLite, file state atomik, atau storage bersama seperti Redis.

Tanpa state persisten, worker dapat mengirim notifikasi ulang setelah restart atau kehilangan perubahan yang terjadi selama worker mati.

## Webhook masa depan

Jika mode webhook diaktifkan, port container perlu berada di belakang domain HTTPS atau reverse proxy. Port Compose saja tidak membuat URL webhook menjadi publik.
