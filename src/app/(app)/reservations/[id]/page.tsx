import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { branchScope, hasPermission, requirePermissionPage } from "@/lib/auth/access";
import { requireUser } from "@/lib/auth/session";
import { listBranches } from "@/services/branches";
import { getTablePlan, getReservationById } from "@/services/reservations";
import { listTables } from "@/services/tables";
import { addMinutesToTime, formatDateLabel, formatDateTime } from "@/lib/format";
import { RESERVATION_STATUS_LABELS } from "@/lib/validation";
import { ReservationForm, ReservationStatusActions } from "../reservation-forms";

export const metadata: Metadata = { title: "Reservation" };
export const dynamic = "force-dynamic";

const STATUS_TONES: Record<string, "neutral" | "success" | "ember" | "danger"> = {
  pending: "neutral",
  confirmed: "success",
  seated: "ember",
  completed: "neutral",
  cancelled: "danger",
  no_show: "danger",
};

export default async function ReservationDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const user = await requireUser();
  requirePermissionPage(user, "reservations.view");

  const [{ id }, query] = await Promise.all([params, searchParams]);
  const row = await getReservationById(id);
  if (!row) notFound();

  const scope = branchScope(user);
  if (scope !== null && !scope.includes(row.reservation.branchId)) notFound();

  const canManage = hasPermission(user, "reservations.manage");
  const [branches, tables, plan] = await Promise.all([
    listBranches(scope, { includeInactive: false }),
    listTables(scope),
    getTablePlan(row.reservation.branchId, row.reservation.reservationDate),
  ]);

  const tableBookings = plan.find((table) => table.id === row.reservation.tableId);
  const others = (tableBookings?.bookings ?? []).filter(
    (booking) => booking.customerName !== row.reservation.customerName ||
      booking.startTime !== row.reservation.startTime,
  );

  return (
    <>
      <PageHeader
        eyebrow="Reservation"
        title={row.reservation.customerName}
        description={`${row.branchName} · ${formatDateLabel(row.reservation.reservationDate)} at ${row.reservation.startTime}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={STATUS_TONES[row.reservation.status] ?? "neutral"}>
              {RESERVATION_STATUS_LABELS[
                row.reservation.status as keyof typeof RESERVATION_STATUS_LABELS
              ] ?? row.reservation.status}
            </Badge>
            <Link
              href="/reservations"
              className="text-[12.5px] font-semibold text-ember-strong hover:underline"
            >
              Back to book
            </Link>
          </div>
        }
      />

      {query.saved ? (
        <div className="mb-4 max-w-3xl">
          <Alert tone="success">
            {query.saved === "created" ? "Reservation booked." : "Reservation saved."}
          </Alert>
        </div>
      ) : null}
      {query.error ? (
        <div className="mb-4 max-w-3xl">
          <Alert tone="error">{query.error}</Alert>
        </div>
      ) : null}

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-4">
          {canManage ? (
            <Card>
              <CardHeader
                title="Edit reservation"
                subtitle="Moving the table or time re-checks for clashes."
              />
              <CardBody className="py-5 sm:px-6">
                <ReservationForm
                  branches={branches
                    .filter((branch) => branch.id === row.reservation.branchId)
                    .map((branch) => ({
                      id: branch.id,
                      name: branch.name,
                      code: branch.code,
                    }))}
                  tables={tables.map((table) => ({
                    id: table.id,
                    branchId: table.branchId,
                    code: table.code,
                    capacity: table.capacity,
                    section: table.section,
                    status: table.status,
                  }))}
                  reservation={{
                    id: row.reservation.id,
                    branchId: row.reservation.branchId,
                    tableId: row.reservation.tableId,
                    customerName: row.reservation.customerName,
                    customerPhone: row.reservation.customerPhone,
                    reservationDate: row.reservation.reservationDate,
                    startTime: row.reservation.startTime,
                    durationMinutes: row.reservation.durationMinutes,
                    guestCount: row.reservation.guestCount,
                    status: row.reservation.status,
                    specialRequests: row.reservation.specialRequests,
                  }}
                />
              </CardBody>
            </Card>
          ) : null}

          <Card>
            <CardHeader title="Reservation details" />
            <CardBody>
              <dl className="grid gap-3 sm:grid-cols-2">
                <div>
                  <dt className="text-[10.5px] uppercase tracking-[0.16em] text-muted">Guest</dt>
                  <dd className="text-[13.5px] font-medium text-ink">
                    {row.reservation.customerName}
                  </dd>
                  <dd className="text-[12px] text-muted">
                    <a href={`tel:${row.reservation.customerPhone}`} className="hover:underline">
                      {row.reservation.customerPhone}
                    </a>
                  </dd>
                </div>
                <div>
                  <dt className="text-[10.5px] uppercase tracking-[0.16em] text-muted">Party</dt>
                  <dd className="text-[13.5px] font-medium text-ink">
                    {row.reservation.guestCount} guests
                  </dd>
                  <dd className="text-[12px] text-muted">
                    {row.reservation.durationMinutes} minutes held
                  </dd>
                </div>
                <div>
                  <dt className="text-[10.5px] uppercase tracking-[0.16em] text-muted">When</dt>
                  <dd className="text-[13.5px] font-medium text-ink">
                    {formatDateLabel(row.reservation.reservationDate)}
                  </dd>
                  <dd className="text-[12px] text-muted">
                    {row.reservation.startTime} –{" "}
                    {addMinutesToTime(
                      row.reservation.startTime,
                      row.reservation.durationMinutes,
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10.5px] uppercase tracking-[0.16em] text-muted">Table</dt>
                  <dd className="text-[13.5px] font-medium text-ink">
                    {row.tableCode ? `${row.tableCode} · ${row.tableSection}` : "Not assigned"}
                  </dd>
                  <dd className="text-[12px] text-muted">
                    {row.tableCapacity ? `${row.tableCapacity} seats` : "Assign on arrival"}
                  </dd>
                </div>
              </dl>

              {row.reservation.specialRequests ? (
                <p className="mt-4 rounded-lg bg-sand/50 px-3 py-2 text-[12.5px] leading-relaxed text-ink/80">
                  <span className="font-semibold text-ink">Special requests: </span>
                  {row.reservation.specialRequests}
                </p>
              ) : null}

              {row.reservation.cancellationReason ? (
                <p className="mt-3 rounded-lg border border-danger/20 bg-danger/[0.05] px-3 py-2 text-[12.5px] leading-relaxed text-danger">
                  Cancelled: {row.reservation.cancellationReason}
                </p>
              ) : null}

              <p className="mt-4 text-[11px] text-muted">
                Booked {formatDateTime(row.reservation.createdAt)}
                {row.createdByName ? ` by ${row.createdByName}` : ""}
              </p>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-4">
          {canManage ? (
            <Card>
              <CardHeader title="Update status" subtitle="Confirm, seat, complete or cancel." />
              <CardBody>
                <ReservationStatusActions
                  reservationId={row.reservation.id}
                  status={row.reservation.status}
                />
              </CardBody>
            </Card>
          ) : null}

          <Card>
            <CardHeader
              title="On this table"
              subtitle={formatDateLabel(row.reservation.reservationDate)}
            />
            {others.length === 0 ? (
              <p className="px-4 py-5 text-[12.5px] text-muted sm:px-5">
                No other bookings hold this table that day.
              </p>
            ) : (
              <ul className="divide-y divide-line/70">
                {others.map((booking) => (
                  <li key={`${booking.customerName}-${booking.startTime}`} className="px-4 py-2.5 sm:px-5">
                    <p className="text-[12.5px] font-medium text-ink">{booking.customerName}</p>
                    <p className="text-[11px] text-muted">
                      {booking.startTime}–{booking.endTime} · {booking.status}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
