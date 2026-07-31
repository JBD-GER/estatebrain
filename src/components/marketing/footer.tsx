import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { Brand } from "@/components/marketing/brand";

const productLinks = [
  { label: "Produkt", href: "/#produkt" },
  { label: "Funktionen", href: "/#funktionen" },
  { label: "Steuerübersicht", href: "/#steueruebersicht" },
  { label: "Cashflow", href: "/#cashflow" },
  { label: "Sicherheit", href: "/#sicherheit" },
];

const accessLinks = [
  { label: "Kostenlos starten", href: "/registrieren" },
  { label: "Login", href: "/login" },
  { label: "Demo ansehen", href: "/demo" },
];

const legalLinks = [
  { label: "Impressum", href: "/impressum" },
  { label: "Datenschutz", href: "/datenschutz" },
  { label: "Nutzungsbedingungen", href: "/nutzungsbedingungen" },
];

export function MarketingFooter() {
  return (
    <footer className="bg-[#0d2b27] text-white">
      <div className="mx-auto grid w-full max-w-7xl gap-12 px-5 py-14 sm:px-8 md:grid-cols-[1.3fr_2fr] lg:px-10 lg:py-16">
        <div className="max-w-sm">
          <Brand inverted />
          <p className="mt-5 text-sm leading-6 text-emerald-50/70">
            Finanzielle Klarheit für private Immobilieninvestoren – von der
            einzelnen Buchung bis zum gesamten Portfolio.
          </p>
          <p className="mt-5 text-xs leading-5 text-emerald-50/50">
            Keine Steuer- oder Rechtsberatung. Steuerliche Darstellungen sind
            unverbindliche Schätzungen auf Basis der hinterlegten Annahmen.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
          <FooterColumn title="Entdecken" links={productLinks} />
          <FooterColumn title="Zugang" links={accessLinks} />
          <FooterColumn title="Rechtliches" links={legalLinks} />
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 px-5 py-5 text-xs text-emerald-50/50 sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-10">
          <p>© Estate Brain. Alle Rechte vorbehalten.</p>
          <p>Für eine ruhige, fundierte Sicht auf Immobilienzahlen.</p>
        </div>
      </div>
    </footer>
  );
}

type FooterColumnProps = {
  title: string;
  links: Array<{ label: string; href: string }>;
};

function FooterColumn({ title, links }: FooterColumnProps) {
  return (
    <div>
      <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-100/60">
        {title}
      </h2>
      <ul className="mt-4 space-y-3">
        {links.map((link) => (
          <li key={link.label}>
            <Link
              href={link.href}
              className="group inline-flex items-center gap-1.5 rounded-sm text-sm text-white/80 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
            >
              {link.label}
              {link.href === "/demo" ? (
                <ArrowUpRight
                  aria-hidden="true"
                  className="size-3.5 opacity-50 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                />
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
