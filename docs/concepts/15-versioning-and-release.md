# Versioning dan Release

## Tujuan

Project memakai versioning aplikasi yang eksplisit agar versi dapat ditampilkan pada `/system`, log, Docker image, dan release artifact.

Dokumen ini menafsirkan “dump version” sebagai mencetak versi saat ini untuk manusia atau CI, bukan dump data air.

## Source of truth

- Versi aplikasi berada pada field `version` di `package.json`.
- Format awal memakai Semantic Versioning stabil: `MAJOR.MINOR.PATCH`, misalnya `0.1.0`.
- `.bun-version` adalah versi runtime Bun dan tidak boleh ikut berubah ketika versi aplikasi dibump.
- `APP_VERSION` tidak menjadi source of truth; variable ini opsional dan, jika diisi, harus sama dengan versi package sebagai validasi deployment.

Contoh:

```json
{
  "name": "monitoring-air-telegram-v2",
  "version": "0.1.0"
}
```

## Command yang tersedia

```bash
bun run version:show
bun run version:dump
bun run version:bump:patch
bun run version:bump:minor
bun run version:bump:major
```

Perilaku:

| Command | Perilaku |
| --- | --- |
| `version:show` | Menampilkan versi dalam format manusia, misalnya `monitoring-air-telegram-v2 0.1.0`. |
| `version:dump` | Menampilkan data machine-readable, minimal `name` dan `version`, tanpa log tambahan. |
| `version:bump:patch` | `0.1.0` menjadi `0.1.1`. |
| `version:bump:minor` | `0.1.0` menjadi `0.2.0` dan patch menjadi `0`. |
| `version:bump:major` | `0.1.0` menjadi `1.0.0` dan minor/patch menjadi `0`. |

Script berada di [`scripts/version.ts`](../../scripts/version.ts), sedangkan command-nya didaftarkan di `package.json`:

```json
{
  "scripts": {
    "version:show": "bun scripts/version.ts show",
    "version:dump": "bun scripts/version.ts dump",
    "version:bump:patch": "bun scripts/version.ts bump patch",
    "version:bump:minor": "bun scripts/version.ts bump minor",
    "version:bump:major": "bun scripts/version.ts bump major"
  }
}
```

## Aturan keamanan bump

- Script membaca versi dari `package.json`, bukan dari environment.
- Versi harus valid sebelum bump.
- Bump awal hanya menerima versi stabil tiga komponen; prerelease dan build metadata belum didukung.
- Hanya `package.json` yang diubah oleh command bump.
- `bun.lock` tidak diubah hanya karena versi aplikasi berubah.
- Script tidak otomatis membuat commit, tag, push, atau release GitHub.
- Penulisan dilakukan secara aman agar `package.json` tidak rusak jika proses berhenti saat menulis.
- Setelah bump, script menampilkan versi lama dan versi baru.

Commit, tag, dan publish image tetap menjadi langkah manual yang terpisah. Ini mencegah perubahan versioning secara tidak sengaja saat development.

## Dampak ke Docker

Build Docker berikutnya dapat memakai `package.json#version` untuk label atau tag image. Tag Git dan tag image tidak dibuat otomatis oleh script bump; workflow Docker tetap dipicu manual sesuai keputusan deployment.

## Test version script

Implementasi script ada di [`scripts/version.ts`](../../scripts/version.ts) dan diuji tanpa mengubah `package.json` repository. Test menggunakan temporary directory dan fixture package JSON, lalu memverifikasi:

- show/dump membaca versi yang benar;
- patch, minor, dan major menghasilkan angka yang benar;
- invalid version ditolak;
- prerelease ditolak sesuai aturan MVP;
- field lain pada package JSON tidak hilang;
- file asli repository tidak berubah selama unit test.
