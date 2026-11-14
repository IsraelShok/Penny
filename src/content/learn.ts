/**
 * Knowledge center: short, original articles in plain language, each tied to a calculator.
 * General education, not personal advice. Figures that change yearly stay vague or come from il-defaults.
 */

export type Topic = "basics" | "debt" | "investing" | "home" | "car" | "retirement" | "family";
type Text = { he: string; en: string };

export interface Article {
  slug: string;
  topic: Topic;
  minutes: number;
  title: Text;
  summary: Text;
  sections: { heading: Text; body: Text[] }[];
  takeaway: Text;
  calculator?: { href: string; label: Text };
}

export const TOPICS: Topic[] = ["basics", "debt", "investing", "home", "car", "retirement", "family"];

export const ARTICLES: Article[] = [
  {
    slug: "emergency-fund",
    topic: "basics",
    minutes: 3,
    title: { he: "קרן חירום: הצעד הראשון", en: "Emergency fund: the first step" },
    summary: { he: "למה כדאי שיהיו בצד 3 עד 6 חודשי הוצאות, ואיפה לשמור אותם.", en: "Why to keep 3 to 6 months of spending aside, and where to keep it." },
    sections: [
      {
        heading: { he: "למה זה הכי חשוב", en: "Why it comes first" },
        body: [
          { he: "קרן חירום היא כסף שמחכה להפתעות: מקרר שהתקלקל, תקופה בלי עבודה, טיפול שיניים. בלעדיה כל הפתעה הופכת למינוס או להלוואה יקרה.", en: "An emergency fund is money waiting for surprises: a broken fridge, a gap between jobs, a dental bill. Without it, every surprise becomes an overdraft or an expensive loan." },
          { he: "כשיש קרן חירום, אפשר להשקיע את שאר הכסף לטווח ארוך בראש שקט, בלי לפחד שתצטרכו למכור בזמן ירידות.", en: "With one in place you can invest the rest for the long run calmly, without fearing you will have to sell in a downturn." },
        ],
      },
      {
        heading: { he: "כמה ואיפה", en: "How much and where" },
        body: [
          { he: "יעד מקובל הוא 3 חודשי הוצאות לשכירים עם הכנסה יציבה, ו-6 חודשים לעצמאים או למשפחה עם הכנסה אחת.", en: "A common target is 3 months of spending for salaried people with steady income, and 6 for the self-employed or single-income families." },
          { he: "שומרים אותה במקום נזיל ובטוח: פיקדון קצר או קרן כספית. לא במניות, כי היא צריכה להיות שם בדיוק כשהשוק יורד.", en: "Keep it liquid and safe: a short deposit or a money-market fund. Not in stocks, because it must be there exactly when markets fall." },
        ],
      },
    ],
    takeaway: { he: "מתחילים מחודש אחד של הוצאות, ומוסיפים כל חודש סכום קבוע עד שמגיעים ליעד.", en: "Start with one month of spending, and add a fixed amount every month until you reach the target." },
    calculator: { href: "/calculators/growth", label: { he: "כמה ייקח לחסוך את זה", en: "How long it takes to save it" } },
  },
  {
    slug: "overdraft",
    topic: "debt",
    minutes: 4,
    title: { he: "לצאת מהמינוס", en: "Getting out of the overdraft" },
    summary: { he: "המינוס הוא אחת ההלוואות היקרות בישראל. ככה סוגרים אותו בלי לחזור אליו.", en: "An overdraft is one of the most expensive loans in Israel. Here is how to close it for good." },
    sections: [
      {
        heading: { he: "למה המינוס כל כך יקר", en: "Why it costs so much" },
        body: [
          { he: "ריבית על מינוס גבוהה בהרבה מריבית על הלוואה רגילה, והיא נגבית בשקט כל חודש. מינוס קבוע של כמה אלפי שקלים יכול לעלות מאות שקלים בשנה, בלי שמרגישים.", en: "Overdraft interest is far higher than a regular loan's, and it is charged quietly every month. A standing overdraft of a few thousand shekels can cost hundreds a year without you noticing." },
        ],
      },
      {
        heading: { he: "שלושה צעדים", en: "Three steps" },
        body: [
          { he: "1. רואים את התמונה: כמה מינוס, באיזו ריבית, וכמה נכנס ויוצא כל חודש.", en: "1. See the picture: how much overdraft, at what rate, and what comes in and goes out each month." },
          { he: "2. אם המינוס גדול, שוקלים להחליף אותו בהלוואה בריבית נמוכה יותר עם החזר חודשי קבוע. ההחזר הקבוע הוא מה שסוגר אותו.", en: "2. If it is large, consider replacing it with a cheaper loan with a fixed monthly payment. The fixed payment is what actually closes it." },
          { he: "3. מקטינים את מסגרת האשראי בהדרגה, כדי שלא יהיה לאן לחזור.", en: "3. Lower the credit line step by step, so there is nowhere to slide back to." },
        ],
      },
    ],
    takeaway: { he: "סוגרים קודם את החוב עם הריבית הגבוהה ביותר. בדרך כלל זה המינוס או כרטיס האשראי.", en: "Pay off the highest-rate debt first. Usually that is the overdraft or the credit card." },
    calculator: { href: "/calculators/debt", label: { he: "תוכנית יציאה מחובות", en: "Debt payoff plan" } },
  },
  {
    slug: "index-funds",
    topic: "investing",
    minutes: 5,
    title: { he: "קרן מחקה מדד: השקעה פשוטה לטווח ארוך", en: "Index funds: simple long-term investing" },
    summary: { he: "למה הרבה משקיעים בוחרים לקנות את כל השוק בדמי ניהול נמוכים במקום לנחש מניות.", en: "Why many investors buy the whole market at a low fee instead of picking stocks." },
    sections: [
      {
        heading: { he: "מה זה", en: "What it is" },
        body: [
          { he: "קרן מחקה מדד קונה את כל המניות במדד, למשל 500 החברות הגדולות בארה״ב או מדד עולמי. אתם לא מנחשים מי ינצח, אלא מקבלים את הממוצע של כל השוק.", en: "An index fund buys every stock in an index, such as the 500 largest US companies or a world index. You don't guess the winners; you get the average of the whole market." },
          { he: "לאורך עשרות שנים רוב מנהלי ההשקעות האקטיביים לא הצליחו לנצח את המדד אחרי דמי ניהול.", en: "Over decades, most active managers have failed to beat the index after fees." },
        ],
      },
      {
        heading: { he: "מה חשוב לבדוק", en: "What to check" },
        body: [
          { he: "דמי ניהול: הפרש של אחוז אחד בשנה יכול לאכול כרבע מהחיסכון אחרי 30 שנה.", en: "Fees: one percentage point a year can eat about a quarter of the savings after 30 years." },
          { he: "פיזור: מדד רחב (עולמי או ארה״ב הרחב) מפוזר יותר ממדד של ענף אחד.", en: "Spread: a broad index (world or total US) is more diversified than a single-sector one." },
          { he: "זמן: השקעה במניות מתאימה לכסף שלא תצטרכו בחמש השנים הקרובות לפחות. בדרך יהיו ירידות. מי שממשיך להשקיע בהן מרוויח מהן.", en: "Time: stocks suit money you won't need for at least five years. There will be drops on the way; people who keep investing through them benefit." },
        ],
      },
    ],
    takeaway: { he: "קרן מדד רחבה, דמי ניהול נמוכים, הפקדה קבועה כל חודש, ולא לגעת. זו כל השיטה.", en: "A broad index fund, low fees, a fixed deposit every month, and leave it alone. That is the whole method." },
    calculator: { href: "/calculators/growth", label: { he: "כמה ההשקעה תגדל", en: "How much it could grow" } },
  },
  {
    slug: "gemel-and-hishtalmut",
    topic: "investing",
    minutes: 5,
    title: { he: "קופת גמל להשקעה וקרן השתלמות", en: "Investment provident fund and study fund" },
    summary: { he: "שני כלים ישראליים עם הטבות מס שכדאי להכיר לפני שפותחים תיק השקעות.", en: "Two Israeli tools with tax benefits worth knowing before opening a brokerage account." },
    sections: [
      {
        heading: { he: "קרן השתלמות", en: "Study fund (קרן השתלמות)" },
        body: [
          { he: "לשכירים, המעסיק מפקיד ברוב המקרים 7.5% מהשכר ואתם 2.5%. אחרי שש שנים אפשר למשוך את הכסף, והרווחים פטורים ממס עד תקרת השכר שקבועה בחוק.", en: "For employees, the employer usually deposits 7.5% of salary and you 2.5%. After six years it can be withdrawn, with gains tax-free up to the legal salary ceiling." },
          { he: "זו אחת ההטבות הטובות בישראל. אם המעסיק לא מציע אותה, כדאי לבקש.", en: "It is one of Israel's best benefits; if your employer doesn't offer it, ask." },
        ],
      },
      {
        heading: { he: "קופת גמל להשקעה", en: "Investment provident fund (קופת גמל להשקעה)" },
        body: [
          { he: "חיסכון נזיל שאפשר למשוך בכל זמן, ומשלמים מס רווחי הון רק במשיכה. ההעברה בין מסלולים וחברות לא נחשבת מכירה, ולכן לא משלמים עליה מס.", en: "A liquid savings account you can withdraw any time, paying capital-gains tax only on withdrawal. Switching tracks or providers isn't a sale, so it isn't taxed." },
          { he: "מגיל 60 אפשר למשוך כקצבה חודשית בלי מס על הרווחים. יש תקרת הפקדה שנתית.", en: "From 60 it can be taken as a monthly annuity with no tax on gains. There is an annual deposit cap." },
        ],
      },
    ],
    takeaway: { he: "קודם ממצים קרן השתלמות, אחר כך שוקלים קופת גמל להשקעה, ורק אחר כך תיק השקעות רגיל.", en: "Max the study fund first, then consider an investment provident fund, and only then a regular brokerage account." },
    calculator: { href: "/fi", label: { he: "גמל מול תיק השקעות", en: "Provident fund vs brokerage" } },
  },
  {
    slug: "mortgage-tracks",
    topic: "home",
    minutes: 5,
    title: { he: "תמהיל משכנתא בלי כאב ראש", en: "Mortgage mix without the headache" },
    summary: { he: "פריים, קבועה וצמודה: מה ההבדל, ואיך בונים תמהיל שלא יפתיע.", en: "Prime, fixed and CPI-linked: the difference, and how to build a mix that won't surprise you." },
    sections: [
      {
        heading: { he: "שלושת המסלולים", en: "The three tracks" },
        body: [
          { he: "פריים: הריבית זזה עם ריבית בנק ישראל. אפשר לפרוע בלי קנס, אבל ההחזר יכול לעלות.", en: "Prime: the rate moves with the Bank of Israel rate. It can be repaid without a penalty, but the payment can rise." },
          { he: "קבועה לא צמודה: ההחזר ידוע מראש עד הסוף. הריבית בדרך כלל גבוהה יותר.", en: "Fixed, unlinked: the payment is known to the end. The rate is usually higher." },
          { he: "קבועה צמודה: מתחילה בריבית נמוכה, אבל היתרה גדלה עם המדד. עם אינפלציה, ההחזר עולה עם השנים.", en: "Fixed, CPI-linked: starts at a lower rate, but the balance grows with the index. With inflation, payments climb over the years." },
        ],
      },
      {
        heading: { he: "כללי אצבע", en: "Rules of thumb" },
        body: [
          { he: "בנק ישראל מחייב שלפחות שליש מהמשכנתא יהיה בריבית קבועה.", en: "The Bank of Israel requires at least a third of the mortgage at a fixed rate." },
          { he: "בודקים מבחן לחץ: מה קורה להחזר אם הפריים עולה בשתי נקודות. אם גם אז זה נוח, התמהיל בטוח.", en: "Run a stress test: what happens to the payment if prime rises by two points. If it still fits, the mix is safe." },
          { he: "משווים הצעות מכמה בנקים. הבדל קטן בריבית שווה עשרות אלפי שקלים לאורך הדרך.", en: "Compare offers from several banks. A small rate difference is worth tens of thousands of shekels over the life of the loan." },
        ],
      },
    ],
    takeaway: { he: "בונים תמהיל שאפשר לעמוד בו גם בתרחיש רע, לא רק בהחזר הנמוך ביותר היום.", en: "Build a mix you can carry in a bad scenario too, not just the lowest payment today." },
    calculator: { href: "/calculators/mortgage", label: { he: "מחשבון משכנתא", en: "Mortgage calculator" } },
  },
  {
    slug: "discounted-home",
    topic: "home",
    minutes: 4,
    title: { he: "דירה בהנחה: מתי זה באמת משתלם", en: "Discounted home: when it really pays" },
    summary: { he: "ההנחה מושכת, אבל ההמתנה, השכירות וההצמדה משנות את החשבון.", en: "The discount is attractive, but the wait, the rent and the index linkage change the math." },
    sections: [
      {
        heading: { he: "מה מקבלים", en: "What you get" },
        body: [
          { he: "בתוכנית דירה בהנחה (לשעבר מחיר למשתכן) קונים דירה חדשה מתחת למחיר השוק, עם תקרת הנחה. משתתפים בהגרלה, ויש תנאי זכאות שכדאי לבדוק באתר הרשמי.", en: "In the Dira BeHanacha program (formerly Mehir LaMishtaken) you buy a new apartment below market price, up to a discount cap, through a lottery with eligibility rules worth checking on the official site." },
        ],
      },
      {
        heading: { he: "מה עולה כסף בדרך", en: "What costs money on the way" },
        body: [
          { he: "שנים של המתנה למפתח, ובהן ממשיכים לשלם שכירות.", en: "Years waiting for the keys, while you keep paying rent." },
          { he: "הצמדה למדד תשומות הבנייה על החלק שעוד לא שולם.", en: "Linkage to the construction index on the part not yet paid." },
          { he: "מגבלות על מכירה ועל השכרה בשנים הראשונות.", en: "Limits on selling and renting in the first years." },
        ],
      },
    ],
    takeaway: { he: "משווים מה המצב אחרי עשר שנים, לא רק את ההנחה. בזמן ההמתנה ההון העצמי צריך לעבוד, לא לשכב.", en: "Compare where you stand after ten years, not just the discount. While you wait, keep the equity working, not idle." },
    calculator: { href: "/discounted-home", label: { he: "דירה בהנחה מול שוק חופשי", en: "Discounted home vs market" } },
  },
  {
    slug: "electric-car",
    topic: "car",
    minutes: 4,
    title: { he: "רכב חשמלי או בנזין?", en: "Electric or petrol?" },
    summary: { he: "המחיר במודעה הוא רק חלק מהסיפור. זה מה שבאמת קובע את העלות.", en: "The sticker price is only part of the story. Here is what really drives the cost." },
    sections: [
      {
        heading: { he: "איפה חשמלי חוסך", en: "Where electric saves" },
        body: [
          { he: "טעינה בבית זולה בהרבה מדלק לכל קילומטר. בחשמלי גם יש פחות חלקים נעים, ולכן הטיפולים זולים יותר.", en: "Charging at home is much cheaper per km than fuel, and fewer moving parts mean cheaper servicing." },
          { he: "ככל שנוסעים יותר קילומטרים בשנה, החיסכון גדל.", en: "The more you drive each year, the bigger the saving." },
        ],
      },
      {
        heading: { he: "איפה הוא עולה יותר", en: "Where it costs more" },
        body: [
          { he: "מחיר קנייה, ביטוח ולעתים ירידת ערך מהירה יותר כשיוצאים דגמים חדשים.", en: "Purchase price, insurance and sometimes faster depreciation as newer models arrive." },
          { he: "בלי טעינה בבית, טעינה ציבורית מצמצמת חלק גדול מהחיסכון.", en: "Without home charging, public charging erases much of the saving." },
        ],
      },
      {
        heading: { he: "והכסף ששילמתם", en: "And the money you paid" },
        body: [
          { he: "כסף ששילמתם על רכב מפסיק להרוויח. רכב זול יותר והשקעה של ההפרש הם לפעמים ההחלטה הכלכלית הכי טובה.", en: "Money paid for a car stops earning. A cheaper car and investing the difference is sometimes the best decision of all." },
        ],
      },
    ],
    takeaway: { he: "משווים עלות כוללת לשנות ההחזקה, לפי הקילומטרז' ואפשרויות הטעינה שלכם.", en: "Compare the total cost over the years you will keep it, using your own mileage and charging options." },
    calculator: { href: "/car", label: { he: "מחשבון עלות רכב", en: "Car cost calculator" } },
  },
  {
    slug: "pension-fees",
    topic: "retirement",
    minutes: 4,
    title: { he: "דמי ניהול בפנסיה: חמש דקות ששוות הרבה", en: "Pension fees: five minutes worth a lot" },
    summary: { he: "דמי ניהול נראים קטנים, אבל לאורך שנים הם מצטברים לסכום ענק.", en: "Fees look small, but over decades they add up to a huge sum." },
    sections: [
      {
        heading: { he: "שני סוגי דמי ניהול", en: "Two kinds of fees" },
        body: [
          { he: "מההפקדה: אחוז מכל הפקדה חודשית. מהצבירה: אחוז מכל מה שכבר נצבר, כל שנה. לאורך זמן דמי הניהול מהצבירה כבדים יותר.", en: "From deposits: a percentage of each monthly deposit. From the balance: a percentage of everything saved, every year. Over time the balance fee weighs more." },
          { he: "החוק קובע תקרה, אבל אפשר לקבל הרבה פחות ממנה, ולפעמים מספיקה שיחת טלפון.", en: "The law sets a cap, but you can get far below it, sometimes with one phone call." },
        ],
      },
      {
        heading: { he: "מה עושים", en: "What to do" },
        body: [
          { he: "בודקים בדוח השנתי או במסלקה הפנסיונית כמה משלמים, משווים לממוצע ומבקשים הנחה. אם לא מקבלים, עוברים קרן. המעבר לא עולה כסף.", en: "Check the annual statement or the pension clearing house, compare with the average and ask for a discount. If refused, switch funds; switching costs nothing." },
          { he: "מוודאים שמסלול ההשקעה מתאים לגיל. צעירים יכולים להחזיק יותר מניות.", en: "Make sure the investment track fits your age; younger savers can hold more stocks." },
        ],
      },
    ],
    takeaway: { he: "חצי אחוז פחות דמי ניהול מהצבירה יכול להוסיף עשרות אלפי שקלים לפנסיה.", en: "Half a point less in balance fees can add tens of thousands of shekels to your pension." },
    calculator: { href: "/fi", label: { he: "השוואת דמי ניהול", en: "Fee comparison" } },
  },
  {
    slug: "tax-refund",
    topic: "basics",
    minutes: 3,
    title: { he: "החזר מס: כסף שאולי מחכה לכם", en: "Tax refund: money that may be waiting for you" },
    summary: { he: "הרבה שכירים זכאים להחזר מס ולא יודעים. אפשר לבקש אותו כמה שנים אחורה.", en: "Many employees are owed a refund and don't know it. You can claim several years back." },
    sections: [
      {
        heading: { he: "מתי זה קורה", en: "When it happens" },
        body: [
          { he: "החלפתם עבודה באמצע שנה, עבדתם רק חלק מהשנה, נולד ילד, תרמתם לעמותה, סיימתם תואר, או הפקדתם לפנסיה באופן עצמאי.", en: "You changed jobs mid-year, worked part of the year, had a child, donated to a charity, finished a degree, or made private pension deposits." },
        ],
      },
      {
        heading: { he: "איך מבקשים", en: "How to claim" },
        body: [
          { he: "מגישים בקשה לרשות המסים, אפשר באתר שלה. אפשר לבקש עד שש שנים אחורה. מצרפים טופסי 106 מכל מעסיק וקבלות על תרומות.", en: "File a request with the Tax Authority, online. You can claim up to six years back. Attach form 106 from each employer and donation receipts." },
          { he: "חברות שעושות את זה בשבילכם לוקחות אחוז מההחזר. ברוב המקרים אפשר להסתדר לבד.", en: "Companies that do it for you take a cut of the refund; most cases can be done alone." },
        ],
      },
    ],
    takeaway: { he: "אם היה בשנה האחרונה שינוי בחיים או בעבודה, שווה לבדוק.", en: "If anything changed in your life or job last year, it is worth checking." },
    calculator: { href: "/fi", label: { he: "מחשבון משכורת נטו", en: "Take-home pay calculator" } },
  },
  {
    slug: "kids-savings",
    topic: "family",
    minutes: 3,
    title: { he: "חיסכון לכל ילד", en: "Savings for every child" },
    summary: { he: "ביטוח לאומי חוסך כל חודש בשביל כל ילד. כדאי לבחור איפה הכסף ינוהל.", en: "Bituach Leumi saves every month for each child. Choose where it is managed." },
    sections: [
      {
        heading: { he: "איך זה עובד", en: "How it works" },
        body: [
          { he: "ביטוח לאומי מפקיד סכום חודשי לחשבון חיסכון על שם הילד. ההורים יכולים להכפיל את ההפקדה מתוך קצבת הילדים.", en: "Bituach Leumi deposits a monthly amount into a savings account in the child's name. Parents can double it from the child allowance." },
          { he: "ההורים בוחרים אם הכסף יהיה בבנק או בקופת גמל, ובאיזה מסלול סיכון. מי שלא בוחר מקבל ברירת מחדל.", en: "Parents choose a bank or a provident fund, and the risk track. Those who don't choose get a default." },
        ],
      },
      {
        heading: { he: "מה כדאי", en: "What tends to work" },
        body: [
          { he: "לילד צעיר יש אופק של שנים רבות. מסלול עם יותר מניות בקופת גמל מתאים לרוב יותר מפיקדון בבנק.", en: "A young child has many years ahead, so a more equity-heavy provident fund track usually fits better than a bank deposit." },
          { he: "הכפלת ההפקדה היא דרך כמעט בלתי מורגשת לתת לילד התחלה טובה.", en: "Doubling the deposit is a nearly painless way to give a child a strong start." },
        ],
      },
    ],
    takeaway: { he: "בודקים באתר ביטוח לאומי איפה כל ילד מנוהל, ושוקלים להכפיל את ההפקדה.", en: "Check on the Bituach Leumi site where each child's savings are managed, and consider doubling the deposit." },
    calculator: { href: "/calculators/growth", label: { he: "כמה זה יהיה בגיל 18", en: "What it becomes by 18" } },
  },
  {
    slug: "renovation",
    topic: "home",
    minutes: 3,
    title: { he: "שיפוץ בלי הפתעות", en: "Renovating without surprises" },
    summary: { he: "שיפוצים כמעט תמיד חורגים מהתקציב. ככה מתכננים נכון.", en: "Renovations almost always run over. Here is how to plan for it." },
    sections: [
      {
        heading: { he: "לפני שמתחילים", en: "Before you start" },
        body: [
          { he: "מבקשים לפחות שלוש הצעות מחיר מפורטות, עם רשימת עבודות וחומרים, ולא מחיר אחד כולל.", en: "Get at least three detailed quotes, listing work and materials, not a single lump sum." },
          { he: "מוסיפים לתקציב רזרבה של 10% עד 20%. משהו תמיד מתגלה מאחורי הקיר.", en: "Add a 10–20% buffer. Something always turns up behind a wall." },
        ],
      },
      {
        heading: { he: "איך מממנים", en: "How to pay" },
        body: [
          { he: "עדיף לחסוך מראש. אם צריך הלוואה, משווים ריביות ומעדיפים תקופה קצרה. לא מממנים שיפוץ במינוס.", en: "Saving ahead is best. If you need a loan, compare rates and prefer a short term. Never fund a renovation with an overdraft." },
          { he: "משלמים לקבלן לפי שלבים שהושלמו, לא הכול מראש.", en: "Pay the contractor by completed stages, not everything up front." },
        ],
      },
    ],
    takeaway: { he: "תקציב עם רזרבה, תשלום לפי שלבים, ומימון בלי מינוס.", en: "A budget with a buffer, payment by stages, and no overdraft funding." },
    calculator: { href: "/calculators/renovation", label: { he: "מחשבון תקציב שיפוץ", en: "Renovation budget" } },
  },
];

export const TOPIC_LABEL: Record<Topic, Text> = {
  basics: { he: "יסודות", en: "Basics" },
  debt: { he: "חובות", en: "Debt" },
  investing: { he: "השקעות", en: "Investing" },
  home: { he: "דיור", en: "Home" },
  car: { he: "רכב", en: "Car" },
  retirement: { he: "פרישה", en: "Retirement" },
  family: { he: "משפחה", en: "Family" },
};

export const pick = (t: Text, locale: string) => (locale === "he" ? t.he : t.en);
export const articleBySlug = (slug: string) => ARTICLES.find((a) => a.slug === slug);
