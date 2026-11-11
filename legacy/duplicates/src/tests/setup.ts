import fs from "node:fs";
import path from "node:path";

const TEST_DB = "./data/test-foundation.db";

process.env.DATABASE_URL = TEST_DB;
process.env.APP_URL = "http://localhost:3000";
process.env.AUTH_EXPOSE_RESET_LINKS = "true";

for (const suffix of ["", "-journal", "-wal", "-shm"]) {
  const file = path.join(process.cwd(), `${TEST_DB}${suffix}`);
  if (fs.existsSync(file)) fs.rmSync(file);
}

const { migrate } = await import("drizzle-orm/better-sqlite3/migrator");
const { db } = await import("@/db/client");
const schema = await import("@/db/schema");
const { PERMISSIONS, ROLE_DEFINITIONS, ALL_PERMISSION_IDS } = await import(
  "@/lib/permissions"
);
const { hashPassword } = await import("@/lib/auth/password");
const { ensureDefaultSettings } = await import("@/services/settings");

migrate(db, { migrationsFolder: "./drizzle" });

for (const permission of PERMISSIONS) {
  db.insert(schema.permissions)
    .values({
      id: permission.id,
      label: permission.label,
      description: permission.description,
      category: permission.category,
    })
    .run();
}

for (const role of ROLE_DEFINITIONS) {
  db.insert(schema.roles)
    .values({
      id: role.name,
      name: role.name,
      label: role.label,
      description: role.description,
      rank: role.rank,
    })
    .run();

  const granted = role.permissions[0] === "*" ? ALL_PERMISSION_IDS : role.permissions;
  for (const permissionId of granted) {
    db.insert(schema.rolePermissions)
      .values({ roleId: role.name, permissionId })
      .onConflictDoNothing()
      .run();
  }
}

const kimironkoId = crypto.randomUUID();
const rondPointId = crypto.randomUUID();

db.insert(schema.branches)
  .values([
    {
      id: kimironkoId,
      name: "Kimironko — Ku Isangano",
      slug: "kimironko",
      code: "KIM",
      address: "Ku Isangano",
      city: "Kigali",
    },
    {
      id: rondPointId,
      name: "Rond-Point — Kuri Azam",
      slug: "rond-point",
      code: "RDP",
      address: "Kuri Azam",
      city: "Kigali",
    },
  ])
  .run();

const adminHash = await hashPassword("VistaAdmin#2026");
const managerHash = await hashPassword("Kimironko#2026");
const cashierHash = await hashPassword("Cashier#2026");

const seedUser = (
  email: string,
  fullName: string,
  roleId: string,
  branchId: string | null,
  passwordHash: string,
  employeeCode: string,
) => {
  const id = crypto.randomUUID();
  db.insert(schema.users)
    .values({
      id,
      email,
      fullName,
      roleId,
      branchId,
      passwordHash,
      isActive: true,
    })
    .run();
  db.insert(schema.staffProfiles)
    .values({ userId: id, employeeCode, jobTitle: "Test" })
    .run();
  return id;
};

export const FIXTURES = {
  kimironkoId,
  rondPointId,
  adminId: seedUser(
    "admin@vistakigali.rw",
    "Aline Uwase",
    "super_admin",
    null,
    adminHash,
    "VK-0001",
  ),
  managerId: seedUser(
    "manager.kimironko@vistakigali.rw",
    "Eric Mugisha",
    "branch_manager",
    kimironkoId,
    managerHash,
    "VK-0101",
  ),
  cashierId: seedUser(
    "cashier.kimironko@vistakigali.rw",
    "Jean Bosco Habimana",
    "cashier",
    kimironkoId,
    cashierHash,
    "VK-0102",
  ),
};

await ensureDefaultSettings();
