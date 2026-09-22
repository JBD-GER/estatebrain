import { expect, test } from "@playwright/test";

const qaEmail = process.env.E2E_USER_EMAIL;
const qaPassword = process.env.E2E_USER_PASSWORD;

test("Steuervergleich im Konto: speichern, neu laden, bearbeiten und löschen", async ({ page }, testInfo) => {
  test.skip(!qaEmail || !qaPassword, "Nur mit temporären QA-Zugangsdaten ausführen.");
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const name = `QA Steuervergleich ${Date.now()}`;
  const updatedName = `${name} aktualisiert`;

  await page.goto("/login?next=%2Fapp");
  await page.getByLabel("E-Mail-Adresse").fill(qaEmail!);
  await page.getByLabel("Passwort", { exact: true }).fill(qaPassword!);
  await page.getByRole("button", { name: "Anmelden", exact: true }).click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByRole("heading", { name: "Dein Steuer-Dashboard." })).toBeVisible();

  await page.getByRole("textbox", { name: "Szenarioname" }).fill(name);
  await page.getByRole("button", { name: "Neubau", exact: true }).click();
  await page.getByLabel("Fertigstellung Gebäude", { exact: true }).fill("2026-03-01");
  await page.getByLabel("Notarieller Kaufvertrag", { exact: false }).fill("2025-12-01");
  await page.getByRole("checkbox", { name: /Wohngebäude in EU/ }).check();
  await page.getByRole("spinbutton", { name: /Kaufpreis gesamt/ }).fill("500000");
  await page.getByRole("combobox", { name: "Abschreibungsmodell wählen" }).selectOption("degressive");
  if (process.env.E2E_CAPTURE_DASHBOARD === "1") {
    if (testInfo.project.name === "chromium") await page.setViewportSize({ width: 1440, height: 1000 });
    await expect(page.locator(".recharts-surface").first()).toBeVisible();
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await page.screenshot({ path: `/tmp/estatebrain-private-dashboard-${testInfo.project.name}.png`, fullPage: true, animations: "disabled" });
    await page.screenshot({ path: `/tmp/estatebrain-private-dashboard-${testInfo.project.name}-viewport.png`, animations: "disabled" });
  }
  await page.getByRole("button", { name: "Szenario speichern" }).click();
  await expect(page.getByText("Szenario in deiner Organisation gespeichert.", { exact: true })).toBeVisible();

  await page.reload();
  await page.getByRole("button", { name: /^Gespeichert/ }).click();
  let saved = page.getByRole("region", { name: "Gespeicherte Szenarien" });
  await expect(saved.getByText(name, { exact: true })).toBeVisible();
  await saved.getByText(name, { exact: true }).locator("..").getByRole("button", { name: "Laden", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Szenarioname" })).toHaveValue(name);
  await expect(page.getByRole("spinbutton", { name: /Kaufpreis gesamt/ })).toHaveValue("500000");
  await expect(page.getByRole("combobox", { name: "Abschreibungsmodell wählen" })).toHaveValue("degressive");
  await expect(page.getByRole("checkbox", { name: /Wohngebäude in EU/ })).toBeChecked();

  await page.getByRole("textbox", { name: "Szenarioname" }).fill(updatedName);
  await page.getByRole("spinbutton", { name: /Kaufpreis gesamt/ }).fill("550000");
  await page.getByRole("button", { name: "Szenario speichern" }).click();
  await expect(page.getByText("Szenario in deiner Organisation gespeichert.", { exact: true })).toBeVisible();

  await page.reload();
  await page.getByRole("button", { name: /^Gespeichert/ }).click();
  saved = page.getByRole("region", { name: "Gespeicherte Szenarien" });
  await expect(saved.getByText(name, { exact: true })).toHaveCount(0);
  await expect(saved.getByText(updatedName, { exact: true })).toHaveCount(1);
  await saved.getByText(updatedName, { exact: true }).locator("..").getByRole("button", { name: "Laden", exact: true }).click();
  await expect(page.getByRole("spinbutton", { name: /Kaufpreis gesamt/ })).toHaveValue("550000");
  await expect(page.getByRole("combobox", { name: "Abschreibungsmodell wählen" })).toHaveValue("degressive");

  await page.getByRole("button", { name: /^Gespeichert/ }).click();
  await saved.getByRole("button", { name: `${updatedName} aus Speicher löschen`, exact: true }).click();
  await expect(page.getByText("Gespeichertes Szenario gelöscht.", { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: /^Gespeichert/ }).click();
  await expect(page.getByRole("region", { name: "Gespeicherte Szenarien" }).getByText(updatedName, { exact: true })).toHaveCount(0);
  expect(errors).toEqual([]);
});
