-- Link a pension / study / provident asset to its fund in the Finance Ministry's
-- public data (Gemel-Net, Pensia-Net on data.gov.il), and cache that data daily.
ALTER TABLE assets ADD COLUMN fund_id INTEGER;
ALTER TABLE assets ADD COLUMN fund_source TEXT CHECK (fund_source IN ('gemel','pension'));

CREATE TABLE funds_cache (
  source TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  fetched_at INTEGER NOT NULL
);
