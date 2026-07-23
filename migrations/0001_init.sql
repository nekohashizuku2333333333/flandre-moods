CREATE TABLE entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  metric_id TEXT NOT NULL,
  date TEXT NOT NULL,
  tier TEXT NOT NULL CHECK (tier IN ('good', 'okay', 'low', 'hard')),
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (metric_id, date)
);

CREATE INDEX idx_entries_metric_date ON entries (metric_id, date);
