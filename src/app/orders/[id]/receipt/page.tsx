import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { canAccessBranch, hasPermission } from "@/lib/auth/access";
import { requireUser } from "@/lib/auth/session";
import { getBranchById } from "@/services/branches";
import { getOrderDetail } from "@/services/orders";
import { getSettingsMap } from "@/services/settings";
import { formatDateTime } from "@/lib/format";
import { ORDER_CHANNEL_LABELS, PAYMENT_METHOD_LABELS } from "@/lib/validation";
import { PrintButton } from "./print-button";

export const metadata: Metadata = { title: "Receipt" };
export const dynamic = "force-dynamic";

function money(minor: number, currency: string) {
  return `${currency} ${new Intl.NumberFormat("en-RW", {
    maximumFractionDigits: 0,
  })
    .format(Math.round(minor / 100))
    .replace(/,/g, " ")}`;
}

export default async function ReceiptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  if (!hasPermission(user, "orders.view")) {
    redirect("/forbidden?permission=orders.view");
  }

  const { id } = await params;
  const detail = await getOrderDetail(id);
  if (!detail) notFound();
  if (!canAccessBranch(user, detail.order.branchId)) {
    redirect("/forbidden?permission=branch_scope");
  }

  const [branch, settings] = await Promise.all([
    getBranchById(detail.order.branchId),
    getSettingsMap(),
  ]);

  const { order, paid, balance } = detail;
  const currency = order.currency;

  return (
    <div className="min-h-svh bg-sand/60 px-4 py-8 print:bg-white print:p-0">
      <div className="mx-auto w-full max-w-[26rem]">
        <PrintButton />

        <article className="receipt-shell mt-4 rounded-xl border border-line bg-white px-6 py-7 shadow-card print:mt-0 print:border-0 print:shadow-none">
          <header className="text-center">
            <p className="font-display text-xl leading-tight text-ink">
              {settings["business.name"] ?? "Vista Kigali"}
            </p>
            <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-muted">
              {settings["business.tagline"] ?? "Bar · Resto · Accommodation"}
            </p>
            <p className="mt-3 text-[11.5px] leading-relaxed text-muted">
              {detail.branchName}
              <br />
              {branch?.address ?? detail.branchAddress}
              {branch?.phone ? (
                <>
                  <br />
                  {branch.phone}
                </>
              ) : null}
            </p>
          </header>

          <div className="my-5 border-t border-dashed border-line" />

          <dl className="grid grid-cols-2 gap-y-1 text-[11.5px]">
            <dt className="text-muted">Receipt</dt>
            <dd className="text-right font-semibold text-ink">{order.orderNumber}</dd>
            <dt className="text-muted">Date</dt>
            <dd className="text-right text-ink">{formatDateTime(order.createdAt)}</dd>
            <dt className="text-muted">Service</dt>
            <dd className="text-right text-ink">
              {ORDER_CHANNEL_LABELS[order.channel as keyof typeof ORDER_CHANNEL_LABELS] ??
                order.channel}
              {order.tableLabel ? ` · ${order.tableLabel}` : ""}
            </dd>
            <dt className="text-muted">Served by</dt>
            <dd className="text-right text-ink">{detail.createdByName ?? "—"}</dd>
            {order.customerName ? (
              <>
                <dt className="text-muted">Guest</dt>
                <dd className="text-right text-ink">{order.customerName}</dd>
              </>
            ) : null}
          </dl>

          <div className="my-4 border-t border-dashed border-line" />

          <table className="w-full text-[11.5px]">
            <thead>
              <tr className="text-[10px] uppercase tracking-[0.12em] text-muted">
                <th className="pb-2 text-left font-semibold">Item</th>
                <th className="pb-2 text-center font-semibold">Qty</th>
                <th className="pb-2 text-right font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody>
              {detail.items.map((item) => (
                <tr key={item.id} className="align-top">
                  <td className="py-1 pr-2 text-ink">
                    {item.name}
                    <span className="block text-[10px] text-muted">
                      {money(item.unitPrice, currency)} each
                    </span>
                  </td>
                  <td className="py-1 text-center tabular-nums text-muted">
                    {item.quantity}
                  </td>
                  <td className="py-1 text-right tabular-nums text-ink">
                    {money(item.lineTotal, currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="my-4 border-t border-dashed border-line" />

          <div className="space-y-1 text-[12px]">
            <div className="flex justify-between text-muted">
              <span>Subtotal</span>
              <span className="tabular-nums">{money(order.subtotal, currency)}</span>
            </div>
            <div className="flex justify-between text-muted">
              <span>Service charge</span>
              <span className="tabular-nums">
                {money(order.serviceCharge, currency)}
              </span>
            </div>
            <div className="flex justify-between text-muted">
              <span>VAT</span>
              <span className="tabular-nums">{money(order.tax, currency)}</span>
            </div>
            <div className="mt-1 flex justify-between border-t border-line pt-2 text-[14px] font-semibold text-ink">
              <span>Total</span>
              <span className="tabular-nums">{money(order.total, currency)}</span>
            </div>
            {paid > 0 ? (
              <>
                <div className="flex justify-between text-muted">
                  <span>Paid</span>
                  <span className="tabular-nums">{money(paid, currency)}</span>
                </div>
                <div className="flex justify-between font-medium text-ink">
                  <span>Balance</span>
                  <span className="tabular-nums">{money(balance, currency)}</span>
                </div>
              </>
            ) : null}
          </div>

          {detail.payments.length > 0 ? (
            <>
              <div className="my-4 border-t border-dashed border-line" />
              <ul className="space-y-1 text-[11px] text-muted">
                {detail.payments.map((payment) => (
                  <li key={payment.id} className="flex justify-between gap-2">
                    <span>
                      {PAYMENT_METHOD_LABELS[
                        payment.method as keyof typeof PAYMENT_METHOD_LABELS
                      ] ?? payment.method}
                      {payment.reference ? ` · ${payment.reference}` : ""}
                    </span>
                    <span className="tabular-nums">{money(payment.amount, currency)}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}

          <div className="my-5 border-t border-dashed border-line" />

          <footer className="text-center">
            <p className="text-[11px] leading-relaxed text-muted">
              {order.status === "cancelled"
                ? "This order was cancelled and is not payable."
                : "Thank you for choosing Vista Kigali."}
            </p>
            <p className="mt-2 text-[10px] uppercase tracking-[0.16em] text-muted/70">
              {settings["business.phone"] ?? ""} · {settings["business.email"] ?? ""}
            </p>
            <p className="mt-1 text-[10px] text-muted/70">
              Receipt generated {formatDateTime(new Date())}
            </p>
          </footer>
        </article>

        <p className="no-print mt-4 text-center text-[11px] text-muted">
          A copy is stored with the order. Printing uses your browser dialog.
        </p>
      </div>
    </div>
  );
}
