/** RFC 6238 TOTP (SHA-1, 6 digits, 30 s), TEST-ONLY: used by the emulator and the MFA tests. */
import { createHmac, randomBytes } from "node:crypto";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const STEP_MS = 30_000;

export function base32Encode(bytes: Buffer): string {
  let bits = "";
  for (const byte of bytes) bits += byte.toString(2).padStart(8, "0");
  let out = "";
  for (let index = 0; index < bits.length; index += 5) out += ALPHABET[parseInt(bits.slice(index, index + 5).padEnd(5, "0"), 2)];
  return out;
}

export function base32Decode(text: string): Buffer {
  let bits = "";
  for (const char of text.replace(/=+$/, "").toUpperCase()) {
    const value = ALPHABET.indexOf(char);
    if (value < 0) throw new Error("Invalid base32");
    bits += value.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) bytes.push(parseInt(bits.slice(index, index + 8), 2));
  return Buffer.from(bytes);
}

export function newTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

export function totp(secret: string, time = Date.now()): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(time / STEP_MS)));
  const hash = createHmac("sha1", base32Decode(secret)).update(counter).digest();
  const offset = hash[hash.length - 1] & 0x0f;
  return String((hash.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).padStart(6, "0");
}

/** Accepts the current step and one step either side (clock drift). */
export function verifyTotp(secret: string, code: string, time = Date.now()): boolean {
  return [-1, 0, 1].some((drift) => totp(secret, time + drift * STEP_MS) === code);
}

/** A code with a few seconds of validity left, so it does not expire in flight. */
export async function freshTotp(secret: string): Promise<string> {
  const left = STEP_MS - (Date.now() % STEP_MS);
  if (left < 4_000) await new Promise((resolve) => setTimeout(resolve, left + 250));
  return totp(secret);
}

/** A well-formed code that is not valid now. */
export function wrongTotp(secret: string): string {
  const valid = new Set([-1, 0, 1].map((drift) => totp(secret, Date.now() + drift * STEP_MS)));
  let candidate = 123456;
  while (valid.has(String(candidate))) candidate += 1;
  return String(candidate);
}
