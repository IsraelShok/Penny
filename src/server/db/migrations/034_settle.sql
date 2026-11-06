-- "סגרנו חשבון": a settle-up with one household member closes everything up to and including its date.
CREATE TABLE settle_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  counterpart TEXT NOT NULL,
  date TEXT NOT NULL,
  amount REAL NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_settle_entries_workspace ON settle_entries(workspace_id, counterpart, date);
