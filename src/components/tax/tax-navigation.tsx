import Link from "next/link";

export function TaxNavigation({ active }: { active: "overview" | "scenarios" }) {
  return <nav aria-label="Bereiche der Steuerübersicht" className="mb-7 flex flex-wrap gap-2 border-b pb-4 text-sm">
    {([
      { id: "overview", label: "Steuerübersicht & Profil", href: "/app/steuern" },
      { id: "scenarios", label: "Szenarien & Abschreibung", href: "/app/steuern/szenarien" },
    ] as const).map((item) => <Link key={item.id} href={item.href} aria-current={active === item.id ? "page" : undefined}
      className={`rounded-xl px-4 py-2.5 font-medium ${active === item.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"}`}>{item.label}</Link>)}
  </nav>;
}
