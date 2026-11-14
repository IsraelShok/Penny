import type Database from "better-sqlite3";

/** Migration that runs applyCategoryHierarchy on existing installs. */
export const CATEGORY_HIERARCHY_MIGRATION = "048_category_hierarchy.sql";

type Kind = "expense" | "income";
interface Parent { name: string; he: string; color: string; icon: string; kind: Kind }
interface Leaf { name: string; he: string; parent: string; color: string; icon: string; kind: Kind; need: "need" | "want" | "saving"; cost: "fixed" | "variable" | "unplanned"; description: string }

/** Top-level groups, each on its own OKLCH hue (L 0.70, C 0.16; Money Movement is neutral). Subcategory shades come from category-colors.ts.
 *  The first six already exist on older installs (017); names stay English in the DB, labels come from i18n. */
export const CATEGORY_PARENTS: Parent[] = [
  { name: "Home & Bills", he: "דיור וחשבונות", color: "#D28F0E", icon: "home", kind: "expense" },
  { name: "Food", he: "מזון", color: "#EB7C33", icon: "utensils-crossed", kind: "expense" },
  { name: "Transportation", he: "תחבורה", color: "#12ACE6", icon: "tram-front", kind: "expense" },
  { name: "Health & Family", he: "בריאות", color: "#1CB3BF", icon: "heart-pulse", kind: "expense" },
  { name: "Kids & Education", he: "ילדים וחינוך", color: "#B49F03", icon: "baby", kind: "expense" },
  { name: "Leisure & Fun", he: "פנאי ובילוי", color: "#9E8AFA", icon: "ticket", kind: "expense" },
  { name: "Clothing & Grooming", he: "ביגוד וטיפוח", color: "#C27DE3", icon: "shirt", kind: "expense" },
  { name: "Insurances", he: "ביטוחים", color: "#F17074", icon: "shield", kind: "expense" },
  { name: "Telecom & Subscriptions", he: "תקשורת ומנויים", color: "#689CFE", icon: "wifi", kind: "expense" },
  { name: "Pets", he: "חיות מחמד", color: "#07B89B", icon: "paw-print", kind: "expense" },
  { name: "Gifts & Giving", he: "מתנות ותרומות", color: "#EA6F9E", icon: "gift", kind: "expense" },
  { name: "Money Movement", he: "כספים ועמלות", color: "#A3ACB8", icon: "arrow-left-right", kind: "expense" },
  { name: "Savings & Investing", he: "חיסכון והשקעות", color: "#43B966", icon: "piggy-bank", kind: "expense" },
  { name: "Lifestyle", he: "קניות ואחר", color: "#DA74C4", icon: "sparkles", kind: "expense" },
  { name: "Income Sources", he: "הכנסות", color: "#81B033", icon: "briefcase", kind: "income" },
];

/** Subcategories added by 048 (skipped when the workspace already has the English or Hebrew name). */
export const NEW_LEAVES: Leaf[] = [
  { name: "Bakery", he: "מאפייה", parent: "Food", color: "#D3A96F", icon: "coffee", kind: "expense", need: "want", cost: "variable", description: "Bakeries and pastry shops (מאפייה, רולדין)." },
  { name: "Taxis", he: "מוניות", parent: "Transportation", color: "#E5C35C", icon: "car", kind: "expense", need: "want", cost: "variable", description: "Taxis and ride apps (Gett, Yango)." },
  { name: "Car Maintenance", he: "טיפולי רכב", parent: "Transportation", color: "#A2AAC2", icon: "hammer", kind: "expense", need: "need", cost: "unplanned", description: "Garage, car service, tires, car wash." },
  { name: "Rent", he: "שכר דירה", parent: "Home & Bills", color: "#C29B6F", icon: "home", kind: "expense", need: "need", cost: "fixed", description: "Monthly rent payments." },
  { name: "Cleaning", he: "ניקיון ועוזרת בית", parent: "Home & Bills", color: "#92D5B7", icon: "sparkles", kind: "expense", need: "want", cost: "fixed", description: "Cleaners, house help, cleaning supplies." },
  { name: "Optics", he: "אופטיקה", parent: "Health & Family", color: "#65AFD2", icon: "stethoscope", kind: "expense", need: "need", cost: "unplanned", description: "Glasses, contact lenses, eye exams." },
  { name: "School Supplies", he: "ציוד לבית ספר", parent: "Kids & Education", color: "#94A0DD", icon: "graduation-cap", kind: "expense", need: "need", cost: "unplanned", description: "School bags, books, stationery." },
  { name: "Kids Clothing", he: "ביגוד ילדים", parent: "Kids & Education", color: "#DCB87A", icon: "shirt", kind: "expense", need: "need", cost: "variable", description: "Children's clothes and shoes." },
  { name: "Pocket Money", he: "דמי כיס", parent: "Kids & Education", color: "#C0D582", icon: "banknote", kind: "expense", need: "want", cost: "fixed", description: "Allowance given to the kids." },
  { name: "Haircuts", he: "מספרה", parent: "Clothing & Grooming", color: "#BF9ED9", icon: "sparkles", kind: "expense", need: "want", cost: "variable", description: "Hair salons and barbershops." },
  { name: "Streaming", he: "סטרימינג", parent: "Telecom & Subscriptions", color: "#AB9DDB", icon: "refresh-cw", kind: "expense", need: "want", cost: "fixed", description: "Netflix, Disney+, Spotify, Apple Music." },
  { name: "Vet", he: "וטרינר", parent: "Pets", color: "#73C4A8", icon: "stethoscope", kind: "expense", need: "need", cost: "unplanned", description: "Veterinary visits and treatments." },
  { name: "Pet Food", he: "מזון לחיות", parent: "Pets", color: "#A4C386", icon: "paw-print", kind: "expense", need: "need", cost: "variable", description: "Pet food and supplies." },
  { name: "Electronics", he: "אלקטרוניקה", parent: "Lifestyle", color: "#7D90CA", icon: "smartphone", kind: "expense", need: "want", cost: "unplanned", description: "Phones, computers, gadgets (KSP, Ivory, באג)." },
  { name: "Rental Income", he: "הכנסה משכירות", parent: "Income Sources", color: "#C0D582", icon: "home", kind: "income", need: "want", cost: "fixed", description: "Rent received from a property." },
  { name: "Pension", he: "פנסיה", parent: "Income Sources", color: "#7B85C9", icon: "landmark", kind: "income", need: "want", cost: "fixed", description: "Monthly pension payments." },
];

/** Built-in subcategory -> parent. User-created categories are never moved. */
export const CATEGORY_PARENT_OF: Record<string, string> = {
  ...Object.fromEntries(NEW_LEAVES.map((l) => [l.name, l.parent])),
  Groceries: "Food", Restaurants: "Food", "Coffee & Cafes": "Food", "Food Delivery": "Food",
  Transport: "Transportation", Fuel: "Transportation", Parking: "Transportation", "Public Transport": "Transportation", "Car Test & License": "Transportation", "Car Insurance": "Transportation",
  "Bills & Utilities": "Home & Bills", Home: "Home & Bills", Arnona: "Home & Bills", "Building Committee": "Home & Bills", Electricity: "Home & Bills", Water: "Home & Bills", Gas: "Home & Bills", Mortgage: "Home & Bills", Renovations: "Home & Bills", Furniture: "Home & Bills",
  Health: "Health & Family", "Health Fund": "Health & Family", Medications: "Health & Family", Dentist: "Health & Family",
  Education: "Kids & Education", "Kids & Childcare": "Kids & Education", "Daycare & After-school": "Kids & Education", "Kids Activities": "Kids & Education", Tuition: "Kids & Education",
  Entertainment: "Leisure & Fun", "Sports & Hobbies": "Leisure & Fun", Travel: "Leisure & Fun", Books: "Leisure & Fun",
  "Clothing & Shoes": "Clothing & Grooming", "Personal Care": "Clothing & Grooming", Cosmetics: "Clothing & Grooming",
  Insurance: "Insurances", "Health Insurance": "Insurances", "Life Insurance": "Insurances",
  "Internet & TV": "Telecom & Subscriptions", "Mobile Phone": "Telecom & Subscriptions", Subscriptions: "Telecom & Subscriptions",
  "Pet Care": "Pets",
  "Gifts & Donations": "Gifts & Giving", "Gifts & Events": "Gifts & Giving", Donations: "Gifts & Giving",
  "Cash & ATM": "Money Movement", Transfers: "Money Movement", "Fees & Taxes": "Money Movement", "Bank Fees": "Money Movement", Interest: "Money Movement", "Income Tax": "Money Movement", "National Insurance": "Money Movement", Loans: "Money Movement",
  Savings: "Savings & Investing", Investments: "Savings & Investing",
  Shopping: "Lifestyle",
  Salary: "Income Sources", "Freelance & Side Income": "Income Sources", "Investment Income": "Income Sources", "Refunds & Reimbursements": "Income Sources", "Benefits & Allowances": "Income Sources", "Tax Refunds": "Income Sources", "Gifts Received": "Income Sources",
};

/**
 * Builds the two-level tree in one workspace (or all): ensures the parents, adds missing
 * subcategories, and re-points built-in subcategories. Idempotent and non-destructive:
 * transactions, budgets and rules keep their category ids; nothing is deleted.
 */
export function applyCategoryHierarchy(db: Database.Database, workspaceId?: number): void {
  const workspaces = workspaceId != null ? [workspaceId] : (db.prepare("SELECT id FROM workspaces").all() as { id: number }[]).map((w) => w.id);
  const find = db.prepare("SELECT id, parent_id AS parentId, kind FROM categories WHERE workspace_id = ? AND name IN (?, ?)");
  const hasTxns = db.prepare("SELECT 1 FROM transactions WHERE category_id = ? LIMIT 1");
  const insert = db.prepare("INSERT INTO categories (workspace_id, parent_id, name, color, icon, kind, budget_mode, description, need_type, cost_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
  const isParent = db.prepare("SELECT 1 FROM categories WHERE parent_id = ? LIMIT 1");
  const setParent = db.prepare("UPDATE categories SET parent_id = ? WHERE id = ?");

  for (const ws of workspaces) {
    const parentIds = new Map<string, number>();
    for (const p of CATEGORY_PARENTS) {
      const row = find.get(ws, p.name, p.he) as { id: number; parentId: number | null; kind: Kind } | undefined;
      if (!row) {
        parentIds.set(p.name, Number(insert.run(ws, null, p.name, p.color, p.icon, p.kind, "tracking", null, "want", "variable").lastInsertRowid));
      } else if (row.parentId == null && row.kind === p.kind && !hasTxns.get(row.id)) {
        parentIds.set(p.name, row.id); // existing group (or an empty look-alike the user made)
      } // else: a used leaf has this name, so that group is skipped and its children stay put
    }
    for (const l of NEW_LEAVES) {
      if (find.get(ws, l.name, l.he)) continue;
      insert.run(ws, parentIds.get(l.parent) ?? null, l.name, l.color, l.icon, l.kind, "budgeted", l.description, l.need, l.cost);
    }
    for (const [child, parent] of Object.entries(CATEGORY_PARENT_OF)) {
      const pid = parentIds.get(parent);
      const row = find.get(ws, child, child) as { id: number; parentId: number | null; kind: Kind } | undefined;
      const parentKind = CATEGORY_PARENTS.find((p) => p.name === parent)!.kind;
      if (!pid || !row || row.id === pid || row.kind !== parentKind || isParent.get(row.id)) continue;
      setParent.run(pid, row.id);
    }
  }
}
