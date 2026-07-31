import Link from "next/link";
import { ArrowLeft, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/brand/logo";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <BrandLogo />
      <div className="mt-14 grid size-14 place-items-center rounded-2xl bg-muted text-muted-foreground">
        <SearchX className="size-7" />
      </div>
      <p className="mt-6 text-sm font-medium text-primary">Fehler 404</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">
        Diese Seite gibt es nicht
      </h1>
      <p className="mt-3 max-w-md text-muted-foreground">
        Der Link ist möglicherweise veraltet oder die Seite wurde verschoben.
      </p>
      <Button asChild className="mt-7">
        <Link href="/">
          <ArrowLeft />
          Zur Startseite
        </Link>
      </Button>
    </main>
  );
}
