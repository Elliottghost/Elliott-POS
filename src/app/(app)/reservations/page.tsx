import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";
import { branchScope, hasPermission, requirePermissionPage } from "@/lib/auth/access";
import { requireUser } from "@/lib/auth/session";
import { listBranches } from "@/services/branches";
import { getReservationStats, listReservations } from "@/services/reservations";
import { formatDateLabel, todayKigali } from "@/lib/format";
import {
  RESERVATION_STATUS_LABELS,
  RESERVATION_STATUSES,
} from "@/lib/validation";

export const metadata: Metadata = { title: "Reservations" };
export const dynamic = "force-dynamic";

const STATUS_TONES: Record<string, "neutral" | "success" | "ember" | "danger" | "dark"> = {
  pending: "neutral",
  confirmed: "success",
  seated: "ember",
  completed: "neutral",
  cancelled: "danger",
  no_show: "danger",
};

export default async function ReservationsPage({
  searchParams,
}: {
  searchParams: Promise<{
    date?: string;
    status?: string;
    q?: string;
    branch?: string;
    saved?: string;
    error?: string;
  }>;
}) {
  const user = await requireUser();
  requirePermissionPage(user, "reservations.view");

  const params = await searchParams;
  const scope = branchScope(user);
  const canManage = hasPermission(user, "reservations.manage");
  const today = todayKigali();

  const branches = await listBranches(scope, { includeInactive: true });
  const activeBranches = branches.filter((branch) => branch.isActive);
  const selectedBranch = activeBranches.find((branch) => branch.id === params.branch);

  const [reservations, stats] = await Promise.all([
    listReservations(scope, {
      date: params.date || undefined,
      status: params.status || "all",
      search: params.q?.trim() || undefined,
      branchId: selectedBranch?.id,
    }),
    getReservationStats(scope),
  ]);

  const hasFilters = Boolean(params.date || params.q || selectedBranch || (params.status && params.status !== "all"));

  return (
    <>
      <PageHeader
        eyebrow="Front of house"
        title="Reservation book"
        description="Bookings for both houses, with table assignment and a guard against double-booking the same table."
        actions={
          <div className="flex flex-wrap gap-2">
            <ButtonLink href="/tables" variant="secondary" size="sm">
              Floor plan
            </ButtonLink>
            {canManage ? (
              <ButtonLink href="/reservations/new" size="sm">
                New reservation
              </ButtonLink>
            ) : null}
          </div>
        }
      />

      {params.saved ? (
        <div className="mb-4">
          <Alert tone="success">
            {params.saved === "created"
              ? "Reservation booked."
              : "Reservation updated."}
          </Alert>
        </div>
      ) : null}
      {params.error ? (
        <div className="mb-4">
          <Alert tone="error">{params.error}</Alert>
        </div>
      ) : null}

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Today" value={stats.today} hint="Bookings in the diary today" tone="dark" />
        <StatCard label="Pending" value={stats.pending} hint="Waiting for confirmation" />
        <StatCard label="Confirmed today" value={stats.confirmedToday} hint="Expected arrivals" />
        <StatCard label="Seated now" value={stats.seated} hint={`${stats.upcomingGuests} guests booked ahead`} />
      </div>

      <Card className="mb-4">
        <form className="grid gap-3 px-4 py-4 sm:grid-cols-[9.5rem_10rem_minmax(0,1fr)_auto] sm:items-end sm:px-5">
          <div>
            <label className="field-label" htmlFor="date">
              Date
            </label>
            <input
              id="date"
              name="date"
              type="date"
              defaultValue={params.date ?? ""}
              className="field-input"
            />
          </div>
          <div>
            <label className="field-label" htmlFor="status">
              Status
            </label>
            <select
              id="status"
              name="status"
              defaultValue={params.status ?? "all"}
              className="field-input"
            >
              <option value="all">All statuses</option>
              {RESERVATION_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {RESERVATION_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label" htmlFor="q">
              Search
            </label>
            <input
              id="q"
              name="q"
              defaultValue={params.q ?? ""}
              placeholder="Guest name, phone or table"
              className="field-input"
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit">Filter</Button>
            {hasFilters ? (
              <ButtonLink href="/reservations" variant="ghost">
                Clear
              </ButtonLink>
            ) : null}
          </div>
          {activeBranches.length > 1 ? (
            <div className="sm:col-span-4">
              <input type="hidden" name="branch" value={params.branch ?? ""} />
              <div className="flex flex-wrap gap-1.5">
                <Link
                  href={`/reservations${params.date ? `?date=${params.date}` : ""}`}
                  className={`rounded-full border px-3 py-1 text-[11.5px] font-semibold ${
                    params.branch
                      ? "border-line bg-white text-ink/70"
                      : "border-charcoal bg-charcoal text-cream"
                  }`}
                >
                  All branches
                </Link>
                {activeBranches.map((branch) => (
                  <Link
                    key={branch.id}
                    href={`/reservations?branch=${branch.id}${params.date ? `&date=${params.date}` : ""}`}
                    className={`rounded-full border px-3 py-1 text-[11.5px] font-semibold ${
                      params.branch === branch.id
                        ? "border-charcoal bg-charcoal text-cream"
                        : "border-line bg-white text-ink/70"
                    }`}
                  >
                    {branch.code}
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
        </form>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader
          title={params.date ? formatDateLabel(params.date) : "All reservations"}
          subtitle={`${reservations.length} booking${reservations.length === 1 ? "" : "s"}${
            params.date ? "" : " · earliest first"
          }`}
          action={
            <Link
              href={`/reservations${params.date === today ? "" : `?date=${today}`}`}
              className="text-[12px] font-semibold text-ember-strong hover:underline"
            >
              {params.date === today ? "Show all dates" : "Today"}
            </Link>
          }
        />

        {reservations.length === 0 ? (
          <div className="px-4 py-12 text-center sm:px-5">
            <p className="font-display text-lg text-ink">Nothing booked</p>
            <p className="mx-auto mt-1 max-w-sm text-[13px] leading-relaxed text-muted">
              {hasFilters
                ? "No reservations match these filters."
                : "The reservation book is empty. Take the first booking."}
            </p>
            {canManage ? (
              <div className="mt-4 flex justify-center">
                <ButtonLink href="/reservations/new" size="sm">
                  New reservation
                </ButtonLink>
              </div>
            ) : null}
          </div>
        ) : (
          <>
            <ul className="divide-y divide-line/70 lg:hidden">
              {reservations.map((reservation) => (
                <li key={reservation.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[13.5px] font-medium text-ink">
                        {reservation.customerName}
                      </p>
                      <p className="text-[11.5px] text-muted">
                        {formatDateLabel(reservation.reservationDate)} · {reservation.startTime}
                      </p>
                      <p className="mt-0.5 text-[11.5px] text-muted">
                        {reservation.branchCode}
                        {reservation.tableCode ? ` · Table ${reservation.tableCode}` : " · table TBC"}
                        {" · "}
                        {reservation.guestCount} guests
                      </p>
                    </div>
                    <Badge tone={STATUS_TONES[reservation.status] ?? "neutral"}>
                      {RESERVATION_STATUS_LABELS[
                        reservation.status as keyof typeof RESERVATION_STATUS_LABELS
                      ] ?? reservation.status}
                    </Badge>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <a
                      href={`tel:${reservation.customerPhone}`}
                      className="text-[11.5px] font-medium text-ink/60"
                    >
                      {reservation.customerPhone}
                    </a>
                    <Link
                      href={`/reservations/${reservation.id}`}
                      className="text-[11.5px] font-semibold text-ember-strong hover:underline"
                    >
                      Open
                    </Link>
                  </div>
                </li>
              ))}
            </ul>

            <div className="hidden overflow-x-auto lg:block">
              <table className="table-base min-w-[52rem]">
                <thead>
                  <tr>
                    <th>Guest</th>
                    <th>Date & time</th>
                    <th>Branch</th>
                    <th>Table</th>
                    <th className="text-right">Guests</th>
                    <th>Status</th>
                    <th className="text-right">Open</th>
                  </tr>
                </thead>
                <tbody>
                  {reservations.map((reservation) => (
                    <tr key={reservation.id}>
                      <td>
                        <p className="font-medium text-ink">{reservation.customerName}</p>
                        <p className="text-[11px] text-muted">{reservation.customerPhone}</p>
                      </td>
                      <td className="whitespace-nowrap text-muted">
                        {formatDateLabel(reservation.reservationDate)}
                        <span className="block text-[11px]">
                          {reservation.startTime} · {reservation.durationMinutes} min
                        </span>
                      </td>
                      <td className="text-muted">{reservation.branchCode}</td>
                      <td className="text-muted">
                        {reservation.tableCode ?? "TBC"}
                        {reservation.tableSection ? (
                          <span className="block text-[11px]">{reservation.tableSection}</span>
                        ) : null}
                      </td>
                      <td className="text-right tabular-nums">{reservation.guestCount}</td>
                      <td>
                        <Badge tone={STATUS_TONES[reservation.status] ?? "neutral"}>
                          {RESERVATION_STATUS_LABELS[
                            reservation.status as keyof typeof RESERVATION_STATUS_LABELS
                          ] ?? reservation.status}
                        </Badge>
                      </td>
                      <td className="text-right">
                        <Link
                          href={`/reservations/${reservation.id}`}
                          className="text-[12px] font-semibold text-ember-strong hover:underline"
                        >
                          Open
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>
    </>
  );
}
