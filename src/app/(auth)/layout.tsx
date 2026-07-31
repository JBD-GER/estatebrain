import { ShieldCheck } from "lucide-react";
import { BrandLogo } from "@/components/brand/logo";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_minmax(480px,0.82fr)]">
      <section className="relative hidden overflow-hidden bg-sidebar px-12 py-10 text-sidebar-foreground lg:flex lg:flex-col">
        <div className="surface-grid absolute inset-0 opacity-[0.06]" />
        <div className="relative z-10">
          <BrandLogo inverted />
        </div>
        <div className="relative z-10 my-auto max-w-xl">
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-sidebar-border bg-sidebar-accent/50 px-3 py-1 text-sm text-sidebar-foreground/80">
            <ShieldCheck className="size-4 text-sidebar-primary" />
            Deine Daten bleiben deiner Organisation zugeordnet
          </p>
          <h1 className="text-balance text-5xl font-semibold tracking-tight">
            Finanzielle Klarheit für dein Immobilienportfolio.
          </h1>
          <p className="mt-6 max-w-lg text-lg leading-8 text-sidebar-foreground/70">
            Verwalte Mieten, Ausgaben, Belege, Finanzierungen und
            unverbindliche Steuerannahmen in einem nachvollziehbaren System.
          </p>
        </div>
        <p className="relative z-10 text-sm text-sidebar-foreground/55">
          Estate Brain ersetzt keine Steuer- oder Rechtsberatung.
        </p>
      </section>
      <section className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <div className="mb-10 lg:hidden">
            <BrandLogo />
          </div>
          {children}
        </div>
      </section>
    </main>
  );
}
