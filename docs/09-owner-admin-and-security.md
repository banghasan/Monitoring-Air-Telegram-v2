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
- mode dry-run monitoring;
- jumlah target notifikasi serta hasil pengiriman terakhir per target;
- fingerprint/perubahan terakhir yang diproses;
- URL sumber tanpa token;
- selector `Angke Hulu`;
- nama record sumber yang ditemukan;
- ID/kode sumber sebagai metadata diagnostik;
- jumlah hasil pencarian station;
- penggunaan memory jika tersedia.
- ringkasan retry dan waktu error terakhir jika tersedia.

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
