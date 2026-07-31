import {
  assertMoneyCents,
  clamp,
  DomainValidationError,
  multiplyCents,
  roundHalfAwayFromZero,
  roundRatio,
  sumCents,
} from "./money";
import type {
  IsoDate,
  MoneyCents,
  RenovationCondition,
  RenovationMeasure,
  RenovationPriority,
} from "./types";

export interface RenovationReserveItem {
  measureId: string;
  plannedDate: IsoDate;
  monthsUntilPlannedDate: number;
  costIncludingContingencyCents: MoneyCents;
  reserveAllocatedCents: MoneyCents;
  remainingFundingNeedCents: MoneyCents;
  requiredMonthlyReserveCents: MoneyCents;
  horizon: "short_term" | "medium_term" | "long_term";
}

export interface RenovationReserveResult {
  totalPlannedCostCents: MoneyCents;
  totalContingencyCents: MoneyCents;
  totalNeedCents: MoneyCents;
  existingReserveCents: MoneyCents;
  uncoveredNeedCents: MoneyCents;
  shortTermNeedCents: MoneyCents;
  mediumTermNeedCents: MoneyCents;
  longTermNeedCents: MoneyCents;
  requiredMonthlyReserveCents: MoneyCents;
  items: RenovationReserveItem[];
  assumption: string;
}

export interface RenovationScoreFactor {
  measureId: string;
  conditionScore: number;
  priorityScore: number;
  timingScore: number;
  measureScore: number;
  weight: number;
  explanation: string;
}

export interface RenovationBacklogScore {
  score: number;
  band: "low" | "moderate" | "high" | "very_high";
  factors: RenovationScoreFactor[];
  explanation: string;
  disclaimer: string;
}

/**
 * Reserve planning distributes existing reserves to the earliest measures
 * first. Each remaining need is divided by whole saving months and rounded up
 * to ensure the plan does not underfund due to cent rounding.
 */
export function calculateRenovationReserve(input: {
  measures: readonly RenovationMeasure[];
  asOfDate: IsoDate;
  existingReserveCents?: MoneyCents;
}): RenovationReserveResult {
  assertIsoDate(input.asOfDate, "asOfDate");
  const existingReserveCents = input.existingReserveCents ?? 0;
  assertMoneyCents(existingReserveCents, "existingReserveCents");

  const activeMeasures = input.measures
    .filter(
      (measure) =>
        measure.status !== "completed" && measure.status !== "cancelled",
    )
    .map((measure) => {
      assertMoneyCents(
        measure.estimatedCostCents,
        `${measure.id}.estimatedCostCents`,
      );
      if (measure.actualCostCents !== undefined) {
        assertMoneyCents(
          measure.actualCostCents,
          `${measure.id}.actualCostCents`,
        );
      }
      if (
        !Number.isFinite(measure.contingencyRate) ||
        measure.contingencyRate < 0 ||
        measure.contingencyRate > 1
      ) {
        throw new DomainValidationError(
          "contingencyRate muss zwischen 0 und 1 liegen.",
          `${measure.id}.contingencyRate`,
        );
      }
      assertIsoDate(measure.plannedDate, `${measure.id}.plannedDate`);

      const plannedCostCents = Math.max(
        measure.estimatedCostCents,
        measure.actualCostCents ?? 0,
      );
      const contingencyCents = multiplyCents(
        plannedCostCents,
        measure.contingencyRate,
      );
      const monthsUntilPlannedDate = Math.max(
        1,
        calendarMonthDifference(input.asOfDate, measure.plannedDate),
      );
      return {
        measure,
        plannedCostCents,
        contingencyCents,
        needCents: plannedCostCents + contingencyCents,
        monthsUntilPlannedDate,
        horizon: horizonForMonths(monthsUntilPlannedDate),
      };
    })
    .sort(
      (left, right) =>
        left.measure.plannedDate.localeCompare(right.measure.plannedDate) ||
        left.measure.id.localeCompare(right.measure.id),
    );

  let reserveRemainingCents = existingReserveCents;
  const items = activeMeasures.map((entry): RenovationReserveItem => {
    const reserveAllocatedCents = Math.min(
      reserveRemainingCents,
      entry.needCents,
    );
    reserveRemainingCents -= reserveAllocatedCents;
    const remainingFundingNeedCents =
      entry.needCents - reserveAllocatedCents;
    return {
      measureId: entry.measure.id,
      plannedDate: entry.measure.plannedDate,
      monthsUntilPlannedDate: entry.monthsUntilPlannedDate,
      costIncludingContingencyCents: entry.needCents,
      reserveAllocatedCents,
      remainingFundingNeedCents,
      requiredMonthlyReserveCents:
        remainingFundingNeedCents === 0
          ? 0
          : Math.ceil(
              remainingFundingNeedCents / entry.monthsUntilPlannedDate,
            ),
      horizon: entry.horizon,
    };
  });

  const totalPlannedCostCents = sumCents(
    activeMeasures.map((entry) => entry.plannedCostCents),
  );
  const totalContingencyCents = sumCents(
    activeMeasures.map((entry) => entry.contingencyCents),
  );
  const totalNeedCents = totalPlannedCostCents + totalContingencyCents;

  return {
    totalPlannedCostCents,
    totalContingencyCents,
    totalNeedCents,
    existingReserveCents,
    uncoveredNeedCents: Math.max(0, totalNeedCents - existingReserveCents),
    shortTermNeedCents: sumCents(
      items
        .filter((item) => item.horizon === "short_term")
        .map((item) => item.costIncludingContingencyCents),
    ),
    mediumTermNeedCents: sumCents(
      items
        .filter((item) => item.horizon === "medium_term")
        .map((item) => item.costIncludingContingencyCents),
    ),
    longTermNeedCents: sumCents(
      items
        .filter((item) => item.horizon === "long_term")
        .map((item) => item.costIncludingContingencyCents),
    ),
    requiredMonthlyReserveCents: sumCents(
      items.map((item) => item.requiredMonthlyReserveCents),
    ),
    items,
    assumption:
      "Vorhandene Rücklagen werden chronologisch auf Maßnahmen verteilt. Offene Beträge werden ohne Verzinsung bis zum Planmonat angespart; überfällige Maßnahmen werden auf einen Monat verteilt.",
  };
}

/**
 * Explainable 0–100 backlog indicator. Per measure:
 * 50 % recorded condition + 30 % priority + 20 % timing.
 * Measure scores are cost-weighted (equal weight when all costs are zero).
 */
export function calculateRenovationBacklogScore(input: {
  measures: readonly RenovationMeasure[];
  asOfDate: IsoDate;
}): RenovationBacklogScore {
  assertIsoDate(input.asOfDate, "asOfDate");
  const activeMeasures = input.measures.filter(
    (measure) =>
      measure.status !== "completed" && measure.status !== "cancelled",
  );
  if (activeMeasures.length === 0) {
    return {
      score: 0,
      band: "low",
      factors: [],
      explanation: "Keine offenen Sanierungsmaßnahmen erfasst.",
      disclaimer:
        "Der Score ist eine wirtschaftliche Modellierung auf Basis der Nutzereingaben und keine technische Begutachtung.",
    };
  }

  activeMeasures.forEach((measure) => {
    assertMoneyCents(measure.estimatedCostCents, "estimatedCostCents");
    assertIsoDate(measure.plannedDate, "plannedDate");
  });
  const totalWeight = activeMeasures.reduce(
    (sum, measure) => sum + Math.max(1, measure.estimatedCostCents),
    0,
  );

  const factors = activeMeasures.map((measure): RenovationScoreFactor => {
    const conditionScore = CONDITION_SCORES[measure.condition];
    const priorityScore = PRIORITY_SCORES[measure.priority];
    const monthDifference = calendarMonthDifference(
      input.asOfDate,
      measure.plannedDate,
    );
    const timingScore =
      monthDifference < 0
        ? 100
        : monthDifference <= 12
          ? 80
          : monthDifference <= 36
            ? 45
            : 15;
    const measureScore = roundHalfAwayFromZero(
      conditionScore * 0.5 + priorityScore * 0.3 + timingScore * 0.2,
    );
    const weight = Math.max(1, measure.estimatedCostCents) / totalWeight;

    return {
      measureId: measure.id,
      conditionScore,
      priorityScore,
      timingScore,
      measureScore,
      weight: roundRatio(weight) ?? 0,
      explanation: `${conditionLabel(measure.condition)}, Priorität ${priorityLabel(measure.priority)}, ${timingLabel(monthDifference)}.`,
    };
  });
  const score = clamp(
    roundHalfAwayFromZero(
      factors.reduce(
        (total, factor) => total + factor.measureScore * factor.weight,
        0,
      ),
    ),
    0,
    100,
  );

  return {
    score,
    band:
      score < 25
        ? "low"
        : score < 50
          ? "moderate"
          : score < 75
            ? "high"
            : "very_high",
    factors,
    explanation:
      "Kosten-gewichteter Score aus erfasstem Zustand (50 %), Priorität (30 %) und zeitlicher Dringlichkeit (20 %).",
    disclaimer:
      "Der Score ist eine wirtschaftliche Modellierung auf Basis der Nutzereingaben und keine technische Begutachtung.",
  };
}

const CONDITION_SCORES: Record<RenovationCondition, number> = {
  good: 5,
  fair: 35,
  poor: 70,
  critical: 100,
};

const PRIORITY_SCORES: Record<RenovationPriority, number> = {
  low: 10,
  medium: 40,
  high: 75,
  urgent: 100,
};

function horizonForMonths(
  months: number,
): RenovationReserveItem["horizon"] {
  if (months <= 24) {
    return "short_term";
  }
  if (months <= 60) {
    return "medium_term";
  }
  return "long_term";
}

function calendarMonthDifference(from: IsoDate, to: IsoDate): number {
  const [fromYear, fromMonth] = from.split("-").map(Number);
  const [toYear, toMonth] = to.split("-").map(Number);
  return (toYear - fromYear) * 12 + (toMonth - fromMonth);
}

function conditionLabel(condition: RenovationCondition): string {
  return {
    good: "Zustand gut",
    fair: "Zustand befriedigend",
    poor: "Zustand schlecht",
    critical: "Zustand kritisch",
  }[condition];
}

function priorityLabel(priority: RenovationPriority): string {
  return {
    low: "niedrig",
    medium: "mittel",
    high: "hoch",
    urgent: "dringend",
  }[priority];
}

function timingLabel(monthDifference: number): string {
  if (monthDifference < 0) {
    return "Plantermin überschritten";
  }
  if (monthDifference <= 12) {
    return "innerhalb von 12 Monaten geplant";
  }
  if (monthDifference <= 36) {
    return "innerhalb von 36 Monaten geplant";
  }
  return "langfristig geplant";
}

function assertIsoDate(value: string, field: string): void {
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
}
