# Deployment

Folder ini berisi dokumentasi deployment yang belum dijalankan pada tahap diskusi.

- [Compose dengan image GHCR](./01-compose-ghcr.md)

Deployment awal menggunakan satu image yang sama untuk dua service:

- `bot`: Elysia, grammY polling, command publik, dan `/system`;
- `monitor`: scheduler XML, state SQLite, dan pengiriman notifikasi.

Image dibuild dan dipublish secara manual melalui GitHub Action workflow `workflow_dispatch`.
