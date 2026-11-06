-- Free text for the "if something happens to me" family document. Plain notes only, never secrets.
CREATE TABLE legacy_notes (
  workspace_id INTEGER PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
  data TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
