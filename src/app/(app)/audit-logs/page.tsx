import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  branchScope,
  isSuperAdmin,
  requirePermissionPage,
} from "@/lib/auth/access";
import { requireUser } from "@/lib/auth/session";
import { listAuditActions, listAuditLogs } from "@/services/audit";
import { listBranches } from "@/services/branches";
import { formatDateTime } from "@/lib/format";
import { SearchIcon } from "@/components/icons";

export const metadata: Metadata = { title: "Audit trail" };
export const dynamic = "force-dynamic";

export default async function AuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    action?: string;
    entity?: string;
    branch?: string;
    from?: string;
    to?: string;
  }>;
}) {
  const user = await requireUser();
  requirePermissionPage(user, "audit.view");

  const params = await searchParams;
  const scope = branchScope(user);

  const [entries, actions, branches] = await Promise.all([
    listAuditLogs(scope, {
      search: params.q,
      action: params.action,
      entityType: params.entity,
      branchId: params.branch,
      from: params.from,
      to: params.to,
      limit: 150,
    }),
    listAuditActions(),
    isSuperAdmin(user) ? listBranches(null, { includeInactive: true }) : Promise.resolve([]),
  ]);

  const filtered = Boolean(
    params.q || params.action || params.entity || params.branch || params.from || params.to,
  );

  return (
    <>
      <PageHeader
        eyebrow="Compliance"
        title="Audit trail"
        description="Append-only record of sign-ins, account changes, branch edits and permission updates. Entries are never editable from the app."
      />

      <Card className="mb-4">
        <form
          method="get"
          className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.5fr)_repeat(4,minmax(0,1fr))_auto]"
        >
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              name="q"
              defaultValue={params.q ?? ""}
              placeholder="Search description, actor or action"
              aria-label="Search audit trail"
              className="field-input pl-9"
            />
          </div>

          <select name="action" defaultValue={params.action ?? ""} aria-label="Action" className="field-input">
            <option value="">All actions</option>
            {actions.map((entry) => (
              <option key={entry.action} value={entry.action}>
                {entry.action} ({entry.count})
              </option>
            ))}
          </select>

          <select name="entity" defaultValue={params.entity ?? ""} aria-label="Entity" className="field-input">
            <option value="">All entities</option>
            <option value="user">User</option>
            <option value="branch">Branch</option>
            <option value="role">Role</option>
            <option value="business_settings">Business settings</option>
          </select>

          {isSuperAdmin(user) ? (
            <select name="branch" defaultValue={params.branch ?? ""} aria-label="Branch" className="field-input">
              <option value="">All branches</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          ) : null}

          <input
            type="date"
            name="from"
            defaultValue={params.from ?? ""}
            aria-label="From date"
            className="field-input"
          />
          <input
            type="date"
            name="to"
            defaultValue={params.to ?? ""}
            aria-label="To date"
            className="field-input"
          />

          <div className="flex gap-2">
            <Button type="submit" variant="secondary">
              Filter
            </Button>
            {filtered ? (
              <Link
                href="/audit-logs"
                className="inline-flex h-10 items-center rounded-lg px-3 text-[13px] font-medium text-muted hover:bg-sand/60 hover:text-ink"
              >
                Reset
              </Link>
            ) : null}
          </div>
        </form>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader
          title={`${entries.length} entr${entries.length === 1 ? "y" : "ies"}`}
          subtitle={
            scope === null
              ? "Consolidated across all branches (super administrator)."
              : `Scoped to ${user.branchName ?? "your branch"}.`
          }
          action={<Badge tone="neutral">Newest first</Badge>}
        />
        <div className="overflow-x-auto">
          <table className="table-base min-w-[52rem]">
            <thead>
              <tr>
                <th>When</th>
                <th>Actor</th>
                <th>Action</th>
                <th>Description</th>
                <th>Branch</th>
                <th>IP</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td className="whitespace-nowrap text-muted">
                    {formatDateTime(entry.createdAt)}
                  </td>
                  <td>
                    <p className="font-medium text-ink">{entry.actorName ?? "System"}</p>
                    <p className="text-[11px] text-muted">{entry.actorEmail ?? "—"}</p>
                  </td>
                  <td>
                    <span className="rounded bg-sand px-1.5 py-0.5 font-mono text-[11px] text-ink/70">
                      {entry.action}
                    </span>
                  </td>
                  <td className="max-w-[22rem] text-muted">{entry.description ?? "—"}</td>
                  <td className="text-muted">{entry.branchName ?? "—"}</td>
                  <td className="font-mono text-[11px] text-muted">
                    {entry.ipAddress ?? "—"}
                  </td>
                </tr>
              ))}
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-muted">
                    No audit entries match your filters.
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
