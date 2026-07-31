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
  Check,
  Database,
  Euro,
  Landmark,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  nextOnboardingUnitNumber,
  onboardingSchema,
  type OnboardingInput,
} from "@/lib/validation/onboarding";
import {
  completeEmptyOnboardingAction,
  completeOnboardingAction,
  type OnboardingResult,
} from "@/app/onboarding/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  legacyOnboardingDraftKey,
  onboardingDraftKey,
  onboardingDraftVersion,
  parseOnboardingDraft,
} from "@/lib/onboarding/draft";
import { cn } from "@/lib/utils";

const steps = [
  { title: "Organisation", icon: Landmark },
  { title: "Steuerannahmen", icon: Euro },
  { title: "Erste Immobilie", icon: Building2 },
  { title: "Einheiten", icon: Building2 },
  { title: "Daten & Start", icon: Database },
];

const currentYear = new Date().getFullYear();

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
  tax: {
    calculationsEnabled: true,
    marginalTaxRate: 30,
    effectiveTaxRate: null,
    churchTax: false,
    solidaritySurcharge: false,
    taxableIncome: null,
    filingStatus: "single",
  },
  property: {
    name: "",
    street: "",
    postalCode: "",
    city: "",
    propertyType: "apartment_building",
    purchaseDate: "",
    purchasePrice: 0,
    acquisitionCosts: 0,
    landValue: 0,
    buildingValue: 0,
    totalArea: 0,
    currentFinancing: 0,
    marketValue: 0,
    expectedMonthlyRent: 0,
  },
  units: [
    {
      unitNumber: "Wohnung 1",
      floor: "",
      area: 50,
      rooms: 2,
      baseRent: 0,
      serviceCharge: 0,
      parkingRent: 0,
      leaseStart: "",
      status: "occupied",
    },
  ],
  importMode: "none",
};

const stepFields: Array<Array<keyof OnboardingInput | `organization.${string}` | `tax.${string}` | `property.${string}` | `units.${number}.${string}`>> = [
  [
    "organization.name",
    "organization.organizationType",
    "organization.street",
    "organization.postalCode",
    "organization.city",
    "organization.taxYear",
  ],
  [
    "tax.calculationsEnabled",
    "tax.marginalTaxRate",
    "tax.effectiveTaxRate",
    "tax.taxableIncome",
    "tax.filingStatus",
  ],
  [
    "property.name",
    "property.street",
    "property.postalCode",
    "property.city",
    "property.propertyType",
    "property.purchasePrice",
    "property.totalArea",
  ],
  ["units"],
  ["importMode"],
];

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
          step="0.01"
          className="pr-10"
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

  useEffect(() => {
    let restoredDraft: ReturnType<typeof parseOnboardingDraft> = null;
    try {
      window.localStorage.removeItem(legacyOnboardingDraftKey);
      restoredDraft = parseOnboardingDraft(
        window.localStorage.getItem(storageKey),
        steps.length,
      );
      if (!restoredDraft) {
        window.localStorage.removeItem(storageKey);
      }
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
      // The wizard remains usable even when persistent browser storage is off.
    }
  }, [hydrated, step, storageKey, watchedValues]);

  const progress = ((step + 1) / steps.length) * 100;

  async function nextStep() {
    const valid = await form.trigger(stepFields[step] as never, {
      shouldFocus: true,
    });
    if (valid) setStep((value) => Math.min(value + 1, steps.length - 1));
  }

  function handleSuccess(
    result: OnboardingResult,
    clearDraft = true,
  ) {
    if (!result.success) {
      toast.error(result.message);
      return;
    }
    if (clearDraft) {
      try {
        window.localStorage.removeItem(storageKey);
      } catch {
        // A completed setup must not depend on browser storage access.
      }
    }
    toast.success(result.message);
    router.replace("/app");
    router.refresh();
  }

  function finish(values: OnboardingInput) {
    startTransition(async () => {
      const result = await completeOnboardingAction(values);
      handleSuccess(result);
    });
  }

  async function startEmpty() {
    const valid = await form.trigger(stepFields[0] as never, {
      shouldFocus: true,
    });
    if (!valid) return;

    const values = form.getValues();
    startTransition(async () => {
      const result = await completeEmptyOnboardingAction({
        organization: values.organization,
        tax: values.tax,
      });
      handleSuccess(result, false);
    });
  }

  function handleInvalid(errors: FieldErrors<OnboardingInput>) {
    const invalidStep = errors.organization
      ? 0
      : errors.tax
        ? 1
        : errors.property
          ? 2
          : errors.units
            ? 3
            : 4;
    setStep(invalidStep);
    toast.error("Bitte prüfe die markierten Angaben.");
  }

  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="mb-8">
        <p className="text-sm font-medium text-primary">
          Willkommen{fullName ? `, ${fullName.split(" ")[0]}` : ""}.
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
          {resumeMode
            ? "Setzen wir deine Portfolio-Einrichtung fort"
            : "Richten wir dein Portfolio ein"}
        </h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Du kannst alle Angaben später ändern. Steuerwerte sind ausschließlich
          optionale Annahmen für unverbindliche Modellrechnungen.
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
        <ol className="mt-4 hidden grid-cols-5 gap-2 md:grid">
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
                  "grid size-6 place-items-center rounded-full border",
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
                    placeholder="z. B. Immobilienverwaltung Mustermann"
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
                      form.setValue("organization.organizationType", value)
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
                    aria-invalid={Boolean(
                      form.formState.errors.organization?.street,
                    )}
                    {...form.register("organization.street")}
                  />
                  <FieldError
                    message={form.formState.errors.organization?.street?.message}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="organization.postalCode">Postleitzahl</Label>
                  <Input
                    id="organization.postalCode"
                    autoComplete="postal-code"
                    aria-invalid={Boolean(
                      form.formState.errors.organization?.postalCode,
                    )}
                    {...form.register("organization.postalCode")}
                  />
                  <FieldError
                    message={
                      form.formState.errors.organization?.postalCode?.message
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="organization.city">Ort</Label>
                  <Input
                    id="organization.city"
                    autoComplete="address-level2"
                    aria-invalid={Boolean(
                      form.formState.errors.organization?.city,
                    )}
                    {...form.register("organization.city")}
                  />
                  <FieldError
                    message={form.formState.errors.organization?.city?.message}
                  />
                </div>
                {!resumeMode ? (
                  <div className="flex flex-col gap-4 rounded-xl border border-dashed p-4 sm:col-span-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium">Noch keine Immobiliendaten?</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Lege nur die Organisation an und starte mit einem
                        vollständig leeren Dashboard. Die geführte Einrichtung
                        kannst du dort jederzeit fortsetzen.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={startEmpty}
                      disabled={pending}
                    >
                      {pending ? (
                        <Loader2 className="animate-spin" aria-hidden="true" />
                      ) : (
                        <ArrowRight aria-hidden="true" />
                      )}
                      Leer starten
                    </Button>
                  </div>
                ) : null}
              </div>
            ) : null}

            {step === 1 ? (
              <div className="space-y-6">
                <div className="flex items-center justify-between rounded-xl border p-4">
                  <div>
                    <Label htmlFor="tax-enabled">
                      Steuerliche Modellrechnung aktivieren
                    </Label>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Alle Annahmen bleiben editierbar und unverbindlich.
                    </p>
                  </div>
                  <Switch
                    id="tax-enabled"
                    checked={watchedValues.tax?.calculationsEnabled ?? true}
                    onCheckedChange={(checked) =>
                      form.setValue("tax.calculationsEnabled", checked)
                    }
                  />
                </div>
                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="tax.marginalTaxRate">
                      Grenzsteuersatz
                    </Label>
                    <div className="relative">
                      <Input
                        id="tax.marginalTaxRate"
                        type="number"
                        min="0"
                        max="60"
                        step="0.1"
                        className="pr-10"
                        aria-invalid={Boolean(
                          form.formState.errors.tax?.marginalTaxRate,
                        )}
                        {...form.register("tax.marginalTaxRate", {
                          setValueAs: (value) =>
                            value === "" ? null : Number(value),
                        })}
                      />
                      <span className="absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
                        %
                      </span>
                    </div>
                    <FieldError
                      message={
                        form.formState.errors.tax?.marginalTaxRate?.message
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tax.effectiveTaxRate">
                      Effektiver Steuersatz (alternativ)
                    </Label>
                    <div className="relative">
                      <Input
                        id="tax.effectiveTaxRate"
                        type="number"
                        min="0"
                        max="60"
                        step="0.1"
                        className="pr-10"
                        aria-invalid={Boolean(
                          form.formState.errors.tax?.effectiveTaxRate,
                        )}
                        {...form.register("tax.effectiveTaxRate", {
                          setValueAs: (value) =>
                            value === "" ? null : Number(value),
                        })}
                      />
                      <span className="absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
                        %
                      </span>
                    </div>
                    <FieldError
                      message={
                        form.formState.errors.tax?.effectiveTaxRate?.message
                      }
                    />
                  </div>
                  <MoneyField
                    id="tax.taxableIncome"
                    label="Zu versteuerndes Einkommen (freiwillig)"
                    registration={form.register}
                    error={form.formState.errors.tax?.taxableIncome?.message}
                    nullable
                  />
                  <div className="space-y-2">
                    <Label>Betrachtung</Label>
                    <Select
                      value={watchedValues.tax?.filingStatus ?? "single"}
                      onValueChange={(value: "single" | "joint") =>
                        form.setValue("tax.filingStatus", value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="single">Einzeln</SelectItem>
                        <SelectItem value="joint">Gemeinsam</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="flex items-center gap-3 rounded-xl border p-4 text-sm">
                    <Checkbox
                      checked={watchedValues.tax?.churchTax ?? false}
                      onCheckedChange={(checked) =>
                        form.setValue("tax.churchTax", checked === true)
                      }
                    />
                    Kirchensteuer berücksichtigen
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
                        )
                      }
                    />
                    Solidaritätszuschlag berücksichtigen
                  </label>
                </div>
              </div>
            ) : null}

            {step === 2 ? (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-2 sm:col-span-2 lg:col-span-2">
                  <Label htmlFor="property.name">Bezeichnung</Label>
                  <Input
                    id="property.name"
                    placeholder="z. B. Mehrfamilienhaus Lindenstraße"
                    aria-invalid={Boolean(
                      form.formState.errors.property?.name,
                    )}
                    {...form.register("property.name")}
                  />
                  <FieldError
                    message={form.formState.errors.property?.name?.message}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Immobilientyp</Label>
                  <Select
                    value={
                      watchedValues.property?.propertyType ??
                      "apartment_building"
                    }
                    onValueChange={(value: OnboardingInput["property"]["propertyType"]) =>
                      form.setValue("property.propertyType", value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="apartment_building">
                        Mehrfamilienhaus
                      </SelectItem>
                      <SelectItem value="condominium">
                        Eigentumswohnung
                      </SelectItem>
                      <SelectItem value="single_family">
                        Einfamilienhaus
                      </SelectItem>
                      <SelectItem value="mixed_use">
                        Gemischt genutzt
                      </SelectItem>
                      <SelectItem value="commercial">Gewerbe</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="property.street">Straße und Hausnummer</Label>
                  <Input
                    id="property.street"
                    aria-invalid={Boolean(
                      form.formState.errors.property?.street,
                    )}
                    {...form.register("property.street")}
                  />
                  <FieldError
                    message={form.formState.errors.property?.street?.message}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="property.postalCode">Postleitzahl</Label>
                  <Input
                    id="property.postalCode"
                    aria-invalid={Boolean(
                      form.formState.errors.property?.postalCode,
                    )}
                    {...form.register("property.postalCode")}
                  />
                  <FieldError
                    message={
                      form.formState.errors.property?.postalCode?.message
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="property.city">Ort</Label>
                  <Input
                    id="property.city"
                    aria-invalid={Boolean(
                      form.formState.errors.property?.city,
                    )}
                    {...form.register("property.city")}
                  />
                  <FieldError
                    message={form.formState.errors.property?.city?.message}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="property.purchaseDate">Kaufdatum</Label>
                  <Input
                    id="property.purchaseDate"
                    type="date"
                    {...form.register("property.purchaseDate")}
                  />
                </div>
                <MoneyField
                  id="property.purchasePrice"
                  label="Kaufpreis"
                  registration={form.register}
                  error={
                    form.formState.errors.property?.purchasePrice?.message
                  }
                />
                <MoneyField
                  id="property.acquisitionCosts"
                  label="Kaufnebenkosten"
                  registration={form.register}
                  error={
                    form.formState.errors.property?.acquisitionCosts?.message
                  }
                />
                <MoneyField
                  id="property.landValue"
                  label="Grundstücksanteil"
                  registration={form.register}
                  error={form.formState.errors.property?.landValue?.message}
                />
                <MoneyField
                  id="property.buildingValue"
                  label="Gebäudeanteil"
                  registration={form.register}
                  error={form.formState.errors.property?.buildingValue?.message}
                />
                <MoneyField
                  id="property.currentFinancing"
                  label="Aktuelle Finanzierung"
                  registration={form.register}
                  error={
                    form.formState.errors.property?.currentFinancing?.message
                  }
                />
                <MoneyField
                  id="property.marketValue"
                  label="Aktueller Marktwert"
                  registration={form.register}
                  error={form.formState.errors.property?.marketValue?.message}
                />
                <MoneyField
                  id="property.expectedMonthlyRent"
                  label="Erwartete Monatsmiete"
                  registration={form.register}
                  error={
                    form.formState.errors.property?.expectedMonthlyRent?.message
                  }
                />
                <div className="space-y-2">
                  <Label htmlFor="property.totalArea">Wohnfläche in m²</Label>
                  <Input
                    id="property.totalArea"
                    type="number"
                    min="0"
                    step="0.01"
                    aria-invalid={Boolean(
                      form.formState.errors.property?.totalArea,
                    )}
                    {...form.register("property.totalArea", {
                      valueAsNumber: true,
                    })}
                  />
                  <FieldError
                    message={form.formState.errors.property?.totalArea?.message}
                  />
                </div>
                <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                  Die Anzahl der Einheiten wird im nächsten Schritt automatisch
                  aus deinen angelegten Einheiten übernommen.
                </div>
              </div>
            ) : null}

            {step === 3 ? (
              <div className="space-y-5">
                {fields.map((field, index) => (
                  <div className="rounded-xl border p-4" key={field.id}>
                    <div className="mb-4 flex items-center justify-between">
                      <p className="font-medium">Einheit {index + 1}</p>
                      {fields.length > 1 ? (
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
                          aria-invalid={Boolean(
                            form.formState.errors.units?.[index]?.unitNumber,
                          )}
                          {...form.register(`units.${index}.unitNumber`)}
                        />
                        <FieldError
                          message={
                            form.formState.errors.units?.[index]?.unitNumber
                              ?.message
                          }
                        />
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
                          Wohnfläche m²
                        </Label>
                        <Input
                          id={`units.${index}.area`}
                          type="number"
                          min="0.1"
                          step="0.01"
                          aria-invalid={Boolean(
                            form.formState.errors.units?.[index]?.area,
                          )}
                          {...form.register(`units.${index}.area`, {
                            valueAsNumber: true,
                          })}
                        />
                        <FieldError
                          message={
                            form.formState.errors.units?.[index]?.area?.message
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`units.${index}.rooms`}>Zimmer</Label>
                        <Input
                          id={`units.${index}.rooms`}
                          type="number"
                          min="0.5"
                          step="0.5"
                          aria-invalid={Boolean(
                            form.formState.errors.units?.[index]?.rooms,
                          )}
                          {...form.register(`units.${index}.rooms`, {
                            valueAsNumber: true,
                          })}
                        />
                        <FieldError
                          message={
                            form.formState.errors.units?.[index]?.rooms?.message
                          }
                        />
                      </div>
                      <MoneyField
                        id={`units.${index}.baseRent`}
                        label="Kaltmiete"
                        registration={form.register}
                        error={
                          form.formState.errors.units?.[index]?.baseRent?.message
                        }
                      />
                      <MoneyField
                        id={`units.${index}.serviceCharge`}
                        label="Nebenkosten"
                        registration={form.register}
                        error={
                          form.formState.errors.units?.[index]?.serviceCharge
                            ?.message
                        }
                      />
                      <MoneyField
                        id={`units.${index}.parkingRent`}
                        label="Stellplatzmiete"
                        registration={form.register}
                        error={
                          form.formState.errors.units?.[index]?.parkingRent
                            ?.message
                        }
                      />
                      <div className="space-y-2">
                        <Label htmlFor={`units.${index}.status`}>
                          Mietstatus
                        </Label>
                        <Select
                          value={
                            watchedValues.units?.[index]?.status ?? "occupied"
                          }
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
                                {
                                  shouldDirty: true,
                                  shouldValidate: true,
                                },
                              );
                            }
                          }}
                        >
                          <SelectTrigger id={`units.${index}.status`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="occupied">Vermietet</SelectItem>
                            <SelectItem value="vacant">Leerstand</SelectItem>
                            <SelectItem value="renovation">Sanierung</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {watchedValues.units?.[index]?.status === "occupied" ? (
                        <div className="space-y-2">
                          <Label htmlFor={`units.${index}.leaseStart`}>
                            Mietbeginn
                          </Label>
                          <Input
                            id={`units.${index}.leaseStart`}
                            type="date"
                            required
                            aria-invalid={Boolean(
                              form.formState.errors.units?.[index]?.leaseStart,
                            )}
                            {...form.register(`units.${index}.leaseStart`)}
                          />
                          <FieldError
                            message={
                              form.formState.errors.units?.[index]?.leaseStart
                                ?.message
                            }
                          />
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
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
                      baseRent: 0,
                      serviceCharge: 0,
                      parkingRent: 0,
                      leaseStart: "",
                      status: "occupied",
                    })
                  }
                >
                  <Plus />
                  Weitere Einheit
                </Button>
              </div>
            ) : null}

            {step === 4 ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => form.setValue("importMode", "none")}
                  className={cn(
                    "rounded-xl border p-5 text-left transition-colors",
                    watchedValues.importMode === "none"
                      ? "border-primary bg-primary/5 ring-2 ring-primary/15"
                      : "hover:bg-muted/50",
                  )}
                >
                  <Database className="size-6 text-primary" />
                  <p className="mt-4 font-medium">Mit eigenen Daten starten</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    CSV-Import, weitere Belege und Bankverbindungen kannst du
                    später in Ruhe ergänzen.
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => form.setValue("importMode", "demo")}
                  className={cn(
                    "rounded-xl border p-5 text-left transition-colors",
                    watchedValues.importMode === "demo"
                      ? "border-primary bg-primary/5 ring-2 ring-primary/15"
                      : "hover:bg-muted/50",
                  )}
                >
                  <Building2 className="size-6 text-primary" />
                  <p className="mt-4 font-medium">
                    Mit gekennzeichneten Beispieldaten
                  </p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    Ergänzt dein Portfolio um Demo-Zahlungen, Belege,
                    Finanzierungen, Aufgaben und Nachrichten.
                  </p>
                </button>
                <div className="rounded-xl border border-dashed p-5 sm:col-span-2">
                  <p className="font-medium">Weitere Importmöglichkeiten</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    CSV-Import, Rechnungsupload und Open-Banking-Einrichtung
                    stehen anschließend in Integrationen und Belege bereit.
                  </p>
                </div>
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
            <Button
              type="button"
              onClick={nextStep}
              disabled={pending}
            >
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
