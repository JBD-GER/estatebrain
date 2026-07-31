import {
  Bell,
  Building2,
  Check,
  ChevronDown,
  CircleAlert,
  FileCheck2,
  LayoutDashboard,
  ReceiptText,
  SlidersHorizontal,
  WalletCards,
} from "lucide-react";

const statusCards = [
  {
    label: "Portfoliowert",
    status: "Im Blick",
    icon: Building2,
    tint: "bg-[#e8f4ef] text-[#1d6b56]",
  },
  {
    label: "Cashflow nach Finanzierung",
    status: "Übersichtlich",
    icon: WalletCards,
    tint: "bg-[#ecf0f8] text-[#385d8b]",
  },
  {
    label: "Offene Zahlungen",
    status: "Zu prüfen",
    icon: CircleAlert,
    tint: "bg-[#fbf3df] text-[#986b17]",
  },
  {
    label: "Belegstatus",
    status: "Vorbereitet",
    icon: FileCheck2,
    tint: "bg-[#eeeafd] text-[#644ca3]",
  },
];

export function DashboardPreview() {
  return (
    <div
      role="img"
      aria-label="Schematische Vorschau des Estate-Brain-Dashboards ohne Echtdaten"
      className="relative overflow-hidden rounded-[1.75rem] border border-[#cfe0da] bg-white shadow-[0_30px_90px_-34px_rgba(20,72,61,0.35)]"
    >
      <div className="flex items-center justify-between border-b border-[#e2ece8] px-4 py-3 sm:px-5">
        <div className="flex items-center gap-2">
          <span className="grid size-7 place-items-center rounded-lg bg-[#12352f] text-white">
            <Building2 aria-hidden="true" className="size-3.5" />
          </span>
          <div>
            <p className="text-[10px] font-semibold text-[#23433d]">
              Portfolioübersicht
            </p>
            <p className="text-[8px] text-[#81928e]">Demo-Ansicht</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="grid size-7 place-items-center rounded-lg border border-[#e2ece8] text-[#6c817b]">
            <Bell aria-hidden="true" className="size-3" />
          </span>
          <span className="flex h-7 items-center gap-1.5 rounded-lg border border-[#e2ece8] px-2 text-[8px] font-medium text-[#48605a]">
            Gesamtportfolio
            <ChevronDown aria-hidden="true" className="size-2.5" />
          </span>
        </div>
      </div>

      <div className="grid grid-cols-[3.4rem_1fr] sm:grid-cols-[4.4rem_1fr]">
        <div className="border-r border-[#e2ece8] bg-[#f8fbfa] p-2">
          <div className="space-y-2" aria-hidden="true">
            {[LayoutDashboard, Building2, WalletCards, ReceiptText].map(
              (Icon, index) => (
                <span
                  key={index}
                  className={[
                    "grid aspect-square place-items-center rounded-lg",
                    index === 0
                      ? "bg-[#e4f1ec] text-[#1e6857]"
                      : "text-[#91a19d]",
                  ].join(" ")}
                >
                  <Icon className="size-3.5" />
                </span>
              ),
            )}
          </div>
        </div>

        <div className="min-w-0 bg-[#fbfdfc] p-3 sm:p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[9px] text-[#81928e]">Guten Überblick</p>
              <p className="mt-0.5 text-[11px] font-semibold text-[#23433d]">
                So arbeitet dein Portfolio
              </p>
            </div>
            <span className="hidden items-center gap-1 rounded-md border border-[#dce8e4] bg-white px-2 py-1 text-[8px] text-[#5d746e] sm:flex">
              <SlidersHorizontal aria-hidden="true" className="size-2.5" />
              Zeitraum
            </span>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 xl:grid-cols-4">
            {statusCards.map((card) => (
              <div
                key={card.label}
                className="rounded-xl border border-[#e1ebe7] bg-white p-2.5"
              >
                <div
                  className={`grid size-6 place-items-center rounded-lg ${card.tint}`}
                >
                  <card.icon aria-hidden="true" className="size-3" />
                </div>
                <p className="mt-2 truncate text-[7px] text-[#7a8d88]">
                  {card.label}
                </p>
                <p className="mt-0.5 text-[9px] font-semibold text-[#294b45]">
                  {card.status}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-2 grid gap-2 sm:grid-cols-[1.5fr_1fr]">
            <div className="rounded-xl border border-[#e1ebe7] bg-white p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[9px] font-semibold text-[#294b45]">
                    Einnahmen und Ausgaben
                  </p>
                  <p className="text-[7px] text-[#879792]">
                    Entwicklung im gewählten Zeitraum
                  </p>
                </div>
                <span className="flex items-center gap-1 text-[7px] text-[#627871]">
                  <span className="size-1.5 rounded-full bg-emerald-600" />
                  Cashflow
                </span>
              </div>
              <div
                aria-hidden="true"
                className="relative mt-3 flex h-20 items-end gap-2 border-b border-l border-[#e6eeeb] px-2"
              >
                <div className="absolute inset-x-0 top-1/3 border-t border-dashed border-[#edf2f0]" />
                <div className="absolute inset-x-0 top-2/3 border-t border-dashed border-[#edf2f0]" />
                {[38, 55, 47, 67, 60, 78, 70, 86].map((height, index) => (
                  <span
                    key={index}
                    className="relative z-10 flex-1 rounded-t-sm bg-gradient-to-t from-[#1f725f] to-[#83c5ae]"
                    style={{ height: `${height}%` }}
                  />
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-[#e1ebe7] bg-white p-3">
              <p className="text-[9px] font-semibold text-[#294b45]">
                Vorbereitung
              </p>
              <p className="text-[7px] text-[#879792]">
                Belege und Zuordnungen
              </p>
              <div className="mt-3 space-y-2.5">
                {[
                  "Zahlungen zugeordnet",
                  "Belege strukturiert",
                  "Annahmen transparent",
                ].map((item, index) => (
                  <div key={item} className="flex items-center gap-2">
                    <span
                      className={[
                        "grid size-4 place-items-center rounded-full",
                        index === 2
                          ? "bg-[#fbf3df] text-[#986b17]"
                          : "bg-[#e5f3ed] text-[#1e725d]",
                      ].join(" ")}
                    >
                      <Check aria-hidden="true" className="size-2.5" />
                    </span>
                    <span className="text-[7px] text-[#596f69]">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
