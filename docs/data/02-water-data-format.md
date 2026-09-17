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
| `TINGGI_AIR` | Ketinggian sekarang, ditampilkan mentah. |
| `TINGGI_AIR_SEBELUMNYA` | Pembanding arah perubahan. |
| `STATUS_SIAGA` | Status utama yang ditampilkan ke pengguna. |
| `SIAGA1`, `SIAGA2`, `SIAGA3`, `SIAGA4` | Isi bagian `Keterangan`. |
| `ID_PINTU_AIR`, `KODE_STASIUN` | Metadata diagnostik yang boleh berubah. |

## Nilai tinggi air

Keputusan yang berlaku:

- tampilkan nilai `TINGGI_AIR` apa adanya;
- pertahankan tanda negatif;
- jangan mengambil nilai absolut;
- jangan membagi, mengalikan, atau mengubah skala;
- jangan menambahkan satuan `cm` jika satuan dari sumber belum dipastikan.

Contoh tampilan jika sumber berisi `-440`:

```text
🌊 Ketinggian: -440
```

Ini sengaja berbeda dari contoh visual `42 cm`; contoh tersebut tidak boleh dijadikan transformasi otomatis.

## Status

`STATUS_SIAGA` dari sumber adalah status utama, misalnya `Status : Normal`. Bot tidak menghitung ulang status bahaya dari angka tinggi air untuk menggantikan status sumber.

## Keterangan siaga

Bagian `📋 Keterangan` mengambil nilai `SIAGA1` sampai `SIAGA4` dari record yang sedang cocok. Dengan begitu, threshold mengikuti record sumber dan tidak tertinggal ketika sumber berubah.

Label dan format harus disesuaikan dengan data yang benar-benar tersedia. Jika satuan atau skala threshold belum dapat dipastikan, tampilkan nilai sumber dan jangan mengklaim konversi cm.

## Arah perubahan

Jika kedua field dapat diparse sebagai angka:

- `TINGGI_AIR > TINGGI_AIR_SEBELUMNYA`: `📈 Naik`;
- `TINGGI_AIR < TINGGI_AIR_SEBELUMNYA`: `📉 Turun`;
- sama: `➡️ Tetap`.

Jika salah satu field kosong, bukan angka, atau tidak tersedia, baris arah tidak dibuat. Bot tidak mengarang arah dari status siaga.

## Waktu

`TANGGAL` ditampilkan dalam zona waktu `Asia/Jakarta` dengan format yang mudah dibaca, misalnya:

```text
🕒 01 April 2026 pukul 18.15.00 WIB
```

Pesan juga perlu membedakan waktu pengamatan sumber dan waktu fetch aplikasi bila keduanya tersedia.
