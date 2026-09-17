# Notifikasi Perubahan

## Pemicu notifikasi

Keputusan: worker hanya mengirim broadcast ketika `STATUS_SIAGA` berubah.

Worker tidak mengirim pesan hanya karena:

- `TINGGI_AIR` berubah tetapi status siaga tetap sama;
- `TINGGI_AIR_SEBELUMNYA` berubah;
- threshold `SIAGA1` sampai `SIAGA4` berubah tanpa perubahan status;
- `TANGGAL` berubah tetapi status tetap sama.

Perubahan tinggi air, arah, threshold, dan timestamp tetap ditampilkan oleh `/air` dan dapat dicatat untuk `/system`, tetapi bukan pemicu broadcast monitoring.

Perbandingan status memakai nilai yang sudah dinormalisasi untuk menghindari notifikasi palsu karena perbedaan spasi/huruf besar-kecil. Nilai asli `STATUS_SIAGA` tetap dipertahankan untuk tampilan pesan.

Jika status berubah, notifikasi dikirim walaupun perubahan tinggi air kecil. Jika status berubah kembali, misalnya `Normal → Siaga 3 → Normal`, setiap transisi adalah event baru.

## Perbandingan arah

Perubahan tinggi air mengikuti nilai mentah:

| Perbandingan | Label |
| --- | --- |
| current lebih besar | `📈 Naik` |
| current lebih kecil | `📉 Turun` |
| sama | `➡️ Tetap` |

Nilai negatif tetap dipertahankan. Arah tidak ditentukan dari emoji atau status siaga.

## Bentuk pesan

Notifikasi dikirim sebagai Rich Message:

```text
🔔 PEMBARUAN TINGGI MUKA AIR

📍 P.S. Angke Hulu 1
  ├ 🕒 <TANGGAL> WIB
  ├ 🌊 <TINGGI_AIR dalam cm> <📈 Naik / 📉 Turun / ➡️ Tetap>
  └ 🚦 Status: <STATUS_SIAGA>

📣 Perubahan status:
  └ <status lama> → <status baru>

🌊 Pembacaan saat perubahan:
  ├ Ketinggian: <TINGGI_AIR dalam cm>
  └ Arah: <📈 Naik / 📉 Turun / ➡️ Tetap>

▸ 📋 Keterangan
▸ 🧭 Legenda
```

Status siaga ditampilkan pada bagian utama, bukan hanya di dalam summary, karena merupakan informasi prioritas monitoring.

## Baseline pertama dan restart

Keputusan: pembacaan valid pertama hanya disimpan sebagai baseline dan tidak langsung dikirim ke semua target. Ini mencegah worker baru atau container restart mengirim notifikasi palsu.

Broadcast pertama dikirim ketika pembacaan berikutnya menunjukkan perubahan status. Jika state lama tidak tersedia, `/system` perlu menunjukkan bahwa worker sedang membuat baseline.

## Status sumber gagal

Jika fetch gagal:

- jangan mengirim notifikasi perubahan dari data yang tidak lengkap;
- simpan error dan waktu kegagalan;
- tampilkan status worker pada `/system`;
- gunakan retry pada siklus berikutnya;
- jangan mengirim pesan error ke semua target pada setiap menit.

Notifikasi error ke target tidak menjadi bagian dari pemicu status siaga dan tidak dikirim pada MVP. Detail error hanya tersedia pada log JSON dan `/system`.

## Target gagal

Kegagalan mengirim ke satu group/channel tidak boleh menghentikan pengiriman ke target lain. Worker mencatat hasil per target dan dapat retry pada siklus berikutnya tanpa mengirim ulang target yang sudah sukses untuk fingerprint yang sama.
