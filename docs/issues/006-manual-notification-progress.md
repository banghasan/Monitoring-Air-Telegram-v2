# Issue 006 — Progres Command Notifikasi Manual

Status: **Resolved**

## Masalah

Konfirmasi `/notify` dan `/notifyair` sebelumnya hanya menampilkan ringkasan seperti `1/1 berhasil`. Ringkasan tersebut tidak menunjukkan target mana yang sedang diproses, ID chat tujuan, thread yang dipakai, atau alasan kegagalan tiap target.

## Keputusan

1. Setelah owner/admin menjalankan `/notify` atau `/notifyair`, bot lebih dahulu mengirim satu Rich Message ke chat asal.
2. Pesan awal menyatakan command akan dikirim ke berapa target dan menampilkan rincian setiap target dalam keadaan `Menunggu`, termasuk `chat_id` serta `thread_id` jika dikonfigurasi.
3. Pengiriman target berjalan berurutan. Sebelum target diproses, statusnya menjadi `Mengirim`; setelah selesai, statusnya menjadi `Berhasil` atau `Gagal`.
4. Bot mengedit pesan progres yang sama setelah perubahan status target dan mengeditnya lagi menjadi laporan final. Pesan baru tidak dibuat untuk laporan akhir jika edit berhasil.
5. Laporan final tetap memuat ringkasan jumlah berhasil/gagal, lalu rincian setiap target beserta status, ID chat, thread, dan error ringkas jika gagal.
6. Jika edit progres atau edit final gagal, pengiriman ke target tetap dilanjutkan. Bot mencoba mengirim laporan final Rich Message baru dan mencatat kegagalan edit pada log JSON.
7. `/notifyair` mengirim pesan progres sebelum mengambil data air. Jika data tidak tersedia, proses dibatalkan, target diberi status `Dilewati`, dan tidak ada pesan error yang dikirim ke target monitor.
8. Error target tidak dibroadcast ke target lain. Error lengkap tetap tersedia pada `docker logs`; laporan Telegram memakai pesan ringkas yang dibatasi panjangnya.

## Contoh alur

Pesan awal:

```text
📤 MENYIAPKAN PENGIRIMAN

🧭 Perintah: `/notifyair`
📨 `/notifyair` akan dikirim ke `2` target monitor.
🎯 Rincian target:
    ├ ⏳ Monitoring · Menunggu · chat_id: `-1004431127445` · thread_id: `5`
    └ ⏳ Channel · Menunggu · chat_id: `-1003861660503`
```

Pesan yang sama kemudian diedit menjadi laporan akhir, misalnya:

```text
⚠️ SEBAGIAN TERKIRIM

🧭 Perintah: `/notifyair`
📡 Hasil: `1/2` target berhasil · 1 gagal.
🎯 Rincian target:
    ├ ✅ Monitoring · Berhasil · chat_id: `-1004431127445` · thread_id: `5`
    └ ❌ Channel · Gagal · chat_id: `-1003861660503`
       └ Error: `chat not found`
```

## Dampak

- Tidak ada perubahan pada trigger monitoring, baseline, delivery state worker, atau retry target.
- Status progres hanya hidup selama eksekusi command dan tidak disimpan ke SQLite.
- `/system` tetap menampilkan ringkasan command manual terakhir selama process bot aktif.

## Referensi implementasi dan test

- Handler dan orkestrasi progres: `src/interfaces/telegram/bot-handlers.ts`.
- Payload Rich Message: `src/interfaces/telegram/rich-message-builder.ts`.
- Test handler: `test/unit/bot-handlers.test.ts`.
- Test payload: `test/unit/rich-message.test.ts`.
