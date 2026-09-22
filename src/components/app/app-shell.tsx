"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Banknote,
  BarChart3,
  Building2,
  Calculator,
  ChartNoAxesCombined,
  CheckSquare2,
  ChevronDown,
  CircleDollarSign,
  ClipboardCheck,
  FileArchive,
  FileText,
  Landmark,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquareText,
  PanelTop,
  Plug,
  Settings,
  ShieldCheck,
  Sparkles,
  Users,
  Wrench,
} from "lucide-react";
import { BrandLogo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { Viewer } from "@/lib/auth/dal";
import { canAccessModule, type OrganizationRole } from "@/lib/auth/permissions";
import { signOutAction, switchOrganizationAction } from "@/app/(auth)/actions";
import { GlobalSearch } from "@/components/app/global-search";

type Icon = React.ComponentType<{ className?: string }>;

type NavItem = {
  label: string;
  href: string;
  icon: Icon;
  module?: string;
};

const navGroups: Array<{ label: string; items: NavItem[] }> = [
  {
    label: "Arbeitsbereich",
    items: [
      { label: "Dashboard", href: "/app", icon: LayoutDashboard },
      { label: "Portfolio-Übersicht", href: "/app/uebersicht", icon: ChartNoAxesCombined, module: "portfolio" },
    ],
  },
  {
    label: "Portfolio",
    items: [
      {
        label: "Portfolio",
        href: "/app/portfolio",
        icon: PanelTop,
        module: "portfolio",
      },
      {
        label: "Immobilien",
        href: "/app/immobilien",
        icon: Building2,
        module: "immobilien",
      },
      {
        label: "Einheiten",
        href: "/app/einheiten",
        icon: PanelTop,
        module: "einheiten",
      },
      {
        label: "Mietverhältnisse",
        href: "/app/mietverhaeltnisse",
        icon: Users,
        module: "mietverhaeltnisse",
      },
    ],
  },
  {
    label: "Finanzen",
    items: [
      {
        label: "Cashflow",
        href: "/app/cashflow",
        icon: BarChart3,
        module: "cashflow",
      },
      {
        label: "Einnahmen",
        href: "/app/einnahmen",
        icon: CircleDollarSign,
        module: "einnahmen",
      },
      {
        label: "Rechnungen & Belege",
        href: "/app/belege",
        icon: FileArchive,
        module: "belege",
      },
      {
        label: "Bank & Zahlungen",
        href: "/app/bank",
        icon: Landmark,
        module: "bank",
      },
      {
        label: "Finanzierungen",
        href: "/app/finanzierungen",
        icon: Banknote,
        module: "finanzierungen",
      },
      {
        label: "Steuerübersicht",
        href: "/app/steuern",
        icon: Calculator,
        module: "steuern",
      },
    ],
  },
  {
    label: "Planung",
    items: [
      {
        label: "Sanierungen",
        href: "/app/sanierungen",
        icon: Wrench,
        module: "sanierungen",
      },
      {
        label: "Markt & Bewertung",
        href: "/app/markt",
        icon: ChartNoAxesCombined,
        module: "markt",
      },
      {
        label: "Potenziale",
        href: "/app/potenziale",
        icon: Sparkles,
        module: "potenziale",
      },
      {
        label: "Daten prüfen",
        href: "/app/daten-pruefen",
        icon: ClipboardCheck,
        module: "daten-pruefen",
      },
    ],
  },
  {
    label: "Zusammenarbeit",
    items: [
      {
        label: "Kommunikation",
        href: "/app/kommunikation",
        icon: MessageSquareText,
        module: "kommunikation",
      },
      {
        label: "Aufgaben",
        href: "/app/aufgaben",
        icon: CheckSquare2,
        module: "aufgaben",
      },
      {
        label: "Berichte & Exporte",
        href: "/app/berichte",
        icon: FileText,
        module: "berichte",
      },
      {
        label: "Team",
        href: "/app/team",
        icon: Users,
        module: "team",
      },
      {
        label: "Integrationen",
        href: "/app/integrationen",
        icon: Plug,
        module: "integrationen",
      },
      {
        label: "Einstellungen",
        href: "/app/einstellungen",
        icon: Settings,
        module: "einstellungen",
      },
    ],
  },
];

const roleLabels: Record<string, string> = {
  owner: "Eigentümer",
  admin: "Administrator",
  property_manager: "Immobilienmanager",
  accounting: "Buchhaltung",
  employee: "Mitarbeiter",
  tenant: "Mieter",
};

function Navigation({
  role,
  onNavigate,
}: {
  role: OrganizationRole | null;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const visibleGroups = navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) =>
          !item.module || (role ? canAccessModule(role, item.module) : false),
      ),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <nav aria-label="Hauptnavigation" className="space-y-5 px-3 py-5">
      {visibleGroups.map((group) => (
        <div key={group.label}>
          <p className="mb-2 px-3 text-[9px] font-medium uppercase tracking-[0.18em] text-sidebar-foreground/50">
            {group.label}
          </p>
          <div className="space-y-1">
            {group.items.map((item) => {
              const active =
                item.href === "/app"
                  ? pathname === "/app"
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group flex min-h-10 items-center gap-3 rounded-lg px-3 text-[13px] transition-colors",
                    active
                      ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  )}
                >
                  <item.icon className="size-4 shrink-0" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

function Sidebar({ role }: { role: OrganizationRole | null }) {
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:flex lg:flex-col">
      <div className="flex h-20 items-center px-6">
        <BrandLogo href="/app" inverted />
      </div>
      <Separator className="bg-sidebar-border" />
      <ScrollArea className="min-h-0 flex-1">
        <Navigation role={role} />
      </ScrollArea>
      <div className="border-t border-sidebar-border p-4">
        <div className="rounded-xl bg-sidebar-accent/65 p-3">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-sidebar-primary" />
            <div>
              <p className="text-xs font-medium">Dein Arbeitsbereich</p>
              <p className="mt-1 text-[11px] leading-4 text-sidebar-foreground/55">
                Immobilien, Steuern und Unterlagen an einem Ort.
              </p>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

function initials(name: string | null, email: string | null) {
  const source = name?.trim() || email?.trim() || "EB";
  return source
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function OrganizationSwitcher({ viewer }: { viewer: Viewer }) {
  if (viewer.memberships.length <= 1) {
    return (
      <div className="hidden min-w-0 sm:block">
        <p className="truncate text-sm font-medium">
          {viewer.organizationName ?? "Estate Brain"}
        </p>
        <p className="text-xs text-muted-foreground">
          {viewer.role ? roleLabels[viewer.role] : "Organisation"}
        </p>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="hidden h-auto gap-2 px-2 sm:flex">
          <span className="text-left">
            <span className="block max-w-44 truncate text-sm font-medium">
              {viewer.organizationName}
            </span>
            <span className="block text-xs font-normal text-muted-foreground">
              {viewer.role ? roleLabels[viewer.role] : "Organisation"}
            </span>
          </span>
          <ChevronDown className="size-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Organisation wechseln</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {viewer.memberships.map((membership) => (
          <form
            action={switchOrganizationAction}
            key={membership.organizationId}
          >
            <input
              type="hidden"
              name="organizationId"
              value={membership.organizationId}
            />
            <DropdownMenuItem asChild>
              <button type="submit" className="w-full">
                <span className="flex-1 truncate text-left">
                  {membership.organizationName}
                </span>
                {viewer.organizationId === membership.organizationId ? (
                  <Badge variant="secondary">Aktiv</Badge>
                ) : null}
              </button>
            </DropdownMenuItem>
          </form>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function UserMenu({ viewer }: { viewer: Viewer }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full"
          aria-label="Benutzermenü öffnen"
        >
          <Avatar className="size-9">
            <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">
              {initials(viewer.fullName, viewer.email)}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel>
          <span className="block truncate">
            {viewer.fullName ?? "Mein Konto"}
          </span>
          <span className="block truncate text-xs font-normal text-muted-foreground">
            {viewer.email}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/app/einstellungen">
            <Settings />
            Profil & Einstellungen
          </Link>
        </DropdownMenuItem>
        {viewer.role && canAccessModule(viewer.role, "integrationen") ? (
          <DropdownMenuItem asChild>
            <Link href="/app/integrationen">
              <Plug />
              Integrationen
            </Link>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <form action={signOutAction}>
          <DropdownMenuItem asChild>
            <button type="submit" className="w-full">
              <LogOut />
              Abmelden
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AppShell({
  viewer,
  children,
}: {
  viewer: Viewer;
  children: React.ReactNode;
}) {
  const [navigationOpen, setNavigationOpen] = useState(false);
  return (
    <div className="min-h-screen bg-background">
      <a className="skip-link" href="#app-inhalt">
        Zum Inhalt springen
      </a>
      <Sidebar role={viewer.role} />
      <div className="lg:pl-72">
        <header className="sticky top-0 z-30 flex h-20 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/85 sm:px-6 xl:px-8">
          <Sheet open={navigationOpen} onOpenChange={setNavigationOpen}>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="lg:hidden"
                aria-label="Navigation öffnen"
              >
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="w-80 border-sidebar-border bg-sidebar p-0 text-sidebar-foreground"
            >
              <SheetHeader className="h-20 border-b border-sidebar-border px-6 py-0">
                <SheetTitle className="flex h-full items-center">
                  <BrandLogo href="/app" inverted />
                </SheetTitle>
                <SheetDescription className="sr-only">
                  Navigation durch deinen Immobilien-Arbeitsbereich.
                </SheetDescription>
              </SheetHeader>
              <ScrollArea className="h-[calc(100dvh-5rem)]">
                <Navigation
                  role={viewer.role}
                  onNavigate={() => setNavigationOpen(false)}
                />
              </ScrollArea>
            </SheetContent>
          </Sheet>

          <OrganizationSwitcher viewer={viewer} />
          <div className="flex-1" />
          <GlobalSearch role={viewer.role} />
          <UserMenu viewer={viewer} />
        </header>
        <main
          id="app-inhalt"
          tabIndex={-1}
          className="min-w-0 p-4 outline-none sm:p-6 xl:p-8"
        >
          {children}
        </main>
      </div>
    </div>
  );
}

export function DemoBanner({ persisted = false }: { persisted?: boolean }) {
  return (
    <div className="mb-5 flex flex-col gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm sm:flex-row sm:items-center">
      <Badge className="w-fit">
        {persisted ? "Beispieldaten-Mandant" : "Demo-Modus"}
      </Badge>
      <p className="flex-1 text-muted-foreground">
        {persisted
          ? "Dieser Mandant enthält dauerhaft gespeicherte, frei erfundene Beispieldaten. Nutze sie nicht für reale Entscheidungen oder Exporte."
          : "Diese Daten sind frei erfunden und werden nicht dauerhaft gespeichert."}
      </p>
      <Button asChild size="sm" variant={persisted ? "outline" : "default"}>
        <Link href={persisted ? "/demo" : "/registrieren"}>
          {persisted ? "Getrennte Demo öffnen" : "Eigenes Portfolio anlegen"}
        </Link>
      </Button>
    </div>
  );
}
