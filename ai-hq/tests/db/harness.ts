import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import pg from "pg";

/**
 * Database harness for the RLS / trigger tests.
 *
 * By default it boots an in-memory PGlite instance, so the suite needs no
 * Docker and no network. Set TEST_DATABASE_URL to run the same suite against a
 * real PostgreSQL server instead. That database is wiped, so the harness only
 * accepts database names containing "test".
 */

const ROOT = path.resolve(__dirname, "../..");
const STUB_SQL = path.join(ROOT, "tests/db/supabase-stub.sql");
const MIGRATIONS_DIR = path.join(ROOT, "supabase/migrations");

export type Row = Record<string, unknown>;

export interface SqlRunner {
  query<T extends Row = Row>(sql: string, params?: unknown[]): Promise<T[]>;
}

export interface TestDatabase extends SqlRunner {
  readonly engine: "pglite" | "postgres";
  exec(sql: string): Promise<void>;
  /** Runs `fn` as the Supabase `authenticated` role with the given user id. */
  asUser<T>(userId: string, fn: (db: SqlRunner) => Promise<T>): Promise<T>;
  /** Runs `fn` as the Supabase `anon` role (no JWT). */
  asAnon<T>(fn: (db: SqlRunner) => Promise<T>): Promise<T>;
  /** Runs `fn` as `service_role` (bypasses RLS), like a future server-side worker. */
  asService<T>(fn: (db: SqlRunner) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

export function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith(".sql"))
    .sort()
    .map((file) => path.join(MIGRATIONS_DIR, file));
}

/** Supabase stub followed by every migration, in order. */
export function schemaSql(): string[] {
  return [STUB_SQL, ...migrationFiles()].map((file) => readFileSync(file, "utf8"));
}

function roleSetup(role: "authenticated" | "anon" | "service_role", userId?: string): string {
  const claims = userId ? JSON.stringify({ sub: userId, role }) : role === "service_role" ? JSON.stringify({ role }) : "";
  // set_config(..., true) scopes the claims to the current transaction, the
  // same way PostgREST does for every API request.
  return `set local role ${role}; select set_config('request.jwt.claims', '${claims}', true);`;
}

async function createPgliteDatabase(): Promise<TestDatabase> {
  const db = new PGlite();
  for (const sql of schemaSql()) await db.exec(sql);

  const runAs = <T>(setup: string, fn: (runner: SqlRunner) => Promise<T>) =>
    db.transaction(async (tx) => {
      await tx.exec(setup);
      return fn({
        query: async <R extends Row>(sql: string, params?: unknown[]) =>
          (await tx.query<R>(sql, params)).rows,
      });
    });

  return {
    engine: "pglite",
    exec: async (sql) => {
      await db.exec(sql);
    },
    query: async <R extends Row>(sql: string, params?: unknown[]) =>
      (await db.query<R>(sql, params)).rows,
    asUser: (userId, fn) => runAs(roleSetup("authenticated", userId), fn),
    asAnon: (fn) => runAs(roleSetup("anon"), fn),
    asService: (fn) => runAs(roleSetup("service_role"), fn),
    close: () => db.close(),
  };
}

async function createPostgresDatabase(url: string): Promise<TestDatabase> {
  const dbName = new URL(url).pathname.replace(/^\//, "");
  if (!dbName.includes("test")) {
    throw new Error(
      `TEST_DATABASE_URL must point at a disposable database whose name contains "test" (got "${dbName}").`,
    );
  }

  const client = new pg.Client({ connectionString: url });
  await client.connect();
  await client.query("drop schema if exists public cascade; drop schema if exists auth cascade;");
  await client.query("create schema public; grant usage on schema public to public;");
  for (const sql of schemaSql()) await client.query(sql);

  const runAs = async <T>(setup: string, fn: (runner: SqlRunner) => Promise<T>) => {
    await client.query("begin");
    try {
      await client.query(setup);
      const result = await fn({
        query: async <R extends Row>(sql: string, params?: unknown[]) =>
          (await client.query<R>(sql, params)).rows,
      });
      await client.query("commit");
      return result;
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
  };

  return {
    engine: "postgres",
    exec: async (sql) => {
      await client.query(sql);
    },
    query: async <R extends Row>(sql: string, params?: unknown[]) =>
      (await client.query<R>(sql, params)).rows,
    asUser: (userId, fn) => runAs(roleSetup("authenticated", userId), fn),
    asAnon: (fn) => runAs(roleSetup("anon"), fn),
    asService: (fn) => runAs(roleSetup("service_role"), fn),
    close: () => client.end(),
  };
}

export async function createTestDatabase(): Promise<TestDatabase> {
  const url = process.env.TEST_DATABASE_URL;
  return url ? createPostgresDatabase(url) : createPgliteDatabase();
}
