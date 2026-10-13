/**
 * Safety rules for seeding development data. Kept separate from the seed script
 * so they can be unit-tested without a database.
 */

export interface SeedTarget {
  supabaseUrl: string;
  secretKey: string;
  email: string;
  password: string | null;
}

export class SeedRefusedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SeedRefusedError";
  }
}

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** `abcdefgh` for `https://abcdefgh.supabase.co`, otherwise null. */
export function supabaseProjectRef(url: URL): string | null {
  const match = url.hostname.match(/^([a-z0-9]{10,40})\.supabase\.co$/);
  return match ? match[1] : null;
}

/**
 * Seeding is allowed only when:
 *  - APP_ENV is exactly "development", and
 *  - the target is a local Supabase, or a hosted project explicitly declared
 *    as the development project via DEV_SUPABASE_PROJECT_REF.
 * Anything else is refused, so demo data can never land in production.
 */
export function resolveSeedTarget(env: Record<string, string | undefined>): SeedTarget {
  if (env.APP_ENV !== "development") {
    throw new SeedRefusedError(`Refusing to seed: APP_ENV must be "development" (got "${env.APP_ENV ?? ""}").`);
  }

  const rawUrl = env.SUPABASE_URL?.trim();
  if (!rawUrl) throw new SeedRefusedError("Refusing to seed: SUPABASE_URL is missing.");
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new SeedRefusedError("Refusing to seed: SUPABASE_URL is not a valid URL.");
  }

  if (!LOCAL_HOSTS.has(url.hostname)) {
    const ref = supabaseProjectRef(url);
    const devRef = env.DEV_SUPABASE_PROJECT_REF?.trim();
    if (!ref || !devRef || ref !== devRef) {
      throw new SeedRefusedError(
        "Refusing to seed a remote Supabase project. Set DEV_SUPABASE_PROJECT_REF to the ref of your development project to confirm the target.",
      );
    }
  }

  const secretKey = env.SUPABASE_SECRET_KEY?.trim();
  if (!secretKey) {
    throw new SeedRefusedError("Refusing to seed: SUPABASE_SECRET_KEY is missing (needed only for this script).");
  }

  const email = (env.DEV_SEED_EMAIL?.trim() || "dev@ai-hq.local").toLowerCase();
  const password = env.DEV_SEED_PASSWORD?.trim() || null;
  if (password && password.length < 12) {
    throw new SeedRefusedError("Refusing to seed: DEV_SEED_PASSWORD must be at least 12 characters.");
  }

  return { supabaseUrl: url.origin, secretKey, email, password };
}
