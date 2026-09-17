# Notifikasi Perubahan

## Kapan mengirim

Worker tidak mengirim pesan setiap kali interval selesai. Worker mengirim hanya jika terjadi perubahan relevan sejak state terakhir.

Perubahan relevan meliputi:

- `TINGGI_AIR` berubah;
- `TINGGI_AIR_SEBELUMNYA` berubah;
- `STATUS_SIAGA` berubah;
- threshold `SIAGA1` sampai `SIAGA4` berubah;
- record sumber yang terpilih berubah;
- source observation baru memiliki perubahan nilai yang perlu diinformasikan.

`STATUS_SIAGA` adalah perubahan paling penting. Jika status berubah, notifikasi harus tetap dikirim walaupun perubahan tinggi air kecil.

Jika hanya `TANGGAL` berubah tetapi seluruh nilai penting sama, default-nya tidak mengirim broadcast baru; kondisi tersebut cukup dicatat sebagai observation update. Keputusan ini mencegah group menerima pesan yang sama setiap refresh sumber.

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

📍 P.S. Angke Hulu (Baru)
  ├ 🕒 <TANGGAL> WIB
  ├ 🌊 <TINGGI_AIR mentah> <📈 Naik / 📉 Turun / ➡️ Tetap>
  └ 🚦 Status: <STATUS_SIAGA>

📣 Perubahan:
  ├ <nilai sebelumnya → nilai sekarang>
  └ <status lama → status baru bila berubah>

▸ 📋 Keterangan
▸ 🧭 Legenda
```

Status siaga ditampilkan pada bagian utama, bukan hanya di dalam summary, karena merupakan informasi prioritas monitoring.

## Status sumber gagal

Jika fetch gagal:

- jangan mengirim notifikasi perubahan dari data yang tidak lengkap;
- simpan error dan waktu kegagalan;
- tampilkan status worker pada `/system`;
- gunakan retry pada siklus berikutnya;
- jangan mengirim pesan error ke semua target pada setiap menit.

Notifikasi error ke target dapat ditambahkan kemudian dengan deduplication dan cooldown terpisah.

## Target gagal

Kegagalan mengirim ke satu group/channel tidak boleh menghentikan pengiriman ke target lain. Worker mencatat hasil per target dan dapat retry pada siklus berikutnya tanpa mengirim ulang target yang sudah sukses untuk fingerprint yang sama.
