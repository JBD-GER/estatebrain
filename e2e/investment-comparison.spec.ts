import { expect, test } from "@playwright/test";

const qaEmail = process.env.E2E_USER_EMAIL;
const qaPassword = process.env.E2E_USER_PASSWORD;

test.describe("Steuervergleich im angemeldeten Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!qaEmail || !qaPassword, "Nur mit temporären QA-Zugangsdaten ausführen.");
    await page.goto("/login?next=%2Fapp");
    await page.getByLabel("E-Mail-Adresse").fill(qaEmail!);
    await page.getByLabel("Passwort", { exact: true }).fill(qaPassword!);
    await page.getByRole("button", { name: "Anmelden", exact: true }).click();
    await expect(page).toHaveURL(/\/app$/);
    await expect(page.getByRole("heading", { name: "Dein Steuer-Dashboard." })).toBeVisible();
  });

test("AfA-Basis, Monatsanteil und Live-Neuberechnung bleiben nachvollziehbar", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await expect(page.getByTestId("total-tax-saving")).toHaveText(/64\.865/);
  await page.getByRole("tab", { name: "Rechenweg" }).click();
  await expect(page.getByRole("tabpanel")).toContainText("396.000,00");
  await page.getByRole("spinbutton", { name: /Kaufpreis gesamt/ }).fill("500000");
  await expect(page.getByRole("tabpanel")).toContainText("436.000,00");
  await page.getByRole("tab", { name: "Jahr für Jahr" }).click();
  const first = page.locator("tbody tr").first();
  await expect(first).toContainText("2026");
  await expect(first).toContainText("6/12 Monate");
  await expect(first).toContainText("4.360,00");
  await expect(first).toContainText("1.831,20");
  expect(errors).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
});

test("degressive AfA setzt bestätigte und passende Neubauangaben voraus", async ({ page }) => {
  await page.getByRole("button", { name: "Neubau", exact: true }).click();
  await page.getByLabel("Fertigstellung Gebäude", { exact: true }).fill("2026-03-01");
  await page.getByLabel("Notarieller Kaufvertrag", { exact: false }).fill("2025-12-01");
  const model = page.getByRole("combobox", { name: "Abschreibungsmodell wählen" });
  await expect(model.locator("option")).toHaveCount(1);
  await page.getByRole("checkbox", { name: /Wohngebäude in EU/ }).check();
  await expect(model.locator('option[value="degressive"]')).toBeAttached();
  await model.selectOption("degressive");
  await page.getByRole("tab", { name: "Jahr für Jahr" }).click();
  await expect(page.locator("tbody tr").first()).toContainText("9.900,00");
  await page.getByRole("checkbox", { name: /Wohngebäude in EU/ }).uncheck();
  await expect(model.locator('option[value="degressive"]')).toHaveCount(0);
});

test("Denkmal trennt begünstigte Kosten und Eigennutzung korrekt", async ({ page }) => {
  await page.getByRole("button", { name: "Denkmal", exact: true }).click();
  await page.getByRole("spinbutton", { name: /Begünstigte Denkmalkosten/ }).fill("100000");
  await page.getByLabel("Abschluss der Denkmalmaßnahmen", { exact: true }).fill("2026-08-01");
  await page.getByRole("checkbox", { name: /Behördliche Bescheinigung/ }).check();
  await page.getByRole("tab", { name: "Jahr für Jahr" }).click();
  await expect(page.locator("tbody tr").first()).toContainText("9.000,00");
  await expect(page.locator("tbody tr").first()).toContainText("2.960,00");
  await page.getByRole("button", { name: "Selbst genutzt", exact: true }).click();
  await page.getByRole("checkbox", { name: /Bescheinigung und Abstimmung/ }).check();
  await expect(page.locator("tbody tr").first().locator("td").first()).toHaveText(/0,00/);
  await expect(page.locator("tfoot")).toContainText("90.000,00");
  await page.getByRole("button", { name: "Bestand", exact: true }).click();
  await expect(page.getByTestId("total-tax-saving")).toHaveText(/0/);
  await expect(page.locator("main").getByRole("alert")).toHaveCount(0);
});

test("bis zu drei Varianten lassen sich im Dashboard vergleichen und exportieren", async ({ page }) => {
  await page.getByRole("textbox", { name: "Szenarioname" }).fill("Wohnung Berlin");
  await page.getByRole("button", { name: "Szenario vergleichen", exact: true }).click();
  await page.getByRole("textbox", { name: "Szenarioname" }).fill("Wohnung Hamburg");
  await page.getByRole("spinbutton", { name: /Kaufpreis gesamt/ }).fill("350000");
  await page.getByRole("button", { name: "Szenario vergleichen", exact: true }).click();
  await page.getByRole("textbox", { name: "Szenarioname" }).fill("Wohnung München");
  await page.getByRole("spinbutton", { name: /Kaufpreis gesamt/ }).fill("600000");
  await expect(page.getByRole("button", { name: "Szenario vergleichen", exact: true })).toBeDisabled();
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "CSV exportieren" }).click();
  const download = await downloaded;
  expect(download.suggestedFilename()).toBe("estatebrain-steuervergleich.csv");
  await page.getByRole("button", { name: "Wohnung Hamburg aus Vergleich entfernen", exact: true }).click();
  await expect(page.getByRole("button", { name: "Szenario vergleichen", exact: true })).toBeEnabled();
  expect(await page.evaluate(() => localStorage.getItem("estatebrain:investment-scenarios:v1"))).toBeNull();
});

test("ungültige Eingaben blockieren Berechnung und Speichern", async ({ page }) => {
  await page.getByRole("spinbutton", { name: /Grundstücksanteil am Kaufpreis/ }).fill("101");
  await expect(page.locator("main").getByRole("alert")).toContainText("Grundstücksanteil");
  await expect(page.getByTestId("total-tax-saving")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Szenario speichern" })).toBeDisabled();
  await page.getByRole("spinbutton", { name: /Grundstücksanteil am Kaufpreis/ }).fill("20");
  await expect(page.getByTestId("total-tax-saving")).toBeVisible();
});

});

for (const path of ["/app", "/app/steuervergleich", "/rechner"]) {
  test(`Steuervergleich ${path} ist ohne Sitzung geschützt`, async ({ page }) => {
    await page.goto(path);
    const expectedTarget = path === "/rechner" ? "/app" : path;
    await expect(page).toHaveURL(new RegExp(`/login\\?next=${encodeURIComponent(expectedTarget)}$`));
    await expect(page.getByRole("heading", { name: "Dein Steuer-Dashboard." })).toHaveCount(0);
  });
}
