import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import {
  branchScope,
  canAccessBranch,
  hasPermission,
  isSuperAdmin,
  requirePermissionPage,
} from "@/lib/auth/access";
import { requireUser } from "@/lib/auth/session";
import { canAssignRole, canManageStaffMember } from "@/lib/auth/staff-rules";
import { listAuditLogs } from "@/services/audit";
import { getActorRank, getStaffDetail, listRoles } from "@/services/staff";
import { listBranches } from "@/services/branches";
import { formatDate, formatDateTime, formatRelative } from "@/lib/format";
import { StaffForm } from "../staff-form";
import { TemporaryPasswordPanel } from "../temporary-password";

export const metadata: Metadata = { title: "Staff member" };
export const dynamic = "force-dynamic";

export default async function StaffDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const actor = await requireUser();
  requirePermissionPage(actor, "staff.view");

  const { id } = await params;
  const flags = await searchParams;

  const target = await getStaffDetail(id);
  if (!target) notFound();

  if (!isSuperAdmin(actor)) {
    if (!target.user.branchId || !canAccessBranch(actor, target.user.branchId)) {
      redirect("/forbidden?permission=branch_scope");
    }
  }

  const actorRank = await getActorRank(actor);
  const canEdit = canManageStaffMember(actor, actorRank, {
    userId: target.user.id,
    roleName: target.role.name,
    roleRank: target.role.rank,
    branchId: target.user.branchId,
  });

  const [allRoles, branches, activity] = await Promise.all([
    canEdit ? listRoles() : Promise.resolve([]),
    canEdit
      ? listBranches(branchScope(actor), { includeInactive: true })
      : Promise.resolve([]),
    hasPermission(actor, "audit.view")
      ? listAuditLogs(branchScope(actor), { entityId: id, limit: 12 })
      : Promise.resolve([]),
  ]);

  const roleOptions = allRoles
    .filter(
      (role) =>
        role.id === target.role.id || canAssignRole(actor, actorRank, role),
    )
    .map((role) => ({ id: role.id, name: role.name, label: role.label }));

  const branchOptions = branches
    .filter(
      (branch) =>
        branch.id === target.user.branchId ||
        isSuperAdmin(actor) ||
        branch.id === actor.branchId,
    )
    .map((branch) => ({ id: branch.id, name: branch.name, code: branch.code }));

  const profile = target.profile;

  return (
    <>
      <PageHeader
        eyebrow={`${target.role.label}${target.branch ? ` · ${target.branch.name}` : " · All branches"}`}
        title={target.user.fullName}
        description={target.user.email}
        actions={
          <>
            <StatusBadge active={target.user.isActive} />
            <Link
              href="/staff"
              className="inline-flex h-9 items-center rounded-lg border border-line bg-white px-3 text-[13px] font-semibold text-ink hover:bg-sand/60"
            >
              Back to staff
            </Link>
          </>
        }
      />

      {flags.created ? (
        <div className="mb-4">
          <Alert tone="success">
            Staff account created. Share the initial password through a secure
            channel — they will be prompted to change it.
          </Alert>
        </div>
      ) : null}

      {!canEdit ? (
        <div className="mb-4">
          <Alert tone="info">
            This account is read-only for you. Editing is limited to its branch
            manager and super administrators.
          </Alert>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader title="Staff profile" subtitle="Employment and personal record." />
            <CardBody className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
              <Row label="Employee code" value={profile?.employeeCode ?? "—"} mono />
              <Row label="Job title" value={profile?.jobTitle ?? "—"} />
              <Row label="Employment type" value={labelEmployment(profile?.employmentType)} />
              <Row label="Hired" value={formatDate(profile?.hiredAt ?? null)} />
              <Row label="Phone" value={target.user.phone ?? "—"} />
              <Row label="Branch" value={target.branch?.name ?? "All branches (global)"} />
              <Row label="National ID" value={profile?.nationalId ?? "—"} />
              <Row label="Date of birth" value={formatDate(profile?.dateOfBirth ?? null)} />
              <Row
                label="Residential address"
                value={profile?.residentialAddress ?? "—"}
                span
              />
              <Row
                label="Emergency contact"
                value={
                  profile?.emergencyContactName
                    ? `${profile.emergencyContactName}${
                        profile.emergencyContactPhone
                          ? ` · ${profile.emergencyContactPhone}`
                          : ""
                      }`
                    : "—"
                }
                span
              />
              {profile?.notes ? (
                <div className="sm:col-span-2">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-muted">Notes</p>
                  <p className="mt-1 whitespace-pre-line text-[13px] text-ink/75">
                    {profile.notes}
                  </p>
                </div>
              ) : null}
            </CardBody>
          </Card>

          {canEdit ? (
            <Card>
              <CardHeader
                title="Edit staff account"
                subtitle="Role, branch and profile changes are audited."
              />
              <CardBody className="py-5 sm:px-6">
                <StaffForm
                  mode="update"
                  roles={roleOptions}
                  branches={branchOptions}
                  defaultValues={{
                    userId: target.user.id,
                    fullName: target.user.fullName,
                    email: target.user.email,
                    phone: target.user.phone ?? "",
                    roleId: target.user.roleId,
                    branchId: target.user.branchId ?? "",
                    jobTitle: profile?.jobTitle ?? "",
                    employmentType: profile?.employmentType ?? "full_time",
                    nationalId: profile?.nationalId ?? "",
                    residentialAddress: profile?.residentialAddress ?? "",
                    emergencyContactName: profile?.emergencyContactName ?? "",
                    emergencyContactPhone: profile?.emergencyContactPhone ?? "",
                    notes: profile?.notes ?? "",
                    isActive: target.user.isActive,
                  }}
                />
              </CardBody>
            </Card>
          ) : null}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Account security" />
            <CardBody className="space-y-3 text-[13px]">
              <Row label="Role" value={<Badge tone="ember">{target.role.label}</Badge>} />
              <Row
                label="Last sign-in"
                value={target.user.lastLoginAt ? formatRelative(target.user.lastLoginAt) : "Never"}
              />
              <Row
                label="Password changed"
                value={
                  target.user.passwordChangedAt
                    ? formatDate(target.user.passwordChangedAt)
                    : "—"
                }
              />
              <Row label="Joined" value={formatDateTime(target.user.createdAt)} />
              {target.user.mustChangePassword ? (
                <div>
                  <Alert tone="info">
                    Still using an initial or temporary password.
                  </Alert>
                </div>
              ) : null}
              {canEdit ? (
                <div className="border-t border-line pt-3">
                  <TemporaryPasswordPanel userId={target.user.id} />
                </div>
              ) : null}
            </CardBody>
          </Card>

          {hasPermission(actor, "audit.view") ? (
            <Card>
              <CardHeader title="Recent activity" subtitle="Audited changes for this account." />
              <div className="px-5 py-3">
                {activity.length === 0 ? (
                  <p className="py-3 text-[13px] text-muted">No entries yet.</p>
                ) : (
                  <ul className="space-y-3">
                    {activity.map((entry) => (
                      <li key={entry.id} className="text-[12.5px] leading-snug">
                        <p className="text-ink/80">{entry.description ?? entry.action}</p>
                        <p className="mt-0.5 text-[11px] text-muted">
                          {entry.actorName ?? "System"} · {formatRelative(entry.createdAt)}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}

function Row({
  label,
  value,
  mono = false,
  span = false,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  span?: boolean;
}) {
  return (
    <div className={span ? "sm:col-span-2" : ""}>
      <p className="text-[11px] uppercase tracking-[0.14em] text-muted">{label}</p>
      <p
        className={`mt-0.5 text-[13px] text-ink/85 ${mono ? "font-mono text-[12px]" : ""}`}
      >
        {value}
      </p>
    </div>
  );
}

function labelEmployment(value: string | null | undefined) {
  switch (value) {
    case "part_time":
      return "Part time";
    case "contract":
      return "Contract";
    case "intern":
      return "Intern";
    case "full_time":
      return "Full time";
    default:
      return "—";
  }
}
