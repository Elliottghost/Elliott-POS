import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { SubmitButton } from "@/components/ui/submit-button";
import { branchScope, hasPermission, requirePermissionPage } from "@/lib/auth/access";
import { requireUser } from "@/lib/auth/session";
import { listBranches } from "@/services/branches";
import { getTableById } from "@/services/tables";
import { getReservationDay } from "@/services/reservations";
import { getSetting } from "@/services/settings";
import { tableMenuUrl, qrCodeSvg } from "@/lib/qr";
import { formatDateLabel, todayKigali } from "@/lib/format";
import { TableForm } from "../table-forms";
import { deleteTableAction } from "../actions";

export const metadata: Metadata = { title: "Table details" };
export const dynamic = "force-dynamic";

export default async function TableDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const user = await requireUser();
  requirePermissionPage(user, "tables.view");

  const [{ id }, query] = await Promise.all([params, searchParams]);
  const row = await getTableById(id);
  if (!row) notFound();
  const scope = branchScope(user);
  if (scope !== null && !scope.includes(row.table.branchId)) notFound();

  const canManage = hasPermission(user, "tables.manage");
  const [branches, bookings, publicUrl] = await Promise.all([
    canManage ? listBranches(branchScope(user), { includeInactive: false }) : Promise.resolve([]),
    getReservationDay([row.table.branchId], todayKigali(), row.table.branchId),
    getSetting("business.public_url", ""),
  ]);

  const origin = publicUrl || process.env.APP_URL || "http://localhost:3000";
  const guestUrl = tableMenuUrl(origin, row.branchSlug, row.table.qrToken);
  const qrSvg = await qrCodeSvg(guestUrl, 220);
  const tableBookings = bookings.filter((booking) => booking.tableId === row.table.id);

  return (
    <>
      <PageHeader
        eyebrow={`${row.branchCode} · ${row.table.section}`}
        title={row.table.name ? `${row.table.code} — ${row.table.name}` : row.table.code}
        description={`${row.table.capacity} seats at ${row.branchName}. Guests scan the QR code to open this branch's menu.`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={row.table.isActive ? "success" : "neutral"}>
              {row.table.isActive ? "In service" : "Out of service"}
            </Badge>
            <Link
              href="/tables"
              className="text-[12.5px] font-semibold text-ember-strong hover:underline"
            >
              Back to floor
            </Link>
          </div>
        }
      />

      {query.saved ? (
        <div className="mb-4 max-w-2xl">
          <Alert tone="success">Table saved.</Alert>
        </div>
      ) : null}
      {query.error ? (
        <div className="mb-4 max-w-2xl">
          <Alert tone="error">{query.error}</Alert>
        </div>
      ) : null}

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-4">
          {canManage ? (
            <Card>
              <CardHeader title="Table details" subtitle="Number, seats, section and live status." />
              <CardBody className="py-5 sm:px-6">
                <TableForm
                  branches={branches.map((branch) => ({
                    id: branch.id,
                    name: branch.name,
                    code: branch.code,
                  }))}
                  table={{
                    id: row.table.id,
                    branchId: row.table.branchId,
                    code: row.table.code,
                    name: row.table.name,
                    capacity: row.table.capacity,
                    section: row.table.section,
                    status: row.table.status,
                    isActive: row.table.isActive,
                  }}
                />
              </CardBody>
            </Card>
          ) : (
            <Card className="p-5">
              <Alert tone="info">
                You can see the table and its bookings, but only a manager or
                receptionist can change it.
              </Alert>
            </Card>
          )}

          <Card className="overflow-hidden">
            <CardHeader
              title="Today's bookings"
              subtitle={formatDateLabel(todayKigali())}
            />
            {tableBookings.length === 0 ? (
              <p className="px-4 py-6 text-[13px] text-muted sm:px-5">
                No reservations hold this table today.
              </p>
            ) : (
              <ul className="divide-y divide-line/70">
                {tableBookings.map((booking) => (
                  <li key={booking.id} className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium text-ink">
                        {booking.customerName}
                      </p>
                      <p className="text-[11px] text-muted">
                        {booking.startTime} · {booking.guestCount} guests · {booking.status.replace("_", " ")}
                      </p>
                    </div>
                    <Link
                      href={`/reservations/${booking.id}`}
                      className="shrink-0 text-[11.5px] font-semibold text-ember-strong hover:underline"
                    >
                      Open
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Guest QR code" subtitle="Printed for the table card or standee." />
            <CardBody className="space-y-3">
              <div
                className="mx-auto w-fit rounded-xl border border-line bg-white p-3 [&_svg]:h-44 [&_svg]:w-44"
                dangerouslySetInnerHTML={{ __html: qrSvg }}
              />
              <p className="break-all text-center text-[10.5px] leading-relaxed text-muted">
                {guestUrl}
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                <a
                  href={`/api/tables/${row.table.id}/qr`}
                  className="inline-flex h-9 items-center rounded-lg border border-line bg-white px-3 text-[12.5px] font-semibold text-ink hover:border-charcoal/25"
                >
                  Download SVG
                </a>
                <Link
                  href={`/m/${row.branchSlug}?t=${row.table.qrToken}`}
                  target="_blank"
                  className="inline-flex h-9 items-center rounded-lg bg-charcoal px-3 text-[12.5px] font-semibold text-cream hover:bg-ink"
                >
                  Open guest menu ↗
                </Link>
              </div>
              <p className="text-[11px] leading-relaxed text-muted">
                The QR opens the branch menu with this table's label. Change the
                public URL in business settings when the site goes live.
              </p>
            </CardBody>
          </Card>

          {canManage ? (
            <Card className="border-danger/25">
              <CardHeader
                title="Remove table"
                subtitle="Tables with reservation history are deactivated instead of deleted."
              />
              <CardBody>
                <form action={deleteTableAction}>
                  <input type="hidden" name="tableId" value={row.table.id} />
                  <SubmitButton
                    variant="danger"
                    size="sm"
                    pendingLabel="Removing…"
                    confirmMessage={`Remove table ${row.table.code}?`}
                  >
                    Remove table
                  </SubmitButton>
                </form>
              </CardBody>
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}
