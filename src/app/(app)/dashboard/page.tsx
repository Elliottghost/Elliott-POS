import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { isSuperAdmin } from "@/lib/auth/access";
import { requireUser } from "@/lib/auth/session";
import { formatCurrency, formatNumber, formatRelative } from "@/lib/format";
import { getDashboardData } from "@/services/dashboard";
import { getSettingsMap } from "@/services/settings";
import {
  ArrowUpRightIcon,
  BranchIcon,
  StaffIcon,
  DashboardIcon,
  ShieldIcon,
} from "@/components/icons";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

function greeting() {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      hour12: false,
      timeZone: "Africa/Kigali",
    }).format(new Date()),
  );
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default async function DashboardPage() {
  const user = await requireUser();
  const [data, settings] = await Promise.all([
    getDashboardData(user),
    getSettingsMap(),
  ]);

  const currency = settings["business.currency"] ?? "RWF";
  const superAdmin = isSuperAdmin(user);
  const firstName = user.fullName.split(" ")[0];
  const { sales, trend, staff, branchSummary, activity } = data;
  const peak = Math.max(...trend.map((point) => point.revenue), 1);

  const today = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Africa/Kigali",
  }).format(new Date());

  return (
    <>
      <PageHeader
        eyebrow={superAdmin ? "Consolidated overview" : user.branchName ?? "Branch overview"}
        title={`${greeting()}, ${firstName}`}
        description={`${today} · ${
          superAdmin
            ? "All branches, Kimironko and Rond-Point, in one view."
            : `Showing ${user.branchName ?? "your assigned branch"} only.`
        }`}
        actions={
          superAdmin ? (
            <ButtonLink href="/branches" variant="secondary" size="sm">
              <BranchIcon className="h-4 w-4" />
              Manage branches
            </ButtonLink>
          ) : null
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard
          tone="dark"
          className="col-span-2 xl:col-span-1"
          label="Sales today"
          value={formatCurrency(sales.revenueToday, currency)}
          hint={`${formatNumber(sales.paidOrdersToday)} paid · ${formatCurrency(
            sales.averageTicket,
            currency,
          )} average ticket`}
          icon={<DashboardIcon className="h-4 w-4" />}
        />
        <StatCard
          label="Orders today"
          value={formatNumber(sales.ordersToday)}
          hint={`${formatNumber(sales.openOrders)} still open · ${formatNumber(
            sales.cancelledOrdersToday,
          )} cancelled`}
          icon={<ArrowUpRightIcon className="h-4 w-4" />}
        />
        <StatCard
          label="Active staff"
          value={formatNumber(staff.active)}
          hint={`${formatNumber(staff.total)} accounts · ${
            staff.total - staff.active
          } inactive`}
          icon={<StaffIcon className="h-4 w-4" />}
        />
        <StatCard
          className="col-span-2 xl:col-span-1"
          label={superAdmin ? "Branches" : "Branch"}
          value={
            superAdmin
              ? `${branchSummary.active}/${branchSummary.total}`
              : user.branchCode ?? "—"
          }
          hint={
            superAdmin
              ? "Active trading locations"
              : user.branchName ?? "No branch assigned"
          }
          icon={<BranchIcon className="h-4 w-4" />}
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader
            title="Revenue, last 7 days"
            subtitle="Paid orders, grouped by business day (Africa/Kigali)."
            action={<Badge tone="ember">{currency}</Badge>}
          />
          <CardBody>
            <div className="flex h-44 w-full min-w-0 items-end gap-2 overflow-hidden sm:gap-4">
              {trend.map((point) => {
                const height = Math.max(4, Math.round((point.revenue / peak) * 100));
                return (
                  <div
                    key={point.day}
                    className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2"
                    title={`${point.day}: ${formatCurrency(point.revenue, currency)} across ${point.orders} orders`}
                  >
                    <span className="hidden text-[10px] font-medium text-muted opacity-0 transition group-hover:opacity-100 sm:block">
                      {point.revenue > 0 ? formatCurrency(point.revenue, currency, { compact: true }) : "—"}
                    </span>
                    <div
                      className={`w-full rounded-t-md transition-all ${
                        point.revenue > 0
                          ? "bg-charcoal group-hover:bg-ember"
                          : "bg-sand"
                      }`}
                      style={{ height: `${height}%` }}
                    />
                    <span className="text-[10px] uppercase tracking-wide text-muted">
                      {point.label}
                    </span>
                  </div>
                );
              })}
            </div>
            {sales.ordersToday === 0 ? (
              <p className="mt-4 rounded-lg border border-dashed border-line px-3 py-2.5 text-[12px] text-muted">
                No orders recorded today yet. Sales reporting becomes live when
                the POS phase ships; figures here are always read from the
                database.
              </p>
            ) : null}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Recent activity"
            subtitle="Newest audited actions in your scope."
            action={
              user.permissions.includes("audit.view") ? (
                <Link
                  href="/audit-logs"
                  className="text-[12px] font-semibold text-ember-strong hover:underline"
                >
                  Full trail
                </Link>
              ) : null
            }
          />
          <div className="px-2 py-2">
            {activity.length === 0 ? (
              <p className="px-3 py-6 text-center text-[13px] text-muted">
                Nothing recorded yet.
              </p>
            ) : (
              <ul className="divide-y divide-line/70">
                {activity.map((entry) => (
                  <li key={entry.id} className="flex items-start gap-3 px-3 py-2.5">
                    <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sand text-ink/40">
                      <ShieldIcon className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[12.5px] leading-snug text-ink/80">
                        {entry.description ?? entry.action}
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted">
                        {entry.actorName ?? "System"}
                        {entry.branchName ? ` · ${entry.branchName}` : ""} ·{" "}
                        {formatRelative(entry.createdAt)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <Card className="overflow-hidden">
          <CardHeader
            title={superAdmin ? "Branch performance today" : "Branch at a glance"}
            subtitle={
              superAdmin
                ? "Revenue and orders per location, consolidated view."
                : "Your assigned branch — other branches are not accessible."
            }
          />
          <div className="divide-y divide-line/70 md:hidden">
            {branchSummary.list.map((branch) => (
              <div key={branch.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium leading-snug text-ink">{branch.name}</p>
                    <p className="text-[11px] text-muted">
                      {branch.code} · {branch.city}
                    </p>
                  </div>
                  <p className="shrink-0 text-right text-[13px] font-semibold tabular-nums text-ink">
                    {formatCurrency(branch.revenueToday, currency)}
                  </p>
                </div>
                <div className="mt-1.5 flex items-center justify-between gap-2">
                  <p className="text-[11px] text-muted">
                    {branch.staffCount} staff · {branch.ordersToday} orders
                  </p>
                  <Badge tone={branch.isActive ? "success" : "neutral"}>
                    {branch.isActive ? "Open" : "Closed"}
                  </Badge>
                </div>
              </div>
            ))}
            {branchSummary.list.length === 0 ? (
              <p className="px-4 py-8 text-center text-muted">
                No branches are assigned to your account yet.
              </p>
            ) : null}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Branch</th>
                  <th className="text-right">Staff</th>
                  <th className="text-right">Orders</th>
                  <th className="text-right">Revenue</th>
                  <th className="text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {branchSummary.list.map((branch) => (
                  <tr key={branch.id}>
                    <td>
                      <p className="font-medium text-ink">{branch.name}</p>
                      <p className="text-[11px] text-muted">
                        {branch.code} · {branch.city}
                      </p>
                    </td>
                    <td className="text-right tabular-nums">{branch.staffCount}</td>
                    <td className="text-right tabular-nums">{branch.ordersToday}</td>
                    <td className="text-right font-medium tabular-nums">
                      {formatCurrency(branch.revenueToday, currency)}
                    </td>
                    <td className="text-right">
                      <Badge tone={branch.isActive ? "success" : "neutral"}>
                        {branch.isActive ? "Open" : "Closed"}
                      </Badge>
                    </td>
                  </tr>
                ))}
                {branchSummary.list.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-muted">
                      No branches are assigned to your account yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Team composition"
            subtitle="Active staff by role."
            action={
              user.permissions.includes("staff.view") ? (
                <Link
                  href="/staff"
                  className="text-[12px] font-semibold text-ember-strong hover:underline"
                >
                  View staff
                </Link>
              ) : null
            }
          />
          <CardBody>
            <ul className="space-y-3">
              {staff.byRole.map((role) => {
                const share = staff.active > 0 ? (role.count / staff.active) * 100 : 0;
                return (
                  <li key={role.roleName}>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-[13px] text-ink/80">{role.roleLabel}</span>
                      <span className="text-[12px] font-semibold tabular-nums text-ink">
                        {role.count}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-sand">
                      <div
                        className="h-full rounded-full bg-ember/70"
                        style={{ width: `${Math.max(3, share)}%` }}
                      />
                    </div>
                  </li>
                );
              })}
              {staff.byRole.length === 0 ? (
                <li className="text-[13px] text-muted">No active staff recorded.</li>
              ) : null}
            </ul>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
