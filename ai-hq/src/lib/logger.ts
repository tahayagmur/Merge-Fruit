/**
 * Structured JSON logger with redaction. Every server-side log line goes
 * through `redact`, so passwords, tokens, API keys, cookies and connection
 * string credentials never reach stdout / log files.
 *
 * Output is one JSON object per line on stdout/stderr, which works with
 * `docker logs`, journald and most log shippers without extra parsing.
 */

type Level = "debug" | "info" | "warn" | "error";

const REDACTED = "[REDACTED]";
const MAX_DEPTH = 6;

const SENSITIVE_KEY =
  /pass(word|wd)?|secret|token|api[-_]?key|apikey|authorization|cookie|session|private[-_]?key|credential|signature|jwt/i;

const SENSITIVE_PATTERNS: Array<[RegExp, string]> = [
  // JWTs (header.payload.signature)
  [/\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\b/g, REDACTED],
  // Supabase keys
  [/\bsb_(secret|publishable)_[A-Za-z0-9_-]+/g, REDACTED],
  // Bearer / Basic credentials
  [/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{8,}/gi, `$1 ${REDACTED}`],
  // Credentials inside URLs: scheme://user:password@host
  [/([a-z][a-z0-9+.-]*:\/\/[^:/\s@]+:)[^@\s/]+@/gi, `$1${REDACTED}@`],
  // key=value pairs in query strings or messages
  [/\b(password|passwd|token|api[_-]?key|apikey|secret|access_token|refresh_token)=([^&\s"']+)/gi, `$1=${REDACTED}`],
];

export function redactString(value: string): string {
  return SENSITIVE_PATTERNS.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), value);
}

export function redact(value: unknown, depth = 0, seen = new WeakSet<object>()): unknown {
  if (typeof value === "string") return redactString(value);
  if (value === null || typeof value !== "object") return value;
  if (depth >= MAX_DEPTH) return "[Truncated]";
  if (seen.has(value)) return "[Circular]";
  seen.add(value);

  if (value instanceof Error) {
    const error = value as Error & { code?: unknown; status?: unknown; cause?: unknown };
    return {
      name: error.name,
      message: redactString(error.message),
      ...(error.code !== undefined ? { code: redact(error.code, depth + 1, seen) } : {}),
      ...(error.status !== undefined ? { status: error.status } : {}),
      ...(process.env.NODE_ENV !== "production" && error.stack ? { stack: redactString(error.stack) } : {}),
      ...(error.cause !== undefined ? { cause: redact(error.cause, depth + 1, seen) } : {}),
    };
  }

  if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1, seen));

  const output: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    output[key] = SENSITIVE_KEY.test(key) ? REDACTED : redact(item, depth + 1, seen);
  }
  return output;
}

function write(level: Level, message: string, context?: Record<string, unknown>) {
  const line = JSON.stringify({
    time: new Date().toISOString(),
    level,
    msg: redactString(message),
    ...(context ? (redact(context) as Record<string, unknown>) : {}),
  });
  if (level === "error" || level === "warn") console.error(line);
  else console.log(line);
}

export const logger = {
  debug: (message: string, context?: Record<string, unknown>) => {
    if (process.env.NODE_ENV !== "production") write("debug", message, context);
  },
  info: (message: string, context?: Record<string, unknown>) => write("info", message, context),
  warn: (message: string, context?: Record<string, unknown>) => write("warn", message, context),
  error: (message: string, context?: Record<string, unknown>) => write("error", message, context),
};
