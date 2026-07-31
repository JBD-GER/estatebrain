"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import type {
  DashboardMonthPoint,
  DashboardPropertyPoint,
} from "@/lib/dashboard/types";

const moneyFormatter = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const compactMoneyFormatter = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  notation: "compact",
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

const SERIES_LABELS: Record<string, string> = {
  targetRentCents: "Sollmiete",
  actualRentCents: "Ist-Miete",
  incomeCents: "Einnahmen",
  operatingExpensesCents: "Betriebsausgaben",
  operatingCashflowCents: "Operativer Cashflow",
  financingCashflowCents: "Nach Finanzierung",
  marketValueCents: "Marktwert",
  equityCents: "Eigenkapital",
};

function euros(cents: number) {
  return moneyFormatter.format(cents / 100);
}

function compactEuros(cents: number) {
  return compactMoneyFormatter.format(cents / 100);
}

function CurrencyTooltip({
  active,
  payload,
  label,
}: TooltipContentProps) {
  if (!active || !payload?.length) return null;

  return (
    <div className="min-w-44 rounded-lg border bg-background/95 p-3 text-xs shadow-lg backdrop-blur">
      <p className="mb-2 font-medium text-foreground">{String(label)}</p>
      <div className="space-y-1.5">
        {payload.map((item) => {
          const key = String(item.dataKey ?? item.name ?? "");
          const value =
            typeof item.value === "number"
              ? item.value
              : typeof item.value === "string"
                ? Number(item.value)
                : Number.NaN;
          return (
            <div
              className="flex items-center justify-between gap-4"
              key={`${key}-${String(item.value)}`}
            >
              <span className="flex items-center gap-2 text-muted-foreground">
                <span
                  aria-hidden="true"
                  className="size-2 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                {SERIES_LABELS[key] ?? String(item.name ?? key)}
              </span>
              <span className="font-medium tabular-nums text-foreground">
                {Number.isFinite(value) ? euros(value) : "–"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function RentChart({ data }: { data: DashboardMonthPoint[] }) {
  return (
    <div
      className="h-72 w-full"
      role="img"
      aria-label="Diagramm mit Sollmiete und tatsächlich eingegangener Miete der letzten zwölf Monate"
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          accessibilityLayer
          data={data}
          margin={{ top: 8, right: 4, left: 0, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11 }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11 }}
            tickFormatter={compactEuros}
            width={58}
          />
          <Tooltip content={CurrencyTooltip} cursor={{ opacity: 0.08 }} />
          <Legend
            formatter={(value) => SERIES_LABELS[value] ?? value}
            wrapperStyle={{ fontSize: 12 }}
          />
          <Bar
            dataKey="targetRentCents"
            fill="var(--chart-2)"
            name="targetRentCents"
            radius={[4, 4, 0, 0]}
          />
          <Bar
            dataKey="actualRentCents"
            fill="var(--chart-1)"
            name="actualRentCents"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CashflowChart({ data }: { data: DashboardMonthPoint[] }) {
  return (
    <div
      className="h-72 w-full"
      role="img"
      aria-label="Diagramm mit operativem Cashflow und Cashflow nach Finanzierung der letzten zwölf Monate"
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          accessibilityLayer
          data={data}
          margin={{ top: 8, right: 4, left: 0, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11 }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11 }}
            tickFormatter={compactEuros}
            width={58}
          />
          <Tooltip content={CurrencyTooltip} cursor={{ opacity: 0.08 }} />
          <Legend
            formatter={(value) => SERIES_LABELS[value] ?? value}
            wrapperStyle={{ fontSize: 12 }}
          />
          <Bar
            dataKey="operatingCashflowCents"
            fill="var(--chart-1)"
            name="operatingCashflowCents"
            radius={[4, 4, 0, 0]}
          />
          <Line
            dataKey="financingCashflowCents"
            dot={{ r: 2 }}
            name="financingCashflowCents"
            stroke="var(--chart-4)"
            strokeWidth={2.5}
            type="monotone"
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function PortfolioChart({
  data,
}: {
  data: DashboardPropertyPoint[];
}) {
  const chartData = data.filter(
    (
      property,
    ): property is DashboardPropertyPoint & { marketValueCents: number } =>
      property.marketValueCents !== null,
  );

  if (chartData.length === 0) {
    return (
      <div className="grid h-72 place-items-center rounded-lg border border-dashed text-center text-sm text-muted-foreground">
        Hinterlege Marktwerte, um die Portfolioaufteilung zu sehen.
      </div>
    );
  }

  return (
    <div
      className="h-72 w-full"
      role="img"
      aria-label="Diagramm mit Marktwert und geschätztem Eigenkapital je Immobilie"
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          accessibilityLayer
          data={chartData}
          layout="vertical"
          margin={{ top: 8, right: 8, left: 10, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11 }}
            tickFormatter={compactEuros}
            type="number"
          />
          <YAxis
            axisLine={false}
            dataKey="name"
            tickLine={false}
            tick={{ fontSize: 11 }}
            type="category"
            width={124}
          />
          <Tooltip content={CurrencyTooltip} cursor={{ opacity: 0.08 }} />
          <Legend
            formatter={(value) => SERIES_LABELS[value] ?? value}
            wrapperStyle={{ fontSize: 12 }}
          />
          <Bar
            dataKey="marketValueCents"
            fill="var(--chart-2)"
            name="marketValueCents"
            radius={[0, 4, 4, 0]}
          />
          <Bar
            dataKey="equityCents"
            fill="var(--chart-1)"
            name="equityCents"
            radius={[0, 4, 4, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
