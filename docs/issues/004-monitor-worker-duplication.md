# Issue 004 — Satu Worker dan Duplicate Notification

Status: **Resolved**

## Pertanyaan

Bagaimana mencegah satu perubahan dikirim berkali-kali jika Docker menjalankan lebih dari satu worker?

## Keputusan

Deployment awal hanya menjalankan satu replica `monitor`. Bot polling dan worker monitoring adalah role yang berbeda; bot tidak menyalakan scheduler jika worker aktif.

## Jika perlu scaling

Tambahkan salah satu mekanisme:

- distributed lock dengan TTL;
- leader election;
- queue/outbox dengan consumer tunggal;
- fingerprint dan deduplication store bersama.

Menambah replica tanpa mekanisme tersebut tidak diperbolehkan karena dapat menggandakan notifikasi ke semua group/channel.
