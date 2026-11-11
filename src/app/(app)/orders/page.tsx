import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { hasPermission, requirePermissionPage } from "@/lib/auth/access";
import { requireUser } from "@/lib/auth/session";
import { branchScope } from "@/lib/auth/access";
import { listBranches } from "@/services/branches";
import { listOrders } from "@/services/orders";
import { getSetting } from "@/services/settings";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { ORDER_CHANNEL_LABELS } from "@/lib/validation";

export const metadata: Metadata = { title: "Orders" };
export const dynamic = "force-dynamic";

const STATUS_TABS = [
  { key: "all", label: "All" },
  { key: "open", label: "Open" },
  { key: "paid", label: "Paid" },
  { key: "cancelled", label: "Cancelled" },
] as const;

function statusBadge(status: string) {
  if (status === "paid") return <Badge tone="success">Paid</Badge>;
  if (status === "cancelled") return <Badge tone="danger">Cancelled</Badge>;
  if (status === "pending") return <Badge tone="ember">Open</Badge>;
  return <Badge tone="neutral">{status}</Badge>;
}

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; branch?: string }>;
}) {
  const user = await requireUser();
  requirePermissionPage(user, "orders.view");

  const params = await searchParams;
  const scope = branchScope(user);
  const status = STATUS_TABS.some((tab) => tab.key === params.status)
    ? (params.status as string)
    : "all";
  const search = (params.q ?? "").slice(0, 80);

  const branches = await listBranches(scope);
  const branchId =
    scope === null && params.branch && branches.some((branch) => branch.id === params.branch)
      ? params.branch
      : undefined;

  const [rows, currency] = await Promise.all([
    listOrders(scope, { status, branchId, search }),
    getSetting("business.currency", "RWF"),
  ]);

  const openCount = rows.filter((row) => row.status === "pending").length;

  return (
    <>
      <PageHeader
        eyebrow="Service"
        title="Orders"
        description="Every order in your scope, newest first. Open an order to take payment or print its receipt."
        actions={
          hasPermission(user, "orders.create") ? (
            <ButtonLink href="/pos" size="sm">
              New order
            </ButtonLink>
          ) : null
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {STATUS_TABS.map((tab) => {
          const query = new URLSearchParams();
          if (tab.key !== "all") query.set("status", tab.key);
          if (search) query.set("q", search);
          if (branchId) query.set("branch", branchId);
          const href = query.toString() ? `/orders?${query.toString()}` : "/orders";
          return (
            <Link
              key={tab.key}
              href={href}
              className={`rounded-full border px-3.5 py-1.5 text-[12px] font-semibold transition ${
                status === tab.key
                  ? "border-charcoal bg-charcoal text-cream"
                  : "border-line bg-white text-ink/70 hover:border-charcoal/25"
              }`}
            >
              {tab.label}
              {tab.key === "open" && openCount > 0 && status !== "open" ? (
                <span className="ml-1.5 rounded-full bg-ember px-1.5 text-[10px] text-white">
                  {openCount}
                </span>
              ) : null}
            </Link>
          );
        })}

        <form action="/orders" className="ml-auto flex w-full gap-2 sm:w-auto">
          {status !== "all" ? <input type="hidden" name="status" value={status} /> : null}
          {branchId ? <input type="hidden" name="branch" value={branchId} /> : null}
          <input
            name="q"
            defaultValue={search}
            placeholder="Order no. or guest"
            aria-label="Search orders"
            className="field-input h-9 w-full py-0 text-[13px] sm:w-52"
          />
          <button
            type="submit"
            className="inline-flex h-9 shrink-0 items-center rounded-lg border border-line bg-white px-3 text-[12px] font-semibold text-ink hover:border-charcoal/25"
          >
            Search
          </button>
        </form>
      </div>

      {scope === null && branches.length > 1 ? (
        <div className="mb-4 flex flex-wrap gap-2">
          <Link
            href={`/orders${status !== "all" ? `?status=${status}` : ""}`}
            className={`rounded-full border px-3 py-1.5 text-[11.5px] font-semibold ${
              !branchId
                ? "border-ember bg-ember-soft text-ember-strong"
                : "border-line bg-white text-ink/60"
            }`}
          >
            All branches
          </Link>
          {branches.map((branch) => {
            const query = new URLSearchParams({ branch: branch.id });
            if (status !== "all") query.set("status", status);
            return (
              <Link
                key={branch.id}
                href={`/orders?${query.toString()}`}
                className={`rounded-full border px-3 py-1.5 text-[11.5px] font-semibold ${
                  branchId === branch.id
                    ? "border-ember bg-ember-soft text-ember-strong"
                    : "border-line bg-white text-ink/60"
                }`}
              >
                {branch.code}
              </Link>
            );
          })}
        </div>
      ) : null}

      <Card className="overflow-hidden">
        <div className="hidden overflow-x-auto sm:block">
          <table className="table-base min-w-[46rem]">
            <thead>
              <tr>
                <th>Order</th>
                <th>Branch</th>
                <th>Service</th>
                <th className="text-right">Total</th>
                <th className="text-right">Balance</th>
                <th>Status</th>
                <th>Opened</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <Link
                      href={`/orders/${row.id}`}
                      className="font-medium text-ink hover:text-ember-strong"
                    >
                      {row.orderNumber}
                    </Link>
                    <p className="text-[11px] text-muted">
                      {row.customerName ?? row.tableLabel ?? row.createdByName ?? "Walk-in"}
                    </p>
                  </td>
                  <td className="text-muted">{row.branchName}</td>
                  <td className="text-muted">
                    {ORDER_CHANNEL_LABELS[
                      row.channel as keyof typeof ORDER_CHANNEL_LABELS
                    ] ?? row.channel}
                  </td>
                  <td className="text-right font-medium tabular-nums">
                    {formatCurrency(row.total, row.currency)}
                  </td>
                  <td className="text-right tabular-nums text-muted">
                    {row.status === "cancelled"
                      ? "—"
                      : formatCurrency(Math.max(row.total - row.paid, 0), row.currency)}
                  </td>
                  <td>{statusBadge(row.status)}</td>
                  <td className="whitespace-nowrap text-[12px] text-muted">
                    {formatDateTime(row.createdAt)}
                  </td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-muted">
                    {search
                      ? "No orders match that search."
                      : "No orders yet. Open the point of sale to take the first one."}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <ul className="divide-y divide-line/70 sm:hidden">
          {rows.map((row) => (
            <li key={row.id}>
              <Link href={`/orders/${row.id}`} className="block px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[13.5px] font-medium text-ink">
                      {row.orderNumber}
                    </p>
                    <p className="truncate text-[11px] text-muted">
                      {row.branchName} ·{" "}
                      {ORDER_CHANNEL_LABELS[
                        row.channel as keyof typeof ORDER_CHANNEL_LABELS
                      ] ?? row.channel}
                    </p>
                  </div>
                  <p className="shrink-0 text-right text-[13px] font-semibold tabular-nums">
                    {formatCurrency(row.total, row.currency)}
                  </p>
                </div>
                <div className="mt-1.5 flex items-center justify-between gap-2">
                  <p className="text-[11px] text-muted">
                    {formatDateTime(row.createdAt)}
                  </p>
                  {statusBadge(row.status)}
                </div>
              </Link>
            </li>
          ))}
          {rows.length === 0 ? (
            <li className="px-4 py-10 text-center text-[13px] text-muted">
              {search
                ? "No orders match that search."
                : "No orders yet. Open the point of sale to take the first one."}
            </li>
          ) : null}
        </ul>
      </Card>

      <p className="mt-3 text-[11.5px] text-muted">
        Showing the latest {rows.length} order{rows.length === 1 ? "" : "s"} in{" "}
        {currency}. Totals include service charge and VAT.
      </p>
    </>
  );
}
