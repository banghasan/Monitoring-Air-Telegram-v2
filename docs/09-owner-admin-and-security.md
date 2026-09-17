# Owner, Admin, dan Keamanan

## Model akses

Bot publik: command data dan bantuan dapat dipakai siapa saja.

Owner/admin: user tertentu yang dapat menjalankan command informasi sistem dan mengirim pesan manual ke target monitoring.

Identitas akses memakai Telegram `from.id`. Username tidak digunakan sebagai kunci karena dapat berubah.

## `/system`

`/system` hanya boleh dijawab untuk owner/admin dan dikirim sebagai Rich Message.

Informasi yang boleh ditampilkan:

- mode update aktif (`polling` atau `webhook`, diturunkan dari `TELEGRAM_WEBHOOK_ENABLED`);
- nama dan versi aplikasi;
- versi Bun/runtime jika tersedia;
- uptime process;
- status cache: kosong, fresh, atau stale;
- usia snapshot dan `TANGGAL` dari sumber;
- waktu fetch terakhir yang berhasil dan gagal;
- status worker monitoring dan interval aktif;
- mode dry-run monitoring;
- status internal endpoint monitor jika bot dan monitor berjalan sebagai service terpisah;
- jumlah target notifikasi serta hasil pengiriman terakhir per target;
- fingerprint/perubahan terakhir yang diproses;
- URL sumber tanpa token;
- selector `Angke Hulu`;
- nama record sumber yang ditemukan;
- ID/kode sumber sebagai metadata diagnostik;
- jumlah hasil pencarian station;
- penggunaan memory jika tersedia.
- ringkasan retry dan waktu error terakhir jika tersedia.
- ringkasan eksekusi `/notify` atau `/notifyair` terakhir selama process bot aktif.

Informasi yang tidak boleh ditampilkan:

- `TELEGRAM_BOT_TOKEN`;
- webhook secret;
- seluruh environment variable secara mentah;
- header authorization;
- XML penuh jika tidak diperlukan.

## Owner versus admin

- owner adalah administrator utama;
- admin dapat menjalankan command sistem yang sama jika terdaftar;
- owner/admin dapat memakai `/notify <pesan>` untuk test atau informasi manual ke target monitor;
- owner/admin dapat memakai `/notifyair` untuk mengirim snapshot yang sama dengan hasil `/air` ke target monitor;
- `/notify` tidak mengubah data sumber, konfigurasi, atau state worker;
- `/notifyair` menggunakan cache/sumber mengikuti alur `/air`, tetapi tidak mengubah baseline atau delivery state worker;
- command mutasi configuration belum disediakan.

## `/notify <pesan>`

Command ini hanya diproses jika `from.id` sesuai `TELEGRAM_OWNER_ID` atau salah satu ID pada `TELEGRAM_ADMIN_IDS`. Pesan dikirim sebagai Rich Message ke setiap target yang ada pada `MONITOR_TARGETS_JSON`, menggunakan `chat_id` dan `thread_id` target tersebut.

Contoh:

```text
/notify Uji notifikasi monitor dari owner
```

Pesan tujuan mencantumkan label `📣 PESAN MONITOR`, pengirim, waktu kirim dalam monospace, dan isi pesan. Bot mengirim konfirmasi Rich Message ke chat asal. Jika target kosong atau pengiriman gagal, pesan error tidak dikirim ke target monitor; detail kegagalan dicatat dalam log JSON dan ringkasan hasil terakhir tersedia melalui `/system`. Status ini hanya berada di memory process bot dan kembali kosong setelah restart.

Command ini sengaja tidak dimasukkan ke daftar command publik Telegram. User non-owner/admin tidak mendapat respons dan tidak menghasilkan pengiriman.

## `/notifyair`

Command ini memakai cache yang sama dengan `/air`, termasuk status `fresh`, `cache`, atau `stale`, lalu mengirim payload Rich Message `/air` ke setiap target pada `MONITOR_TARGETS_JSON`. Dengan begitu isi yang diterima group monitor sama dengan isi yang akan diterima pengguna ketika menjalankan `/air`, termasuk inline link, details, tabel, dan button refresh.

Contoh:

```text
/notifyair
```

Command ini juga hanya diproses untuk owner/admin dan tidak masuk menu command publik. Jika data tidak tersedia atau target gagal, bot tidak mengirim pesan error ke group monitor; kegagalan cukup dicatat pada log JSON dan dikonfirmasi di chat asal.

## Visibilitas command admin

`/start` dan `/help` selalu dapat dipakai publik, tetapi bagian `🔒 Perintah owner/admin` hanya ditambahkan ketika `from.id` adalah owner atau admin. Bagian tersebut berisi `/system`, `/notify <pesan>`, dan `/notifyair`. Menu command Telegram tetap hanya mendaftarkan command publik.

## Logging

Log ditulis ke stdout/stderr sebagai JSON satu object per baris (NDJSON) agar dapat dibaca langsung melalui `docker logs` dan diproses dengan `jq` atau log collector.

Field minimum yang disarankan:

```json
{
  "ts": "2026-09-17T12:00:00.000Z",
  "level": "info",
  "service": "monitor",
  "event": "monitor.status_changed",
  "message": "water status changed",
  "station_query": "Angke Hulu",
  "source_name": "P.S. Angke Hulu 1",
  "previous_status": "Status : Normal",
  "current_status": "Status : Siaga 3",
  "observed_at": "2026-09-17T18:00:00+07:00"
}
```

Event penting yang perlu dicatat:

- `app.start` dan `app.shutdown`;
- `config.validated` atau `config.invalid`;
- `source.fetch.start`, `source.fetch.success`, dan `source.fetch.error`;
- `station.match` atau `station.ambiguous`;
- `monitor.baseline`;
- `monitor.status_changed`;
- `notification.send.success` dan `notification.send.error` per target;
- `worker.retry`.

Log boleh mencatat error fetch, status HTTP, durasi, retry count, dan status parsing. Token, secret, authorization header, environment mentah, serta body XML penuh harus disensor/tidak dicatat.

Kegagalan upstream atau target Telegram tidak dikirim sebagai broadcast ke pengguna. Informasinya cukup ada di log JSON dan ringkasan `/system`.

Jika pencarian `Angke Hulu` menghasilkan lebih dari satu record, event tersebut menjadi warning penting dan dapat ditampilkan pada `/system`.

Command publik memakai cooldown ringan berbasis user/chat agar bot tidak mudah dibanjiri request. `/system` tetap hanya untuk owner/admin. Mode dry-run dan kegagalan pengiriman ditampilkan sebagai status operasional, bukan sebagai broadcast ke group.
