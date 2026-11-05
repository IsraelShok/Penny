-- 50/30/20 and fixed/variable tags per category, as in the "Financial Cat"
-- budget sheet. Only expense leaves use them; parents and income ignore them.
-- Seeded categories get a sensible default; the user can change it later.
ALTER TABLE categories ADD COLUMN need_type TEXT NOT NULL DEFAULT 'want'
  CHECK (need_type IN ('need','want','saving'));
ALTER TABLE categories ADD COLUMN cost_type TEXT NOT NULL DEFAULT 'variable'
  CHECK (cost_type IN ('fixed','variable','unplanned'));

UPDATE categories SET need_type = 'need'
WHERE kind = 'expense' AND name IN (
  'Groceries','Transport','Bills & Utilities','Home','Insurance',
  'Health','Education','Kids & Childcare','Pet Care','Fees & Taxes'
);

UPDATE categories SET cost_type = 'fixed'
WHERE kind = 'expense' AND name IN (
  'Bills & Utilities','Insurance','Subscriptions','Education','Kids & Childcare'
);

UPDATE categories SET cost_type = 'unplanned'
WHERE kind = 'expense' AND name IN ('Travel','Gifts & Donations','Fees & Taxes');
