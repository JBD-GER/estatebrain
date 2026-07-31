import Link from "next/link";
import { AlertTriangle, ArrowLeft } from "lucide-react";

import { MarketingFooter } from "@/components/marketing/footer";
import { MarketingHeader } from "@/components/marketing/header";

export type LegalSection = {
  heading: string;
  paragraphs?: string[];
  items?: string[];
};

type LegalPageProps = {
  eyebrow: string;
  title: string;
  intro: string;
  sections: LegalSection[];
  updatedLabel?: string;
};

export function LegalPage({
  eyebrow,
  title,
  intro,
  sections,
  updatedLabel = "Stand der Vorlage: Juli 2026",
}: LegalPageProps) {
  return (
    <div lang="de" className="min-h-screen bg-[#fbfdfc] text-[#102a2a]">
      <a
        href="#hauptinhalt"
        className="fixed left-4 top-3 z-[60] -translate-y-20 rounded-lg bg-[#12352f] px-4 py-2 text-sm font-medium text-white transition-transform focus:translate-y-0"
      >
        Zum Inhalt springen
      </a>
      <MarketingHeader />
      <main id="hauptinhalt" tabIndex={-1} className="outline-none">
        <section className="border-b border-[#dce7e3] bg-[linear-gradient(135deg,#f1f8f5_0%,#fbfdfc_58%,#f5f7f2_100%)]">
          <div className="mx-auto w-full max-w-4xl px-5 py-16 sm:px-8 sm:py-20 lg:px-10">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-lg text-sm font-medium text-emerald-800 hover:text-emerald-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
            >
              <ArrowLeft aria-hidden="true" className="size-4" />
              Zurück zur Startseite
            </Link>
            <p className="mt-10 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
              {eyebrow}
            </p>
            <h1 className="mt-4 text-4xl font-semibold tracking-[-0.045em] text-balance sm:text-5xl">
              {title}
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-[#5a6e69]">
              {intro}
            </p>
            <p className="mt-5 text-sm text-[#7a8c87]">{updatedLabel}</p>
          </div>
        </section>

        <div className="mx-auto grid w-full max-w-4xl gap-8 px-5 py-12 sm:px-8 sm:py-16 lg:px-10">
          <aside
            aria-label="Wichtiger Hinweis zur Vorlage"
            className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-950"
          >
            <div className="flex gap-3">
              <AlertTriangle
                aria-hidden="true"
                className="mt-0.5 size-5 shrink-0 text-amber-700"
              />
              <div>
                <h2 className="font-semibold">Vorbereitete Musterseite</h2>
                <p className="mt-1 text-sm leading-6 text-amber-900/80">
                  Dieser Text ist eine allgemeine Arbeitsvorlage, wurde nicht
                  rechtsgeprüft und ist vor Veröffentlichung mit den
                  tatsächlichen Anbieter-, Prozess- und Kontaktdaten zu
                  vervollständigen. Er ersetzt keine individuelle
                  Rechtsberatung.
                </p>
              </div>
            </div>
          </aside>

          <article className="rounded-[1.5rem] border border-[#dce7e3] bg-white px-5 py-3 shadow-[0_20px_60px_-45px_rgba(18,53,47,0.3)] sm:px-8">
            {sections.map((section) => (
              <section
                key={section.heading}
                className="border-b border-[#e6eeeb] py-7 last:border-0"
              >
                <h2 className="text-xl font-semibold tracking-[-0.02em] text-[#163b35]">
                  {section.heading}
                </h2>
                {section.paragraphs?.map((paragraph) => (
                  <p
                    key={paragraph}
                    className="mt-3 whitespace-pre-line text-[15px] leading-7 text-[#526761]"
                  >
                    {paragraph}
                  </p>
                ))}
                {section.items ? (
                  <ul className="mt-4 space-y-2 pl-5 text-[15px] leading-7 text-[#526761]">
                    {section.items.map((item) => (
                      <li key={item} className="list-disc pl-1 marker:text-emerald-600">
                        {item}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </section>
            ))}
          </article>
        </div>
      </main>
      <MarketingFooter />
    </div>
  );
}
