type AuthFailure = {
  code?: string;
  status?: number;
} | null;

const genericRegistrationError =
  "Die Registrierung konnte nicht abgeschlossen werden. Bitte versuche es erneut.";

export function registrationErrorMessage(error: AuthFailure) {
  switch (error?.code) {
    case "user_already_exists":
    case "email_exists":
      return "Für diese E-Mail-Adresse besteht bereits ein Konto.";
    case "over_email_send_rate_limit":
      return "Das Versandlimit für Bestätigungs-E-Mails ist gerade erreicht. Bitte versuche es später erneut.";
    case "over_request_rate_limit":
      return "Es gab zu viele Registrierungsversuche. Bitte warte kurz und versuche es dann erneut.";
    case "weak_password":
      return "Das Passwort ist nicht sicher genug. Verwende bitte ein längeres, schwerer zu erratendes Passwort.";
    case "email_address_invalid":
      return "Bitte gib eine gültige E-Mail-Adresse ein.";
    case "signup_disabled":
    case "email_provider_disabled":
      return "Neue Registrierungen sind momentan nicht verfügbar. Bitte wende dich an den Support.";
    default:
      return error?.status === 429
        ? "Es gab zu viele Registrierungsversuche. Bitte warte kurz und versuche es dann erneut."
        : genericRegistrationError;
  }
}

export function loginPageErrorMessage(errorCode?: string) {
  switch (errorCode) {
    case "confirm":
    case "confirmation_failed":
      return "Der Bestätigungslink ist abgelaufen oder ungültig. Bitte versuche die Registrierung erneut.";
    default:
      return null;
  }
}
