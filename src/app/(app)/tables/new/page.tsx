import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { Card, CardBody } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { branchScope, hasPermission, requirePermissionPage } from "@/lib/auth/access";
import { requireUser } from "@/lib/auth/session";
import { listBranches } from "@/services/branches";
import { TableForm } from "../table-forms";

export const metadata: Metadata = { title: "New table" };
export const dynamic = "force-dynamic";

export default async function NewTablePage() {
  const user = await requireUser();
  requirePermissionPage(user, "tables.manage");

  const branches = await listBranches(branchScope(user), { includeInactive: false });

  return (
    <>
      <PageHeader
        eyebrow="Restaurant floor"
        title="Add a table"
        description="A QR code is generated automatically so guests can open the branch menu from the table."
      />
      {branches.length === 0 ? (
        <Card className="p-6">
          <Alert tone="error">
            No active branch is available to your account, so a table cannot be
            created. Ask an administrator to assign you to a branch.
          </Alert>
        </Card>
      ) : (
        <Card className="max-w-2xl">
          <CardBody className="py-5 sm:px-6">
            <TableForm
              branches={branches.map((branch) => ({
                id: branch.id,
                name: branch.name,
                code: branch.code,
              }))}
            />
          </CardBody>
        </Card>
      )}
    </>
  );
}
