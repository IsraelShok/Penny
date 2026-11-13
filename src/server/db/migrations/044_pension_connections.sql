-- Investment-house / pension logins (Meitav, Harel, Migdal). Only the ID number and phone are
-- stored, encrypted; the provider's session cookies are kept encrypted too so later syncs can skip the SMS code.
CREATE TABLE pension_connections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  fund_id TEXT NOT NULL,
  credentials_encrypted BLOB NOT NULL,
  iv BLOB NOT NULL,
  auth_tag BLOB NOT NULL,
  session_encrypted BLOB,
  session_iv BLOB,
  session_auth_tag BLOB,
  last_sync_at TEXT,
  last_error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(workspace_id, fund_id)
);
