import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { Card, CardBody } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import {
  branchScope,
  isSuperAdmin,
  requirePermissionPage,
} from "@/lib/auth/access";
import { requireUser } from "@/lib/auth/session";
import { canAssignRole } from "@/lib/auth/staff-rules";
import { listBranches } from "@/services/branches";
import { getActorRank, listRoles } from "@/services/staff";
import { StaffForm } from "../staff-form";

export const metadata: Metadata = { title: "Add staff" };

export default async function NewStaffPage() {
  const user = await requireUser();
  requirePermissionPage(user, "staff.manage");

  const scope = branchScope(user);
  const [actorRank, allRoles, branches] = await Promise.all([
    getActorRank(user),
    listRoles(),
    listBranches(scope, { includeInactive: false }),
  ]);

  const assignableRoles = allRoles
    .filter((role) => canAssignRole(user, actorRank, role))
    .map((role) => ({ id: role.id, name: role.name, label: role.label }));

  const branchOptions = branches
    .filter((branch) => isSuperAdmin(user) || branch.id === user.branchId)
    .map((branch) => ({ id: branch.id, name: branch.name, code: branch.code }));

  return (
    <>
      <PageHeader
        eyebrow="Staff directory"
        title="Add a staff account"
        description="Create an individual sign-in, attach it to a branch and grant only the role it needs. A record is written to the audit trail."
      />

      {branchOptions.length === 0 ? (
        <div className="mb-4 max-w-3xl">
          <Alert tone="error">
            No active branch is available. Create or activate a branch before
            adding staff.
          </Alert>
        </div>
      ) : null}

      {assignableRoles.length === 0 ? (
        <div className="mb-4 max-w-3xl">
          <Alert tone="error">
            Your role cannot assign any staff roles. Ask a super administrator
            for help.
          </Alert>
        </div>
      ) : null}

      <Card className="max-w-3xl">
        <CardBody className="py-5 sm:px-6">
          <StaffForm
            mode="create"
            roles={assignableRoles}
            branches={branchOptions}
          />
        </CardBody>
      </Card>

    </>
  );
}
