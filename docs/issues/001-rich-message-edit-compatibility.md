# Issue 001 — Rich Message Edit Compatibility

Status: **Resolved**

## Pertanyaan

Apakah Bot API lokal dan versi grammY yang dipakai dapat mengedit pesan Rich Message dengan struktur block/details/buttons yang sama?

## Dampak

Button `🔄 Segarkan` sudah diputuskan mencoba edit pesan terlebih dahulu. Jika method edit tidak mendukung Rich Message, bot perlu mengirim pesan baru sebagai fallback.

## Batasan keputusan

- Jangan menganggap `editMessageText` otomatis menerima `InputRichMessage`.
- Verifikasi method edit berdasarkan `telegram/api.md` dan type/runtime grammY yang dipakai.
- Fallback tidak boleh menghasilkan pesan text biasa; tetap gunakan Rich Message.

## Resolusi

Dependency grammY dipin pada `1.46.0`. Adapter memanggil:

```ts
bot.api.editMessageText(chatId, messageId, richMessage)
```

grammY memetakan object `richMessage` menjadi field `rich_message` Bot API. Payload yang diedit sama dengan payload `sendRichMessage`, termasuk block `details` dan `buttons`.

Jika edit gagal karena kompatibilitas API, pesan/thread sudah tidak tersedia, atau Telegram menolak edit, adapter mencatat fallback lalu mengirim Rich Message baru ke chat yang sama. Tidak ada fallback ke text message biasa. Mapping ini dilindungi unit test adapter.
