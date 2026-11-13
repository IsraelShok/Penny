CREATE TABLE commitments (
 id INTEGER PRIMARY KEY, workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 name TEXT NOT NULL, amount REAL NOT NULL CHECK(amount>=0), next_date TEXT NOT NULL,
 cadence TEXT NOT NULL CHECK(cadence IN ('once','monthly','yearly')),
 source TEXT NOT NULL CHECK(source IN ('bank','card')), status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','cancelled')),
 trial_end TEXT, series_key TEXT, previous_amount REAL, updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE goal_links (
 transaction_id INTEGER PRIMARY KEY REFERENCES transactions(id) ON DELETE CASCADE,
 goal_id INTEGER NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
 contribution REAL NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE goal_rules (
 id INTEGER PRIMARY KEY, workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 goal_id INTEGER NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
 account TEXT NOT NULL, description TEXT NOT NULL, direction INTEGER NOT NULL CHECK(direction IN (-1,1)),
 from_date TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE control_audit (
 id INTEGER PRIMARY KEY, workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 action TEXT NOT NULL, before_json TEXT NOT NULL, after_json TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE synced_preferences (
 workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 profile TEXT NOT NULL DEFAULT 'local', key TEXT NOT NULL, value TEXT NOT NULL,
 revision INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL DEFAULT (datetime('now')),
 PRIMARY KEY(workspace_id,profile,key)
);
