"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  FileText,
  Loader2,
  MessageSquareText,
  Search,
  Users,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import {
  canAccessModule,
  type OrganizationRole,
} from "@/lib/auth/permissions";

type SearchResult = {
  id: string;
  type: string;
  title: string;
  subtitle: string;
  href: string;
  module?: string;
};

const quickLinks: SearchResult[] = [
  {
    id: "quick-tax-comparison",
    type: "Schnellzugriff",
    title: "Immobilien steuerlich vergleichen",
    subtitle: "AfA, Denkmal und jährliche Steuerwirkung",
    href: "/app",
    module: "steuern",
  },
  {
    id: "quick-property",
    type: "Schnellzugriff",
    title: "Immobilien öffnen",
    subtitle: "Portfolio und Stammdaten",
    href: "/app/immobilien",
    module: "immobilien",
  },
  {
    id: "quick-document",
    type: "Schnellzugriff",
    title: "Beleg hochladen",
    subtitle: "Rechnungen und Dokumente",
    href: "/app/belege",
    module: "belege",
  },
  {
    id: "quick-task",
    type: "Schnellzugriff",
    title: "Aufgaben öffnen",
    subtitle: "Heute, überfällig und zugewiesen",
    href: "/app/aufgaben",
    module: "aufgaben",
  },
];

const iconByType: Record<string, React.ComponentType<{ className?: string }>> = {
  Immobilie: Building2,
  Einheit: Building2,
  Mieter: Users,
  Dokument: FileText,
  Aufgabe: Wrench,
  Nachricht: MessageSquareText,
  Schnellzugriff: Search,
};

export function GlobalSearch({
  role,
}: {
  role: OrganizationRole | null;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (query.trim().length < 2) {
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(
          `/api/search?q=${encodeURIComponent(query.trim())}`,
          { signal: controller.signal },
        );
        if (response.ok) {
          const payload = (await response.json()) as {
            results?: SearchResult[];
          };
          setResults(payload.results ?? []);
        }
      } catch (error) {
        if ((error as Error).name !== "AbortError") setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [query]);

  const visibleResults = useMemo(
    () => (query.trim().length >= 2 ? results : []),
    [query, results],
  );
  const isLoading = query.trim().length >= 2 && loading;
  const visibleQuickLinks = useMemo(
    () =>
      quickLinks.filter(
        (result) =>
          !result.module ||
          (role ? canAccessModule(role, result.module) : false),
      ),
    [role],
  );
  const groupedResults = useMemo(() => {
    return visibleResults.reduce<Record<string, SearchResult[]>>((groups, result) => {
      (groups[result.type] ??= []).push(result);
      return groups;
    }, {});
  }, [visibleResults]);

  function navigate(href: string) {
    setOpen(false);
    setQuery("");
    router.push(href);
  }

  return (
    <>
      <Button
        variant="outline"
        className="h-9 w-9 px-0 sm:w-56 sm:justify-start sm:px-3 sm:text-muted-foreground"
        onClick={() => setOpen(true)}
        aria-label="Globale Suche öffnen"
      >
        <Search className="size-4" />
        <span className="hidden sm:inline">Suchen …</span>
        <span className="ml-auto hidden rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] sm:inline">
          ⌘K
        </span>
      </Button>
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Estate Brain durchsuchen"
        description="Suche nach Immobilien, Einheiten, Mietern, Belegen, Aufgaben und Nachrichten."
      >
        <CommandInput
          placeholder="Immobilie, Einheit, Mieter oder Dokument …"
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Suche läuft …
            </div>
          ) : null}
          {!isLoading && query.length >= 2 && visibleResults.length === 0 ? (
            <CommandEmpty>Keine passenden Ergebnisse gefunden.</CommandEmpty>
          ) : null}
          {query.length < 2 ? (
            <CommandGroup heading="Schnellzugriff">
              {visibleQuickLinks.map((result, index) => {
                const Icon = iconByType[result.type] ?? Search;
                return (
                  <CommandItem
                    key={result.id}
                    value={`${result.title} ${result.subtitle}`}
                    onSelect={() => navigate(result.href)}
                  >
                    <Icon />
                    <span>
                      <span className="block">{result.title}</span>
                      <span className="text-xs text-muted-foreground">
                        {result.subtitle}
                      </span>
                    </span>
                    <CommandShortcut>⌘{index + 1}</CommandShortcut>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          ) : null}
          {Object.entries(groupedResults).map(([type, items], groupIndex) => (
            <div key={type}>
              {groupIndex > 0 ? <CommandSeparator /> : null}
              <CommandGroup heading={type}>
                {items.map((result) => {
                  const Icon = iconByType[type] ?? Search;
                  return (
                    <CommandItem
                      key={`${type}-${result.id}`}
                      value={`${result.title} ${result.subtitle}`}
                      onSelect={() => navigate(result.href)}
                    >
                      <Icon />
                      <span>
                        <span className="block">{result.title}</span>
                        <span className="text-xs text-muted-foreground">
                          {result.subtitle}
                        </span>
                      </span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </div>
          ))}
        </CommandList>
      </CommandDialog>
    </>
  );
}
