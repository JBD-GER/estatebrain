import { documentStatusRequiresAttention } from "@/lib/documents/status";

const generalAttentionStatuses = new Set(["open", "urgent", "overdue"]);

export function moduleRowRequiresAttention(
  row: Record<string, unknown>,
): boolean {
  if (
    documentStatusRequiresAttention(row.document_status) ||
    documentStatusRequiresAttention(row.review_status)
  ) {
    return true;
  }

  return [row.status, row.payment_status, row.priority].some(
    (status) =>
      typeof status === "string" && generalAttentionStatuses.has(status),
  );
}
