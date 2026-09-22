import Link from "next/link";
import {
  ArrowDownToLine,
  ArrowRight,
  BadgeEuro,
  BookOpenCheck,
  Building2,
  Calculator,
  ChartNoAxesCombined,
  Check,
  CircleCheck,
  CircleHelp,
  CircleUserRound,
  DatabaseZap,
  Eye,
  FileCheck2,
  FileText,
  FolderCheck,
  HandCoins,
  House,
  Landmark,
  Link2,
  LockKeyhole,
  MessagesSquare,
  ReceiptText,
  Scale,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Upload,
  UsersRound,
  WalletCards,
  Wrench,
} from "lucide-react";

import { DashboardPreview } from "@/components/marketing/dashboard-preview";
import { MarketingFooter } from "@/components/marketing/footer";
import { MarketingHeader } from "@/components/marketing/header";
import { SectionHeading } from "@/components/marketing/section-heading";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const painPoints = [
  {
    icon: FileText,
    title: "Unterlagen liegen überall",
    text: "Kontoauszüge, Rechnungen und Mietdaten verteilen sich auf Ordner, Tabellen und Postfächer.",
  },
  {
    icon: Eye,
    title: "Liquidität bleibt unscharf",
    text: "Einnahmen wirken positiv, doch Finanzierung, Rücklagen und laufende Kosten verändern das echte Bild.",
  },
  {
    icon: Scale,
    title: "Steuervorbereitung kostet Zeit",
    text: "Belege, Zuordnungen und Annahmen müssen jedes Jahr erneut nachvollziehbar zusammengetragen werden.",
  },
];

const productBenefits = [
  {
    icon: ChartNoAxesCombined,
    title: "Cashflow, der nachvollziehbar bleibt",
    text: "Sieh Einnahmen, Ausgaben, Finanzierung und geschätzte Steuerwirkung getrennt und im Zusammenhang.",
  },
  {
    icon: Building2,
    title: "Vom Portfolio bis zur Einheit",
    text: "Wechsle vom Gesamtbild gezielt in einzelne Immobilien, Einheiten und zugrunde liegende Buchungen.",
  },
  {
    icon: ReceiptText,
    title: "Belege am richtigen Vorgang",
    text: "Ordne Dokumente, Ausgaben und Zahlungen dort zu, wo sie wirtschaftlich hingehören.",
  },
  {
    icon: Landmark,
    title: "Finanzierungen im Blick",
    text: "Bündele Darlehen, Zinsen, Tilgung und wichtige Laufzeiten in einer gemeinsamen Sicht.",
  },
  {
    icon: Wrench,
    title: "Sanierungen planbar machen",
    text: "Verknüpfe Maßnahmen, Budgets, Dokumente und Aufgaben mit der betroffenen Immobilie.",
  },
  {
    icon: BookOpenCheck,
    title: "Sauber vorbereitet übergeben",
    text: "Stelle strukturierte Jahresauswertungen und Unterlagen für Buchhaltung oder Steuerberatung bereit.",
  },
];

const faqs = [
  {
    question: "Für wen ist Estate Brain gedacht?",
    answer:
      "Estate Brain richtet sich an private Immobilieninvestoren und Vermieter mit mehreren Einheiten, die wirtschaftliche Daten, Dokumente und Aufgaben nicht länger in getrennten Werkzeugen verwalten möchten.",
  },
  {
    question: "Ersetzt Estate Brain meine Steuerberatung?",
    answer:
      "Nein. Estate Brain strukturiert Daten, macht Annahmen transparent und zeigt unverbindliche Modellrechnungen. Die Anwendung erstellt keine verbindliche Steuerberatung und ersetzt weder die Prüfung noch die Beratung durch einen Steuerberater.",
  },
  {
    question: "Wie entstehen die dargestellten steuerlichen Effekte?",
    answer:
      "Die Schätzungen basieren auf den von dir hinterlegten Einnahmen, Aufwendungen, Abschreibungs- und Steuersatzannahmen. Annahmen bleiben editierbar; die zugrunde liegenden Positionen sollen jederzeit nachvollziehbar sein.",
  },
  {
    question: "Kann ich Zahlungen automatisch zuordnen lassen?",
    answer:
      "Estate Brain berücksichtigt unter anderem Betrag, Absender, Verwendungszweck und Buchungsdatum. Eindeutige Treffer können automatisiert verarbeitet werden; bei Unsicherheit bleibt die Entscheidung bei dir. Ohne eingerichteten Bankanbieter steht ein Demo-Modus zur Verfügung.",
  },
  {
    question: "Was passiert mit Rechnungen und Belegen?",
    answer:
      "Dokumente können einer Immobilie, einer Einheit, einer Ausgabe und – soweit vorhanden – einer Zahlung zugeordnet werden. Unvollständige oder unklare Belege bleiben sichtbar, damit sie vor der Jahresauswertung geprüft werden können.",
  },
  {
    question: "Kann mein Steuerberater mitarbeiten?",
    answer:
      "Ein separater Buchhaltungs- oder Steuerberaterzugang ist vorgesehen. Berechtigungen lassen sich auf die notwendigen Daten und Funktionen begrenzen, ohne uneingeschränkten Zugriff auf die Organisation zu vergeben.",
  },
  {
    question: "Wie schützt Estate Brain meine Daten?",
    answer:
      "Die Anwendung ist auf getrennte Organisationsbereiche, rollenbasierte Zugriffe, geschützte Dokumente und serverseitige Prüfungen ausgelegt. Bankzugangsdaten sollen nicht in Estate Brain gespeichert werden.",
  },
];

export function LandingPage() {
  return (
    <div lang="de" className="min-h-screen overflow-x-clip bg-[#f6f7f4] text-[#102a2a]">
      <a
        href="#hauptinhalt"
        className="fixed left-4 top-3 z-[60] -translate-y-20 rounded-lg bg-[#173f35] px-4 py-2 text-sm font-medium text-white transition-transform focus:translate-y-0"
      >
        Zum Inhalt springen
      </a>
      <MarketingHeader />

      <main id="hauptinhalt" tabIndex={-1} className="outline-none">
        <HeroSection />
        <TrustStrip />
        <ProblemSection />
        <BenefitsSection />
        <TaxSection />
        <PaymentSection />
        <DocumentsSection />
        <PortfolioSection />
        <PlanningSection />
        <CommunicationSection />
        <AudienceSection />
        <SecuritySection />
        <FaqSection />
        <FinalCta />
      </main>

      <MarketingFooter />
    </div>
  );
}

function HeroSection() {
  return (
    <section className="relative isolate overflow-hidden border-b border-[#dce7e3] bg-[linear-gradient(135deg,#edf7f3_0%,#f6f7f4_48%,#f5f4ec_100%)]">
      <div
        aria-hidden="true"
        className="absolute -left-24 top-16 -z-10 size-80 rounded-full bg-emerald-200/25 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="absolute -right-20 bottom-10 -z-10 size-96 rounded-full bg-[#d9e4ee]/40 blur-3xl"
      />
      <div className="mx-auto grid w-full max-w-7xl items-center gap-14 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-[0.88fr_1.12fr] lg:gap-14 lg:px-10 lg:py-24 xl:py-28">
        <div className="max-w-2xl">
          <Badge className="h-7 border border-emerald-200 bg-white/80 px-3 text-emerald-800 shadow-sm backdrop-blur-sm">
            <Sparkles aria-hidden="true" />
            Finanzielle Klarheit für private Vermieter
          </Badge>
          <h1 className="mt-7 text-[2.7rem] font-semibold leading-[1.02] tracking-[-0.052em] text-balance text-[#102a2a] sm:text-6xl lg:text-[4rem]">
            Deine Immobilien. Deine Zahlen. Ein klarer Überblick.
          </h1>
          <p className="mt-7 max-w-xl text-lg leading-8 text-pretty text-[#566c66]">
            Estate Brain verbindet Mieteinnahmen, Ausgaben, Rechnungen,
            Finanzierungen und steuerliche Effekte in einer zentralen Anwendung
            für private Immobilieninvestoren.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Button
              asChild
              className="h-12 rounded-xl bg-[#173f35] px-6 text-base text-white shadow-[0_12px_30px_-14px_rgba(18,53,47,0.7)] hover:bg-[#1b4b43]"
            >
              <Link href="/registrieren">
                Kostenlos starten
                <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="h-12 rounded-xl border-[#c8d9d3] bg-white/70 px-6 text-base text-[#173f35] shadow-sm hover:bg-white"
            >
              <Link href="/demo">Demo ansehen</Link>
            </Button>
          </div>
          <p className="mt-5 flex items-start gap-2 text-sm leading-6 text-[#70827d]">
            <CircleCheck
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0 text-emerald-700"
            />
            Starte mit einer geführten Einrichtung oder erkunde die Anwendung
            zunächst mit Demodaten.
          </p>
        </div>

        <div className="relative lg:translate-x-4">
          <div
            aria-hidden="true"
            className="absolute inset-x-12 -bottom-8 h-24 rounded-full bg-[#277963]/20 blur-3xl"
          />
          <DashboardPreview />
        </div>
      </div>
    </section>
  );
}

function TrustStrip() {
  const points = [
    { icon: ShieldCheck, label: "DSGVO-orientierte Datenhaltung" },
    { icon: SlidersHorizontal, label: "Editierbare Annahmen" },
    { icon: Search, label: "Nachvollziehbare Berechnungen" },
    { icon: WalletCards, label: "Euro und deutsche Formate" },
  ];

  return (
    <div className="border-b border-[#e2ebe8] bg-white">
      <div className="mx-auto grid w-full max-w-7xl gap-px bg-[#e2ebe8] sm:grid-cols-2 lg:grid-cols-4">
        {points.map((point) => (
          <div
            key={point.label}
            className="flex items-center justify-center gap-2.5 bg-white px-5 py-4 text-center text-xs font-medium text-[#526a64]"
          >
            <point.icon aria-hidden="true" className="size-4 text-emerald-700" />
            {point.label}
          </div>
        ))}
      </div>
    </div>
  );
}

function ProblemSection() {
  return (
    <section
      id="produkt"
      className="scroll-mt-24 px-5 py-20 sm:px-8 sm:py-24 lg:px-10 lg:py-28"
    >
      <div className="mx-auto w-full max-w-7xl">
        <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
          <SectionHeading
            eyebrow="Die Ausgangslage"
            title="Wenn aus Vermieten immer mehr Verwalten wird."
            description="Mit jeder weiteren Immobilie wachsen nicht nur die Einnahmen, sondern auch Buchungen, Fristen, Dokumente und Entscheidungen. Estate Brain bringt diese Zusammenhänge in eine gemeinsame, ruhige Arbeitsoberfläche."
          />

          <div className="grid gap-4 sm:grid-cols-3">
            {painPoints.map((point) => (
              <Card
                key={point.title}
                className="border-0 bg-[#f5f8f6] py-5 shadow-none ring-1 ring-[#dfe9e5]"
              >
                <CardHeader className="gap-4 px-5">
                  <span className="grid size-10 place-items-center rounded-xl bg-white text-emerald-700 shadow-sm ring-1 ring-[#dfe9e5]">
                    <point.icon aria-hidden="true" className="size-5" />
                  </span>
                  <CardTitle className="text-base text-[#1b3e38]">
                    {point.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-5">
                  <p className="text-sm leading-6 text-[#60736e]">{point.text}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function BenefitsSection() {
  return (
    <section
      id="funktionen"
      className="scroll-mt-24 border-y border-[#dce7e3] bg-[#f3f7f5] px-5 py-20 sm:px-8 sm:py-24 lg:px-10 lg:py-28"
    >
      <div className="mx-auto w-full max-w-7xl">
        <SectionHeading
          eyebrow="Ein System statt Insellösungen"
          title="Alles, was deine Immobilien wirtschaftlich zusammenhält."
          description="Estate Brain verbindet laufende Verwaltung mit Portfolioanalyse und Jahresvorbereitung – ohne die Details hinter einer schönen Kennzahl zu verstecken."
          align="center"
        />
        <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {productBenefits.map((benefit) => (
            <Card
              key={benefit.title}
              className="group border-0 bg-white py-6 shadow-[0_20px_55px_-46px_rgba(17,65,55,0.55)] ring-1 ring-[#dce7e3] transition-transform duration-300 hover:-translate-y-1"
            >
              <CardHeader className="gap-5 px-6">
                <span className="grid size-11 place-items-center rounded-2xl bg-[#e9f4f0] text-[#1b6856] transition-colors group-hover:bg-[#173f35] group-hover:text-white">
                  <benefit.icon aria-hidden="true" className="size-5" />
                </span>
                <CardTitle className="text-lg tracking-[-0.02em] text-[#183b35]">
                  {benefit.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-6">
                <p className="text-sm leading-6 text-[#60736e]">{benefit.text}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-14 rounded-[2rem] border border-[#d5e4df] bg-white p-4 shadow-[0_28px_80px_-52px_rgba(18,53,47,0.55)] sm:p-6 lg:p-8">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">
                Dashboard-Vorschau
              </p>
              <h3 className="mt-2 text-2xl font-semibold tracking-[-0.035em] text-[#173a34]">
                Das Wesentliche zuerst. Die Details einen Klick entfernt.
              </h3>
            </div>
            <p className="max-w-md text-sm leading-6 text-[#687b75]">
              Filtere nach Zeitraum, Immobilie oder Status und gehe von jeder
              Kennzahl direkt zu den relevanten Vorgängen.
            </p>
          </div>
          <DashboardPreview />
        </div>
      </div>
    </section>
  );
}

function TaxSection() {
  const stages = [
    {
      icon: HandCoins,
      label: "Mieteinnahmen",
      note: "Aus Mietverhältnissen und weiteren Einnahmen",
      tone: "bg-[#e6f3ed] text-[#1d6c58]",
    },
    {
      icon: ReceiptText,
      label: "Laufende Ausgaben",
      note: "Liquiditätswirksame Kosten sauber zugeordnet",
      tone: "bg-[#f8eee5] text-[#985f30]",
    },
    {
      icon: Landmark,
      label: "Zins und Tilgung",
      note: "Steuerwirkung und Liquidität getrennt betrachtet",
      tone: "bg-[#e9eff7] text-[#3d648d]",
    },
    {
      icon: Calculator,
      label: "Geschätzte Steuerwirkung",
      note: "Auf Basis deiner editierbaren Annahmen",
      tone: "bg-[#f0ecf8] text-[#6b51a0]",
    },
  ];

  return (
    <section
      id="steueruebersicht"
      className="scroll-mt-24 overflow-hidden bg-[#102f2a] px-5 py-20 text-white sm:px-8 sm:py-24 lg:px-10 lg:py-28"
    >
      <div className="mx-auto grid w-full max-w-7xl items-center gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
        <div>
          <SectionHeading
            eyebrow="Steuerübersicht"
            title="Steuerliche Effekte verstehen – ohne Liquidität und Steuerlogik zu vermischen."
            description="Estate Brain stellt den realen Zahlungsfluss und das geschätzte steuerliche Ergebnis getrennt dar. So wird sichtbar, warum Tilgung den Kontostand verändert, aber nicht automatisch als steuerlicher Aufwand zählt."
            inverse
          />
          <ul className="mt-8 grid gap-3 text-sm text-emerald-50/75 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            {[
              "Annahmen jederzeit editierbar",
              "Positionen bis zum Beleg nachvollziehbar",
              "Sicht je Immobilie und Portfolio",
              "Fehlende Belege klar markiert",
            ].map((item) => (
              <li key={item} className="flex items-center gap-2.5">
                <span className="grid size-5 place-items-center rounded-full bg-emerald-300/15 text-emerald-200">
                  <Check aria-hidden="true" className="size-3" />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.06] p-5 shadow-2xl shadow-black/10 backdrop-blur-sm sm:p-7">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.13em] text-emerald-200/70">
                Modellrechnung
              </p>
              <h3 className="mt-2 text-xl font-semibold tracking-[-0.025em]">
                Vom Mieteingang zum geschätzten Cashflow
              </h3>
            </div>
            <Badge className="border border-white/10 bg-white/10 text-emerald-50">
              Transparent
            </Badge>
          </div>

          <div className="mt-7 space-y-3">
            {stages.map((stage, index) => (
              <div key={stage.label}>
                <div className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.07] p-4">
                  <span
                    className={`grid size-10 shrink-0 place-items-center rounded-xl ${stage.tone}`}
                  >
                    <stage.icon aria-hidden="true" className="size-5" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold">{stage.label}</p>
                    <p className="mt-1 text-xs leading-5 text-emerald-50/60">
                      {stage.note}
                    </p>
                  </div>
                </div>
                {index < stages.length - 1 ? (
                  <div
                    aria-hidden="true"
                    className="ml-9 h-3 border-l border-dashed border-emerald-200/30"
                  />
                ) : null}
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-2xl bg-emerald-300/10 p-4 text-xs leading-5 text-emerald-50/70">
            Estate Brain dient ausschließlich der finanziellen Übersicht und
            Vorbereitung von Unterlagen. Die dargestellten steuerlichen
            Berechnungen sind unverbindliche Schätzungen und ersetzen keine
            Beratung durch einen Steuerberater.
          </div>
        </div>
      </div>
    </section>
  );
}

function PaymentSection() {
  const steps = [
    {
      icon: Search,
      title: "Zahlung erkennen",
      text: "Betrag, Absender, Verwendungszweck und Buchungsdatum werden gemeinsam betrachtet.",
    },
    {
      icon: Link2,
      title: "Vorschlag begründen",
      text: "Estate Brain zeigt, warum eine Zahlung zu einem Mietverhältnis oder Vorgang passen könnte.",
    },
    {
      icon: CircleCheck,
      title: "Sicher zuordnen",
      text: "Klare Treffer werden verarbeitet; unklare Zuordnungen bleiben zur Bestätigung offen.",
    },
  ];

  return (
    <section className="px-5 py-20 sm:px-8 sm:py-24 lg:px-10 lg:py-28">
      <div className="mx-auto grid w-full max-w-7xl items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
        <div className="order-2 lg:order-1">
          <div className="relative rounded-[2rem] border border-[#d9e5e1] bg-[#f3f8f6] p-5 sm:p-7">
            <div className="flex items-center justify-between border-b border-[#dce7e3] pb-5">
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-xl bg-white text-emerald-700 shadow-sm ring-1 ring-[#dce7e3]">
                  <Landmark aria-hidden="true" className="size-5" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-[#23433d]">
                    Neue Zahlung erkannt
                  </p>
                  <p className="text-xs text-[#758781]">Zuordnung ausstehend</p>
                </div>
              </div>
              <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-medium text-amber-800">
                Prüfen
              </span>
            </div>

            <div className="mt-5 rounded-2xl border border-[#dce7e3] bg-white p-5 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-[0.11em] text-[#78908a]">
                Zuordnungsvorschlag
              </p>
              <p className="mt-3 text-base font-semibold leading-6 text-[#1a3c36]">
                Diese Zahlung könnte zu einem hinterlegten Mietverhältnis
                gehören.
              </p>
              <div className="mt-5 grid gap-2 sm:grid-cols-2">
                {[
                  "Betrag stimmt überein",
                  "Absender ist bekannt",
                  "Verwendungszweck passt",
                  "Buchungszeitraum plausibel",
                ].map((reason) => (
                  <span
                    key={reason}
                    className="flex items-center gap-2 rounded-lg bg-[#f2f7f5] px-3 py-2 text-xs text-[#526b64]"
                  >
                    <Check
                      aria-hidden="true"
                      className="size-3.5 text-emerald-700"
                    />
                    {reason}
                  </span>
                ))}
              </div>
              <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                <span className="inline-flex h-10 items-center justify-center rounded-xl bg-[#173f35] px-4 text-sm font-medium text-white">
                  Zuordnung bestätigen
                </span>
                <span className="inline-flex h-10 items-center justify-center rounded-xl border border-[#cfddd8] bg-white px-4 text-sm font-medium text-[#38554f]">
                  Anderen Vorgang wählen
                </span>
              </div>
            </div>

            <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-[#70827d]">
              <ShieldCheck
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0 text-emerald-700"
              />
              Bankzugangsdaten werden nicht in Estate Brain gespeichert. Ohne
              eingerichteten Anbieter bleibt der Demo-Modus nutzbar.
            </p>
          </div>
        </div>

        <div className="order-1 lg:order-2">
          <SectionHeading
            eyebrow="Automatisierte Zahlungszuordnung"
            title="Weniger Suchen. Mehr Sicherheit bei jedem Treffer."
            description="Zahlungseingänge werden nicht nur vorgeschlagen, sondern nachvollziehbar erklärt. Bei Unsicherheit fragt Estate Brain nach, bevor eine Zuordnung übernommen wird."
          />
          <div className="mt-8 space-y-5">
            {steps.map((step) => (
              <div key={step.title} className="flex gap-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#e9f4f0] text-emerald-700">
                  <step.icon aria-hidden="true" className="size-5" />
                </span>
                <div>
                  <h3 className="font-semibold text-[#1b3d37]">{step.title}</h3>
                  <p className="mt-1 text-sm leading-6 text-[#647771]">
                    {step.text}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function DocumentsSection() {
  const documentFlow = [
    {
      icon: Upload,
      title: "Hochladen",
      text: "Rechnungen und Belege zentral ablegen.",
    },
    {
      icon: Search,
      title: "Strukturieren",
      text: "Rechnungsdaten prüfen oder manuell ergänzen.",
    },
    {
      icon: Link2,
      title: "Zuordnen",
      text: "Immobilie, Einheit, Ausgabe und Zahlung verbinden.",
    },
    {
      icon: FileCheck2,
      title: "Vorbereiten",
      text: "Fehlende oder unklare Nachweise sichtbar halten.",
    },
  ];

  return (
    <section className="border-y border-[#dce7e3] bg-[#f3f7f5] px-5 py-20 sm:px-8 sm:py-24 lg:px-10 lg:py-28">
      <div className="mx-auto w-full max-w-7xl">
        <SectionHeading
          eyebrow="Rechnungen und Belege"
          title="Jeder Beleg bekommt seinen wirtschaftlichen Kontext."
          description="Vom Upload bis zur Jahresauswertung bleiben Dokument, Buchung und Immobilie miteinander verbunden. Unvollständige Vorgänge verschwinden nicht, sondern werden gezielt zur Prüfung vorgelegt."
          align="center"
        />

        <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {documentFlow.map((step) => (
            <div
              key={step.title}
              className="relative rounded-2xl border border-[#dce7e3] bg-white p-6"
            >
              <span className="grid size-10 place-items-center rounded-xl bg-[#e9f4f0] text-emerald-700">
                <step.icon aria-hidden="true" className="size-5" />
              </span>
              <h3 className="mt-5 font-semibold text-[#1b3d37]">{step.title}</h3>
              <p className="mt-2 text-sm leading-6 text-[#647771]">
                {step.text}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-8 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[1.75rem] border border-[#dce7e3] bg-white p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-xl bg-[#efeafd] text-[#6750a0]">
                <ReceiptText aria-hidden="true" className="size-5" />
              </span>
              <div>
                <h3 className="font-semibold text-[#1b3d37]">
                  Prüfstatus auf einen Blick
                </h3>
                <p className="text-xs text-[#788b85]">
                  Klarheit vor dem Export
                </p>
              </div>
            </div>
            <div className="mt-6 grid gap-2 sm:grid-cols-2">
              {[
                { label: "Vollständig belegt", color: "bg-emerald-500" },
                { label: "Beleg fehlt", color: "bg-amber-500" },
                { label: "Zuordnung unklar", color: "bg-violet-500" },
                { label: "Prüfung erforderlich", color: "bg-sky-500" },
              ].map((status) => (
                <div
                  key={status.label}
                  className="flex items-center gap-3 rounded-xl bg-[#f7faf8] px-4 py-3 text-sm text-[#4f6760]"
                >
                  <span className={`size-2 rounded-full ${status.color}`} />
                  {status.label}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[1.75rem] bg-[#163b35] p-6 text-white sm:p-8">
            <FolderCheck
              aria-hidden="true"
              className="size-7 text-emerald-300"
            />
            <h3 className="mt-5 text-xl font-semibold tracking-[-0.025em]">
              Bereit für die gemeinsame Prüfung
            </h3>
            <p className="mt-3 text-sm leading-6 text-emerald-50/70">
              Filtere offene Zuordnungen, ergänze fehlende Nachweise und stelle
              eine nachvollziehbare Jahresauswertung für die weitere Beratung
              zusammen.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function PortfolioSection() {
  return (
    <section
      id="cashflow"
      className="scroll-mt-24 px-5 py-20 sm:px-8 sm:py-24 lg:px-10 lg:py-28"
    >
      <div className="mx-auto grid w-full max-w-7xl gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
        <div>
          <SectionHeading
            eyebrow="Cashflow und Portfolio"
            title="Erst das Gesamtbild. Dann die Immobilie, die Aufmerksamkeit braucht."
            description="Vergleiche den operativen Cashflow mit dem Ergebnis nach Finanzierung und geschätzter Steuerwirkung. Jede Perspektive lässt sich auf eine Immobilie oder Einheit eingrenzen."
          />
          <div className="mt-8 space-y-3">
            {[
              "Einnahmen und Ausgaben im gewählten Zeitraum",
              "Cashflow vor und nach Finanzierung",
              "Geschätzte Steuerwirkung separat ausgewiesen",
              "Offene Zahlungen und fehlende Belege im Kontext",
            ].map((item) => (
              <div
                key={item}
                className="flex items-center gap-3 rounded-xl border border-[#e1eae7] bg-white px-4 py-3 text-sm text-[#536a64]"
              >
                <span className="grid size-6 place-items-center rounded-full bg-[#e7f3ee] text-emerald-700">
                  <Check aria-hidden="true" className="size-3.5" />
                </span>
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[2rem] border border-[#d8e5e0] bg-[#f3f8f6] p-5 sm:p-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.13em] text-emerald-700">
                Portfolioansicht
              </p>
              <h3 className="mt-2 text-xl font-semibold text-[#1a3c36]">
                Immobilien im Vergleich
              </h3>
            </div>
            <span className="inline-flex h-9 items-center gap-2 self-start rounded-xl border border-[#d3e1dc] bg-white px-3 text-xs text-[#567069]">
              <SlidersHorizontal aria-hidden="true" className="size-3.5" />
              Ansicht filtern
            </span>
          </div>

          <div className="mt-6 overflow-hidden rounded-2xl border border-[#dce7e3] bg-white">
            <div className="grid grid-cols-[1fr_auto] border-b border-[#e3ece9] bg-[#f8faf9] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#80908c] sm:grid-cols-[1fr_0.7fr_0.7fr]">
              <span>Ebene</span>
              <span className="hidden sm:block">Cashflow</span>
              <span>Status</span>
            </div>
            {[
              {
                name: "Gesamtportfolio",
                meta: "Alle Immobilien",
                cashflow: "Konsolidiert",
                status: "Im Blick",
                icon: Building2,
              },
              {
                name: "Ausgewählte Immobilie",
                meta: "Objektansicht",
                cashflow: "Aufgeschlüsselt",
                status: "Analysieren",
                icon: House,
              },
              {
                name: "Ausgewählte Einheit",
                meta: "Detailansicht",
                cashflow: "Nachvollziehbar",
                status: "Öffnen",
                icon: WalletCards,
              },
            ].map((row) => (
              <div
                key={row.name}
                className="grid grid-cols-[1fr_auto] items-center border-b border-[#e7efec] px-4 py-4 last:border-0 sm:grid-cols-[1fr_0.7fr_0.7fr]"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#e9f4f0] text-emerald-700">
                    <row.icon aria-hidden="true" className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[#25463f]">
                      {row.name}
                    </p>
                    <p className="truncate text-xs text-[#83938f]">
                      {row.meta}
                    </p>
                  </div>
                </div>
                <p className="hidden text-xs text-[#5c736c] sm:block">
                  {row.cashflow}
                </p>
                <span className="justify-self-end rounded-full bg-[#edf5f2] px-2.5 py-1 text-[11px] font-medium text-emerald-800">
                  {row.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function PlanningSection() {
  return (
    <section className="border-y border-[#dce7e3] bg-[#f3f7f5] px-5 py-20 sm:px-8 sm:py-24 lg:px-10 lg:py-28">
      <div className="mx-auto w-full max-w-7xl">
        <SectionHeading
          eyebrow="Sanierung und Finanzierung"
          title="Heute sehen, was morgen Kapital bindet."
          description="Plane Maßnahmen und Finanzierungslaufzeiten nicht losgelöst vom Portfolio. Estate Brain bringt Budget, Zeit, Dokumente und Cashflow-Auswirkung in denselben Zusammenhang."
          align="center"
        />

        <div className="mt-12 grid gap-5 lg:grid-cols-2">
          <div className="overflow-hidden rounded-[1.75rem] border border-[#dce7e3] bg-white">
            <div className="bg-[#173b35] p-7 text-white sm:p-8">
              <Wrench aria-hidden="true" className="size-7 text-emerald-300" />
              <h3 className="mt-5 text-2xl font-semibold tracking-[-0.035em]">
                Sanierungen vorausschauend planen
              </h3>
              <p className="mt-3 text-sm leading-6 text-emerald-50/70">
                Maßnahmen nach Immobilie bündeln, Aufgaben verteilen und
                erwartete Ausgaben in die Liquiditätsplanung einordnen.
              </p>
            </div>
            <div className="grid gap-3 p-6 sm:grid-cols-2 sm:p-8">
              {[
                "Maßnahme und Status",
                "Budget und Belege",
                "Aufgaben und Zuständigkeit",
                "Auswirkung auf den Cashflow",
              ].map((item) => (
                <div
                  key={item}
                  className="flex items-center gap-2.5 rounded-xl bg-[#f3f8f6] px-3 py-3 text-sm text-[#536b64]"
                >
                  <Check
                    aria-hidden="true"
                    className="size-4 shrink-0 text-emerald-700"
                  />
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="overflow-hidden rounded-[1.75rem] border border-[#dce7e3] bg-white">
            <div className="bg-[#e8eef5] p-7 sm:p-8">
              <Landmark aria-hidden="true" className="size-7 text-[#42668e]" />
              <h3 className="mt-5 text-2xl font-semibold tracking-[-0.035em] text-[#1c3a55]">
                Finanzierungen im Gesamtbild
              </h3>
              <p className="mt-3 text-sm leading-6 text-[#536d85]">
                Zins, Tilgung, Restschuld und relevante Laufzeiten neben dem
                wirtschaftlichen Ergebnis der finanzierten Immobilie sehen.
              </p>
            </div>
            <div className="p-6 sm:p-8">
              <div className="space-y-4">
                {[
                  { label: "Darlehensübersicht", width: "w-4/5" },
                  { label: "Zins und Tilgung", width: "w-3/5" },
                  { label: "Laufzeiten und Anschluss", width: "w-2/3" },
                ].map((item) => (
                  <div key={item.label}>
                    <div className="flex items-center justify-between text-xs text-[#5f7488]">
                      <span>{item.label}</span>
                      <span>Im Blick</span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#edf1f5]">
                      <div
                        aria-hidden="true"
                        className={`h-full rounded-full bg-[#6689ac] ${item.width}`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function CommunicationSection() {
  return (
    <section className="px-5 py-20 sm:px-8 sm:py-24 lg:px-10 lg:py-28">
      <div className="mx-auto grid w-full max-w-7xl items-center gap-12 lg:grid-cols-[0.95fr_1.05fr] lg:gap-16">
        <div>
          <SectionHeading
            eyebrow="Kommunikation und Aufgaben"
            title="Vom Anliegen zur erledigten Aufgabe – ohne verlorenen Kontext."
            description="Nachrichten, Schäden, Dokumente und Aufgaben bleiben bei der betroffenen Einheit und dem Mietverhältnis. So ist für alle Beteiligten nachvollziehbar, was bereits passiert ist."
          />
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-[#dfe9e5] bg-white p-5">
              <MessagesSquare
                aria-hidden="true"
                className="size-5 text-emerald-700"
              />
              <h3 className="mt-4 font-semibold text-[#1b3d37]">
                Mieterkommunikation
              </h3>
              <p className="mt-2 text-sm leading-6 text-[#647771]">
                Nachrichten und Anliegen strukturiert beim Mietverhältnis
                dokumentieren.
              </p>
            </div>
            <div className="rounded-2xl border border-[#dfe9e5] bg-white p-5">
              <CircleCheck
                aria-hidden="true"
                className="size-5 text-emerald-700"
              />
              <h3 className="mt-4 font-semibold text-[#1b3d37]">
                Klare Zuständigkeit
              </h3>
              <p className="mt-2 text-sm leading-6 text-[#647771]">
                Aufgaben zuweisen, priorisieren und bis zur Erledigung
                verfolgen.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-[2rem] border border-[#d9e5e1] bg-[#f3f8f6] p-5 sm:p-7">
          <div className="flex items-center justify-between rounded-2xl border border-[#dce7e3] bg-white px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-full bg-[#e5f2ed] text-emerald-700">
                <CircleUserRound aria-hidden="true" className="size-5" />
              </span>
              <div>
                <p className="text-sm font-semibold text-[#24443e]">
                  Anliegen zur Einheit
                </p>
                <p className="text-xs text-[#7b8d88]">Im Kontext gebündelt</p>
              </div>
            </div>
            <span className="rounded-full bg-[#edf5f2] px-2.5 py-1 text-[11px] font-medium text-emerald-800">
              Offen
            </span>
          </div>
          <div className="mt-4 space-y-3">
            <div className="mr-8 rounded-2xl rounded-tl-md bg-white p-4 text-sm leading-6 text-[#526a64] shadow-sm ring-1 ring-[#dce7e3]">
              Eine neue Meldung wurde aufgenommen und direkt mit der betroffenen
              Einheit verknüpft.
            </div>
            <div className="ml-8 rounded-2xl rounded-tr-md bg-[#173b35] p-4 text-sm leading-6 text-emerald-50/85">
              Die zuständige Person wurde informiert. Der nächste Schritt ist
              als Aufgabe hinterlegt.
            </div>
          </div>
          <div className="mt-4 rounded-2xl border border-[#dce7e3] bg-white p-4">
            <div className="flex items-center gap-3">
              <span className="grid size-8 place-items-center rounded-lg bg-[#e9f4f0] text-emerald-700">
                <Wrench aria-hidden="true" className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-[#294b44]">
                  Nächsten Schritt koordinieren
                </p>
                <p className="text-xs text-[#80918c]">
                  Aufgabe und Kommunikation verbunden
                </p>
              </div>
              <CircleCheck
                aria-hidden="true"
                className="size-5 text-emerald-600"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function AudienceSection() {
  const audiences = [
    {
      icon: House,
      title: "Private Vermieter",
      text: "Für Eigentümer, die mehrere Mietverhältnisse strukturiert und ohne Tabellenchaos steuern möchten.",
    },
    {
      icon: ChartNoAxesCombined,
      title: "Wachsende Portfolios",
      text: "Für Investoren, die Einzelobjekte und Gesamtportfolio wirtschaftlich vergleichen wollen.",
    },
    {
      icon: UsersRound,
      title: "Kleine Teams",
      text: "Für Eigentümer, Immobilienmanager und Mitarbeitende mit klar abgegrenzten Aufgaben.",
    },
    {
      icon: BookOpenCheck,
      title: "Beratende Partner",
      text: "Für Buchhaltung und Steuerberatung mit vorbereitetem, gezielt eingeschränktem Zugang.",
    },
  ];

  return (
    <section
      id="fuer-wen"
      className="scroll-mt-24 border-y border-[#dce7e3] bg-[#f3f7f5] px-5 py-20 sm:px-8 sm:py-24 lg:px-10 lg:py-28"
    >
      <div className="mx-auto w-full max-w-7xl">
        <SectionHeading
          eyebrow="Für wen?"
          title="Für Menschen, die ihr Portfolio selbst führen – aber nicht alles selbst zusammensuchen wollen."
          description="Estate Brain wächst mit der organisatorischen Realität privater Immobilieninvestoren: vom persönlichen Überblick bis zur Zusammenarbeit mit Team und Beratung."
          align="center"
        />
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {audiences.map((audience) => (
            <div
              key={audience.title}
              className="rounded-2xl border border-[#dce7e3] bg-white p-6"
            >
              <span className="grid size-11 place-items-center rounded-2xl bg-[#e9f4f0] text-emerald-700">
                <audience.icon aria-hidden="true" className="size-5" />
              </span>
              <h3 className="mt-5 font-semibold text-[#1a3d36]">
                {audience.title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-[#647771]">
                {audience.text}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function SecuritySection() {
  const safeguards = [
    {
      icon: UsersRound,
      title: "Rollenbasierte Zugriffe",
      text: "Eigentümer, Management, Mitarbeitende, Beratung und Mieter erhalten jeweils passende Berechtigungen.",
    },
    {
      icon: DatabaseZap,
      title: "Getrennte Organisationen",
      text: "Datenzugriffe werden nicht nur in der Oberfläche, sondern auch server- und datenbankseitig begrenzt.",
    },
    {
      icon: LockKeyhole,
      title: "Geschützte Dokumente",
      text: "Dateien sind für autorisierte Nutzer vorgesehen und werden nicht als frei zugängliche Ablage behandelt.",
    },
    {
      icon: ArrowDownToLine,
      title: "Datenkontrolle",
      text: "Datenexport, Aufbewahrung und Löschanfragen werden als nachvollziehbare Prozesse berücksichtigt.",
    },
  ];

  return (
    <section
      id="sicherheit"
      className="scroll-mt-24 bg-[#102f2a] px-5 py-20 text-white sm:px-8 sm:py-24 lg:px-10 lg:py-28"
    >
      <div className="mx-auto w-full max-w-7xl">
        <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
          <div>
            <SectionHeading
              eyebrow="Datenschutz und Sicherheit"
              title="Vertrauen beginnt bei klar begrenzten Zugriffen."
              description="Estate Brain ist auf Datenminimierung, sichere Ablage und eine strikte Trennung zwischen Organisationen und Rollen ausgelegt."
              inverse
            />
            <div className="mt-8 rounded-2xl border border-emerald-200/15 bg-white/[0.06] p-5">
              <div className="flex gap-3">
                <ShieldCheck
                  aria-hidden="true"
                  className="mt-0.5 size-5 shrink-0 text-emerald-300"
                />
                <p className="text-sm leading-6 text-emerald-50/75">
                  Sensible Aktionen werden serverseitig geprüft. Geheimnisse
                  und privilegierte Schlüssel gehören nicht in den Browser oder
                  das öffentliche Repository.
                </p>
              </div>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {safeguards.map((safeguard) => (
              <div
                key={safeguard.title}
                className="rounded-2xl border border-white/10 bg-white/[0.06] p-6"
              >
                <span className="grid size-10 place-items-center rounded-xl bg-emerald-300/10 text-emerald-200">
                  <safeguard.icon aria-hidden="true" className="size-5" />
                </span>
                <h3 className="mt-5 font-semibold">{safeguard.title}</h3>
                <p className="mt-2 text-sm leading-6 text-emerald-50/65">
                  {safeguard.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function FaqSection() {
  return (
    <section className="px-5 py-20 sm:px-8 sm:py-24 lg:px-10 lg:py-28">
      <div className="mx-auto grid w-full max-w-6xl gap-12 lg:grid-cols-[0.7fr_1.3fr] lg:gap-16">
        <div>
          <SectionHeading
            eyebrow="FAQ"
            title="Häufige Fragen, klar beantwortet."
            description="Noch unsicher, wie Estate Brain in deinen Alltag passt? Die wichtigsten Grundlagen findest du hier."
          />
          <div className="mt-7 flex items-center gap-3 rounded-2xl bg-[#f1f7f4] p-4 text-sm text-[#526a64]">
            <CircleHelp
              aria-hidden="true"
              className="size-5 shrink-0 text-emerald-700"
            />
            In der Demo kannst du die wichtigsten Abläufe ohne eigene Daten
            kennenlernen.
          </div>
        </div>

        <Accordion
          type="single"
          collapsible
          className="rounded-[1.5rem] border border-[#dce7e3] bg-white px-5 sm:px-7"
        >
          {faqs.map((faq) => (
            <AccordionItem key={faq.question} value={faq.question}>
              <AccordionTrigger className="py-5 text-base font-semibold text-[#1d4039] hover:no-underline">
                {faq.question}
              </AccordionTrigger>
              <AccordionContent className="pb-5 pr-7 text-sm leading-6 text-[#60736e]">
                <p>{faq.answer}</p>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="px-5 pb-20 sm:px-8 sm:pb-24 lg:px-10 lg:pb-28">
      <div className="relative mx-auto w-full max-w-7xl overflow-hidden rounded-[2rem] bg-[linear-gradient(135deg,#1a4b42_0%,#102f2a_62%,#193f52_100%)] px-6 py-14 text-center text-white shadow-[0_30px_90px_-48px_rgba(18,53,47,0.8)] sm:px-10 sm:py-16">
        <div
          aria-hidden="true"
          className="absolute -left-20 -top-20 size-64 rounded-full border border-emerald-200/10"
        />
        <div
          aria-hidden="true"
          className="absolute -bottom-28 -right-16 size-80 rounded-full border border-sky-100/10"
        />
        <Badge className="relative border border-white/10 bg-white/10 text-emerald-50">
          <BadgeEuro aria-hidden="true" />
          Dein Portfolio, verständlich gebündelt
        </Badge>
        <h2 className="relative mx-auto mt-6 max-w-3xl text-3xl font-semibold tracking-[-0.045em] text-balance sm:text-5xl">
          Bring Ruhe in deine Immobilienzahlen.
        </h2>
        <p className="relative mx-auto mt-5 max-w-2xl text-base leading-7 text-emerald-50/70 sm:text-lg">
          Starte mit einer klaren Übersicht über Einnahmen, Ausgaben,
          Finanzierungen, Dokumente und geschätzte steuerliche Effekte.
        </p>
        <div className="relative mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Button
            asChild
            className="h-12 rounded-xl bg-white px-6 text-base text-[#173f35] hover:bg-emerald-50"
          >
            <Link href="/registrieren">
              Kostenlos starten
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            className="h-12 rounded-xl border-white/20 bg-white/5 px-6 text-base text-white hover:bg-white/10 hover:text-white"
          >
            <Link href="/demo">Demo ansehen</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
