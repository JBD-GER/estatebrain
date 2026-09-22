import Link from "next/link";
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
          "relative grid size-9 place-items-center rounded-[10px]",
          inverted
            ? "bg-sidebar-primary text-sidebar-primary-foreground"
            : "bg-primary text-primary-foreground",
        )}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className="size-[22px]"
          aria-hidden="true"
        >
          <path
            d="M5 19V8l7-4 7 4v11H5Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path
            d="M9 19v-5h6v5M9 9v1.5M15 9v1.5M12 6.5V10"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </span>
      {compact ? null : (
        <span className="text-[18px] tracking-[-0.04em]">
          Estate Brain
          <span
            className={cn(
              "ml-0.5",
              inverted ? "text-sidebar-primary" : "text-[#88a467]",
            )}
          >
            .
          </span>
        </span>
      )}
    </Link>
  );
}
