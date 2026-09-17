# Format Data TMA dan Aturan Tampilan

## Prinsip

XML adalah sumber data. Bot memetakan field yang diperlukan ke model internal, kemudian Rich Message memakai model tersebut. Handler Telegram tidak membaca XML secara langsung.

## Field yang dipakai

| Field XML | Pemakaian |
| --- | --- |
| `NAMA_PINTU_AIR` | Nama record sumber dan bahan pencarian `Angke Hulu`. |
| `LOKASI` | Metadata lokasi, bukan identity utama. |
| `LATITUDE`, `LONGITUDE` | URL Google Maps. |
| `TANGGAL` | Waktu pengamatan dari sumber. |
| `TINGGI_AIR` | Nilai raw ketinggian sekarang; disimpan dan dibandingkan dalam skala sumber. |
| `TINGGI_AIR_SEBELUMNYA` | Pembanding arah perubahan. |
| `STATUS_SIAGA` | Status utama yang ditampilkan ke pengguna. |
| `SIAGA1`, `SIAGA2`, `SIAGA3`, `SIAGA4` | Isi bagian `Keterangan`. |
| `ID_PINTU_AIR`, `KODE_STASIUN` | Metadata diagnostik yang boleh berubah. |

## Nilai tinggi air

Nilai raw tetap dipertahankan untuk log, perbandingan, dan troubleshooting. Untuk tampilan pengguna, ikuti transformasi yang terlihat pada website sumber:

```text
TINGGI_AIR_CM = TINGGI_AIR_RAW / 10
```

Contoh:

```text
TINGGI_AIR_RAW = -440
Tampilan pengguna = -44 cm
```

Tanda negatif dipertahankan. Nilai tidak dibuat absolut. Raw value tetap dapat ditampilkan pada `/system` bila diperlukan.

Jika hasil pembagian memiliki pecahan, tampilkan maksimal satu angka desimal dan hilangkan `.0` jika tidak diperlukan.

## Threshold siaga

Pada record Angke Hulu yang diperiksa, XML menyediakan:

| Field XML | Raw | Tampilan website |
| --- | ---: | --- |
| `SIAGA1` | `3000` | `> 300 cm (BAHAYA)` |
| `SIAGA2` | `2500` | `250–300 cm (SIAGA)` |
| `SIAGA3` | `1500` | `150–250 cm (WASPADA)` |
| di bawah `SIAGA3` | — | `< 150 cm (Normal)` |

Threshold ditampilkan dari record aktif, bukan angka hardcode. `SIAGA4=1` tersedia di XML, tetapi belum dipakai sebagai batas tampilan karena website menampilkan kondisi normal sebagai di bawah `150 cm`.

## Status

`STATUS_SIAGA` dari sumber adalah status utama, misalnya `Status : Normal`. Bot tidak menghitung ulang status bahaya dari angka tinggi air untuk menggantikan status sumber.

## Keterangan siaga

Bagian `📋 Keterangan` mengambil nilai `SIAGA1` sampai `SIAGA4` dari record yang sedang cocok. Dengan begitu, threshold mengikuti record sumber dan tidak tertinggal ketika sumber berubah.

Untuk keterbacaan di Telegram, gunakan legenda warna berikut tanpa mengubah label sumber:

```text
🔴 > 300 cm (BAHAYA)
🟡 250–300 cm (SIAGA)
🔵 150–250 cm (WASPADA)
🟢 < 150 cm (Normal)
```

Emoji hanya elemen visual. Penentuan status utama tetap memakai `STATUS_SIAGA` dari XML.

Label dan format harus disesuaikan dengan data yang benar-benar tersedia. Jika satuan atau skala threshold belum dapat dipastikan, tampilkan nilai sumber dan jangan mengklaim konversi cm.

## Arah perubahan

Jika kedua field dapat diparse sebagai angka:

- `TINGGI_AIR > TINGGI_AIR_SEBELUMNYA`: `📈 Naik`;
- `TINGGI_AIR < TINGGI_AIR_SEBELUMNYA`: `📉 Turun`;
- sama: `➡️ Tetap`.

Perbandingan raw dan perbandingan nilai cm menghasilkan arah yang sama. Jika salah satu field kosong, bukan angka, atau tidak tersedia, baris arah tidak dibuat. Bot tidak mengarang arah dari status siaga.

## Waktu

`TANGGAL` ditampilkan dalam zona waktu `Asia/Jakarta` dengan format yang mudah dibaca, misalnya:

```text
🕒 01 April 2026 pukul 18.15.00 WIB
```

Pesan juga perlu membedakan waktu pengamatan sumber dan waktu fetch aplikasi bila keduanya tersedia.
