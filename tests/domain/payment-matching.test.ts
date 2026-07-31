import { describe, expect, it } from "vitest";

import {
  matchPayment,
  PAYMENT_MATCH_THRESHOLDS,
  scorePaymentCandidate,
} from "../../src/lib/domain";
import {
  createDemoPaymentCandidates,
  DEMO_DATA,
} from "../../src/lib/demo";

describe("erklärbares Payment-Matching", () => {
  const candidates = createDemoPaymentCandidates("2026-07-03");

  it("ordnet nur bei hohem Score und starkem Identitätsmerkmal automatisch zu", () => {
    const payment = DEMO_DATA.payments.find(
      (item) => item.id === "demo-payment-jul-a1",
    );
    expect(payment).toBeDefined();

    const result = matchPayment(payment!, candidates);
    expect(result.bestMatch).toMatchObject({
      leaseId: "demo-lease-a1",
      score: 100,
      confidence: "high",
      decision: "automatic",
      amountClassification: "exact",
    });
    expect(result.bestMatch?.reasons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "amount",
          points: 40,
          matched: true,
        }),
        expect.objectContaining({
          code: "iban",
          points: 25,
          matched: true,
        }),
        expect.objectContaining({
          code: "reference",
          points: 15,
          matched: true,
        }),
      ]),
    );
  });

  it("macht aus einem passenden Betrag allein keine automatische Zuordnung", () => {
    const candidate = candidates[0];
    const score = scorePaymentCandidate(
      {
        id: "amount-only",
        amountCents: candidate.expectedAmountCents,
        bookingDate: candidate.dueDate,
      },
      candidate,
    );
    expect(score.score).toBe(45);
    expect(score.decision).toBe("no_match");
  });

  it("kennzeichnet Teilzahlungen trotz passender Identität zur Prüfung", () => {
    const payment = DEMO_DATA.payments.find(
      (item) => item.id === "demo-payment-jul-b2-partial",
    );
    expect(payment).toBeDefined();

    const result = matchPayment(payment!, candidates);
    expect(result.bestMatch).toMatchObject({
      leaseId: "demo-lease-b2",
      score: 82,
      decision: "review",
      amountClassification: "partial",
    });
    expect(result.explanation).toContain("Prüfung");
  });

  it("stuft nahezu gleich gute Kandidaten immer auf manuelle Prüfung zurück", () => {
    const baseCandidate = candidates[0];
    const payment = {
      id: "ambiguous-payment",
      amountCents: baseCandidate.expectedAmountCents,
      bookingDate: baseCandidate.dueDate,
      senderName: baseCandidate.tenantName,
      senderIban: baseCandidate.tenantIban,
      reference: baseCandidate.paymentReference,
    };
    const result = matchPayment(payment, [
      baseCandidate,
      {
        ...baseCandidate,
        leaseId: "demo-lease-duplicate",
        unitId: "demo-unit-duplicate",
      },
    ]);

    expect(result.bestMatch?.score).toBe(100);
    expect(result.bestMatch?.decision).toBe("review");
    expect(result.bestMatch?.reasons.at(-1)?.code).toBe("ambiguous");
  });

  it("stellt Schwellenwerte und Negativgründe für die Oberfläche bereit", () => {
    const score = scorePaymentCandidate(
      {
        id: "wrong-payment",
        amountCents: 12_345,
        bookingDate: "2026-07-30",
        senderName: "Niemand",
        senderIban: "DE00 WRONG",
        reference: "Privat",
      },
      candidates[0],
    );
    expect(PAYMENT_MATCH_THRESHOLDS).toEqual({
      automatic: 85,
      review: 55,
      ambiguityMargin: 5,
    });
    expect(score.decision).toBe("no_match");
    expect(score.reasons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "iban",
          matched: false,
          strength: "negative",
        }),
      ]),
    );
  });
});
