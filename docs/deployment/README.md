# Deployment

Folder ini berisi dokumentasi deployment Docker/Compose yang sudah disesuaikan dengan image dan role aplikasi.

- [Compose dengan image GHCR](./01-compose-ghcr.md)

Deployment awal menggunakan satu image yang sama untuk dua service:

- `bot`: Elysia, grammY polling, command publik, dan `/system`;
- `monitor`: scheduler XML, state SQLite, dan pengiriman notifikasi.

Image dibuild dan dipublish secara manual melalui GitHub Action workflow `workflow_dispatch`.
