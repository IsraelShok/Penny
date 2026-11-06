-- Free tags/events on transactions that cut across categories ("טיול לאילת").
CREATE TABLE transaction_tags (
  workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  transaction_id INTEGER NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  PRIMARY KEY (transaction_id, tag)
);
CREATE INDEX idx_transaction_tags_workspace_tag ON transaction_tags(workspace_id, tag);

-- Mine / yours / ours: a household member id or 'shared'; NULL = not set (falls back to the account's default owner).
ALTER TABLE transactions ADD COLUMN owner TEXT;
