import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireUser } from "@/lib/auth/session";
import { isSuperAdmin } from "@/lib/auth/access";
import { logoutAction } from "@/app/actions/auth";
import { formatDate, formatRelative } from "@/lib/format";
import { PERMISSIONS } from "@/lib/permissions";
import { ChangePasswordForm } from "./password-form";

export const metadata: Metadata = { title: "My account" };
export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await requireUser();

  return (
    <>
      <PageHeader
        eyebrow="Personal access"
        title="My account"
        description="Your profile, role, branch scope and password."
      />

      {user.mustChangePassword ? (
        <div className="mb-4">
          <Alert tone="info">
            You are signed in with a temporary password. Set your own password
            below to finish securing your account.
          </Alert>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4">
          <Card>
            <CardHeader title="Profile" />
            <CardBody className="space-y-3 text-[13px]">
              <Row label="Full name" value={user.fullName} />
              <Row label="Email" value={user.email} />
              <Row label="Phone" value={user.phone ?? "—"} />
              <Row label="Role" value={<Badge tone="ember">{user.roleLabel}</Badge>} />
              <Row
                label="Branch scope"
                value={user.branchName ?? (isSuperAdmin(user) ? "All branches" : "Unassigned")}
              />
              <Row
                label="Last sign-in"
                value={user.lastLoginAt ? formatRelative(user.lastLoginAt) : "—"}
              />
              <Row label="Account created" value={formatDate(user.createdAt)} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Session" />
            <CardBody className="space-y-3">
              <p className="text-[12px] leading-relaxed text-muted">
                Sessions expire automatically and are revoked when your password
                changes or your account is deactivated. Signing out ends this
                session immediately.
              </p>
              <form action={logoutAction}>
                <SubmitButton variant="secondary" size="sm" pendingLabel="Signing out…">
                  Sign out of this device
                </SubmitButton>
              </form>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader
              title="Change password"
              subtitle={
                user.mustChangePassword
                  ? "Required: your current password is a temporary one."
                  : "Use a password you do not use anywhere else."
              }
            />
            <CardBody className="py-5 sm:px-6">
              <ChangePasswordForm />
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Your permissions"
              subtitle={`Granted by the ${user.roleLabel} role. ${
                isSuperAdmin(user)
                  ? "Super administrators hold every permission."
                  : "Managed by a super administrator."
              }`}
              action={
                <Badge tone="ember">
                  {isSuperAdmin(user)
                    ? `${PERMISSIONS.length} of ${PERMISSIONS.length}`
                    : `${user.permissions.length} of ${PERMISSIONS.length}`}
                </Badge>
              }
            />
            <CardBody>
              <div className="flex flex-wrap gap-1.5">
                {PERMISSIONS.filter((permission) =>
                  user.permissions.includes(permission.id),
                ).map((permission) => (
                  <Badge key={permission.id} tone="success">
                    {permission.label}
                  </Badge>
                ))}
                {user.permissions.length === 0 ? (
                  <span className="text-[13px] text-muted">
                    No permissions have been granted to your role yet.
                  </span>
                ) : null}
              </div>
              <p className="mt-3 text-[12px] text-muted">
                Permissions are re-read from the database on every request, so
                access changes take effect immediately.
              </p>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line/60 pb-2.5 last:border-0 last:pb-0">
      <span className="text-[11px] uppercase tracking-[0.14em] text-muted">
        {label}
      </span>
      <span className="text-right text-ink/85">{value}</span>
    </div>
  );
}
