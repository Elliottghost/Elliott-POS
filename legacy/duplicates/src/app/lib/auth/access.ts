import { redirect } from "next/navigation";
import type { PermissionId } from "@/lib/permissions";
import type { SessionUser } from "./session";

export class ForbiddenError extends Error {
  constructor(message = "You do not have permission to perform this action.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export function isSuperAdmin(user: SessionUser): boolean {
  return user.roleName === "super_admin";
}

export function hasPermission(
  user: SessionUser | null,
  permission: PermissionId,
): boolean {
  if (!user) return false;
  if (isSuperAdmin(user)) return true;
  return user.permissions.includes(permission);
}

/**
 * Branch scope for queries: `null` means every branch (super administrators),
 * otherwise the single branch the user is assigned to.
 */
export function branchScope(user: SessionUser): string[] | null {
  if (isSuperAdmin(user)) return null;
  return user.branchId ? [user.branchId] : [];
}

export function canAccessBranch(
  user: SessionUser,
  branchId: string,
): boolean {
  if (isSuperAdmin(user)) return true;
  return Boolean(user.branchId) && user.branchId === branchId;
}

export function assertPermission(
  user: SessionUser,
  permission: PermissionId,
): void {
  if (!hasPermission(user, permission)) throw new ForbiddenError();
}

export function assertBranchAccess(user: SessionUser, branchId: string): void {
  if (!canAccessBranch(user, branchId)) {
    throw new ForbiddenError("This record belongs to another branch.");
  }
}

/** Page guard: redirects instead of throwing so the UI stays friendly. */
export function requirePermissionPage(
  user: SessionUser,
  permission: PermissionId,
): void {
  if (!hasPermission(user, permission)) {
    redirect(`/forbidden?permission=${encodeURIComponent(permission)}`);
  }
}

export function requireSuperAdminPage(user: SessionUser): void {
  if (!isSuperAdmin(user)) redirect("/forbidden?permission=super_admin");
}

/** Shape returned by every server action. */
export type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? { data?: undefined } : { data: T }))
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export function actionError(
  error: string,
  fieldErrors?: Record<string, string[]>,
): ActionResult<never> {
  return { ok: false, error, fieldErrors };
}
