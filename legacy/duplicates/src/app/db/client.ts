import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

const databaseUrl = process.env.DATABASE_URL ?? "./data/vista-kigali.db";

function resolveDatabasePath(url: string) {
  if (url === ":memory:") return url;
  return path.isAbsolute(url) ? url : path.join(process.cwd(), url);
}

function createConnection() {
  const file = resolveDatabasePath(databaseUrl);
  if (file !== ":memory:") {
    fs.mkdirSync(path.dirname(file), { recursive: true });
  }

  const sqlite = new Database(file);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");

  return { sqlite, db: drizzle(sqlite, { schema }) };
}

type Connection = ReturnType<typeof createConnection>;

// Reuse the connection across HMR reloads and server action invocations.
const globalForDb = globalThis as unknown as { __vistaDb?: Connection };

const connection = globalForDb.__vistaDb ?? createConnection();

if (process.env.NODE_ENV !== "production") {
  globalForDb.__vistaDb = connection;
}

export const sqlite = connection.sqlite;
export const db = connection.db;
export { schema };
