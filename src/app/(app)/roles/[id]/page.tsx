import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { PageHeader } from "@/components/page-header";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { db } from "@/db/client";
import { permissions as permissionsTable, rolePermissions, roles } from "@/db/schema";
import { hasPermission, requirePermissionPage } from "@/lib/auth/access";
import { requireUser } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/permissions";
import { RolePermissionsForm } from "../role-permissions-form";

export const metadata: Metadata = { title: "Role permissions" };
export const dynamic = "force-dynamic";

export default async function RoleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await requireUser();
  requirePermissionPage(actor, "roles.view");

  const { id } = await params;
  const [role] = await db.select().from(roles).where(eq(roles.id, id)).limit(1);
  if (!role) notFound();

  const grantedRows = await db
    .select({ permissionId: rolePermissions.permissionId })
    .from(rolePermissions)
    .where(eq(rolePermissions.roleId, id));

  const stored = await db
    .select({
      id: permissionsTable.id,
      label: permissionsTable.label,
      description: permissionsTable.description,
      category: permissionsTable.category,
    })
    .from(permissionsTable)
    .orderBy(asc(permissionsTable.category), asc(permissionsTable.label));

  const catalogue = stored.length
    ? stored
    : PERMISSIONS.map((permission) => ({
        id: permission.id,
        label: permission.label,
        description: permission.description,
        category: permission.category,
      }));

  const categories = new Map<string, typeof catalogue>();
  for (const permission of catalogue) {
    categories.set(permission.category, [
      ...(categories.get(permission.category) ?? []),
      permission,
    ]);
  }

  const isSuper = role.name === "super_admin";
  const canManage = hasPermission(actor, "roles.manage");
  const granted = isSuper
    ? catalogue.map((permission) => permission.id)
    : grantedRows.map((row) => row.permissionId);

  return (
    <>
      <PageHeader
        eyebrow="Access control"
        title={role.label}
        description={role.description ?? undefined}
        actions={
          <Badge tone={isSuper ? "dark" : "ember"}>
            {granted.length} of {catalogue.length} permissions
          </Badge>
        }
      />

      <Card className="max-w-4xl">
        <CardBody className="py-5 sm:px-6">
          {isSuper ? (
            <div className="mb-4">
              <Badge tone="dark">Locked</Badge>
              <p className="mt-2 text-[13px] text-muted">
                The super administrator role always holds every permission and
                bypasses branch scoping. It cannot be restricted.
              </p>
            </div>
          ) : null}
          <RolePermissionsForm
            roleId={role.id}
            roleLabel={role.label}
            groups={Array.from(categories.entries()).map(([category, items]) => ({
              category,
              items,
            }))}
            granted={granted}
            readOnly={!canManage || isSuper}
          />
        </CardBody>
      </Card>
    </>
  );
}
