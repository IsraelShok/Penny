/**
 * Israeli investment houses (provident, study funds, brokerage). Listed in Settings › Banks.
 * The ones in PENSION_FUNDS (lib/pension.ts) connect and sync into assets; the rest are "coming soon"
 * and their statements come in through file import.
 */
export interface InvestmentHouse {
  id: string;
  name: { he: string; en: string };
  domain: string;
  color: string;
}

export const INVESTMENT_HOUSES: InvestmentHouse[] = [
  {
    id: "meitav",
    name: { he: "מיטב בית השקעות", en: "Meitav" },
    domain: "meitav.co.il",
    color: "#0b3d91",
  },
  {
    id: "altshuler",
    name: { he: "אלטשולר שחם", en: "Altshuler Shaham" },
    domain: "as-invest.co.il",
    color: "#00205b",
  },
  {
    id: "yelin",
    name: { he: "ילין לפידות", en: "Yelin Lapidot" },
    domain: "yl-invest.co.il",
    color: "#1c4f8a",
  },
  {
    id: "more",
    name: { he: "מור בית השקעות", en: "More Investments" },
    domain: "more.co.il",
    color: "#e4002b",
  },
  {
    id: "phoenix",
    name: { he: "הפניקס חיסכון ופנסיה", en: "Phoenix savings and pension" },
    domain: "fnx.co.il",
    color: "#b35c00",
  },
  {
    id: "excellence",
    name: { he: "אקסלנס טרייד", en: "Excellence Trade" },
    domain: "xnes.co.il",
    color: "#ff4e31",
  },
  {
    id: "harel",
    name: { he: "הראל פיננסים", en: "Harel Finance" },
    domain: "harel-group.co.il",
    color: "#00529b",
  },
  {
    id: "migdal",
    name: { he: "מגדל שוקי הון", en: "Migdal Capital Markets" },
    domain: "migdal.co.il",
    color: "#003a70",
  },
  {
    id: "ibi",
    name: { he: "IBI בית השקעות", en: "IBI Investment House" },
    domain: "ibi.co.il",
    color: "#c8102e",
  },
  {
    id: "clal",
    name: { he: "כלל ביטוח ופנסיה", en: "Clal" },
    domain: "clalbit.co.il",
    color: "#0067b1",
  },
  {
    id: "menora",
    name: { he: "מנורה מבטחים", en: "Menora Mivtachim" },
    domain: "menoramivt.co.il",
    color: "#e30613",
  },
  { id: "psagot", name: { he: "פסגות", en: "Psagot" }, domain: "psagot.co.il", color: "#1d3c78" },
  {
    id: "analyst",
    name: { he: "אנליסט", en: "Analyst" },
    domain: "analyst.co.il",
    color: "#2b2d6e",
  },
];
