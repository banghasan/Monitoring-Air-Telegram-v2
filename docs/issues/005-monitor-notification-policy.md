# Issue 005 — Detail Kebijakan Notifikasi Monitoring

Status: **Resolved**

## Keputusan yang sudah ada

Broadcast monitoring dipicu oleh perubahan `STATUS_SIAGA`. Perubahan tinggi air saja tidak mengirim broadcast.

## Keputusan

### 1. Baseline awal

Jangan mengirim baseline pertama. Simpan status valid pertama, lalu kirim hanya ketika status berikutnya berbeda.

### 2. Debounce status

Tidak memakai debounce berbasis dua sample. Status perubahan dikirim segera setelah:

- record selector menghasilkan tepat satu record;
- `STATUS_SIAGA` tersedia;
- `TANGGAL` atau snapshot sumber valid;
- status berbeda dari state terakhir.

Alasannya, penundaan dua sample dapat menunda informasi kenaikan siaga. Duplikasi dicegah dengan state/fingerprint, bukan dengan menahan event.

### 3. Status tidak tersedia

Jika `STATUS_SIAGA` kosong atau source ambigu, jangan mengirim status palsu. Catat error dan tampilkan pada `/system`.

### 4. Upstream gagal

Jangan broadcast error ke semua target setiap interval. Catat kegagalan, retry pada siklus berikutnya, dan tampilkan usia data/last error pada `/system`.

### 5. Target gagal

Kirim ke setiap target secara independen. Gunakan retry terbatas dengan backoff, lalu simpan event pending per target agar target yang gagal tidak hilang ketika target lain berhasil.

### 6. State

Worker menyimpan minimal status terakhir dan hasil pengiriman per target menggunakan keputusan persistent state pada [Issue 002](./002-monitor-worker-state.md).

## Detail lanjutan

- jumlah retry dan durasi backoff dapat dituning saat implementasi;
- kegagalan upstream/target tidak mengirim broadcast dan hanya terlihat di log JSON serta `/system`;
- perubahan record sumber yang terpilih tanpa perubahan status tidak mengirim broadcast;
- status yang sama tidak dikirim ulang secara periodik.
