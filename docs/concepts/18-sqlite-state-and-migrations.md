# SQLite, State, dan Migration

## Jawaban singkat

Untuk kebutuhan MVP, tidak perlu ORM atau framework database. Gunakan driver SQLite bawaan Bun, `bun:sqlite`, lalu bungkus aksesnya dalam repository yang kecil dan teruji.

State yang disimpan hanya state operasional worker, bukan histori seluruh tinggi air. ORM akan menambah dependency dan abstraksi yang belum memberi manfaat sebanding dengan jumlah tabel yang sedikit.

Referensi resmi: [Bun SQLite](https://bun.com/docs/runtime/sqlite) dan [API `bun:sqlite`](https://bun.com/reference/bun/sqlite).

## Scope state

State minimum yang perlu bertahan setelah restart:

- snapshot status terakhir Angke Hulu;
- fingerprint event status;
- waktu fetch dan observasi terakhir;
- status worker dan error terakhir;
- hasil pengiriman per target;
- retry count, status pending, dan waktu retry berikutnya.

Jangan menyimpan histori tinggi air lengkap pada MVP. Jika histori dibutuhkan, itu menjadi fitur data terpisah dengan kebutuhan retention, indexing, dan backup yang berbeda.

## Keputusan penyimpanan MVP

- SQLite menjadi pilihan utama state worker.
- File JSON atomik hanya fallback jika state tetap sangat sederhana.
- Redis/PostgreSQL belum diperlukan.
- Hanya satu replica monitor yang diperbolehkan pada deployment awal.
- SQLite tidak digunakan sebagai mekanisme distributed lock antar-host.

Path database direncanakan melalui environment:

```dotenv
MONITOR_STATE_DB_PATH=/data/state/monitor.sqlite
```

Database berada pada named volume Docker, bukan di image, repository, atau filesystem sementara container.

## Keputusan akses lintas container

Service `monitor` menjadi pemilik database dan satu-satunya service yang membuka/menulis state. Service `bot` tidak membuka file SQLite yang sama secara langsung.

Jika `/system` membutuhkan detail worker, gunakan internal status endpoint pada jaringan Compose, misalnya:

```text
bot ── internal HTTP + service token ──> monitor
```

Endpoint internal hanya mengembalikan status operasional yang sudah dimasking. Jika monitor tidak dapat dihubungi, `/system` menampilkan status `unknown` dan error tersebut masuk log JSON; kondisi ini tidak menjadi broadcast Telegram.

Pendekatan ini menjaga pemisahan lifecycle container dan menghindari coupling filesystem antar-service. SQLite tetap dipakai oleh monitor untuk durability, bukan sebagai shared database API antar-container.

## Schema awal

Schema konseptual, bukan SQL final:

### `schema_migrations`

Mencatat migration yang sudah diterapkan.

| Kolom | Tujuan |
| --- | --- |
| `id` | Nomor migration monotonik. |
| `applied_at` | Waktu migration diterapkan. |

### `monitor_snapshot`

Satu baris untuk station yang dipantau.

| Kolom | Tujuan |
| --- | --- |
| `station_key` | Identity semantik, misalnya `angke-hulu`. |
| `source_name` | Nama record aktual dari XML. |
| `observed_at` | `TANGGAL` dari sumber. |
| `fetched_at` | Waktu aplikasi mengambil XML. |
| `height_raw` | `TINGGI_AIR` raw. |
| `previous_height_raw` | `TINGGI_AIR_SEBELUMNYA` raw. |
| `status_raw` | `STATUS_SIAGA` apa adanya. |
| `status_normalized` | Nilai untuk perbandingan event. |
| `fingerprint` | Deduplication event terakhir. |
| `last_error` | Error terakhir yang aman ditampilkan. |
| `updated_at` | Waktu state diperbarui. |

### `notification_delivery`

Mencatat pengiriman event per target agar retry tidak mengirim ulang target yang sudah sukses.

| Kolom | Tujuan |
| --- | --- |
| `event_id` | Identitas event status change. |
| `target_key` | Hash/label target yang tidak membocorkan token. |
| `state` | `pending`, `sent`, atau `failed`. |
| `attempt_count` | Jumlah percobaan. |
| `next_retry_at` | Jadwal retry berikutnya. |
| `last_error` | Error terakhir yang sudah disanitasi. |
| `sent_at` | Waktu sukses. |

Event delivery lama perlu dipangkas dengan retention sederhana. Database ini bukan histori tanpa batas.

## Migration

Migration dikelola sebagai file berurutan dan immutable:

```text
migrations/
├── 001_initial_state.sql
└── 002_add_delivery_retry.sql
```

Aturan:

- migration dijalankan sebelum worker mulai menerima siklus monitoring;
- migration gagal berarti worker tidak ready;
- migration yang sudah diterapkan tidak diedit, buat file nomor baru;
- perubahan schema diuji pada database kosong dan database versi sebelumnya;
- migration dijalankan di dalam transaksi jika memungkinkan;
- tidak ada migration otomatis dari command Telegram.

Untuk jumlah tabel ini, migration runner kecil di dalam repository cukup. Framework migration baru diperlukan jika schema dan deployment berkembang jauh lebih kompleks.

## Konfigurasi SQLite

Rancangan awal connection setup:

- prepared statement untuk query berulang;
- parameter binding, bukan string concatenation;
- `PRAGMA foreign_keys = ON`;
- WAL mode untuk pola satu writer dan pembacaan status;
- busy timeout terbatas;
- transaksi untuk perubahan snapshot dan delivery state yang harus konsisten;
- connection ditutup secara graceful saat shutdown.

Bun mendokumentasikan WAL untuk aplikasi tipikal dan menyediakan transaksi melalui `db.transaction()`. Jangan menjalankan query yang menunggu network di dalam transaksi SQLite.

## Backup dan pemulihan

State worker bukan data historis kritis, tetapi tetap perlu dipulihkan dengan benar:

- volume state jangan dihapus saat deploy biasa;
- backup dilakukan setelah checkpoint atau ketika monitor dihentikan secara graceful;
- file `-wal` dan `-shm` diperhitungkan jika masih ada;
- pemulihan diuji pada environment staging;
- jika state hilang, worker membuat baseline baru dan tidak mengirim baseline sebagai notifikasi.

## Kapan memakai ORM/framework

Pertimbangkan Drizzle atau framework database lain jika mulai ada:

- banyak tabel dan relasi;
- query lintas domain yang sering berubah;
- migration dan schema generation yang membutuhkan tooling bersama;
- histori dan agregasi data;
- subscription user atau konfigurasi target dinamis;
- kebutuhan pindah antara SQLite, PostgreSQL, dan database lain.

Untuk MVP, repository + SQL terparameterisasi + migration kecil lebih mudah diaudit dan lebih sesuai dengan scope.
