import { vi } from "vitest";

// `server-only` throws when imported outside a React Server environment.
// Unit tests exercise server modules directly, so replace it with a no-op.
vi.mock("server-only", () => ({}));
