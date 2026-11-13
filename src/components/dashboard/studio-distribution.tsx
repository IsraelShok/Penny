"use client";

import { useLocale, useTranslations } from "next-intl";
import { ChartNoAxesColumnIncreasing, ChartPie, Table2 } from "lucide-react";
import { distributionCategories, type StudioPreferences } from "@/lib/budget-studio";
import { translateCategoryName } from "@/lib/i18n-data";
import { shekels } from "@/lib/money";
import type { CategoryWithData } from "@/lib/types";
import { studioCopy } from "./studio-copy";

export function StudioDistribution({ categories, chart, onChartChange }: { categories: CategoryWithData[]; chart: StudioPreferences["chart"]; onChartChange: (chart: StudioPreferences["chart"]) => void }) {
  const locale = useLocale();
  const c = studioCopy(locale);
  const tCat = useTranslations("categoriesSeeded");
  const rows = distributionCategories(categories);
  const total = rows.reduce((sum, row) => sum + row.spent, 0);
  let offset = 0;
  const segments = rows.map((row) => { const start = offset; offset += row.spent / total * 100; return `${row.categoryColor} ${start}% ${offset}%`; });
  return <section className="studio-panel studio-distribution" aria-labelledby="studio-distribution-title">
    <div className="studio-panel-heading"><div><h2 id="studio-distribution-title">{c.distribution}</h2><p>{c.distributionHint}</p></div><div className="studio-chart-switch" role="group" aria-label={c.chart}>
      {([['bars', ChartNoAxesColumnIncreasing], ['donut', ChartPie], ['table', Table2]] as const).map(([value, Icon]) => <button key={value} onClick={() => onChartChange(value)} aria-label={c[value]} title={c[value]} aria-pressed={chart === value}><Icon size={16} aria-hidden="true" /></button>)}
    </div></div>
    {!rows.length ? <p className="studio-empty">{c.noData}</p> : <>
      {chart === "donut" && <div className="studio-donut" style={{ background: `conic-gradient(${segments.join(",")})` }} aria-hidden="true"><div><span>{c.showChart}</span><strong data-money>{shekels(total, locale)}</strong></div></div>}
      {chart === "table" ? <table className="studio-table"><thead><tr><th>{c.category}</th><th>{c.amount}</th><th>{c.share}</th></tr></thead><tbody>{rows.map((row) => <tr key={row.categoryId}><th scope="row">{translateCategoryName(row.categoryName, tCat)}</th><td data-money>{shekels(row.spent, locale)}</td><td data-money>{Math.round(row.spent / total * 100)}%</td></tr>)}</tbody></table> : <ul className={`studio-bars ${chart === "donut" ? "studio-legend" : ""}`}>
        {rows.map((row) => <li key={row.categoryId}><div className="studio-bar-label"><span><i style={{ background: row.categoryColor }} />{translateCategoryName(row.categoryName, tCat)}</span><b data-money>{shekels(row.spent, locale)}<small>{Math.round(row.spent / total * 100)}%</small></b></div>{chart === "bars" && <div className="studio-bar-track" aria-hidden="true"><i style={{ width: `${row.spent / total * 100}%`, background: row.categoryColor }} /></div>}</li>)}
      </ul>}
    </>}
  </section>;
}
