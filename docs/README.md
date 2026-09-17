# Dokumentasi Bot Pemantauan Air

Implementasi bot Telegram pemantauan tinggi muka air Angke Hulu menggunakan Bun, Elysia, grammY, Telegram Rich Message, SQLite, Docker, dan Docker Compose.

## Status

MVP sudah diimplementasikan dan diverifikasi dengan unit test, integration test, type-check, lint, format-check, Compose config, serta Docker image smoke test.

## Keputusan utama

- Sumber XML: `https://poskobanjir.dsdadki.web.id/xmldata.xml`.
- Selector semantik: nama `NAMA_PINTU_AIR` yang mengandung `Angke Hulu`; ID dan kode hanya metadata.
- Saat validasi, terdapat satu record: `P.S. Angke Hulu 1`.
- `TINGGI_AIR` raw dibagi 10 untuk tampilan cm, tanpa menghilangkan tanda negatif.
- Status notifikasi hanya dipicu perubahan `STATUS_SIAGA`.
- Baseline pertama tidak dikirim sebagai notifikasi.
- Bot memakai polling pada deployment awal; webhook sudah disiapkan sebagai mode alternatif.
- Bot dan monitor berjalan sebagai service/container terpisah dari image yang sama.
- Monitor menyimpan state di `bun:sqlite`; bot membaca ringkasan melalui endpoint internal.
- Semua pesan bot dan notifikasi memakai Rich Message; Keterangan dan Legenda berada dalam satu summary collapsed; threshold memakai tabel; button berada di payload Rich Message.
- Log aplikasi berupa NDJSON di stdout/stderr.

## Navigasi

- [Scope dan command](./01-scope-and-commands.md)
- [Sumber data, selector, format, dan cache](./data/README.md)
- [Rich Message](./05-telegram-rich-message.md)
- [Polling dan webhook](./06-telegram-polling.md)
- [Environment](./07-environment-configuration.md)
- [Docker Compose](./08-docker-compose.md)
- [Owner/admin dan keamanan](./09-owner-admin-and-security.md)
- [Testing dan operasi](./10-testing-and-operations.md)
- [Contoh Compose memakai image GHCR](./deployment/01-compose-ghcr.md)
- [Konsep arsitektur](./concepts/README.md)
- [Issues dan resolusi](./issues/README.md)
- [Referensi Telegram Bot API lokal](./telegram/api.md)

## Struktur repository

```text
src/          aplikasi bot, worker, domain, adapter, dan HTTP
scripts/      version script
migrations/   migration SQLite
test/         fixture, unit test, dan integration test
docs/         keputusan, konsep, issue, dan referensi API Telegram
```

Detail keputusan sengaja dipisahkan dari issue agar perubahan perilaku mudah dilacak dan tidak bercampur dengan referensi Bot API.
