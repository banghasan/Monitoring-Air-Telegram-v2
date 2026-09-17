# Scope dan Command

Status: keputusan diskusi.

## Tujuan

Bot Telegram bersifat publik dan menyediakan pemantauan satu lokasi: Angke Hulu. Pengguna umum dapat meminta data TMA, memeriksa respons bot, dan membaca bantuan. Owner/admin memiliki satu command tambahan untuk melihat informasi sistem dan bot.

Semua pesan yang dikirim bot menggunakan Telegram Rich Message. Tidak ada penggunaan `sendMessage` biasa atau inline keyboard terpisah untuk alur utama.

## Command publik

| Command | Akses | Fungsi |
| --- | --- | --- |
| `/air` | Publik | Menampilkan data TMA Angke Hulu dalam Rich Message. |
| `/ping` | Publik | Menampilkan respons bot dan waktu proses dalam milidetik/detik. |
| `/start` | Publik | Menampilkan informasi awal bot dan bantuan singkat. |
| `/help` | Publik | Menampilkan daftar command dan bantuan bot. |

## Command owner/admin

| Command | Akses | Fungsi |
| --- | --- | --- |
| `/system` | Owner/admin | Menampilkan mode runtime, status cache, upstream, versi aplikasi/runtime, uptime, dan informasi operasional penting lainnya. |

Command admin tambahan seperti force refresh belum ditetapkan dan tidak boleh ditambahkan diam-diam.

## Tampilan `/air`

Struktur tampilan yang disepakati:

```text
🌊 PEMANTAUAN TINGGI MUKA AIR (TMA)

🌐 Sumber: Posko Banjir DKI Jakarta
   https://poskobanjir.dsdadki.web.id/

📍 P.S. Angke Hulu (Baru)
   https://www.google.com/maps?q=<latitude>,<longitude>

  ├ 🕒 <tanggal pengamatan> WIB
  ├ 🌊 <ikon arah> Ketinggian: <TINGGI_AIR raw / 10> cm
  └ 🚦 Status: <STATUS_SIAGA>

▸ 📋 Keterangan
▸ 🧭 Legenda

[🔄 Segarkan] [🗺️ Buka Peta]
```

Emoji adalah bagian dari presentasi, bukan penentu status. Status tetap berasal dari field XML dan arah tetap dihitung dari dua nilai tinggi air. Nilai raw disimpan untuk diagnostik, sedangkan tampilan mengikuti website sumber (`TINGGI_AIR / 10` dalam cm).

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

`/ping` mengukur waktu proses aplikasi, bukan waktu pesan terlihat di perangkat pengguna dan bukan end-to-end latency jaringan pengguna.

Contoh:

```text
🏓 PONG

└ ⏱️ Waktu proses bot: 12 ms (0,012 detik)
```

Pengukuran tidak perlu mengambil data air. Tujuannya adalah mengetahui apakah process bot merespons.

## Summary yang dapat dibuka

Bagian berikut berada dalam blok Rich Message yang collapsed secara default:

### 📋 Keterangan

Berisi threshold siaga yang dibaca dari record sumber yang sedang terpilih. Isinya tidak ditulis sebagai angka hardcode di handler.

Format visual yang mengikuti web sumber:

```text
🔴 > 300 cm (BAHAYA)
🟡 250–300 cm (SIAGA)
🔵 150–250 cm (WASPADA)
🟢 < 150 cm (Normal)
```

### 🧭 Legenda

```text
📈 naik
📉 turun
➡️ tetap
```

## Tombol

- `🔄 Segarkan`: mencoba memperbarui pesan yang sama terlebih dahulu.
- `🗺️ Buka Peta`: membuka URL Google Maps dari koordinat record yang ditemukan.

Jika edit Rich Message tidak didukung oleh method atau library yang dipakai, `🔄 Segarkan` memakai fallback mengirim Rich Message baru.
