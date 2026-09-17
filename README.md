# Air Pantauan

Rancangan bot Telegram untuk pemantauan tinggi muka air Angke Hulu menggunakan data XML Posko Banjir DKI Jakarta.

> Status saat ini: dokumentasi dan fondasi deployment. Source aplikasi bot belum dibuat.

## Teknologi yang direncanakan

- Bun `1.4.2`
- Elysia
- grammY
- Telegram Rich Message
- Docker dan Docker Compose
- GitHub Actions untuk build Docker secara manual

## Sumber data

- XML: <https://poskobanjir.dsdadki.web.id/xmldata.xml>
- Situs sumber: <https://poskobanjir.dsdadki.web.id/>
- Selector stasiun: nama `NAMA_PINTU_AIR` yang mengandung `Angke Hulu`
- Hasil pemeriksaan saat ini: `P.S. Angke Hulu 1`

`ID_PINTU_AIR` dan `KODE_STASIUN` hanya dianggap metadata karena dapat berubah.

## Dokumentasi

- [Dokumentasi utama](./docs/README.md)
- [Dokumentasi data](./docs/data/README.md)
- [Konsep arsitektur](./docs/concepts/README.md)
- [Issues dan pertanyaan terbuka](./docs/issues/README.md)
- [Referensi Telegram Bot API lokal](./docs/telegram/api.md)

Rancangan utama mencakup command `/air`, `/ping`, `/start`, `/help`, command owner/admin `/system`, polling, Rich Message, cache, dan worker monitoring terpisah.

## Bun

Versi Bun project disimpan di [.bun-version](./.bun-version) dan saat ini bernilai `1.4.2`. Dockerfile membaca versi yang sama melalui build argument `BUN_VERSION`.

## Docker image

Dockerfile sudah disiapkan untuk skeleton aplikasi Bun berikutnya. Karena source aplikasi (`package.json`, lockfile, dan `src/`) belum dibuat, image belum dibuild pada tahap dokumentasi ini.

Untuk build lokal setelah source aplikasi tersedia:

```bash
docker build \
  --build-arg BUN_VERSION="$(tr -d '[:space:]' < .bun-version)" \
  -t monitoring-air-telegram-v2:local .
```

## GitHub Action

Workflow [`.github/workflows/docker-build.yml`](./.github/workflows/docker-build.yml) hanya berjalan manual melalui `workflow_dispatch`.

Di GitHub:

1. Buka tab **Actions**.
2. Pilih **Docker Build**.
3. Klik **Run workflow**.
4. Isi tag image.
5. Biarkan `push=false` untuk build tanpa publish, atau aktifkan `push=true` untuk publish ke GHCR.

Nama image mengikuti repository GitHub secara otomatis:

```text
ghcr.io/<owner>/<repository>:<tag>
```

Repository saat ini:

```text
github.com/banghasan/Monitoring-Air-Telegram-v2
```

Nama image GHCR yang digunakan:

```text
ghcr.io/banghasan/monitoring-air-telegram-v2:<tag>
```

Workflow tidak memiliki trigger `push` atau `pull_request`, sehingga build tidak berjalan otomatis.

Workflow memakai `${{ github.repository }}` dan menormalkan hasilnya menjadi lowercase sebelum dijadikan nama image.
