# Docker dan Docker Compose

## Tujuan deployment

Bot dibuild menjadi Docker image dan dijalankan sebagai satu service Compose. Polling tidak membutuhkan endpoint publik Telegram, tetapi Elysia tetap menyediakan port untuk health check dan kebutuhan operasional.

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

## State worker

Cache memory saja cukup untuk command on-demand, tetapi notifikasi perubahan memerlukan minimal state perubahan terakhir. Pilihan penyimpanan state dicatat sebagai issue terpisah: volume lokal/SQLite, file state atomik, atau storage bersama seperti Redis.

Tanpa state persisten, worker dapat mengirim notifikasi ulang setelah restart atau kehilangan perubahan yang terjadi selama worker mati.

## Webhook masa depan

Jika mode webhook diaktifkan, port container perlu berada di belakang domain HTTPS atau reverse proxy. Port Compose saja tidak membuat URL webhook menjadi publik.
