"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { InvestmentTaxScenario } from "@/lib/domain/investment-tax";

export const COMPARISON_COLORS = ["#23634f", "#b17b38", "#668bb0"];

export function InvestmentChart({ items }: { items: { name: string; result: InvestmentTaxScenario; color: string }[] }) {
  const length = Math.max(0, ...items.map((item) => item.result.annualRows.length));
  const data = Array.from({ length }, (_, index) => {
    const row: Record<string, number> = { year: index + 1 };
    items.forEach((item, itemIndex) => {
      const annual = item.result.annualRows[index];
      if (annual) row[`scenario${itemIndex}`] = annual.cumulativeTaxSavingCents / 100;
    });
    return row;
  });
  return <div className="h-64 w-full min-w-0 sm:h-72" role="img" aria-label="Diagramm: kumulierte geschätzte Steuerentlastung je Szenario und Betrachtungsjahr. Die genauen Werte stehen im Jahresplan.">
    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
      <LineChart data={data} margin={{ top: 16, right: 12, bottom: 8, left: 4 }} accessibilityLayer>
        <CartesianGrid strokeDasharray="3 5" vertical={false} stroke="#e5e9e3" />
        <XAxis dataKey="year" axisLine={false} tickLine={false} minTickGap={30} tick={{ fontSize: 11, fill: "#78827b" }} tickFormatter={(value: number) => `Jahr ${value}`} dy={8} />
        <YAxis axisLine={false} tickLine={false} width={64} tick={{ fontSize: 11, fill: "#78827b" }} tickFormatter={(value: number) => new Intl.NumberFormat("de-DE", { notation: "compact", style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value)} />
        <Tooltip contentStyle={{ borderRadius: 14, border: "1px solid #e5e9e3", fontSize: 12, boxShadow: "0 8px 30px #173f3510" }} labelFormatter={(value) => `Betrachtungsjahr ${value}`}
          formatter={(value) => new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(Number(value))} />
        {items.map((item, index) => <Line key={index} type="monotone" dataKey={`scenario${index}`} name={item.name} stroke={item.color} strokeWidth={3} dot={false} activeDot={{ r: 5, strokeWidth: 3, stroke: "white" }} isAnimationActive={false} connectNulls={false} />)}
      </LineChart>
    </ResponsiveContainer>
  </div>;
}
