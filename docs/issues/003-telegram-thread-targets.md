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

MVP memakai satu group forum dengan `chat_id` dan `thread_id` wajib. Model konfigurasi tetap berupa array agar multi-target dapat ditambahkan kemudian. Adapter Telegram harus memvalidasi tipe target dan mengirim field thread sesuai method Rich Message yang benar.

## Validasi

- `sendRichMessage` pada referensi lokal memakai field `message_thread_id`;
- konfigurasi internal memakai `thread_id` dan adapter memetakannya ke field API tersebut;
- unit test adapter memastikan `{ chatId, threadId }` menjadi `sendRichMessage(chatId, richMessage, { message_thread_id: threadId })`;
- konfigurasi production monitor menolak jumlah target selain satu pada MVP, tetapi state delivery disimpan per target untuk perluasan berikutnya;
- kegagalan delivery dicatat per target dan tidak menjadi broadcast error.

Validasi permission aktual pada group/forum tetap harus dilakukan operator saat deployment karena tidak dapat diuji tanpa credential dan target Telegram nyata.
