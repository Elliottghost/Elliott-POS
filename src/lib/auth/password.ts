import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
  type ScryptOptions,
} from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options: ScryptOptions,
) => Promise<Buffer>;

const KEY_LENGTH = 64;
const SALT_LENGTH = 16;
const PARAMS = { N: 16384, r: 8, p: 1 } as const;
const PREFIX = "scrypt";

/**
 * Hash a plaintext password with scrypt and a per-password random salt.
 * Stored format: scrypt$N$r$p$saltHex$hashHex
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const derived = (await scrypt(password, salt, KEY_LENGTH, {
    N: PARAMS.N,
    r: PARAMS.r,
    p: PARAMS.p,
  })) as Buffer;

  return [
    PREFIX,
    PARAMS.N,
    PARAMS.r,
    PARAMS.p,
    salt.toString("hex"),
    derived.toString("hex"),
  ].join("$");
}

export async function verifyPassword(
  password: string,
  storedHash: string,
): Promise<boolean> {
  const parts = storedHash.split("$");
  if (parts.length !== 6 || parts[0] !== PREFIX) return false;

  const [, rawN, rawR, rawP, saltHex, hashHex] = parts;
  const N = Number(rawN);
  const r = Number(rawR);
  const p = Number(rawP);
  if (!Number.isFinite(N) || !Number.isFinite(r) || !Number.isFinite(p)) {
    return false;
  }

  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(hashHex, "hex");
  if (expected.length === 0) return false;

  const derived = (await scrypt(password, salt, expected.length, {
    N,
    r,
    p,
    maxmem: 256 * 1024 * 1024,
  })) as Buffer;

  return derived.length === expected.length && timingSafeEqual(derived, expected);
}

export const PASSWORD_MIN_LENGTH = 10;

export interface PasswordIssue {
  message: string;
}

export function validatePasswordStrength(password: string): PasswordIssue[] {
  const issues: PasswordIssue[] = [];
  if (password.length < PASSWORD_MIN_LENGTH) {
    issues.push({
      message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`,
    });
  }
  if (!/[a-z]/.test(password)) {
    issues.push({ message: "Password must include a lowercase letter." });
  }
  if (!/[A-Z]/.test(password)) {
    issues.push({ message: "Password must include an uppercase letter." });
  }
  if (!/[0-9]/.test(password)) {
    issues.push({ message: "Password must include a number." });
  }
  return issues;
}
