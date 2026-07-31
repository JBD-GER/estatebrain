"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { CircleAlert, FileCheck2, Loader2, ShieldCheck, Upload } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { DOCUMENT_ACCEPT, DOCUMENT_MAX_BYTES } from "@/lib/documents/constants";

type PropertyOption = {
  id: string;
  name: string;
};

type UnitOption = {
  id: string;
  propertyId: string;
  name: string;
};

type LeaseOption = {
  id: string;
  unitId: string;
  startsOn: string;
  endsOn: string | null;
  status: string;
};

const documentTypes = [
  ["invoice", "Rechnung"],
  ["receipt", "Beleg"],
  ["contract", "Vertrag"],
  ["lease", "Mietvertrag"],
  ["bank_statement", "Kontoauszug"],
  ["tax", "Steuerunterlage"],
  ["insurance", "Versicherung"],
  ["handover", "Übergabeprotokoll"],
  ["correspondence", "Korrespondenz"],
  ["other", "Sonstiges"],
] as const;

export function DocumentUploadForm({
  properties,
  units,
  leases,
  defaultPropertyId,
}: {
  properties: PropertyOption[];
  units: UnitOption[];
  leases: LeaseOption[];
  defaultPropertyId?: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tenantVisible, setTenantVisible] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [propertyId, setPropertyId] = useState(defaultPropertyId ?? "");
  const [unitId, setUnitId] = useState("");
  const [leaseId, setLeaseId] = useState("");
  const availableUnits = useMemo(
    () => units.filter((unit) => unit.propertyId === propertyId),
    [propertyId, units],
  );
  const availableLeases = useMemo(
    () => leases.filter((lease) => lease.unitId === unitId),
    [leases, unitId],
  );

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!selectedFile) {
      setError("Bitte eine Datei auswählen.");
      return;
    }
    if (selectedFile.size > DOCUMENT_MAX_BYTES) {
      setError("Die Datei ist größer als 10 MB.");
      return;
    }

    setPending(true);
    try {
      const response = await fetch("/api/documents/upload", {
        method: "POST",
        body: new FormData(event.currentTarget),
      });
      const payload = (await response.json()) as {
        error?: string;
        document?: { id: string };
      };
      if (!response.ok) {
        setError(payload.error ?? "Der Upload ist fehlgeschlagen.");
        return;
      }

      toast.success("Dokument sicher hochgeladen.");
      formRef.current?.reset();
      setSelectedFile(null);
      setTenantVisible(false);
      setPropertyId("");
      setUnitId("");
      setLeaseId("");
      router.push(`/app/belege?uploaded=${payload.document?.id ?? ""}`);
      router.refresh();
    } catch {
      setError("Der Upload konnte nicht abgeschlossen werden.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <Card>
        <CardHeader>
          <CardTitle>Dokument auswählen</CardTitle>
          <CardDescription>
            Pflichtangaben und Dateiinhalte werden serverseitig validiert.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form ref={formRef} onSubmit={submit} className="space-y-5">
            {error ? (
              <Alert variant="destructive">
                <CircleAlert />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="file">Datei *</Label>
              <Input
                id="file"
                name="file"
                type="file"
                accept={DOCUMENT_ACCEPT}
                required
                disabled={pending}
                onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
              />
              <p className="text-xs text-muted-foreground">
                PDF, JPEG, PNG oder WebP · maximal 10 MB
              </p>
              {selectedFile ? (
                <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-sm">
                  <FileCheck2 className="size-4 text-primary" />
                  <span className="min-w-0 truncate">{selectedFile.name}</span>
                  <span className="ml-auto shrink-0 text-muted-foreground">
                    {(selectedFile.size / 1024 / 1024).toLocaleString("de-DE", {
                      maximumFractionDigits: 2,
                    })}{" "}
                    MB
                  </span>
                </div>
              ) : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="documentType">Dokumenttyp *</Label>
                <select
                  id="documentType"
                  name="documentType"
                  required
                  defaultValue="invoice"
                  disabled={pending}
                  className="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs outline-none focus-visible:ring-2"
                >
                  {documentTypes.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="documentDate">Dokumentdatum</Label>
                <Input
                  id="documentDate"
                  name="documentDate"
                  type="date"
                  disabled={pending}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Titel</Label>
              <Input
                id="title"
                name="title"
                maxLength={160}
                placeholder="z. B. Heizungswartung Juli"
                disabled={pending}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="propertyId">Immobilie</Label>
              <select
                id="propertyId"
                name="propertyId"
                value={propertyId}
                disabled={pending}
                onChange={(event) => {
                  setPropertyId(event.target.value);
                  setUnitId("");
                  setLeaseId("");
                  setTenantVisible(false);
                }}
                className="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs outline-none focus-visible:ring-2"
              >
                <option value="">Keine Zuordnung</option>
                {properties.map((property) => (
                  <option key={property.id} value={property.id}>
                    {property.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="unitId">Einheit</Label>
                <select
                  id="unitId"
                  name="unitId"
                  value={unitId}
                  disabled={pending || !propertyId}
                  onChange={(event) => {
                    setUnitId(event.target.value);
                    setLeaseId("");
                    setTenantVisible(false);
                  }}
                  className="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs outline-none disabled:cursor-not-allowed disabled:opacity-50 focus-visible:ring-2"
                >
                  <option value="">Keine Einheit</option>
                  {availableUnits.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="leaseId">Mietverhältnis</Label>
                <select
                  id="leaseId"
                  name="leaseId"
                  value={leaseId}
                  disabled={pending || !unitId}
                  onChange={(event) => {
                    setLeaseId(event.target.value);
                    if (!event.target.value) setTenantVisible(false);
                  }}
                  className="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs outline-none disabled:cursor-not-allowed disabled:opacity-50 focus-visible:ring-2"
                >
                  <option value="">Kein Mietverhältnis</option>
                  {availableLeases.map((lease) => (
                    <option key={lease.id} value={lease.id}>
                      {new Intl.DateTimeFormat("de-DE").format(
                        new Date(lease.startsOn),
                      )}
                      {" – "}
                      {lease.endsOn
                        ? new Intl.DateTimeFormat("de-DE").format(
                            new Date(lease.endsOn),
                          )
                        : "offen"}
                      {` · ${lease.status}`}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
              <div>
                <Label htmlFor="tenantVisible">Im Mieterportal sichtbar</Label>
                <p className="mt-1 text-xs text-muted-foreground">
                  Erst mit einem konkreten Mietverhältnis freigebbar.
                </p>
              </div>
              <input
                type="hidden"
                name="tenantVisible"
                value={tenantVisible ? "true" : "false"}
              />
              <Switch
                id="tenantVisible"
                checked={tenantVisible}
                onCheckedChange={setTenantVisible}
                disabled={pending || !leaseId}
                aria-label="Dokument im Mieterportal sichtbar machen"
              />
            </div>

            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : <Upload />}
              {pending ? "Wird sicher hochgeladen …" : "Sicher hochladen"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="h-fit">
        <CardHeader>
          <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <ShieldCheck className="size-5" />
          </div>
          <CardTitle>Sicher abgelegt</CardTitle>
          <CardDescription>
            Dokumente liegen in einem privaten Speicherbereich.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>Der echte Dateityp wird zusätzlich anhand des Inhalts geprüft.</p>
          <p>Dateipfade enthalten keine Kundendaten, sondern nur zufällige UUIDs.</p>
          <p>Downloads erhalten eine kurzlebige, signierte URL nach erneuter Zugriffsprüfung.</p>
        </CardContent>
      </Card>
    </div>
  );
}
