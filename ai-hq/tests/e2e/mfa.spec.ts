import { expect, type Page, test } from "@playwright/test";
import { USERS } from "./support/fixtures";
import { freshTotp, wrongTotp } from "./support/totp";

const carol = USERS.carol;

async function passwordSignIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(carol.email);
  await page.getByLabel("Password").fill(carol.password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

test("two-factor sign-in is set up, enforced on every route and turned off with a code", async ({ page }) => {
  await passwordSignIn(page);
  await expect(page).toHaveURL("/");

  // Set up an authenticator app.
  await page.goto("/settings?tab=security");
  await expect(page.getByText("Only your password protects this account.")).toBeVisible();
  await page.getByRole("button", { name: "Set up authenticator app" }).click();
  await expect(page.getByRole("img", { name: "QR code for your authenticator app" })).toBeVisible();
  const secret = (await page.getByTestId("mfa-secret").textContent())?.trim() ?? "";
  expect(secret).toMatch(/^[A-Z2-7]{16,}$/);

  const setupCode = page.getByRole("textbox", { name: "Authentication code" });
  await setupCode.fill(wrongTotp(secret));
  await page.getByRole("button", { name: "Verify and turn on" }).click();
  await expect(page.getByText("That code is not valid.", { exact: false })).toBeVisible();
  await setupCode.fill(await freshTotp(secret));
  await page.getByRole("button", { name: "Verify and turn on" }).click();
  await expect(page.getByText("Two-factor sign-in is on")).toBeVisible();
  await expect(page.getByText("Authenticator app added", { exact: false })).toBeVisible();

  // A new password-only session cannot reach anything until the code is entered.
  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(page).toHaveURL("/login");
  await passwordSignIn(page);
  await expect(page).toHaveURL("/login/mfa");

  const api = await page.request.get("/api/projects");
  expect(api.status()).toBe(401);
  expect((await api.json()).error.code).toBe("MFA_REQUIRED");
  await page.goto("/projects?status=active");
  await expect(page).toHaveURL(/\/login\/mfa\?next=%2Fprojects%3Fstatus%3Dactive$/);

  const code = page.getByRole("textbox", { name: "Authentication code" });
  await code.fill(wrongTotp(secret));
  await page.getByRole("button", { name: "Verify" }).click();
  await expect(page.getByText("That code is not valid.", { exact: false })).toBeVisible();
  await code.fill(await freshTotp(secret));
  await page.getByRole("button", { name: "Verify" }).click();
  await expect(page).toHaveURL("/projects?status=active");
  expect((await page.request.get("/api/projects")).status()).toBe(200);

  // Turning it off needs a current code.
  await page.goto("/settings?tab=security");
  await page.getByRole("button", { name: "Turn off" }).click();
  const dialog = page.getByRole("dialog", { name: "Turn off two-factor sign-in?" });
  await dialog.getByRole("textbox", { name: "Authentication code" }).fill(wrongTotp(secret));
  await dialog.getByRole("button", { name: "Turn off" }).click();
  await expect(dialog.getByText("That code is not valid.", { exact: false })).toBeVisible();
  await dialog.getByRole("textbox", { name: "Authentication code" }).fill(await freshTotp(secret));
  await dialog.getByRole("button", { name: "Turn off" }).click();
  await expect(page.getByText("Two-factor sign-in is off")).toBeVisible();
  await expect(page.getByText("Only your password protects this account.")).toBeVisible();
});
