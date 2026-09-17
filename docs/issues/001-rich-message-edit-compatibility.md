# Issue 001 — Rich Message Edit Compatibility

Status: **Open**

## Pertanyaan

Apakah Bot API lokal dan versi grammY yang dipakai dapat mengedit pesan Rich Message dengan struktur block/details/buttons yang sama?

## Dampak

Button `🔄 Segarkan` sudah diputuskan mencoba edit pesan terlebih dahulu. Jika method edit tidak mendukung Rich Message, bot perlu mengirim pesan baru sebagai fallback.

## Batasan keputusan

- Jangan menganggap `editMessageText` otomatis menerima `InputRichMessage`.
- Verifikasi method edit berdasarkan `telegram/api.md` dan type/runtime grammY yang dipakai.
- Fallback tidak boleh menghasilkan pesan text biasa; tetap gunakan Rich Message.

## Resolusi yang diharapkan

Dokumentasikan method edit yang dipilih, payload minimal, dan perilaku ketika message/thread sudah tidak tersedia.
