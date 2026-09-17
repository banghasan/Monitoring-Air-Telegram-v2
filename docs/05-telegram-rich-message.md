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
- `/version`, `/ver`, dan `/versi` memakai Rich Message;
- `/start` dan `/help` menyertakan informasi pengembang serta button Rich Message grup diskusi;
- `/start` dan `/help` memakai Rich Message;
- button diletakkan sebagai block/button Rich Message;
- tidak memakai `reply_markup` inline keyboard terpisah untuk UI utama.

Implementasi memakai grammY `1.46.0`, yang menyediakan type dan method Rich Message. Integrasi tetap diisolasi di [`src/infrastructure/telegram/telegram-client.ts`](../src/infrastructure/telegram/telegram-client.ts) agar handler tidak menyebarkan request raw Bot API.

## Struktur `/air`

Susunan logis:

1. heading `🌊 PEMANTAUAN TINGGI MUKA AIR (TMA)`;
2. inline link sumber pada teks `Posko Banjir DKI Jakarta`;
3. nama station aktual dari `NAMA_PINTU_AIR` sebagai inline link ke peta jika koordinat tersedia;
4. block data pengamatan;
5. satu `InputRichBlockDetails` dengan summary `📋 Keterangan & Legenda`, collapsed;
6. waktu pengambilan aplikasi, `InputRichBlockTable` untuk threshold, dan paragraph legenda di dalam details;
7. `InputRichBlockButtons` berisi `🔄 Segarkan`.

## Summary collapsed

`📋 Keterangan & Legenda` bukan pesan terpisah dan bukan button toggle manual. Keduanya menjadi satu summary/details block dari Rich Message agar pengguna dapat membuka informasi tambahan dalam satu tindakan. Waktu pengambilan aplikasi berada di dalam details agar tidak mengulang informasi waktu pengamatan pada bagian utama.

Threshold ditampilkan menggunakan tabel dua kolom (`Status` dan `Batas TMA`) dengan nilai yang dibaca dari record aktif. Legenda arah ditampilkan sebagai paragraph setelah tabel.

## Button refresh

Perilaku yang disepakati:

1. pengguna menekan `🔄 Segarkan`;
2. bot menjawab callback/action sesuai API Rich Message;
3. bot mengambil snapshot cache terbaru atau memicu refresh sesuai kebijakan cache;
4. bot mencoba mengedit pesan Rich Message yang sudah ada;
5. jika edit gagal, bot mengirim Rich Message baru;
6. kegagalan edit dan alasan fallback dicatat di log, bukan ditampilkan sebagai stack trace ke pengguna.

Adapter memanggil `bot.api.editMessageText(chatId, messageId, richMessage)`. GrammY meneruskan object tersebut sebagai field `rich_message` pada method `editMessageText`, sesuai referensi lokal. Dukungan ini dilindungi oleh unit test adapter dan fallback tetap aktif untuk error API, pesan hilang, atau thread tidak tersedia.

## Link dalam pesan

URL sumber dan URL peta disajikan sebagai `RichTextUrl` pada teks yang relevan. URL tidak dicetak sebagai teks mentah dan tidak diduplikasi menjadi button peta. Jika koordinat tidak valid, nama stasiun tetap ditampilkan tanpa link.

Link sumber mengarah ke halaman utama Posko Banjir DKI Jakarta (`https://poskobanjir.dsdadki.web.id/`), bukan endpoint XML. Nilai tanggal dan waktu menggunakan `RichTextCode`/monospace dan format `17 September 2026 18.35.00 WIB` tanpa kata `pukul`.
