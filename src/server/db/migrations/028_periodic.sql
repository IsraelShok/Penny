-- Non-monthly expenses (sinking funds): set a little aside each month for a bill that comes every N months.
CREATE TABLE periodic_expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  amount REAL NOT NULL CHECK (amount > 0),
  every_months INTEGER NOT NULL CHECK (every_months BETWEEN 1 AND 24),
  next_due TEXT NOT NULL,
  saved_so_far REAL NOT NULL DEFAULT 0,
  auto_key TEXT
);
CREATE INDEX idx_periodic_workspace ON periodic_expenses(workspace_id);

-- Detected suggestions the user said no to, so they don't come back.
CREATE TABLE periodic_dismissed (
  workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  auto_key TEXT NOT NULL,
  PRIMARY KEY (workspace_id, auto_key)
);
