import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import {
  branchScope,
  hasPermission,
  requirePermissionPage,
} from "@/lib/auth/access";
import { requireUser } from "@/lib/auth/session";
import { listBranches } from "@/services/branches";
import { formatTimeRange } from "@/lib/format";

export const metadata: Metadata = { title: "Branches" };
export const dynamic = "force-dynamic";

export default async function BranchesPage() {
  const user = await requireUser();
  requirePermissionPage(user, "branches.view");

  const scope = branchScope(user);
  const branches = await listBranches(scope, {
    includeInactive: hasPermission(user, "branches.manage"),
  });

  return (
    <>
      <PageHeader
        eyebrow="Locations"
        title="Branches"
        description={
          scope === null
            ? "Both trading houses of Vista Kigali. Each branch keeps its own staff, records and reporting scope."
            : "You are scoped to your assigned branch. Other locations are not visible."
        }
        actions={
          hasPermission(user, "branches.manage") ? (
            <ButtonLink href="/branches/new" size="sm">
              New branch
            </ButtonLink>
          ) : null
        }
      />

      {branches.length === 1 && scope !== null ? (
        <div className="mb-4">
          <Alert tone="info">
            Branch separation is enforced server-side: this account can only
            read and act on the branch below.
          </Alert>
        </div>
      ) : null}

      <Card className="overflow-hidden">
        <CardHeader
          title="Trading locations"
          subtitle={`${branches.length} branch${branches.length === 1 ? "" : "es"} in your scope.`}
        />
        <div className="overflow-x-auto">
          <table className="table-base min-w-[42rem]">
            <thead>
              <tr>
                <th>Branch</th>
                <th>Address</th>
                <th>Manager</th>
                <th className="text-center">Staff</th>
                <th>Hours</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {branches.map((branch) => (
                <tr key={branch.id}>
                  <td>
                    <Link
                      href={`/branches/${branch.id}`}
                      className="font-medium text-ink hover:text-ember-strong"
                    >
                      {branch.name}
                    </Link>
                    <p className="mt-0.5">
                      <Badge tone="dark">{branch.code}</Badge>
                    </p>
                  </td>
                  <td className="text-muted">
                    {branch.address}
                    <span className="block text-[11px]">{branch.city}</span>
                  </td>
                  <td className="text-muted">{branch.managerName ?? "Unassigned"}</td>
                  <td className="text-center tabular-nums">{branch.staffCount}</td>
                  <td className="whitespace-nowrap text-muted">
                    {formatTimeRange(branch.openingTime, branch.closingTime)}
                  </td>
                  <td>
                    <StatusBadge active={branch.isActive} />
                  </td>
                  <td className="text-right">
                    <Link
                      href={
                        hasPermission(user, "branches.manage")
                          ? `/branches/${branch.id}#edit`
                          : `/branches/${branch.id}`
                      }
                      className="text-[12px] font-semibold text-ember-strong hover:underline"
                    >
                      {hasPermission(user, "branches.manage") ? "Manage" : "Open"}
                    </Link>
                  </td>
                </tr>
              ))}
              {branches.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-muted">
                    No branches found in your scope.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
