# Mode Telegram: Polling

## Keputusan

Deployment awal menggunakan long polling. Webhook juga tersedia sebagai mode alternatif yang dipilih dengan satu flag.

Konfigurasi awal:

```dotenv
TELEGRAM_WEBHOOK_ENABLED=false
```

## Perilaku polling

- process menjalankan loop update Telegram melalui grammY;
- tidak membutuhkan URL HTTPS publik untuk menerima update;
- satu token bot hanya dijalankan oleh satu instance polling;
- Elysia tetap dapat menyediakan health check dan endpoint operasional lokal;
- refresh XML berjalan sebagai service cache terpisah dari penerimaan update Telegram.

## Apakah monitoring bisa langsung berjalan bersama polling?

Bisa. Pada development atau deployment sederhana, scheduler monitoring dapat dijalankan dalam process yang sama setelah polling dimulai. Namun deployment yang disepakati untuk Docker memisahkan scheduler menjadi container/service `monitor`.

Alasannya:

- restart bot tidak ikut menghentikan monitoring;
- error polling tidak langsung mematikan pengiriman notifikasi;
- log dan health check bot/worker dapat dibedakan;
- worker dapat memakai interval dan retry yang berbeda;
- hanya satu worker yang bertanggung jawab mengirim notifikasi, sehingga lebih mudah mencegah duplikasi.

Konfigurasi role harus eksplisit. Bot polling tidak boleh sekaligus menyalakan worker monitoring jika service `monitor` juga aktif.

## Mode webhook opsional

Saat `TELEGRAM_WEBHOOK_ENABLED=true`, aplikasi memakai webhook dan tidak menjalankan polling. URL HTTPS serta secret header wajib dikonfigurasi. Saat `false`, aplikasi otomatis menghapus webhook Telegram lalu menjalankan polling.

Flag hanya menerima `true` atau `false`; typo ditolak saat startup agar tidak salah masuk ke mode polling. `TELEGRAM_MODE` tidak dipakai.

## Shutdown

Container perlu menghentikan polling dan scheduler secara graceful ketika menerima sinyal termination. Tujuannya menghindari proses ganda saat deployment melakukan restart.
