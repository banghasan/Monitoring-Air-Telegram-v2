# Telegram Rich Message

## Referensi

Struktur Rich Message mengikuti referensi lokal [Telegram Bot API](./telegram/api.md), terutama bagian:

- `InputRichMessage`;
- `sendRichMessage`;
- `InputRichBlockDetails`;
- `InputRichBlockButtons`;
- `RichMessageButton`;
- Rich text link dan blok Rich Message lainnya.

## Aturan pengiriman

Semua output bot menggunakan Rich Message:

- `/air` memakai Rich Message;
- `/ping` memakai Rich Message;
- `/start` dan `/help` memakai Rich Message;
- button diletakkan sebagai block/button Rich Message;
- tidak memakai `reply_markup` inline keyboard terpisah untuk UI utama.

Implementasi memakai grammY `1.46.0`, yang menyediakan type dan method Rich Message. Integrasi tetap diisolasi di [`src/infrastructure/telegram/telegram-client.ts`](../src/infrastructure/telegram/telegram-client.ts) agar handler tidak menyebarkan request raw Bot API.

## Struktur `/air`

Susunan logis:

1. heading `🌊 PEMANTAUAN TINGGI MUKA AIR (TMA)`;
2. link sumber Posko Banjir DKI Jakarta;
3. nama station aktual dari `NAMA_PINTU_AIR` dan link peta;
4. block data pengamatan;
5. `InputRichBlockDetails` untuk `📋 Keterangan`, collapsed;
6. `InputRichBlockDetails` untuk `🧭 Legenda`, collapsed;
7. `InputRichBlockButtons` berisi `🔄 Segarkan` dan `🗺️ Buka Peta` jika tersedia.

## Summary collapsed

`📋 Keterangan` dan `🧭 Legenda` bukan pesan terpisah dan bukan button toggle manual. Keduanya menjadi summary/details block dari Rich Message agar pengguna dapat membuka bagian yang diperlukan.

## Button refresh

Perilaku yang disepakati:

1. pengguna menekan `🔄 Segarkan`;
2. bot menjawab callback/action sesuai API Rich Message;
3. bot mengambil snapshot cache terbaru atau memicu refresh sesuai kebijakan cache;
4. bot mencoba mengedit pesan Rich Message yang sudah ada;
5. jika edit gagal, bot mengirim Rich Message baru;
6. kegagalan edit dan alasan fallback dicatat di log, bukan ditampilkan sebagai stack trace ke pengguna.

Adapter memanggil `bot.api.editMessageText(chatId, messageId, richMessage)`. GrammY meneruskan object tersebut sebagai field `rich_message` pada method `editMessageText`, sesuai referensi lokal. Dukungan ini dilindungi oleh unit test adapter dan fallback tetap aktif untuk error API, pesan hilang, atau thread tidak tersedia.

## Button peta

`🗺️ Buka Peta` memakai URL langsung yang dibentuk dari koordinat record. Jika koordinat tidak valid, button peta dihilangkan.

## Link dalam pesan

URL sumber dan URL peta dapat disajikan sebagai rich text link atau rich button sesuai kemampuan `InputRichMessage`. Satu URL tidak perlu diduplikasi jika sudah jelas dan mudah ditemukan.
