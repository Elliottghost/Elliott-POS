import type { Metadata } from "next";
import Link from "next/link";
import { asc, eq, sql } from "drizzle-orm";
import { PageHeader } from "@/components/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { db } from "@/db/client";
import { permissions as permissionsTable, rolePermissions, roles, users } from "@/db/schema";
import { hasPermission, requirePermissionPage } from "@/lib/auth/access";
import { requireUser } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/permissions";

export const metadata: Metadata = { title: "Roles & access" };
export const dynamic = "force-dynamic";

export default async function RolesPage() {
  const user = await requireUser();
  requirePermissionPage(user, "roles.view");

  const canManage = hasPermission(user, "roles.manage");

  const roleRows = await db
    .select({
      id: roles.id,
      name: roles.name,
      label: roles.label,
      description: roles.description,
      rank: roles.rank,
      permissionCount: sql<number>`(
        select count(*) from role_permissions
        where role_permissions.role_id = roles.id
      )`,
      staffCount: sql<number>`(
        select count(*) from users
        where users.role_id = roles.id and users.is_active = 1
      )`,
    })
    .from(roles)
    .orderBy(asc(roles.rank), asc(roles.label));

  const assignments = await db
    .select({
      roleId: rolePermissions.roleId,
      permissionId: rolePermissions.permissionId,
      category: permissionsTable.category,
    })
    .from(rolePermissions)
    .innerJoin(
      permissionsTable,
      eq(permissionsTable.id, rolePermissions.permissionId),
    );

  const grouped = new Map<string, string[]>();
  for (const assignment of assignments) {
    grouped.set(assignment.roleId, [
      ...(grouped.get(assignment.roleId) ?? []),
      assignment.permissionId,
    ]);
  }

  return (
    <>
      <PageHeader
        eyebrow="Access control"
        title="Roles & permissions"
        description="Seven operating roles, one permission catalogue. Permissions are enforced on the server for every page and every action."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {roleRows.map((role) => {
          const granted = grouped.get(role.id) ?? [];
          return (
            <Card key={role.id}>
              <CardHeader
                title={
                  <span className="flex flex-wrap items-center gap-2">
                    {role.label}
                    {role.name === "super_admin" ? (
                      <Badge tone="dark">Full access</Badge>
                    ) : null}
                  </span>
                }
                subtitle={role.description}
                action={
                  canManage && role.name !== "super_admin" ? (
                    <Link
                      href={`/roles/${role.id}`}
                      className="text-[12px] font-semibold text-ember-strong hover:underline"
                    >
                      Manage
                    </Link>
                  ) : null
                }
              />
              <div className="px-5 py-4">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-muted">
                  <span>
                    <strong className="font-semibold text-ink">
                      {Number(role.permissionCount)}
                    </strong>{" "}
                    permissions
                  </span>
                  <span>
                    <strong className="font-semibold text-ink">
                      {Number(role.staffCount)}
                    </strong>{" "}
                    active staff
                  </span>
                  <span>Rank {role.rank}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {role.name === "super_admin"
                    ? PERMISSIONS.map((permission) => (
                        <Badge key={permission.id} tone="neutral">
                          {permission.label}
                        </Badge>
                      ))
                    : granted
                        .map(
                          (permissionId) =>
                            PERMISSIONS.find((item) => item.id === permissionId)
                              ?.label ?? permissionId,
                        )
                        .map((label) => (
                          <Badge key={label} tone="ember">
                            {label}
                          </Badge>
                        ))}
                  {role.name !== "super_admin" && granted.length === 0 ? (
                    <span className="text-[12px] text-muted">No permissions granted.</span>
                  ) : null}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </>
  );
}
