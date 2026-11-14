-- Profiles share one household (workspace): only name, avatar and UI preferences differ.
-- Rows are seeded from existing workspaces by profiles-migration.ts right after this file runs.
CREATE TABLE IF NOT EXISTS profiles (
 id INTEGER PRIMARY KEY,
 workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 name TEXT NOT NULL,
 avatar_emoji TEXT,
 avatar_color TEXT,
 created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS profiles_workspace ON profiles(workspace_id);
