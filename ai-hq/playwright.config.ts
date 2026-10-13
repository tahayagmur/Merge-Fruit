import { defineConfig, devices } from "@playwright/test";
import {
  ALLOWED_EMAILS,
  APP_PORT,
  APP_URL,
  EMULATOR_PORT,
  EMULATOR_URL,
  TEST_PUBLISHABLE_KEY,
} from "./tests/e2e/support/fixtures";

/**
 * End-to-end tests run the production build against the test-only Supabase
 * emulator (tests/e2e/support), so they need no Docker and no credentials.
 *
 * PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH: use a pre-installed Chromium instead of
 * `npx playwright install` (handy in sandboxes and CI images).
 * E2E_SKIP_BUILD=1: reuse an existing `.next` build.
 */
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined;
const startApp = `npx next start -p ${APP_PORT} -H 127.0.0.1`;

export default defineConfig({
  testDir: "tests/e2e",
  // The suite shares one in-memory database, so run it serially.
  workers: 1,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: [["list"]],
  timeout: 60_000,
  use: {
    ...devices["Desktop Chrome"],
    baseURL: APP_URL,
    trace: "retain-on-failure",
    launchOptions: executablePath ? { executablePath } : undefined,
  },
  webServer: [
    {
      command: "npx tsx tests/e2e/support/start-emulator.ts",
      port: EMULATOR_PORT,
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: process.env.E2E_SKIP_BUILD ? startApp : `npx next build && ${startApp}`,
      url: `${APP_URL}/api/health`,
      reuseExistingServer: false,
      timeout: 300_000,
      env: {
        APP_ENV: "development",
        SUPABASE_URL: EMULATOR_URL,
        SUPABASE_PUBLISHABLE_KEY: TEST_PUBLISHABLE_KEY,
        AI_HQ_ALLOWED_EMAILS: ALLOWED_EMAILS,
      },
    },
  ],
});
