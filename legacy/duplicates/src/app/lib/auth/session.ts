import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, gt, lt } from "drizzle-orm";
import { createHash, randomBytes } from "node:crypto";
import { db } from "@/db/client";
import {
  branches,
  permissions as permissionsTable,
  rolePermissions,
  roles,
  sessions,
  users,
} from "@/db/schema";
import { verifyPassword } from "./password";
import type { PermissionId } from "@/lib/permissions";

export const SESSION_COOKIE = "vista_session";
export const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12h — shared terminals

export interface SessionUser {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  roleId: string;
  roleName: string;
  roleLabel: string;
  branchId: string | null;
  branchName: string | null;
  branchCode: string | null;
  permissions: PermissionId[];
  mustChangePassword: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
}

export interface RequestMeta {
  ipAddress: string | null;
  userAgent: string | null;
}

export async function getRequestMeta(): Promise<RequestMeta> {
  const headerList = await headers();
  const forwarded = headerList.get("x-forwarded-for");
  return {
    ipAddress: forwarded?.split(",")[0]?.trim() ?? headerList.get("x-real-ip"),
    userAgent: headerList.get("user-agent"),
  };
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function loadPermissionsForRole(roleId: string) {
  const rows = await db
    .select({ permissionId: rolePermissions.permissionId })
    .from(rolePermissions)
    .innerJoin(
      permissionsTable,
      eq(permissionsTable.id, rolePermissions.permissionId),
    )
    .where(eq(rolePermissions.roleId, roleId));

  return rows.map((row) => row.permissionId as PermissionId);
}

async function buildSessionUser(userId: string): Promise<SessionUser | null> {
  const [row] = await db
    .select({
      id: users.id,
      email: users.email,
      fullName: users.fullName,
      phone: users.phone,
      isActive: users.isActive,
      mustChangePassword: users.mustChangePassword,
      lastLoginAt: users.lastLoginAt,
      createdAt: users.createdAt,
      roleId: roles.id,
      roleName: roles.name,
      roleLabel: roles.label,
      branchId: branches.id,
      branchName: branches.name,
      branchCode: branches.code,
    })
    .from(users)
    .innerJoin(roles, eq(roles.id, users.roleId))
    .leftJoin(branches, eq(branches.id, users.branchId))
    .where(eq(users.id, userId))
    .limit(1);

  if (!row || !row.isActive) return null;

  const permissionIds = await loadPermissionsForRole(row.roleId);

  return {
    id: row.id,
    email: row.email,
    fullName: row.fullName,
    phone: row.phone,
    roleId: row.roleId,
    roleName: row.roleName,
    roleLabel: row.roleLabel,
    branchId: row.branchId,
    branchName: row.branchName,
    branchCode: row.branchCode,
    permissions: permissionIds,
    mustChangePassword: row.mustChangePassword,
    lastLoginAt: row.lastLoginAt,
    createdAt: row.createdAt,
  };
}

/**
 * Resolve the signed-in user from the session cookie, validating the session
 * against the database on every request. Cached for the current render pass.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const sessionId = hashToken(token);
  const [session] = await db
    .select({ userId: sessions.userId, expiresAt: sessions.expiresAt })
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);

  if (!session) return null;
  if (session.expiresAt.getTime() <= Date.now()) {
    await db.delete(sessions).where(eq(sessions.id, sessionId));
    return null;
  }

  return buildSessionUser(session.userId);
});

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

export async function authenticate(
  email: string,
  password: string,
): Promise<SessionUser | null> {
  const normalizedEmail = email.trim().toLowerCase();
  const [user] = await db
    .select({
      id: users.id,
      passwordHash: users.passwordHash,
      isActive: users.isActive,
    })
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .limit(1);

  if (!user || !user.isActive) {
    // Perform a dummy verification to keep timing roughly constant.
    await verifyPassword(
      password,
      "scrypt$16384$8$1$00000000000000000000000000000000$" + "00".repeat(64),
    );
    return null;
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) return null;

  return buildSessionUser(user.id);
}

export async function createSession(
  userId: string,
  meta: RequestMeta,
): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
  await db.insert(sessions).values({
    id: hashToken(token),
    userId,
    expiresAt,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent?.slice(0, 255) ?? null,
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function getCurrentSessionId(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  return token ? hashToken(token) : null;
}

export async function destroyCurrentSession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (token) {
    await db.delete(sessions).where(eq(sessions.id, hashToken(token)));
  }
  cookieStore.delete(SESSION_COOKIE);
}

export async function revokeSessionsForUser(userId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.userId, userId));
}

export async function purgeExpiredSessions(): Promise<void> {
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
}

export async function touchLastLogin(userId: string): Promise<void> {
  await db
    .update(users)
    .set({ lastLoginAt: new Date() })
    .where(eq(users.id, userId));
}

/** Active session lookup used by tests / diagnostics. */
export async function findActiveSession(token: string) {
  const [row] = await db
    .select({ userId: sessions.userId, expiresAt: sessions.expiresAt })
    .from(sessions)
    .where(
      and(
        eq(sessions.id, hashToken(token)),
        gt(sessions.expiresAt, new Date()),
      ),
    )
    .limit(1);
  return row ?? null;
}

export { hashToken };
