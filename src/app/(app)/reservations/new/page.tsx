import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { Card, CardBody } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { branchScope, requirePermissionPage } from "@/lib/auth/access";
import { requireUser } from "@/lib/auth/session";
import { listBranches } from "@/services/branches";
import { listTables } from "@/services/tables";
import { ReservationForm } from "../reservation-forms";

export const metadata: Metadata = { title: "New reservation" };
export const dynamic = "force-dynamic";

export default async function NewReservationPage() {
  const user = await requireUser();
  requirePermissionPage(user, "reservations.manage");

  const scope = branchScope(user);
  const [branches, tables] = await Promise.all([
    listBranches(scope, { includeInactive: false }),
    listTables(scope),
  ]);

  const activeBranches = branches.filter((branch) => branch.isActive);

  return (
    <>
      <PageHeader
        eyebrow="Front of house"
        title="New reservation"
        description="The table is held for the chosen duration; overlapping bookings on the same table are refused."
      />
      {activeBranches.length === 0 ? (
        <Card className="p-6">
          <Alert tone="error">
            No active branch is available to your account. Ask an administrator to
            assign you to a branch first.
          </Alert>
        </Card>
      ) : (
        <Card className="max-w-3xl">
          <CardBody className="py-5 sm:px-6">
            <ReservationForm
              branches={activeBranches.map((branch) => ({
                id: branch.id,
                name: branch.name,
                code: branch.code,
              }))}
              tables={tables.map((table) => ({
                id: table.id,
                branchId: table.branchId,
                code: table.code,
                capacity: table.capacity,
                section: table.section,
                status: table.status,
              }))}
            />
          </CardBody>
        </Card>
      )}
    </>
  );
}
