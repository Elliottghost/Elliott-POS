import { describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  auditLogs,
  branches,
  passwordResetTokens,
  roles,
  users,
} from "@/db/schema";
import {
  hashPassword,
  validatePasswordStrength,
  verifyPassword,
} from "@/lib/auth/password";
import { authenticate, loadPermissionsForRole } from "@/lib/auth/session";
import {
  branchScope,
  canAccessBranch,
  hasPermission,
  isSuperAdmin,
} from "@/lib/auth/access";
import { canAssignRole, canManageStaffMember } from "@/lib/auth/staff-rules";
import { completePasswordReset, requestPasswordReset } from "@/lib/auth/reset";
import {
  createStaffAccount,
  getStaffDetail,
  listStaff,
  updateStaffAccount,
} from "@/services/staff";
import { listBranches } from "@/services/branches";
import { getSettingsMap, updateSettings } from "@/services/settings";
import { listAuditLogs } from "@/services/audit";
import type { SessionUser as SessionUserType } from "@/lib/auth/session";

async function getUser(email: string) {
  const [row] = await db
    .select({ user: users, role: roles })
    .from(users)
    .innerJoin(roles, eq(roles.id, users.roleId))
    .where(eq(users.email, email))
    .limit(1);
  if (!row) throw new Error(`Missing fixture user ${email}`);
  return row;
}

async function asSessionUser(email: string): Promise<SessionUserType> {
  const { user, role } = await getUser(email);
  const permissions = await loadPermissionsForRole(role.id);
  const [branch] = user.branchId
    ? await db.select().from(branches).where(eq(branches.id, user.branchId)).limit(1)
    : [];

  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    phone: user.phone,
    roleId: role.id,
    roleName: role.name,
    roleLabel: role.label,
    branchId: user.branchId,
    branchName: branch?.name ?? null,
    branchCode: branch?.code ?? null,
    permissions,
    mustChangePassword: user.mustChangePassword,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
  };
}

async function branchIdFor(code: string) {
  const [branch] = await db
    .select({ id: branches.id })
    .from(branches)
    .where(eq(branches.code, code))
    .limit(1);
  if (!branch) throw new Error(`Missing branch ${code}`);
  return branch.id;
}

const validStaff = {
  fullName: "Test Waiter",
  email: "test.waiter@vistakigali.rw",
  phone: "+250788000111",
  password: "WaiterPass#2026",
  employeeCode: "VK-9001",
  employmentType: "full_time" as const,
  roleId: "waiter",
};

describe("password handling", () => {
  it("hashes with a unique salt and verifies the original password", async () => {
    const first = await hashPassword("Str0ngPassword!");
    const second = await hashPassword("Str0ngPassword!");

    expect(first).not.toBe(second);
    expect(first.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("Str0ngPassword!", first)).toBe(true);
    expect(await verifyPassword("wrong-password", first)).toBe(false);
  });

  it("rejects weak passwords with actionable messages", () => {
    const issues = validatePasswordStrength("short");
    expect(issues.length).toBeGreaterThanOrEqual(3);

    expect(validatePasswordStrength("LongEnough123")).toHaveLength(0);
  });

  it("never stores the plaintext password", async () => {
    const { user } = await getUser("cashier.kimironko@vistakigali.rw");
    expect(user.passwordHash).not.toContain("Cashier#2026");
  });
});

describe("authenticate", () => {
  it("returns the session user for valid credentials", async () => {
    const user = await authenticate("ADMIN@VISTAKIGALI.RW", "VistaAdmin#2026");
    expect(user).not.toBeNull();
    expect(user?.roleName).toBe("super_admin");
    expect(user?.permissions).toContain("branches.manage");
  });

  it("is case-insensitive on email but not on password", async () => {
    expect(await authenticate("admin@vistakigali.rw", "vistaadmin#2026")).toBeNull();
  });

  it("rejects unknown accounts", async () => {
    expect(await authenticate("nobody@vistakigali.rw", "Whatever#12345")).toBeNull();
  });

  it("refuses deactivated accounts", async () => {
    const { user } = await getUser("cashier.kimironko@vistakigali.rw");
    await db.update(users).set({ isActive: false }).where(eq(users.id, user.id));

    expect(await authenticate("cashier.kimironko@vistakigali.rw", "Cashier#2026")).toBeNull();

    await db.update(users).set({ isActive: true }).where(eq(users.id, user.id));
  });
});

describe("role permissions", () => {
  it("grants super administrators every permission and global scope", async () => {
    const admin = await asSessionUser("admin@vistakigali.rw");
    expect(isSuperAdmin(admin)).toBe(true);
    expect(hasPermission(admin, "roles.manage")).toBe(true);
    expect(hasPermission(admin, "settings.manage")).toBe(true);
    expect(branchScope(admin)).toBeNull();
  });

  it("limits cashiers to dashboard and report viewing", async () => {
    const cashier = await asSessionUser("cashier.kimironko@vistakigali.rw");
    expect(hasPermission(cashier, "dashboard.view")).toBe(true);
    expect(hasPermission(cashier, "staff.manage")).toBe(false);
    expect(hasPermission(cashier, "branches.manage")).toBe(false);
    expect(hasPermission(cashier, "settings.manage")).toBe(false);
    expect(hasPermission(cashier, "reports.view_all")).toBe(false);
  });

  it("scopes branch managers to their own branch", async () => {
    const manager = await asSessionUser("manager.kimironko@vistakigali.rw");
    const kimironko = await branchIdFor("KIM");
    const rondPoint = await branchIdFor("RDP");

    expect(branchScope(manager)).toEqual([kimironko]);
    expect(canAccessBranch(manager, kimironko)).toBe(true);
    expect(canAccessBranch(manager, rondPoint)).toBe(false);
  });

  it("prevents a branch manager from assigning super administrator", async () => {
    const manager = await asSessionUser("manager.kimironko@vistakigali.rw");
    const [superRole] = await db.select().from(roles).where(eq(roles.name, "super_admin"));
    const [cashierRole] = await db.select().from(roles).where(eq(roles.name, "cashier"));

    expect(canAssignRole(manager, 10, superRole)).toBe(false);
    expect(canAssignRole(manager, 10, cashierRole)).toBe(true);
  });

  it("blocks self-management", async () => {
    const manager = await asSessionUser("manager.kimironko@vistakigali.rw");
    expect(
      canManageStaffMember(manager, 10, {
        userId: manager.id,
        roleName: "branch_manager",
        roleRank: 10,
        branchId: manager.branchId,
      }),
    ).toBe(false);
  });
});

describe("branch separation", () => {
  it("only lists staff from the manager's branch", async () => {
    const manager = await asSessionUser("manager.kimironko@vistakigali.rw");
    const staff = await listStaff(branchScope(manager));
    const rondPoint = await branchIdFor("RDP");

    expect(staff.length).toBeGreaterThan(0);
    expect(staff.every((member) => member.branchId !== rondPoint)).toBe(true);
    expect(staff.some((member) => member.email === "admin@vistakigali.rw")).toBe(false);
  });

  it("shows every branch to a super administrator", async () => {
    const admin = await asSessionUser("admin@vistakigali.rw");
    const all = await listBranches(branchScope(admin), { includeInactive: true });

    expect(all.map((branch) => branch.code).sort()).toEqual(["KIM", "RDP"]);
  });

  it("returns one branch for a scoped manager", async () => {
    const manager = await asSessionUser("manager.kimironko@vistakigali.rw");
    const scoped = await listBranches(branchScope(manager), { includeInactive: true });
    expect(scoped).toHaveLength(1);
    expect(scoped[0].code).toBe("KIM");
  });
});

describe("staff account lifecycle", () => {
  it("creates a real account, profile row and audit entry", async () => {
    const admin = await asSessionUser("admin@vistakigali.rw");
    const kimironko = await branchIdFor("KIM");

    const result = await createStaffAccount(admin, {
      ...validStaff,
      roleId: "waiter",
      branchId: kimironko,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const detail = await getStaffDetail(result.userId);
    expect(detail?.user.email).toBe(validStaff.email);
    expect(detail?.profile?.employeeCode).toBe("VK-9001");
    expect(detail?.user.branchId).toBe(kimironko);
    expect(detail?.user.mustChangePassword).toBe(true);

    const login = await authenticate(validStaff.email, validStaff.password);
    expect(login?.roleName).toBe("waiter");
    expect(login?.branchId).toBe(kimironko);

    const [audit] = await db
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.action, "staff.created"), eq(auditLogs.entityId, result.userId)));
    expect(audit).toBeTruthy();
    expect(audit.actorEmail).toBe("admin@vistakigali.rw");
  });

  it("rejects duplicate emails and employee codes", async () => {
    const admin = await asSessionUser("admin@vistakigali.rw");
    const kimironko = await branchIdFor("KIM");

    const duplicateEmail = await createStaffAccount(admin, {
      ...validStaff,
      email: validStaff.email,
      employeeCode: "VK-9002",
      branchId: kimironko,
    });
    expect(duplicateEmail.ok).toBe(false);

    const duplicateCode = await createStaffAccount(admin, {
      ...validStaff,
      email: "another@vistakigali.rw",
      employeeCode: "VK-9001",
      branchId: kimironko,
    });
    expect(duplicateCode.ok).toBe(false);
  });

  it("rejects weak initial passwords", async () => {
    const admin = await asSessionUser("admin@vistakigali.rw");
    const kimironko = await branchIdFor("KIM");

    const result = await createStaffAccount(admin, {
      ...validStaff,
      email: "weak@vistakigali.rw",
      employeeCode: "VK-9003",
      password: "weak",
      branchId: kimironko,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fieldErrors?.password?.length).toBeGreaterThan(0);
  });

  it("stops a branch manager from creating staff in another branch", async () => {
    const manager = await asSessionUser("manager.kimironko@vistakigali.rw");
    const rondPoint = await branchIdFor("RDP");

    const result = await createStaffAccount(manager, {
      ...validStaff,
      email: "cross.branch@vistakigali.rw",
      employeeCode: "VK-9004",
      roleId: "waiter",
      branchId: rondPoint,
    });

    expect(result.ok).toBe(false);
  });

  it("deactivates an account and blocks its sign-in", async () => {
    const admin = await asSessionUser("admin@vistakigali.rw");
    const kimironko = await branchIdFor("KIM");

    const created = await createStaffAccount(admin, {
      ...validStaff,
      email: "leaver@vistakigali.rw",
      employeeCode: "VK-9005",
      branchId: kimironko,
    });
    if (!created.ok) throw new Error("fixture creation failed");

    const detail = await getStaffDetail(created.userId);
    const result = await updateStaffAccount(admin, created.userId, {
      fullName: detail!.user.fullName,
      email: detail!.user.email,
      roleId: detail!.user.roleId,
      branchId: kimironko,
      employmentType: "full_time",
      isActive: false,
    });

    expect(result.ok).toBe(true);
    expect(await authenticate("leaver@vistakigali.rw", validStaff.password)).toBeNull();
  });
});

describe("password reset", () => {
  it("issues a single-use token, updates the password and invalidates the token", async () => {
    const manager = await asSessionUser("manager.kimironko@vistakigali.rw");

    const request = await requestPasswordReset(manager.email, "127.0.0.1");
    expect(request.requested).toBe(true);
    expect(request.devResetUrl).toBeTruthy();

    const token = new URL(request.devResetUrl!).searchParams.get("token")!;
    expect(token.length).toBeGreaterThan(20);

    const reset = await completePasswordReset(token, "BrandNewPass#2026");
    expect(reset.ok).toBe(true);

    expect(await authenticate(manager.email, "Kimironko#2026")).toBeNull();
    expect(await authenticate(manager.email, "BrandNewPass#2026")).not.toBeNull();

    const reuse = await completePasswordReset(token, "AnotherPass#2026");
    expect(reuse.ok).toBe(false);

    const [record] = await db
      .select()
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.userId, manager.id));
    expect(record.usedAt).not.toBeNull();
  });

  it("does not reveal whether an email exists", async () => {
    const request = await requestPasswordReset("ghost@vistakigali.rw", null);
    expect(request.requested).toBe(true);
    expect(request.devResetUrl).toBeUndefined();
  });

  it("rejects weak replacement passwords", async () => {
    const request = await requestPasswordReset("cashier.kimironko@vistakigali.rw", null);
    const token = new URL(request.devResetUrl!).searchParams.get("token")!;
    const result = await completePasswordReset(token, "short");
    expect(result.ok).toBe(false);
  });
});

describe("business settings", () => {
  it("persists setting changes and audits them", async () => {
    const admin = await asSessionUser("admin@vistakigali.rw");
    const before = await getSettingsMap();
    expect(before["business.name"]).toContain("Vista Kigali");

    const result = await updateSettings(admin, [
      { key: "business.phone", value: "+250 788 999 000" },
    ]);
    expect(result.ok).toBe(true);

    const after = await getSettingsMap();
    expect(after["business.phone"]).toBe("+250 788 999 000");

    const trail = await listAuditLogs(null, { action: "settings.updated", limit: 5 });
    expect(trail.length).toBeGreaterThan(0);
  });

  it("rejects numeric settings that are not numbers", async () => {
    const admin = await asSessionUser("admin@vistakigali.rw");
    const result = await updateSettings(admin, [
      { key: "operations.tax_percent", value: "eighteen" },
    ]);
    expect(result.ok).toBe(false);
  });
});

describe("audit trail", () => {
  it("records sign-in-adjacent account events with actor snapshots", async () => {
    const trail = await listAuditLogs(null, { limit: 100 });
    expect(trail.length).toBeGreaterThan(0);
    expect(trail.every((entry) => entry.action.length > 0)).toBe(true);

    const staffEvents = await listAuditLogs(null, {
      action: "staff.created",
      limit: 50,
    });
    expect(staffEvents.every((entry) => entry.actorName !== null)).toBe(true);
  });
});
