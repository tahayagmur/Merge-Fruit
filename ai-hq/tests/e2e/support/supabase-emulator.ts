/**
 * TEST-ONLY Supabase emulator for end-to-end tests.
 *
 * Implements the small subset of Supabase Auth (GoTrue) and PostgREST that AI
 * HQ uses, on top of an in-memory PGlite database loaded with the real
 * migrations. Requests run under the `anon` / `authenticated` roles with JWT
 * claims set per transaction — the same way PostgREST does — so row level
 * security is enforced by Postgres itself.
 *
 * It exists so the browser tests can run without Docker or cloud credentials.
 * It is not a replacement for verifying against a real Supabase project, and it
 * is never used by the application at runtime.
 */
import { createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { PGlite } from "@electric-sql/pglite";

export interface EmulatorUser {
  id: string;
  email: string;
  password: string;
}

export interface EmulatorOptions {
  db: PGlite;
  port: number;
  publishableKey: string;
  /** Optional secret key: requests using it run as service_role (bypasses RLS), like Supabase. */
  secretKey?: string;
  jwtSecret?: string;
  users: EmulatorUser[];
}

const RELATIONS = new Set([
  "projects",
  "tasks",
  "automations",
  "activity_logs",
  "project_overview",
  "profiles",
  "system_settings",
  "integration_configs",
  "agent_definitions",
  "agent_task_records",
]);
const FUNCTIONS = new Set(["command_center_summary", "set_workspace_role"]);
/** Supported many-to-one embeds: relation → embedded table → foreign key column. */
const EMBEDS: Record<string, Record<string, string>> = {
  tasks: { projects: "project_id" },
  automations: { projects: "project_id" },
  agent_task_records: { agent_definitions: "agent_id" },
};
const IDENTIFIER = /^[a-z_][a-z0-9_]*$/;
const FILTER_COLUMN = /^([a-z_][a-z0-9_]*)(?:->>([a-z_][a-z0-9_]*))?$/;
const OPERATORS: Record<string, string> = {
  eq: "=",
  neq: "<>",
  lt: "<",
  lte: "<=",
  gt: ">",
  gte: ">=",
  like: "like",
  ilike: "ilike",
};
const RESERVED_PARAMS = new Set(["select", "order", "limit", "offset", "columns", "on_conflict", "or"]);

// ---------------------------------------------------------------------------
// JWT (HS256)
// ---------------------------------------------------------------------------

function base64url(input: Buffer | string) {
  return Buffer.from(input).toString("base64url");
}

function signJwt(payload: Record<string, unknown>, secret: string) {
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64url(JSON.stringify(payload));
  const signature = createHmac("sha256", secret).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${signature}`;
}

function verifyJwt(token: string, secret: string): Record<string, unknown> | null {
  const [header, body, signature] = token.split(".");
  if (!header || !body || !signature) return null;
  const expected = createHmac("sha256", secret).update(`${header}.${body}`).digest();
  const actual = Buffer.from(signature, "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Record<string, unknown>;
  if (typeof payload.exp === "number" && payload.exp * 1000 < Date.now()) return null;
  return payload;
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

async function readBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(chunk as Buffer);
  const text = Buffer.concat(chunks).toString("utf8");
  if (!text) return undefined;
  return JSON.parse(text);
}

function send(response: ServerResponse, status: number, body?: unknown) {
  response.statusCode = status;
  if (body === undefined) {
    response.end();
    return;
  }
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.end(JSON.stringify(body));
}

class PostgrestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

function pgErrorStatus(code: string | undefined, role: string): number {
  switch (code) {
    case "42501":
      return role === "anon" ? 401 : 403;
    case "23503":
    case "23505":
      return 409;
    case "42P01":
    case "42883":
      return 404;
    default:
      return 400;
  }
}

// ---------------------------------------------------------------------------
// PostgREST query translation (subset)
// ---------------------------------------------------------------------------

function quoteIdent(identifier: string) {
  if (!IDENTIFIER.test(identifier)) throw new PostgrestError(400, "PGRST100", `Invalid identifier: ${identifier}`);
  return `"${identifier}"`;
}

function splitTopLevel(input: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const char of input) {
    if (char === "(") depth += 1;
    if (char === ")") depth -= 1;
    if (char === "," && depth === 0) {
      parts.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  if (current) parts.push(current);
  return parts.map((part) => part.trim()).filter(Boolean);
}

/** Supports `*`, plain columns and one-level many-to-one embeds listed in EMBEDS. */
function buildSelect(relation: string, select: string | null): string {
  const items = splitTopLevel(select ?? "*");
  return items
    .map((item) => {
      if (item === "*") return "t.*";
      const embed = item.match(/^(?:([a-z_]+):)?([a-z_]+)(?:!([a-z_]+))?\((.*)\)$/);
      if (embed) {
        const [, alias, target, , columns] = embed;
        const foreignKey = EMBEDS[relation]?.[target];
        if (!foreignKey) throw new PostgrestError(400, "PGRST200", `Unsupported embed ${target} on ${relation}`);
        const fields = splitTopLevel(columns)
          .map((column) => `'${column}', e.${quoteIdent(column)}`)
          .join(", ");
        return `(select json_build_object(${fields}) from public.${quoteIdent(target)} e where e.id = t.${quoteIdent(foreignKey)}) as ${quoteIdent(alias ?? target)}`;
      }
      return `t.${quoteIdent(item)}`;
    })
    .join(", ");
}

function unquote(value: string) {
  return value.replace(/^"(.*)"$/, "$1");
}

/** One `column=operator.value` condition. */
function buildCondition(key: string, raw: string, values: unknown[]): string {
  const column = key.match(FILTER_COLUMN);
  if (!column) throw new PostgrestError(400, "PGRST100", `Unsupported filter column: ${key}`);
  const target = column[2] ? `t.${quoteIdent(column[1])}->>'${column[2]}'` : `t.${quoteIdent(column[1])}`;
  const dot = raw.indexOf(".");
  const operator = raw.slice(0, dot);
  const value = raw.slice(dot + 1);
  if (operator === "is") {
    if (!["null", "true", "false"].includes(value)) throw new PostgrestError(400, "PGRST100", "Bad is filter");
    return `${target} is ${value}`;
  }
  if (operator === "in") {
    const list = value.replace(/^\(|\)$/g, "").split(",").map(unquote);
    const placeholders = list.map((item) => {
      values.push(item);
      return `$${values.length}`;
    });
    return `${target} in (${placeholders.join(", ")})`;
  }
  if (OPERATORS[operator]) {
    const operand = unquote(value);
    values.push(operator === "like" || operator === "ilike" ? operand.replaceAll("*", "%") : operand);
    return `${target} ${OPERATORS[operator]} $${values.length}`;
  }
  throw new PostgrestError(400, "PGRST100", `Unsupported operator: ${operator}`);
}

function buildFilters(params: URLSearchParams, values: unknown[]): string {
  const clauses: string[] = [];
  for (const [key, raw] of params) {
    if (key === "or") {
      // or=(name.ilike."%x%",description.ilike."%x%")
      const parts = splitTopLevel(raw.replace(/^\(|\)$/g, "")).map((part) => {
        const first = part.indexOf(".");
        return buildCondition(part.slice(0, first), part.slice(first + 1), values);
      });
      if (parts.length) clauses.push(`(${parts.join(" or ")})`);
      continue;
    }
    if (RESERVED_PARAMS.has(key)) continue;
    clauses.push(buildCondition(key, raw, values));
  }
  return clauses.length ? `where ${clauses.join(" and ")}` : "";
}

function buildOrder(order: string | null): string {
  if (!order) return "";
  const terms = order.split(",").map((term) => {
    const [column, direction = "asc", nulls] = term.split(".");
    const dir = direction === "desc" ? "desc" : "asc";
    const nullsClause = nulls === "nullsfirst" ? " nulls first" : nulls === "nullslast" ? " nulls last" : "";
    return `${quoteIdent(column)} ${dir}${nullsClause}`;
  });
  return `order by ${terms.join(", ")}`;
}

function buildLimit(params: URLSearchParams): string {
  const limit = params.get("limit");
  const offset = params.get("offset");
  const parts: string[] = [];
  if (limit && /^\d+$/.test(limit)) parts.push(`limit ${limit}`);
  if (offset && /^\d+$/.test(offset)) parts.push(`offset ${offset}`);
  return parts.join(" ");
}

// ---------------------------------------------------------------------------
// Emulator
// ---------------------------------------------------------------------------

export async function startSupabaseEmulator(options: EmulatorOptions): Promise<{ url: string; stop: () => Promise<void> }> {
  const { db, port, publishableKey, secretKey } = options;
  const users = [...options.users];
  const jwtSecret = options.jwtSecret ?? randomBytes(32).toString("hex");
  const refreshTokens = new Map<string, string>();
  let queue: Promise<unknown> = Promise.resolve();

  for (const user of users) {
    await db.query("insert into auth.users (id, email) values ($1, $2) on conflict (id) do nothing", [
      user.id,
      user.email,
    ]);
  }

  /** Serialises transactions: role and claims are transaction-local, like in PostgREST. */
  function runAs<T>(claims: Record<string, unknown> | null, sql: string, values: unknown[]): Promise<T> {
    const role = claims?.role === "authenticated" || claims?.role === "service_role" ? claims.role : "anon";
    const job = queue.then(() =>
      db.transaction(async (tx) => {
        await tx.exec(`set local role ${role}`);
        await tx.query("select set_config('request.jwt.claims', $1, true)", [claims ? JSON.stringify(claims) : ""]);
        const result = await tx.query<{ body: unknown }>(sql, values);
        return result.rows[0]?.body as T;
      }),
    );
    queue = job.catch(() => undefined);
    return job;
  }

  function userJson(user: EmulatorUser) {
    const now = new Date().toISOString();
    return {
      id: user.id,
      aud: "authenticated",
      role: "authenticated",
      email: user.email,
      email_confirmed_at: now,
      app_metadata: { provider: "email", providers: ["email"] },
      user_metadata: {},
      identities: [],
      created_at: now,
      updated_at: now,
    };
  }

  function session(user: EmulatorUser) {
    const now = Math.floor(Date.now() / 1000);
    const expiresIn = 3600;
    const accessToken = signJwt(
      {
        sub: user.id,
        email: user.email,
        role: "authenticated",
        aud: "authenticated",
        iat: now,
        exp: now + expiresIn,
        session_id: randomUUID(),
      },
      jwtSecret,
    );
    const refreshToken = randomBytes(24).toString("hex");
    refreshTokens.set(refreshToken, user.id);
    return {
      access_token: accessToken,
      token_type: "bearer",
      expires_in: expiresIn,
      expires_at: now + expiresIn,
      refresh_token: refreshToken,
      user: userJson(user),
    };
  }

  function claimsFrom(request: IncomingMessage): Record<string, unknown> | null | "invalid" {
    const auth = request.headers.authorization?.replace(/^Bearer\s+/i, "");
    if (secretKey && auth === secretKey) return { role: "service_role" };
    if (!auth || auth === publishableKey) return null;
    return verifyJwt(auth, jwtSecret) ?? "invalid";
  }

  async function handleAuth(request: IncomingMessage, response: ServerResponse, url: URL) {
    const path = url.pathname.replace(/^\/auth\/v1/, "");
    if (path === "/health" && request.method === "GET") {
      return send(response, 200, { name: "GoTrue (emulator)", description: "test double" });
    }
    if (path === "/token" && request.method === "POST") {
      const body = ((await readBody(request)) ?? {}) as Record<string, string>;
      const grant = url.searchParams.get("grant_type");
      if (grant === "password") {
        const user = users.find((candidate) => candidate.email === body.email?.toLowerCase());
        if (!user || user.password !== body.password) {
          return send(response, 400, {
            code: "invalid_credentials",
            error: "invalid_grant",
            error_description: "Invalid login credentials",
            msg: "Invalid login credentials",
          });
        }
        return send(response, 200, session(user));
      }
      if (grant === "refresh_token") {
        const userId = refreshTokens.get(body.refresh_token);
        const user = users.find((candidate) => candidate.id === userId);
        if (!user) return send(response, 400, { code: "refresh_token_not_found", msg: "Invalid Refresh Token" });
        refreshTokens.delete(body.refresh_token);
        return send(response, 200, session(user));
      }
      return send(response, 400, { code: "unsupported_grant_type", msg: "Unsupported grant type" });
    }
    if (path === "/user" && request.method === "GET") {
      const claims = claimsFrom(request);
      const user = claims && claims !== "invalid" ? users.find((candidate) => candidate.id === claims.sub) : undefined;
      if (!user) return send(response, 403, { code: "bad_jwt", msg: "invalid JWT" });
      return send(response, 200, userJson(user));
    }
    if (path.startsWith("/admin/")) {
      const claims = claimsFrom(request);
      if (!claims || claims === "invalid" || claims.role !== "service_role") {
        return send(response, 403, { code: "not_admin", msg: "User not allowed" });
      }
      if (path === "/admin/users" && request.method === "GET") {
        return send(response, 200, { users: users.map(userJson), aud: "authenticated" });
      }
      if (path === "/admin/users" && request.method === "POST") {
        const body = ((await readBody(request)) ?? {}) as Record<string, string>;
        const email = body.email?.toLowerCase();
        if (!email || !body.password) return send(response, 422, { code: "validation_failed", msg: "email and password required" });
        if (users.some((candidate) => candidate.email === email)) {
          return send(response, 422, { code: "email_exists", msg: "A user with this email address has already been registered" });
        }
        const user = { id: randomUUID(), email, password: body.password };
        users.push(user);
        await db.query("insert into auth.users (id, email) values ($1, $2)", [user.id, user.email]);
        return send(response, 200, userJson(user));
      }
    }
    if (path === "/logout" && request.method === "POST") {
      const claims = claimsFrom(request);
      if (claims && claims !== "invalid") {
        for (const [token, userId] of refreshTokens) if (userId === claims.sub) refreshTokens.delete(token);
      }
      return send(response, 204);
    }
    return send(response, 404, { code: "not_found", msg: `Emulator does not implement ${request.method} ${path}` });
  }

  async function handleRest(request: IncomingMessage, response: ServerResponse, url: URL) {
    const claims = claimsFrom(request);
    if (claims === "invalid") return send(response, 401, { code: "PGRST301", message: "JWT invalid or expired" });
    const role = typeof claims?.role === "string" ? claims.role : "anon";
    const path = url.pathname.replace(/^\/rest\/v1\//, "");
    const params = url.searchParams;
    const values: unknown[] = [];

    try {
      if (path.startsWith("rpc/")) {
        const fn = path.slice(4);
        if (!FUNCTIONS.has(fn)) throw new PostgrestError(404, "PGRST202", `Function ${fn} not found`);
        const args =
          request.method === "POST"
            ? (((await readBody(request)) ?? {}) as Record<string, unknown>)
            : Object.fromEntries(params);
        const named = Object.entries(args).map(([name, value]) => {
          values.push(value);
          return `${quoteIdent(name)} => $${values.length}`;
        });
        const body = await runAs(claims, `select to_json(public.${quoteIdent(fn)}(${named.join(", ")})) as body`, values);
        return send(response, 200, body);
      }

      if (!RELATIONS.has(path)) throw new PostgrestError(404, "PGRST205", `Relation ${path} not found`);
      const table = `public.${quoteIdent(path)}`;
      const select = buildSelect(path, params.get("select"));
      const wantsCount = /count=exact/.test(String(request.headers.prefer ?? ""));
      let sql: string;

      if (request.method === "GET" || request.method === "HEAD") {
        // Rows and (optionally) the exact count, like PostgREST with `Prefer: count=exact`.
        const where = buildFilters(params, values);
        const result = await runAs<{ rows: unknown[]; count: number | null }>(
          claims,
          `select json_build_object(
             'rows', (select coalesce(json_agg(_r), '[]'::json) from (
                       select ${select} from ${table} t ${where} ${buildOrder(params.get("order"))} ${buildLimit(params)}
                     ) _r),
             'count', ${wantsCount ? `(select count(*) from ${table} t ${where})` : "null"}
           ) as body`,
          values,
        );
        if (wantsCount) {
          const offset = Number(params.get("offset") ?? 0);
          const range = result.rows.length ? `${offset}-${offset + result.rows.length - 1}` : "*";
          response.setHeader("content-range", `${range}/${result.count}`);
        }
        if (request.method === "HEAD") return send(response, 200);
        const wantsObject = request.headers.accept?.includes("application/vnd.pgrst.object+json");
        if (wantsObject) {
          if (result.rows.length !== 1) {
            return send(response, 406, {
              code: "PGRST116",
              message: "JSON object requested, multiple (or no) rows returned",
              details: `The result contains ${result.rows.length} rows`,
              hint: null,
            });
          }
          return send(response, 200, result.rows[0]);
        }
        return send(response, 200, result.rows);
      }

      switch (request.method) {
        case "POST": {
          const body = await readBody(request);
          const rows = (Array.isArray(body) ? body : [body]) as Array<Record<string, unknown>>;
          const columns = Object.keys(rows[0] ?? {});
          const tuples = rows.map(
            (row) =>
              `(${columns
                .map((column) => {
                  values.push(row[column] ?? null);
                  return `$${values.length}`;
                })
                .join(", ")})`,
          );
          sql = `with t as (insert into ${table} (${columns.map(quoteIdent).join(", ")}) values ${tuples.join(", ")} returning *)
                 select coalesce(json_agg(_r), '[]'::json) as body from (select ${select} from t) _r`;
          break;
        }
        case "PATCH": {
          const body = ((await readBody(request)) ?? {}) as Record<string, unknown>;
          const assignments = Object.entries(body).map(([column, value]) => {
            values.push(value ?? null);
            return `${quoteIdent(column)} = $${values.length}`;
          });
          const where = buildFilters(params, values);
          sql = `with t as (update ${table} t set ${assignments.join(", ")} ${where} returning t.*)
                 select coalesce(json_agg(_r), '[]'::json) as body from (select ${select} from t) _r`;
          break;
        }
        case "DELETE": {
          const where = buildFilters(params, values);
          sql = `with t as (delete from ${table} t ${where} returning t.*)
                 select coalesce(json_agg(_r), '[]'::json) as body from (select ${select} from t) _r`;
          break;
        }
        default:
          throw new PostgrestError(405, "PGRST117", `Unsupported method ${request.method}`);
      }

      const rows = (await runAs<unknown[]>(claims, sql, values)) ?? [];
      const wantsObject = request.headers.accept?.includes("application/vnd.pgrst.object+json");
      if (wantsObject) {
        if (rows.length !== 1) {
          return send(response, 406, {
            code: "PGRST116",
            message: "JSON object requested, multiple (or no) rows returned",
            details: `The result contains ${rows.length} rows`,
            hint: null,
          });
        }
        return send(response, request.method === "POST" ? 201 : 200, rows[0]);
      }
      return send(response, request.method === "POST" ? 201 : 200, rows);
    } catch (error) {
      if (error instanceof PostgrestError) {
        return send(response, error.status, { code: error.code, message: error.message, details: null, hint: null });
      }
      const pgError = error as { code?: string; message?: string; detail?: string; hint?: string };
      return send(response, pgErrorStatus(pgError.code, role), {
        code: pgError.code ?? "XX000",
        message: pgError.message ?? "Unknown error",
        details: pgError.detail ?? null,
        hint: pgError.hint ?? null,
      });
    }
  }

  const server: Server = createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", `http://${request.headers.host}`);
    try {
      if (request.headers.apikey !== publishableKey && (!secretKey || request.headers.apikey !== secretKey)) {
        return send(response, 401, { message: "Invalid API key" });
      }
      if (url.pathname.startsWith("/auth/v1/")) return await handleAuth(request, response, url);
      if (url.pathname.startsWith("/rest/v1/")) return await handleRest(request, response, url);
      return send(response, 404, { message: "Not found" });
    } catch (error) {
      return send(response, 500, { message: (error as Error).message });
    }
  });

  await new Promise<void>((resolve) => server.listen(port, "127.0.0.1", resolve));

  return {
    url: `http://127.0.0.1:${port}`,
    stop: () => new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  };
}
