import type { SessionUser } from "./session";

export interface RoleRef {
  id: string;
  name: string;
  rank: number;
}

export interface StaffTargetRef {
  userId: string;
  roleRank: number;
  roleName: string;
  branchId: string | null;
}

export function isSuperAdminRole(roleName: string) {
  return roleName === "super_admin";
}

/**
 * A user may only assign roles that sit below their own rank. Super
 * administrators may assign anything, including another super administrator.
 */
export function canAssignRole(
  actor: SessionUser,
  actorRank: number,
  targetRole: RoleRef,
): boolean {
  if (isSuperAdminRole(actor.roleName)) return true;
  return targetRole.rank > actorRank;
}

/**
 * Branch managers may only manage staff in their own branch and only staff
 * whose role ranks below theirs. Nobody may manage their own account through
 * the staff administration screens.
 */
export function canManageStaffMember(
  actor: SessionUser,
  actorRank: number,
  target: StaffTargetRef,
): boolean {
  if (actor.id === target.userId) return false;
  if (isSuperAdminRole(target.roleName)) {
    return isSuperAdminRole(actor.roleName);
  }
  if (isSuperAdminRole(actor.roleName)) return true;
  if (!actor.branchId || actor.branchId !== target.branchId) return false;
  return target.roleRank > actorRank;
}

export function canManageRoleDefinition(
  actor: SessionUser,
  actorRank: number,
  targetRole: { name: string; rank: number },
): boolean {
  if (isSuperAdminRole(actor.roleName)) return true;
  if (isSuperAdminRole(targetRole.name)) return false;
  return targetRole.rank > actorRank;
}
