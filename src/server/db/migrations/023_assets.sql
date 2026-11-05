-- Net worth: everything owned or owed, as in HaExolidit's net worth sheet.
-- An asset is either priced live (symbol + quantity, from Yahoo Finance) or
-- valued by hand (manual_value). Liabilities are assets with is_liability = 1
-- and a positive value that is subtracted.
CREATE TABLE assets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN (
    'cash','deposit','bond','stock','fund','study_fund','provident','pension',
    'real_estate','business','metal','crypto','vehicle','other',
    'mortgage','loan','credit','other_liability'
  )),
  currency TEXT NOT NULL DEFAULT 'ILS',
  symbol TEXT,
  quantity REAL,
  manual_value REAL,
  -- Total cost in `currency`, for unrealised gain and its 25% capital gains tax.
  cost_basis REAL,
  liquid INTEGER NOT NULL DEFAULT 1,
  is_liability INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (symbol IS NOT NULL OR manual_value IS NOT NULL)
);
CREATE INDEX idx_assets_workspace ON assets(workspace_id);

-- One value per asset per day, in ILS, so net worth can be charted over time.
CREATE TABLE asset_snapshots (
  asset_id INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  value_ils REAL NOT NULL,
  PRIMARY KEY (asset_id, date)
);

-- Yahoo Finance responses, refreshed at most every 15 minutes.
CREATE TABLE quotes_cache (
  symbol TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  fetched_at INTEGER NOT NULL
);
