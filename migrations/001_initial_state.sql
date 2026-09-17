CREATE TABLE IF NOT EXISTS monitor_snapshot (
  station_key TEXT PRIMARY KEY,
  snapshot_json TEXT NOT NULL,
  status_normalized TEXT NOT NULL,
  last_event_id TEXT,
  last_error TEXT,
  last_success_at TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS monitor_event (
  event_id TEXT PRIMARY KEY,
  station_key TEXT NOT NULL,
  previous_status_raw TEXT NOT NULL,
  current_status_raw TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notification_delivery (
  event_id TEXT NOT NULL,
  target_key TEXT NOT NULL,
  target_label TEXT NOT NULL,
  chat_id TEXT NOT NULL,
  thread_id INTEGER NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('pending', 'sent', 'failed')),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  next_retry_at TEXT,
  last_error TEXT,
  sent_at TEXT,
  PRIMARY KEY (event_id, target_key),
  FOREIGN KEY (event_id) REFERENCES monitor_event(event_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_notification_delivery_retry
  ON notification_delivery (state, next_retry_at);
