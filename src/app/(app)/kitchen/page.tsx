import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Alert } from "@/components/ui/alert";
import { StatCard } from "@/components/ui/stat-card";
import { branchScope, hasPermission, requirePermissionPage } from "@/lib/auth/access";
import { requireUser } from "@/lib/auth/session";
import { listBranches } from "@/services/branches";
import {
  getKitchenSummary,
  getUnpaidKitchenCount,
  listKitchenOrders,
} from "@/services/kitchen";
import { getSetting } from "@/services/settings";
import {
  KITCHEN_STATIONS,
  STATION_HINTS,
  STATION_LABELS,
  isKitchenStation,
} from "@/lib/kitchen-stations";
import { KitchenBoard } from "./kitchen-board";

export const metadata: Metadata = { title: "Kitchen" };
export const dynamic = "force-dynamic";

export default async function KitchenPage({
  searchParams,
}: {
  searchParams: Promise<{ branch?: string; station?: string; error?: string }>;
}) {
  const user = await requireUser();
  requirePermissionPage(user, "kitchen.view");

  const params = await searchParams;
  const scope = branchScope(user);
  const canManage = hasPermission(user, "kitchen.manage");

  const branches = await listBranches(scope, { includeInactive: true });
  const activeBranches = branches.filter((branch) => branch.isActive);
  const selected = activeBranches.find((branch) => branch.id === params.branch);
  const branchId = scope === null ? selected?.id : undefined;
  const station = isKitchenStation(params.station) ? params.station : undefined;

  const [orders, summary, unpaid, currency] = await Promise.all([
    listKitchenOrders(scope, { branchId, station }),
    getKitchenSummary(scope, branchId, station),
    getUnpaidKitchenCount(scope, branchId),
    getSetting("business.currency", "RWF"),
  ]);

  const kitchenHref = (next: {
    branch?: string | null;
    station?: string | null;
  }) => {
    const search = new URLSearchParams();
    const nextBranch = next.branch === undefined ? branchId : next.branch;
    const nextStation = next.station === undefined ? station : next.station;
    if (nextBranch) search.set("branch", nextBranch);
    if (nextStation) search.set("station", nextStation);
    const query = search.toString();
    return `/kitchen${query ? `?${query}` : ""}`;
  };

  const returnTo = kitchenHref({});

  return (
    <>
      <PageHeader
        eyebrow="Back of house"
        title="Kitchen display"
        description={
          station
            ? `${STATION_LABELS[station]} tickets only — ${STATION_HINTS[station].toLowerCase()}. New tickets appear the moment the till takes payment.`
            : "Paid orders move from queued to preparing, ready and served. Pick a section so each screen sees only the items it prepares."
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/orders"
              className="inline-flex h-9 items-center rounded-lg border border-line bg-white px-3 text-[12.5px] font-semibold text-ink hover:border-charcoal/25"
            >
              Orders
            </Link>
            {hasPermission(user, "menu.view") ? (
              <Link
                href="/menu"
                className="inline-flex h-9 items-center rounded-lg border border-line bg-white px-3 text-[12.5px] font-semibold text-ink hover:border-charcoal/25"
              >
                Menu
              </Link>
            ) : null}
          </div>
        }
      />

      {params.error ? (
        <div className="mb-4">
          <Alert tone="error">{params.error}</Alert>
        </div>
      ) : null}

      {scope === null && activeBranches.length > 1 ? (
        <div className="mb-5 flex flex-wrap gap-1.5">
          <Link
            href={kitchenHref({ branch: null })}
            className={`rounded-full border px-3 py-1.5 text-[12px] font-semibold ${
              branchId
                ? "border-line bg-white text-ink/70 hover:border-charcoal/25"
                : "border-charcoal bg-charcoal text-cream"
            }`}
          >
            Both kitchens
          </Link>
          {activeBranches.map((branch) => (
            <Link
              key={branch.id}
              href={kitchenHref({ branch: branch.id })}
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

      <div className="mb-5 flex flex-wrap gap-1.5">
        <Link
          href={kitchenHref({ station: null })}
          className={`rounded-full border px-3 py-1.5 text-[12px] font-semibold ${
            station
              ? "border-line bg-white text-ink/70 hover:border-charcoal/25"
              : "border-charcoal bg-charcoal text-cream"
          }`}
        >
          All sections
        </Link>
        {KITCHEN_STATIONS.map((value) => (
          <Link
            key={value}
            href={kitchenHref({ station: value })}
            title={STATION_HINTS[value]}
            aria-current={station === value ? "page" : undefined}
            className={`rounded-full border px-3 py-1.5 text-[12px] font-semibold ${
              station === value
                ? "border-ember bg-ember text-white"
                : "border-line bg-white text-ink/70 hover:border-charcoal/25"
            }`}
          >
            {STATION_LABELS[value]}
          </Link>
        ))}
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="In the queue"
          value={summary.queued}
          hint="Paid, not started"
          tone="dark"
        />
        <StatCard label="Preparing" value={summary.preparing} hint="On the line now" />
        <StatCard
          label="Ready to serve"
          value={summary.ready}
          hint={summary.ready > 0 ? "Call the floor" : "Nothing waiting"}
        />
        <StatCard
          label="Served today"
          value={summary.servedToday}
          hint={`${summary.oldestWaitMinutes} min oldest wait`}
        />
      </div>

      {unpaid > 0 ? (
        <div className="mb-4">
          <Alert tone="info">
            {unpaid} order{unpaid === 1 ? "" : "s"} still waiting for payment at
            the till — they appear here once paid.
          </Alert>
        </div>
      ) : null}

      {orders.length === 0 ? (
        <div className="mb-3 rounded-2xl border border-line bg-white px-4 py-6 text-center shadow-card">
          <p className="font-display text-lg text-ink">
            {station ? `${STATION_LABELS[station]} is clear` : "Kitchen is clear"}
          </p>
          <p className="mx-auto mt-1 max-w-sm text-[13px] leading-relaxed text-muted">
            Leave this screen open — a paid order appears the instant the till
            takes payment.
          </p>
        </div>
      ) : null}

      <KitchenBoard
        orders={orders}
        currency={currency}
        canManage={canManage}
        branchFilter={branchId}
        station={station}
      />

      <p className="mt-4 text-[11px] leading-relaxed text-muted">
        Payment is settled at the till; the kitchen only sees paid orders.{" "}
        {canManage
          ? "Advance the card as work starts, finishes and leaves the pass."
          : "You have read-only access to the board."}{" "}
        <span className="sr-only">Board updates automatically over a live connection.</span>
        <Link href={returnTo} className="font-semibold text-ember-strong hover:underline">
          Reload board
        </Link>
      </p>
    </>
  );
}
