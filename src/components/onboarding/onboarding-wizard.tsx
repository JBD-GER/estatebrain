"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
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
  onboardingSchema,
  type OnboardingInput,
} from "@/lib/validation/onboarding";
import { completeOnboardingAction } from "@/app/onboarding/actions";
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
import { cn } from "@/lib/utils";

const storageKey = "estatebrain:onboarding:v1";

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
    unitCount: 1,
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
    "property.unitCount",
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

export function OnboardingWizard({ fullName }: { fullName: string | null }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [pending, startTransition] = useTransition();
  const [hydrated, setHydrated] = useState(false);
  const form = useForm<OnboardingInput>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: defaults,
    mode: "onBlur",
  });
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "units",
  });
  const watchedValues = useWatch({ control: form.control });

  useEffect(() => {
    let restoredValues: OnboardingInput | undefined;
    let restoredStep = 0;
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved) as {
          step?: number;
          values?: OnboardingInput;
        };
        restoredValues = parsed.values;
        if (typeof parsed.step === "number") {
          restoredStep = Math.min(
            Math.max(parsed.step, 0),
            steps.length - 1,
          );
        }
      }
    } catch {
      window.localStorage.removeItem(storageKey);
    }

    const restoreTimer = window.setTimeout(() => {
      if (restoredValues) form.reset(restoredValues);
      setStep(restoredStep);
      setHydrated(true);
    }, 0);

    return () => window.clearTimeout(restoreTimer);
  }, [form]);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({ step, values: watchedValues }),
    );
  }, [hydrated, step, watchedValues]);

  const progress = useMemo(
    () => ((step + 1) / steps.length) * 100,
    [step],
  );

  async function nextStep() {
    const valid = await form.trigger(stepFields[step] as never, {
      shouldFocus: true,
    });
    if (valid) setStep((value) => Math.min(value + 1, steps.length - 1));
  }

  function finish(values: OnboardingInput) {
    startTransition(async () => {
      const result = await completeOnboardingAction(values);
      if (!result.success) {
        toast.error(result.message);
        return;
      }
      window.localStorage.removeItem(storageKey);
      toast.success(result.message);
      router.replace("/app");
      router.refresh();
    });
  }

  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="mb-8">
        <p className="text-sm font-medium text-primary">
          Willkommen{fullName ? `, ${fullName.split(" ")[0]}` : ""}.
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
          Richten wir dein Portfolio ein
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

      <form onSubmit={form.handleSubmit(finish)}>
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
                    {...form.register("organization.taxYear", {
                      valueAsNumber: true,
                    })}
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
                        {...form.register("tax.marginalTaxRate", {
                          setValueAs: (value) =>
                            value === "" ? null : Number(value),
                        })}
                      />
                      <span className="absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
                        %
                      </span>
                    </div>
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
                        {...form.register("tax.effectiveTaxRate", {
                          setValueAs: (value) =>
                            value === "" ? null : Number(value),
                        })}
                      />
                      <span className="absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
                        %
                      </span>
                    </div>
                  </div>
                  <MoneyField
                    id="tax.taxableIncome"
                    label="Zu versteuerndes Einkommen (freiwillig)"
                    registration={form.register}
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
                    {...form.register("property.postalCode")}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="property.city">Ort</Label>
                  <Input id="property.city" {...form.register("property.city")} />
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
                />
                <MoneyField
                  id="property.acquisitionCosts"
                  label="Kaufnebenkosten"
                  registration={form.register}
                />
                <MoneyField
                  id="property.landValue"
                  label="Grundstücksanteil"
                  registration={form.register}
                />
                <MoneyField
                  id="property.buildingValue"
                  label="Gebäudeanteil"
                  registration={form.register}
                />
                <MoneyField
                  id="property.currentFinancing"
                  label="Aktuelle Finanzierung"
                  registration={form.register}
                />
                <MoneyField
                  id="property.marketValue"
                  label="Aktueller Marktwert"
                  registration={form.register}
                />
                <MoneyField
                  id="property.expectedMonthlyRent"
                  label="Erwartete Monatsmiete"
                  registration={form.register}
                />
                <div className="space-y-2">
                  <Label htmlFor="property.totalArea">Wohnfläche in m²</Label>
                  <Input
                    id="property.totalArea"
                    type="number"
                    min="0"
                    step="0.01"
                    {...form.register("property.totalArea", {
                      valueAsNumber: true,
                    })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="property.unitCount">Anzahl Einheiten</Label>
                  <Input
                    id="property.unitCount"
                    type="number"
                    min="1"
                    max="100"
                    {...form.register("property.unitCount", {
                      valueAsNumber: true,
                    })}
                  />
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
                          {...form.register(`units.${index}.unitNumber`)}
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
                          {...form.register(`units.${index}.area`, {
                            valueAsNumber: true,
                          })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`units.${index}.rooms`}>Zimmer</Label>
                        <Input
                          id={`units.${index}.rooms`}
                          type="number"
                          min="0.5"
                          step="0.5"
                          {...form.register(`units.${index}.rooms`, {
                            valueAsNumber: true,
                          })}
                        />
                      </div>
                      <MoneyField
                        id={`units.${index}.baseRent`}
                        label="Kaltmiete"
                        registration={form.register}
                      />
                      <MoneyField
                        id={`units.${index}.serviceCharge`}
                        label="Nebenkosten"
                        registration={form.register}
                      />
                      <MoneyField
                        id={`units.${index}.parkingRent`}
                        label="Stellplatzmiete"
                        registration={form.register}
                      />
                      <div className="space-y-2">
                        <Label>Mietstatus</Label>
                        <Select
                          value={
                            watchedValues.units?.[index]?.status ?? "occupied"
                          }
                          onValueChange={(
                            value: "occupied" | "vacant" | "renovation",
                          ) => form.setValue(`units.${index}.status`, value)}
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
                    </div>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    append({
                      unitNumber: `Wohnung ${fields.length + 1}`,
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
            <Button type="button" onClick={nextStep}>
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
