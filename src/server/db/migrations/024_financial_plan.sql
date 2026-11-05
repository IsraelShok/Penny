-- What an advisor checks beyond net worth: fees on long-term savings, debt
-- terms, goals, insurance policies, and net worth before tracking began.

-- Management fees (% per year) on pension / study / provident funds, as in
-- the pension clearinghouse report. Debts get their rate and payment.
ALTER TABLE assets ADD COLUMN fee_deposit REAL;
ALTER TABLE assets ADD COLUMN fee_balance REAL;
ALTER TABLE assets ADD COLUMN monthly_deposit REAL;
ALTER TABLE assets ADD COLUMN interest_rate REAL;
ALTER TABLE assets ADD COLUMN monthly_payment REAL;

CREATE TABLE goals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  target_amount REAL NOT NULL CHECK (target_amount > 0),
  target_date TEXT NOT NULL,
  saved_amount REAL NOT NULL DEFAULT 0
);
CREATE INDEX idx_goals_workspace ON goals(workspace_id);

CREATE TABLE insurance_policies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('health','life','disability','long_term_care','home','car','travel','other')),
  provider TEXT,
  monthly_premium REAL NOT NULL CHECK (monthly_premium >= 0)
);
CREATE INDEX idx_policies_workspace ON insurance_policies(workspace_id);

-- Net worth typed in for months before asset tracking started (HaExolidit-style monthly rows).
CREATE TABLE net_worth_manual (
  workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  net_worth REAL NOT NULL,
  PRIMARY KEY (workspace_id, date)
);
