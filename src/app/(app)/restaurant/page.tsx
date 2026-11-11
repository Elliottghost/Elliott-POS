import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";
import { branchScope, hasPermission, requirePermissionPage } from "@/lib/auth/access";
import { requireUser } from "@/lib/auth/session";
import { listBranches } from "@/services/branches";
import { getRestaurantOverview } from "@/services/restaurant";
import { getSettingsMap } from "@/services/settings";
import {
  formatCurrency,
  formatDateLabel,
  formatTimeRange,
  todayKigali,
} from "@/lib/format";
import { RESERVATION_STATUS_LABELS } from "@/lib/validation";

export const metadata: Metadata = { title: "Restaurant" };
export const dynamic = "force-dynamic";

export default async function RestaurantDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ branch?: string }>;
}) {
  const user = await requireUser();
  requirePermissionPage(user, "menu.view");

  const params = await searchParams;
  const scope = branchScope(user);
  const [branches, settings] = await Promise.all([
    listBranches(scope, { includeInactive: true }),
    getSettingsMap(),
  ]);

  const activeBranches = branches.filter((branch) => branch.isActive);
  const selected = activeBranches.find((branch) => branch.id === params.branch);
  const branchId = scope === null ? selected?.id : undefined;

  const overview = await getRestaurantOverview(scope, branchId);
  const currency = settings["business.currency"] ?? "RWF";

  return (
    <>
      <PageHeader
        eyebrow="Restaurant"
        title="Restaurant overview"
        description="Menu health, the floor and today's bookings in one place. Figures follow your branch scope."
        actions={
          <div className="flex flex-wrap gap-2">
            <ButtonLink href="/reservations/new" size="sm" variant="secondary">
              New reservation
            </ButtonLink>
            {hasPermission(user, "tables.view") ? (
              <ButtonLink href="/tables" size="sm">
                Floor plan
              </ButtonLink>
            ) : null}
          </div>
        }
      />

      {scope === null && activeBranches.length > 1 ? (
        <div className="mb-5 flex flex-wrap gap-1.5">
          <Link
            href="/restaurant"
            className={`rounded-full border px-3 py-1.5 text-[12px] font-semibold ${
              branchId
                ? "border-line bg-white text-ink/70 hover:border-charcoal/25"
                : "border-charcoal bg-charcoal text-cream"
            }`}
          >
            Both houses
          </Link>
          {activeBranches.map((branch) => (
            <Link
              key={branch.id}
              href={`/restaurant?branch=${branch.id}`}
              className={`rounded-full border px-3 py-1.5 text-[12px] font-semibold ${
                branchId === branch.id
                  ? "border-charcoal bg-charcoal text-cream"
                  : "border-line bg-white text-ink/70 hover:border-charcoal/25"
              }`}
            >
              {branch.code} · {branch.name}
            </Link>
          ))}
        </div>
      ) : null}

      <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Menu items"
          value={overview.menu.total}
          hint={`${overview.menu.available} available · ${overview.menu.unavailable} unavailable`}
          tone="dark"
        />
        <StatCard
          label="Tables"
          value={overview.tables.total}
          hint={`${overview.tables.available} available · ${overview.tables.occupied} occupied`}
        />
        <StatCard
          label="Reservations today"
          value={overview.reservations.today}
          hint={`${overview.reservations.pending} pending · ${overview.reservations.seated} seated`}
        />
        <StatCard
          label="Sales today"
          value={formatCurrency(overview.revenueToday, currency, { compact: true })}
          hint={`${overview.ordersToday} orders · ${overview.openOrders} open`}
        />
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-line bg-white px-4 py-3">
          <p className="text-[10.5px] uppercase tracking-[0.14em] text-muted">Sold out</p>
          <p className="mt-1 text-[13px] text-ink">
            {overview.branches.reduce((sum, branch) => sum + branch.menuSoldOut, 0)} dishes
            across {overview.branches.length} house{overview.branches.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="rounded-xl border border-line bg-white px-4 py-3">
          <p className="text-[10.5px] uppercase tracking-[0.14em] text-muted">Featured</p>
          <p className="mt-1 text-[13px] text-ink">{overview.menu.featured} items on the menu</p>
        </div>
        <div className="rounded-xl border border-line bg-white px-4 py-3">
          <p className="text-[10.5px] uppercase tracking-[0.14em] text-muted">Seats in service</p>
          <p className="mt-1 text-[13px] text-ink">{overview.tables.seats} covers</p>
        </div>
        <div className="rounded-xl border border-line bg-white px-4 py-3">
          <p className="text-[10.5px] uppercase tracking-[0.14em] text-muted">Held tables</p>
          <p className="mt-1 text-[13px] text-ink">
            {overview.tables.reserved} reserved · {overview.tables.unavailable} out of service
          </p>
        </div>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card className="overflow-hidden">
          <CardHeader
            title="Branch performance today"
            subtitle={formatDateLabel(todayKigali())}
            action={
              hasPermission(user, "reports.view") ? (
                <Link
                  href="/dashboard"
                  className="text-[12px] font-semibold text-ember-strong hover:underline"
                >
                  Operations dashboard
                </Link>
              ) : null
            }
          />
          <div className="hidden overflow-x-auto sm:block">
            <table className="table-base min-w-[34rem]">
              <thead>
                <tr>
                  <th>Branch</th>
                  <th className="text-right">Orders</th>
                  <th className="text-right">Sales</th>
                  <th className="text-right">Tables free</th>
                  <th className="text-right">Bookings</th>
                  <th className="text-right">Sold out</th>
                </tr>
              </thead>
              <tbody>
                {overview.branches.map((branch) => (
                  <tr key={branch.branchId}>
                    <td>
                      <p className="font-medium text-ink">{branch.branchCode}</p>
                      <p className="text-[11px] text-muted">{branch.branchName}</p>
                    </td>
                    <td className="text-right tabular-nums">{branch.ordersToday}</td>
                    <td className="text-right tabular-nums">
                      {formatCurrency(branch.revenueToday, currency)}
                    </td>
                    <td className="text-right tabular-nums">
                      {branch.tablesAvailable}/{branch.tables}
                    </td>
                    <td className="text-right tabular-nums">
                      {branch.reservationsToday}
                      {branch.pendingReservations > 0 ? (
                        <span className="block text-[10.5px] text-ember-strong">
                          {branch.pendingReservations} pending
                        </span>
                      ) : null}
                    </td>
                    <td className="text-right tabular-nums">{branch.menuSoldOut}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="divide-y divide-line/70 sm:hidden">
            {overview.branches.map((branch) => (
              <li key={branch.branchId} className="px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[13px] font-semibold text-ink">{branch.branchCode}</p>
                  <p className="text-[12.5px] tabular-nums">
                    {formatCurrency(branch.revenueToday, currency)}
                  </p>
                </div>
                <p className="text-[11px] text-muted">{branch.branchName}</p>
                <p className="mt-1 text-[11.5px] text-muted">
                  {branch.ordersToday} orders · {branch.tablesAvailable}/{branch.tables} tables
                  free · {branch.reservationsToday} bookings
                </p>
              </li>
            ))}
          </ul>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader
              title="Upcoming reservations"
              subtitle="Next confirmed and pending arrivals."
              action={
                <Link
                  href="/reservations"
                  className="text-[12px] font-semibold text-ember-strong hover:underline"
                >
                  Full book
                </Link>
              }
            />
            {overview.upcoming.length === 0 ? (
              <p className="px-4 py-6 text-[12.5px] text-muted sm:px-5">
                Nothing booked ahead.
              </p>
            ) : (
              <ul className="divide-y divide-line/70">
                {overview.upcoming.map((booking) => (
                  <li key={booking.id} className="px-4 py-2.5 sm:px-5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-[12.5px] font-medium text-ink">
                          {booking.customerName}
                        </p>
                        <p className="text-[11px] text-muted">
                          {formatDateLabel(booking.reservationDate)} · {booking.startTime} ·{" "}
                          {booking.branchCode}
                          {booking.tableCode ? ` · ${booking.tableCode}` : ""}
                        </p>
                      </div>
                      <Badge
                        tone={booking.status === "confirmed" ? "success" : "neutral"}
                      >
                        {RESERVATION_STATUS_LABELS[
                          booking.status as keyof typeof RESERVATION_STATUS_LABELS
                        ] ?? booking.status}
                      </Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardBody>
              <p className="text-[11px] uppercase tracking-[0.14em] text-muted">
                House hours
              </p>
              <div className="mt-2 space-y-1.5">
                {branches.map((branch) => (
                  <div key={branch.id} className="flex items-center justify-between gap-2">
                    <span className="text-[12.5px] text-ink">{branch.code}</span>
                    <span className="text-[12px] tabular-nums text-muted">
                      {formatTimeRange(branch.openingTime, branch.closingTime)}
                    </span>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
