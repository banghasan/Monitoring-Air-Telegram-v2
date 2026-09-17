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

## Pesan manual owner/admin

`/notify <pesan>` memakai target yang sama dengan worker monitoring. Command ini berguna untuk menguji permission group/topic dan menyampaikan informasi operasional tanpa memalsukan event perubahan status. Pengiriman dilakukan ke semua target yang dikonfigurasi, memakai `chat_id` serta `thread_id` masing-masing, dan tidak mengubah delivery state atau baseline SQLite worker.

`/notifyair` juga memakai target yang sama, tetapi payload-nya adalah hasil `/air` dari cache/sumber saat command dijalankan. Payload ini dikirim sebagai Rich Message lengkap, bukan event perubahan status, sehingga tidak menyentuh baseline atau delivery state worker.

Kedua command hanya tersedia secara fungsional untuk `TELEGRAM_OWNER_ID` dan `TELEGRAM_ADMIN_IDS`. Kegagalan dicatat per target dalam log JSON dan diringkas pada `/system`; tidak ada broadcast error ke target monitor.

Pada `/start` dan `/help`, informasi ketiga command internal (`/system`, `/notify`, dan `/notifyair`) hanya muncul untuk user owner/admin. Menu command publik tetap tidak memuat command internal.

## `/system`

Owner/admin dapat melihat:

- jumlah target yang dikonfigurasi;
- label target;
- chat ID yang sudah dimasking bila perlu;
- thread ID;
- hasil pengiriman terakhir;
- error terakhir per target.

Token dan secret tidak pernah ditampilkan.
