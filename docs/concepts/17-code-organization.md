# Organisasi Source Code

## Prinsip

Source code dipecah berdasarkan domain dan tanggung jawab. Tujuannya agar alur XML, monitoring, Telegram, dan HTTP dapat dibaca serta diuji tanpa saling menempel.

Aturan utama:

- domain tidak mengimpor Elysia, grammY, Bun SQL, atau fetch langsung;
- handler Telegram tidak membaca XML langsung;
- worker tidak berisi aturan parsing XML dan format Rich Message sekaligus;
- adapter infrastructure boleh bergantung pada library, domain tidak;
- entrypoint hanya merakit dependency dan memilih role `bot` atau `monitor`;
- hindari import cycle.

## Struktur aktual

```text
src/
├── app/
│   ├── bot/
│   │   ├── bot-runtime.ts
│   │   └── internal-status-client.ts
│   └── monitoring/
│       ├── monitor-runtime.ts
│       ├── monitor-service.ts
│       └── telegram-notification-sender.ts
├── config/
│   └── config.ts
├── domain/
│   ├── monitoring/
│   │   ├── notification-policy.ts
│   │   └── types.ts
│   └── water/
│       ├── types.ts
│       └── water-policy.ts
├── infrastructure/
│   ├── cache/water-cache.ts
│   ├── logging/structured-logger.ts
│   ├── retry/retry.ts
│   ├── source/xml-water-source.ts
│   ├── state/sqlite-state-repository.ts
│   └── telegram/telegram-client.ts
├── interfaces/
│   ├── http/runtime-server.ts
│   └── telegram/
│       ├── bot-handlers.ts
│       └── rich-message-builder.ts
├── bot.ts
├── index.ts
└── monitor.ts

scripts/
└── version.ts

migrations/
└── 001_initial_state.sql

test/
├── fixtures/
├── integration/
└── unit/
```

`src/bot.ts` dan `src/monitor.ts` memakai image yang sama dengan command Docker berbeda. `src/index.ts` menjadi router role untuk command default image.

## Tanggung jawab layer

### Domain

Berisi tipe dan aturan murni: selector semantik, transformasi `TINGGI_AIR` ke cm, arah perubahan, threshold, normalisasi status, dan kebijakan perubahan status.

### Application

Mengatur use case seperti pembacaan cache, siklus monitoring, retry delivery, dan pengambilan status internal. Dependency diterima melalui parameter/interface.

### Infrastructure

Mengimplementasikan HTTP fetch XML, parser, cache, SQLite, grammY, Rich Message transport, retry, dan logger. Detail library tidak boleh bocor ke aturan domain.

### Interfaces

Menghubungkan framework dengan application service: route Elysia, handler command grammY, callback button, polling, dan webhook.

## Dependency direction

```text
interfaces → app → domain
     │         │
     └── infrastructure adapters
```

`domain` tidak mengarah kembali ke `interfaces` atau `infrastructure`. Test mengikuti batas ini: domain memakai data in-memory, adapter memakai fake dependency, dan integration test menggabungkan komponen tanpa network live.
