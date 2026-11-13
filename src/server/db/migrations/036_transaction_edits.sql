CREATE TABLE transaction_allocations (
  transaction_id INTEGER NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  amount_cents INTEGER NOT NULL CHECK(amount_cents > 0),
  PRIMARY KEY(transaction_id, position)
);
CREATE TABLE transaction_edit_history (
  token TEXT PRIMARY KEY,
  workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  before_json TEXT NOT NULL,
  after_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
-- Imported rows stay intact. Only category reporting expands the allocations.
CREATE VIEW category_transactions AS
SELECT t.id,t.workspace_id,t.account_number,t.date,t.processed_date,t.original_amount,t.original_currency,
 CASE WHEN a.transaction_id IS NULL THEN t.charged_amount ELSE -a.amount_cents / 100.0 END AS charged_amount,
 t.charged_currency,t.description,t.memo,t.type,t.status,t.identifier,t.installment_number,t.installment_total,
 CASE WHEN a.transaction_id IS NULL THEN t.category_id ELSE a.category_id END AS category_id,t.category_source,t.provider,t.sync_run_id,t.dedup_hash,t.dedup_sequence,
 t.kind,t.needs_review,t.created_at,t.updated_at,t.ai_confidence,t.is_excluded,t.credential_id,t.owner
FROM transactions t LEFT JOIN transaction_allocations a ON a.transaction_id=t.id AND t.kind='expense';

CREATE TRIGGER clear_allocations_on_category_change AFTER UPDATE OF category_id ON transactions
WHEN NEW.category_id IS NOT OLD.category_id BEGIN
  DELETE FROM transaction_allocations WHERE transaction_id=NEW.id;
END;
CREATE TRIGGER clear_allocations_on_kind_change AFTER UPDATE OF kind ON transactions
WHEN NEW.kind IS NOT OLD.kind BEGIN
  DELETE FROM transaction_allocations WHERE transaction_id=NEW.id;
END;
