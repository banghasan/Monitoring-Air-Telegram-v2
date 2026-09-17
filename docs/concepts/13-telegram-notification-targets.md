# Target Notifikasi Telegram

## Tujuan

MVP mengirim notifikasi perubahan ke satu group forum dan satu thread/topic ID. Model konfigurasi tetap dibuat sebagai array agar perluasan ke beberapa target dapat dilakukan tanpa mengubah kontrak utama.

## Konfigurasi

Gunakan satu environment variable berbentuk JSON agar optional field tidak ambigu:

```dotenv
MONITOR_TARGETS_JSON=[{"chat_id":"-1001234567890","thread_id":42,"label":"Operasional"}]
```

Model konfigurasi internal:

| Field | Wajib | Keterangan |
| --- | --- | --- |
| `chat_id` | Ya | Numeric chat ID atau username channel sesuai dukungan Bot API. |
| `thread_id` | Ya untuk MVP | Topic/thread tujuan group forum. |
| `label` | Tidak | Nama log agar target mudah dibedakan. |

`thread_id` internal dipetakan ke parameter Telegram yang tepat berdasarkan schema pada [`telegram/api.md`](../telegram/api.md). Jangan mengasumsikan semua chat menerima thread ID.

Konfigurasi tanpa thread, channel, dan banyak target dicatat sebagai perluasan masa depan. Validasi field dan method pengiriman tetap menjadi [Issue 003](../issues/003-telegram-thread-targets.md) sampai diuji dengan versi grammY dan API yang dipilih.

## Tipe target

- Target MVP: group dengan forum/topic, gunakan `chat_id` dan `thread_id`.
- Group tanpa topic dan channel belum menjadi target deployment awal.
- Adapter tetap disiapkan agar tipe lain dapat divalidasi pada tahap berikutnya.

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
