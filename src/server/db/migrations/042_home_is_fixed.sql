-- Rent and mortgage land in "Home", so it is mostly a fixed cost; without this the
-- fixed-costs-to-income ratio misses the biggest bill. Only touches the untouched default.
UPDATE categories SET cost_type = 'fixed'
WHERE kind = 'expense' AND name = 'Home' AND cost_type = 'variable';
