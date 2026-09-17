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

Konfigurasi memakai `chat_id` wajib dan `thread_id` optional. Adapter Telegram memvalidasi tipe target dan hanya mengirim field thread jika didukung.

## Validasi yang diperlukan

- cocokkan field dengan `sendRichMessage` pada `telegram/api.md`;
- uji satu group dengan topic;
- uji satu group tanpa topic;
- uji satu channel;
- pastikan kegagalan satu target tidak menghentikan target lain.
