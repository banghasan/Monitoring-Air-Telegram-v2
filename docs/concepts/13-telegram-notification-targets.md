# Target Notifikasi Telegram

## Tujuan

Satu worker dapat mengirim notifikasi perubahan ke beberapa group dan channel. Setiap target dikonfigurasi secara terpisah, termasuk optional thread/topic ID.

## Konfigurasi

Gunakan satu environment variable berbentuk JSON agar optional field tidak ambigu:

```dotenv
MONITOR_TARGETS_JSON=[{"chat_id":"-1001234567890","thread_id":42,"label":"Operasional"},{"chat_id":"@contoh_channel","label":"Channel publik"}]
```

Model konfigurasi internal:

| Field | Wajib | Keterangan |
| --- | --- | --- |
| `chat_id` | Ya | Numeric chat ID atau username channel sesuai dukungan Bot API. |
| `thread_id` | Tidak | Topic/thread tujuan bila chat mendukungnya. |
| `label` | Tidak | Nama log agar target mudah dibedakan. |

`thread_id` internal dipetakan ke parameter Telegram yang tepat berdasarkan schema pada [`telegram/api.md`](../telegram/api.md). Jangan mengasumsikan semua chat menerima thread ID.

## Tipe target

- Group dengan forum/topic: gunakan `chat_id` dan `thread_id`.
- Group tanpa topic: gunakan `chat_id` tanpa `thread_id`.
- Channel: gunakan `chat_id`; thread hanya dipakai jika API dan konfigurasi channel mendukungnya.

Bot harus memiliki izin mengirim pesan pada setiap target. Kegagalan permission dicatat per target.

## Pengiriman

Untuk satu perubahan:

1. worker membuat satu payload Rich Message yang sama;
2. worker menerapkan tujuan `chat_id` dan `thread_id` masing-masing;
3. worker mengirim ke semua target;
4. hasil sukses/gagal dicatat berdasarkan target;
5. fingerprint perubahan mencegah broadcast duplikat.

Pengiriman boleh dibatasi concurrency-nya agar satu event tidak membebani Telegram API.

## `/system`

Owner/admin dapat melihat:

- jumlah target yang dikonfigurasi;
- label target;
- chat ID yang sudah dimasking bila perlu;
- thread ID;
- hasil pengiriman terakhir;
- error terakhir per target.

Token dan secret tidak pernah ditampilkan.
