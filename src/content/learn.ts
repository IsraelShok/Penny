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

export const TOPICS: Topic[] = [
  "basics",
  "debt",
  "investing",
  "home",
  "car",
  "retirement",
  "family",
];

export const ARTICLES: Article[] = [
  {
    slug: "emergency-fund",
    topic: "basics",
    minutes: 3,
    title: { he: "קרן חירום: הצעד הראשון", en: "Emergency fund: the first step" },
    summary: {
      he: "למה כדאי שיהיו בצד 3 עד 6 חודשי הוצאות, ואיפה לשמור אותם.",
      en: "Why to keep 3 to 6 months of spending aside, and where to keep it.",
    },
    sections: [
      {
        heading: { he: "למה זה הכי חשוב", en: "Why it comes first" },
        body: [
          {
            he: "קרן חירום היא כסף שמחכה להפתעות: מקרר שהתקלקל, תקופה בלי עבודה, טיפול שיניים. בלעדיה כל הפתעה הופכת למינוס או להלוואה יקרה.",
            en: "An emergency fund is money waiting for surprises: a broken fridge, a gap between jobs, a dental bill. Without it, every surprise becomes an overdraft or an expensive loan.",
          },
          {
            he: "כשיש קרן חירום, אפשר להשקיע את שאר הכסף לטווח ארוך בראש שקט, בלי לפחד שתצטרכו למכור בזמן ירידות.",
            en: "With one in place you can invest the rest for the long run calmly, without fearing you will have to sell in a downturn.",
          },
        ],
      },
      {
        heading: { he: "כמה ואיפה", en: "How much and where" },
        body: [
          {
            he: "יעד מקובל הוא 3 חודשי הוצאות לשכירים עם הכנסה יציבה, ו-6 חודשים לעצמאים או למשפחה עם הכנסה אחת.",
            en: "A common target is 3 months of spending for salaried people with steady income, and 6 for the self-employed or single-income families.",
          },
          {
            he: "שומרים אותה במקום נזיל ובטוח: פיקדון קצר או קרן כספית. לא במניות, כי היא צריכה להיות שם בדיוק כשהשוק יורד.",
            en: "Keep it liquid and safe: a short deposit or a money-market fund. Not in stocks, because it must be there exactly when markets fall.",
          },
        ],
      },
    ],
    takeaway: {
      he: "מתחילים מחודש אחד של הוצאות, ומוסיפים כל חודש סכום קבוע עד שמגיעים ליעד.",
      en: "Start with one month of spending, and add a fixed amount every month until you reach the target.",
    },
    calculator: {
      href: "/calculators/growth",
      label: { he: "כמה ייקח לחסוך את זה", en: "How long it takes to save it" },
    },
  },
  {
    slug: "overdraft",
    topic: "debt",
    minutes: 4,
    title: { he: "לצאת מהמינוס", en: "Getting out of the overdraft" },
    summary: {
      he: "המינוס הוא אחת ההלוואות היקרות בישראל. ככה סוגרים אותו בלי לחזור אליו.",
      en: "An overdraft is one of the most expensive loans in Israel. Here is how to close it for good.",
    },
    sections: [
      {
        heading: { he: "למה המינוס כל כך יקר", en: "Why it costs so much" },
        body: [
          {
            he: "ריבית על מינוס גבוהה בהרבה מריבית על הלוואה רגילה, והיא נגבית בשקט כל חודש. מינוס קבוע של כמה אלפי שקלים יכול לעלות מאות שקלים בשנה, בלי שמרגישים.",
            en: "Overdraft interest is far higher than a regular loan's, and it is charged quietly every month. A standing overdraft of a few thousand shekels can cost hundreds a year without you noticing.",
          },
        ],
      },
      {
        heading: { he: "שלושה צעדים", en: "Three steps" },
        body: [
          {
            he: "1. רואים את התמונה: כמה מינוס, באיזו ריבית, וכמה נכנס ויוצא כל חודש.",
            en: "1. See the picture: how much overdraft, at what rate, and what comes in and goes out each month.",
          },
          {
            he: "2. אם המינוס גדול, שוקלים להחליף אותו בהלוואה בריבית נמוכה יותר עם החזר חודשי קבוע. ההחזר הקבוע הוא מה שסוגר אותו.",
            en: "2. If it is large, consider replacing it with a cheaper loan with a fixed monthly payment. The fixed payment is what actually closes it.",
          },
          {
            he: "3. מקטינים את מסגרת האשראי בהדרגה, כדי שלא יהיה לאן לחזור.",
            en: "3. Lower the credit line step by step, so there is nowhere to slide back to.",
          },
        ],
      },
    ],
    takeaway: {
      he: "סוגרים קודם את החוב עם הריבית הגבוהה ביותר. בדרך כלל זה המינוס או כרטיס האשראי.",
      en: "Pay off the highest-rate debt first. Usually that is the overdraft or the credit card.",
    },
    calculator: {
      href: "/calculators/debt",
      label: { he: "תוכנית יציאה מחובות", en: "Debt payoff plan" },
    },
  },
  {
    slug: "index-funds",
    topic: "investing",
    minutes: 5,
    title: {
      he: "קרן מחקה מדד: השקעה פשוטה לטווח ארוך",
      en: "Index funds: simple long-term investing",
    },
    summary: {
      he: "למה הרבה משקיעים בוחרים לקנות את כל השוק בדמי ניהול נמוכים במקום לנחש מניות.",
      en: "Why many investors buy the whole market at a low fee instead of picking stocks.",
    },
    sections: [
      {
        heading: { he: "מה זה", en: "What it is" },
        body: [
          {
            he: "קרן מחקה מדד קונה את כל המניות במדד, למשל 500 החברות הגדולות בארה״ב או מדד עולמי. אתם לא מנחשים מי ינצח, אלא מקבלים את הממוצע של כל השוק.",
            en: "An index fund buys every stock in an index, such as the 500 largest US companies or a world index. You don't guess the winners; you get the average of the whole market.",
          },
          {
            he: "לאורך עשרות שנים רוב מנהלי ההשקעות האקטיביים לא הצליחו לנצח את המדד אחרי דמי ניהול.",
            en: "Over decades, most active managers have failed to beat the index after fees.",
          },
        ],
      },
      {
        heading: { he: "מה חשוב לבדוק", en: "What to check" },
        body: [
          {
            he: "דמי ניהול: הפרש של אחוז אחד בשנה יכול לאכול כרבע מהחיסכון אחרי 30 שנה.",
            en: "Fees: one percentage point a year can eat about a quarter of the savings after 30 years.",
          },
          {
            he: "פיזור: מדד רחב (עולמי או ארה״ב הרחב) מפוזר יותר ממדד של ענף אחד.",
            en: "Spread: a broad index (world or total US) is more diversified than a single-sector one.",
          },
          {
            he: "זמן: השקעה במניות מתאימה לכסף שלא תצטרכו בחמש השנים הקרובות לפחות. בדרך יהיו ירידות. מי שממשיך להשקיע בהן מרוויח מהן.",
            en: "Time: stocks suit money you won't need for at least five years. There will be drops on the way; people who keep investing through them benefit.",
          },
        ],
      },
    ],
    takeaway: {
      he: "קרן מדד רחבה, דמי ניהול נמוכים, הפקדה קבועה כל חודש, ולא לגעת. זו כל השיטה.",
      en: "A broad index fund, low fees, a fixed deposit every month, and leave it alone. That is the whole method.",
    },
    calculator: {
      href: "/calculators/growth",
      label: { he: "כמה ההשקעה תגדל", en: "How much it could grow" },
    },
  },
  {
    slug: "gemel-and-hishtalmut",
    topic: "investing",
    minutes: 5,
    title: { he: "קופת גמל להשקעה וקרן השתלמות", en: "Investment provident fund and study fund" },
    summary: {
      he: "שני כלים ישראליים עם הטבות מס שכדאי להכיר לפני שפותחים תיק השקעות.",
      en: "Two Israeli tools with tax benefits worth knowing before opening a brokerage account.",
    },
    sections: [
      {
        heading: { he: "קרן השתלמות", en: "Study fund (קרן השתלמות)" },
        body: [
          {
            he: "לשכירים, המעסיק מפקיד ברוב המקרים 7.5% מהשכר ואתם 2.5%. אחרי שש שנים אפשר למשוך את הכסף, והרווחים פטורים ממס עד תקרת השכר שקבועה בחוק.",
            en: "For employees, the employer usually deposits 7.5% of salary and you 2.5%. After six years it can be withdrawn, with gains tax-free up to the legal salary ceiling.",
          },
          {
            he: "זו אחת ההטבות הטובות בישראל. אם המעסיק לא מציע אותה, כדאי לבקש.",
            en: "It is one of Israel's best benefits; if your employer doesn't offer it, ask.",
          },
        ],
      },
      {
        heading: { he: "קופת גמל להשקעה", en: "Investment provident fund (קופת גמל להשקעה)" },
        body: [
          {
            he: "חיסכון נזיל שאפשר למשוך בכל זמן, ומשלמים מס רווחי הון רק במשיכה. ההעברה בין מסלולים וחברות לא נחשבת מכירה, ולכן לא משלמים עליה מס.",
            en: "A liquid savings account you can withdraw any time, paying capital-gains tax only on withdrawal. Switching tracks or providers isn't a sale, so it isn't taxed.",
          },
          {
            he: "מגיל 60 אפשר למשוך כקצבה חודשית בלי מס על הרווחים. יש תקרת הפקדה שנתית.",
            en: "From 60 it can be taken as a monthly annuity with no tax on gains. There is an annual deposit cap.",
          },
        ],
      },
    ],
    takeaway: {
      he: "קודם ממצים קרן השתלמות, אחר כך שוקלים קופת גמל להשקעה, ורק אחר כך תיק השקעות רגיל.",
      en: "Max the study fund first, then consider an investment provident fund, and only then a regular brokerage account.",
    },
    calculator: {
      href: "/fi",
      label: { he: "גמל מול תיק השקעות", en: "Provident fund vs brokerage" },
    },
  },
  {
    slug: "mortgage-tracks",
    topic: "home",
    minutes: 5,
    title: { he: "תמהיל משכנתא בלי כאב ראש", en: "Mortgage mix without the headache" },
    summary: {
      he: "פריים, קבועה וצמודה: מה ההבדל, ואיך בונים תמהיל שלא יפתיע.",
      en: "Prime, fixed and CPI-linked: the difference, and how to build a mix that won't surprise you.",
    },
    sections: [
      {
        heading: { he: "שלושת המסלולים", en: "The three tracks" },
        body: [
          {
            he: "פריים: הריבית זזה עם ריבית בנק ישראל. אפשר לפרוע בלי קנס, אבל ההחזר יכול לעלות.",
            en: "Prime: the rate moves with the Bank of Israel rate. It can be repaid without a penalty, but the payment can rise.",
          },
          {
            he: "קבועה לא צמודה: ההחזר ידוע מראש עד הסוף. הריבית בדרך כלל גבוהה יותר.",
            en: "Fixed, unlinked: the payment is known to the end. The rate is usually higher.",
          },
          {
            he: "קבועה צמודה: מתחילה בריבית נמוכה, אבל היתרה גדלה עם המדד. עם אינפלציה, ההחזר עולה עם השנים.",
            en: "Fixed, CPI-linked: starts at a lower rate, but the balance grows with the index. With inflation, payments climb over the years.",
          },
        ],
      },
      {
        heading: { he: "כללי אצבע", en: "Rules of thumb" },
        body: [
          {
            he: "בנק ישראל מחייב שלפחות שליש מהמשכנתא יהיה בריבית קבועה.",
            en: "The Bank of Israel requires at least a third of the mortgage at a fixed rate.",
          },
          {
            he: "בודקים מבחן לחץ: מה קורה להחזר אם הפריים עולה בשתי נקודות. אם גם אז זה נוח, התמהיל בטוח.",
            en: "Run a stress test: what happens to the payment if prime rises by two points. If it still fits, the mix is safe.",
          },
          {
            he: "משווים הצעות מכמה בנקים. הבדל קטן בריבית שווה עשרות אלפי שקלים לאורך הדרך.",
            en: "Compare offers from several banks. A small rate difference is worth tens of thousands of shekels over the life of the loan.",
          },
        ],
      },
    ],
    takeaway: {
      he: "בונים תמהיל שאפשר לעמוד בו גם בתרחיש רע, לא רק בהחזר הנמוך ביותר היום.",
      en: "Build a mix you can carry in a bad scenario too, not just the lowest payment today.",
    },
    calculator: {
      href: "/calculators/mortgage",
      label: { he: "מחשבון משכנתא", en: "Mortgage calculator" },
    },
  },
  {
    slug: "discounted-home",
    topic: "home",
    minutes: 4,
    title: { he: "דירה בהנחה: מתי זה באמת משתלם", en: "Discounted home: when it really pays" },
    summary: {
      he: "ההנחה מושכת, אבל ההמתנה, השכירות וההצמדה משנות את החשבון.",
      en: "The discount is attractive, but the wait, the rent and the index linkage change the math.",
    },
    sections: [
      {
        heading: { he: "מה מקבלים", en: "What you get" },
        body: [
          {
            he: "בתוכנית דירה בהנחה (לשעבר מחיר למשתכן) קונים דירה חדשה מתחת למחיר השוק, עם תקרת הנחה. משתתפים בהגרלה, ויש תנאי זכאות שכדאי לבדוק באתר הרשמי.",
            en: "In the Dira BeHanacha program (formerly Mehir LaMishtaken) you buy a new apartment below market price, up to a discount cap, through a lottery with eligibility rules worth checking on the official site.",
          },
        ],
      },
      {
        heading: { he: "מה עולה כסף בדרך", en: "What costs money on the way" },
        body: [
          {
            he: "שנים של המתנה למפתח, ובהן ממשיכים לשלם שכירות.",
            en: "Years waiting for the keys, while you keep paying rent.",
          },
          {
            he: "הצמדה למדד תשומות הבנייה על החלק שעוד לא שולם.",
            en: "Linkage to the construction index on the part not yet paid.",
          },
          {
            he: "מגבלות על מכירה ועל השכרה בשנים הראשונות.",
            en: "Limits on selling and renting in the first years.",
          },
        ],
      },
    ],
    takeaway: {
      he: "משווים מה המצב אחרי עשר שנים, לא רק את ההנחה. בזמן ההמתנה ההון העצמי צריך לעבוד, לא לשכב.",
      en: "Compare where you stand after ten years, not just the discount. While you wait, keep the equity working, not idle.",
    },
    calculator: {
      href: "/discounted-home",
      label: { he: "דירה בהנחה מול שוק חופשי", en: "Discounted home vs market" },
    },
  },
  {
    slug: "electric-car",
    topic: "car",
    minutes: 4,
    title: { he: "רכב חשמלי או בנזין?", en: "Electric or petrol?" },
    summary: {
      he: "המחיר במודעה הוא רק חלק מהסיפור. זה מה שבאמת קובע את העלות.",
      en: "The sticker price is only part of the story. Here is what really drives the cost.",
    },
    sections: [
      {
        heading: { he: "איפה חשמלי חוסך", en: "Where electric saves" },
        body: [
          {
            he: "טעינה בבית זולה בהרבה מדלק לכל קילומטר. בחשמלי גם יש פחות חלקים נעים, ולכן הטיפולים זולים יותר.",
            en: "Charging at home is much cheaper per km than fuel, and fewer moving parts mean cheaper servicing.",
          },
          {
            he: "ככל שנוסעים יותר קילומטרים בשנה, החיסכון גדל.",
            en: "The more you drive each year, the bigger the saving.",
          },
        ],
      },
      {
        heading: { he: "איפה הוא עולה יותר", en: "Where it costs more" },
        body: [
          {
            he: "מחיר קנייה, ביטוח ולעתים ירידת ערך מהירה יותר כשיוצאים דגמים חדשים.",
            en: "Purchase price, insurance and sometimes faster depreciation as newer models arrive.",
          },
          {
            he: "בלי טעינה בבית, טעינה ציבורית מצמצמת חלק גדול מהחיסכון.",
            en: "Without home charging, public charging erases much of the saving.",
          },
        ],
      },
      {
        heading: { he: "והכסף ששילמתם", en: "And the money you paid" },
        body: [
          {
            he: "כסף ששילמתם על רכב מפסיק להרוויח. רכב זול יותר והשקעה של ההפרש הם לפעמים ההחלטה הכלכלית הכי טובה.",
            en: "Money paid for a car stops earning. A cheaper car and investing the difference is sometimes the best decision of all.",
          },
        ],
      },
    ],
    takeaway: {
      he: "משווים עלות כוללת לשנות ההחזקה, לפי הקילומטרז' ואפשרויות הטעינה שלכם.",
      en: "Compare the total cost over the years you will keep it, using your own mileage and charging options.",
    },
    calculator: { href: "/car", label: { he: "מחשבון עלות רכב", en: "Car cost calculator" } },
  },
  {
    slug: "pension-fees",
    topic: "retirement",
    minutes: 4,
    title: {
      he: "דמי ניהול בפנסיה: חמש דקות ששוות הרבה",
      en: "Pension fees: five minutes worth a lot",
    },
    summary: {
      he: "דמי ניהול נראים קטנים, אבל לאורך שנים הם מצטברים לסכום ענק.",
      en: "Fees look small, but over decades they add up to a huge sum.",
    },
    sections: [
      {
        heading: { he: "שני סוגי דמי ניהול", en: "Two kinds of fees" },
        body: [
          {
            he: "מההפקדה: אחוז מכל הפקדה חודשית. מהצבירה: אחוז מכל מה שכבר נצבר, כל שנה. לאורך זמן דמי הניהול מהצבירה כבדים יותר.",
            en: "From deposits: a percentage of each monthly deposit. From the balance: a percentage of everything saved, every year. Over time the balance fee weighs more.",
          },
          {
            he: "החוק קובע תקרה, אבל אפשר לקבל הרבה פחות ממנה, ולפעמים מספיקה שיחת טלפון.",
            en: "The law sets a cap, but you can get far below it, sometimes with one phone call.",
          },
        ],
      },
      {
        heading: { he: "מה עושים", en: "What to do" },
        body: [
          {
            he: "בודקים בדוח השנתי או במסלקה הפנסיונית כמה משלמים, משווים לממוצע ומבקשים הנחה. אם לא מקבלים, עוברים קרן. המעבר לא עולה כסף.",
            en: "Check the annual statement or the pension clearing house, compare with the average and ask for a discount. If refused, switch funds; switching costs nothing.",
          },
          {
            he: "מוודאים שמסלול ההשקעה מתאים לגיל. צעירים יכולים להחזיק יותר מניות.",
            en: "Make sure the investment track fits your age; younger savers can hold more stocks.",
          },
        ],
      },
    ],
    takeaway: {
      he: "חצי אחוז פחות דמי ניהול מהצבירה יכול להוסיף עשרות אלפי שקלים לפנסיה.",
      en: "Half a point less in balance fees can add tens of thousands of shekels to your pension.",
    },
    calculator: { href: "/fi", label: { he: "השוואת דמי ניהול", en: "Fee comparison" } },
  },
  {
    slug: "investment-tracks",
    topic: "retirement",
    minutes: 4,
    title: {
      he: "מסלול השקעה וניהול אישי: איך בוחרים",
      en: "Investment tracks and self-managed funds: how to choose",
    },
    summary: {
      he: "באותה קופה אפשר להחזיק מסלולים שונים מאוד. הבחירה תלויה בזמן עד שתצטרכו את הכסף ובמה שתעשו כשהשוק יורד.",
      en: "The same fund can hold very different tracks. The choice depends on when you need the money and what you do when markets fall.",
    },
    sections: [
      {
        heading: { he: "סוגי המסלולים", en: "The kinds of track" },
        body: [
          {
            he: "מסלול תלוי גיל הוא ברירת המחדל: הוא מוריד את חלק המניות לבד ככל שמתקרבים לפרישה. מסלול מניות ומסלול מחקה מדד, כמו S&P 500, מחזיקים יותר מניות לאורך כל הדרך. מסלול כללי מערבב מניות ואג״ח, ומסלול אג״ח או שקלי שומר על יציבות.",
            en: "An age-based track is the default: it trims the share of stocks by itself as retirement gets closer. Equity and index tracks, such as the S&P 500 one, hold more stocks all the way. A general track mixes stocks and bonds, and a bond or shekel track stays steady.",
          },
          {
            he: "החלפת מסלול בתוך אותה קופה לא יוצרת אירוע מס ולא עולה כסף. אפשר גם לפצל את היתרה בין שני מסלולים.",
            en: "Switching track inside the same fund triggers no tax and costs nothing. You can also split the balance between two tracks.",
          },
        ],
      },
      {
        heading: { he: "ניהול אישי (IRA)", en: "Self-managed (IRA)" },
        body: [
          {
            he: "בניהול אישי בוחרים בעצמכם ניירות ערך בתוך קופת הגמל, ההשתלמות או הפנסיה, ונשארים עם הטבות המס. מצד שני משלמים גם לקופה וגם עמלות קנייה ומשמורת בבית ההשקעות.",
            en: "In a self-managed account you choose the securities yourself inside the provident, study or pension fund, and keep the tax benefits. On the other hand you pay both the fund and the broker's trading and custody fees.",
          },
          {
            he: "זה מתאים בעיקר ביתרה גדולה, למי שמוכן להחזיק לאורך שנים בלי לגעת. ביתרה קטנה העמלות עלולות לבלוע את היתרון, ומסלול מחקה מדד נותן תוצאה דומה בפחות עבודה.",
            en: "It fits mainly a larger balance and someone willing to hold for years without tinkering. On a small balance the fees can swallow the edge, and an index track gets a similar result with less work.",
          },
        ],
      },
      {
        heading: { he: "ודמי הניהול", en: "And the fees" },
        body: [
          {
            he: "דמי הניהול נקבעים לפי הקופה ולא לפי המסלול, אז בדרך כלל אפשר לעבור למסלול מחקה מדד בלי לשלם יותר. בדוח השנתי מופיעות גם ההוצאות הישירות, שבמסלולים מחקי מדד נמוכות לרוב.",
            en: "Fees are set per fund, not per track, so you can usually move to an index track without paying more. The annual report also lists direct expenses, which tend to be lower in index tracks.",
          },
        ],
      },
    ],
    takeaway: {
      he: "יותר זמן עד הפרישה ויותר שקט בירידות מאפשרים יותר מניות. הערכה כללית, לא ייעוץ.",
      en: "More years to retirement and calm in downturns allow more stocks. General guidance, not advice.",
    },
    calculator: {
      href: "/calculators/track",
      label: { he: "עוזר בחירת מסלול", en: "Track helper" },
    },
  },
  {
    slug: "pension-payout",
    topic: "retirement",
    minutes: 5,
    title: {
      he: "ביום הפרישה: קצבה, היוון וקיבוע זכויות",
      en: "On retirement day: annuity, lump sum and fixing rights",
    },
    summary: {
      he: "שלוש החלטות שקובעות כמה מס תשלמו על הפנסיה לכל החיים, ואיך לא לפספס את הפטור.",
      en: "Three decisions that set how much tax you pay on your pension for life, and how not to miss the exemption.",
    },
    sections: [
      {
        heading: { he: "קצבה או היוון", en: "Annuity or lump sum" },
        body: [
          {
            he: "קצבה היא תשלום חודשי לכל החיים: היתרה מחולקת במקדם ההמרה של הקרן. היוון הוא משיכה של חלק מהקצבה כסכום אחד. בקרן פנסיה אפשר להוון רק חלק, כך שתישאר קצבה מינימלית.",
            en: "An annuity is a monthly payment for life: the balance divided by the fund's conversion factor. Commuting turns part of the pension into one lump sum. A pension fund lets you commute only part, so a minimum pension remains.",
          },
          {
            he: "קצבה מגינה מפני אריכות ימים: היא לא נגמרת. סכום הוני גמיש יותר, אבל אם תחיו הרבה הוא עלול להיגמר. גיל נקודת האיזון עוזר להבין את הפשרה.",
            en: "An annuity protects against living long: it never runs out. A lump sum is more flexible, but if you live long it may run out. The break-even age helps you see the trade-off.",
          },
        ],
      },
      {
        heading: { he: "קיבוע זכויות (טופס 161ד)", en: "Fixing rights (form 161d)" },
        body: [
          {
            he: "מגיל הפרישה, חלק מהקצבה פטור ממס. בטופס 161ד מחליטים איך לנצל את סל הפטור: על הקצבה החודשית, על היוון פטור, או שילוב. מענקים פטורים שקיבלתם בעבר מקטינים את הסל.",
            en: "From retirement age, part of the pension is tax-free. On form 161d you decide how to use the exemption: on the monthly pension, on a tax-free lump sum, or a mix. Tax-free grants you received in the past shrink it.",
          },
          {
            he: "את הטופס מגישים לרשות המסים, ובלעדיו הקרן תנכה מס מלא. כדאי לבדוק כמה תרוויחו בכל אפשרות לפני שמגישים.",
            en: "The form goes to the Tax Authority; without it the fund withholds full tax. Check what each option is worth before you file.",
          },
        ],
      },
      {
        heading: { he: "תיקון 190", en: "Amendment 190" },
        body: [
          {
            he: "מגיל 60, מי שיש לו קצבה מזכה מעל הסף יכול למשוך קופת גמל להשקעה כקצבה פטורה ממס, ומשיכה הונית חייבת במס מופחת על הרווח הריאלי.",
            en: "From 60, anyone with a qualifying pension above the threshold can draw an investment provident fund as a tax-free annuity, while a lump-sum withdrawal pays a reduced tax on the real gain.",
          },
        ],
      },
    ],
    takeaway: {
      he: "ההחלטות האלה כמעט בלתי הפיכות. מחשבים, ואם הסכומים גדולים, בודקים מול יועץ פרישה מורשה. הערכה, לא ייעוץ.",
      en: "These choices are close to irreversible. Run the numbers, and with large sums check with a licensed retirement adviser. An estimate, not advice.",
    },
    calculator: {
      href: "/calculators/annuity",
      label: { he: "קצבה מול היוון", en: "Annuity vs lump sum" },
    },
  },
  {
    slug: "severance",
    topic: "retirement",
    minutes: 3,
    title: {
      he: "פיצויים כשעוזבים עבודה: למשוך או להשאיר",
      en: "Severance when you leave a job: withdraw or keep",
    },
    summary: {
      he: "הפיצויים יושבים בקופה שלכם. משיכה נותנת כסף עכשיו, אבל עולה במס ובצמיחה שתפספסו.",
      en: "Your severance sits in your fund. Withdrawing gives you cash now, but costs tax and the growth you give up.",
    },
    sections: [
      {
        heading: { he: "טופס 161", en: "Form 161" },
        body: [
          {
            he: "כשעוזבים, המעסיק ממלא טופס 161 ומדווח כמה פיצויים מגיעים. בטופס בוחרים: למשוך, או להשאיר בקופה ברצף קצבה (הכסף ימשיך לקצבה) או ברצף פיצויים (הפטור נשמר להמשך).",
            en: "When you leave, the employer fills in form 161 and reports the severance due. On it you choose: withdraw, or leave it in the fund with pension continuity (it goes toward your pension) or severance continuity (the exemption is kept for later).",
          },
          {
            he: "הפטור ממס מוגבל לסכום קבוע לכל שנת עבודה, ולא יותר מ-1.5 משכורות לשנה. מעבר לזה, מס לפי המדרגה השולית.",
            en: "The tax exemption is capped at a fixed amount per year of service, and no more than 1.5 salaries a year. Above that, tax at your marginal rate.",
          },
        ],
      },
      {
        heading: { he: "מה מפסידים כשמושכים", en: "What withdrawing costs" },
        body: [
          {
            he: "גם כשהמשיכה פטורה, הכסף יוצא מהקופה ומפסיק לצמוח בלי מס. אם תשקיעו אותו בתיק, תשלמו מס על הרווח. לאורך עשרות שנים ההפרש מצטבר.",
            en: "Even when the withdrawal is tax-free, the money leaves the fund and stops growing tax-deferred. Invest it in a brokerage account and you pay tax on the gains. Over decades the gap adds up.",
          },
          {
            he: "משיכה הגיונית בעיקר כשהכסף מחליף חוב יקר או משלים קרן חירום שאין לכם.",
            en: "Withdrawing makes most sense when the money replaces expensive debt or fills an emergency fund you don't have.",
          },
        ],
      },
    ],
    takeaway: {
      he: "ברירת המחדל הטובה לרוב היא להשאיר. מושכים רק עם סיבה ברורה. הערכה, לא ייעוץ.",
      en: "Keeping it is usually the better default. Withdraw only with a clear reason. An estimate, not advice.",
    },
    calculator: {
      href: "/calculators/severance",
      label: { he: "מחשבון פיצויים", en: "Severance calculator" },
    },
  },
  {
    slug: "tax-refund",
    topic: "basics",
    minutes: 3,
    title: {
      he: "החזר מס: כסף שאולי מחכה לכם",
      en: "Tax refund: money that may be waiting for you",
    },
    summary: {
      he: "הרבה שכירים זכאים להחזר מס ולא יודעים. אפשר לבקש אותו כמה שנים אחורה.",
      en: "Many employees are owed a refund and don't know it. You can claim several years back.",
    },
    sections: [
      {
        heading: { he: "מתי זה קורה", en: "When it happens" },
        body: [
          {
            he: "החלפתם עבודה באמצע שנה, עבדתם רק חלק מהשנה, נולד ילד, תרמתם לעמותה, סיימתם תואר, או הפקדתם לפנסיה באופן עצמאי.",
            en: "You changed jobs mid-year, worked part of the year, had a child, donated to a charity, finished a degree, or made private pension deposits.",
          },
        ],
      },
      {
        heading: { he: "איך מבקשים", en: "How to claim" },
        body: [
          {
            he: "מגישים בקשה לרשות המסים, אפשר באתר שלה. אפשר לבקש עד שש שנים אחורה. מצרפים טופסי 106 מכל מעסיק וקבלות על תרומות.",
            en: "File a request with the Tax Authority, online. You can claim up to six years back. Attach form 106 from each employer and donation receipts.",
          },
          {
            he: "חברות שעושות את זה בשבילכם לוקחות אחוז מההחזר. ברוב המקרים אפשר להסתדר לבד.",
            en: "Companies that do it for you take a cut of the refund; most cases can be done alone.",
          },
        ],
      },
    ],
    takeaway: {
      he: "אם היה בשנה האחרונה שינוי בחיים או בעבודה, שווה לבדוק.",
      en: "If anything changed in your life or job last year, it is worth checking.",
    },
    calculator: {
      href: "/calculators/credit-points",
      label: { he: "בדיקת נקודות זיכוי והחזר מס", en: "Credit points and refund check" },
    },
  },
  {
    slug: "investment-tax",
    topic: "investing",
    minutes: 5,
    title: {
      he: "מס על השקעות: רווחים, הפסדים וקרנות סל",
      en: "Tax on investments: gains, losses and ETFs",
    },
    summary: {
      he: "כמה מס משלמים על רווח בתיק, איך הפסד מקטין אותו, ולמה חשוב איפה רשומה קרן הסל.",
      en: "How much tax a portfolio gain costs, how a loss lowers it, and why an ETF's home country matters.",
    },
    sections: [
      {
        heading: { he: "25% על הרווח הריאלי", en: "25% on the real gain" },
        body: [
          {
            he: "כשמוכרים נייר ערך ברווח, משלמים מס של 25% על הרווח שמעבר לאינפלציה. החלק שרק שמר על ערך הכסף לא ממוסה. גם דיבידנד וריבית ממוסים בדרך כלל ב-25%.",
            en: "When you sell a security at a profit, you pay 25% on the gain above inflation. The part that only kept up with prices isn't taxed. Dividends and interest are usually taxed at 25% too.",
          },
          {
            he: "בבית השקעות ישראלי המס מנוכה אוטומטית בכל מכירה. בחשבון בחו״ל אתם מדווחים ומשלמים בעצמכם, בדוח שנתי.",
            en: "An Israeli broker withholds the tax automatically on each sale. With a foreign account you report and pay it yourself, in an annual return.",
          },
        ],
      },
      {
        heading: { he: "קיזוז הפסדים וטופס 867", en: "Offsetting losses and Form 867" },
        body: [
          {
            he: "הפסד שמימשתם מקזז רווח מאותה שנה, וגם דיבידנד או ריבית שחויבו ב-25%. הפסד שנשאר עובר לשנים הבאות, אבל רק מול רווחי הון.",
            en: "A realised loss offsets gains from the same year, and also dividends or interest taxed at 25%. Any loss left carries forward, but only against capital gains.",
          },
          {
            he: "בתוך אותו בית השקעות הקיזוז קורה לבד. בין בנקים שונים צריך להגיש בקשה או דוח, ולצרף את טופס 867 שכל גוף שולח בתחילת השנה.",
            en: "Within one broker the offset happens on its own. Across different banks you file a request or a return, attaching the Form 867 each institution sends early in the year.",
          },
        ],
      },
      {
        heading: { he: "קרן אירית מול קרן אמריקאית", en: "Irish- vs US-domiciled ETFs" },
        body: [
          {
            he: "קרן סל שרשומה בארה״ב מנכה 25% מס במקור מהדיבידנדים למשקיע ישראלי שמילא טופס W-8BEN. קרן שרשומה באירלנד ומשקיעה במניות אמריקאיות משלמת ברמת הקרן 15%, ולרוב צוברת את הדיבידנד במקום לחלק אותו.",
            en: "A US-domiciled ETF withholds 25% on dividends for an Israeli investor with a W-8BEN on file. An Irish-domiciled ETF holding US stocks pays 15% at the fund level, and usually accumulates dividends instead of paying them out.",
          },
          {
            he: "יש גם מס עיזבון אמריקאי: מי שאינו אזרח ארה״ב ומחזיק נכסים אמריקאיים בשווי של יותר מ-60 אלף דולר עלול לחייב את היורשים במס גבוה. קרן אירית אינה נכס אמריקאי ולכן לא חשופה למס הזה.",
            en: "There is also US estate tax: a non-US person holding US assets above $60,000 can leave the heirs a large tax bill. An Irish fund isn't a US asset, so it isn't exposed.",
          },
          {
            he: "מנגד, קרן אירית יכולה להיות בדמי ניהול מעט גבוהים יותר ובמחזור מסחר נמוך יותר. כדאי להשוות את שני הצדדים.",
            en: "On the other hand, an Irish fund may charge slightly more and trade less. Compare both sides.",
          },
        ],
      },
    ],
    takeaway: {
      he: "לפני סוף השנה בדקו אם יש לכם הפסד שאפשר לממש מול רווח, ובחרו קרן לפי המקום שבו היא רשומה, לא רק לפי המדד. זה מידע כללי, לא ייעוץ.",
      en: "Before year end, check whether a loss can be realised against a gain, and pick funds by where they are registered, not only by the index. General information, not advice.",
    },
    calculator: {
      href: "/calculators/lossOffset",
      label: { he: "כמה מס חוסך קיזוז הפסד", en: "Tax saved by offsetting a loss" },
    },
  },
  {
    slug: "kids-savings",
    topic: "family",
    minutes: 3,
    title: { he: "חיסכון לכל ילד", en: "Savings for every child" },
    summary: {
      he: "ביטוח לאומי חוסך כל חודש בשביל כל ילד. כדאי לבחור איפה הכסף ינוהל.",
      en: "Bituach Leumi saves every month for each child. Choose where it is managed.",
    },
    sections: [
      {
        heading: { he: "איך זה עובד", en: "How it works" },
        body: [
          {
            he: "ביטוח לאומי מפקיד סכום חודשי לחשבון חיסכון על שם הילד. ההורים יכולים להכפיל את ההפקדה מתוך קצבת הילדים.",
            en: "Bituach Leumi deposits a monthly amount into a savings account in the child's name. Parents can double it from the child allowance.",
          },
          {
            he: "ההורים בוחרים אם הכסף יהיה בבנק או בקופת גמל, ובאיזה מסלול סיכון. מי שלא בוחר מקבל ברירת מחדל.",
            en: "Parents choose a bank or a provident fund, and the risk track. Those who don't choose get a default.",
          },
        ],
      },
      {
        heading: { he: "מה כדאי", en: "What tends to work" },
        body: [
          {
            he: "לילד צעיר יש אופק של שנים רבות. מסלול עם יותר מניות בקופת גמל מתאים לרוב יותר מפיקדון בבנק.",
            en: "A young child has many years ahead, so a more equity-heavy provident fund track usually fits better than a bank deposit.",
          },
          {
            he: "הכפלת ההפקדה היא דרך כמעט בלתי מורגשת לתת לילד התחלה טובה.",
            en: "Doubling the deposit is a nearly painless way to give a child a strong start.",
          },
        ],
      },
    ],
    takeaway: {
      he: "בודקים באתר ביטוח לאומי איפה כל ילד מנוהל, ושוקלים להכפיל את ההפקדה.",
      en: "Check on the Bituach Leumi site where each child's savings are managed, and consider doubling the deposit.",
    },
    calculator: {
      href: "/calculators/growth",
      label: { he: "כמה זה יהיה בגיל 18", en: "What it becomes by 18" },
    },
  },
  {
    slug: "renovation",
    topic: "home",
    minutes: 3,
    title: { he: "שיפוץ בלי הפתעות", en: "Renovating without surprises" },
    summary: {
      he: "שיפוצים כמעט תמיד חורגים מהתקציב. ככה מתכננים נכון.",
      en: "Renovations almost always run over. Here is how to plan for it.",
    },
    sections: [
      {
        heading: { he: "לפני שמתחילים", en: "Before you start" },
        body: [
          {
            he: "מבקשים לפחות שלוש הצעות מחיר מפורטות, עם רשימת עבודות וחומרים, ולא מחיר אחד כולל.",
            en: "Get at least three detailed quotes, listing work and materials, not a single lump sum.",
          },
          {
            he: "מוסיפים לתקציב רזרבה של 10% עד 20%. משהו תמיד מתגלה מאחורי הקיר.",
            en: "Add a 10–20% buffer. Something always turns up behind a wall.",
          },
        ],
      },
      {
        heading: { he: "איך מממנים", en: "How to pay" },
        body: [
          {
            he: "עדיף לחסוך מראש. אם צריך הלוואה, משווים ריביות ומעדיפים תקופה קצרה. לא מממנים שיפוץ במינוס.",
            en: "Saving ahead is best. If you need a loan, compare rates and prefer a short term. Never fund a renovation with an overdraft.",
          },
          {
            he: "משלמים לקבלן לפי שלבים שהושלמו, לא הכול מראש.",
            en: "Pay the contractor by completed stages, not everything up front.",
          },
        ],
      },
    ],
    takeaway: {
      he: "תקציב עם רזרבה, תשלום לפי שלבים, ומימון בלי מינוס.",
      en: "A budget with a buffer, payment by stages, and no overdraft funding.",
    },
    calculator: {
      href: "/calculators/renovation",
      label: { he: "מחשבון תקציב שיפוץ", en: "Renovation budget" },
    },
  },
  {
    slug: "forgotten-money",
    topic: "retirement",
    minutes: 3,
    title: { he: "כסף שנשכח בקופות ישנות", en: "Money left in old funds" },
    summary: {
      he: "כל מקום עבודה פותח קופה. אחרי כמה החלפות, חלק מהכסף פשוט נשכח.",
      en: "Every job opens a fund. After a few job changes, some of that money is simply forgotten.",
    },
    sections: [
      {
        heading: { he: "למה זה קורה", en: "Why it happens" },
        body: [
          {
            he: "כשעוזבים עבודה, ההפקדות נעצרות אבל הקופה נשארת. היא ממשיכה לגבות דמי ניהול, ואם זו קרן פנסיה, הכיסוי הביטוחי שבה עלול להיגמר.",
            en: "When you leave a job the deposits stop but the fund stays. It keeps charging fees, and in a pension fund the insurance cover inside it may end.",
          },
        ],
      },
      {
        heading: { he: "שלוש החלטות אפשריות", en: "Three possible decisions" },
        body: [
          {
            he: "איחוד: מצרפים קרן פנסיה ישנה לזו שמפקידים אליה היום. ניוד: מעבירים קופת גמל או השתלמות למקום זול יותר. דרישה: חשבון בנק רדום או פוליסה של קרוב שנפטר דורשים פנייה לגוף עצמו.",
            en: "Merge: fold an old pension fund into the one you pay into today. Move: transfer a provident or study fund somewhere cheaper. Claim: a dormant bank account or a late relative's policy needs a request to the company itself.",
          },
        ],
      },
    ],
    takeaway: {
      he: "החיפוש הרשמי חינמי ולוקח כמה דקות. אין צורך לשלם למתווך. מידע כללי, לא ייעוץ.",
      en: "The official search is free and takes minutes. No need to pay a middleman. General information, not advice.",
    },
    calculator: {
      href: "/calculators/lost-money",
      label: { he: "צ׳ק־ליסט כסף שנשכח", en: "Forgotten money checklist" },
    },
  },
  {
    slug: "bank-fees",
    topic: "basics",
    minutes: 2,
    title: { he: "עמלות בנק: מסלול שחוסך", en: "Bank fees: a track that saves" },
    summary: {
      he: "כל בנק חייב להציע מסלול עמלות במחיר קבוע. רבים משלמים יותר בלי לדעת.",
      en: "Every bank must offer a flat-price fee track. Many people pay more without knowing.",
    },
    sections: [
      {
        heading: { he: "איך בודקים", en: "How to check" },
        body: [
          {
            he: "סופרים כמה פעולות עושים בחודש, ישירות ודרך פקיד, ומשווים את סך העמלות בדף החשבון למחיר המסלול. אם המסלול זול יותר, מבקשים לעבור. אפשר לחזור בכל זמן.",
            en: "Count your monthly actions, direct and by a teller, and compare the fees on your statement with the track's price. If the track is cheaper, ask to switch. You can switch back any time.",
          },
        ],
      },
    ],
    takeaway: {
      he: "בדיקה של חמש דקות פעם בשנה. הערכה, לא ייעוץ.",
      en: "A five-minute check once a year. An estimate, not advice.",
    },
    calculator: {
      href: "/calculators/bank-fees",
      label: { he: "בדיקת עמלות בנק", en: "Bank fees check" },
    },
  },
  {
    slug: "benefits-check",
    topic: "family",
    minutes: 2,
    title: { he: "זכויות שלא מגיעות מעצמן", en: "Benefits that don't arrive on their own" },
    summary: {
      he: "חלק מההטבות משולמות רק למי שמבקש. שווה לבדוק פעם בשנה.",
      en: "Some benefits are paid only to those who ask. Worth checking once a year.",
    },
    sections: [
      {
        heading: { he: "מה שכדאי לבדוק", en: "What to check" },
        body: [
          {
            he: "מענק עבודה לעובדים בשכר נמוך, הטבות למשרתי מילואים, חיסכון לכל ילד בקופת גמל, הנחה בארנונה וסיוע בשכר דירה. רובם דורשים טופס, וחלקם אפשר לבקש גם על שנים קודמות.",
            en: "A work grant for low-wage workers, reserve-duty benefits, child savings in a provident fund, property-tax discounts and rent help. Most need a form, and some can be claimed for past years.",
          },
        ],
      },
    ],
    takeaway: {
      he: "הזכאות נקבעת באתר הרשמי. הבדיקה כאן היא הערכה, לא ייעוץ.",
      en: "Eligibility is decided on the official site. This check is an estimate, not advice.",
    },
    calculator: {
      href: "/calculators/rights",
      label: { he: "בדיקת זכויות", en: "Benefits check" },
    },
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
