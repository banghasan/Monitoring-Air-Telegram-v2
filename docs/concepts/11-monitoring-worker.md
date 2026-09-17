# Monitoring Worker

## Tujuan

Worker memeriksa XML secara berkala dan mengirim notifikasi ke target Telegram jika `STATUS_SIAGA` Angke Hulu berubah. Worker tidak menerima update Telegram dan tidak menjalankan polling.

## Service terpisah

Deployment Docker memiliki dua role:

```text
bot
├── Elysia HTTP server
├── grammY long polling
└── cache untuk command pengguna

monitor
├── scheduler interval
├── fetch dan parse XML
├── selector Angke Hulu
├── compare snapshot/state
└── kirim Rich Message ke target Telegram
```

Keduanya boleh menggunakan image yang sama, tetapi command/role container berbeda. Hanya satu instance `monitor` yang aktif pada deployment awal.

## Interval

Variable:

```dotenv
MONITOR_ENABLED=true
MONITOR_INTERVAL_SECONDS=60
```

Interval satu menit adalah nilai awal. Worker tidak boleh diasumsikan lebih real-time dari `TANGGAL` dan frekuensi update sumber XML.

Siklus worker:

1. tunggu initial delay bila diperlukan;
2. fetch XML dengan timeout;
3. cari record `NAMA_PINTU_AIR` yang mengandung `Angke Hulu`;
4. validasi jumlah hasil;
5. ambil field data TMA dan metadata;
6. bandingkan dengan state terakhir;
7. jika `MONITOR_DRY_RUN=true`, catat event simulasi tanpa memanggil Telegram;
8. jika ada perubahan relevan dan bukan dry-run, kirim notifikasi ke semua target secara independen;
9. simpan state global dan hasil per target, termasuk target yang masih pending;
10. tunggu interval berikutnya.

Perubahan status yang sama tidak boleh dikirim berulang hanya karena scheduler berjalan. Target yang gagal dapat dicoba kembali dengan retry terbatas atau pada siklus berikutnya, tanpa mengirim ulang target yang sudah sukses untuk event/fingerprint yang sama.

## Monitoring langsung bersama polling

Secara teknis worker dapat berjalan di process polling yang sama. Ini cocok untuk development atau satu container sederhana. Untuk Docker production, service terpisah menjadi keputusan utama agar restart bot, error polling, dan lifecycle monitoring tidak saling mengganggu.

Jika mode gabungan dipakai, harus ada satu flag role yang jelas. Bot tidak boleh menjalankan scheduler monitoring ketika service `monitor` aktif.

## State minimal

Worker memerlukan state minimal yang persistent, bukan histori penuh:

- fingerprint data terakhir yang sudah diproses;
- `TANGGAL` observasi terakhir;
- `TINGGI_AIR` terakhir;
- `TINGGI_AIR_SEBELUMNYA` terakhir;
- `STATUS_SIAGA` terakhir;
- waktu fetch terakhir;
- hasil pengiriman per target bila diperlukan untuk retry.

Keputusan MVP: gunakan SQLite melalui `bun:sqlite` pada named volume worker. File state atomik hanya fallback jika scope state tetap sangat kecil. Cache memory saja tidak cukup karena state hilang ketika container restart. Detail schema dan migration ada di [konsep SQLite](./18-sqlite-state-and-migrations.md).

Service `monitor` adalah pemilik database dan satu-satunya writer. Service `bot` tidak membuka file SQLite yang sama; informasi `/system` diperoleh melalui internal status endpoint monitor.

## Retry dan dry-run

Retry upstream dan Telegram dibatasi oleh environment. Retry hanya menangani kegagalan sementara; error konfigurasi, selector ambigu, atau status sumber kosong tidak boleh dipaksa menjadi notifikasi.

Dry-run tetap menjalankan selector, normalisasi, perbandingan status, pembuatan payload, dan structured logging. Dry-run tidak melakukan side effect ke Telegram. Baseline tetap disimpan agar mode ini dapat dipakai untuk memvalidasi deployment tanpa menghasilkan pesan.

## Health dan observability

Worker menyediakan `/health` untuk process hidup dan `/ready` untuk kesiapan konfigurasi/service. Kegagalan fetch, parsing, retry, target, dan perubahan status ditulis sebagai JSON ke console. Tidak ada notifikasi error terpisah ke group.

## Aturan satu worker

Jalankan satu worker per bot/source pada awalnya. Jika worker diperbanyak, setiap perubahan berpotensi dikirim berkali-kali kecuali ada distributed lock atau deduplication store bersama.
