# Rekomendasi Profesional Proyek

Dokumen ini berisi rekomendasi agar project tetap sederhana tetapi memiliki reliability, keamanan, dan operasional yang layak ketika dijalankan terus-menerus.

Status: **disetujui untuk MVP**.

## Reliability data

- Anggap XML sebagai upstream yang dapat berubah, lambat, kosong, atau ambigu.
- Selector selalu berdasarkan `Angke Hulu`, bukan ID/kode.
- Jika hasil selector nol atau lebih dari satu, fail closed dan jangan menebak.
- Tampilkan `TANGGAL` sumber dan `fetchedAt` aplikasi secara terpisah.
- Bedakan `fresh`, `stale`, dan `unavailable`.
- Status broadcast hanya berubah ketika `STATUS_SIAGA` berubah.
- Baseline pertama tidak dikirim sebagai notifikasi.
- Jangan membuat status siaga pengganti jika `STATUS_SIAGA` dari sumber tersedia.

## Reliability notifikasi

- Worker monitor terpisah dari bot polling.
- Satu replica monitor pada MVP.
- Gunakan event ID/fingerprint dan delivery state per target.
- Retry terbatas dengan backoff; jangan retry tanpa batas.
- Target sukses tidak dikirim ulang hanya karena target lain gagal.
- Kegagalan tidak dikirim sebagai broadcast error.
- Dry-run harus tersedia sebelum target produksi diaktifkan.

## Security

- Token Telegram dan secret hanya masuk melalui environment/secret store.
- Jangan mencetak token, authorization header, XML penuh, atau environment mentah ke log.
- Owner/admin berdasarkan Telegram numeric ID, bukan username.
- `/system` melakukan masking chat ID bila output berpotensi dibagikan.
- Command publik diberi cooldown ringan.
- Webhook masa depan memakai secret header dan HTTPS.
- Container dijalankan sebagai non-root bila kompatibel dengan volume state.
- Dependency dan Bun version dipin melalui lockfile serta `.bun-version`.

## Observability

- Semua log ke stdout/stderr dalam NDJSON.
- Gunakan event name stabil, `service`, `run_id`, durasi, dan status hasil.
- Sediakan `/health` untuk liveness dan `/ready` untuk readiness.
- `/system` menampilkan ringkasan yang aman untuk owner/admin.
- Docker logging diberi rotasi ukuran/jumlah file.
- Tambahkan metrics atau OpenTelemetry hanya ketika volume traffic membuat log tidak cukup.

## Operasional Docker

- Service `bot` dan `monitor` memakai image yang sama tetapi role berbeda.
- State SQLite berada pada named volume.
- `restart: unless-stopped` dipakai sebagai bantuan recovery process, bukan pengganti health check.
- Resource limit container ditetapkan setelah baseline penggunaan memory/CPU diketahui.
- Graceful shutdown menghentikan polling, scheduler, HTTP server, dan database connection.
- Build memakai `bun install --frozen-lockfile`.
- Quality gate dijalankan sebelum build image.
- Image tidak memuat `.env`, token, fixture rahasia, atau database production.

## Perubahan dan release

- Gunakan version script untuk bump patch/minor/major.
- Bump tidak otomatis commit, tag, push, atau publish.
- Setiap perubahan schema memakai migration baru.
- Setiap perubahan aturan notifikasi menambah atau mengubah test domain terkait.
- Changelog singkat direkomendasikan ketika mulai ada release publik.
- Rollback image harus dapat dilakukan dengan tag versi sebelumnya.

## Testing

- Default test tidak mengakses internet dan Telegram.
- Fixture XML mencakup zero/one/multiple match.
- Test worker menggunakan `runOnce`, fake clock, fake upstream, dan fake notifier.
- Test restart membaca state dari database temporary.
- Test concurrency tidak berbagi file state atau port.
- Test Rich Message memverifikasi details collapsed dan button berada di dalam rich payload.
- Test authorization memastikan `/system` tidak bocor ke user publik.

## Kesiapan produksi

Sebelum deployment produksi, checklist minimum:

- satu target group dan thread sudah diverifikasi;
- bot memiliki permission mengirim pada thread tersebut;
- `MONITOR_DRY_RUN` sudah diuji lalu dinonaktifkan dengan sengaja;
- `/system` dapat dijalankan owner/admin;
- health check Docker berfungsi;
- log JSON dapat dicari dari `docker logs`;
- volume state dan prosedur backup diketahui;
- rollback ke image sebelumnya dipahami;
- upstream failure dan Telegram failure sudah diuji tanpa broadcast error.
