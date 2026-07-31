"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";

import { Brand } from "@/components/marketing/brand";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const navigation = [
  { label: "Produkt", href: "/#produkt" },
  { label: "Funktionen", href: "/#funktionen" },
  { label: "Steuerübersicht", href: "/#steueruebersicht" },
  { label: "Cashflow", href: "/#cashflow" },
  { label: "Für wen?", href: "/#fuer-wen" },
  { label: "Sicherheit", href: "/#sicherheit" },
];

export function MarketingHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-[#dce7e3]/80 bg-[#fbfdfc]/90 backdrop-blur-xl">
      <div className="mx-auto flex h-[72px] w-full max-w-7xl items-center justify-between px-5 sm:px-8 lg:px-10">
        <Brand />

        <nav aria-label="Hauptnavigation" className="hidden items-center gap-1 lg:flex">
          {navigation.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="rounded-lg px-3 py-2 text-[13px] font-medium text-[#49615d] transition-colors hover:bg-[#eef5f2] hover:text-[#12352f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <Button
            asChild
            variant="ghost"
            className="h-10 rounded-xl px-4 text-[#24423d] hover:bg-[#eef5f2]"
          >
            <Link href="/login">Login</Link>
          </Button>
          <Button
            asChild
            className="h-10 rounded-xl bg-[#12352f] px-4 text-white shadow-sm hover:bg-[#1b4b43]"
          >
            <Link href="/registrieren">Kostenlos starten</Link>
          </Button>
        </div>

        <Sheet>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon-lg"
              className="rounded-xl text-[#12352f] hover:bg-[#eef5f2] lg:hidden"
              aria-label="Navigation öffnen"
            >
              <Menu aria-hidden="true" className="size-5" />
            </Button>
          </SheetTrigger>
          <SheetContent
            side="right"
            showCloseButton={false}
            className="w-[min(88vw,24rem)] border-[#dce7e3] bg-[#fbfdfc] p-0"
          >
            <SheetHeader className="border-b border-[#dce7e3] px-6 py-5 text-left">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <SheetDescription className="sr-only">
                Navigation zu den Bereichen der Estate-Brain-Website
              </SheetDescription>
              <div className="flex items-center justify-between">
                <Brand />
                <SheetClose asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-xl text-[#12352f]"
                    aria-label="Navigation schließen"
                  >
                    <X aria-hidden="true" className="size-5" />
                  </Button>
                </SheetClose>
              </div>
            </SheetHeader>
            <nav
              aria-label="Mobile Hauptnavigation"
              className="flex flex-col gap-1 px-4 py-6"
            >
              {navigation.map((item) => (
                <SheetClose asChild key={item.label}>
                  <Link
                    href={item.href}
                    className="rounded-xl px-4 py-3 text-base font-medium text-[#294b45] transition-colors hover:bg-[#eef5f2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                  >
                    {item.label}
                  </Link>
                </SheetClose>
              ))}
            </nav>
            <div className="mt-auto grid gap-2 border-t border-[#dce7e3] p-5">
              <SheetClose asChild>
                <Button
                  asChild
                  variant="outline"
                  className="h-11 rounded-xl border-[#cbdcd6] bg-white text-[#12352f]"
                >
                  <Link href="/login">Login</Link>
                </Button>
              </SheetClose>
              <SheetClose asChild>
                <Button
                  asChild
                  className="h-11 rounded-xl bg-[#12352f] text-white hover:bg-[#1b4b43]"
                >
                  <Link href="/registrieren">Kostenlos starten</Link>
                </Button>
              </SheetClose>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
