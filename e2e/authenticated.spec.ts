import { expect, test } from "@playwright/test";

const qaEmail = process.env.E2E_USER_EMAIL;
const qaPassword = process.env.E2E_USER_PASSWORD;

test("angemeldeter Eigentümer erreicht Dashboard und Kernmodule", async ({
  page,
}) => {
  test.skip(
    !qaEmail || !qaPassword,
    "Temporäre QA-Zugangsdaten sind nur im Release-Smoke-Test gesetzt.",
  );

  await page.goto("/login");
  await page.getByLabel("E-Mail-Adresse").fill(qaEmail!);
  await page.getByLabel("Passwort").fill(qaPassword!);
  await page.getByRole("button", { name: "Anmelden" }).click();

  await expect(page).toHaveURL(/\/app$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Portfolio-Cockpit" }),
  ).toBeVisible();

  for (const path of [
    "/app/mietverhaeltnisse",
    "/app/belege",
    "/app/kommunikation",
    "/app/berichte",
    "/app/einstellungen",
  ]) {
    await page.goto(path);
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await expect(page.locator("main h1")).toBeVisible();
    await expect(page.getByText("Application error")).toHaveCount(0);
  }

  await expect(
    page.getByRole("navigation", { name: "Einstellungsbereiche" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Kontolöschung" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Löschvorbereitung speichern" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Organisationslöschung vormerken",
    }),
  ).toBeVisible();
});
