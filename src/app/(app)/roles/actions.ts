"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { rolePermissions, roles } from "@/db/schema";
import { recordAudit } from "@/lib/audit";
import { hasPermission, isSuperAdmin } from "@/lib/auth/access";
import { getRequestMeta, requireUser } from "@/lib/auth/session";
import type { FormState } from "@/lib/forms";
import { ALL_PERMISSION_IDS, type PermissionId } from "@/lib/permissions";

export async function updateRolePermissionsAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requireUser();
  if (!hasPermission(actor, "roles.manage")) {
    return { error: "You do not have permission to change role permissions." };
  }

  const roleId = String(formData.get("roleId") ?? "");
  const [role] = await db.select().from(roles).where(eq(roles.id, roleId)).limit(1);
  if (!role) return { error: "Role not found." };

  if (role.name === "super_admin") {
    return { error: "The super administrator role always holds every permission." };
  }

  const requested = Array.from(
    new Set(
      formData
        .getAll("permission")
        .map((value) => String(value))
        .filter((value): value is PermissionId =>
          (ALL_PERMISSION_IDS as string[]).includes(value),
        ),
    ),
  );

  if (!isSuperAdmin(actor) && requested.length === 0) {
    return { error: "A role must keep at least one permission." };
  }

  const previous = await db
    .select({ permissionId: rolePermissions.permissionId })
    .from(rolePermissions)
    .where(eq(rolePermissions.roleId, roleId));

  await db.delete(rolePermissions).where(eq(rolePermissions.roleId, roleId));
  for (const permissionId of requested) {
    await db
      .insert(rolePermissions)
      .values({ roleId, permissionId })
      .onConflictDoNothing();
  }

  const meta = await getRequestMeta();
  await recordAudit({
    actor,
    action: "role.permissions_updated",
    entityType: "role",
    entityId: roleId,
    branchId: null,
    description: `Permissions updated for ${role.label}.`,
    metadata: {
      before: previous.map((row) => row.permissionId),
      after: requested,
    },
    meta,
  });

  revalidatePath("/roles");
  revalidatePath(`/roles/${roleId}`);
  return {
    notice: `${role.label} permissions saved. Staff roles take effect on their next request.`,
  };
}
