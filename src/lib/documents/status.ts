import type { Database } from "@/types/database";

export type DocumentReviewStatus =
  Database["public"]["Enums"]["document_review_status"];

export const DOCUMENT_STATUSES_REQUIRING_ATTENTION = [
  "missing",
  "unreadable",
  "unclear_assignment",
  "review_required",
] as const satisfies readonly DocumentReviewStatus[];

const statusesRequiringAttention = new Set<string>(
  DOCUMENT_STATUSES_REQUIRING_ATTENTION,
);

export function documentStatusRequiresAttention(
  status: unknown,
): status is (typeof DOCUMENT_STATUSES_REQUIRING_ATTENTION)[number] {
  return (
    typeof status === "string" && statusesRequiringAttention.has(status)
  );
}
