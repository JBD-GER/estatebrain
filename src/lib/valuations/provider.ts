import "server-only";
import { somanticRequestBody, valuationResponseSchema, type ValuationInput, type ValuationResponse } from "./somantic";

export class ValuationProviderError extends Error {
  constructor(message: string, public readonly retryable: boolean) { super(message); }
}

export async function requestSomanticValuation(input: ValuationInput): Promise<ValuationResponse> {
  const key = process.env.SOMANTIC_API_KEY;
  if (!key) throw new ValuationProviderError("Die Somantic-Verbindung ist noch nicht eingerichtet.", true);
  let response: Response;
  try {
    response = await fetch("https://www.somantic.net/api/estimate", {
      method: "POST", headers: { "Content-Type": "application/json", "X-API-Key": key },
      body: JSON.stringify(somanticRequestBody(input)), cache: "no-store", signal: AbortSignal.timeout(90000),
      redirect: "error",
    });
  } catch {
    // Somantic documents no idempotency key or status lookup. Never blindly resend.
    throw new ValuationProviderError("Somantic hat die Anfrage nicht rechtzeitig bestätigt. Zur Vermeidung einer doppelten Bewertung bleibt sie gesperrt. Bitte den Support zur Prüfung kontaktieren.", false);
  }
  if (!response.ok) {
    const messages: Record<number, string> = {
      400: "Somantic konnte die Objektdaten nicht verarbeiten. Bitte Adresse und Angaben prüfen.",
      402: "Das Somantic-Abonnement ist inaktiv. Bitte das Abonnement im Anbieter-Konto prüfen.",
      403: "Der Somantic-Zugang wurde abgelehnt. Bitte die API-Konfiguration prüfen lassen.",
      422: "Somantic hat einzelne Objektdaten abgelehnt. Bitte Adresse, Wohnfläche und optionale Angaben prüfen.",
      429: "Das Somantic-Kontingent oder Anfragelimit ist erreicht. Bitte später erneut versuchen.",
    };
    throw new ValuationProviderError(messages[response.status] ?? "Somantic meldet einen Fehler mit unklarem Verarbeitungsstand. Bitte den Support zur Prüfung kontaktieren.", [400, 402, 403, 422, 429].includes(response.status));
  }
  try { return valuationResponseSchema.parse(await response.json()); }
  catch { throw new ValuationProviderError("Die Antwort von Somantic ist unvollständig. Bitte den Support zur Prüfung kontaktieren; es wird keine zweite Bewertung ausgelöst.", false); }
}
