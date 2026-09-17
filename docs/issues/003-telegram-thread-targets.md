# Issue 003 — Thread dan Tipe Target Telegram

Status: **Open**

## Pertanyaan

Bagaimana parameter thread/topic dipetakan untuk group forum dan channel berdasarkan method Rich Message pada API lokal?

## Risiko

- Tidak semua group memiliki forum topic.
- Channel tidak selalu memiliki konsep thread seperti supergroup forum.
- Field internal `thread_id` mungkin memiliki nama berbeda pada Bot API.
- Permission bot dapat berbeda antar target.

## Keputusan sementara

MVP memakai satu group forum dengan `chat_id` dan `thread_id` wajib. Model konfigurasi tetap berupa array agar multi-target dapat ditambahkan kemudian. Adapter Telegram harus memvalidasi tipe target dan mengirim field thread sesuai method Rich Message yang benar.

## Validasi yang diperlukan

- cocokkan field dengan `sendRichMessage` pada `telegram/api.md`;
- uji satu group dengan topic yang menjadi target MVP;
- pastikan `thread_id` diteruskan ke field API yang benar;
- simulasikan target tanpa thread dan tipe channel sebagai validasi perluasan masa depan;
- pastikan kegagalan satu target tidak menghentikan target lain.
