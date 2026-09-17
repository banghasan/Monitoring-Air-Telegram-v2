# Testing dan Quality Gate

## Tujuan

Test harus melindungi aturan bisnis monitoring tanpa menghubungi XML production atau Telegram sungguhan. Test default harus cepat, deterministic, dan aman dijalankan berulang atau bersamaan.

## Tooling yang dipilih

- `bun test` sebagai test runner bawaan Bun dengan `bun:test`.
- Biome sebagai formatter dan linter project yang dipasang sebagai dev dependency dengan versi exact.
- TypeScript compiler untuk type-check melalui `tsc --noEmit`.
- `bun run check` sebagai quality gate gabungan.

Bun 1.4.x tidak menjadikan `bun lint` sebagai linter native. `bun lint` hanya menjalankan script bernama `lint` di `package.json`. Bun juga dapat menjalankan TypeScript, tetapi transpile tersebut bukan type-check; type-check tetap perlu dijalankan terpisah.

Referensi tooling:

- [Bun test runner](https://bun.com/docs/test)
- [Bun runtime dan package scripts](https://bun.com/docs/runtime)
- [Bun TypeScript dan batas type-check](https://bun.com/docs/runtime/file-types)
- [Biome CLI](https://biomejs.dev/reference/cli/)

## Script project yang tersedia

```json
{
  "scripts": {
    "test": "bun test",
    "test:unit": "bun test ./test/unit",
    "test:integration": "bun test ./test/integration",
    "test:coverage": "bun test --coverage",
    "format": "biome format --write ./src ./scripts ./test",
    "format:check": "biome check --formatter-enabled=true --linter-enabled=false --assist-enabled=false ./src ./scripts ./test",
    "lint": "biome lint ./src ./scripts ./test",
    "typecheck": "tsc --noEmit",
    "check": "biome ci ./src ./scripts ./test && bun run typecheck && bun test"
  }
}
```

Command yang dipakai developer:

```bash
bun run test
bun run test:unit
bun run test:integration
bun run test:coverage
bun run format
bun run format:check
bun run lint
bun run typecheck
bun run check
```

`format` boleh mengubah file. `format:check`, `lint`, `typecheck`, dan `check` tidak boleh mengubah source code. `check` menjadi gate untuk pull request atau pemeriksaan sebelum build image.

## Aturan isolasi test

1. Unit test tidak melakukan network ke XML atau Telegram.
2. XML production diganti fixture lokal yang mewakili kondisi nyata.
3. HTTP upstream diganti fake fetch/client yang dapat mengatur response, timeout, dan error.
4. Telegram client diganti fake notifier; test tidak pernah memakai token sungguhan.
5. Timer scheduler tidak ditunggu satu menit. Worker memiliki fungsi `runOnce` yang dapat dipanggil langsung oleh test.
6. Waktu memakai clock yang dapat diinjeksi atau dikontrol test.
7. State worker memakai temporary directory/database per test dan selalu dibersihkan.
8. Perubahan `process.env` dipulihkan pada `afterEach`.
9. Mock, spy, dan singleton cache dibersihkan pada setiap test.
10. Test tidak bergantung pada urutan file atau urutan test.

Bun menjalankan test file dalam satu process secara default. Opsi parallel hanya boleh dipakai setelah test tidak berbagi environment, file state, port, atau singleton mutable. Default project tetap `bun test` tanpa `--parallel` agar aman terlebih dahulu.

## Fixture data

Fixture minimal perlu mencakup:

- satu record `P.S. Angke Hulu 1`;
- `ID_PINTU_AIR` dan `KODE_STASIUN` yang berubah tetapi tetap terpilih;
- nol hasil pencarian;
- lebih dari satu hasil `Angke Hulu`;
- `TINGGI_AIR=-440` dan tampilan `-44 cm`;
- threshold `SIAGA1` sampai `SIAGA4`;
- status Normal, Siaga, Waspada, dan Bahaya;
- timestamp valid, kosong, dan tidak valid;
- koordinat valid dan kosong.

Fixture disimpan di `test/fixtures/`, bukan di `src/` dan bukan mengambil data live saat test.

## Matriks test domain

### Selector dan parser XML

- pencarian tidak sensitif terhadap huruf besar/kecil dan whitespace;
- nama yang mengandung `Angke Hulu` cocok tanpa mengunci nomor akhir;
- nol hasil menjadi unavailable;
- lebih dari satu hasil menjadi ambiguous;
- ID/kode yang berubah tidak mengubah identity station.

### Transformasi dan tampilan data

- raw `-440` dipertahankan;
- display height menjadi `-44 cm`;
- tanda negatif tidak dihapus;
- status utama berasal dari `STATUS_SIAGA`;
- threshold mengikuti record aktif;
- arah membandingkan current dan previous raw value.

### Cache dan freshness

- cache fresh dipakai selama TTL;
- refresh paralel tidak membuat request ganda;
- error upstream memakai stale snapshot sesuai batas waktu;
- stale yang melewati batas tidak dianggap real-time;
- cache tidak membocorkan snapshot antar test.

### Kebijakan monitoring

- baseline pertama tidak mengirim Telegram;
- perubahan tinggi saja tidak mengirim notifikasi;
- perubahan `STATUS_SIAGA` mengirim satu event;
- status sama tidak mengirim ulang;
- upstream gagal tidak mengirim broadcast;
- target gagal dicatat dan dapat retry;
- target sukses tidak dikirim ulang ketika target lain gagal;
- dry-run membuat log simulasi tanpa request Telegram.

### Rich Message dan command

- `/air`, `/ping`, `/start`, dan `/help` menghasilkan Rich Message;
- `Keterangan` dan `Legenda` menjadi satu details collapsed;
- threshold pada details diverifikasi sebagai tabel Rich Message;
- button berada di Rich Message;
- refresh mencoba edit sebelum fallback pesan baru;
- `/ping` mengukur durasi process secara deterministic;
- `/system` menolak user non-owner/admin;
- secret tidak muncul dalam payload, response, atau log.

### Worker dan HTTP

- `/health` hanya menunjukkan process hidup;
- `/ready` memvalidasi konfigurasi dan dependency internal;
- shutdown menghentikan scheduler tanpa meninggalkan timer;
- role `bot` tidak menyalakan monitor scheduler;
- role `monitor` tidak menjalankan polling update Telegram.

## Test integration

Integration test boleh menggabungkan parser, service, cache, state repository, dan worker dengan fake upstream serta fake Telegram. Integration test tetap tidak mengakses internet. Test yang mengakses endpoint live harus diberi nama dan command khusus, tidak menjadi bagian dari `bun test` default.

## Coverage

`bun run test:coverage` digunakan untuk melihat area yang belum terlindungi. Pada tahap awal tidak menetapkan angka coverage global yang dapat mendorong test dangkal. Prioritas coverage adalah selector, freshness, status transition, retry/deduplication, authorization, dan rendering Rich Message.
