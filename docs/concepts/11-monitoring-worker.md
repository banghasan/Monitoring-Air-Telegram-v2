# Monitoring Worker

## Tujuan

Worker memeriksa XML secara berkala dan mengirim notifikasi ke target Telegram jika ada perubahan data Angke Hulu. Worker tidak menerima update Telegram dan tidak menjalankan polling.

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
7. jika ada perubahan relevan, kirim notifikasi ke semua target;
8. simpan state setelah hasil pengiriman diproses;
9. tunggu interval berikutnya.

## Monitoring langsung bersama polling

Secara teknis worker dapat berjalan di process polling yang sama. Ini cocok untuk development atau satu container sederhana. Untuk Docker production, service terpisah menjadi keputusan utama agar restart bot, error polling, dan lifecycle monitoring tidak saling mengganggu.

Jika mode gabungan dipakai, harus ada satu flag role yang jelas. Bot tidak boleh menjalankan scheduler monitoring ketika service `monitor` aktif.

## State minimal

Worker memerlukan state minimal, bukan histori penuh:

- fingerprint data terakhir yang sudah diproses;
- `TANGGAL` observasi terakhir;
- `TINGGI_AIR` terakhir;
- `TINGGI_AIR_SEBELUMNYA` terakhir;
- `STATUS_SIAGA` terakhir;
- waktu fetch terakhir;
- hasil pengiriman per target bila diperlukan untuk retry.

Cache memory saja cukup untuk satu process yang tidak pernah restart. Untuk notification reliability, state minimal perlu storage yang bertahan melewati restart.

## Aturan satu worker

Jalankan satu worker per bot/source pada awalnya. Jika worker diperbanyak, setiap perubahan berpotensi dikirim berkali-kali kecuali ada distributed lock atau deduplication store bersama.
