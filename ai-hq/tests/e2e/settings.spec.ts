import { expect, test } from "@playwright/test";
import { USERS } from "./support/fixtures";
import { choose, signIn } from "./support/helpers";

test.beforeEach(async ({ page }) => {
  await signIn(page, USERS.alice);
});

test("profile and workspace settings are saved and shown in the top bar", async ({ page }) => {
  await page.goto("/settings");
  await page.getByLabel("Display name").fill("Alice Admin");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByText("Profile saved")).toBeVisible();

  await page.getByRole("navigation", { name: "Settings sections" }).getByRole("link", { name: "Workspace" }).click();
  await expect(page).toHaveURL("/settings?tab=workspace");
  await page.getByLabel("Time zone").fill("Mars/Olympus");
  await page.getByRole("button", { name: "Save workspace" }).click();
  await expect(page.getByText("Choose a valid IANA time zone")).toBeVisible();

  await page.getByLabel("Workspace name").fill("Merge Studio HQ");
  await page.getByLabel("Time zone").fill("Europe/Istanbul");
  await page.getByRole("button", { name: "Save workspace" }).click();
  await expect(page.getByText("Workspace settings saved")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("banner").getByText("Merge Studio HQ")).toBeVisible();
  await page.goto("/");
  await expect(page.getByText("in Europe/Istanbul")).toBeVisible();

  // Restore the defaults for the other tests.
  const restore = await page.request.patch("/api/settings", { data: { workspaceName: "AI HQ", timezone: "UTC" } });
  expect(restore.status()).toBe(200);
  expect((await page.request.patch("/api/profile", { data: { displayName: "" } })).status()).toBe(200);
});

test("the owner changes roles after confirming", async ({ page }) => {
  await page.goto("/settings?tab=users");
  const bobRow = page.getByRole("row", { name: new RegExp(USERS.bob.email) });
  await expect(bobRow).toBeVisible();
  await expect(page.getByRole("row", { name: /\(you\)/ })).toContainText("Owner");

  await choose(page, `Role of ${USERS.bob.email}`, "Admin");
  await page.getByRole("alertdialog").getByRole("button", { name: "Change role" }).click();
  await expect(page.getByText(`${USERS.bob.email} is now Admin`)).toBeVisible();
  await expect(page.getByRole("combobox", { name: `Role of ${USERS.bob.email}` })).toHaveText("Admin");

  // Cancelling leaves the role unchanged.
  await choose(page, `Role of ${USERS.bob.email}`, "Owner");
  await page.getByRole("alertdialog").getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("combobox", { name: `Role of ${USERS.bob.email}` })).toHaveText("Admin");

  await choose(page, `Role of ${USERS.bob.email}`, "Member");
  await page.getByRole("alertdialog").getByRole("button", { name: "Change role" }).click();
  await expect(page.getByRole("combobox", { name: `Role of ${USERS.bob.email}` })).toHaveText("Member");

  // The last owner cannot demote themselves.
  const demote = await page.request.patch(`/api/users/${await ownId(page)}/role`, { data: { role: "member" } });
  expect(demote.status()).toBe(422);
  expect((await demote.json()).error.message).toBe("The workspace needs at least one owner.");
});

test("demo data is labelled, kept out of figures by default and removable", async ({ page }) => {
  await page.goto("/settings?tab=demo");
  await page.getByRole("button", { name: "Load demo data" }).click();
  await expect(page.getByText(/Loaded \d+ demo records/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Load demo data" })).toBeDisabled();

  await page.goto("/projects?q=Demo");
  await expect(page.getByText("Demo", { exact: true }).first()).toBeVisible();

  await page.goto("/");
  const toggle = page.getByRole("switch", { name: /Include demo data/ });
  await expect(toggle).toHaveAttribute("aria-checked", "false");
  await toggle.click();
  await expect(page).toHaveURL("/?demo=include");
  await expect(page.getByText("Figures below include demo records.")).toBeVisible();
  await expect(page.getByRole("switch", { name: /Include demo data/ })).toHaveAttribute("aria-checked", "true");

  await page.goto("/settings?tab=demo");
  await page.getByRole("button", { name: "Remove demo data" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Remove demo data" }).click();
  await expect(page.getByText("Demo data removed")).toBeVisible();
  await expect(page.getByRole("button", { name: "Load demo data" })).toBeEnabled();
});

async function ownId(page: import("@playwright/test").Page): Promise<string> {
  const response = await page.request.get("/api/profile");
  return (await response.json()).data.id;
}
