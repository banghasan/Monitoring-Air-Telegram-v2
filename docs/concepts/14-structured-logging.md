# Structured Logging

## Keputusan

Log aplikasi menggunakan format JSON satu object per baris (NDJSON) dan ditulis ke stdout/stderr. Tujuannya agar log dapat langsung dibaca melalui:

```bash
docker logs <container>
```

Format ini juga dapat diproses oleh `jq`, Docker logging driver, atau log collector tanpa parsing teks bebas.

## Aturan format

- satu event = satu baris JSON;
- tidak memakai pretty-print atau multiline stack trace sebagai format utama;
- timestamp memakai ISO 8601 UTC pada field `ts`;
- `level` minimal: `debug`, `info`, `warn`, `error`;
- `service` membedakan `bot` dan `monitor`;
- `event` memakai nama stabil berbentuk dot notation;
- `message` singkat dan aman untuk manusia;
- field tambahan berisi metadata terstruktur;
- token, secret, authorization header, dan XML penuh tidak pernah dicatat.

## Field yang disarankan

```json
{
  "ts": "2026-09-17T12:00:00.000Z",
  "level": "info",
  "service": "monitor",
  "event": "monitor.status_changed",
  "message": "water status changed",
  "station_query": "Angke Hulu",
  "source_name": "P.S. Angke Hulu 1",
  "previous_status": "Status : Normal",
  "current_status": "Status : Siaga 3",
  "observed_at": "2026-09-17T18:00:00+07:00",
  "duration_ms": 128,
  "run_id": "run-20260917-120000"
}
```

Field sensitif atau detail yang tidak dibutuhkan tidak boleh ditambahkan hanya untuk debugging.

## Event utama

| Event | Level | Service |
| --- | --- | --- |
| `app.start` | `info` | bot/monitor |
| `app.shutdown` | `info` | bot/monitor |
| `config.validated` | `info` | bot/monitor |
| `config.invalid` | `error` | bot/monitor |
| `source.fetch.start` | `debug` | monitor |
| `source.fetch.success` | `info` | monitor |
| `source.fetch.error` | `error` | monitor |
| `station.match` | `info` | bot/monitor |
| `station.ambiguous` | `error` | bot/monitor |
| `monitor.baseline` | `info` | monitor |
| `monitor.status_changed` | `info` | monitor |
| `notification.send.success` | `info` | monitor |
| `notification.send.error` | `error` | monitor |
| `worker.retry` | `warn` | monitor |

## Kegagalan

Kegagalan upstream dan target Telegram hanya dicatat ke log JSON serta diringkas pada `/system`. Tidak ada broadcast error ke group/channel berdasarkan kegagalan tersebut.
