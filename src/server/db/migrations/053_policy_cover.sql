-- Who a policy covers, and two kinds the overlap check needs: health-fund supplementary (שב"ן) and mortgage life insurance.
-- SQLite can't alter a CHECK, so the table is rebuilt.
CREATE TABLE insurance_policies_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('health','life','disability','long_term_care','home','car','travel','other','shaban','mortgage_life')),
  provider TEXT,
  monthly_premium REAL NOT NULL CHECK (monthly_premium >= 0),
  renewal_month TEXT,
  insured TEXT
);
INSERT INTO insurance_policies_new (id, workspace_id, name, kind, provider, monthly_premium, renewal_month)
  SELECT id, workspace_id, name, kind, provider, monthly_premium, renewal_month FROM insurance_policies;
DROP TABLE insurance_policies;
ALTER TABLE insurance_policies_new RENAME TO insurance_policies;
CREATE INDEX idx_policies_workspace ON insurance_policies(workspace_id);
