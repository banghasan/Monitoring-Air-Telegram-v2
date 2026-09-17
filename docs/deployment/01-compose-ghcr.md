# Contoh Docker Compose dengan Image GHCR

## Status

Ini contoh deployment yang siap dipakai setelah image dipublish ke GHCR. File runnable-nya ada di [`docker-compose.example.yml`](../../docker-compose.example.yml); contoh ini tidak menyimpan secret.

## Image

Repository image:

```text
ghcr.io/banghasan/monitoring-air-telegram-v2:<tag>
```

Tag diisi dengan tag yang dipublish oleh GitHub Action manual, misalnya `latest`, `0.1.0`, atau commit SHA.

## Prasyarat

- Docker Engine dan Docker Compose Plugin tersedia di host.
- Image sudah dibuild dan dipush oleh workflow Docker manual.
- Host sudah login ke GHCR jika image private.
- File `.env` production tersedia di host dan tidak di-commit.
- `MONITOR_TARGETS_JSON` berisi minimal satu target yang sudah diverifikasi; group forum memakai `thread_id`, sedangkan channel menghilangkan field tersebut.
- `INTERNAL_STATUS_TOKEN` menggunakan secret acak yang sama untuk `bot` dan `monitor`.

Login GHCR jika diperlukan:

```bash
docker login ghcr.io
```

## Contoh Compose

```yaml
services:
  bot:
    image: ghcr.io/banghasan/monitoring-air-telegram-v2:${IMAGE_TAG:-latest}
    pull_policy: always
    env_file:
      - ${ENV_FILE:-.env}
    environment:
      APP_ROLE: bot
      PORT: 3000
      MONITOR_ENABLED: "false"
      INTERNAL_STATUS_URL: http://monitor:3000/internal/status
    command: ["bun", "run", "src/bot.ts"]
    ports:
      - "${BOT_HTTP_PORT:-3000}:3000"
    depends_on:
      monitor:
        condition: service_healthy
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "bun", "-e", "fetch('http://127.0.0.1:3000/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 10s
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "5"

  monitor:
    image: ghcr.io/banghasan/monitoring-air-telegram-v2:${IMAGE_TAG:-latest}
    pull_policy: always
    env_file:
      - ${ENV_FILE:-.env}
    environment:
      APP_ROLE: monitor
      PORT: 3000
      MONITOR_ENABLED: "true"
      MONITOR_STATE_DB_PATH: /data/state/monitor.sqlite
    command: ["bun", "run", "src/monitor.ts"]
    expose:
      - "3000"
    volumes:
      - monitor_state:/data/state
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "bun", "-e", "fetch('http://127.0.0.1:3000/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 10s
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "5"

volumes:
  monitor_state:
```

## Environment minimum

Contoh `.env` production harus menyediakan minimal:

```dotenv
TELEGRAM_BOT_TOKEN=replace-with-real-secret
TELEGRAM_WEBHOOK_ENABLED=false
TELEGRAM_OWNER_ID=123456789
TELEGRAM_ADMIN_IDS=

WATER_SOURCE_URL=https://poskobanjir.dsdadki.web.id/xmldata.xml
WATER_STATION_QUERY=Angke Hulu
WATER_STATION_DISPLAY_NAME=P.S. Angke Hulu (Baru)

MONITOR_INTERVAL_SECONDS=60
MONITOR_DRY_RUN=false
MONITOR_TARGETS_JSON='[{"chat_id":"-1004431127445","thread_id":5,"label":"Monitoring"},{"chat_id":"-1003861660503","label":"Channel"}]'
INTERNAL_STATUS_TOKEN=replace-with-random-secret
```

Secret tidak ditulis ke YAML Compose atau image. `INTERNAL_STATUS_TOKEN` boleh berada pada `.env` host atau secret store deployment.

## Alur deploy manual

1. Jalankan GitHub Action Docker secara manual. Workflow akan otomatis login dan push image ke GHCR.
2. Pastikan tag image berhasil tersedia di GHCR.
3. Set `IMAGE_TAG` pada environment host atau gunakan default `latest`.
4. Salin `.env.example` menjadi `.env`, isi secret, atau gunakan `ENV_FILE` untuk menunjuk file env lain.
5. Validasi konfigurasi Compose dengan `docker compose config`.
6. Pull image yang sesuai.
7. Jalankan `docker compose up -d`.
8. Periksa `docker compose ps` dan health check.
9. Periksa log dengan `docker compose logs -f bot monitor`.

Smoke test lokal sudah memvalidasi konfigurasi Compose dan health endpoint image monitor. Pull/publish ke GHCR tetap merupakan langkah deployment manual.

## Upgrade dan rollback

Upgrade dilakukan dengan mengganti `IMAGE_TAG` ke tag baru, pull image, lalu recreate service. Named volume `monitor_state` tidak boleh dihapus saat upgrade normal.

Rollback dilakukan dengan mengembalikan `IMAGE_TAG` ke tag image sebelumnya. Migration database harus backward-compatible terhadap versi rollback yang didukung. Jika migration tidak backward-compatible, prosedur rollback wajib menggunakan backup state yang sesuai.

## Catatan entrypoint

Compose meng-override command image agar role terlihat jelas: `src/bot.ts` dan `src/monitor.ts`. Dockerfile tetap boleh memiliki default entrypoint untuk development, tetapi production Compose harus memakai command role yang eksplisit.
