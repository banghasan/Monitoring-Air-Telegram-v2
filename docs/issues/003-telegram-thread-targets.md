# Issue 003 — Thread dan Tipe Target Telegram

Status: **Resolved**

## Pertanyaan

Bagaimana parameter thread/topic dipetakan untuk group forum dan channel berdasarkan method Rich Message pada API lokal?

## Risiko

- Tidak semua group memiliki forum topic.
- Channel tidak selalu memiliki konsep thread seperti supergroup forum.
- Field internal `thread_id` mungkin memiliki nama berbeda pada Bot API.
- Permission bot dapat berbeda antar target.

## Keputusan dan implementasi

MVP sekarang mendukung satu atau lebih target berupa group forum, channel, atau chat tanpa topic. `thread_id` bersifat opsional: group forum dapat mengisinya dengan bilangan bulat positif, sedangkan channel menghilangkan field tersebut. Adapter Telegram hanya mengirim field thread jika nilainya tersedia.

## Validasi

- `sendRichMessage` pada referensi lokal memakai field `message_thread_id`;
- konfigurasi internal memakai `thread_id` opsional dan adapter memetakannya ke `message_thread_id` hanya jika ada;
- unit test adapter memastikan target group mengirim `{ message_thread_id: threadId }` dan target tanpa thread mengirim `{}`;
- konfigurasi production monitor membutuhkan minimal satu target, dan tidak membatasi jumlah target;
- state SQLite menyimpan delivery per target, termasuk channel tanpa thread;
- migration `002_nullable_thread_id.sql` mempertahankan delivery lama sekaligus mengizinkan thread kosong;
- kegagalan delivery dicatat per target dan tidak menjadi broadcast error.

Validasi permission aktual pada group/channel/forum tetap harus dilakukan operator saat deployment karena tidak dapat diuji tanpa credential dan target Telegram nyata.
