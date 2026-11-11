import { and, desc, eq, inArray, like, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db/client";
import {
  branches,
  menuCategories,
  menuItems,
  orderItems,
  orders,
  payments,
  users,
} from "@/db/schema";
import { recordAudit } from "@/lib/audit";
import { canAccessBranch } from "@/lib/auth/access";
import type { RequestMeta, SessionUser } from "@/lib/auth/session";
import { getSetting } from "@/services/settings";
import { publishKitchenEvent } from "@/lib/realtime/kitchen-events";
import type { OrderCreateInput, PaymentInput } from "@/lib/validation";

export interface OrderTotals {
  subtotal: number;
  serviceCharge: number;
  tax: number;
  total: number;
}

/**
 * Money is stored in cents. Service charge applies to the subtotal and VAT is
 * charged on the subtotal plus service, rounded once per component.
 */
export function computeTotals(
  subtotal: number,
  rates: { servicePercent: number; taxPercent: number },
): OrderTotals {
  const serviceCharge = Math.round((subtotal * rates.servicePercent) / 100);
  const tax = Math.round(((subtotal + serviceCharge) * rates.taxPercent) / 100);
  return {
    subtotal,
    serviceCharge,
    tax,
    total: subtotal + serviceCharge + tax,
  };
}

export async function getOrderRates() {
  const [service, tax] = await Promise.all([
    getSetting("operations.service_charge_percent", "0"),
    getSetting("operations.tax_percent", "0"),
  ]);
  const toNumber = (value: string) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  };
  return { servicePercent: toNumber(service), taxPercent: toNumber(tax) };
}

export type OrderServiceResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? { id?: undefined } : { id: T }))
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

interface PreparedLine {
  menuItemId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  notes: string | null;
}

async function prepareLines(
  branchId: string,
  input: OrderCreateInput["items"],
): Promise<{ ok: true; lines: PreparedLine[]; subtotal: number } | { ok: false; error: string }> {
  const ids = [...new Set(input.map((line) => line.menuItemId))];
  if (ids.length === 0) return { ok: false, error: "Add at least one item." };

  const rows = await db
    .select({
      id: menuItems.id,
      name: menuItems.name,
      price: menuItems.price,
      isActive: menuItems.isActive,
      categoryActive: menuCategories.isActive,
      priceOverride: sql<
        number | null
      >`(select branch_menu_items.price_override from branch_menu_items
        where branch_menu_items.menu_item_id = menu_items.id
          and branch_menu_items.branch_id = ${branchId}
        limit 1)`,
      prepMinutes: menuItems.prepMinutes,
      isAvailable: sql<number>`coalesce((
        select branch_menu_items.is_available from branch_menu_items
        where branch_menu_items.menu_item_id = menu_items.id
          and branch_menu_items.branch_id = ${branchId}
        limit 1
      ), 1)`,
    })
    .from(menuItems)
    .innerJoin(menuCategories, eq(menuCategories.id, menuItems.categoryId))
    .where(inArray(menuItems.id, ids));

  const byId = new Map(rows.map((row) => [row.id, row]));

  // Collapse duplicate picks into one line, keeping the first note.
  const merged = new Map<string, { quantity: number; notes: string | null }>();
  for (const line of input) {
    const current = merged.get(line.menuItemId);
    if (current) {
      current.quantity += line.quantity;
    } else {
      merged.set(line.menuItemId, {
        quantity: line.quantity,
        notes: line.notes ?? null,
      });
    }
  }

  const lines: PreparedLine[] = [];
  for (const [menuItemId, picked] of merged) {
    const item = byId.get(menuItemId);
    if (!item || !item.isActive || !item.categoryActive) {
      return {
        ok: false,
        error: "One of the selected items is no longer on the menu. Refresh and try again.",
      };
    }
    if (!item.isAvailable) {
      return {
        ok: false,
        error: `"${item.name}" is sold out at this branch.`,
      };
    }
    if (picked.quantity > 99) {
      return { ok: false, error: "Maximum quantity per line is 99." };
    }
    // A branch price override always wins; otherwise the brand price applies.
    const unitPrice =
      item.priceOverride && Number(item.priceOverride) > 0
        ? Number(item.priceOverride)
        : item.price;
    lines.push({
      menuItemId,
      name: item.name,
      unitPrice,
      quantity: picked.quantity,
      lineTotal: unitPrice * picked.quantity,
      notes: picked.notes,
    });
  }

  const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
  return { ok: true, lines, subtotal };
}

async function nextOrderNumber(branchId: string, branchCode: string) {
  const prefix = `${branchCode}-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-`;
  const [row] = await db
    .select({ orderNumber: orders.orderNumber })
    .from(orders)
    .where(and(eq(orders.branchId, branchId), like(orders.orderNumber, `${prefix}%`)))
    .orderBy(desc(orders.orderNumber))
    .limit(1);

  const last = row ? Number(row.orderNumber.slice(prefix.length)) : 0;
  const sequence = Number.isFinite(last) ? last + 1 : 1;
  return `${prefix}${String(sequence).padStart(4, "0")}`;
}

export async function createOrder(
  actor: SessionUser,
  input: OrderCreateInput,
  meta?: RequestMeta,
): Promise<OrderServiceResult<string>> {
  const [branch] = await db
    .select({ id: branches.id, code: branches.code, name: branches.name, isActive: branches.isActive })
    .from(branches)
    .where(eq(branches.id, input.branchId))
    .limit(1);

  if (!branch) return { ok: false, error: "Branch not found." };
  if (!canAccessBranch(actor, branch.id)) {
    return { ok: false, error: "You can only open orders for your assigned branch." };
  }
  if (!branch.isActive) return { ok: false, error: "This branch is closed." };

  const prepared = await prepareLines(branch.id, input.items);
  if (!prepared.ok) return prepared;

  const rates = await getOrderRates();
  const totals = computeTotals(prepared.subtotal, rates);
  const currency = await getSetting("business.currency", "RWF");
  const orderNumber = await nextOrderNumber(branch.id, branch.code);

  const [order] = await db
    .insert(orders)
    .values({
      orderNumber,
      branchId: branch.id,
      status: "pending",
      channel: input.channel,
      subtotal: totals.subtotal,
      serviceCharge: totals.serviceCharge,
      tax: totals.tax,
      total: totals.total,
      currency,
      customerName: input.customerName ?? null,
      tableLabel: input.tableLabel ?? null,
      guestCount: input.guestCount ?? null,
      notes: input.notes ?? null,
      createdByUserId: actor.id,
    })
    .returning({ id: orders.id });

  for (const line of prepared.lines) {
    await db.insert(orderItems).values({
      orderId: order.id,
      menuItemId: line.menuItemId,
      nameSnapshot: line.name,
      unitPrice: line.unitPrice,
      quantity: line.quantity,
      lineTotal: line.lineTotal,
      notes: line.notes,
    });
  }

  const orderId = order.id;

  await recordAudit({
    actor,
    action: "order.created",
    entityType: "order",
    entityId: orderId,
    branchId: branch.id,
    description: `Order ${orderNumber} opened — ${prepared.lines.length} line(s), ${totals.total / 100} ${currency}.`,
    metadata: {
      orderNumber,
      channel: input.channel,
      subtotal: totals.subtotal,
      total: totals.total,
    },
    meta,
  });

  return { ok: true, id: orderId };
}

export async function getOrderById(orderId: string) {
  const [row] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  return row ?? null;
}

export interface OrderListRow {
  id: string;
  orderNumber: string;
  branchId: string;
  branchName: string;
  status: string;
  channel: string;
  total: number;
  paid: number;
  currency: string;
  customerName: string | null;
  tableLabel: string | null;
  createdByName: string | null;
  createdAt: Date;
}

export async function listOrders(
  scope: string[] | null,
  filters: { status?: string; branchId?: string; search?: string; limit?: number } = {},
): Promise<OrderListRow[]> {
  const conditions: SQL[] = [];

  if (filters.branchId) {
    conditions.push(eq(orders.branchId, filters.branchId));
  } else if (scope !== null) {
    if (scope.length === 0) return [];
    conditions.push(inArray(orders.branchId, scope));
  }

  const status = filters.status ?? "all";
  if (status === "open") conditions.push(eq(orders.status, "pending"));
  else if (status === "paid") conditions.push(eq(orders.status, "paid"));
  else if (status === "cancelled") conditions.push(eq(orders.status, "cancelled"));

  if (filters.search) {
    const term = `%${filters.search.trim().toLowerCase()}%`;
    const search = or(
      like(sql`lower(${orders.orderNumber})`, term),
      like(sql`lower(coalesce(${orders.customerName}, ''))`, term),
      like(sql`lower(coalesce(${orders.tableLabel}, ''))`, term),
    );
    if (search) conditions.push(search);
  }

  const rows = await db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      branchId: orders.branchId,
      branchName: branches.name,
      status: orders.status,
      channel: orders.channel,
      total: orders.total,
      currency: orders.currency,
      customerName: orders.customerName,
      tableLabel: orders.tableLabel,
      createdByName: users.fullName,
      createdAt: orders.createdAt,
      paid: sql<number>`coalesce((
        select sum(payments.amount) from payments where payments.order_id = orders.id
      ), 0)`,
    })
    .from(orders)
    .innerJoin(branches, eq(branches.id, orders.branchId))
    .leftJoin(users, eq(users.id, orders.createdByUserId))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(orders.createdAt))
    .limit(Math.min(filters.limit ?? 100, 200));

  return rows.map((row) => ({ ...row, paid: Number(row.paid) }));
}

export interface OrderDetail {
  order: typeof orders.$inferSelect;
  branchName: string;
  branchCode: string;
  branchAddress: string;
  createdByName: string | null;
  items: {
    id: string;
    name: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    notes: string | null;
  }[];
  payments: {
    id: string;
    method: string;
    amount: number;
    reference: string | null;
    receivedByName: string | null;
    createdAt: Date;
  }[];
  paid: number;
  balance: number;
}

export async function getOrderDetail(orderId: string): Promise<OrderDetail | null> {
  const [row] = await db
    .select({
      order: orders,
      branchName: branches.name,
      branchCode: branches.code,
      branchAddress: branches.address,
      createdByName: users.fullName,
    })
    .from(orders)
    .innerJoin(branches, eq(branches.id, orders.branchId))
    .leftJoin(users, eq(users.id, orders.createdByUserId))
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!row) return null;

  const items = await db
    .select({
      id: orderItems.id,
      name: orderItems.nameSnapshot,
      quantity: orderItems.quantity,
      unitPrice: orderItems.unitPrice,
      lineTotal: orderItems.lineTotal,
      notes: orderItems.notes,
    })
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId))
    .orderBy(desc(orderItems.lineTotal));

  const paymentRows = await db
    .select({
      id: payments.id,
      method: payments.method,
      amount: payments.amount,
      reference: payments.reference,
      receivedByName: users.fullName,
      createdAt: payments.createdAt,
    })
    .from(payments)
    .leftJoin(users, eq(users.id, payments.receivedByUserId))
    .where(eq(payments.orderId, orderId))
    .orderBy(payments.createdAt);

  const paid = paymentRows.reduce((sum, payment) => sum + payment.amount, 0);

  return {
    order: row.order,
    branchName: row.branchName,
    branchCode: row.branchCode,
    branchAddress: row.branchAddress,
    createdByName: row.createdByName,
    items,
    payments: paymentRows,
    paid,
    balance: Math.max(row.order.total - paid, 0),
  };
}

export async function recordPayment(
  actor: SessionUser,
  input: PaymentInput,
  meta?: RequestMeta,
): Promise<{ ok: true; paid: number; balance: number } | { ok: false; error: string }> {
  const order = await getOrderById(input.orderId);
  if (!order) return { ok: false, error: "Order not found." };
  if (!canAccessBranch(actor, order.branchId)) {
    return { ok: false, error: "This order belongs to another branch." };
  }
  if (order.status === "cancelled") {
    return { ok: false, error: "Cancelled orders cannot take payments." };
  }

  const [paidRow] = await db
    .select({ paid: sql<number>`coalesce(sum(${payments.amount}), 0)` })
    .from(payments)
    .where(eq(payments.orderId, order.id));

  const alreadyPaid = Number(paidRow?.paid ?? 0);
  const balance = Math.max(order.total - alreadyPaid, 0);

  if (balance <= 0) {
    return { ok: false, error: "This order is already settled in full." };
  }
  if (input.amount > balance) {
    return {
      ok: false,
      error: `The amount exceeds the ${balance / 100} ${order.currency} balance.`,
    };
  }

  const newPaid = alreadyPaid + input.amount;
  const becamePaid = newPaid >= order.total;

  await db.insert(payments).values({
    orderId: order.id,
    method: input.method,
    amount: input.amount,
    reference: input.reference ?? null,
    receivedByUserId: actor.id,
  });

  if (becamePaid) {
    await db
      .update(orders)
      .set({ status: "paid", paidAt: new Date(), updatedAt: new Date() })
      .where(eq(orders.id, order.id));
  }

  await recordAudit({
    actor,
    action: "order.payment_recorded",
    entityType: "order",
    entityId: order.id,
    branchId: order.branchId,
    description: `${input.method.toUpperCase()} payment of ${input.amount / 100} ${order.currency} recorded on ${order.orderNumber}.`,
    metadata: {
      orderNumber: order.orderNumber,
      amount: input.amount,
      method: input.method,
      balance: Math.max(order.total - newPaid, 0),
    },
    meta,
  });

  if (becamePaid) {
    publishKitchenEvent({
      type: "order.paid",
      branchId: order.branchId,
      orderId: order.id,
      orderNumber: order.orderNumber,
      fulfillmentStatus: "queued",
      at: new Date().toISOString(),
    });
  }

  return { ok: true, paid: newPaid, balance: Math.max(order.total - newPaid, 0) };
}

export async function cancelOrder(
  actor: SessionUser,
  orderId: string,
  reason: string | null,
  meta?: RequestMeta,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const order = await getOrderById(orderId);
  if (!order) return { ok: false, error: "Order not found." };
  if (!canAccessBranch(actor, order.branchId)) {
    return { ok: false, error: "This order belongs to another branch." };
  }
  if (order.status === "cancelled") return { ok: false, error: "This order is already cancelled." };
  if (order.status === "paid") {
    return { ok: false, error: "Paid orders cannot be cancelled at the till." };
  }

  const [paidRow] = await db
    .select({ paid: sql<number>`coalesce(sum(${payments.amount}), 0)` })
    .from(payments)
    .where(eq(payments.orderId, order.id));

  if (Number(paidRow?.paid ?? 0) > 0) {
    return {
      ok: false,
      error: "This order already has payments recorded; settle or refund it through a manager.",
    };
  }

  const trimmed = reason?.trim() || null;

  await db
    .update(orders)
    .set({
      status: "cancelled",
      cancelledReason: trimmed,
      updatedAt: new Date(),
    })
    .where(eq(orders.id, order.id));

  await recordAudit({
    actor,
    action: "order.cancelled",
    entityType: "order",
    entityId: order.id,
    branchId: order.branchId,
    description: `Order ${order.orderNumber} cancelled${trimmed ? ` — ${trimmed}` : ""}.`,
    metadata: { orderNumber: order.orderNumber, reason: trimmed },
    meta,
  });

  return { ok: true };
}
