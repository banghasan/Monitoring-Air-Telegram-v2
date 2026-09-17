# Scope dan Command

Status: keputusan diimplementasikan.

## Tujuan

Bot Telegram bersifat publik dan menyediakan pemantauan satu lokasi: Angke Hulu. Pengguna umum dapat meminta data TMA, memeriksa respons bot, dan membaca bantuan. Owner/admin memiliki command tambahan untuk melihat informasi sistem dan mengirim test/informasi manual ke target monitor.

Semua pesan yang dikirim bot menggunakan Telegram Rich Message. Tidak ada penggunaan `sendMessage` biasa atau inline keyboard terpisah untuk alur utama.

## Command publik

| Command | Akses | Fungsi |
| --- | --- | --- |
| `/air` | Publik | Menampilkan data TMA Angke Hulu dalam Rich Message. |
| `/ping` | Publik | Menampilkan waktu respons request pengiriman ke Telegram dalam milidetik/detik. |
| `/version`, `/ver`, `/versi` | Publik | Menampilkan versi bot. Ketiganya memiliki respons yang sama. |
| `/start` | Publik | Menampilkan informasi awal bot dan bantuan singkat. |
| `/help` | Publik | Menampilkan daftar command dan bantuan bot. |

## Command owner/admin

| Command | Akses | Fungsi |
| --- | --- | --- |
| `/system` | Owner/admin | Menampilkan mode runtime, status cache, upstream, versi aplikasi/runtime, uptime, dan informasi operasional penting lainnya. |
| `/notify <pesan>` | Owner/admin | Mengirim pesan Rich Message manual ke semua target monitor pada `MONITOR_TARGETS_JSON`. |
| `/notifyair` | Owner/admin | Mengambil snapshot yang sama dengan `/air`, lalu mengirimkannya sebagai Rich Message ke semua target monitor. |

Command admin untuk mengubah konfigurasi atau force refresh belum ditetapkan dan tidak boleh ditambahkan diam-diam. `/notify` hanya mengirim pesan manual, sedangkan `/notifyair` membaca cache/sumber sesuai alur `/air`; keduanya tidak mengubah konfigurasi atau state worker. Ringkasan pengiriman terakhir tersedia di `/system` selama process bot belum restart.

## Tampilan `/air`

Struktur tampilan yang disepakati:

```text
🌊 PEMANTAUAN TINGGI MUKA AIR (TMA)

🌐 Sumber: [Posko Banjir DKI Jakarta](https://poskobanjir.dsdadki.web.id/)

📍 [P.S. Angke Hulu 1](https://www.google.com/maps?q=<latitude>,<longitude>)

    ├ 🕒 <tanggal pengamatan> WIB
    ├ <ikon arah> · Ketinggian: `<TINGGI_AIR raw / 10> cm`
    └ 🟢 <STATUS_SIAGA>

▸ 📋 Keterangan & Legenda

[🔄 Segarkan]
```

Nama sumber dan nama stasiun adalah inline link Rich Message; URL tidak ditampilkan sebagai teks mentah. Button peta tidak dibuat karena nama stasiun sudah membuka koordinat Google Maps. Emoji adalah bagian dari presentasi, bukan penentu status. Status tetap berasal dari field XML dan arah tetap dihitung dari dua nilai tinggi air. Nilai raw disimpan untuk diagnostik, sedangkan tampilan mengikuti website sumber (`TINGGI_AIR / 10` dalam cm).

Nilai tanggal dan waktu ditampilkan sebagai monospace tanpa kata `pukul`. Baris sumber diikuti dua line break agar terdapat satu baris kosong sebelum informasi stasiun.

## Tampilan arah perubahan

Perbandingan `TINGGI_AIR` dengan `TINGGI_AIR_SEBELUMNYA`:

| Kondisi numerik | Tampilan |
| --- | --- |
| Nilai sekarang lebih besar | `📈 Naik` |
| Nilai sekarang lebih kecil | `📉 Turun` |
| Nilai sama | `➡️ Tetap` |
| Salah satu nilai tidak valid | Arah tidak ditampilkan |

Perbandingan dilakukan pada nilai sumber. Nilai tidak dibuat absolut, tidak dibalik, dan tidak diubah untuk menghilangkan tanda negatif.

## `/ping`

`/ping` mengirim Rich Message PONG sementara, mengukur durasi request `sendRichMessage` sampai API Telegram mengembalikan pesan, lalu mengedit pesan tersebut dengan hasil pengukurannya. Jadi angka yang ditampilkan adalah waktu respons API Telegram dari sisi server bot, bukan waktu membangun payload, waktu pesan terlihat di perangkat pengguna, atau end-to-end latency jaringan pengguna.

Contoh:

```text
🏓 PONG

└ ⏱️ Waktu respons: 12.00 ms (0.0120 detik)
```

Pengukuran tidak perlu mengambil data air. Sebelum hasil tersedia, pesan memakai placeholder `Waktu respons: mengukur…`. Jika pesan tidak dapat diedit setelah request pengiriman berhasil, bot tidak menampilkan angka `0` atau angka perkiraan; kegagalan edit cukup dicatat pada log JSON.

## `/version`, `/ver`, `/versi`

Ketiga command adalah alias publik yang menampilkan versi aplikasi bot dalam Rich Message. Menu command Telegram juga didaftarkan saat bot mulai.

## Tampilan `/start` dan `/help`

Pesan pembuka menjelaskan fungsi bot, sumber data, daftar perintah, pengembang, serta menyediakan button Rich Message menuju grup diskusi Telegram `@botindonesia`. Informasi pengembang yang ditampilkan:

```text
Hasanudin H Syafaat
@hasanudinhs · banghasan.com
```

`@hasanudinhs` dan `banghasan.com` menjadi inline link. Button `💬 Grup Diskusi @botindonesia` membuka `https://t.me/botindonesia`.

Daftar command owner/admin (`/system`, `/notify <pesan>`, dan `/notifyair`) hanya ditambahkan ke `/start` atau `/help` jika `from.id` pengguna adalah owner/admin. User publik tetap melihat daftar command publik saja.

## Summary yang dapat dibuka

Bagian berikut berada dalam satu blok Rich Message yang collapsed secara default:

### 📋 Keterangan & Legenda

Berisi waktu pengambilan aplikasi dan tabel threshold siaga yang dibaca dari record sumber yang sedang terpilih. Isinya tidak ditulis sebagai angka hardcode di handler.

Format visual yang mengikuti web sumber:

| Status | Rentang TMA |
| --- | --- |
| 🔴 BAHAYA | > 300 cm |
| 🟡 SIAGA | 250–300 cm |
| 🔵 WASPADA | 150–250 cm |
| 🟢 Normal | < 150 cm |

Legenda ditampilkan di bawah tabel: `Legenda: 📈 naik · 📉 turun · ➡️ tetap`.

Jika data yang ditampilkan berasal dari cache lama, labelnya menjadi `📦 Data: cache (stale)` dan peringatan singkat tetap ditampilkan pada bagian utama.

## Tombol

- `🔄 Segarkan`: mencoba memperbarui pesan yang sama terlebih dahulu.

URL sumber dan URL Google Maps ditempelkan pada teks yang relevan sebagai inline link. Jika koordinat tidak tersedia, nama stasiun tetap tampil sebagai teks biasa.

Jika edit Rich Message tidak didukung oleh method atau library yang dipakai, `🔄 Segarkan` memakai fallback mengirim Rich Message baru.
