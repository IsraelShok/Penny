-- More built-in categories for Israeli households, added to every existing
-- workspace. Mirrored in workspaces.ts (SEED_CATEGORIES) for new workspaces.
-- Never clobbers: INSERT OR IGNORE skips a workspace that already has the
-- English name, and NOT EXISTS skips one where the user already made a
-- category with the Hebrew name. Parent is resolved by name per workspace
-- (NULL when that workspace has no such group).
CREATE TEMP TABLE new_cats (name, he, parent, color, icon, kind, need, cost, description);
INSERT INTO new_cats VALUES
  ('Arnona','ארנונה','Home & Bills','#B8A98F','landmark','expense','need','fixed','Municipal property tax (ארנונה, עירייה).'),
  ('Building Committee','ועד בית','Home & Bills','#C2B59B','building','expense','need','fixed','Vaad bayit, building maintenance fees.'),
  ('Electricity','חשמל','Home & Bills','#E5C35C','zap','expense','need','fixed','Electricity bills (חברת החשמל, Electra Power, Cellcom Energy).'),
  ('Water','מים','Home & Bills','#65AFD2','droplet','expense','need','fixed','Water bills (תאגיד מים, מי אביבים, הגיחון).'),
  ('Gas','גז','Home & Bills','#E7A875','flame','expense','need','fixed','Cooking/heating gas (סופרגז, אמישראגז, פזגז).'),
  ('Internet & TV','אינטרנט וטלוויזיה','Home & Bills','#9186D1','wifi','expense','need','fixed','Home internet and TV (בזק, HOT, yes, פרטנר TV, סלקום TV).'),
  ('Mobile Phone','סלולר','Home & Bills','#7D90CA','smartphone','expense','need','fixed','Mobile plans (פרטנר, סלקום, פלאפון, גולן טלקום, הוט מובייל).'),
  ('Mortgage','משכנתא','Home & Bills','#D3A96F','home','expense','need','fixed','Monthly mortgage payments.'),
  ('Renovations','שיפוצים','Home & Bills','#BFB89B','hammer','expense','want','unplanned','Renovations, contractors, building materials (ACE, הום סנטר).'),
  ('Furniture','ריהוט','Home & Bills','#D6C480','sofa','expense','want','unplanned','Furniture and big home items (IKEA, ACE, עצמלה).'),
  ('Car Insurance','ביטוח רכב','Home & Bills','#E59A99','shield','expense','need','fixed','Car insurance premiums (חובה, מקיף, צד ג).'),
  ('Health Insurance','ביטוח בריאות','Home & Bills','#E58F8E','shield','expense','need','fixed','Private health insurance premiums.'),
  ('Life Insurance','ביטוח חיים','Home & Bills','#D98A89','shield','expense','need','fixed','Life and mortgage life insurance premiums.'),
  ('Health Fund','קופת חולים','Health & Family','#75BCA3','heart-pulse','expense','need','fixed','Kupat holim supplementary plans (כללית, מכבי, מאוחדת, לאומית).'),
  ('Medications','תרופות','Health & Family','#73C4A8','pill','expense','need','variable','Pharmacy medicines (סופר-פארם, בי פארם).'),
  ('Dentist','רופא שיניים','Health & Family','#92D5B7','stethoscope','expense','need','unplanned','Dental care and orthodontics.'),
  ('Daycare & After-school','צהרון וגן','Health & Family','#E5D080','baby','expense','need','fixed','Gan, daycare, tzaharon fees.'),
  ('Kids Activities','חוגים','Health & Family','#D6C480','ticket','expense','want','fixed','After-school classes and activities (חוגים).'),
  ('Tuition','שכר לימוד','Health & Family','#94A0DD','graduation-cap','expense','need','fixed','School and university tuition.'),
  ('Fuel','דלק','Transportation','#65C1D1','fuel','expense','need','variable','Fuel stations (פז, דלק, סונול, Ten, דור אלון).'),
  ('Parking','חניה','Transportation','#7D90CA','car','expense','need','variable','Parking (פנגו, סלופארק, אחוזות החוף).'),
  ('Public Transport','תחבורה ציבורית','Transportation','#65AFD2','tram-front','expense','need','variable','Rav-Kav, buses, trains, light rail.'),
  ('Car Test & License','טסט ורישוי','Transportation','#A2ABBB','car','expense','need','unplanned','Annual car test and vehicle license fee.'),
  ('Food Delivery','משלוחי אוכל','Food','#E89B80','bike','expense','want','variable','Food delivery apps (Wolt, תן ביס, משלוחה).'),
  ('Clothing & Shoes','ביגוד והנעלה','Lifestyle','#DCB87A','shirt','expense','want','variable','Clothes and shoes (קסטרו, פוקס, H&M, זארה).'),
  ('Cosmetics','קוסמטיקה','Lifestyle','#D5A4D7','sparkles','expense','want','variable','Cosmetics and toiletries.'),
  ('Books','ספרים','Lifestyle','#BF9ED9','book-open','expense','want','variable','Books (סטימצקי, צומת ספרים).'),
  ('Gifts & Events','מתנות ואירועים','Money Movement','#D692BF','gift','expense','want','unplanned','Gifts and event checks (weddings, bar mitzvahs).'),
  ('Donations','תרומות','Money Movement','#D67BAA','gift','expense','want','variable','Charity and donations.'),
  ('Bank Fees','עמלות בנק','Money Movement','#A2AAC2','percent','expense','need','variable','Bank and card fees (עמלה, דמי כרטיס).'),
  ('Interest','ריבית','Money Movement','#A2ABBB','percent','expense','need','variable','Interest charges on overdraft and credit.'),
  ('Income Tax','מס הכנסה','Money Movement','#7D90CA','landmark','expense','need','unplanned','Income tax payments.'),
  ('National Insurance','ביטוח לאומי','Money Movement','#65AFD2','landmark','expense','need','fixed','Bituach Leumi payments.'),
  ('Loans','הלוואות','Money Movement','#A2AAC2','banknote','expense','need','fixed','Loan repayments.'),
  ('Savings','חיסכון','Money Movement','#81B482','piggy-bank','expense','saving','fixed','Money moved to savings, kupat gemel, keren hishtalmut.'),
  ('Investments','השקעות','Money Movement','#7B85C9','trending-up','expense','saving','variable','Money moved to investments.'),
  ('Benefits & Allowances','קצבאות','','#85B59A','landmark','income','want','variable','Bituach Leumi allowances (קצבת ילדים, אבטלה, נכות).'),
  ('Tax Refunds','החזרי מס','','#7DC8B3','rotate-ccw','income','want','variable','Income tax refunds.'),
  ('Gifts Received','מתנות שהתקבלו','','#D692BF','gift','income','want','variable','Money received as a gift.');

INSERT OR IGNORE INTO categories
  (workspace_id, parent_id, name, color, icon, kind, description, need_type, cost_type)
SELECT w.id,
  (SELECT p.id FROM categories p
    WHERE p.workspace_id = w.id AND p.parent_id IS NULL AND p.name = n.parent),
  n.name, n.color, n.icon, n.kind, n.description, n.need, n.cost
FROM workspaces w CROSS JOIN new_cats n
WHERE NOT EXISTS (
  SELECT 1 FROM categories c WHERE c.workspace_id = w.id AND c.name = n.he
);

DROP TABLE new_cats;
