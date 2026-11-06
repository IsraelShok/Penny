// Life stages: plain checklists plus links out to official / כל-זכות pages.
// We never show benefit amounts or eligibility rules ourselves — the linked pages own that.

import type { Household, LifeEventType } from "./household";

export interface L { he: string; en: string }
export type LinkSource = "gov" | "kolzchut";
export interface LifeLink { title: L; url: string; source: LinkSource; lastChecked: string }
export interface LifeItem { id: string; text: L }
export interface LifeStage { id: string; title: L; intro: L; items: LifeItem[]; links: LifeLink[]; gentle?: boolean }

const CHECKED = "2026-11";
const btl = (title: L, path: string): LifeLink => ({ title, url: `https://www.btl.gov.il/benefits/${path}`, source: "gov", lastChecked: CHECKED });
const kz = (title: L, article: string): LifeLink => ({ title, url: `https://www.kolzchut.org.il/he/${encodeURIComponent(article)}`, source: "kolzchut", lastChecked: CHECKED });
const items = (stage: string, list: [string, string][]): LifeItem[] => list.map(([he, en], i) => ({ id: `${stage}-${i + 1}`, text: { he, en } }));

const SWIFTNESS: LifeLink = { title: { he: "המסלקה הפנסיונית — כל החסכונות במקום אחד", en: "Pension clearing house — all savings in one place" }, url: "https://www.swiftness.co.il/", source: "gov", lastChecked: CHECKED };
const TAX_REFUND = kz({ he: "החזר מס הכנסה", en: "Income tax refund" }, "החזר_מס_הכנסה");

export const LIFE_STAGES: LifeStage[] = [
  {
    id: "birth",
    title: { he: "לידה ותינוק", en: "Birth and baby" },
    intro: { he: "תקופה מרגשת. כמה צעדים קטנים עכשיו יחסכו דאגות בהמשך.", en: "An exciting time. A few small steps now save worry later." },
    items: items("birth", [
      ["לבדוק את מענק הלידה ואת דמי הלידה", "Check the birth grant and maternity pay"],
      ["לוודא שקצבת הילדים נכנסת לחשבון", "Make sure the child allowance is arriving"],
      ["לבחור מסלול ב״חיסכון לכל ילד״", "Choose a track for the child savings plan"],
      ["לתכנן את החודשים עם הכנסה נמוכה יותר בחופשה", "Plan the lower-income months of leave"],
      ["לקבוע תקציב חודשי לתינוק", "Set a monthly baby budget"],
    ]),
    links: [
      btl({ he: "מענק לידה", en: "Birth grant" }, "maternity/maanakleda/Pages/default.aspx"),
      btl({ he: "דמי לידה ואמהות", en: "Maternity benefits" }, "maternity/Pages/default.aspx"),
      btl({ he: "חיסכון לכל ילד", en: "Savings for every child" }, "children/HisahoLayeled/Pages/default.aspx"),
      kz({ he: "מענק לידה — הסבר", en: "Birth grant — explained" }, "מענק_לידה"),
      kz({ he: "דמי לידה — הסבר", en: "Maternity pay — explained" }, "דמי_לידה"),
    ],
  },
  {
    id: "kids",
    title: { he: "ילדים ובני נוער", en: "Kids and teens" },
    intro: { he: "ילדים גדלים, וגם ההוצאות. מעט סדר עוזר לכולם.", en: "Kids grow, and so do costs. A little order helps everyone." },
    items: items("kids", [
      ["לסכם דמי כיס קבועים", "Agree on regular pocket money"],
      ["לשים בצד לספטמבר ולקייטנות הקיץ", "Set money aside for September and summer camps"],
      ["לפתוח יעד לבר/בת מצווה אם רלוונטי", "Open a bar/bat mitzvah goal if relevant"],
      ["לדבר יחד על כסף בגובה העיניים", "Talk about money together, simply"],
    ]),
    links: [
      btl({ he: "ילדים — קצבאות", en: "Children — benefits" }, "children/Pages/default.aspx"),
      kz({ he: "קצבת ילדים", en: "Child allowance" }, "קצבת_ילדים"),
    ],
  },
  {
    id: "young",
    title: { he: "צבא, שחרור ולימודים", en: "Army, discharge and studies" },
    intro: { he: "ההתחלה של עצמאות כלכלית. אפשר ללמוד את זה צעד אחר צעד.", en: "The start of financial independence. You can learn it step by step." },
    items: items("young", [
      ["לבדוק את מענק השחרור ואת הפיקדון", "Check the discharge grant and deposit"],
      ["לתכנן תקציב סטודנט פשוט", "Make a simple student budget"],
      ["להבין איך עובד כרטיס אשראי לפני שמוציאים", "Understand how a credit card works before using it"],
      ["לקבוע תקרת מינוס — או בלי מינוס בכלל", "Set an overdraft limit — or none at all"],
      ["לפתוח קרן חירום קטנה", "Start a small emergency fund"],
    ]),
    links: [
      { title: { he: "האגף לחיילים משוחררים", en: "Discharged soldiers department" }, url: "https://www.hachvana.mod.gov.il/", source: "gov", lastChecked: CHECKED },
      btl({ he: "מענק לחייל משוחרר בעבודה מועדפת", en: "Grant for discharged soldiers in preferred work" }, "Demobilized_Soldier/Pages/default.aspx"),
      kz({ he: "מענק שחרור", en: "Discharge grant" }, "מענק_שחרור_לחיילים_משוחררים"),
      kz({ he: "זכויות סטודנטים", en: "Student rights" }, "סטודנטים"),
    ],
  },
  {
    id: "firstJob",
    title: { he: "עבודה ראשונה", en: "First job" },
    intro: { he: "משכורת ראשונה! זה הזמן להניח יסודות טובים.", en: "A first salary! A good time to lay solid foundations." },
    items: items("firstJob", [
      ["לעבור על תלוש השכר הראשון", "Go over the first payslip"],
      ["לוודא שהפנסיה נפתחה ולבדוק את דמי הניהול", "Make sure pension started and check the fees"],
      ["לשאול על קרן השתלמות", "Ask about a study fund (keren hishtalmut)"],
      ["לבנות קרן חירום של כמה חודשי הוצאות", "Build an emergency fund of a few months"],
    ]),
    links: [SWIFTNESS, TAX_REFUND],
  },
  {
    id: "movingIn",
    title: { he: "דירה ראשונה ושותפים", en: "Moving in and roommates" },
    intro: { he: "בית חדש מביא חשבונות חדשים. הסכמה מראש חוסכת אי-נעימות.", en: "A new home brings new bills. Agreeing early avoids friction." },
    items: items("movingIn", [
      ["לרשום את הפיקדון או הערבות ומתי הם חוזרים", "Note the deposit or guarantee and when it comes back"],
      ["להחליט איך מתחלקים בחשבונות", "Decide how to split the bills"],
      ["להעביר חשמל, מים וארנונה על שמכם", "Move electricity, water and city tax to your name"],
      ["לצלם את מצב הדירה בכניסה", "Photograph the flat on move-in"],
    ]),
    links: [],
  },
  {
    id: "couple",
    title: { he: "זוגיות וחתונה", en: "Couple and wedding" },
    intro: { he: "שני אנשים, תמונה כלכלית אחת — בקצב שנוח לכם.", en: "Two people, one money picture — at your own pace." },
    items: items("couple", [
      ["לשבת יחד על התמונה הכלכלית המלאה", "Sit together over the full money picture"],
      ["להחליט: משותף, נפרד או משולב", "Decide: joint, separate or mixed"],
      ["לפתוח יעד לחתונה אם מתכננים", "Open a wedding goal if planning one"],
      ["לרשום את הצ׳קים והמתנות", "Keep a list of gifts and cheques"],
      ["לעדכן מוטבים בפנסיה ובביטוחים", "Update beneficiaries on pension and insurance"],
    ]),
    links: [SWIFTNESS],
  },
  {
    id: "home",
    title: { he: "בית ומשכנתא", en: "Home and mortgage" },
    intro: { he: "החלטה גדולה, שאפשר לפרק לצעדים קטנים.", en: "A big decision you can break into small steps." },
    items: items("home", [
      ["להשוות שכירות מול קנייה במחשבון", "Compare renting and buying in the calculator"],
      ["לפתוח יעד להון עצמי", "Open a down-payment goal"],
      ["לבקש הצעות ממספר בנקים", "Get offers from several banks"],
      ["לרשום את מסלולי המשכנתא אחרי החתימה", "Record the mortgage tracks after signing"],
      ["לבדוק ביטוח חיים ומבנה", "Check life and building insurance"],
    ]),
    links: [kz({ he: "משכנתא", en: "Mortgage" }, "משכנתא")],
  },
  {
    id: "growingFamily",
    title: { he: "המשפחה גדלה", en: "The family grows" },
    intro: { he: "עוד ילד, עוד אהבה — ועוד כמה שורות בתקציב.", en: "Another child, more love — and a few more budget lines." },
    items: items("growingFamily", [
      ["לעבור שוב על רשימת הלידה", "Go through the birth checklist again"],
      ["לעדכן את התקציב לגודל המשפחה החדש", "Update the budget for the new family size"],
      ["לבדוק שהקצבה עודכנה לכל הילדים", "Check the allowance covers every child"],
      ["לעדכן מוטבים וצוואה", "Update beneficiaries and will"],
    ]),
    links: [
      btl({ he: "ילדים — קצבאות", en: "Children — benefits" }, "children/Pages/default.aspx"),
      kz({ he: "קצבת ילדים", en: "Child allowance" }, "קצבת_ילדים"),
    ],
  },
  {
    id: "career",
    title: { he: "שינוי בעבודה או פיטורים", en: "Career change or layoff" },
    intro: { he: "זה קשה, וזה זמני. נעשה את זה צעד אחד בכל פעם.", en: "This is hard, and it is temporary. One step at a time." },
    gentle: true,
    items: items("career", [
      ["להירשם בשירות התעסוקה כבר בימים הראשונים", "Register with the employment service in the first days"],
      ["לבדוק דמי אבטלה", "Check unemployment benefits"],
      ["לבדוק את מכתב הסיום, הפיצויים והפנסיה", "Check the end letter, severance and pension"],
      ["לראות לכמה חודשים הכסף מספיק", "See how many months your money covers"],
      ["לבחור 2–3 הוצאות להשהות זמנית", "Pick 2–3 costs to pause for now"],
    ]),
    links: [
      btl({ he: "אבטלה", en: "Unemployment" }, "Unemployment/Pages/default.aspx"),
      kz({ he: "דמי אבטלה", en: "Unemployment benefits" }, "דמי_אבטלה"),
      kz({ he: "סיום יחסי עבודה", en: "Ending employment" }, "פיטורים"),
    ],
  },
  {
    id: "freelance",
    title: { he: "עצמאות ועסק", en: "Freelance and business" },
    intro: { he: "הכנסה משתנה דורשת כרית — וקצת סדר בכל חודש.", en: "Changing income needs a cushion — and a little order each month." },
    items: items("freelance", [
      ["להפריד בין הוצאות העסק לבית", "Separate business and home spending"],
      ["לשים בצד בכל הכנסה למע״מ ולמס", "Set aside VAT and tax from every payment"],
      ["לקבוע ״משכורת״ קבועה לעצמכם", "Pay yourself a steady \"salary\""],
      ["לבדוק הפקדה לפנסיה ולקרן השתלמות", "Check pension and study-fund deposits"],
      ["לבנות כרית לחודשים חלשים", "Build a cushion for slow months"],
    ]),
    links: [SWIFTNESS, TAX_REFUND],
  },
  {
    id: "divorce",
    title: { he: "פרידה וגירושין", en: "Separation and divorce" },
    intro: { he: "תקופה רגישה. אין צורך לסדר הכול היום — רק את הצעד הבא.", en: "A tender time. No need to sort everything today — just the next step." },
    gentle: true,
    items: items("divorce", [
      ["לרשום את כל החשבונות, ההלוואות והחסכונות המשותפים", "List all joint accounts, loans and savings"],
      ["לפתוח חשבון על שמכם בלבד", "Open an account in your name only"],
      ["להבין את נושא המזונות", "Understand child support"],
      ["לבנות תקציב חדש לבית אחד", "Build a fresh budget for one home"],
      ["לעדכן מוטבים בפנסיה ובביטוחים", "Update beneficiaries on pension and insurance"],
    ]),
    links: [
      kz({ he: "גירושין — מידע כללי", en: "Divorce — overview" }, "גירושין"),
      kz({ he: "מזונות ילדים", en: "Child support" }, "מזונות_ילדים"),
      btl({ he: "מזונות דרך ביטוח לאומי", en: "Support via National Insurance" }, "Alimony/Pages/default.aspx"),
    ],
  },
  {
    id: "illness",
    title: { he: "מחלה או נכות", en: "Illness or disability" },
    intro: { he: "הבריאות קודמת. הכסף יכול לחכות — הנה רק מה שחשוב עכשיו.", en: "Health comes first. Money can wait — here is only what matters now." },
    gentle: true,
    items: items("illness", [
      ["לבדוק אילו ביטוחים יש לכם", "Check which insurance policies you have"],
      ["לרשום כל תביעה שהוגשה ומה הסטטוס שלה", "Track each claim filed and its status"],
      ["לבדוק קצבת נכות", "Check the disability allowance"],
      ["להעריך ירידה בהכנסה ולהתאים את התקציב", "Estimate the income dip and adjust the budget"],
      ["לבקש עזרה מבן משפחה עם הניירת", "Ask someone close to help with paperwork"],
    ]),
    links: [
      btl({ he: "נכות כללית", en: "General disability" }, "Disability/Pages/default.aspx"),
      kz({ he: "קצבת נכות כללית", en: "General disability allowance" }, "קצבת_נכות_כללית"),
      btl({ he: "הבטחת הכנסה", en: "Income support" }, "Income_support/Pages/default.aspx"),
    ],
  },
  {
    id: "parents",
    title: { he: "דאגה להורים", en: "Caring for parents" },
    intro: { he: "לדאוג למי שדאג לנו. כדאי לחלק את העומס.", en: "Caring for those who cared for us. Share the load." },
    items: items("parents", [
      ["לרשום את ההוצאות על ההורים", "Track spending on your parents"],
      ["לסכם עם האחים איך מתחלקים", "Agree with siblings how to share"],
      ["לבדוק גמלת סיעוד", "Check the long-term care allowance"],
      ["לדעת איפה המסמכים החשובים שלהם", "Know where their key documents are"],
    ]),
    links: [
      btl({ he: "סיעוד", en: "Long-term care" }, "Long_Term_Care/Pages/default.aspx"),
      kz({ he: "גמלת סיעוד", en: "Long-term care allowance" }, "גמלת_סיעוד"),
    ],
  },
  {
    id: "preRetirement",
    title: { he: "לקראת פרישה", en: "Getting ready to retire" },
    intro: { he: "עוד יש זמן לכוונן. כמה בדיקות פשוטות נותנות שקט.", en: "There is still time to fine-tune. A few checks bring peace of mind." },
    items: items("preRetirement", [
      ["להוריד את דוח המסלקה ולראות את כל החסכונות", "Download the clearing-house report and see all savings"],
      ["להשוות דמי ניהול", "Compare management fees"],
      ["לבדוק את גיל הפרישה שלכם", "Check your retirement age"],
      ["להעריך כמה תצטרכו בכל חודש", "Estimate what you will need each month"],
      ["לקבוע פגישה עם יועץ פנסיוני בלתי תלוי", "Book an independent pension adviser"],
    ]),
    links: [SWIFTNESS, kz({ he: "גיל פרישה", en: "Retirement age" }, "גיל_פרישה")],
  },
  {
    id: "retirement",
    title: { he: "פרישה", en: "Retirement" },
    intro: { he: "פרק חדש. המטרה: ״משכורת״ חודשית רגועה מהחסכונות.", en: "A new chapter. The aim: a calm monthly \"salary\" from savings." },
    items: items("retirement", [
      ["לבדוק קצבת זקנה", "Check the old-age pension"],
      ["לרשום את כל מקורות ההכנסה החודשיים", "List every monthly income source"],
      ["להחליט כמה למשוך מהחסכונות בכל חודש", "Decide how much to draw from savings monthly"],
      ["לבדוק אם מגיע לכם החזר מס", "Check whether you have a tax refund due"],
    ]),
    links: [
      btl({ he: "אזרח ותיק (קצבת זקנה)", en: "Senior citizen (old-age pension)" }, "old_age/Pages/default.aspx"),
      TAX_REFUND,
    ],
  },
  {
    id: "loss",
    title: { he: "אובדן", en: "Loss" },
    intro: { he: "אנחנו משתתפים בצערכם. אין כאן לחץ — רק מה שאפשר, כשאפשר.", en: "We are sorry for your loss. No pressure here — only what you can, when you can." },
    gentle: true,
    items: items("loss", [
      ["לבקש ממישהו קרוב לעזור עם הסידורים", "Ask someone close to help with arrangements"],
      ["לבדוק קצבת שאירים", "Check the survivors' benefit"],
      ["לרשום את החשבונות שצריך להעביר או לסגור", "List accounts to transfer or close"],
      ["לבדוק פוליסות ביטוח וחסכונות על שם הנפטר", "Check insurance and savings in their name"],
      ["לפשט את התקציב לחודשים הקרובים", "Keep the budget simple for the coming months"],
    ]),
    links: [
      btl({ he: "שאירים", en: "Survivors" }, "Survivors_%20Insurance/Pages/default.aspx"),
      kz({ he: "קצבת שאירים", en: "Survivors' benefit" }, "קצבת_שאירים"),
      SWIFTNESS,
    ],
  },
  {
    id: "estate",
    title: { he: "סדר לבני המשפחה", en: "Order for the family" },
    intro: { he: "מתנה של שקט למי שאוהבים אותנו. אפשר להתחיל במשהו קטן.", en: "A gift of calm to those who love us. Start with something small." },
    gentle: true,
    items: items("estate", [
      ["לכתוב צוואה או לעדכן קיימת", "Write a will or update one"],
      ["לבדוק מוטבים בפנסיה ובביטוחים", "Check beneficiaries on pension and insurance"],
      ["להכין מסמך ״איפה הכול נמצא״ למשפחה", "Prepare a \"where everything is\" document"],
      ["לרשום חשבונות דיגיטליים ומה לעשות בהם", "List digital accounts and what to do with them"],
    ]),
    links: [kz({ he: "צוואה", en: "Will" }, "צוואה"), SWIFTNESS],
  },
];

const EVENT_STAGE: Record<LifeEventType, string> = {
  birth: "birth", newChild: "growingFamily", firstJob: "firstJob", armyRelease: "young", movedIn: "movingIn",
  wedding: "couple", homePurchase: "home", jobLoss: "career", startedBusiness: "freelance", divorce: "divorce",
  illness: "illness", caringParent: "parents", retirement: "retirement", loss: "loss",
};
// Hard stages come first so they are never pushed out of the top 3.
const PRIORITY = ["loss", "illness", "divorce", "career", "birth", "growingFamily", "parents", "retirement", "preRetirement", "freelance", "young", "firstJob", "home", "couple", "movingIn", "kids", "estate"];
const RECENT_MONTHS = 24;

/** Stage ids that fit this household now, most pressing first. */
export function relevantStages(h: Household, today = new Date()): string[] {
  const year = today.getFullYear();
  const ids = new Set<string>();
  const cutoff = new Date(today); cutoff.setMonth(cutoff.getMonth() - RECENT_MONTHS);
  for (const e of h.events) if (!e.date || new Date(e.date) >= cutoff) ids.add(EVENT_STAGE[e.type]);
  for (const m of h.members) {
    if (m.role === "parent") ids.add("parents");
    if (m.birthYear == null) continue;
    const age = year - m.birthYear;
    if (m.role === "child" && age <= 1) ids.add("birth");
    else if (m.role === "child" && age < 18) ids.add("kids");
    if (age >= 18 && age <= 21) ids.add("young");
    if (m.role === "me" || m.role === "partner") {
      if (age >= 67) ids.add("retirement");
      else if (age >= 50) ids.add("preRetirement");
    }
  }
  if (h.incomeShape === "freelancer" || h.incomeShape === "mixed") ids.add("freelance");
  if (h.incomeShape === "pension") ids.add("retirement");
  return PRIORITY.filter((id) => ids.has(id));
}

/** Validates stored checklist progress: { stageId: itemId[] }, known ids only. */
export function parseProgress(raw: unknown): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  if (!raw || typeof raw !== "object") return out;
  for (const s of LIFE_STAGES) {
    const v = (raw as Record<string, unknown>)[s.id];
    if (!Array.isArray(v)) continue;
    const done = s.items.map((i) => i.id).filter((id) => v.includes(id));
    if (done.length) out[s.id] = done;
  }
  return out;
}
