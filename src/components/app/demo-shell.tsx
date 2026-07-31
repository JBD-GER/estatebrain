import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { BrandLogo } from "@/components/brand/logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function DemoShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-muted/35">
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex h-18 max-w-[1600px] items-center gap-3 px-4 sm:px-6">
          <BrandLogo href="/" />
          <Badge className="hidden sm:inline-flex" variant="secondary">
            Öffentliche Demo
          </Badge>
          <div className="flex-1" />
          <Button asChild className="hidden sm:inline-flex" variant="ghost">
            <Link href="/">
              <ArrowLeft />
              Zur Startseite
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/login">Anmelden</Link>
          </Button>
          <Button asChild>
            <Link href="/registrieren">Kostenlos starten</Link>
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-[1600px] p-4 sm:p-6 xl:p-8">
        {children}
      </main>
    </div>
  );
}
