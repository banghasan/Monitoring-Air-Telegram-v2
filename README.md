# Monitoring Air Telegram

Bot Telegram publik untuk memantau tinggi muka air `Angke Hulu` dari XML Posko Banjir DKI Jakarta.

## Fitur

- `/air`, `/ping`, `/start`, `/help` untuk publik.
- `/system`, `/notify <pesan>`, dan `/notifyair` untuk owner/admin.
- Telegram Rich Message dengan details collapsed, button refresh, dan link peta pada nama station.
- Cache memory dengan TTL 60 detik dan stale fallback 15 menit.
- Notifikasi ke banyak target group/channel ketika `STATUS_SIAGA` berubah; `thread_id` opsional untuk topic group.
- Worker monitoring terpisah dengan state SQLite persisten.
- Polling sebagai mode awal; webhook tersedia sebagai konfigurasi alternatif.
- JSON log ke console untuk `docker logs`.

## Menjalankan lokal

Gunakan Bun `1.4.2` sesuai [.bun-version](./.bun-version):

```bash
bun install --frozen-lockfile
cp .env.example .env
# isi TELEGRAM_BOT_TOKEN dan konfigurasi target bila menjalankan monitor
bun run check
bun run start:bot
```

Dengan `APP_ROLE=bot` dan `TELEGRAM_WEBHOOK_ENABLED=false`, `bun run dev` juga langsung menjalankan bot dalam mode polling. `PORT` dipakai untuk HTTP Elysia (health check dan webhook opsional), baik saat lokal maupun di Docker; port ini tidak mengubah mekanisme polling.

Worker dijalankan terpisah pada terminal lain:

```bash
APP_ROLE=monitor PORT=3001 bun run start:monitor
```

Pada contoh lokal, `INTERNAL_STATUS_URL` menunjuk ke monitor di `127.0.0.1:3001`. Saat Compose digunakan, nilainya dioverride menjadi `http://monitor:3000/internal/status` dan database monitor dioverride ke path container `/data/state/monitor.sqlite`.

## Quality gate

```bash
bun run test
bun run lint
bun run typecheck
bun run format:check
bun run check
```

## Versioning

```bash
bun run version:show
bun run version:dump
bun run version:bump:patch
bun run version:bump:minor
bun run version:bump:major
```

Versi aplikasi berasal dari `package.json`; `.bun-version` hanya mengatur versi runtime Bun.

## Docker

Build lokal:

```bash
docker build \
  --build-arg BUN_VERSION="$(tr -d '[:space:]' < .bun-version)" \
  -t monitoring-air-telegram-v2:local .
```

Contoh Compose yang memuat environment dari host dan memakai image GHCR tersedia di [docker-compose.example.yml](./docker-compose.example.yml) serta [dokumentasi deployment](./docs/deployment/01-compose-ghcr.md).

GitHub Action [`.github/workflows/docker-build.yml`](./.github/workflows/docker-build.yml) hanya berjalan manual melalui `workflow_dispatch`. Nama image mengikuti repository GitHub yang dinormalisasi lowercase:

Setiap eksekusi workflow akan otomatis mem-publish image ke GHCR dengan tag yang dimasukkan pada `image_tag` serta tag commit SHA.

```text
ghcr.io/banghasan/monitoring-air-telegram-v2:<tag>
```

## Dokumentasi lengkap

Mulai dari [docs/README.md](./docs/README.md). Referensi Telegram Rich Message yang dipakai adapter ada di [docs/telegram/api.md](./docs/telegram/api.md).
