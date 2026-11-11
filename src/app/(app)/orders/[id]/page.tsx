import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import {
  canAccessBranch,
  hasPermission,
  requirePermissionPage,
} from "@/lib/auth/access";
import { requireUser } from "@/lib/auth/session";
import { getOrderDetail } from "@/services/orders";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { ORDER_CHANNEL_LABELS, PAYMENT_METHOD_LABELS } from "@/lib/validation";
import { PaymentForm } from "./payment-form";
import { CancelOrder } from "./cancel-order";

export const metadata: Metadata = { title: "Order" };
export const dynamic = "force-dynamic";

function StatusPill({ status }: { status: string }) {
  if (status === "paid") return <Badge tone="success">Paid</Badge>;
  if (status === "cancelled") return <Badge tone="danger">Cancelled</Badge>;
  return <Badge tone="ember">Open</Badge>;
}

export default async function OrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string; paid?: string; cancelled?: string }>;
}) {
  const user = await requireUser();
  requirePermissionPage(user, "orders.view");

  const { id } = await params;
  const detail = await getOrderDetail(id);
  if (!detail) notFound();
  if (!canAccessBranch(user, detail.order.branchId)) {
    redirect("/forbidden?permission=branch_scope");
  }

  const notices = await searchParams;
  const { order, paid, balance } = detail;
  const canPay = hasPermission(user, "payments.collect");
  const canCancel = hasPermission(user, "orders.manage");

  return (
    <>
      <PageHeader
        eyebrow={`Order · ${detail.branchCode}`}
        title={order.orderNumber}
        description={`${detail.branchName} · opened ${formatDateTime(order.createdAt)}${
          detail.createdByName ? ` by ${detail.createdByName}` : ""
        }`}
        actions={
          <div className="flex flex-wrap gap-2">
            <ButtonLink
              href={`/orders/${order.id}/receipt`}
              variant="secondary"
              size="sm"
              target="_blank"
            >
              Receipt
            </ButtonLink>
            {hasPermission(user, "orders.create") ? (
              <ButtonLink href="/pos" size="sm">
                New order
              </ButtonLink>
            ) : null}
          </div>
        }
      />

      {notices.created ? (
        <div className="mb-4">
          <Alert tone="success">
            Order opened. Take payment now, or leave it open and settle later.
          </Alert>
        </div>
      ) : null}
      {notices.paid ? (
        <div className="mb-4">
          <Alert tone="success">Payment recorded against this order.</Alert>
        </div>
      ) : null}
      {notices.cancelled ? (
        <div className="mb-4">
          <Alert tone="info">This order has been cancelled.</Alert>
        </div>
      ) : null}

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <div className="min-w-0 space-y-5">
          <Card className="overflow-hidden">
            <CardHeader
              title="Order lines"
              subtitle={`${detail.items.length} line${detail.items.length === 1 ? "" : "s"} · ${
                ORDER_CHANNEL_LABELS[
                  order.channel as keyof typeof ORDER_CHANNEL_LABELS
                ] ?? order.channel
              }`}
              action={<StatusPill status={order.status} />}
            />
            <div className="overflow-x-auto">
              <table className="table-base sm:min-w-[26rem]">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th className="text-center">Qty</th>
                    <th className="hidden text-right sm:table-cell">Unit</th>
                    <th className="text-right">Line</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <p className="font-medium text-ink">{item.name}</p>
                        {item.notes ? (
                          <p className="text-[11px] text-muted">{item.notes}</p>
                        ) : null}
                      </td>
                      <td className="text-center tabular-nums">{item.quantity}</td>
                      <td className="hidden text-right tabular-nums text-muted sm:table-cell">
                        {formatCurrency(item.unitPrice, order.currency)}
                      </td>
                      <td className="text-right font-medium tabular-nums">
                        {formatCurrency(item.lineTotal, order.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="space-y-1.5 border-t border-line bg-sand/40 px-4 py-3 text-[13px] sm:px-5">
              <div className="flex justify-between text-muted">
                <span>Subtotal</span>
                <span className="tabular-nums">
                  {formatCurrency(order.subtotal, order.currency)}
                </span>
              </div>
              <div className="flex justify-between text-muted">
                <span>Service charge</span>
                <span className="tabular-nums">
                  {formatCurrency(order.serviceCharge, order.currency)}
                </span>
              </div>
              <div className="flex justify-between text-muted">
                <span>VAT</span>
                <span className="tabular-nums">
                  {formatCurrency(order.tax, order.currency)}
                </span>
              </div>
              <div className="flex justify-between border-t border-line pt-1.5 text-[15px] font-semibold text-ink">
                <span>Total</span>
                <span className="tabular-nums">
                  {formatCurrency(order.total, order.currency)}
                </span>
              </div>
              {paid > 0 ? (
                <>
                  <div className="flex justify-between text-muted">
                    <span>Paid</span>
                    <span className="tabular-nums">
                      {formatCurrency(paid, order.currency)}
                    </span>
                  </div>
                  <div className="flex justify-between font-medium text-ink">
                    <span>Balance</span>
                    <span className="tabular-nums">
                      {formatCurrency(balance, order.currency)}
                    </span>
                  </div>
                </>
              ) : null}
            </div>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader
              title="Payments"
              subtitle={
                detail.payments.length === 0
                  ? "No payment recorded yet."
                  : `${detail.payments.length} payment${
                      detail.payments.length === 1 ? "" : "s"
                    } received.`
              }
            />
            {detail.payments.length === 0 ? (
              <p className="px-4 py-6 text-[13px] text-muted sm:px-5">
                This order is still open. Record cash, mobile money or card
                payments from the panel beside it.
              </p>
            ) : (
              <ul className="divide-y divide-line/70">
                {detail.payments.map((payment) => (
                  <li
                    key={payment.id}
                    className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5"
                  >
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-ink">
                        {PAYMENT_METHOD_LABELS[
                          payment.method as keyof typeof PAYMENT_METHOD_LABELS
                        ] ?? payment.method}
                      </p>
                      <p className="truncate text-[11px] text-muted">
                        {formatDateTime(payment.createdAt)}
                        {payment.receivedByName ? ` · ${payment.receivedByName}` : ""}
                        {payment.reference ? ` · ref ${payment.reference}` : ""}
                      </p>
                    </div>
                    <p className="shrink-0 text-[13px] font-semibold tabular-nums">
                      {formatCurrency(payment.amount, order.currency)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader title="Guest" subtitle="Service details captured at the till." />
            <dl className="space-y-2 px-4 py-3 text-[13px] sm:px-5">
              {[
                ["Branch", detail.branchName],
                ["Service", ORDER_CHANNEL_LABELS[
                  order.channel as keyof typeof ORDER_CHANNEL_LABELS
                ] ?? order.channel],
                ["Table", order.tableLabel ?? "—"],
                ["Guest", order.customerName ?? "Walk-in"],
                ["Guests", order.guestCount ? String(order.guestCount) : "—"],
                ["Opened by", detail.createdByName ?? "—"],
                ["Paid at", order.paidAt ? formatDateTime(order.paidAt) : "—"],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-3">
                  <dt className="shrink-0 text-muted">{label}</dt>
                  <dd className="min-w-0 text-right font-medium text-ink">{value}</dd>
                </div>
              ))}
              {order.notes ? (
                <div className="border-t border-line pt-2 text-muted">
                  <dt className="text-[11px] uppercase tracking-[0.14em]">Note</dt>
                  <dd className="mt-1 text-ink/80">{order.notes}</dd>
                </div>
              ) : null}
              {order.cancelledReason ? (
                <div className="border-t border-line pt-2 text-muted">
                  <dt className="text-[11px] uppercase tracking-[0.14em]">
                    Cancellation reason
                  </dt>
                  <dd className="mt-1 text-ink/80">{order.cancelledReason}</dd>
                </div>
              ) : null}
            </dl>
          </Card>

          {order.status === "pending" && canPay ? (
            <Card>
              <CardHeader title="Take payment" subtitle="Settle the balance at the till." />
              <div className="px-4 py-3 sm:px-5">
                <PaymentForm
                  orderId={order.id}
                  balance={balance}
                  currency={order.currency}
                />
              </div>
            </Card>
          ) : null}

          {order.status === "paid" ? (
            <Card>
              <div className="px-4 py-4 sm:px-5">
                <p className="text-[13px] text-muted">
                  This order is settled. A receipt is available for the guest.
                </p>
                <ButtonLink
                  href={`/orders/${order.id}/receipt`}
                  variant="secondary"
                  size="sm"
                  className="mt-3 w-full"
                  target="_blank"
                >
                  Open receipt
                </ButtonLink>
              </div>
            </Card>
          ) : null}

          {order.status === "pending" && canCancel ? (
            <Card>
              <div className="px-4 py-4 sm:px-5">
                <CancelOrder orderId={order.id} />
              </div>
            </Card>
          ) : null}

          <p className="px-1 text-[11.5px] leading-relaxed text-muted">
            <Link href="/orders" className="font-semibold text-ember-strong hover:underline">
              Back to orders
            </Link>
            . Menu prices are snapshotted on the order, so repricing the menu never
            alters a past receipt.
          </p>
        </div>
      </div>
    </>
  );
}
