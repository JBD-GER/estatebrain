import { Badge } from "@/components/ui/badge";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  demo = false,
  headingLevel = 1,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  demo?: boolean;
  headingLevel?: 1 | 2;
}) {
  const Heading = headingLevel === 2 ? "h2" : "h1";
  return (
    <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          {eyebrow ? (
            <p className="text-sm font-medium text-primary">{eyebrow}</p>
          ) : null}
          {demo ? <Badge variant="secondary">Demo</Badge> : null}
        </div>
        <Heading className="mt-1 text-balance text-2xl font-semibold tracking-tight sm:text-3xl">
          {title}
        </Heading>
        {description ? (
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>
      ) : null}
    </header>
  );
}
