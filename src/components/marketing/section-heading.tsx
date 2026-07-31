import { cn } from "@/lib/utils";

type SectionHeadingProps = {
  eyebrow: string;
  title: string;
  description?: string;
  align?: "left" | "center";
  inverse?: boolean;
};

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "left",
  inverse = false,
}: SectionHeadingProps) {
  return (
    <div
      className={cn(
        "max-w-2xl",
        align === "center" && "mx-auto text-center",
      )}
    >
      <p
        className={cn(
          "text-xs font-semibold uppercase tracking-[0.16em]",
          inverse ? "text-emerald-200/80" : "text-emerald-700",
        )}
      >
        {eyebrow}
      </p>
      <h2
        className={cn(
          "mt-4 text-3xl font-semibold tracking-[-0.04em] text-balance sm:text-4xl lg:text-[2.65rem] lg:leading-[1.08]",
          inverse ? "text-white" : "text-[#102a2a]",
        )}
      >
        {title}
      </h2>
      {description ? (
        <p
          className={cn(
            "mt-5 text-base leading-7 text-pretty sm:text-lg",
            inverse ? "text-emerald-50/70" : "text-[#5a6e69]",
          )}
        >
          {description}
        </p>
      ) : null}
    </div>
  );
}
