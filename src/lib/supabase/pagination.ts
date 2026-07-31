export const POSTGREST_PAGE_SIZE = 1_000;
export const DEFAULT_MAX_ROWS = 50_000;

export type PaginatedQueryError = {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
};

type PageResult<T> = {
  data: T[] | null;
  error: PaginatedQueryError | null;
};

type PageLoader<T> = (
  from: number,
  to: number,
) => PromiseLike<PageResult<T>>;

export async function fetchAllRows<T>(
  loadPage: PageLoader<T>,
  options: {
    pageSize?: number;
    maxRows?: number;
    label?: string;
  } = {},
): Promise<PageResult<T>> {
  const pageSize = options.pageSize ?? POSTGREST_PAGE_SIZE;
  const maxRows = options.maxRows ?? DEFAULT_MAX_ROWS;
  const label = options.label ?? "Datensätze";

  if (
    !Number.isSafeInteger(pageSize) ||
    pageSize < 1 ||
    !Number.isSafeInteger(maxRows) ||
    maxRows < pageSize
  ) {
    throw new RangeError(
      "Pagination benötigt positive Ganzzahlen und maxRows >= pageSize.",
    );
  }

  const rows: T[] = [];

  while (rows.length < maxRows) {
    const from = rows.length;
    const remaining = maxRows - from;
    const requestedRows = Math.min(pageSize, remaining);
    const result = await loadPage(from, from + requestedRows - 1);

    if (result.error) {
      return { data: null, error: result.error };
    }

    const page = result.data ?? [];
    rows.push(...page);

    if (page.length < requestedRows) {
      return { data: rows, error: null };
    }
  }

  const probe = await loadPage(maxRows, maxRows);
  if (probe.error) {
    return { data: null, error: probe.error };
  }
  if ((probe.data ?? []).length === 0) {
    return { data: rows, error: null };
  }

  return {
    data: null,
    error: {
      code: "ESTATE_BRAIN_RESULT_TOO_LARGE",
      message: `${label} überschreiten das sichere Exportlimit von ${maxRows.toLocaleString(
        "de-DE",
      )} Zeilen.`,
      details:
        "Die Abfrage wurde vollständig abgebrochen, damit keine still gekürzte Auswertung entsteht.",
      hint: "Zeitraum oder Objektfilter weiter einschränken.",
    },
  };
}
