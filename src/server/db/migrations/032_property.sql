-- Optional home details on real_estate assets, for an automatic value estimate.
ALTER TABLE assets ADD COLUMN city TEXT;
ALTER TABLE assets ADD COLUMN street TEXT;
ALTER TABLE assets ADD COLUMN rooms REAL;
ALTER TABLE assets ADD COLUMN size_m2 REAL;
ALTER TABLE assets ADD COLUMN purchase_price REAL;
-- 'YYYY-MM'
ALTER TABLE assets ADD COLUMN purchase_month TEXT;

-- CBS dwelling price index (series 40010), fetched at most once a day.
CREATE TABLE property_index_cache (
  series INTEGER PRIMARY KEY,
  payload TEXT NOT NULL,
  fetched_at INTEGER NOT NULL
);
