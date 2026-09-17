# Target Notifikasi Telegram

## Tujuan

MVP mengirim notifikasi perubahan ke satu atau lebih target Telegram. Target dapat berupa group forum dengan topic, channel, atau chat tanpa topic. Model konfigurasi berbentuk array dan setiap target diproses secara independen.

## Konfigurasi

Gunakan satu environment variable berbentuk JSON agar optional field tidak ambigu:

```dotenv
MONITOR_TARGETS_JSON='[{"chat_id":"-1004431127445","thread_id":5,"label":"Monitoring"},{"chat_id":"-1003861660503","label":"Channel"}]'
```

Model konfigurasi internal:

| Field | Wajib | Keterangan |
| --- | --- | --- |
| `chat_id` | Ya | Numeric chat ID atau username channel sesuai dukungan Bot API. |
| `thread_id` | Tidak | Topic/thread tujuan group forum. Hilangkan field ini untuk channel atau chat tanpa topic. |
| `label` | Tidak | Nama log agar target mudah dibedakan. |

Jika `thread_id` diisi, nilainya harus bilangan bulat positif dan dipetakan ke `message_thread_id` pada Rich Message. Jika field dihilangkan, adapter mengirim tanpa parameter thread sesuai schema pada [`telegram/api.md`](../telegram/api.md). Jangan mengirim `thread_id: 0` sebagai pengganti field yang tidak ada.

`chat_id` dapat berupa numeric chat ID atau username channel yang didukung Bot API. Label hanya untuk identifikasi manusia dan log.

## Tipe target

- Group forum dengan topic: gunakan `chat_id` dan `thread_id` positif.
- Channel atau group tanpa topic: gunakan `chat_id` tanpa `thread_id`.
- Beberapa target boleh dicampur dalam satu array.

Bot harus memiliki izin mengirim pesan pada setiap target. Kegagalan permission dicatat per target.

## Pengiriman

Untuk satu perubahan:

1. worker membuat satu payload Rich Message yang sama;
2. worker menerapkan tujuan `chat_id` dan `thread_id` masing-masing jika tersedia;
3. worker mengirim ke semua target;
4. hasil sukses/gagal dicatat berdasarkan target;
5. fingerprint perubahan mencegah broadcast duplikat.

Pengiriman boleh dibatasi concurrency-nya agar satu event tidak membebani Telegram API.

## Pesan manual owner/admin

`/notify <pesan>` memakai target yang sama dengan worker monitoring. Command ini berguna untuk menguji permission group/topic/channel dan menyampaikan informasi operasional tanpa memalsukan event perubahan status. Pengiriman dilakukan ke semua target yang dikonfigurasi, memakai `chat_id` serta `thread_id` jika tersedia, dan tidak mengubah delivery state atau baseline SQLite worker.

`/notifyair` juga memakai target yang sama, tetapi payload-nya adalah hasil `/air` dari cache/sumber saat command dijalankan. Payload ini dikirim sebagai Rich Message lengkap, bukan event perubahan status, sehingga tidak menyentuh baseline atau delivery state worker.

Kedua command hanya tersedia secara fungsional untuk `TELEGRAM_OWNER_ID` dan `TELEGRAM_ADMIN_IDS`. Kegagalan dicatat per target dalam log JSON dan diringkas pada `/system`; tidak ada broadcast error ke target monitor.

Pada `/start` dan `/help`, informasi ketiga command internal (`/system`, `/notify`, dan `/notifyair`) hanya muncul untuk user owner/admin. Menu command publik tetap tidak memuat command internal.

## `/system`

Owner/admin dapat melihat:

- jumlah target yang dikonfigurasi;
- label target;
- chat ID yang sudah dimasking bila perlu;
- thread ID jika target memilikinya;
- hasil pengiriman terakhir;
- error terakhir per target.

Token dan secret tidak pernah ditampilkan.
