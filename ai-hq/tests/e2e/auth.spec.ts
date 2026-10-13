import { expect, test } from "@playwright/test";
import { USERS } from "./support/fixtures";
import { signIn } from "./support/helpers";

test.describe("signed-out visitors", () => {
  test("are redirected from private pages to the login page", async ({ page }) => {
    await page.goto("/projects?status=active");
    await expect(page).toHaveURL(/\/login\?next=%2Fprojects%3Fstatus%3Dactive$/);
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  });

  test("get 401 from private APIs and 200 from the health check", async ({ request }) => {
    const projects = await request.get("/api/projects");
    expect(projects.status()).toBe(401);
    expect(await projects.json()).toEqual({ error: { code: "UNAUTHENTICATED", message: "Sign in to continue." } });

    const create = await request.post("/api/projects", { data: { name: "x" } });
    expect(create.status()).toBe(401);

    const health = await request.get("/api/health");
    expect(health.status()).toBe(200);
    expect(await health.json()).toEqual({ status: "ok", checks: { configuration: "ok" } });
  });
});

test.describe("sign in", () => {
  test("rejects a wrong password without revealing whether the account exists", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(USERS.alice.email);
    await page.getByLabel("Password").fill("wrong-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("Invalid email or password.")).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("validates the form on the server", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("not-an-email");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("Enter a valid email address.")).toBeVisible();
  });

  test("refuses valid accounts that are not on the allowlist", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(USERS.mallory.email);
    await page.getByLabel("Password").fill(USERS.mallory.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("This account is not allowed to use AI HQ.")).toBeVisible();

    // The session was revoked on the server, so private pages stay closed.
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
  });

  test("returns to the requested page after signing in", async ({ page }) => {
    await page.goto("/automation");
    await expect(page).toHaveURL(/next=%2Fautomation/);
    await page.getByLabel("Email").fill(USERS.alice.email);
    await page.getByLabel("Password").fill(USERS.alice.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL("/automation");
    await expect(page.getByRole("heading", { name: "Automations" })).toBeVisible();
  });

  test("signs in, shows the environment and signs out", async ({ page }) => {
    await signIn(page, USERS.alice);
    await expect(page.getByTitle("APP_ENV=development").first()).toBeVisible();

    await page.getByRole("button", { name: "Account menu" }).click();
    await page.getByRole("menuitem", { name: "Sign out" }).click();
    await expect(page).toHaveURL("/login");

    await page.goto("/projects");
    await expect(page).toHaveURL(/\/login/);
    const api = await page.request.get("/api/projects");
    expect(api.status()).toBe(401);
  });
});
