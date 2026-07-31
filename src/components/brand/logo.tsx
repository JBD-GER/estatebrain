import Link from "next/link";
import { Building2, BrainCircuit } from "lucide-react";
import { cn } from "@/lib/utils";

export function BrandLogo({
  href = "/",
  compact = false,
  inverted = false,
  className,
}: {
  href?: string;
  compact?: boolean;
  inverted?: boolean;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group inline-flex items-center gap-2.5 font-semibold tracking-tight",
        inverted ? "text-sidebar-foreground" : "text-foreground",
        className,
      )}
      aria-label="Estate Brain – Startseite"
    >
      <span
        className={cn(
          "relative grid size-9 place-items-center rounded-xl shadow-sm",
          inverted
            ? "bg-sidebar-primary text-sidebar-primary-foreground"
            : "bg-primary text-primary-foreground",
        )}
      >
        <Building2 className="size-5" aria-hidden="true" />
        <BrainCircuit
          className="absolute -bottom-1 -right-1 size-4 rounded-full bg-card p-0.5 text-primary shadow-sm"
          aria-hidden="true"
        />
      </span>
      {compact ? null : (
        <span className="text-lg">
          Estate <span className="text-primary">Brain</span>
        </span>
      )}
    </Link>
  );
}
