# Testing dan Operasi

Dokumen ini adalah checklist operasional implementasi yang sudah tersedia. Test default tidak menghubungi Telegram atau XML live.

Aturan detail tentang fixture, isolasi unit test, `bun test`, lint, type-check, dan quality gate ada di [konsep Testing dan Quality Gate](./concepts/16-testing-and-quality.md). Dokumen ini mempertahankan checklist operasional tingkat aplikasi.

## Sumber data dan selector

- XML valid dan dapat diparse.
- Satu record `P.S. Angke Hulu 1` dipilih dari query `Angke Hulu`.
- ID/kode berubah tidak membuat selector gagal.
- Nol hasil menghasilkan status data tidak tersedia.
- Lebih dari satu hasil menghasilkan status ambigu.
- Record tanpa koordinat tidak menghasilkan inline link peta pada nama stasiun.

## Format nilai

- `TINGGI_AIR=-440` ditampilkan sebagai `-44 cm`, mengikuti website sumber.
- Raw value `-440` tetap tersedia untuk log/diagnostik.
- Tidak ada absolute value; tanda negatif dipertahankan.
- Status memakai `STATUS_SIAGA`.
- Arah membandingkan current dan previous.
- Nilai sama menghasilkan `➡️ Tetap`.
- Timestamp memakai `Asia/Jakarta`.

## Cache

- Snapshot fresh dipakai selama TTL.
- Refresh paralel tidak terjadi.
- Error upstream memakai snapshot stale sampai batas yang ditentukan.
- Setelah stale window lewat, bot tidak menyebut data sebagai terkini.
- Restart memulai cache dari kosong dan mengambil snapshot baru.

## Telegram Rich Message

- Semua command mengirim Rich Message.
- `📋 Keterangan & Legenda` berada dalam satu details collapsed.
- Waktu pengambilan aplikasi berada di dalam details, bukan di data utama.
- Threshold ditampilkan sebagai tabel Rich Message.
- Button refresh mencoba edit dahulu.
- Jika edit gagal/tidak didukung, fallback mengirim pesan baru.
- Nama stasiun menjadi inline link peta memakai koordinat record aktif jika tersedia.
- URL sumber dan URL peta tidak tampil sebagai teks mentah.
- Status utama hanya memakai emoji status, misalnya `🟢 Status : Normal`, tanpa emoji dekoratif tambahan.
- `/ping` menampilkan durasi proses.
- `/version`, `/ver`, dan `/versi` menampilkan versi aplikasi.
- `/start` dan `/help` menampilkan informasi pengembang serta button grup diskusi `@botindonesia`.

## Monitoring worker

- Worker dapat berjalan terpisah dari process polling.
- Interval worker mengikuti `MONITOR_INTERVAL_SECONDS`.
- Perubahan `TINGGI_AIR` menghasilkan arah `📈`, `📉`, atau `➡️`.
- Perubahan `STATUS_SIAGA` selalu diprioritaskan.
- Snapshot sama tidak mengirim pesan berulang.
- Worker gagal fetch tidak membroadcast error setiap interval.
- Retry upstream dan target berhenti setelah batas attempt.
- Dry-run tidak memanggil API Telegram tetapi tetap mencatat payload/event.
- Satu perubahan dikirim ke target MVP yang valid tanpa duplikasi.
- Kegagalan satu target tidak menghentikan target lain.
- Restart behavior mengikuti keputusan storage state worker.
- Database state memakai temporary SQLite per test dan tidak berbagi file antar test.
- Migration diuji pada database kosong dan database versi sebelumnya.

## Target Telegram

- Group dengan topic dapat memakai `thread_id`.
- MVP saat ini hanya menerima satu group forum dengan `thread_id` positif.
- Group tanpa topic dan channel belum menjadi target deployment MVP.
- Target invalid ditolak saat startup dan tidak boleh menjadi tujuan pengiriman.
- Model internal sudah berupa array agar multi-target dapat ditambahkan setelah validasi tipe target.

## Akses

- `/air`, `/ping`, `/start`, dan `/help` dapat digunakan publik.
- `/system` ditolak untuk user non-admin.
- Secret tidak muncul di response maupun log.

## Operasional

- Health check process tersedia.
- Polling hanya berjalan satu instance per token.
- Shutdown menghentikan polling dan scheduler.
- Error upstream terlihat pada log dan `/system`.
- Setiap event log valid sebagai JSON satu baris.
- `docker logs` dapat menampilkan error fetch dan target tanpa stack trace multiline yang merusak parser.
- Rotasi log Docker aktif dengan batas ukuran dan jumlah file.
- Cooldown command publik mencegah spam ringan.
- Tidak ada token, secret, atau XML penuh di log.
- Kegagalan tidak menghasilkan notifikasi broadcast.
