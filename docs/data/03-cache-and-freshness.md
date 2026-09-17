# Cache dan Freshness

## Keputusan awal

Cache menggunakan memory process dan menyimpan satu snapshot Angke Hulu. Belum ada database, Redis, atau histori permanen.

| Parameter | Nilai awal |
| --- | ---: |
| `CACHE_TTL_SECONDS` | `60` |
| `CACHE_REFRESH_SECONDS` | `60` |
| `UPSTREAM_TIMEOUT_SECONDS` | `5` |
| `STALE_IF_ERROR_SECONDS` | `900` |
| `MAX_DATA_AGE_SECONDS` | `600` |

## Alur

1. Aplikasi mengambil snapshot awal.
2. Refresh terjadwal berjalan setiap 60 detik.
3. Command `/air` membaca snapshot, bukan selalu memanggil upstream.
4. Refresh yang sedang berjalan dikunci agar tidak terjadi request paralel.
5. Jika upstream gagal, snapshot terakhir dapat dipakai sementara dengan label `stale`.
6. Jika melewati batas stale, bot menyatakan data tidak tersedia atau kedaluwarsa.

## Makna freshness

TTL satu menit membatasi pemakaian cache aplikasi, tetapi tidak menjamin sumber mengubah data setiap menit. `TANGGAL` dari XML adalah waktu pengamatan yang perlu ditampilkan kepada pengguna.

Pesan `/air` minimal memuat:

- waktu pengamatan sumber (`TANGGAL`);
- waktu fetch aplikasi (`fetchedAt`);
- status `fresh` atau `stale`.

Jika data stale:

```text
⚠️ Data terakhir berhasil diambil, tetapi sumber sedang tidak dapat diperbarui.
```

Data stale tidak boleh dipresentasikan seolah-olah real-time.

## Mengapa 60 detik

Karena tinggi air dapat berubah cepat, TTL awal dibuat pendek. Namun refresh lebih sering dari pembaruan sumber tidak membuat data lebih baru; ia hanya membuat aplikasi lebih cepat mengetahui jika ada snapshot baru atau sumber gagal.

Angka ini dapat diubah lewat environment tanpa mengubah format bot.

## Restart dan scaling

- Restart container mengosongkan cache dan memicu fetch baru.
- Satu replica cukup memakai memory cache.
- Jika lebih dari satu replica dijalankan, setiap replica memiliki snapshot berbeda.
- Scaling horizontal memerlukan cache bersama seperti Redis atau storage lain.
