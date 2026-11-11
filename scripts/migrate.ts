import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { db, sqlite } from "../src/db/client";

migrate(db, { migrationsFolder: "./drizzle" });
console.log("Migrations applied to", process.env.DATABASE_URL ?? "data/vista-kigali.db");
sqlite.close();
