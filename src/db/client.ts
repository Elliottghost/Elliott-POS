import { createRequire } from "node:module";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { drizzle as drizzleD1 } from "drizzle-orm/d1";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

/**
 * The application runs in two places:
 *
 *  - Local development, scripts and the test suite use better-sqlite3.
 *  - A deployed Freebuff Site runs on Cloudflare Workers, where the durable
 *    database is the D1 binding (env.DB). Native SQLite cannot be used there.
 *
 * Both drivers expose the same Drizzle query builder, so services keep using a
 * single `db` handle and never need to know which one is live.
 */
export type AppDatabase = BetterSQLite3Database<typeof schema>;

interface R2Like {
  put(key: string, value: ArrayBuffer | Uint8Array, options?: unknown): Promise<unknown>;
}

function isWorkersRuntime() {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.userAgent === "string" &&
    navigator.userAgent.includes("Cloudflare-Workers")
  );
}

/** Returns the live Worker environment, or null outside Cloudflare Workers. */
export function getWorkerEnv(): Record<string, unknown> | null {
  if (!isWorkersRuntime()) return null;
  try {
    const { env } = getCloudflareContext({ async: false });
    return (env ?? null) as Record<string, unknown> | null;
  } catch {
    return null;
  }
}

let cached: AppDatabase | null = null;
let cachedSqlite: unknown = null;

function resolveDatabase(): AppDatabase {
  if (cached) return cached;

  const env = getWorkerEnv();
  const binding = env?.DB as D1Database | undefined;
  if (binding) {
    cached = drizzleD1(binding, { schema }) as unknown as AppDatabase;
    return cached;
  }

  // Node-only fallback. The package name is assembled at runtime so bundlers
  // never try to include the native module in the Workers bundle.
  const nodeRequire = createRequire(import.meta.url);
  const Database = nodeRequire(["better", "sqlite3"].join("-"));
  const { drizzle } = nodeRequire("drizzle-orm/better-sqlite3");
  const databaseUrl = process.env.DATABASE_URL ?? "./data/vista-kigali.db";
  const sqlite = new Database(databaseUrl);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");

  cachedSqlite = sqlite;
  cached = drizzle(sqlite, { schema }) as AppDatabase;
  return cached;
}

/**
 * A proxy keeps the existing synchronous import style (`import { db }`) while
 * the underlying driver is chosen per runtime.
 */
export const db = new Proxy({} as AppDatabase, {
  get(_target, property) {
    const instance = resolveDatabase() as unknown as Record<PropertyKey, unknown>;
    const value = instance[property];
    return typeof value === "function" ? value.bind(instance) : value;
  },
}) as AppDatabase;

/** Raw better-sqlite3 handle — only available when running on Node. */
export const sqlite = new Proxy({} as Record<string, unknown>, {
  get(_target, property) {
    resolveDatabase();
    const handle = cachedSqlite as Record<PropertyKey, unknown> | null;
    const value = handle?.[property];
    return typeof value === "function" ? value.bind(handle) : value;
  },
});

export type { R2Like };
