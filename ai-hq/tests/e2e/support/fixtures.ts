/** Shared, test-only fixtures for the end-to-end suite. None of these are real credentials. */

export const EMULATOR_PORT = 54399;
export const APP_PORT = 3100;
export const APP_URL = `http://127.0.0.1:${APP_PORT}`;
export const EMULATOR_URL = `http://127.0.0.1:${EMULATOR_PORT}`;
export const TEST_PUBLISHABLE_KEY = "sb_publishable_e2e_emulator_only";
export const TEST_SECRET_KEY = "sb_secret_e2e-emulator-fake";

export const USERS = {
  alice: { id: "00000000-0000-4000-8000-0000000a11ce", email: "alice@e2e.test", password: "Alice-e2e-Passw0rd" },
  bob: { id: "00000000-0000-4000-8000-000000000b0b", email: "bob@e2e.test", password: "Bob-e2e-Passw0rd" },
  // Has a valid Supabase account but is not on AI_HQ_ALLOWED_EMAILS.
  mallory: { id: "00000000-0000-4000-8000-0000000ba11d", email: "mallory@e2e.test", password: "Mallory-e2e-Passw0rd" },
  // Used only by the two-factor sign-in test.
  carol: { id: "00000000-0000-4000-8000-0000000ca201", email: "carol@e2e.test", password: "Carol-e2e-Passw0rd" },
} as const;

export const ALLOWED_EMAILS = [USERS.alice.email, USERS.bob.email, USERS.carol.email].join(",");
