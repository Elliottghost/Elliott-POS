import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { ButtonLink, Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import {
  branchScope,
  hasPermission,
  requirePermissionPage,
} from "@/lib/auth/access";
import { requireUser } from "@/lib/auth/session";
import { listBranches } from "@/services/branches";
import { listRoles, listStaff } from "@/services/staff";
import { formatDate, formatRelative } from "@/lib/format";
import { SearchIcon } from "@/components/icons";

export const metadata: Metadata = { title: "Staff" };
export const dynamic = "force-dynamic";

interface SearchParams {
  q?: string;
  branch?: string;
  role?: string;
  status?: "active" | "inactive" | "all";
  page?: string;
}

export default async function StaffPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const user = await requireUser();
  requirePermissionPage(user, "staff.view");

  const params = await searchParams;
  const scope = branchScope(user);
  const canManage = hasPermission(user, "staff.manage");

  const status =
    params.status === "active" || params.status === "inactive"
      ? params.status
      : "all";

  const [staff, branches, roles] = await Promise.all([
    listStaff(scope, {
      search: params.q,
      branchId: params.branch,
      roleId: params.role,
      status,
    }),
    listBranches(scope, { includeInactive: true }),
    listRoles(),
  ]);

  const activeCount = staff.filter((member) => member.isActive).length;
  const filtered = Boolean(params.q || params.branch || params.role || params.status);

  return (
    <>
      <PageHeader
        eyebrow={scope === null ? "All branches" : user.branchName ?? "Branch staff"}
        title="Staff directory"
        description="Individual accounts with role-based access. Every account is tied to one branch and one role."
        actions={
          canManage ? (
            <>
              <ButtonLink href="/staff/new" size="sm">
                Add staff
              </ButtonLink>
            </>
          ) : null
        }
      />

      <Card className="mb-4">
        <form
          method="get"
          className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))_auto]"
        >
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              name="q"
              defaultValue={params.q ?? ""}
              placeholder="Search name, email or employee code"
              aria-label="Search staff"
              className="field-input pl-9"
            />
          </div>

          <select
            name="branch"
            defaultValue={params.branch ?? ""}
            aria-label="Filter by branch"
            className="field-input"
          >
            <option value="">All branches in scope</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>

          <select
            name="role"
            defaultValue={params.role ?? ""}
            aria-label="Filter by role"
            className="field-input"
          >
            <option value="">All roles</option>
            {roles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.label}
              </option>
            ))}
          </select>

          <select
            name="status"
            defaultValue={params.status ?? "all"}
            aria-label="Filter by status"
            className="field-input"
          >
            <option value="all">Any status</option>
            <option value="active">Active only</option>
            <option value="inactive">Inactive only</option>
          </select>

          <div className="flex gap-2">
            <Button type="submit" size="md" variant="secondary">
              Filter
            </Button>
            {filtered ? (
              <Link
                href="/staff"
                className="inline-flex h-10 items-center rounded-lg px-3 text-[13px] font-medium text-muted hover:bg-sand/60 hover:text-ink"
              >
                Reset
              </Link>
            ) : null}
          </div>
        </form>
      </Card>

      {filtered && staff.length === 0 ? (
        <div className="mb-4">
          <Alert tone="info">
            No staff match those filters. Try resetting the filters or widening
            the search.
          </Alert>
        </div>
      ) : null}

      <Card className="overflow-hidden">
        <CardHeader
          title={`${staff.length} staff account${staff.length === 1 ? "" : "s"}`}
          subtitle={`${activeCount} active · ${staff.length - activeCount} inactive`}
          action={<Badge tone="neutral">{scope === null ? "Consolidated" : "Branch scope"}</Badge>}
        />
        <div className="overflow-x-auto">
          <table className="table-base min-w-[46rem]">
            <thead>
              <tr>
                <th>Staff member</th>
                <th>Role</th>
                <th>Branch</th>
                <th>Employee</th>
                <th>Last sign-in</th>
                <th>Status</th>
                <th className="text-right">Open</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((member) => (
                <tr key={member.id}>
                  <td>
                    <Link
                      href={`/staff/${member.id}`}
                      className="font-medium text-ink hover:text-ember-strong"
                    >
                      {member.fullName}
                    </Link>
                    <p className="text-[11px] text-muted">{member.email}</p>
                  </td>
                  <td className="text-muted">{member.roleLabel}</td>
                  <td className="text-muted">
                    {member.branchName ?? (
                      <span className="text-[12px] italic">All branches</span>
                    )}
                  </td>
                  <td className="font-mono text-[12px] text-muted">
                    {member.employeeCode ?? "—"}
                  </td>
                  <td className="text-muted">
                    {member.lastLoginAt ? (
                      <span title={formatDate(member.lastLoginAt)}>
                        {formatRelative(member.lastLoginAt)}
                      </span>
                    ) : (
                      <span className="text-[12px] italic">Never</span>
                    )}
                  </td>
                  <td>
                    <StatusBadge active={member.isActive} />
                  </td>
                  <td className="text-right">
                    <Link
                      href={`/staff/${member.id}`}
                      className="text-[12px] font-semibold text-ember-strong hover:underline"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
              {staff.length === 0 && !filtered ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-muted">
                    No staff accounts in your scope yet.
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
