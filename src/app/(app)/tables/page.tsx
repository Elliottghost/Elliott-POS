import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";
import { branchScope, hasPermission, requirePermissionPage } from "@/lib/auth/access";
import { requireUser } from "@/lib/auth/session";
import { listBranches } from "@/services/branches";
import { getTableStats, listTables } from "@/services/tables";
import { TableStatusForm } from "./table-forms";

export const metadata: Metadata = { title: "Tables" };
export const dynamic = "force-dynamic";

const STATUS_STYLES: Record<string, string> = {
  available: "border-success/25 bg-success/10 text-success",
  occupied: "border-ember/25 bg-ember-soft text-ember-strong",
  reserved: "border-charcoal/20 bg-charcoal/[0.06] text-ink",
  unavailable: "border-line bg-sand text-muted",
};

const STATUS_LABELS: Record<string, string> = {
  available: "Available",
  occupied: "Occupied",
  reserved: "Reserved",
  unavailable: "Unavailable",
};

export default async function TablesPage({
  searchParams,
}: {
  searchParams: Promise<{ branch?: string; saved?: string; error?: string }>;
}) {
  const user = await requireUser();
  requirePermissionPage(user, "tables.view");

  const params = await searchParams;
  const scope = branchScope(user);
  const canManage = hasPermission(user, "tables.manage");

  const branches = await listBranches(scope, { includeInactive: true });
  const activeBranches = branches.filter((branch) => branch.isActive);
  const selectedBranch =
    activeBranches.find((branch) => branch.id === params.branch) ?? undefined;
  const branchFilter = selectedBranch?.id;

  const [tables, stats] = await Promise.all([
    listTables(scope, { branchId: branchFilter, includeInactive: canManage }),
    getTableStats(scope, branchFilter),
  ]);

  const sections = [...new Set(tables.map((table) => `${table.branchCode}|${table.section}`))];
  const returnTo = `/tables${branchFilter ? `?branch=${branchFilter}` : ""}`;

  return (
    <>
      <PageHeader
        eyebrow="Restaurant floor"
        title="Tables"
        description="Every table, its section and live status. Each table carries a QR code that opens the branch menu for guests."
        actions={
          <div className="flex flex-wrap gap-2">
            <ButtonLink href="/reservations" variant="secondary" size="sm">
              Reservations
            </ButtonLink>
            {canManage ? (
              <ButtonLink href="/tables/new" size="sm">
                Add table
              </ButtonLink>
            ) : null}
          </div>
        }
      />

      {params.saved ? (
        <div className="mb-4">
          <Alert tone="success">
            {params.saved === "table_removed"
              ? "Table removed from the floor plan."
              : "Table saved."}
          </Alert>
        </div>
      ) : null}
      {params.error ? (
        <div className="mb-4">
          <Alert tone="error">{params.error}</Alert>
        </div>
      ) : null}

      {activeBranches.length > 1 ? (
        <div className="mb-4 flex flex-wrap gap-1.5">
          <Link
            href="/tables"
            className={`rounded-full border px-3 py-1.5 text-[12px] font-semibold ${
              branchFilter
                ? "border-line bg-white text-ink/70 hover:border-charcoal/25"
                : "border-charcoal bg-charcoal text-cream"
            }`}
          >
            All branches
          </Link>
          {activeBranches.map((branch) => (
            <Link
              key={branch.id}
              href={`/tables?branch=${branch.id}`}
              className={`rounded-full border px-3 py-1.5 text-[12px] font-semibold ${
                branchFilter === branch.id
                  ? "border-charcoal bg-charcoal text-cream"
                  : "border-line bg-white text-ink/70 hover:border-charcoal/25"
              }`}
            >
              {branch.code} · {branch.name}
            </Link>
          ))}
        </div>
      ) : null}

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="Tables" value={stats.total} hint={`${stats.seats} seats in service`} />
        <StatCard label="Available" value={stats.available} hint="Ready for walk-ins" />
        <StatCard label="Occupied" value={stats.occupied} hint="Guests seated" />
        <StatCard label="Reserved" value={stats.reserved} hint="Held for bookings" />
        <StatCard
          label="Out of service"
          value={stats.unavailable}
          hint="Blocked or being reset"
          className="col-span-2 lg:col-span-1"
        />
      </div>

      {tables.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="font-display text-lg text-ink">No tables yet</p>
          <p className="mx-auto mt-1 max-w-sm text-[13px] leading-relaxed text-muted">
            {canManage
              ? "Add the physical tables of the restaurant — the reservation book and guest QR menus use them."
              : "Ask a manager to set up the floor plan."}
          </p>
          {canManage ? (
            <div className="mt-4 flex justify-center">
              <ButtonLink href="/tables/new" size="sm">
                Add the first table
              </ButtonLink>
            </div>
          ) : null}
        </Card>
      ) : (
        <div className="space-y-5">
          {sections.map((key) => {
            const [branchCode, section] = key.split("|");
            const sectionTables = tables.filter(
              (table) =>
                table.branchCode === branchCode && table.section === section,
            );
            return (
              <Card key={key} className="overflow-hidden">
                <CardHeader
                  title={`${section}`}
                  subtitle={`${branchCode} · ${sectionTables.length} table${
                    sectionTables.length === 1 ? "" : "s"
                  }`}
                />
                <div className="grid gap-3 px-4 py-4 sm:grid-cols-2 sm:px-5 xl:grid-cols-3">
                  {sectionTables.map((table) => (
                    <div
                      key={table.id}
                      className={`rounded-xl border p-3.5 ${
                        table.isActive
                          ? "border-line bg-white"
                          : "border-dashed border-line bg-sand/40"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-display text-lg leading-tight text-ink">
                            {table.code}
                          </p>
                          <p className="truncate text-[11.5px] text-muted">
                            {table.capacity} seats
                            {table.name ? ` · ${table.name}` : ""}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 rounded-full border px-2 py-0.5 text-[10.5px] font-semibold ${
                            STATUS_STYLES[table.status] ?? STATUS_STYLES.available
                          }`}
                        >
                          {STATUS_LABELS[table.status] ?? table.status}
                        </span>
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
                        <Badge tone={table.isActive ? "neutral" : "neutral"}>
                          {table.isActive ? "In service" : "Out of service"}
                        </Badge>
                        {table.reservationsToday > 0 ? (
                          <span>
                            {table.reservationsToday} booking
                            {table.reservationsToday === 1 ? "" : "s"} today
                          </span>
                        ) : (
                          <span>No bookings today</span>
                        )}
                      </div>

                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line/70 pt-2.5">
                        {canManage ? (
                          <TableStatusForm
                            tableId={table.id}
                            current={table.status}
                            returnTo={returnTo}
                          />
                        ) : (
                          <span className="text-[11px] text-muted">View only</span>
                        )}
                        <Link
                          href={`/tables/${table.id}`}
                          className="text-[11.5px] font-semibold text-ember-strong hover:underline"
                        >
                          QR & details
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
