import "server-only";

const MAQAF = /־/g;
// Nikud and cantillation marks, U+0591-U+05C7 except the maqaf (U+05BE), which is a hyphen.
const NIKUD = /[֑-ֽֿ-ׇ]/g;
// Invisible direction marks that issuers sometimes embed around Hebrew names.
const BIDI_MARKS = /[‎‏‪-‮⁦-⁩]/g;
const HEBREW = /[א-ת]/;

// Trailing noise card issuers append, removed until none is left:
const TRAILING = [
  /[\s*\-_.#]+$/, // separators: "wolt*", "name -"
  /\s*(?:סניף|branch)\s*\d*$/i, // explicit branch: "סניף 123"
  /\s*[*\-_#]\s*\d+$/, // separator then number: "AMZN Mktp - 4421"
];
// A bare trailing number is a branch number after a Hebrew name ("שופרסל 123"),
// but part of the name in English ("Office 365"), so it is only stripped in the first case.
const BARE_NUMBER = /\s+\d+$/;

export function normalizeMerchant(description: string): string {
  let s = description
    .normalize("NFC")
    .replace(BIDI_MARKS, "")
    .replace(MAQAF, "-")
    .replace(NIKUD, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

  for (let previous = ""; previous !== s; ) {
    previous = s;
    for (const pattern of TRAILING) s = s.replace(pattern, "");
    if (HEBREW.test(s)) s = s.replace(BARE_NUMBER, "");
    s = s.trim();
  }
  return s;
}

export function translateMerchant(key: string, table: Record<string, string>): string | null {
  return table[key] ?? null;
}
