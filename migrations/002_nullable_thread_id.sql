CREATE TABLE notification_delivery_v2 (
  event_id TEXT NOT NULL,
  target_key TEXT NOT NULL,
  target_label TEXT NOT NULL,
  chat_id TEXT NOT NULL,
  thread_id INTEGER,
  state TEXT NOT NULL CHECK (state IN ('pending', 'sent', 'failed')),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  next_retry_at TEXT,
  last_error TEXT,
  sent_at TEXT,
  PRIMARY KEY (event_id, target_key),
  FOREIGN KEY (event_id) REFERENCES monitor_event(event_id) ON DELETE CASCADE
);

INSERT INTO notification_delivery_v2 (
  event_id,
  target_key,
  target_label,
  chat_id,
  thread_id,
  state,
  attempt_count,
  next_retry_at,
  last_error,
  sent_at
)
SELECT
  event_id,
  target_key,
  target_label,
  chat_id,
  thread_id,
  state,
  attempt_count,
  next_retry_at,
  last_error,
  sent_at
FROM notification_delivery;

DROP TABLE notification_delivery;
ALTER TABLE notification_delivery_v2 RENAME TO notification_delivery;

CREATE INDEX IF NOT EXISTS idx_notification_delivery_retry
  ON notification_delivery (state, next_retry_at);
