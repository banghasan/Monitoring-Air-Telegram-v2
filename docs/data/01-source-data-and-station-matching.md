# Sumber Data dan Pencarian Angke Hulu

## Sumber

URL XML:

`https://poskobanjir.dsdadki.web.id/xmldata.xml`

Situs sumber untuk ditampilkan kepada pengguna:

`https://poskobanjir.dsdadki.web.id/`

XML berisi banyak elemen `SP_GET_LAST_STATUS_PINTU_AIR`. Setiap elemen mewakili satu record pintu air/stasiun.

## Hasil pemeriksaan saat ini

Pemeriksaan terakhir terhadap `NAMA_PINTU_AIR` yang mengandung frasa `Angke Hulu` menghasilkan tepat satu record:

```text
P.S. Angke Hulu 1
```

Record tersebut pada pemeriksaan terakhir memiliki metadata berikut:

| Field | Nilai saat pemeriksaan |
| --- | --- |
| `ID_PINTU_AIR` | `158` |
| `KODE_STASIUN` | `32` |
| `NAMA_PINTU_AIR` | `P.S. Angke Hulu 1` |
| `LOKASI` | `Angke` |
| `LATITUDE` | `-6.218026` |
| `LONGITUDE` | `106.694077` |

ID dan kode dicatat sebagai metadata saja. Keduanya tidak boleh digunakan sebagai identity permanen karena dapat berubah.

## Selector yang disepakati

Selector utama:

```text
Angke Hulu
```

Pencocokan dilakukan terhadap `NAMA_PINTU_AIR` setelah normalisasi ringan:

- ubah menjadi uppercase untuk pencocokan;
- trim whitespace;
- perlakukan tanda baca dan prefix seperti `P.S.` sebagai bagian yang tidak penting untuk pencarian;
- cari frasa/token `ANGKE HULU`;
- jangan menjadikan nomor akhir seperti `1` sebagai syarat.

Dengan aturan ini, `P.S. Angke Hulu 1` cocok dengan selector `Angke Hulu`.

## Perilaku jika jumlah hasil berubah

| Jumlah hasil | Perilaku |
| ---: | --- |
| `0` | Data dianggap tidak ditemukan; bot tidak menebak record lain. |
| `1` | Record digunakan sebagai current station. |
| `>1` | Data dianggap ambigu; bot tidak memilih otomatis dan kondisi dilaporkan ke log/owner. |

Aturan ini penting karena ID dan kode tidak menjadi fallback tersembunyi.

## Nama tampilan

Nama untuk pengguna dikonfigurasi terpisah:

```text
P.S. Angke Hulu (Baru)
```

Nama tersebut hanya fallback label konfigurasi. Output utama memakai nama asli `NAMA_PINTU_AIR` dari XML agar data tampil apa adanya.

## Koordinat dan tautan peta

URL Google Maps dibuat dari `LATITUDE` dan `LONGITUDE` record yang sedang terpilih:

```text
https://www.google.com/maps?q=<LATITUDE>,<LONGITUDE>
```

Koordinat tidak di-hardcode di command handler. Jika koordinat kosong atau invalid, button peta tidak ditampilkan.

## Header HTTP sumber

Respons HTTP yang diperiksa menyediakan `Last-Modified` dan `ETag`. Header tersebut dapat digunakan sebagai optimasi conditional request pada tahap implementasi, tetapi bukan pengganti `TANGGAL` dari record dan metadata freshness aplikasi.
