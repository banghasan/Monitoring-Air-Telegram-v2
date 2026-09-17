# Issue 002 — State Worker Monitoring

Status: **Resolved**

## Pertanyaan

Di mana worker menyimpan fingerprint dan snapshot terakhir agar restart tidak mengirim notifikasi perubahan palsu atau melewatkan perubahan?

## Pilihan

1. **SQLite/file pada named volume** — sederhana untuk satu worker, tetapi perlu atomic write dan backup/permission.
2. **Redis** — cocok jika nanti worker lebih dari satu atau ada komponen lain yang membutuhkan state bersama.
3. **Memory saja** — paling sederhana, tetapi state hilang ketika container restart.

## Keputusan

Gunakan state persistent lokal pada named volume worker. SQLite menjadi pilihan utama; file state atomik hanya menjadi alternatif jika kebutuhan state tetap sederhana. Tidak perlu menyimpan histori lengkap; cukup fingerprint terakhir, snapshot relevan, dan hasil kirim per target.

## Dampak ke cache

Cache untuk `/air` dan state notification worker adalah dua kebutuhan berbeda. Cache boleh TTL pendek dan hilang saat restart, sedangkan fingerprint worker sebaiknya bertahan melewati restart.
