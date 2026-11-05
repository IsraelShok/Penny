-- Automation: bank balances arrive with every sync, and rule-based suggestions
-- (insurance, loans, fees, duplicates…) can be dismissed so they stop coming back.
CREATE TABLE account_balances (
  workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  account_number TEXT NOT NULL,
  balance REAL NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (workspace_id, provider, account_number)
);

CREATE TABLE dismissed_suggestions (
  workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  dismissed_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (workspace_id, key)
);

-- One net worth total per day (including synced bank balances), so the trend
-- always matches the headline figure.
CREATE TABLE net_worth_daily (
  workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  net_worth REAL NOT NULL,
  PRIMARY KEY (workspace_id, date)
);
