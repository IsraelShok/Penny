// Kept together so the studio's Hebrew and English controls stay in parity.
const he = {
  eyebrow: "הכסף שלך. בדרך שלך.", title: "מקום לשקט כלכלי.", subtitle: "תמונה ברורה של החודש, ומרחב שהוא כולו שלך.",
  customize: "עיצוב המרחב שלי", studio: "המרחב שלך, הסגנון שלך", studioHint: "העיצוב חל על כל המסכים והתפריטים. ההעדפות נשמרות בדפדפן הזה.",
  system: "לפי המכשיר", budgetSettings: "מסך התקציב", globalSettings: "עיצוב לכל האפליקציה",
  theme: "האווירה", pearl: "פנינה", midnight: "לילה", glass: "זכוכית", accent: "הצבע שלך", violet: "סגול", ocean: "כחול", jade: "ירוק", rose: "ורוד",
  metric: "מה הכי חשוב לך לראות?", remaining: "נשאר בתקציב", spent: "הוצאות בתקציב", allSpent: "הוצאות החודש", over: "חריגה מהתקציב",
  density: "מרווחים", comfortable: "מרווח", compact: "קומפקטי", layout: "סידור המסך", balanced: "זה לצד זה", stacked: "אחד מתחת לשני",
  widgets: "מה יופיע במרחב?", showChart: "חלוקת ההוצאות", showJourney: "הצעדים שלי", motion: "תנועה עדינה", chart: "תצוגת הגרף", bars: "עמודות", donut: "טבעת", table: "טבלה",
  save: "שמירת העיצוב", cancel: "ביטול", reset: "חזרה לעיצוב המקורי", saved: "העיצוב שלך נשמר", storageError: "העיצוב פעיל, אבל הדפדפן לא מאפשר לשמור אותו לפעם הבאה.",
  overview: "התמונה החודשית", budget: "התקציב החודשי", daily: "ליום, עד סוף החודש", forecast: "תחזית הוצאות", actual: "הוצאה בפועל", noForecast: "תופיע מהיום החמישי בחודש", noBudget: "עדיין לא הוגדר תקציב", setBudget: "הגדרת תקציב", onTrack: "בתוך המסגרת", overTrack: "מעל המסגרת", used: "מהתקציב נוצל", elapsed: "מהחודש עבר", calculation: "איך זה מחושב?",
  explanation: "היתרה היא המסגרת פחות ההוצאות שנכללות בתקציב; זו אינה יתרת העו״ש. הסכום היומי מחלק את היתרה בימי החודש שנותרו, כולל היום. התחזית מבוססת על הקצב הממוצע עד היום ואינה כוללת מידע על חיובים עתידיים. הנתונים תלויים בסנכרון האחרון.",
  distribution: "לאן הכסף הולך?", distributionHint: "הוצאות בקטגוריות · ללא ספירה כפולה", category: "קטגוריה", amount: "סכום", share: "חלק יחסי", noData: "ההוצאות יופיעו כאן אחרי שיתווספו תנועות לחודש הזה.",
  journey: "צעדים קטנים. יותר שליטה.", journeyHint: "ההתקדמות שלך החודש — בקצב שלך.", milestones: "צעדים הושלמו", budgetStep: "מסגרת חודשית הוגדרה", dataStep: "התנועות קיבלו קטגוריה", reviewStep: "עברתי על התקציב החודשי", review: "סיימתי סקירה", undoReview: "ביטול סימון הסקירה", reviewed: "עוד צעד של תשומת לב לכסף שלך.", reviewLocal: "סימון הסקירה אישי ונשמר בדפדפן הזה.", goals: "למסע שלי", complete: "הושלם", pending: "הצעד הבא", chartFirst: "הצגת הגרף לפני הקטגוריות", settings: "העדפות התצוגה", period: "החודש הנבחר", monthlyBudget: "מתוך מסגרת של", privacy: "הנתונים נשארים במרחב שלך",
};
const en: Record<keyof typeof he, string> = {
  eyebrow: "YOUR MONEY. YOUR WAY.", title: "Room for peace of mind.", subtitle: "A clearer view of your month. A space that feels like you.",
  customize: "Make it yours", studio: "Your space, your style", studioHint: "Design applies to every page and menu. Preferences are saved in this browser.",
  system: "System", budgetSettings: "Budget page", globalSettings: "Design across the app",
  theme: "The atmosphere", pearl: "Pearl", midnight: "Midnight", glass: "Glass", accent: "Your accent", violet: "Violet", ocean: "Ocean", jade: "Jade", rose: "Rose",
  metric: "What matters most?", remaining: "Budget remaining", spent: "Budgeted spending", allSpent: "Month's spending", over: "Over budget",
  density: "Spacing", comfortable: "Comfortable", compact: "Compact", layout: "Layout", balanced: "Side by side", stacked: "Stacked",
  widgets: "In your space", showChart: "Spending breakdown", showJourney: "My milestones", motion: "Gentle motion", chart: "Chart style", bars: "Bars", donut: "Ring", table: "Table",
  save: "Save my design", cancel: "Cancel", reset: "Restore original design", saved: "Your design is saved", storageError: "Your design is active, but this browser cannot save it for next time.",
  overview: "MONTHLY OVERVIEW", budget: "Monthly budget", daily: "Per day, until month end", forecast: "Spending forecast", actual: "Actual spending", noForecast: "Available from day five", noBudget: "No budget set yet", setBudget: "Set a budget", onTrack: "Within budget", overTrack: "Over budget", used: "of budget used", elapsed: "of month elapsed", calculation: "How is this calculated?",
  explanation: "Remaining means the budget minus included spending, not your bank balance. The daily amount divides the remainder by days left this month, including today. The forecast extends your average daily spending and does not account for future bills. Figures depend on the last sync.",
  distribution: "Where is it going?", distributionHint: "Categorized spending · counted once", category: "Category", amount: "Amount", share: "Share", noData: "Spending will appear when transactions are added for this month.",
  journey: "Small steps. More clarity.", journeyHint: "This month's progress, at your pace.", milestones: "milestones complete", budgetStep: "Set a monthly budget", dataStep: "Categorize your transactions", reviewStep: "Review this month's budget", review: "Mark as reviewed", undoReview: "Undo review", reviewed: "Another moment of care for your money.", reviewLocal: "Your personal review mark is saved in this browser.", goals: "My journey", complete: "Complete", pending: "Next step", chartFirst: "Chart before categories", settings: "Display preferences", period: "Selected month", monthlyBudget: "of a budget of", privacy: "Your data stays in your space",
};
export const studioCopy = (locale: string) => locale === "he" ? he : en;
export type StudioCopy = typeof en;
