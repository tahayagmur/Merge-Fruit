/**
 * Security headers for every response, applied in next.config.ts.
 *
 * Content Security Policy: Next.js can only attach per-request nonces to its
 * scripts when every page is rendered dynamically, which Partial Prerendering
 * (cacheComponents) rules out. Scripts and styles therefore allow inline code
 * from this origin, while everything an injected payload would need from
 * elsewhere is blocked: no third-party scripts, styles, frames, plugins, form
 * targets or <base> rewrites, and the browser may only talk to this origin
 * (all Supabase calls happen on the server).
 */
export function contentSecurityPolicy({ dev }: { dev: boolean }): string {
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    // React uses eval() for better error stacks in development only.
    "script-src": ["'self'", "'unsafe-inline'", ...(dev ? ["'unsafe-eval'"] : [])],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:"],
    "font-src": ["'self'", "data:"],
    // Development adds the hot-reload WebSocket.
    "connect-src": ["'self'", ...(dev ? ["ws:", "wss:"] : [])],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
    "frame-src": ["'none'"],
    "worker-src": ["'self'", "blob:"],
    "manifest-src": ["'self'"],
  };
  return Object.entries(directives)
    .map(([name, values]) => `${name} ${values.join(" ")}`)
    .join("; ");
}

export function securityHeaders({ dev }: { dev: boolean }): Array<{ key: string; value: string }> {
  return [
    { key: "Content-Security-Policy", value: contentSecurityPolicy({ dev }) },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ];
}
