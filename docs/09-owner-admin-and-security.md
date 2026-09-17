# Owner, Admin, dan Keamanan

## Model akses

Bot publik: command data dan bantuan dapat dipakai siapa saja.

Owner/admin: user tertentu yang dapat menjalankan command informasi sistem.

Identitas akses memakai Telegram `from.id`. Username tidak digunakan sebagai kunci karena dapat berubah.

## `/system`

`/system` hanya boleh dijawab untuk owner/admin dan dikirim sebagai Rich Message.

Informasi yang boleh ditampilkan:

- mode update aktif: `polling`;
- nama dan versi aplikasi;
- versi Bun/runtime jika tersedia;
- uptime process;
- status cache: kosong, fresh, atau stale;
- usia snapshot dan `TANGGAL` dari sumber;
- waktu fetch terakhir yang berhasil dan gagal;
- status worker monitoring dan interval aktif;
- jumlah target notifikasi serta hasil pengiriman terakhir per target;
- fingerprint/perubahan terakhir yang diproses;
- URL sumber tanpa token;
- selector `Angke Hulu`;
- nama record sumber yang ditemukan;
- ID/kode sumber sebagai metadata diagnostik;
- jumlah hasil pencarian station;
- penggunaan memory jika tersedia.

Informasi yang tidak boleh ditampilkan:

- `TELEGRAM_BOT_TOKEN`;
- webhook secret;
- seluruh environment variable secara mentah;
- header authorization;
- XML penuh jika tidak diperlukan.

## Owner versus admin

- owner adalah administrator utama;
- admin dapat menjalankan command sistem yang sama jika terdaftar;
- owner/admin tidak mengubah data sumber melalui bot pada MVP;
- command mutasi configuration belum disediakan.

## Logging

Log boleh mencatat error fetch, status HTTP, durasi, dan status parsing. Token, secret, dan isi sensitif harus disensor.

Jika pencarian `Angke Hulu` menghasilkan lebih dari satu record, event tersebut menjadi warning penting dan dapat ditampilkan pada `/system`.
