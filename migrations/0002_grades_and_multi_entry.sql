-- Grades become A–F (心情 uses A–E, 自杀意念 adds F), and one day can now hold
-- several check-ins, so the one-row-per-day UNIQUE constraint goes away and
-- every entry carries the local time it was recorded at.
--
-- SQLite cannot drop a CHECK or a UNIQUE constraint in place, so the table is
-- rebuilt and the old rows are mapped over: good→A, okay→B, low→D, hard→E.

CREATE TABLE entries_v2 (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  metric_id TEXT NOT NULL,
  date TEXT NOT NULL,
  time TEXT NOT NULL,
  tier TEXT NOT NULL CHECK (tier IN ('A', 'B', 'C', 'D', 'E', 'F')),
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO entries_v2 (id, metric_id, date, time, tier, note, created_at, updated_at)
SELECT
  id,
  metric_id,
  date,
  '00:00',
  CASE tier
    WHEN 'good' THEN 'A'
    WHEN 'okay' THEN 'B'
    WHEN 'low' THEN 'D'
    WHEN 'hard' THEN 'E'
  END,
  note,
  created_at,
  updated_at
FROM entries;

DROP TABLE entries;

ALTER TABLE entries_v2 RENAME TO entries;

CREATE INDEX idx_entries_metric_date ON entries (metric_id, date, time);
