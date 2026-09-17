# Testing dan Operasi

Dokumen ini mendefinisikan checklist yang harus dipenuhi saat implementasi nanti. Tidak ada kode atau test yang dijalankan pada tahap diskusi ini.

## Sumber data dan selector

- XML valid dan dapat diparse.
- Satu record `P.S. Angke Hulu 1` dipilih dari query `Angke Hulu`.
- ID/kode berubah tidak membuat selector gagal.
- Nol hasil menghasilkan status data tidak tersedia.
- Lebih dari satu hasil menghasilkan status ambigu.
- Record tanpa koordinat tidak menghasilkan button peta.

## Format nilai

- `TINGGI_AIR=-440` tetap ditampilkan sebagai `-440`.
- Tidak ada absolute value atau transformasi skala.
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
- `📋 Keterangan` dan `🧭 Legenda` collapsed.
- Button refresh mencoba edit dahulu.
- Jika edit gagal/tidak didukung, fallback mengirim pesan baru.
- Button peta memakai koordinat record aktif.
- `/ping` menampilkan durasi proses.

## Monitoring worker

- Worker dapat berjalan terpisah dari process polling.
- Interval worker mengikuti `MONITOR_INTERVAL_SECONDS`.
- Perubahan `TINGGI_AIR` menghasilkan arah `📈`, `📉`, atau `➡️`.
- Perubahan `STATUS_SIAGA` selalu diprioritaskan.
- Snapshot sama tidak mengirim pesan berulang.
- Worker gagal fetch tidak membroadcast error setiap interval.
- Satu perubahan dikirim ke seluruh target yang valid.
- Kegagalan satu target tidak menghentikan target lain.
- Restart behavior mengikuti keputusan storage state worker.

## Target Telegram

- Group dengan topic dapat memakai `thread_id`.
- Group tanpa topic tidak memakai `thread_id`.
- Channel diuji dengan konfigurasi tanpa thread terlebih dahulu.
- Target invalid dilaporkan di log dan `/system`.

## Akses

- `/air`, `/ping`, `/start`, dan `/help` dapat digunakan publik.
- `/system` ditolak untuk user non-admin.
- Secret tidak muncul di response maupun log.

## Operasional

- Health check process tersedia.
- Polling hanya berjalan satu instance per token.
- Shutdown menghentikan polling dan scheduler.
- Error upstream terlihat pada log dan `/system`.
