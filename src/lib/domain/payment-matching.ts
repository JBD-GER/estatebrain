import {
  assertMoneyCents,
  clamp,
  DomainValidationError,
  roundHalfAwayFromZero,
} from "./money";
import type { IsoDate, MoneyCents } from "./types";

export const PAYMENT_MATCH_THRESHOLDS = {
  automatic: 85,
  review: 55,
  ambiguityMargin: 5,
} as const;

export interface IncomingPaymentForMatching {
  id: string;
  amountCents: MoneyCents;
  bookingDate: IsoDate;
  senderName?: string;
  senderIban?: string;
  reference?: string;
}

export interface LeasePaymentCandidate {
  leaseId: string;
  propertyId: string;
  unitId: string;
  propertyLabel: string;
  unitLabel: string;
  expectedAmountCents: MoneyCents;
  outstandingAmountCents?: MoneyCents;
  dueDate: IsoDate;
  tenantName: string;
  tenantIban?: string;
  paymentReference?: string;
  eligible?: boolean;
}

export type PaymentMatchReasonCode =
  | "amount"
  | "iban"
  | "sender_name"
  | "reference"
  | "booking_date"
  | "ineligible"
  | "ambiguous";

export interface PaymentMatchReason {
  code: PaymentMatchReasonCode;
  points: number;
  maxPoints: number;
  matched: boolean;
  strength: "strong" | "supporting" | "none" | "negative";
  explanation: string;
}

export interface PaymentMatchScore {
  paymentId: string;
  leaseId: string;
  propertyId: string;
  unitId: string;
  displayLabel: string;
  score: number;
  confidence: "high" | "medium" | "low";
  decision: "automatic" | "review" | "no_match";
  amountClassification:
    | "exact"
    | "near"
    | "partial"
    | "overpayment"
    | "mismatch";
  reasons: PaymentMatchReason[];
}

export interface PaymentMatchResult {
  paymentId: string;
  threshold: typeof PAYMENT_MATCH_THRESHOLDS;
  bestMatch: PaymentMatchScore | null;
  alternatives: PaymentMatchScore[];
  explanation: string;
}

/**
 * Scores one payment/candidate pair from 0 to 100:
 * amount 40, IBAN 25, sender 15, reference 15, booking date 5.
 *
 * Automatic matching additionally requires exact amount and either exact IBAN
 * or a strong reference match. Thus amount/date alone can never auto-assign.
 */
export function scorePaymentCandidate(
  payment: IncomingPaymentForMatching,
  candidate: LeasePaymentCandidate,
): PaymentMatchScore {
  assertPaymentAndCandidate(payment, candidate);
  const displayLabel = `${candidate.propertyLabel} – ${candidate.unitLabel}`;

  if (candidate.eligible === false) {
    return {
      paymentId: payment.id,
      leaseId: candidate.leaseId,
      propertyId: candidate.propertyId,
      unitId: candidate.unitId,
      displayLabel,
      score: 0,
      confidence: "low",
      decision: "no_match",
      amountClassification: "mismatch",
      reasons: [
        {
          code: "ineligible",
          points: 0,
          maxPoints: 100,
          matched: false,
          strength: "negative",
          explanation:
            "Das Mietverhältnis ist für diesen Abgleich nicht freigegeben.",
        },
      ],
    };
  }

  const amountReason = scoreAmount(payment, candidate);
  const ibanReason = scoreIban(payment.senderIban, candidate.tenantIban);
  const nameReason = scoreName(payment.senderName, candidate.tenantName);
  const referenceReason = scoreReference(payment.reference, candidate);
  const dateReason = scoreBookingDate(
    payment.bookingDate,
    candidate.dueDate,
  );
  const reasons = [
    amountReason.reason,
    ibanReason,
    nameReason,
    referenceReason,
    dateReason,
  ];
  const score = clamp(
    reasons.reduce((total, reason) => total + reason.points, 0),
    0,
    100,
  );

  const automaticEvidence =
    amountReason.classification === "exact" &&
    (ibanReason.points === ibanReason.maxPoints ||
      referenceReason.points >= 12);
  const decision =
    score >= PAYMENT_MATCH_THRESHOLDS.automatic && automaticEvidence
      ? "automatic"
      : score >= PAYMENT_MATCH_THRESHOLDS.review
        ? "review"
        : "no_match";

  return {
    paymentId: payment.id,
    leaseId: candidate.leaseId,
    propertyId: candidate.propertyId,
    unitId: candidate.unitId,
    displayLabel,
    score,
    confidence:
      decision === "automatic"
        ? "high"
        : decision === "review"
          ? "medium"
          : "low",
    decision,
    amountClassification: amountReason.classification,
    reasons,
  };
}

/**
 * Ranks all candidates deterministically. If the two best scores are within
 * five points, an otherwise automatic result is downgraded to manual review.
 */
export function matchPayment(
  payment: IncomingPaymentForMatching,
  candidates: readonly LeasePaymentCandidate[],
): PaymentMatchResult {
  const ranked = candidates
    .map((candidate) => scorePaymentCandidate(payment, candidate))
    .sort(
      (left, right) =>
        right.score - left.score || left.leaseId.localeCompare(right.leaseId),
    );

  let bestMatch = ranked[0] ?? null;
  const runnerUp = ranked[1];
  if (
    bestMatch?.decision === "automatic" &&
    runnerUp &&
    bestMatch.score - runnerUp.score <=
      PAYMENT_MATCH_THRESHOLDS.ambiguityMargin
  ) {
    bestMatch = {
      ...bestMatch,
      confidence: "medium",
      decision: "review",
      reasons: [
        ...bestMatch.reasons,
        {
          code: "ambiguous",
          points: 0,
          maxPoints: 0,
          matched: false,
          strength: "negative",
          explanation: `Ein zweiter Kandidat liegt nur ${bestMatch.score - runnerUp.score} Punkte zurück; deshalb ist eine Bestätigung erforderlich.`,
        },
      ],
    };
    ranked[0] = bestMatch;
  }

  return {
    paymentId: payment.id,
    threshold: PAYMENT_MATCH_THRESHOLDS,
    bestMatch,
    alternatives: ranked.slice(1),
    explanation:
      bestMatch === null
        ? "Es wurden keine Mietverhältnisse zum Abgleich übergeben."
        : bestMatch.decision === "automatic"
          ? `Hohe Sicherheit (${bestMatch.score}/100): Betrag und ein starkes Identitätsmerkmal stimmen überein.`
          : bestMatch.decision === "review"
            ? `Vorschlag zur Prüfung (${bestMatch.score}/100): Die Indizien reichen nicht für eine sichere automatische Zuordnung.`
            : `Keine belastbare Zuordnung (${bestMatch.score}/100).`,
  };
}

function scoreAmount(
  payment: IncomingPaymentForMatching,
  candidate: LeasePaymentCandidate,
): {
  classification: PaymentMatchScore["amountClassification"];
  reason: PaymentMatchReason;
} {
  const comparisonAmount =
    candidate.outstandingAmountCents ?? candidate.expectedAmountCents;
  const difference = payment.amountCents - comparisonAmount;
  const absoluteDifference = Math.abs(difference);
  const relativeDifference =
    comparisonAmount === 0 ? Number.POSITIVE_INFINITY : absoluteDifference / comparisonAmount;

  if (absoluteDifference === 0) {
    return {
      classification: "exact",
      reason: {
        code: "amount",
        points: 40,
        maxPoints: 40,
        matched: true,
        strength: "strong",
        explanation: "Betrag stimmt centgenau mit der offenen Sollmiete überein.",
      },
    };
  }
  if (relativeDifference <= 0.01) {
    return {
      classification: "near",
      reason: {
        code: "amount",
        points: 30,
        maxPoints: 40,
        matched: true,
        strength: "supporting",
        explanation:
          "Betrag weicht höchstens 1 % von der offenen Sollmiete ab.",
      },
    };
  }
  if (difference < 0 && payment.amountCents >= comparisonAmount * 0.25) {
    return {
      classification: "partial",
      reason: {
        code: "amount",
        points: 22,
        maxPoints: 40,
        matched: true,
        strength: "supporting",
        explanation: "Betrag ist als plausible Teilzahlung erkennbar.",
      },
    };
  }
  if (difference > 0 && relativeDifference <= 0.1) {
    return {
      classification: "overpayment",
      reason: {
        code: "amount",
        points: 18,
        maxPoints: 40,
        matched: true,
        strength: "supporting",
        explanation:
          "Betrag liegt bis zu 10 % über der offenen Sollmiete und könnte eine Überzahlung enthalten.",
      },
    };
  }
  return {
    classification: "mismatch",
    reason: {
      code: "amount",
      points: 0,
      maxPoints: 40,
      matched: false,
      strength: "none",
      explanation: "Betrag passt nicht zur offenen Sollmiete.",
    },
  };
}

function scoreIban(
  paymentIban: string | undefined,
  tenantIban: string | undefined,
): PaymentMatchReason {
  const normalizedPaymentIban = normalizeIban(paymentIban);
  const normalizedTenantIban = normalizeIban(tenantIban);
  const available =
    normalizedPaymentIban.length > 0 && normalizedTenantIban.length > 0;
  const matches =
    available && normalizedPaymentIban === normalizedTenantIban;
  return {
    code: "iban",
    points: matches ? 25 : 0,
    maxPoints: 25,
    matched: matches,
    strength: matches ? "strong" : available ? "negative" : "none",
    explanation: matches
      ? "Absender-IBAN stimmt mit der hinterlegten IBAN überein."
      : available
        ? "Absender-IBAN stimmt nicht mit der hinterlegten IBAN überein."
        : "IBAN-Vergleich nicht möglich, weil mindestens eine IBAN fehlt.",
  };
}

function scoreName(
  senderName: string | undefined,
  tenantName: string,
): PaymentMatchReason {
  const sender = normalizeText(senderName);
  const tenant = normalizeText(tenantName);
  if (!sender || !tenant) {
    return {
      code: "sender_name",
      points: 0,
      maxPoints: 15,
      matched: false,
      strength: "none",
      explanation: "Namensvergleich nicht möglich.",
    };
  }
  if (sender === tenant) {
    return {
      code: "sender_name",
      points: 15,
      maxPoints: 15,
      matched: true,
      strength: "strong",
      explanation: "Absendername stimmt normalisiert vollständig überein.",
    };
  }

  const similarity = Math.max(
    tokenSimilarity(sender, tenant),
    levenshteinSimilarity(sender, tenant),
  );
  const points = similarity >= 0.85 ? 12 : similarity >= 0.65 ? 8 : 0;
  return {
    code: "sender_name",
    points,
    maxPoints: 15,
    matched: points > 0,
    strength: points >= 12 ? "strong" : points > 0 ? "supporting" : "none",
    explanation:
      points >= 12
        ? "Absendername stimmt mit hoher Ähnlichkeit überein."
        : points > 0
          ? "Absendername stimmt teilweise überein."
          : "Absendername passt nicht ausreichend.",
  };
}

function scoreReference(
  reference: string | undefined,
  candidate: LeasePaymentCandidate,
): PaymentMatchReason {
  const normalizedReference = normalizeText(reference);
  if (!normalizedReference) {
    return {
      code: "reference",
      points: 0,
      maxPoints: 15,
      matched: false,
      strength: "none",
      explanation: "Kein Verwendungszweck für den Vergleich vorhanden.",
    };
  }

  const explicitReference = normalizeText(candidate.paymentReference);
  const compactReference = normalizedReference.replaceAll(" ", "");
  const compactExplicit = explicitReference.replaceAll(" ", "");
  if (
    compactExplicit.length >= 4 &&
    compactReference.includes(compactExplicit)
  ) {
    return {
      code: "reference",
      points: 15,
      maxPoints: 15,
      matched: true,
      strength: "strong",
      explanation:
        "Der hinterlegte eindeutige Miet-Verwendungszweck wurde gefunden.",
    };
  }

  const candidateTokens = new Set(
    normalizeText(
      [
        candidate.paymentReference,
        candidate.tenantName,
        candidate.unitLabel,
        candidate.propertyLabel,
        candidate.leaseId,
      ]
        .filter(Boolean)
        .join(" "),
    )
      .split(" ")
      .filter((token) => token.length >= 3),
  );
  const referenceTokens = normalizedReference
    .split(" ")
    .filter((token) => token.length >= 3);
  const matchingTokens = referenceTokens.filter((token) =>
    candidateTokens.has(token),
  );
  const points =
    matchingTokens.length >= 2 ? 12 : matchingTokens.length === 1 ? 7 : 0;
  return {
    code: "reference",
    points,
    maxPoints: 15,
    matched: points > 0,
    strength: points >= 12 ? "strong" : points > 0 ? "supporting" : "none",
    explanation:
      points >= 12
        ? `Mehrere passende Merkmale im Verwendungszweck: ${matchingTokens.join(", ")}.`
        : points > 0
          ? `Ein passendes Merkmal im Verwendungszweck: ${matchingTokens[0]}.`
          : "Verwendungszweck enthält kein belastbares passendes Merkmal.",
  };
}

function scoreBookingDate(
  bookingDate: IsoDate,
  dueDate: IsoDate,
): PaymentMatchReason {
  const differenceDays = Math.abs(daysBetween(bookingDate, dueDate));
  const points =
    differenceDays <= 3 ? 5 : differenceDays <= 7 ? 3 : differenceDays <= 15 ? 1 : 0;
  return {
    code: "booking_date",
    points,
    maxPoints: 5,
    matched: points > 0,
    strength: points === 5 ? "supporting" : points > 0 ? "supporting" : "none",
    explanation:
      points > 0
        ? `Buchung liegt ${differenceDays} Tag(e) vom Fälligkeitstermin entfernt.`
        : `Buchung liegt ${differenceDays} Tage vom Fälligkeitstermin entfernt.`,
  };
}

function assertPaymentAndCandidate(
  payment: IncomingPaymentForMatching,
  candidate: LeasePaymentCandidate,
): void {
  assertMoneyCents(payment.amountCents, "payment.amountCents");
  if (payment.amountCents === 0) {
    throw new DomainValidationError(
      "payment.amountCents muss für einen Zahlungseingang größer als null sein.",
      "payment.amountCents",
    );
  }
  assertMoneyCents(candidate.expectedAmountCents, "expectedAmountCents");
  if (candidate.outstandingAmountCents !== undefined) {
    assertMoneyCents(
      candidate.outstandingAmountCents,
      "outstandingAmountCents",
    );
  }
  parseIsoDate(payment.bookingDate, "payment.bookingDate");
  parseIsoDate(candidate.dueDate, "candidate.dueDate");
}

function normalizeText(value: string | undefined): string {
  return (value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("de-DE")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeIban(value: string | undefined): string {
  return (value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function tokenSimilarity(left: string, right: string): number {
  const leftTokens = new Set(left.split(" ").filter(Boolean));
  const rightTokens = new Set(right.split(" ").filter(Boolean));
  const intersection = [...leftTokens].filter((token) =>
    rightTokens.has(token),
  ).length;
  const union = new Set([...leftTokens, ...rightTokens]).size;
  return union === 0 ? 0 : intersection / union;
}

function levenshteinSimilarity(left: string, right: string): number {
  if (left === right) {
    return 1;
  }
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const substitutionCost =
        left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;
      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + substitutionCost,
      );
    }
    for (let index = 0; index < current.length; index += 1) {
      previous[index] = current[index];
    }
  }
  return 1 - previous[right.length] / Math.max(left.length, right.length);
}

function daysBetween(left: IsoDate, right: IsoDate): number {
  const leftDate = parseIsoDate(left, "leftDate");
  const rightDate = parseIsoDate(right, "rightDate");
  return roundHalfAwayFromZero(
    (leftDate.getTime() - rightDate.getTime()) / 86_400_000,
  );
}

function parseIsoDate(value: string, field: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new DomainValidationError(
      `${field} muss als YYYY-MM-DD angegeben werden.`,
      field,
    );
  }
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new DomainValidationError(`${field} ist kein gültiges Datum.`, field);
  }
  return parsed;
}
