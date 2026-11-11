import { and, asc, desc, eq, inArray, like, ne, or, sql, type SQL } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { db } from "@/db/client";
import {
  branches,
  roles,
  sessions,
  staffProfiles,
  users,
} from "@/db/schema";
import { recordAudit } from "@/lib/audit";
import {
  canAssignRole,
  canManageStaffMember,
  isSuperAdminRole,
} from "@/lib/auth/staff-rules";
import { hashPassword, validatePasswordStrength, verifyPassword } from "@/lib/auth/password";
import { revokeSessionsForUser, type RequestMeta, type SessionUser } from "@/lib/auth/session";
import type { StaffCreateInput, StaffUpdateInput } from "@/lib/validation";

export interface StaffListItem {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  roleId: string;
  roleName: string;
  roleLabel: string;
  branchId: string | null;
  branchName: string | null;
  employeeCode: string | null;
  jobTitle: string | null;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
}

export interface StaffListFilters {
  search?: string;
  branchId?: string;
  roleId?: string;
  status?: "active" | "inactive" | "all";
}

function staffScope(scope: string[] | null): SQL | undefined {
  if (scope === null) return undefined;
  if (scope.length === 0) return sql`1 = 0`;
  return inArray(users.branchId, scope);
}

export async function listStaff(
  scope: string[] | null,
  filters: StaffListFilters = {},
): Promise<StaffListItem[]> {
  const conditions: SQL[] = [];
  const scoped = staffScope(scope);
  if (scoped) conditions.push(scoped);

  if (filters.search) {
    const term = `%${filters.search.trim()}%`;
    const searchCondition = or(
      like(users.fullName, term),
      like(users.email, term),
      like(staffProfiles.employeeCode, term),
    );
    if (searchCondition) conditions.push(searchCondition);
  }
  if (filters.branchId === "__unassigned__") {
    conditions.push(sql`${users.branchId} is null`);
  } else if (filters.branchId) {
    conditions.push(eq(users.branchId, filters.branchId));
  }
  if (filters.roleId) conditions.push(eq(users.roleId, filters.roleId));
  if (filters.status === "active") conditions.push(eq(users.isActive, true));
  if (filters.status === "inactive") conditions.push(eq(users.isActive, false));

  const rows = await db
    .select({
      id: users.id,
      fullName: users.fullName,
      email: users.email,
      phone: users.phone,
      roleId: users.roleId,
      roleName: roles.name,
      roleLabel: roles.label,
      branchId: users.branchId,
      branchName: branches.name,
      employeeCode: staffProfiles.employeeCode,
      jobTitle: staffProfiles.jobTitle,
      isActive: users.isActive,
      lastLoginAt: users.lastLoginAt,
      createdAt: users.createdAt,
    })
    .from(users)
    .innerJoin(roles, eq(roles.id, users.roleId))
    .leftJoin(branches, eq(branches.id, users.branchId))
    .leftJoin(staffProfiles, eq(staffProfiles.userId, users.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(users.isActive), asc(users.fullName));

  return rows;
}

export async function getStaffDetail(userId: string) {
  const [row] = await db
    .select({
      user: users,
      role: roles,
      branch: branches,
      profile: staffProfiles,
    })
    .from(users)
    .innerJoin(roles, eq(roles.id, users.roleId))
    .leftJoin(branches, eq(branches.id, users.branchId))
    .leftJoin(staffProfiles, eq(staffProfiles.userId, users.id))
    .where(eq(users.id, userId))
    .limit(1);

  return row ?? null;
}

export async function listRoles() {
  return db.select().from(roles).orderBy(asc(roles.rank), asc(roles.label));
}

export async function getRoleById(roleId: string) {
  const [row] = await db.select().from(roles).where(eq(roles.id, roleId)).limit(1);
  return row ?? null;
}

export async function getActorRank(user: SessionUser): Promise<number> {
  const role = await getRoleById(user.roleId);
  return role?.rank ?? 999;
}

export type StaffMutationResult =
  | { ok: true; userId: string; temporaryPassword?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

function createTemporaryPassword() {
  // Avoid ambiguous characters for hand-written shift handovers.
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = randomBytes(14);
  let value = "";
  for (const byte of bytes) value += alphabet[byte % alphabet.length];
  return `${value.slice(0, 4)}-${value.slice(4, 9)}-${value.slice(9)}aA1`;
}

async function assertBranchUsable(branchId: string | undefined) {
  if (!branchId) return { ok: false as const, error: "Assign the staff member to a branch." };
  const [branch] = await db
    .select({ id: branches.id, isActive: branches.isActive, name: branches.name })
    .from(branches)
    .where(eq(branches.id, branchId))
    .limit(1);
  if (!branch) return { ok: false as const, error: "Selected branch was not found." };
  if (!branch.isActive) {
    return { ok: false as const, error: `Branch "${branch.name}" is inactive.` };
  }
  return { ok: true as const, branch };
}

export async function createStaffAccount(
  actor: SessionUser,
  input: StaffCreateInput,
  meta?: RequestMeta,
): Promise<StaffMutationResult> {
  const passwordIssues = validatePasswordStrength(input.password);
  if (passwordIssues.length > 0) {
    return {
      ok: false,
      error: "Choose a stronger initial password.",
      fieldErrors: { password: passwordIssues.map((issue) => issue.message) },
    };
  }

  const actorRank = await getActorRank(actor);
  const role = await getRoleById(input.roleId ?? "");
  if (!role) return { ok: false, error: "Selected role was not found.", fieldErrors: { roleId: ["Select a valid role."] } };

  if (!canAssignRole(actor, actorRank, role)) {
    return { ok: false, error: "You cannot assign that role.", fieldErrors: { roleId: ["You cannot assign that role."] } };
  }

  const isSuper = isSuperAdminRole(role.name);
  let branchId = input.branchId ?? null;

  if (isSuper) {
    branchId = null;
  } else {
    const branchCheck = await assertBranchUsable(branchId ?? undefined);
    if (!branchCheck.ok) {
      return { ok: false, error: branchCheck.error, fieldErrors: { branchId: [branchCheck.error] } };
    }
    if (!isSuperAdminRole(actor.roleName) && branchId !== actor.branchId) {
      return {
        ok: false,
        error: "You can only add staff to your own branch.",
        fieldErrors: { branchId: ["You can only add staff to your own branch."] },
      };
    }
  }

  const [existingEmail] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, input.email))
    .limit(1);
  if (existingEmail) {
    return {
      ok: false,
      error: "An account with that email already exists.",
      fieldErrors: { email: ["Email is already registered."] },
    };
  }

  const [existingCode] = await db
    .select({ id: staffProfiles.id })
    .from(staffProfiles)
    .where(eq(staffProfiles.employeeCode, input.employeeCode))
    .limit(1);
  if (existingCode) {
    return {
      ok: false,
      error: "That employee code is already in use.",
      fieldErrors: { employeeCode: ["Employee code must be unique."] },
    };
  }

  const passwordHash = await hashPassword(input.password);

  const [userRow] = await db
    .insert(users)
    .values({
      email: input.email,
      passwordHash,
      fullName: input.fullName,
      phone: input.phone ?? null,
      roleId: role.id,
      branchId,
      isActive: true,
      mustChangePassword: true,
      passwordChangedAt: new Date(),
    })
    .returning({ id: users.id });

  await db.insert(staffProfiles).values({
    userId: userRow.id,
    employeeCode: input.employeeCode,
    jobTitle: input.jobTitle ?? role.label,
    nationalId: input.nationalId ?? null,
    residentialAddress: input.residentialAddress ?? null,
    emergencyContactName: input.emergencyContactName ?? null,
    emergencyContactPhone: input.emergencyContactPhone ?? null,
    hiredAt: input.hiredAt ?? new Date().toISOString().slice(0, 10),
    employmentType: input.employmentType,
    notes: input.notes ?? null,
  });

  const created = userRow;

  await recordAudit({
    actor,
    action: "staff.created",
    entityType: "user",
    entityId: created.id,
    branchId,
    description: `Staff account created for ${input.fullName} (${role.label}).`,
    metadata: { email: input.email, role: role.name, employeeCode: input.employeeCode },
    meta,
  });

  return { ok: true, userId: created.id };
}

export async function updateStaffAccount(
  actor: SessionUser,
  userId: string,
  input: StaffUpdateInput,
  meta?: RequestMeta,
): Promise<StaffMutationResult> {
  const target = await getStaffDetail(userId);
  if (!target) return { ok: false, error: "Staff member not found." };

  const actorRank = await getActorRank(actor);
  if (!canManageStaffMember(actor, actorRank, {
    userId: target.user.id,
    roleName: target.role.name,
    roleRank: target.role.rank,
    branchId: target.user.branchId,
  })) {
    return { ok: false, error: "You cannot manage this staff member." };
  }

  const role = await getRoleById(input.roleId ?? "");
  if (!role) {
    return { ok: false, error: "Selected role was not found.", fieldErrors: { roleId: ["Select a valid role."] } };
  }
  if (!canAssignRole(actor, actorRank, role)) {
    return { ok: false, error: "You cannot assign that role.", fieldErrors: { roleId: ["You cannot assign that role."] } };
  }

  let branchId = input.branchId ?? null;
  if (isSuperAdminRole(role.name)) {
    branchId = null;
  } else {
    const branchCheck = await assertBranchUsable(branchId ?? undefined);
    if (!branchCheck.ok) {
      return { ok: false, error: branchCheck.error, fieldErrors: { branchId: [branchCheck.error] } };
    }
    if (!isSuperAdminRole(actor.roleName) && branchId !== actor.branchId) {
      return {
        ok: false,
        error: "You can only assign staff to your own branch.",
        fieldErrors: { branchId: ["You can only assign staff to your own branch."] },
      };
    }
  }

  if (input.email !== target.user.email) {
    const [emailOwner] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.email, input.email), ne(users.id, userId)))
      .limit(1);
    if (emailOwner) {
      return {
        ok: false,
        error: "An account with that email already exists.",
        fieldErrors: { email: ["Email is already registered."] },
      };
    }
  }

  const losesSuperAdmin =
    isSuperAdminRole(target.role.name) &&
    (!isSuperAdminRole(role.name) || !input.isActive);

  if (losesSuperAdmin) {
    const [superCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .innerJoin(roles, eq(roles.id, users.roleId))
      .where(and(eq(roles.name, "super_admin"), eq(users.isActive, true)));
    if (Number(superCount?.count ?? 0) <= 1) {
      return {
        ok: false,
        error: "The platform must keep at least one active super administrator.",
      };
    }
  }

  if (!input.isActive) {
    if (target.user.id === actor.id) {
      return { ok: false, error: "You cannot deactivate your own account." };
    }
  }

  await db
    .update(users)
    .set({
      fullName: input.fullName,
      email: input.email,
      phone: input.phone ?? null,
      roleId: role.id,
      branchId,
      isActive: input.isActive,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));

  await db
    .update(staffProfiles)
    .set({
      jobTitle: input.jobTitle ?? null,
      employmentType: input.employmentType,
      nationalId: input.nationalId ?? null,
      residentialAddress: input.residentialAddress ?? null,
      emergencyContactName: input.emergencyContactName ?? null,
      emergencyContactPhone: input.emergencyContactPhone ?? null,
      notes: input.notes ?? null,
      updatedAt: new Date(),
    })
    .where(eq(staffProfiles.userId, userId));

  if (!input.isActive) {
    await revokeSessionsForUser(userId);
  }

  await recordAudit({
    actor,
    action: "staff.updated",
    entityType: "user",
    entityId: userId,
    branchId,
    description: `Staff account for ${input.fullName} updated.`,
    metadata: {
      before: {
        fullName: target.user.fullName,
        email: target.user.email,
        role: target.role.name,
        branchId: target.user.branchId,
        isActive: target.user.isActive,
      },
      after: {
        fullName: input.fullName,
        email: input.email,
        role: role.name,
        branchId,
        isActive: input.isActive,
      },
    },
    meta,
  });

  return { ok: true, userId };
}

export async function generateTemporaryPassword(
  actor: SessionUser,
  userId: string,
  meta?: RequestMeta,
): Promise<StaffMutationResult> {
  const target = await getStaffDetail(userId);
  if (!target) return { ok: false, error: "Staff member not found." };

  const actorRank = await getActorRank(actor);
  if (
    !canManageStaffMember(actor, actorRank, {
      userId: target.user.id,
      roleName: target.role.name,
      roleRank: target.role.rank,
      branchId: target.user.branchId,
    })
  ) {
    return { ok: false, error: "You cannot reset this staff member's password." };
  }

  const temporaryPassword = createTemporaryPassword();
  const passwordHash = await hashPassword(temporaryPassword);

  await db
    .update(users)
    .set({
      passwordHash,
      mustChangePassword: true,
      passwordChangedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));

  await revokeSessionsForUser(userId);

  await recordAudit({
    actor,
    action: "staff.password_reset",
    entityType: "user",
    entityId: userId,
    branchId: target.user.branchId,
    description: `Temporary password issued for ${target.user.fullName}.`,
    meta,
  });

  return { ok: true, userId, temporaryPassword };
}

export async function changeOwnPassword(
  user: SessionUser,
  currentPassword: string,
  nextPassword: string,
  meta?: RequestMeta,
): Promise<StaffMutationResult> {
  const issues = validatePasswordStrength(nextPassword);
  if (issues.length > 0) {
    return {
      ok: false,
      error: "Choose a stronger password.",
      fieldErrors: { password: issues.map((issue) => issue.message) },
    };
  }

  const [row] = await db
    .select({ passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);

  if (!row || !(await verifyPassword(currentPassword, row.passwordHash))) {
    return { ok: false, error: "Current password is incorrect.", fieldErrors: { currentPassword: ["Current password is incorrect."] } };
  }

  const passwordHash = await hashPassword(nextPassword);
  const now = new Date();

  await db
    .update(users)
    .set({
      passwordHash,
      mustChangePassword: false,
      passwordChangedAt: now,
      updatedAt: now,
    })
    .where(eq(users.id, user.id));

  // End every other session; the current session stays valid.
  const { getCurrentSessionId } = await import("@/lib/auth/session");
  const currentSessionId = await getCurrentSessionId();
  await db
    .delete(sessions)
    .where(
      currentSessionId
        ? and(eq(sessions.userId, user.id), ne(sessions.id, currentSessionId))
        : eq(sessions.userId, user.id),
    );

  await recordAudit({
    actor: user,
    action: "auth.password_changed",
    entityType: "user",
    entityId: user.id,
    branchId: user.branchId,
    description: "Password changed from the account page.",
    meta,
  });

  return { ok: true, userId: user.id };
}

export async function staffCountByRole(scope: string[] | null) {
  const scoped = staffScope(scope);
  return db
    .select({
      roleName: roles.name,
      roleLabel: roles.label,
      count: sql<number>`count(*)`,
    })
    .from(users)
    .innerJoin(roles, eq(roles.id, users.roleId))
    .where(scoped ?? undefined)
    .groupBy(roles.name, roles.label)
    .orderBy(asc(roles.rank));
}
