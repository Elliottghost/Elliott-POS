import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { StatCard } from "@/components/ui/stat-card";
import {
  canAccessBranch,
  hasPermission,
  requirePermissionPage,
} from "@/lib/auth/access";
import { requireUser } from "@/lib/auth/session";
import { getBranchOverview } from "@/services/branches";
import { listStaff } from "@/services/staff";
import { getSettingsMap } from "@/services/settings";
import {
  formatCurrency,
  formatDate,
  formatTimeRange,
} from "@/lib/format";
import { BranchForm } from "../branch-form";

export const metadata: Metadata = { title: "Branch" };
export const dynamic = "force-dynamic";

export default async function BranchDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string; updated?: string }>;
}) {
  const user = await requireUser();
  requirePermissionPage(user, "branches.view");

  const { id } = await params;
  const flags = await searchParams;

  if (!canAccessBranch(user, id)) {
    redirect("/forbidden?permission=branch_scope");
  }

  const overview = await getBranchOverview(id);
  if (!overview) notFound();

  const canManage = hasPermission(user, "branches.manage");
  const canSeeStaff = hasPermission(user, "staff.view");
  const [staff, settings] = await Promise.all([
    canSeeStaff ? listStaff([id], { status: "all" }) : Promise.resolve([]),
    getSettingsMap(),
  ]);
  const currency = settings["business.currency"] ?? "RWF";
  const { branch } = overview;

  return (
    <>
      <PageHeader
        eyebrow={`${branch.code} · ${branch.city}`}
        title={branch.name}
        description={branch.address}
        actions={
          <>
            <StatusBadge active={branch.isActive} />
            {canManage ? (
              <Link
                href="#edit"
                className="inline-flex h-9 items-center rounded-lg border border-line bg-white px-3 text-[13px] font-semibold text-ink hover:bg-sand/60"
              >
                Edit branch
              </Link>
            ) : null}
          </>
        }
      />

      {flags.created ? (
        <div className="mb-4">
          <Alert tone="success">Branch created. You can now assign staff to it.</Alert>
        </div>
      ) : null}
      {flags.updated ? (
        <div className="mb-4">
          <Alert tone="success">Branch details updated.</Alert>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          label="Staff"
          value={`${overview.staffActive}/${overview.staffTotal}`}
          hint="Active / total accounts"
        />
        <StatCard label="Orders (all time)" value={overview.totalOrders} hint="From the order ledger" />
        <StatCard
          label="Revenue (paid)"
          value={formatCurrency(overview.revenue, currency)}
          hint="All paid orders in this branch"
        />
        <StatCard
          label="Opening hours"
          value={<span className="text-[20px]">{formatTimeRange(branch.openingTime, branch.closingTime)}</span>}
          hint="Africa/Kigali"
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader title="Branch record" />
          <CardBody className="space-y-3 text-[13px]">
            <Row label="Code" value={<Badge tone="dark">{branch.code}</Badge>} />
            <Row label="Slug" value={<span className="font-mono text-[12px]">{branch.slug}</span>} />
            <Row label="Phone" value={branch.phone ?? "—"} />
            <Row label="Email" value={branch.email ?? "—"} />
            <Row label="Address" value={`${branch.address}, ${branch.city}`} />
            <Row label="Created" value={formatDate(branch.createdAt)} />
          </CardBody>
        </Card>

        <Card className="overflow-hidden lg:col-span-2">
          <CardHeader
            title="Assigned staff"
            subtitle={
              canSeeStaff
                ? "Only accounts attached to this branch. Branch managers cannot see other locations."
                : "You do not have permission to view staff records."
            }
          />
          {canSeeStaff ? (
            <div className="overflow-x-auto">
              <table className="table-base min-w-[30rem]">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Role</th>
                    <th>Employee</th>
                    <th>Status</th>
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
                      <td className="font-mono text-[12px] text-muted">
                        {member.employeeCode ?? "—"}
                      </td>
                      <td>
                        <StatusBadge active={member.isActive} />
                      </td>
                    </tr>
                  ))}
                  {staff.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-muted">
                        No staff assigned to this branch yet.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          ) : (
            <CardBody>
              <p className="text-[13px] text-muted">Staff list hidden by permission.</p>
            </CardBody>
          )}
        </Card>
      </div>

      {canManage ? (
        <Card id="edit" className="mt-4 scroll-mt-24">
          <CardHeader
            title="Edit branch"
            subtitle="Changes are written to the database immediately and recorded in the audit trail."
          />
          <CardBody className="py-5 sm:px-6">
            <BranchForm
              mode="update"
              defaultValues={{
                id: branch.id,
                name: branch.name,
                code: branch.code,
                address: branch.address,
                city: branch.city,
                phone: branch.phone ?? "",
                email: branch.email ?? "",
                openingTime: branch.openingTime,
                closingTime: branch.closingTime,
                isActive: branch.isActive,
              }}
            />
          </CardBody>
        </Card>
      ) : null}
    </>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line/60 pb-2.5 last:border-0 last:pb-0">
      <span className="text-[11px] uppercase tracking-[0.14em] text-muted">{label}</span>
      <span className="text-right text-ink/80">{value}</span>
    </div>
  );
}
