# Organisasi Source Code

## Prinsip

Source code dipecah berdasarkan domain dan tanggung jawab, bukan berdasarkan ukuran file semata. Tujuannya agar alur XML, monitoring, Telegram, dan HTTP dapat dibaca serta diuji tanpa saling menempel.

Aturan utama:

- domain tidak mengimpor Elysia, grammY, Bun SQL, atau fetch langsung;
- handler Telegram tidak membaca XML langsung;
- worker tidak berisi aturan parsing XML dan format Rich Message sekaligus;
- adapter infrastructure boleh bergantung pada library, domain tidak;
- entrypoint hanya merakit dependency dan memilih role `bot` atau `monitor`;
- hindari import cycle;
- satu file boleh berisi beberapa fungsi kecil yang sangat erat, tetapi jangan membuat satu `index.ts` menjadi tempat seluruh aplikasi.

## Struktur yang direncanakan

```text
src/
├── app/
│   ├── commands/              # use case / application service
│   ├── monitoring/            # orchestration monitoring
│   └── water/                 # orchestration pembacaan data
├── domain/
│   ├── water/
│   │   ├── water-reading.ts
│   │   ├── station-selector.ts
│   │   ├── water-height.ts
│   │   ├── alert-status.ts
│   │   └── water-policy.ts
│   ├── monitoring/
│   │   ├── monitor-state.ts
│   │   └── notification-policy.ts
│   └── telegram/
│       └── notification-target.ts
├── infrastructure/
│   ├── source/
│   │   ├── water-source-client.ts
│   │   └── xml-water-parser.ts
│   ├── cache/
│   │   └── water-cache.ts
│   ├── state/
│   │   └── monitor-state-repository.ts
│   ├── telegram/
│   │   ├── telegram-bot.ts
│   │   ├── telegram-notifier.ts
│   │   └── rich-message-adapter.ts
│   └── logging/
│       └── structured-logger.ts
├── interfaces/
│   ├── http/
│   │   ├── health-routes.ts
│   │   └── webhook-route.ts
│   └── telegram/
│       ├── commands.ts
│       └── callbacks.ts
├── config/
│   └── config.ts
├── shared/
│   ├── clock.ts
│   ├── retry.ts
│   └── errors.ts
├── bot.ts                    # entrypoint role bot/polling
└── monitor.ts                # entrypoint role monitor

scripts/
└── version.ts

test/
├── fixtures/
├── helpers/
├── unit/
│   ├── domain/
│   ├── app/
│   └── infrastructure/
└── integration/
```

Nama folder boleh disesuaikan saat implementasi, tetapi batas domainnya harus dipertahankan. `src/bot.ts` dan `src/monitor.ts` dapat memakai image yang sama dengan command Docker berbeda.

## Tanggung jawab domain

### Domain water

Berisi tipe dan aturan murni: selector `Angke Hulu`, validasi jumlah record, transformasi `TINGGI_AIR` ke display cm, arah perubahan, threshold, dan status.

### Application

Mengatur use case seperti `getCurrentAir`, `refreshWaterSnapshot`, `runMonitorOnce`, `handleStatusTransition`, dan `getSystemInfo`. Layer ini menerima dependency melalui parameter/interface.

### Infrastructure

Mengimplementasikan HTTP fetch XML, parser XML, cache, SQLite/file state, grammY, Rich Message API, dan logger. Detail library tidak boleh bocor ke fungsi domain.

### Interfaces

Menghubungkan framework dengan application service: route Elysia, handler command grammY, callback button, polling, dan webhook.

## Testing mengikuti struktur

Test domain tidak membutuhkan network atau Telegram. Test infrastructure menggunakan fake dependency. Test application memakai dependency injection. Test interface memakai request/update sintetis. Struktur test mengikuti source agar lokasi test mudah ditemukan tanpa membuat test bergantung pada private implementation detail.

## Dependency direction

```text
interfaces → app → domain
     │         │
     └── infrastructure adapters
```

`domain` tidak mengarah kembali ke `interfaces` atau `infrastructure`. `shared` hanya berisi utilitas generik yang tidak mengetahui aturan bisnis.
