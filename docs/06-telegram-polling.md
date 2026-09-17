# Mode Telegram: Polling

## Keputusan

Deployment awal menggunakan long polling. Webhook sudah memiliki route dan konfigurasi, tetapi belum menjadi mode deployment default.

Konfigurasi awal:

```dotenv
TELEGRAM_MODE=polling
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

## Perpindahan mode di masa depan

Webhook boleh ditambahkan kemudian, tetapi mode tersebut harus eksklusif dengan polling. Saat berganti dari webhook ke polling, status webhook Telegram perlu ditangani agar update tidak diperebutkan oleh dua mekanisme.

Detail webhook, secret token, dan reverse proxy baru ditulis sebagai deployment lanjutan setelah polling stabil.

## Shutdown

Container perlu menghentikan polling dan scheduler secara graceful ketika menerima sinyal termination. Tujuannya menghindari proses ganda saat deployment melakukan restart.
