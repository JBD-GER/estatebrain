import { jsPDF } from "jspdf";

export type PortfolioReportProperty = {
  name: string;
  city: string;
  status: string;
  marketValueCents: number;
  purchasePriceCents: number;
};

export type PortfolioReportData = {
  organizationName: string;
  generatedAt: Date;
  reportingYear: number;
  scopeLabel: string;
  sensitiveDataAvailable: boolean;
  metrics: {
    propertyCount: number;
    unitCount: number;
    occupiedUnitCount: number;
    activeLeaseCount: number;
    marketValueCents: number;
    loanBalanceCents: number | null;
    paidIncomeCents: number;
    paidExpenseCents: number;
    openRentCents: number;
    missingReceiptCount: number;
    unresolvedTransactionCount: number | null;
    assumedTaxRate: number | null;
    estimatedTaxEffectCents: number | null;
  };
  properties: PortfolioReportProperty[];
};

const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const PAGE_MARGIN_MM = 16;
const CONTENT_WIDTH_MM = A4_WIDTH_MM - PAGE_MARGIN_MM * 2;

const euro = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const number = new Intl.NumberFormat("de-DE");

function money(cents: number) {
  return euro.format(cents / 100);
}

function cleanText(value: string, maxLength = 120) {
  return value
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    active: "Aktiv",
    archived: "Archiviert",
    sold: "Verkauft",
    planning: "Planung",
  };
  return labels[status] ?? cleanText(status.replaceAll("_", " "), 28);
}

export function createPortfolioReportPdf(data: PortfolioReportData) {
  const document = new jsPDF({
    format: "a4",
    unit: "mm",
    compress: true,
  });
  document.setProperties({
    title: `Estate Brain Portfolio-Bericht - ${cleanText(data.organizationName)}`,
    subject: "Organisationsgefilterter Portfolio- und Finanzüberblick",
    author: "Estate Brain",
    creator: "Estate Brain",
  });

  const generatedLabel = new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Berlin",
  }).format(data.generatedAt);
  const organizationName =
    cleanText(data.organizationName, 90) || "Meine Verwaltung";

  function drawPageHeader() {
    document.setFillColor(15, 42, 38);
    document.rect(0, 0, A4_WIDTH_MM, 30, "F");
    document.setTextColor(255, 255, 255);
    document.setFont("helvetica", "bold");
    document.setFontSize(17);
    document.text("ESTATE BRAIN", PAGE_MARGIN_MM, 13);
    document.setFont("helvetica", "normal");
    document.setFontSize(9);
    document.text("Portfolio-Bericht", PAGE_MARGIN_MM, 21);
    document.text(generatedLabel, A4_WIDTH_MM - PAGE_MARGIN_MM, 21, {
      align: "right",
    });
    document.setTextColor(26, 37, 35);
  }

  function ensureSpace(y: number, requiredHeight: number) {
    if (y + requiredHeight <= A4_HEIGHT_MM - 20) return y;
    document.addPage();
    drawPageHeader();
    return 40;
  }

  drawPageHeader();
  let y = 42;

  document.setFont("helvetica", "bold");
  document.setFontSize(20);
  document.text("Portfolio auf einen Blick", PAGE_MARGIN_MM, y);
  y += 8;
  document.setFont("helvetica", "normal");
  document.setFontSize(10);
  document.setTextColor(83, 97, 94);
  document.text(
    `${organizationName} · ${cleanText(data.scopeLabel, 55)}`,
    PAGE_MARGIN_MM,
    y,
  );
  document.text(
    `Berichtsjahr ${data.reportingYear}`,
    A4_WIDTH_MM - PAGE_MARGIN_MM,
    y,
    { align: "right" },
  );
  document.setTextColor(26, 37, 35);
  y += 11;

  const netCashflow =
    data.metrics.paidIncomeCents - data.metrics.paidExpenseCents;
  const cards = [
    ["Immobilien", number.format(data.metrics.propertyCount)],
    ["Einheiten", number.format(data.metrics.unitCount)],
    ["Vermietete Einheiten", number.format(data.metrics.occupiedUnitCount)],
    ["Aktive Mietverträge", number.format(data.metrics.activeLeaseCount)],
    ["Marktwert", money(data.metrics.marketValueCents)],
    [
      "Darlehenssaldo",
      data.metrics.loanBalanceCents === null
        ? "Nicht verfügbar"
        : money(data.metrics.loanBalanceCents),
    ],
  ] as const;

  const cardGap = 4;
  const cardWidth = (CONTENT_WIDTH_MM - cardGap * 2) / 3;
  const cardHeight = 24;
  cards.forEach(([label, value], index) => {
    const column = index % 3;
    const row = Math.floor(index / 3);
    const x = PAGE_MARGIN_MM + column * (cardWidth + cardGap);
    const cardY = y + row * (cardHeight + cardGap);
    document.setFillColor(241, 246, 244);
    document.roundedRect(x, cardY, cardWidth, cardHeight, 2, 2, "F");
    document.setFont("helvetica", "normal");
    document.setFontSize(8);
    document.setTextColor(83, 97, 94);
    document.text(label, x + 4, cardY + 7);
    document.setFont("helvetica", "bold");
    document.setFontSize(value.length > 17 ? 11 : 14);
    document.setTextColor(15, 42, 38);
    document.text(value, x + 4, cardY + 17);
  });
  y += cardHeight * 2 + cardGap + 12;

  document.setFont("helvetica", "bold");
  document.setFontSize(14);
  document.setTextColor(26, 37, 35);
  document.text(`Zahlungsübersicht ${data.reportingYear}`, PAGE_MARGIN_MM, y);
  y += 7;

  const cashflowRows = [
    ["Bezahlte Einnahmen", money(data.metrics.paidIncomeCents)],
    ["Bezahlte Ausgaben", money(data.metrics.paidExpenseCents)],
    ["Netto-Cashflow", money(netCashflow)],
    ["Offene Mietforderungen", money(data.metrics.openRentCents)],
    [
      "Geschätzte Steuerwirkung",
      !data.sensitiveDataAvailable
        ? "Nicht verfügbar"
        : data.metrics.estimatedTaxEffectCents === null
          ? "Keine Annahme"
        : money(data.metrics.estimatedTaxEffectCents),
    ],
    [
      "Fehlende Belege / ungeklärte Bankposten",
      `${number.format(data.metrics.missingReceiptCount)} / ${
        data.metrics.unresolvedTransactionCount === null
          ? data.sensitiveDataAvailable
            ? "nicht im Filter"
            : "nicht verfügbar"
          : number.format(data.metrics.unresolvedTransactionCount)
      }`,
    ],
  ] as const;
  cashflowRows.forEach(([label, value], index) => {
    const rowY = y + index * 8;
    if (index % 2 === 0) {
      document.setFillColor(248, 250, 249);
      document.rect(PAGE_MARGIN_MM, rowY - 5, CONTENT_WIDTH_MM, 8, "F");
    }
    document.setFont("helvetica", "normal");
    document.setFontSize(9);
    document.setTextColor(55, 68, 65);
    document.text(label, PAGE_MARGIN_MM + 3, rowY);
    document.setFont("helvetica", "bold");
    document.setTextColor(netCashflow < 0 && index === 2 ? 160 : 15, 42, 38);
    document.text(value, A4_WIDTH_MM - PAGE_MARGIN_MM - 3, rowY, {
      align: "right",
    });
  });
  y += cashflowRows.length * 8 + 8;

  y = ensureSpace(y, 35);
  document.setFont("helvetica", "bold");
  document.setFontSize(14);
  document.setTextColor(26, 37, 35);
  document.text("Immobilienbestand", PAGE_MARGIN_MM, y);
  y += 8;

  const tableColumns = {
    name: PAGE_MARGIN_MM + 2,
    city: PAGE_MARGIN_MM + 80,
    status: PAGE_MARGIN_MM + 119,
    value: A4_WIDTH_MM - PAGE_MARGIN_MM - 2,
  };
  function drawPropertyTableHeader(headerY: number) {
    document.setFillColor(15, 42, 38);
    document.rect(PAGE_MARGIN_MM, headerY - 5, CONTENT_WIDTH_MM, 9, "F");
    document.setTextColor(255, 255, 255);
    document.setFont("helvetica", "bold");
    document.setFontSize(8);
    document.text("Immobilie", tableColumns.name, headerY);
    document.text("Ort", tableColumns.city, headerY);
    document.text("Status", tableColumns.status, headerY);
    document.text("Markt-/Kaufwert", tableColumns.value, headerY, {
      align: "right",
    });
    return headerY + 8;
  }
  y = drawPropertyTableHeader(y);

  const properties = data.properties.slice(0, 30);
  if (properties.length === 0) {
    document.setTextColor(83, 97, 94);
    document.setFont("helvetica", "normal");
    document.setFontSize(9);
    document.text(
      "Im sichtbaren Datenbestand sind noch keine Immobilien vorhanden.",
      PAGE_MARGIN_MM + 2,
      y,
    );
    y += 9;
  } else {
    for (const [index, property] of properties.entries()) {
      if (y + 8 > A4_HEIGHT_MM - 20) {
        document.addPage();
        drawPageHeader();
        y = drawPropertyTableHeader(42);
      }
      if (index % 2 === 0) {
        document.setFillColor(248, 250, 249);
        document.rect(PAGE_MARGIN_MM, y - 5, CONTENT_WIDTH_MM, 8, "F");
      }
      const valueCents =
        property.marketValueCents || property.purchasePriceCents;
      document.setTextColor(40, 53, 50);
      document.setFont("helvetica", "normal");
      document.setFontSize(8);
      document.text(cleanText(property.name, 42) || "Immobilie", tableColumns.name, y);
      document.text(cleanText(property.city, 22) || "-", tableColumns.city, y);
      document.text(statusLabel(property.status), tableColumns.status, y);
      document.setFont("helvetica", "bold");
      document.text(
        valueCents > 0 ? money(valueCents) : "-",
        tableColumns.value,
        y,
        { align: "right" },
      );
      y += 8;
    }
  }

  if (data.properties.length > properties.length) {
    y = ensureSpace(y, 8);
    document.setTextColor(83, 97, 94);
    document.setFont("helvetica", "italic");
    document.setFontSize(8);
    document.text(
      `Weitere ${number.format(data.properties.length - properties.length)} Immobilien sind in der App verfügbar.`,
      PAGE_MARGIN_MM + 2,
      y,
    );
    y += 8;
  }

  y = ensureSpace(y + 7, 42);
  document.setFont("helvetica", "bold");
  document.setFontSize(12);
  document.setTextColor(26, 37, 35);
  document.text("Hinweise zur Einordnung", PAGE_MARGIN_MM, y);
  y += 7;
  document.setFont("helvetica", "normal");
  document.setFontSize(8.5);
  document.setTextColor(83, 97, 94);
  const notes = [
    "Der Bericht enthält ausschließlich Daten, die für die aktuell ausgewählte Organisation und Rolle sichtbar sind.",
    `Auswertungsbereich: ${cleanText(data.scopeLabel, 90)}.`,
    !data.sensitiveDataAvailable
      ? "Bankpositionen, Finanzierungen und persönliche Steuerannahmen sind für diese Rolle nicht verfügbar und wurden nicht als Nullwerte ausgegeben."
      : data.metrics.assumedTaxRate === null
      ? "Für die Steuerwirkung liegt keine persönliche Steuersatz-Annahme vor."
      : `Die geschätzte Steuerwirkung verwendet einen angenommenen Satz von ${number.format(
          data.metrics.assumedTaxRate * 100,
        )} % auf den positiven Saldo der bezahlten Einnahmen und Ausgaben.`,
    data.metrics.unresolvedTransactionCount === null &&
    data.sensitiveDataAvailable
      ? "Ungeklärte Bankpositionen sind noch keinem Objekt zugeordnet und deshalb aus dem gewählten Objektfilter ausgeschlossen."
      : "Ungeklärte Bankpositionen werden ausschließlich für das Gesamtportfolio des Berichtsjahres ausgewiesen.",
    "Marktwerte, Cashflows und offene Forderungen basieren auf den in Estate Brain erfassten Angaben und können unvollständig sein.",
    "Dieser Bericht ist keine Steuer-, Rechts-, Finanzierungs- oder Anlageberatung. Angaben vor Entscheidungen fachlich prüfen lassen.",
  ];
  for (const note of notes) {
    const lines = document.splitTextToSize(`- ${note}`, CONTENT_WIDTH_MM);
    document.text(lines, PAGE_MARGIN_MM, y);
    y += lines.length * 4.2 + 2;
  }

  const pageCount = document.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    document.setPage(page);
    document.setDrawColor(220, 227, 224);
    document.line(
      PAGE_MARGIN_MM,
      A4_HEIGHT_MM - 14,
      A4_WIDTH_MM - PAGE_MARGIN_MM,
      A4_HEIGHT_MM - 14,
    );
    document.setFont("helvetica", "normal");
    document.setFontSize(7.5);
    document.setTextColor(105, 117, 114);
    document.text(
      "Estate Brain - vertraulicher Organisationsbericht",
      PAGE_MARGIN_MM,
      A4_HEIGHT_MM - 9,
    );
    document.text(
      `Seite ${page} von ${pageCount}`,
      A4_WIDTH_MM - PAGE_MARGIN_MM,
      A4_HEIGHT_MM - 9,
      { align: "right" },
    );
  }

  return new Uint8Array(document.output("arraybuffer"));
}
