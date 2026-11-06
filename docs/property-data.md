# Property value data (researched 2026-11-06)

## Chosen: CBS dwelling price index (מדד מחירי דירות)
- API: `https://api.cbs.gov.il/index/data/price?id=40010&format=json&download=false&startPeriod=01-1994&endPeriod=12-2100&PageSize=1000`
- Series id **40010**, "מחירי דירות", monthly, base "1993 ממוצע" for the whole monthly range (checked: 319 points 2000-01..2026-07, one base).
- Official, public, no key; CBS publishes its data for free reuse with attribution ("מקור: הלשכה המרכזית לסטטיסטיקה").
- Caveats: national index (no city/rooms), published with ~6 weeks lag, each point is a two-month moving average of deals. It tracks the market, not a specific flat.
- Used as: value = purchase price × (latest index ÷ index at purchase month). Cached a day in `property_index_cache` (migration 032); on failure the last cached copy is used. Code: `src/server/markets/property.ts`, math: `src/lib/property.ts`.

## Not used
- **data.gov.il**: CKAN search for "עסקאות נדלן" returns nothing; "מקרקעין" gives the appraisers' registry and land-registry ownership types, not deals.
- **nadlan.gov.il** (Tax Authority deals): its site uses an internal, undocumented API with no published terms of reuse, so it is not called. If an official open deals dataset appears, the planned comparable-deals method (same city, ±1 room, ±25% size, last 24 months, median ₪/m² × size, 25th–75th percentile range) can use the stored city/street/rooms/size fields.
