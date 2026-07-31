import Link from "next/link";
import { Building2 } from "lucide-react";

type BrandProps = {
  inverted?: boolean;
};

export function Brand({ inverted = false }: BrandProps) {
  return (
    <Link
      href="/"
      aria-label="Estate Brain – zur Startseite"
      className="group inline-flex items-center gap-2.5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-4"
    >
      <span
        className={[
          "grid size-9 place-items-center rounded-xl transition-transform duration-300 group-hover:-translate-y-0.5",
          inverted
            ? "bg-white text-[#12352f]"
            : "bg-[#12352f] text-white shadow-sm shadow-emerald-950/10",
        ].join(" ")}
      >
        <Building2 aria-hidden="true" className="size-[18px]" strokeWidth={1.8} />
      </span>
      <span
        className={[
          "text-[17px] font-semibold tracking-[-0.025em]",
          inverted ? "text-white" : "text-[#102a2a]",
        ].join(" ")}
      >
        Estate Brain
      </span>
    </Link>
  );
}
