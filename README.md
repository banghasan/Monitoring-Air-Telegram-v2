# Monitoring Air Telegram

Bot Telegram publik untuk memantau tinggi muka air `Angke Hulu` dari XML Posko Banjir DKI Jakarta.

## Fitur

- `/air`, `/ping`, `/start`, `/help` untuk publik.
- `/system` untuk owner/admin.
- Telegram Rich Message dengan details collapsed dan button refresh/peta.
- Cache memory dengan TTL 60 detik dan stale fallback 15 menit.
- Notifikasi ke group forum/thread ketika `STATUS_SIAGA` berubah.
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

Worker dijalankan terpisah pada terminal lain:

```bash
APP_ROLE=monitor bun run start:monitor
```

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

```text
ghcr.io/banghasan/monitoring-air-telegram-v2:<tag>
```

## Dokumentasi lengkap

Mulai dari [docs/README.md](./docs/README.md). Referensi Telegram Rich Message yang dipakai adapter ada di [docs/telegram/api.md](./docs/telegram/api.md).
