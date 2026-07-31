import { expect, test } from "@playwright/test";

test("Landingpage führt zu Registrierung und Demo", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Deine Immobilien. Deine Zahlen. Ein klarer Überblick.",
    }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Kostenlos starten" }).first()).toHaveAttribute(
    "href",
    "/registrieren",
  );
  await expect(page.getByRole("link", { name: "Demo ansehen" }).first()).toHaveAttribute(
    "href",
    "/demo",
  );
});

test("öffentliche Demo zeigt ausschließlich den gekennzeichneten Demo-Modus", async ({
  page,
}) => {
  await page.goto("/demo");
  await expect(page.getByText("Demo-Modus", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 1, name: "Portfolio-Cockpit" }),
  ).toBeVisible();
  await expect(page.getByText("Erfasster Portfoliowert")).toBeVisible();
  await expect(page.locator("main svg").first()).toBeVisible();
});

test("geschütztes Dashboard leitet zur Anmeldung weiter", async ({ page }) => {
  await page.goto("/app");
  await expect(page).toHaveURL(/\/login\?next=%2Fapp$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Bei Estate Brain anmelden" }),
  ).toBeVisible();
});

test("persönliche Kontoeinstellungen sind ohne Sitzung geschützt", async ({
  page,
}) => {
  await page.goto("/konto/einstellungen");
  await expect(page).toHaveURL(
    /\/login\?next=%2Fkonto%2Feinstellungen$/,
  );
});

test("Login bietet alle Wiederherstellungswege", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByLabel("E-Mail-Adresse")).toBeVisible();
  await expect(page.getByLabel("Passwort")).toBeVisible();
  await expect(page.getByRole("button", { name: "Anmelden" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Passwort vergessen?" })).toHaveAttribute(
    "href",
    "/passwort-vergessen",
  );
});

test("abgelaufene Bestätigung wird auf der Loginseite erklärt", async ({
  page,
}) => {
  await page.goto("/login?error=confirm");
  await expect(
    page.getByText(
      "Der Bestätigungslink ist abgelaufen oder ungültig. Bitte versuche die Registrierung erneut.",
    ),
  ).toBeVisible();
});
