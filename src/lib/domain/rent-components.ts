/** Cashflow allocation only; the contractual claim and booked payment stay gross. */
export function allocateAncillaryPayments<T extends { rentClaimId: string | null; amountCents: number; paidOn: string }>(
  claims: readonly { id: string; amountCents: number; paidCents: number; ancillaryCents?: number }[],
  payments: readonly T[],
): Map<T, number> {
  const claimById = new Map(claims.map(claim => [claim.id, claim]));
  const loadedTotals = new Map<string, number>();
  for (const payment of payments) {
    if (payment.rentClaimId) loadedTotals.set(payment.rentClaimId, (loadedTotals.get(payment.rentClaimId) ?? 0) + payment.amountCents);
  }
  // Include earlier payments outside the loaded reporting window when capping overpayments.
  const cumulative = new Map(claims.map(claim => [claim.id, Math.max(0, claim.paidCents - (loadedTotals.get(claim.id) ?? 0))]));
  const result = new Map<T, number>();
  for (const payment of [...payments].sort((a, b) => a.paidOn.localeCompare(b.paidOn))) {
    const claim = payment.rentClaimId ? claimById.get(payment.rentClaimId) : undefined;
    if (!claim || claim.amountCents <= 0) { result.set(payment, 0); continue; }
    const ancillary = Math.min(claim.amountCents, Math.max(0, claim.ancillaryCents ?? 0));
    const previous = cumulative.get(claim.id) ?? 0;
    const next = previous + payment.amountCents;
    // Rounded cumulative differences sum exactly, including installments across months.
    const allocated = (paid: number) => Math.round(Math.min(claim.amountCents, Math.max(0, paid)) / claim.amountCents * ancillary);
    result.set(payment, allocated(next) - allocated(previous));
    cumulative.set(claim.id, next);
  }
  return result;
}
