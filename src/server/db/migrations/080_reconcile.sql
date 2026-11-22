-- Reconciliation: pairs the person said are not duplicates (smaller id first), and one-day undo records for every
-- reconcile action. Removed rows are hidden (is_excluded = 1), never deleted.
CREATE TABLE reconcile_dismissed (
  workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  txn_a INTEGER NOT NULL,
  txn_b INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (workspace_id, txn_a, txn_b)
);
CREATE TABLE reconcile_undo (
  token TEXT PRIMARY KEY,
  workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  before_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Vague bank descriptions ("העברה", "משיכת מזומן"): rows containing one are never auto-categorized, so they land in review.
CREATE TABLE generic_descriptions (
  workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  pattern TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (workspace_id, pattern)
);

-- Recurring series the person made by hand. amount / day_of_month NULL = taken from the attached transactions.
CREATE TABLE manual_recurring (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  account TEXT NOT NULL DEFAULT '',
  currency TEXT NOT NULL DEFAULT 'ILS',
  cadence TEXT NOT NULL CHECK (cadence IN ('weekly','monthly','yearly')),
  amount REAL CHECK (amount IS NULL OR amount > 0),
  day_of_month INTEGER CHECK (day_of_month IS NULL OR (day_of_month BETWEEN 1 AND 31)),
  start_date TEXT NOT NULL,
  deleted_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_manual_recurring_ws ON manual_recurring(workspace_id);
CREATE TABLE manual_recurring_txns (
  series_id INTEGER NOT NULL REFERENCES manual_recurring(id) ON DELETE CASCADE,
  transaction_id INTEGER NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  PRIMARY KEY (series_id, transaction_id)
);
CREATE INDEX idx_manual_recurring_txns_txn ON manual_recurring_txns(transaction_id);
