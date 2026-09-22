"use client";

import { useEffect, useState, useTransition } from "react";
import {
  useFieldArray,
  useForm,
  useWatch,
  type FieldErrors,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Calculator,
  Check,
  Euro,
  FileCheck2,
  Landmark,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  calculateAcquisitionAllocation,
  propertySupportsMultipleUnits,
  propertyTypeOptions,
} from "@/lib/domain/property";
import {
  calculateGermanRentalTaxEstimate2026,
  recommendedBuildingDepreciationRate,
} from "@/lib/domain/tax";
import {
  nextOnboardingUnitNumber,
  onboardingSchema,
  type OnboardingInput,
} from "@/lib/validation/onboarding";
import {
  completeOnboardingAction,
  type OnboardingResult,
} from "@/app/onboarding/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  legacyOnboardingDraftKey,
  onboardingDraftKey,
  onboardingDraftVersion,
  parseOnboardingDraft,
} from "@/lib/onboarding/draft";
import { cn } from "@/lib/utils";

const steps = [
  { title: "Organisation", icon: Landmark },
  { title: "Immobilie & Kauf", icon: Building2 },
  { title: "Mieten & Einheiten", icon: Euro },
  { title: "Finanzierung", icon: Landmark },
  { title: "Steuer", icon: Calculator },
  { title: "Zusammenfassung", icon: FileCheck2 },
];

const currentYear = 2026;

const defaults: OnboardingInput = {
  organization: {
    name: "",
    organizationType: "private",
    street: "",
    postalCode: "",
    city: "",
    currency: "EUR",
    taxYear: currentYear,
  },
  property: {
    propertyMode: "existing",
    name: "",
    street: "",
    postalCode: "",
    city: "",
    propertyType: "condominium",
    constructionYear: 1990,
    purchaseDate: "",
    purchasePrice: 0,
    landArea: 0,
    standardLandValue: 0,
    landOwnershipSharePercent: 100,
    realEstateTransferTaxRate: 6,
    brokerFee: 0,
    notaryFee: 0,
    landRegistryFee: 0,
    otherAcquisitionCosts: 0,
    totalArea: 50,
    depreciationMode: "calculated",
    existingAnnualDepreciation: null,
  },
  units: [
    {
      unitNumber: "Mietfläche",
      floor: "",
      area: 50,
      rooms: 2,
      contractColdRent: 0,
      targetColdRent: 0,
      serviceCharge: 0,
      ancillaryChargeType: "advance",
      parkingRent: 0,
      leaseStart: "",
      status: "occupied",
    },
  ],
  financing: {
    enabled: false,
    loanType: "annuity",
    lenderName: "",
    originalPrincipal: 0,
    currentBalance: 0,
    nominalInterestRate: 0,
    initialRepaymentRate: 2,
    monthlyPayment: 0,
    disbursedOn: "",
    fixedRateUntil: "",
  },
  tax: {
    calculationMode: "automatic",
    manualEffectiveTaxRate: null,
    otherTaxableIncome: null,
    filingStatus: "single",
    rentalIncomeComplete: false,
    churchTax: false,
    solidaritySurcharge: false,
  },
  importMode: "none",
  confirmation: false,
};

const stepFields: string[][] = [
  [
    "organization.name",
    "organization.organizationType",
    "organization.street",
    "organization.postalCode",
    "organization.city",
    "organization.taxYear",
  ],
  ["property"],
  ["units"],
  ["financing"],
  ["tax"],
  ["confirmation"],
];

const currencyFormatter = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 2,
});

function formatCents(value: number | null | undefined) {
  return currencyFormatter.format((value ?? 0) / 100);
}

function formatRate(value: number | null | undefined) {
  return `${((value ?? 0) * 100).toLocaleString("de-DE", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} %`;
}

function FieldError({ message }: { message?: string }) {
  return message ? (
    <p className="text-xs text-destructive">{message}</p>
  ) : null;
}

function MoneyField({
  id,
  label,
  registration,
  error,
  nullable = false,
  disabled = false,
}: {
  id: string;
  label: string;
  registration: ReturnType<typeof useForm<OnboardingInput>>["register"];
  error?: string;
  nullable?: boolean;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type="number"
          min="0"
          step="0.01"
          disabled={disabled}
          className="pr-10"
          aria-invalid={Boolean(error)}
          {...registration(
            id as never,
            nullable
              ? {
                  setValueAs: (value) =>
                    value === "" ? null : Number(value),
                }
              : { valueAsNumber: true },
          )}
        />
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
          €
        </span>
      </div>
      <FieldError message={error} />
    </div>
  );
}

function PercentageField({
  id,
  label,
  registration,
  error,
  nullable = false,
}: {
  id: string;
  label: string;
  registration: ReturnType<typeof useForm<OnboardingInput>>["register"];
  error?: string;
  nullable?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type="number"
          min="0"
          max="100"
          step="0.01"
          className="pr-10"
          aria-invalid={Boolean(error)}
          {...registration(
            id as never,
            nullable
              ? {
                  setValueAs: (value) =>
                    value === "" ? null : Number(value),
                }
              : { valueAsNumber: true },
          )}
        />
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
          %
        </span>
      </div>
      <FieldError message={error} />
    </div>
  );
}

function SummaryValue({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border bg-background p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function OnboardingWizard({
  fullName,
  userId,
  initialOrganization,
  initialTax,
  resumeMode = false,
}: {
  fullName: string | null;
  userId: string;
  initialOrganization?: OnboardingInput["organization"];
  initialTax?: OnboardingInput["tax"];
  resumeMode?: boolean;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [pending, startTransition] = useTransition();
  const [hydrated, setHydrated] = useState(false);
  const storageKey = onboardingDraftKey(userId);
  const form = useForm<OnboardingInput>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      ...defaults,
      organization: initialOrganization ?? defaults.organization,
      tax: initialTax ?? defaults.tax,
    },
    mode: "onBlur",
  });
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "units",
  });
  const watchedValues = useWatch({ control: form.control });
  const propertyMode = watchedValues.property?.propertyMode ?? "existing";
  const propertyType =
    watchedValues.property?.propertyType ?? "condominium";
  const supportsMultipleUnits = propertySupportsMultipleUnits(propertyType);

  const acquisition = (() => {
    const property = watchedValues.property;
    if (!property) return null;
    try {
      return calculateAcquisitionAllocation({
        purchasePriceCents: Math.round((property.purchasePrice ?? 0) * 100),
        landAreaSquareMeters: property.landArea ?? 0,
        standardLandValueCentsPerSquareMeter: Math.round(
          (property.standardLandValue ?? 0) * 100,
        ),
        landOwnershipShare:
          (property.landOwnershipSharePercent ?? 100) / 100,
        realEstateTransferTaxRate:
          (property.realEstateTransferTaxRate ?? 0) / 100,
        brokerFeeCents: Math.round((property.brokerFee ?? 0) * 100),
        notaryAndLandRegistryFeeCents: Math.round(
          ((property.notaryFee ?? 0) + (property.landRegistryFee ?? 0)) *
            100,
        ),
        otherAcquisitionCostsCents: Math.round(
          (property.otherAcquisitionCosts ?? 0) * 100,
        ),
      });
    } catch {
      return null;
    }
  })();

  const annualContractRentCents = Math.round(
    (watchedValues.units ?? []).reduce(
      (sum, unit) =>
        sum +
        (unit?.status === "occupied"
          ? (unit.contractColdRent ?? 0)
          : 0),
      0,
    ) *
      12 *
      100,
  );
  const annualTargetRentCents = Math.round(
    (watchedValues.units ?? []).reduce(
      (sum, unit) =>
        sum + (unit?.targetColdRent ?? 0),
      0,
    ) *
      12 *
      100,
  );
  const annualParkingRentCents = Math.round(
    (watchedValues.units ?? []).reduce(
      (sum, unit) =>
        sum +
        (propertyMode === "scenario" || unit?.status === "occupied"
          ? (unit?.parkingRent ?? 0)
          : 0),
      0,
    ) *
      12 *
      100,
  );
  const annualAncillaryIncomeCents = Math.round(
    (watchedValues.units ?? []).reduce(
      (sum, unit) =>
        sum +
        (propertyMode === "existing" &&
        unit?.status === "occupied" &&
        unit.ancillaryChargeType !== "none"
          ? (unit.serviceCharge ?? 0)
          : 0),
      0,
    ) *
      12 *
      100,
  );
  const calculatedDepreciationCents = (() => {
    const property = watchedValues.property;
    if (!property || !acquisition) return 0;
    if (
      property.propertyMode === "existing" &&
      property.depreciationMode === "tax_return"
    ) {
      return Math.round((property.existingAnnualDepreciation ?? 0) * 100);
    }
    try {
      return Math.round(
        acquisition.buildingValueCents *
          recommendedBuildingDepreciationRate(
            property.propertyType ?? "condominium",
            property.constructionYear ?? 0,
          ),
      );
    } catch {
      return 0;
    }
  })();
  const annualInterestCents = Math.round(
    (watchedValues.financing?.enabled
      ? (watchedValues.financing.currentBalance ?? 0) *
        ((watchedValues.financing.nominalInterestRate ?? 0) / 100)
      : 0) * 100,
  );
  const taxableRentalResultCents =
    propertyMode === "existing"
      ? annualContractRentCents +
        annualAncillaryIncomeCents +
        annualParkingRentCents -
        annualInterestCents -
        calculatedDepreciationCents
      : 0;
  const automaticTaxEstimate = (() => {
    if (
      watchedValues.tax?.calculationMode !== "automatic" ||
      watchedValues.tax.otherTaxableIncome == null
    ) {
      return null;
    }
    return calculateGermanRentalTaxEstimate2026({
      otherTaxableIncomeCents: Math.round(
        watchedValues.tax.otherTaxableIncome * 100,
      ),
      taxableRentalResultCents,
      assessmentType:
        watchedValues.tax.filingStatus === "joint" ? "joint" : "individual",
    });
  })();

  useEffect(() => {
    let restoredDraft: ReturnType<typeof parseOnboardingDraft> = null;
    try {
      window.localStorage.removeItem(legacyOnboardingDraftKey);
      restoredDraft = parseOnboardingDraft(
        window.localStorage.getItem(storageKey),
        steps.length,
      );
      if (!restoredDraft) window.localStorage.removeItem(storageKey);
    } catch {
      // Storage can be unavailable in private or restricted browser contexts.
    }

    const restoreTimer = window.setTimeout(() => {
      if (restoredDraft) {
        form.reset(restoredDraft.values);
        setStep(restoredDraft.step);
      }
      setHydrated(true);
    }, 0);

    return () => window.clearTimeout(restoreTimer);
  }, [form, storageKey]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(
        storageKey,
        JSON.stringify({
          version: onboardingDraftVersion,
          step,
          values: watchedValues,
        }),
      );
    } catch {
      // The wizard remains usable without persistent browser storage.
    }
  }, [hydrated, step, storageKey, watchedValues]);

  async function nextStep() {
    const valid = await form.trigger(stepFields[step] as never, {
      shouldFocus: true,
    });
    if (valid) setStep((value) => Math.min(value + 1, steps.length - 1));
  }

  function handleSuccess(result: OnboardingResult) {
    if (!result.success) {
      toast.error(result.message);
      return;
    }
    try {
      window.localStorage.removeItem(storageKey);
    } catch {
      // Completion must not depend on browser storage access.
    }
    toast.success(result.message);
    router.replace("/app");
    router.refresh();
  }

  function finish(values: OnboardingInput) {
    startTransition(async () => {
      handleSuccess(await completeOnboardingAction(values));
    });
  }

  function handleInvalid(errors: FieldErrors<OnboardingInput>) {
    const invalidStep = errors.organization
      ? 0
      : errors.property
        ? 1
        : errors.units
          ? 2
          : errors.financing
            ? 3
            : errors.tax
              ? 4
              : 5;
    setStep(invalidStep);
    toast.error("Bitte prüfe die markierten Angaben.");
  }

  function setPropertyMode(mode: OnboardingInput["property"]["propertyMode"]) {
    form.setValue("property.propertyMode", mode, {
      shouldDirty: true,
      shouldValidate: true,
    });
    if (mode === "scenario") {
      form.getValues("units").forEach((_, index) => {
        form.setValue(`units.${index}.status`, "vacant", {
          shouldDirty: true,
        });
        form.setValue(`units.${index}.contractColdRent`, 0, {
          shouldDirty: true,
        });
        form.setValue(`units.${index}.leaseStart`, "", {
          shouldDirty: true,
        });
      });
    }
  }

  const progress = ((step + 1) / steps.length) * 100;
  const propertyErrors = form.formState.errors.property;

  return (
    <div className="mx-auto w-full max-w-6xl">
      <div className="mb-8">
        <p className="text-sm font-medium text-primary">
          Willkommen{fullName ? `, ${fullName.split(" ")[0]}` : ""}.
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
          {resumeMode
            ? "Setzen wir deine Portfolio-Einrichtung fort"
            : "Richten wir dein Portfolio ein"}
        </h1>
        <p className="mt-3 max-w-3xl text-muted-foreground">
          Erfasse eine echte Bestandsimmobilie oder ein klar getrenntes
          Szenario. Geldwerte sind mit „mtl.“ für monatlich und „p. a.“ für pro
          Jahr gekennzeichnet.
        </p>
      </div>

      <div className="mb-7">
        <div className="mb-3 flex items-center justify-between text-sm">
          <span className="font-medium">
            Schritt {step + 1} von {steps.length}
          </span>
          <span className="text-muted-foreground">{steps[step]?.title}</span>
        </div>
        <Progress value={progress} />
        <ol className="mt-4 hidden grid-cols-6 gap-2 lg:grid">
          {steps.map((item, index) => (
            <li
              key={item.title}
              className={cn(
                "flex items-center gap-2 text-xs",
                index <= step ? "text-foreground" : "text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "grid size-6 shrink-0 place-items-center rounded-full border",
                  index < step
                    ? "border-primary bg-primary text-primary-foreground"
                    : index === step
                      ? "border-primary text-primary"
                      : "border-border",
                )}
              >
                {index < step ? (
                  <Check className="size-3.5" />
                ) : (
                  <item.icon className="size-3.5" />
                )}
              </span>
              <span className="truncate">{item.title}</span>
            </li>
          ))}
        </ol>
      </div>

      <form onSubmit={form.handleSubmit(finish, handleInvalid)}>
        <Card>
          <CardHeader>
            <CardTitle>{steps[step]?.title}</CardTitle>
          </CardHeader>
          <CardContent>
            {step === 0 ? (
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="organization.name">Name der Organisation</Label>
                  <Input
                    id="organization.name"
                    placeholder="z. B. Immobilienportfolio Mustermann"
                    aria-invalid={Boolean(
                      form.formState.errors.organization?.name,
                    )}
                    {...form.register("organization.name")}
                  />
                  <FieldError
                    message={form.formState.errors.organization?.name?.message}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Art</Label>
                  <Select
                    value={
                      watchedValues.organization?.organizationType ?? "private"
                    }
                    onValueChange={(value: "private" | "company") =>
                      form.setValue("organization.organizationType", value, {
                        shouldDirty: true,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="private">Privatperson</SelectItem>
                      <SelectItem value="company">Unternehmen</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="organization.taxYear">Steuerjahr</Label>
                  <Input
                    id="organization.taxYear"
                    type="number"
                    min="2026"
                    aria-invalid={Boolean(
                      form.formState.errors.organization?.taxYear,
                    )}
                    {...form.register("organization.taxYear", {
                      valueAsNumber: true,
                    })}
                  />
                  <FieldError
                    message={
                      form.formState.errors.organization?.taxYear?.message
                    }
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="organization.street">Straße und Hausnummer</Label>
                  <Input
                    id="organization.street"
                    autoComplete="street-address"
                    {...form.register("organization.street")}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="organization.postalCode">Postleitzahl</Label>
                  <Input
                    id="organization.postalCode"
                    autoComplete="postal-code"
                    {...form.register("organization.postalCode")}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="organization.city">Ort</Label>
                  <Input
                    id="organization.city"
                    autoComplete="address-level2"
                    {...form.register("organization.city")}
                  />
                </div>
                <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground sm:col-span-2">
                  Die Einrichtung wird erst nach der Zusammenfassung gespeichert.
                  Es gibt keinen vorzeitigen Sprung in ein unvollständiges
                  Dashboard.
                </div>
              </div>
            ) : null}

            {step === 1 ? (
              <div className="space-y-7">
                <div className="grid gap-4 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setPropertyMode("existing")}
                    className={cn(
                      "rounded-xl border p-5 text-left transition-colors",
                      propertyMode === "existing"
                        ? "border-primary bg-primary/5 ring-2 ring-primary/15"
                        : "hover:bg-muted/50",
                    )}
                  >
                    <Building2 className="size-6 text-primary" />
                    <p className="mt-3 font-medium">Bestandsimmobilie</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Reales Vermögen mit Mietverhältnissen, Forderungen,
                      Zahlungen, Steuer und Cashflow.
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPropertyMode("scenario")}
                    className={cn(
                      "rounded-xl border p-5 text-left transition-colors",
                      propertyMode === "scenario"
                        ? "border-primary bg-primary/5 ring-2 ring-primary/15"
                        : "hover:bg-muted/50",
                    )}
                  >
                    <Calculator className="size-6 text-primary" />
                    <p className="mt-3 font-medium">Fiktive Immobilie</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Optionales Szenario. Es erzeugt keine echten Einnahmen
                      und fließt nicht in den Ist-Cashflow ein.
                    </p>
                  </button>
                </div>

                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="property.name">Bezeichnung</Label>
                    <Input
                      id="property.name"
                      placeholder="z. B. ETW Lindenstraße"
                      aria-invalid={Boolean(propertyErrors?.name)}
                      {...form.register("property.name")}
                    />
                    <FieldError message={propertyErrors?.name?.message} />
                  </div>
                  <div className="space-y-2">
                    <Label>Immobilientyp</Label>
                    <Select
                      value={propertyType}
                      onValueChange={(
                        value: OnboardingInput["property"]["propertyType"],
                      ) => {
                        if (
                          !propertySupportsMultipleUnits(value) &&
                          fields.length > 1
                        ) {
                          toast.error(
                            "Bitte entferne zuerst die zusätzlichen Einheiten.",
                          );
                          return;
                        }
                        form.setValue("property.propertyType", value, {
                          shouldDirty: true,
                          shouldValidate: true,
                        });
                        if (!propertySupportsMultipleUnits(value)) {
                          form.setValue("units.0.unitNumber", "Mietfläche", {
                            shouldDirty: true,
                          });
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {propertyTypeOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.abbreviation} · {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="property.street">Straße und Hausnummer</Label>
                    <Input
                      id="property.street"
                      aria-invalid={Boolean(propertyErrors?.street)}
                      {...form.register("property.street")}
                    />
                    <FieldError message={propertyErrors?.street?.message} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="property.postalCode">Postleitzahl</Label>
                    <Input
                      id="property.postalCode"
                      aria-invalid={Boolean(propertyErrors?.postalCode)}
                      {...form.register("property.postalCode")}
                    />
                    <FieldError message={propertyErrors?.postalCode?.message} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="property.city">Ort</Label>
                    <Input
                      id="property.city"
                      aria-invalid={Boolean(propertyErrors?.city)}
                      {...form.register("property.city")}
                    />
                    <FieldError message={propertyErrors?.city?.message} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="property.constructionYear">Baujahr</Label>
                    <Input
                      id="property.constructionYear"
                      type="number"
                      min="1000"
                      max="2100"
                      aria-invalid={Boolean(propertyErrors?.constructionYear)}
                      {...form.register("property.constructionYear", {
                        valueAsNumber: true,
                      })}
                    />
                    <FieldError
                      message={propertyErrors?.constructionYear?.message}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="property.purchaseDate">Kaufdatum</Label>
                    <Input
                      id="property.purchaseDate"
                      type="date"
                      aria-invalid={Boolean(propertyErrors?.purchaseDate)}
                      {...form.register("property.purchaseDate")}
                    />
                    <FieldError message={propertyErrors?.purchaseDate?.message} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="property.totalArea">Gesamtfläche in m²</Label>
                    <Input
                      id="property.totalArea"
                      type="number"
                      min="0.01"
                      step="0.01"
                      aria-invalid={Boolean(propertyErrors?.totalArea)}
                      {...form.register("property.totalArea", {
                        valueAsNumber: true,
                      })}
                    />
                    <FieldError message={propertyErrors?.totalArea?.message} />
                  </div>
                </div>

                <div>
                  <h3 className="font-medium">Kaufpreis und Grundstück</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Der Grundstücksanteil wird als Bodenrichtwert ×
                    Grundstücksfläche × Eigentumsanteil berechnet.
                  </p>
                  <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                    <MoneyField
                      id="property.purchasePrice"
                      label="Kaufpreis"
                      registration={form.register}
                      error={propertyErrors?.purchasePrice?.message}
                    />
                    <div className="space-y-2">
                      <Label htmlFor="property.landArea">
                        Grundstücksfläche in m²
                      </Label>
                      <Input
                        id="property.landArea"
                        type="number"
                        min="0.01"
                        step="0.01"
                        aria-invalid={Boolean(propertyErrors?.landArea)}
                        {...form.register("property.landArea", {
                          valueAsNumber: true,
                        })}
                      />
                      <FieldError message={propertyErrors?.landArea?.message} />
                    </div>
                    <MoneyField
                      id="property.standardLandValue"
                      label="Bodenrichtwert je m²"
                      registration={form.register}
                      error={propertyErrors?.standardLandValue?.message}
                    />
                    <PercentageField
                      id="property.landOwnershipSharePercent"
                      label="Eigentumsanteil Grundstück"
                      registration={form.register}
                      error={
                        propertyErrors?.landOwnershipSharePercent?.message
                      }
                    />
                  </div>
                </div>

                <div>
                  <h3 className="font-medium">Kaufnebenkosten</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    „Grunderwerbsteuer“ ist die Steuer beim Kauf. Die jährlich
                    erhobene Grundsteuer wird später als laufender Beleg erfasst.
                  </p>
                  <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
                    <PercentageField
                      id="property.realEstateTransferTaxRate"
                      label="Grunderwerbsteuersatz"
                      registration={form.register}
                      error={
                        propertyErrors?.realEstateTransferTaxRate?.message
                      }
                    />
                    <MoneyField
                      id="property.brokerFee"
                      label="Makler"
                      registration={form.register}
                      error={propertyErrors?.brokerFee?.message}
                    />
                    <MoneyField
                      id="property.notaryFee"
                      label="Notar"
                      registration={form.register}
                      error={propertyErrors?.notaryFee?.message}
                    />
                    <MoneyField
                      id="property.landRegistryFee"
                      label="Grundbuch"
                      registration={form.register}
                      error={propertyErrors?.landRegistryFee?.message}
                    />
                    <MoneyField
                      id="property.otherAcquisitionCosts"
                      label="Weitere Kaufnebenkosten"
                      registration={form.register}
                      error={propertyErrors?.otherAcquisitionCosts?.message}
                    />
                  </div>
                </div>

                <div className="rounded-xl bg-muted/40 p-4">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <SummaryValue
                      label="Grunderwerbsteuer"
                      value={formatCents(acquisition?.realEstateTransferTaxCents)}
                      hint="automatisch aus Kaufpreis × Satz"
                    />
                    <SummaryValue
                      label="Grundstücksanteil"
                      value={formatCents(acquisition?.landValueCents)}
                    />
                    <SummaryValue
                      label="Kaufnebenkosten gesamt"
                      value={formatCents(acquisition?.acquisitionCostsCents)}
                    />
                    <SummaryValue
                      label="Gebäudeanteil / AfA-Basis"
                      value={formatCents(acquisition?.buildingValueCents)}
                      hint="Gebäudekaufpreis + anteilige Gebäudenebenkosten"
                    />
                  </div>
                  {!acquisition ? (
                    <p className="mt-3 text-sm text-destructive">
                      Bitte prüfe Kaufpreis, Grundstücksfläche und
                      Bodenrichtwert. Der Grundstücksanteil darf den
                      Kaufpreis nicht übersteigen.
                    </p>
                  ) : null}
                </div>

                {propertyMode === "existing" ? (
                  <div className="space-y-4 rounded-xl border p-4">
                    <div>
                      <h3 className="font-medium">Vorhandene Abschreibung</h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Bei einer Bestandsimmobilie kannst du die AfA aus der
                        letzten Steuererklärung übernehmen. Andernfalls wird
                        eine unverbindliche lineare AfA aus Baujahr und
                        Gebäudeanteil angesetzt.
                      </p>
                    </div>
                    <Select
                      value={
                        watchedValues.property?.depreciationMode ?? "calculated"
                      }
                      onValueChange={(
                        value: "calculated" | "tax_return",
                      ) =>
                        form.setValue("property.depreciationMode", value, {
                          shouldDirty: true,
                          shouldValidate: true,
                        })
                      }
                    >
                      <SelectTrigger className="max-w-md">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="calculated">
                          Automatisch modellieren
                        </SelectItem>
                        <SelectItem value="tax_return">
                          Aus Steuererklärung übernehmen
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    {watchedValues.property?.depreciationMode ===
                    "tax_return" ? (
                      <div className="max-w-sm">
                        <MoneyField
                          id="property.existingAnnualDepreciation"
                          label="Vorhandene AfA (p. a.)"
                          registration={form.register}
                          error={
                            propertyErrors?.existingAnnualDepreciation?.message
                          }
                          nullable
                        />
                      </div>
                    ) : (
                      <p className="text-sm">
                        Modellierte lineare AfA: {formatCents(calculatedDepreciationCents)} p. a.
                      </p>
                    )}
                  </div>
                ) : null}
              </div>
            ) : null}

            {step === 2 ? (
              <div className="space-y-5">
                <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                  <strong className="font-medium text-foreground">IST</strong> =
                  Vertrags-Kaltmiete aus einem echten Mietverhältnis (mtl.).{" "}
                  <strong className="font-medium text-foreground">SOLL</strong> =
                  aktuelle Markt-/Ziel-Kaltmiete (mtl.). Nebenkosten werden als
                  Vorauszahlung, Pauschale oder „keine“ eindeutig geführt.
                </div>
                {fields.map((field, index) => {
                  const unitErrors = form.formState.errors.units?.[index];
                  const status = watchedValues.units?.[index]?.status ?? "vacant";
                  return (
                    <div className="rounded-xl border p-4" key={field.id}>
                      <div className="mb-4 flex items-center justify-between">
                        <p className="font-medium">
                          {supportsMultipleUnits
                            ? `Einheit ${index + 1}`
                            : "Mietfläche"}
                        </p>
                        {supportsMultipleUnits && fields.length > 1 ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => remove(index)}
                            aria-label={`Einheit ${index + 1} entfernen`}
                          >
                            <Trash2 className="size-4 text-destructive" />
                          </Button>
                        ) : null}
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <div className="space-y-2">
                          <Label htmlFor={`units.${index}.unitNumber`}>
                            Bezeichnung
                          </Label>
                          <Input
                            id={`units.${index}.unitNumber`}
                            aria-invalid={Boolean(unitErrors?.unitNumber)}
                            {...form.register(`units.${index}.unitNumber`)}
                          />
                          <FieldError message={unitErrors?.unitNumber?.message} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`units.${index}.floor`}>Etage</Label>
                          <Input
                            id={`units.${index}.floor`}
                            {...form.register(`units.${index}.floor`)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`units.${index}.area`}>
                            Fläche in m²
                          </Label>
                          <Input
                            id={`units.${index}.area`}
                            type="number"
                            min="0.1"
                            step="0.01"
                            aria-invalid={Boolean(unitErrors?.area)}
                            {...form.register(`units.${index}.area`, {
                              valueAsNumber: true,
                            })}
                          />
                          <FieldError message={unitErrors?.area?.message} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`units.${index}.rooms`}>Zimmer</Label>
                          <Input
                            id={`units.${index}.rooms`}
                            type="number"
                            min="0.5"
                            step="0.5"
                            aria-invalid={Boolean(unitErrors?.rooms)}
                            {...form.register(`units.${index}.rooms`, {
                              valueAsNumber: true,
                            })}
                          />
                          <FieldError message={unitErrors?.rooms?.message} />
                        </div>
                        {propertyMode === "existing" ? (
                          <MoneyField
                            id={`units.${index}.contractColdRent`}
                            label="IST / Vertrags-Kaltmiete (mtl.)"
                            registration={form.register}
                            error={unitErrors?.contractColdRent?.message}
                          />
                        ) : null}
                        <MoneyField
                          id={`units.${index}.targetColdRent`}
                          label={
                            propertyMode === "scenario"
                              ? "Plan-/Markt-Kaltmiete (mtl.)"
                              : "SOLL / Markt-Kaltmiete (mtl.)"
                          }
                          registration={form.register}
                          error={unitErrors?.targetColdRent?.message}
                        />
                        <MoneyField
                          id={`units.${index}.serviceCharge`}
                          label="Nebenkostenbetrag (mtl.)"
                          registration={form.register}
                          error={unitErrors?.serviceCharge?.message}
                          disabled={
                            watchedValues.units?.[index]?.ancillaryChargeType ===
                            "none"
                          }
                        />
                        <div className="space-y-2">
                          <Label>Nebenkostenart</Label>
                          <Select
                            value={
                              watchedValues.units?.[index]
                                ?.ancillaryChargeType ?? "advance"
                            }
                            onValueChange={(
                              value: "advance" | "flat_rate" | "none",
                            ) => {
                              form.setValue(
                                `units.${index}.ancillaryChargeType`,
                                value,
                                { shouldDirty: true, shouldValidate: true },
                              );
                              if (value === "none") {
                                form.setValue(
                                  `units.${index}.serviceCharge`,
                                  0,
                                  { shouldDirty: true },
                                );
                              }
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="advance">
                                Vorauszahlung
                              </SelectItem>
                              <SelectItem value="flat_rate">Pauschale</SelectItem>
                              <SelectItem value="none">Keine</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <MoneyField
                          id={`units.${index}.parkingRent`}
                          label="Stellplatzmiete (mtl.)"
                          registration={form.register}
                          error={unitErrors?.parkingRent?.message}
                        />
                        {propertyMode === "existing" ? (
                          <div className="space-y-2">
                            <Label>Mietstatus</Label>
                            <Select
                              value={status}
                              onValueChange={(
                                value: "occupied" | "vacant" | "renovation",
                              ) => {
                                form.setValue(`units.${index}.status`, value, {
                                  shouldDirty: true,
                                  shouldValidate: true,
                                });
                                if (value !== "occupied") {
                                  form.setValue(
                                    `units.${index}.leaseStart`,
                                    "",
                                    { shouldDirty: true },
                                  );
                                  form.setValue(
                                    `units.${index}.contractColdRent`,
                                    0,
                                    { shouldDirty: true },
                                  );
                                }
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="occupied">Vermietet</SelectItem>
                                <SelectItem value="vacant">Leerstand</SelectItem>
                                <SelectItem value="renovation">Sanierung</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        ) : (
                          <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground sm:col-span-2">
                            Das Szenario erzeugt kein echtes Mietverhältnis und
                            keine Mietforderung.
                          </div>
                        )}
                        {propertyMode === "existing" && status === "occupied" ? (
                          <div className="space-y-2">
                            <Label htmlFor={`units.${index}.leaseStart`}>
                              Mietbeginn
                            </Label>
                            <Input
                              id={`units.${index}.leaseStart`}
                              type="date"
                              aria-invalid={Boolean(unitErrors?.leaseStart)}
                              {...form.register(`units.${index}.leaseStart`)}
                            />
                            <FieldError message={unitErrors?.leaseStart?.message} />
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
                {supportsMultipleUnits ? (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={fields.length >= 100}
                    onClick={() =>
                      append({
                        unitNumber: nextOnboardingUnitNumber(
                          form.getValues("units"),
                        ),
                        floor: "",
                        area: 50,
                        rooms: 2,
                        contractColdRent: 0,
                        targetColdRent: 0,
                        serviceCharge: 0,
                        ancillaryChargeType: "advance",
                        parkingRent: 0,
                        leaseStart: "",
                        status:
                          propertyMode === "scenario" ? "vacant" : "occupied",
                      })
                    }
                  >
                    <Plus />
                    Weitere Einheit
                  </Button>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Mehrere Einheiten werden nur beim MFH geführt.
                  </p>
                )}
              </div>
            ) : null}

            {step === 3 ? (
              <div className="space-y-6">
                <div className="flex items-center justify-between rounded-xl border p-4">
                  <div>
                    <Label htmlFor="financing-enabled">
                      Aktuelles Darlehen hinterlegen
                    </Label>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Die Rate wird im Immobilien- und Gesamt-Cashflow
                      berücksichtigt. Restschuld ist kein Zinsaufwand.
                    </p>
                  </div>
                  <Switch
                    id="financing-enabled"
                    checked={watchedValues.financing?.enabled ?? false}
                    onCheckedChange={(checked) =>
                      form.setValue("financing.enabled", checked, {
                        shouldDirty: true,
                        shouldValidate: true,
                      })
                    }
                  />
                </div>
                {watchedValues.financing?.enabled ? (
                  <>
                    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                      <div className="space-y-2">
                        <Label>Finanzierungsart</Label>
                        <Select
                          value={
                            watchedValues.financing?.loanType ?? "annuity"
                          }
                          onValueChange={(
                            value: OnboardingInput["financing"]["loanType"],
                          ) =>
                            form.setValue("financing.loanType", value, {
                              shouldDirty: true,
                            })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="annuity">
                              Annuitätendarlehen
                            </SelectItem>
                            <SelectItem value="repayment">
                              Ratentilgungsdarlehen
                            </SelectItem>
                            <SelectItem value="interest_only">
                              Endfälliges Darlehen
                            </SelectItem>
                            <SelectItem value="variable">
                              Variables Darlehen
                            </SelectItem>
                            <SelectItem value="other">Sonstiges</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2 sm:col-span-2">
                        <Label htmlFor="financing.lenderName">
                          Darlehensgeber
                        </Label>
                        <Input
                          id="financing.lenderName"
                          aria-invalid={Boolean(
                            form.formState.errors.financing?.lenderName,
                          )}
                          {...form.register("financing.lenderName")}
                        />
                        <FieldError
                          message={
                            form.formState.errors.financing?.lenderName?.message
                          }
                        />
                      </div>
                      <MoneyField
                        id="financing.originalPrincipal"
                        label="Ursprüngliches Darlehen"
                        registration={form.register}
                        error={
                          form.formState.errors.financing?.originalPrincipal
                            ?.message
                        }
                      />
                      <MoneyField
                        id="financing.currentBalance"
                        label="Aktuelle Restschuld"
                        registration={form.register}
                        error={
                          form.formState.errors.financing?.currentBalance?.message
                        }
                      />
                      <MoneyField
                        id="financing.monthlyPayment"
                        label="Finanzierungsrate (mtl.)"
                        registration={form.register}
                        error={
                          form.formState.errors.financing?.monthlyPayment?.message
                        }
                      />
                      <PercentageField
                        id="financing.nominalInterestRate"
                        label="Sollzins (p. a.)"
                        registration={form.register}
                        error={
                          form.formState.errors.financing?.nominalInterestRate
                            ?.message
                        }
                      />
                      <PercentageField
                        id="financing.initialRepaymentRate"
                        label="Anfängliche Tilgung (p. a.)"
                        registration={form.register}
                        error={
                          form.formState.errors.financing?.initialRepaymentRate
                            ?.message
                        }
                        nullable
                      />
                      <div className="space-y-2">
                        <Label htmlFor="financing.disbursedOn">Auszahlung</Label>
                        <Input
                          id="financing.disbursedOn"
                          type="date"
                          {...form.register("financing.disbursedOn")}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="financing.fixedRateUntil">
                          Zinsbindung bis
                        </Label>
                        <Input
                          id="financing.fixedRateUntil"
                          type="date"
                          {...form.register("financing.fixedRateUntil")}
                        />
                        <FieldError
                          message={
                            form.formState.errors.financing?.fixedRateUntil
                              ?.message
                          }
                        />
                      </div>
                    </div>
                    <div className="grid gap-3 rounded-xl bg-muted/40 p-4 sm:grid-cols-3">
                      <SummaryValue
                        label="Rate (mtl.)"
                        value={currencyFormatter.format(
                          watchedValues.financing?.monthlyPayment ?? 0,
                        )}
                      />
                      <SummaryValue
                        label="Zinsanteil, erste Näherung (mtl.)"
                        value={formatCents(annualInterestCents / 12)}
                        hint="Restschuld × Sollzins ÷ 12"
                      />
                      <SummaryValue
                        label="Tilgungsanteil, erste Näherung (mtl.)"
                        value={currencyFormatter.format(
                          Math.max(
                            0,
                            (watchedValues.financing?.monthlyPayment ?? 0) -
                              annualInterestCents / 1200,
                          ),
                        )}
                        hint="Rate minus geschätzter Zinsanteil"
                      />
                    </div>
                  </>
                ) : (
                  <div className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">
                    Keine laufende Finanzierung. Du kannst später auf der
                    Immobilie jederzeit ein Darlehen ergänzen.
                  </div>
                )}
              </div>
            ) : null}

            {step === 4 ? (
              <div className="space-y-6">
                <div>
                  <Label>Steuerberechnung</Label>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {(
                      [
                        ["automatic", "Automatisch", "Tarif 2026 aus Einkünften"],
                        ["manual", "Manuell", "Nur effektiven Satz angeben"],
                      ] as const
                    ).map(([value, title, description]) => (
                      <button
                        type="button"
                        key={value}
                        onClick={() =>
                          form.setValue("tax.calculationMode", value, {
                            shouldDirty: true,
                            shouldValidate: true,
                          })
                        }
                        className={cn(
                          "rounded-xl border p-4 text-left transition-colors",
                          watchedValues.tax?.calculationMode === value
                            ? "border-primary bg-primary/5 ring-2 ring-primary/15"
                            : "hover:bg-muted/50",
                        )}
                      >
                        <p className="font-medium">{title}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {description}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>

                {watchedValues.tax?.calculationMode === "manual" ? (
                  <div className="max-w-sm">
                    <PercentageField
                      id="tax.manualEffectiveTaxRate"
                      label="Effektiver Steuersatz"
                      registration={form.register}
                      error={
                        form.formState.errors.tax?.manualEffectiveTaxRate
                          ?.message
                      }
                      nullable
                    />
                    <p className="mt-2 text-xs text-muted-foreground">
                      Ein manueller Grenzsteuersatz wird nicht abgefragt.
                    </p>
                  </div>
                ) : null}

                {watchedValues.tax?.calculationMode === "automatic" ? (
                  <div className="space-y-5">
                    <div className="grid gap-5 sm:grid-cols-2">
                      <MoneyField
                        id="tax.otherTaxableIncome"
                        label="Weitere steuerpflichtige Einkünfte (p. a.)"
                        registration={form.register}
                        error={
                          form.formState.errors.tax?.otherTaxableIncome?.message
                        }
                        nullable
                      />
                      <div className="space-y-2">
                        <Label>Veranlagung</Label>
                        <Select
                          value={watchedValues.tax?.filingStatus ?? "single"}
                          onValueChange={(value: "single" | "joint") =>
                            form.setValue("tax.filingStatus", value, {
                              shouldDirty: true,
                              shouldValidate: true,
                            })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="single">
                              Einzelveranlagung
                            </SelectItem>
                            <SelectItem value="joint">
                              Zusammenveranlagung (Splitting)
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          Beim Splitting wird der gemeinsame Tarif auf das halbe
                          Einkommen angewandt und anschließend verdoppelt.
                        </p>
                      </div>
                    </div>
                    <label className="flex items-start gap-3 rounded-xl border p-4 text-sm">
                      <Checkbox
                        className="mt-0.5"
                        checked={
                          watchedValues.tax?.rentalIncomeComplete ?? false
                        }
                        onCheckedChange={(checked) =>
                          form.setValue(
                            "tax.rentalIncomeComplete",
                            checked === true,
                            { shouldDirty: true, shouldValidate: true },
                          )
                        }
                      />
                      <span>
                        <span className="font-medium">
                          Alle Vertragsmieten sind vollständig erfasst.
                        </span>
                        <span className="mt-1 block text-muted-foreground">
                          Erst danach werden effektiver und Grenzsteuersatz
                          automatisch berechnet. Szenarien zählen nicht als
                          echte Mieteinnahmen.
                        </span>
                      </span>
                    </label>
                    <FieldError
                      message={
                        form.formState.errors.tax?.rentalIncomeComplete?.message
                      }
                    />
                    {automaticTaxEstimate ? (
                      <div className="grid gap-3 rounded-xl bg-muted/40 p-4 sm:grid-cols-2 lg:grid-cols-4">
                        <SummaryValue
                          label="Vermietungsergebnis (vorläufig, p. a.)"
                          value={formatCents(taxableRentalResultCents)}
                          hint="Vertragsmiete inkl. Nebenkosten-/Stellplatzeinnahmen minus AfA und geschätzte Zinsen; weitere Belege folgen später"
                        />
                        <SummaryValue
                          label="Effektiver Steuersatz"
                          value={formatRate(
                            automaticTaxEstimate.effectiveTaxRate,
                          )}
                        />
                        <SummaryValue
                          label="Berechneter Grenzsteuersatz"
                          value={formatRate(
                            automaticTaxEstimate.marginalTaxRate,
                          )}
                        />
                        <SummaryValue
                          label="Steuerwirkung Vermietung (p. a.)"
                          value={formatCents(
                            automaticTaxEstimate.estimatedRentalTaxEffectCents,
                          )}
                        />
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <div className="grid gap-3 sm:grid-cols-2">
                    <label className="flex items-center gap-3 rounded-xl border p-4 text-sm">
                      <Checkbox
                        checked={watchedValues.tax?.churchTax ?? false}
                        onCheckedChange={(checked) =>
                          form.setValue("tax.churchTax", checked === true, {
                            shouldDirty: true,
                          })
                        }
                      />
                      Kirchensteuer für die Detailrechnung vormerken
                    </label>
                    <label className="flex items-center gap-3 rounded-xl border p-4 text-sm">
                      <Checkbox
                        checked={
                          watchedValues.tax?.solidaritySurcharge ?? false
                        }
                        onCheckedChange={(checked) =>
                          form.setValue(
                            "tax.solidaritySurcharge",
                            checked === true,
                            { shouldDirty: true },
                          )
                        }
                      />
                      Solidaritätszuschlag für die Detailrechnung vormerken
                    </label>
                  </div>
                <p className="text-xs text-muted-foreground">
                  Unverbindliche Modellrechnung, keine Steuerberatung. Die
                  Tarifberechnung enthält noch keine individuellen Sonderfälle.
                </p>
              </div>
            ) : null}

            {step === 5 ? (
              <div className="space-y-6">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <SummaryValue
                    label="Modus"
                    value={
                      propertyMode === "existing"
                        ? "Bestandsimmobilie"
                        : "Fiktives Szenario"
                    }
                  />
                  <SummaryValue
                    label="Immobilie"
                    value={watchedValues.property?.name || "–"}
                    hint={`${fields.length} ${fields.length === 1 ? "Mietfläche" : "Einheiten"}`}
                  />
                  <SummaryValue
                    label={
                      propertyMode === "existing"
                        ? "IST-Kaltmiete (p. a.)"
                        : "Planmiete (p. a.)"
                    }
                    value={formatCents(
                      propertyMode === "existing"
                        ? annualContractRentCents
                        : annualTargetRentCents,
                    )}
                  />
                  <SummaryValue
                    label="Gebäudeanteil / AfA-Basis"
                    value={formatCents(acquisition?.buildingValueCents)}
                  />
                  <SummaryValue
                    label="Finanzierungsrate (mtl.)"
                    value={currencyFormatter.format(
                      watchedValues.financing?.enabled
                        ? (watchedValues.financing.monthlyPayment ?? 0)
                        : 0,
                    )}
                  />
                  <SummaryValue
                    label="AfA (p. a.)"
                    value={formatCents(calculatedDepreciationCents)}
                  />
                  <SummaryValue
                    label="Steuermodus"
                    value={
                      watchedValues.tax?.calculationMode === "automatic"
                        ? "Automatisch"
                        : "Manuell"
                    }
                  />
                  <SummaryValue
                    label="SOLL-Kaltmiete (p. a.)"
                    value={formatCents(annualTargetRentCents)}
                  />
                </div>
                <div className="rounded-xl border p-5">
                  <h3 className="font-medium">Was jetzt gespeichert wird</h3>
                  <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                    <li>• Kaufpreisaufteilung mit transparenter Herleitung</li>
                    <li>• Eindeutig getrennte Vertrags- und Markt-Kaltmieten</li>
                    <li>• Darlehen mit Rate, Zinsbindung, Zins und Tilgung</li>
                    <li>
                      • {propertyMode === "existing"
                        ? "Mietplan für die Bestandsimmobilie; Zahlungen bleiben separat"
                        : "Szenario ohne echte Forderung, Zahlung oder Ist-Vermögen"}
                    </li>
                  </ul>
                </div>
                <label className="flex items-start gap-3 rounded-xl border border-primary/30 bg-primary/5 p-5 text-sm">
                  <Checkbox
                    className="mt-0.5"
                    checked={watchedValues.confirmation ?? false}
                    onCheckedChange={(checked) =>
                      form.setValue("confirmation", checked === true, {
                        shouldDirty: true,
                        shouldValidate: true,
                      })
                    }
                  />
                  <span>
                    <span className="font-medium">
                      Ich habe die Zusammenfassung geprüft.
                    </span>
                    <span className="mt-1 block text-muted-foreground">
                      Mir ist bewusst, dass Marktwert, AfA und Steuerwerte
                      unverbindliche Schätzungen sind und später bearbeitet
                      werden können.
                    </span>
                  </span>
                </label>
                <FieldError
                  message={form.formState.errors.confirmation?.message}
                />
              </div>
            ) : null}
          </CardContent>
        </Card>

        <div className="mt-6 flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setStep((value) => Math.max(value - 1, 0))}
            disabled={step === 0 || pending}
          >
            <ArrowLeft />
            Zurück
          </Button>
          {step < steps.length - 1 ? (
            <Button type="button" onClick={nextStep} disabled={pending}>
              Weiter
              <ArrowRight />
            </Button>
          ) : (
            <Button type="submit" size="lg" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : <Check />}
              Estate Brain einrichten
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
