# Bot Telegram Pemantauan Air

Dokumen ini adalah draft rancangan untuk bot Telegram yang membaca data tinggi muka air dari:

`https://poskobanjir.dsdadki.web.id/xmldata.xml`

Bot hanya memantau satu stasiun, yaitu `P.S. Angke Hulu 1`.

Status dokumen: **draft untuk diskusi**. Belum ada kode aplikasi yang dibuat.

## Daftar dokumentasi

Dokumen detail dipisahkan agar keputusan produk, sumber data, format pesan Telegram, operasi, dan deployment tidak tercampur:

- [Scope dan command](./01-scope-and-commands.md)
- [Dokumentasi data](./data/README.md)
- [Telegram Rich Message](./05-telegram-rich-message.md)
- [Mode polling](./06-telegram-polling.md)
- [Environment configuration](./07-environment-configuration.md)
- [Docker Compose](./08-docker-compose.md)
- [Owner, admin, dan keamanan](./09-owner-admin-and-security.md)
- [Testing dan operasi](./10-testing-and-operations.md)

Dokumen `telegram/api.md` adalah salinan referensi Bot API yang menjadi acuan struktur Rich Message.

## Struktur konsep dan issue

Dokumentasi dipisahkan berdasarkan tingkat kepastian:

- [`concepts/`](./concepts/): konsep dan keputusan arsitektur yang menjadi dasar implementasi.
- [`issues/`](./issues/): pertanyaan terbuka, risiko kompatibilitas, dan hal yang perlu divalidasi.
- [`telegram/api.md`](./telegram/api.md): referensi Bot API lokal, bukan dokumen keputusan aplikasi.

Detail monitoring ada di [konsep monitoring worker](./concepts/11-monitoring-worker.md), sedangkan risiko dan pertanyaan terbukanya dicatat di [issues](./issues/README.md).

## Keputusan terbaru

- Stasiun dipilih berdasarkan nama yang mengandung `Angke Hulu`, bukan `ID_PINTU_AIR` atau `KODE_STASIUN`.
- XML saat ini memiliki satu record yang cocok: `P.S. Angke Hulu 1`.
- Bot publik memiliki owner/admin untuk command informasi sistem.
- Semua pengiriman pesan menggunakan Rich Message; button juga berada di dalam Rich Message.
- Tombol `Segarkan` mencoba mengedit pesan terlebih dahulu. Jika tidak didukung atau gagal, perilaku fallback akan mengirim pesan Rich Message baru.
- Semua deployment dimulai dari polling.
- `TINGGI_AIR` ditampilkan apa adanya dari sumber, termasuk tanda negatif; tidak dilakukan normalisasi nilai.
- Deployment monitoring menggunakan worker terpisah dari bot polling.
- Worker menjalankan pemeriksaan dengan interval yang dapat diatur melalui environment, default 60 detik.
- Worker hanya mengirim notifikasi jika `STATUS_SIAGA` berubah, dengan informasi status siaga sebagai bagian utama.
- Notifikasi dapat diarahkan ke banyak group/channel dan optional thread ID.
- Log aplikasi ditulis ke console dalam format JSON satu object per baris agar mudah dibaca melalui `docker logs`.

## 1. Tujuan MVP

Bot diharapkan dapat:

- menerima perintah Telegram untuk melihat kondisi terbaru stasiun Angke Hulu;
- mengambil data XML dari sumber resmi yang dikonfigurasi lewat environment variable;
- menyimpan satu snapshot data di cache memory aplikasi;
- menjalankan worker monitoring dengan interval yang dapat diatur;
- mengirim notifikasi Rich Message ketika `STATUS_SIAGA` berubah;
- mengirim notifikasi ke beberapa group/channel dan optional thread ID;
- berjalan dengan mode Telegram **polling** atau **webhook**;
- dijalankan sebagai satu container Docker melalui Docker Compose;
- tidak menyimpan token Telegram atau secret ke dalam image Docker maupun repository.

Di luar MVP:

- histori data permanen;
- grafik historis;
- pemantauan banyak stasiun;
- Redis atau database eksternal.

Fitur-fitur tersebut dapat ditambahkan setelah alur pembacaan data dasar stabil.

## 2. Hasil pemeriksaan sumber data

Pada snapshot yang diperiksa saat penyusunan dokumen, record yang dicari muncul sebagai:

| Field | Nilai |
| --- | --- |
| `ID_PINTU_AIR` | `158` |
| `KODE_STASIUN` | `32` |
| `NAMA_PINTU_AIR` | `P.S. Angke Hulu 1` |
| `LOKASI` | `Angke` |
| `LATITUDE` | `-6.218026` |
| `LONGITUDE` | `106.694077` |
| `TINGGI_AIR` | `-440` |
| `TINGGI_AIR_SEBELUMNYA` | `-439` |
| `STATUS_SIAGA` | `Status : Normal` |
| `TANGGAL` | timestamp observasi dari sumber |

Untuk kebutuhan aplikasi, record dipilih berdasarkan nama yang mengandung `Angke Hulu`. `ID_PINTU_AIR` dan `KODE_STASIUN` hanya metadata karena nilainya dapat berubah pada sumber. Saat pemeriksaan terakhir, hanya ada satu nama yang cocok: `P.S. Angke Hulu 1`.

Jika hasil pencarian menjadi nol, bot melaporkan data tidak tersedia. Jika hasilnya lebih dari satu, bot tidak memilih secara diam-diam; kondisi tersebut dianggap ambigu dan perlu dilaporkan ke owner/admin.

Respons HTTP sumber saat diperiksa juga menyediakan `Last-Modified` dan `ETag`. Keduanya boleh dipakai sebagai optimasi conditional request pada tahap berikutnya, tetapi freshness yang ditampilkan ke pengguna tetap harus ditentukan dari `TANGGAL`, `fetchedAt`, dan batas usia cache aplikasi.

Nilai `TINGGI_AIR` dan ambang `SIAGA1` sampai `SIAGA4` belum boleh diasumsikan satuannya atau dihitung ulang oleh bot. Untuk MVP, tampilkan nilai mentah dan gunakan `STATUS_SIAGA` dari sumber sebagai status utama. Konfirmasi satuan dan aturan ambang dapat menjadi keputusan terpisah.

## 3. Rekomendasi cache

Rekomendasi awal:

| Parameter | Nilai awal | Alasan |
| --- | ---: | --- |
| `CACHE_TTL_SECONDS` | `60` | Respons Telegram tidak perlu memicu request upstream berulang dalam satu menit. |
| `CACHE_REFRESH_SECONDS` | `60` | Menjaga snapshot tetap hangat walaupun belum ada perintah masuk. |
| `UPSTREAM_TIMEOUT_SECONDS` | `5` | Request yang macet tidak boleh menahan bot terlalu lama. |
| `STALE_IF_ERROR_SECONDS` | `900` | Saat sumber gagal, data terakhir masih dapat ditampilkan dengan label stale selama 15 menit. |
| `MAX_DATA_AGE_SECONDS` | `600` | Setelah 10 menit, data tidak lagi ditampilkan sebagai kondisi terkini tanpa peringatan kuat. |

Alur cache yang diusulkan:

1. Saat aplikasi start, ambil satu snapshot awal.
2. Jalankan refresh terjadwal setiap 60 detik.
3. Jika snapshot masih dalam TTL, handler Telegram langsung menggunakan cache.
4. Jika refresh gagal, gunakan snapshot terakhir sampai batas `STALE_IF_ERROR_SECONDS` dan tampilkan waktu `TANGGAL` sumber serta waktu pengambilan aplikasi.
5. Jika melewati batas stale, jawab bahwa data sumber tidak tersedia atau sudah kedaluwarsa; jangan menyamarkannya sebagai data real-time.

TTL satu menit adalah kompromi awal, bukan jaminan bahwa data berubah setiap menit. Endpoint sumber sendiri yang menentukan seberapa baru data sebenarnya. Karena air dapat berubah cepat, pesan bot wajib menyertakan sekurang-kurangnya:

- `TANGGAL` dari XML;
- waktu `fetchedAt` dari aplikasi;
- status apakah data `fresh` atau `stale`.

Cache ini cukup memakai memory proses untuk satu replica. Jika nanti aplikasi dijalankan lebih dari satu replica, cache memory akan berbeda antar-container dan perlu dipindahkan ke Redis atau storage bersama.

## 4. Arsitektur yang diusulkan

```text
Telegram
   |
   | polling atau POST webhook
   v
grammY bot handlers
   |
   v
Water service / in-memory cache
   |
   | refresh tiap 60 detik, timeout 5 detik
   v
XML source: poskobanjir.dsdadki.web.id
```

Komponen aplikasi:

- **Elysia**: HTTP server, health check, dan endpoint webhook.
- **grammY**: menerima update Telegram dan mengirim pesan.
- **Water service**: fetch XML, parsing, pencarian nama yang mengandung `Angke Hulu`, pemetaan field, dan cache.
- **Config module**: membaca environment variable, memberi default, dan memvalidasi nilai wajib.
- **Scheduler sederhana**: refresh cache pada service bot untuk kebutuhan data on-demand.
- **Monitoring worker**: service terpisah untuk memeriksa perubahan dan mengirim notifikasi.

Respons domain yang sebaiknya dipakai oleh handler, terlepas dari format XML:

```ts
type WaterReading = {
  stationId: number
  stationCode: string
  stationName: string
  location: string
  height: number | null
  previousHeight: number | null
  status: string
  observedAt: string
  fetchedAt: string
  freshness: 'fresh' | 'stale'
}
```

Dengan normalisasi ini, handler Telegram tidak perlu mengetahui struktur XML dan bisa diuji tanpa network.

## 5. Perintah Telegram

Nama perintah masih bisa didiskusikan. Usulan minimal:

| Perintah | Perilaku |
| --- | --- |
| `/air` | Menampilkan pembacaan terbaru Angke Hulu dalam Rich Message. |
| `/ping` | Menampilkan respons bot dan waktu proses dalam milidetik/detik. |
| `/start` | Menampilkan informasi awal bot dan bantuan singkat. |
| `/help` | Menampilkan daftar command dan bantuan bot. |
| `/system` | Menampilkan informasi runtime, cache, dan monitoring untuk owner/admin. |

Contoh isi `/air`:

```text
P.S. Angke Hulu 1
Status: Status : Normal
Ketinggian: -440 (nilai mentah dari sumber)
Sebelumnya: -439
Waktu pengamatan: 17 Sep 2026 13:50 WIB
Diambil aplikasi: 17 Sep 2026 13:51 WIB
Data: fresh
Sumber: Posko Banjir DKI
```

Jika `freshness=stale`, pesan harus memuat peringatan yang terlihat, misalnya `PERINGATAN: sumber sedang gagal diakses; ini adalah data terakhir yang berhasil diambil.`

Semua contoh respons di atas akan dikirim sebagai Rich Message. Bagian `Keterangan` dan `Legenda` direncanakan sebagai summary yang dapat dibuka/tutup.

## 6. Mode Telegram: polling dan webhook

### Polling

Polling adalah default yang paling mudah untuk development atau server yang tidak mempunyai URL HTTPS publik.

- aplikasi menjalankan `bot.start()`;
- tidak perlu membuka route webhook ke internet;
- tidak perlu reverse proxy untuk menerima update Telegram;
- saat berpindah dari webhook ke polling, webhook Telegram perlu dihapus terlebih dahulu;
- hanya boleh ada satu instance polling untuk token bot yang sama.

### Webhook

Webhook cocok untuk deployment production yang mempunyai domain HTTPS publik.

- Elysia menyediakan route `POST /telegram/webhook`;
- route meneruskan request ke `webhookCallback(bot, 'bun')` dari grammY;
- aplikasi tidak memanggil `bot.start()` pada mode ini;
- Telegram diarahkan ke URL webhook melalui `setWebhook`;
- gunakan `TELEGRAM_WEBHOOK_SECRET` dan validasi secret header Telegram;
- handler harus cepat, karena request webhook dapat dikirim ulang jika Telegram tidak menerima respons tepat waktu.

Mode dipilih melalui `TELEGRAM_MODE=polling|webhook`. Jangan menjalankan polling dan webhook bersamaan pada satu process.

Semua tahap awal menggunakan `polling`. Dukungan webhook tetap didokumentasikan sebagai opsi masa depan setelah domain HTTPS, reverse proxy, dan mekanisme deployment siap.

## 7. Environment variable

Nama berikut adalah usulan awal untuk `.env.example`:

```dotenv
# Runtime
NODE_ENV=development
PORT=3000
LOG_LEVEL=info

# Telegram
TELEGRAM_BOT_TOKEN=replace-me
TELEGRAM_MODE=polling
TELEGRAM_WEBHOOK_URL=https://bot.example.com/telegram/webhook
TELEGRAM_WEBHOOK_SECRET=replace-with-random-secret

# Optional access control; empty means no allowlist
# Public bot: kosong berarti command publik tidak dibatasi.
TELEGRAM_OWNER_ID=
TELEGRAM_ADMIN_IDS=

# Upstream source
WATER_SOURCE_URL=https://poskobanjir.dsdadki.web.id/xmldata.xml
WATER_STATION_QUERY=Angke Hulu
WATER_STATION_DISPLAY_NAME=P.S. Angke Hulu (Baru)

# Cache and network
CACHE_TTL_SECONDS=60
CACHE_REFRESH_SECONDS=60
STALE_IF_ERROR_SECONDS=900
MAX_DATA_AGE_SECONDS=600
UPSTREAM_TIMEOUT_SECONDS=5

# Monitoring worker
MONITOR_ENABLED=true
MONITOR_INTERVAL_SECONDS=60
MONITOR_TARGETS_JSON=[]
```

Catatan konfigurasi:

- `TELEGRAM_BOT_TOKEN` wajib dan tidak boleh masuk ke image atau log.
- `TELEGRAM_MODE=webhook` wajib memiliki `TELEGRAM_WEBHOOK_URL` dan secret.
- Bot bersifat publik. `TELEGRAM_OWNER_ID` dan `TELEGRAM_ADMIN_IDS` hanya menentukan akses ke command informasi sistem/admin.
- Status worker, interval, fetch terakhir, dan ringkasan target notifikasi dapat dilihat owner/admin melalui `/system`.
- Kegagalan upstream dan target tidak dikirim sebagai notifikasi; detailnya tersedia di log JSON dan ringkasan `/system`.
- `WATER_STATION_QUERY` menjadi selector utama dan dicocokkan pada `NAMA_PINTU_AIR` setelah normalisasi.
- `WATER_STATION_DISPLAY_NAME` hanya untuk tampilan pengguna; selector tetap `Angke Hulu`.
- nilai duration perlu divalidasi sebagai integer positif saat startup.
- nilai secret jangan diberi default di production.

Bun dapat membaca `.env` secara otomatis saat development. Di container production, environment sebaiknya disuntikkan oleh Docker Compose melalui `env_file`, bukan disalin ke image.

## 8. Docker dan Docker Compose

Rancangan deployment:

```text
Dockerfile
docker-compose.yml
.env.example
.dockerignore
src/
docs/
```

Prinsip Dockerfile:

- gunakan multi-stage build;
- install dependency dari lockfile;
- runtime image hanya membawa hasil dan dependency yang diperlukan;
- jalankan process non-root jika image final mendukungnya;
- expose port aplikasi;
- tambahkan health check terhadap endpoint `/health`.

Prinsip `docker-compose.yml`:

```yaml
services:
  bot:
    build:
      context: .
      dockerfile: Dockerfile
    env_file:
      - .env
    ports:
      - "3000:3000"
    restart: unless-stopped
```

File `.env` berisi secret lokal atau production dan harus masuk `.gitignore`. File `.env.example` berisi nama variable serta contoh aman dan boleh di-commit.

Deployment monitoring menambahkan service `monitor` dengan image yang sama, tetapi menjalankan worker dan tidak menjalankan polling. Detailnya ada di [Docker Compose](./08-docker-compose.md).

Untuk webhook, port container tidak otomatis menjadi URL publik. Tetap diperlukan domain HTTPS/reverse proxy atau platform yang meneruskan HTTPS ke port container.

## 9. Health check dan observability minimum

Endpoint yang disarankan:

- `GET /health` mengembalikan status proses hidup;
- `GET /ready` mengembalikan ready setelah konfigurasi valid dan, bila diwajibkan, snapshot awal berhasil;
- `GET /metrics` belum wajib untuk MVP.

Log terstruktur minimal mencatat:

- mode Telegram yang aktif;
- keberhasilan atau kegagalan refresh upstream;
- durasi fetch upstream;
- `TANGGAL` data sumber;
- usia cache;
- error parsing XML tanpa mencetak token Telegram.

Jika sumber gagal, log boleh memuat URL dan HTTP status, tetapi jangan mencetak body XML penuh jika tidak diperlukan.

## 10. Keamanan dan reliability

- Token bot dan webhook secret hanya berasal dari environment.
- Route webhook harus memvalidasi secret Telegram.
- Bot publik tidak memakai allowlist chat; pembatasan hanya diterapkan pada command owner/admin.
- Gunakan timeout untuk fetch upstream.
- Hindari request upstream untuk setiap pesan Telegram.
- Cegah refresh paralel dengan lock/promise bersama.
- Perlakukan XML yang tidak lengkap, record tidak ditemukan, nilai numerik kosong, dan status HTTP non-2xx sebagai error yang dapat ditangani.
- Jangan mengubah `TINGGI_AIR` menjadi kesimpulan bahaya tanpa definisi satuan dan aturan ambang yang telah dikonfirmasi.
- Saat cache stale, labeli hasilnya secara eksplisit.
- Semua log console memakai JSON per baris dan tidak boleh memuat token/secret/XML penuh.

## 11. Keputusan yang sudah ditetapkan

1. Bot bersifat publik dan memiliki owner/admin.
2. Selector stasiun adalah nama yang mengandung `Angke Hulu`.
3. ID dan kode stasiun tidak digunakan sebagai kunci permanen.
4. Semua pesan memakai Rich Message, termasuk button dan blok summary.
5. Tombol refresh mencoba edit pesan terlebih dahulu, lalu fallback mengirim pesan baru.
6. Deployment dimulai dengan polling.
7. `TINGGI_AIR` ditampilkan mentah dari sumber.
8. Cache menggunakan TTL awal 60 detik dan stale fallback 15 menit.
9. Notifikasi hanya dipicu perubahan `STATUS_SIAGA`.
10. Baseline pertama tidak dikirim sebagai notifikasi.
11. Worker monitoring menggunakan state persistent lokal dan hanya satu replica pada deployment awal.
12. Kegagalan upstream/target hanya dicatat di log dan `/system`, tanpa notifikasi broadcast.
13. Log console menggunakan format JSON per baris.

Hal yang masih terbuka adalah command admin tambahan selain `/system`, format persis field Rich Message mengikuti referensi lokal, serta detail dukungan thread dan method edit Rich Message.

## 12. Tahap implementasi setelah rancangan disepakati

1. Buat skeleton Bun + TypeScript + Elysia + grammY.
2. Buat config loader dan `.env.example`.
3. Implementasikan XML fetcher, parser, pencarian nama stasiun, dan normalisasi `WaterReading`.
4. Implementasikan cache dengan TTL, stale fallback, timeout, dan refresh lock.
5. Tambahkan handler `/air`, `/ping`, `/start`, `/help`, dan `/system` dengan pemeriksaan role.
6. Tambahkan mode polling dan route webhook.
7. Tambahkan worker monitoring dan routing notifikasi ke banyak target.
8. Tambahkan unit test parser, selector stasiun, cache expiry, deduplication worker, dan fallback stale.
9. Tambahkan Dockerfile, Compose, health check, serta dokumentasi menjalankan development dan production.

## Referensi

- [XML sumber Posko Banjir DKI](https://poskobanjir.dsdadki.web.id/xmldata.xml)
- [grammY: long polling vs webhook](https://grammy.dev/guide/deployment-types)
- [grammY: deployment checklist](https://grammy.dev/advanced/deployment)
- [Bun: environment variables](https://bun.sh/docs/runtime/environment-variables)
- [Elysia: routing](https://elysiajs.com/essential/route)
