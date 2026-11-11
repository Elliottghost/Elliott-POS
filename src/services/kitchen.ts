import { and, asc, eq, gte, inArray, ne, sql, type SQL } from "drizzle-orm";
import { db } from "@/db/client";
import {
  branches,
  menuItems,
  orderItems,
  orders,
  users,
} from "@/db/schema";
import { recordAudit } from "@/lib/audit";
import { canAccessBranch } from "@/lib/auth/access";
import type { RequestMeta, SessionUser } from "@/lib/auth/session";
import { startOfBusinessDay } from "@/lib/format";
import { publishKitchenEvent } from "@/lib/realtime/kitchen-events";
import { targetPrepMinutes } from "@/lib/kitchen-time";
import {
  ALLOWED_TRANSITIONS,
  rollupKitchenStatus,
  STATION_LABELS,
  type KitchenStation,
} from "@/lib/kitchen-stations";
import { KITCHEN_STATUSES, type KitchenStatus } from "@/lib/validation";

export interface KitchenLine {
  name: string;
  quantity: number;
  notes: string | null;
  prepMinutes: number | null;
  station: string | null;
  fulfillmentStatus: KitchenStatus;
}

export interface KitchenOrder {
  id: string;
  orderNumber: string;
  branchId: string;
  branchCode: string;
  branchName: string;
  channel: string;
  tableLabel: string | null;
  customerName: string | null;
  guestCount: number | null;
  notes: string | null;
  total: number;
  currency: string;
  paidAt: Date | null;
  /** Roll-up across every line on the order. */
  fulfillmentStatus: string;
  /** Roll-up for the lines this screen is responsible for. */
  stationStatus: KitchenStatus;
  fulfillmentUpdatedAt: Date | null;
  createdByName: string | null;
  /** Longest dish prep time for the visible lines, with a fallback. */
  targetPrepMinutes: number;
  items: KitchenLine[];
}

export interface KitchenSummary {
  queued: number;
  preparing: number;
  ready: number;
  servedToday: number;
  oldestWaitMinutes: number;
}

function branchConditions(
  scope: string[] | null,
  branchId?: string,
): SQL[] | null {
  if (branchId) return [eq(orders.branchId, branchId)];
  if (scope === null) return [];
  if (scope.length === 0) return null;
  return [inArray(orders.branchId, scope)];
}

/**
 * Kitchen queue: paid orders that have not been served yet, oldest payment
 * first. Payment status and kitchen progress are separate columns, so a guest
 * cannot be refused service because the kitchen moved too far ahead.
 *
 * A station filter narrows each ticket to that section's lines and drops
 * tickets with nothing for it, so the bar never sees the food it cannot cook.
 */
export async function listKitchenOrders(
  scope: string[] | null,
  options: {
    branchId?: string;
    includeServed?: boolean;
    station?: KitchenStation;
  } = {},
): Promise<KitchenOrder[]> {
  const scopeFilters = branchConditions(scope, options.branchId);
  if (scopeFilters === null) return [];

  const conditions: SQL[] = [
    eq(orders.status, "paid"),
    gte(orders.paidAt, startOfBusinessDay()),
    ...scopeFilters,
  ];

  if (!options.includeServed) {
    conditions.push(ne(orders.fulfillmentStatus, "served"));
  }

  const rows = await db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      branchId: orders.branchId,
      branchCode: branches.code,
      branchName: branches.name,
      channel: orders.channel,
      tableLabel: orders.tableLabel,
      customerName: orders.customerName,
      guestCount: orders.guestCount,
      notes: orders.notes,
      total: orders.total,
      currency: orders.currency,
      paidAt: orders.paidAt,
      fulfillmentStatus: orders.fulfillmentStatus,
      fulfillmentUpdatedAt: orders.fulfillmentUpdatedAt,
      createdByName: users.fullName,
    })
    .from(orders)
    .innerJoin(branches, eq(branches.id, orders.branchId))
    .leftJoin(users, eq(users.id, orders.createdByUserId))
    .where(and(...conditions))
    .orderBy(
      asc(
        sql`case ${orders.fulfillmentStatus}
          when 'queued' then 0 when 'preparing' then 1 when 'ready' then 2 else 3 end`,
      ),
      asc(orders.paidAt),
    )
    .limit(120);

  if (rows.length === 0) return [];

  const lineConditions: SQL[] = [inArray(orderItems.orderId, rows.map((row) => row.id))];
  if (options.station) {
    lineConditions.push(eq(menuItems.station, options.station));
  }

  const lines = await db
    .select({
      orderId: orderItems.orderId,
      name: orderItems.nameSnapshot,
      quantity: orderItems.quantity,
      notes: orderItems.notes,
      prepMinutes: menuItems.prepMinutes,
      station: menuItems.station,
      fulfillmentStatus: orderItems.fulfillmentStatus,
    })
    .from(orderItems)
    .leftJoin(menuItems, eq(menuItems.id, orderItems.menuItemId))
    .where(and(...lineConditions))
    .orderBy(asc(orderItems.nameSnapshot));

  const linesByOrder = new Map<string, KitchenLine[]>();
  for (const line of lines) {
    const list = linesByOrder.get(line.orderId) ?? [];
    list.push({
      name: line.name,
      quantity: line.quantity,
      notes: line.notes,
      prepMinutes: line.prepMinutes,
      station: line.station,
      fulfillmentStatus: line.fulfillmentStatus as KitchenStatus,
    });
    linesByOrder.set(line.orderId, list);
  }

  return rows.flatMap((row) => {
    const items = linesByOrder.get(row.id) ?? [];
    if (options.station && items.length === 0) return [];

    const stationStatus =
      items.length > 0
        ? rollupKitchenStatus(items.map((item) => item.fulfillmentStatus))
        : (row.fulfillmentStatus as KitchenStatus);

    // A station has finished with this ticket even if another section has not.
    if (options.station && stationStatus === "served") return [];

    return [
      {
        ...row,
        stationStatus,
        targetPrepMinutes: targetPrepMinutes(
          items.map((item) => item.prepMinutes),
        ),
        items,
      },
    ];
  });
}

export async function getKitchenSummary(
  scope: string[] | null,
  branchId?: string,
  station?: KitchenStation,
): Promise<KitchenSummary> {
  const scopeFilters = branchConditions(scope, branchId);
  if (scopeFilters === null) {
    return { queued: 0, preparing: 0, ready: 0, servedToday: 0, oldestWaitMinutes: 0 };
  }

  const conditions: SQL[] = [
    eq(orders.status, "paid"),
    gte(orders.paidAt, startOfBusinessDay()),
    ...scopeFilters,
  ];

  const summary: KitchenSummary = {
    queued: 0,
    preparing: 0,
    ready: 0,
    servedToday: 0,
    oldestWaitMinutes: 0,
  };
  const now = Date.now();

  if (station) {
    // A station summary must follow that section's lines, not whole tickets.
    const rows = await db
      .select({
        orderId: orders.id,
        paidAt: orders.paidAt,
        lineStatus: orderItems.fulfillmentStatus,
      })
      .from(orders)
      .innerJoin(orderItems, eq(orderItems.orderId, orders.id))
      .innerJoin(menuItems, eq(menuItems.id, orderItems.menuItemId))
      .where(and(...conditions, eq(menuItems.station, station)));

    const byOrder = new Map<string, { paidAt: Date | null; statuses: string[] }>();
    for (const row of rows) {
      const entry = byOrder.get(row.orderId) ?? { paidAt: row.paidAt, statuses: [] };
      entry.statuses.push(row.lineStatus);
      byOrder.set(row.orderId, entry);
    }

    for (const entry of byOrder.values()) {
      const status = rollupKitchenStatus(entry.statuses);
      if (status === "served") {
        summary.servedToday += 1;
        continue;
      }
      summary[status] += 1;
      if (entry.paidAt) {
        const minutes = Math.round(
          (now - new Date(entry.paidAt).getTime()) / 60000,
        );
        summary.oldestWaitMinutes = Math.max(summary.oldestWaitMinutes, minutes);
      }
    }

    return summary;
  }

  const rows = await db
    .select({
      status: orders.fulfillmentStatus,
      count: sql<number>`count(*)`,
      oldest: sql<number | null>`min(${orders.paidAt})`,
    })
    .from(orders)
    .where(and(...conditions))
    .groupBy(orders.fulfillmentStatus);

  for (const row of rows) {
    const count = Number(row.count);
    if (row.status === "queued") summary.queued = count;
    if (row.status === "preparing") summary.preparing = count;
    if (row.status === "ready") summary.ready = count;
    if (row.status === "served") summary.servedToday = count;
    if (row.status !== "served" && row.oldest) {
      const minutes = Math.round((now - new Date(row.oldest).getTime()) / 60000);
      summary.oldestWaitMinutes = Math.max(summary.oldestWaitMinutes, minutes);
    }
  }

  return summary;
}

/** Orders waiting for payment, shown to the kitchen as a heads-up only. */
export async function getUnpaidKitchenCount(scope: string[] | null, branchId?: string) {
  const scopeFilters = branchConditions(scope, branchId);
  if (scopeFilters === null) return 0;

  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(orders)
    .where(and(eq(orders.status, "pending"), ...scopeFilters));

  return Number(row?.count ?? 0);
}

export type KitchenResult =
  | { ok: true; orderStatus: KitchenStatus; stationStatus: KitchenStatus }
  | { ok: false; error: string };

/**
 * Moves the lines a screen is responsible for along the kitchen pipeline.
 * Without a station every line moves together. The order status is then
 * recomputed from all lines, so the bar finishing drinks cannot mark the food
 * ready, and the ticket only reads "served" when every section is done.
 */
export async function setFulfillmentStatus(
  actor: SessionUser,
  orderId: string,
  status: string,
  meta?: RequestMeta,
  station?: KitchenStation | null,
): Promise<KitchenResult> {
  if (!(KITCHEN_STATUSES as readonly string[]).includes(status)) {
    return { ok: false, error: "Unknown kitchen status." };
  }
  const targetStatus = status as KitchenStatus;

  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order) return { ok: false, error: "Order not found." };
  if (!canAccessBranch(actor, order.branchId)) {
    return { ok: false, error: "This order belongs to another branch." };
  }
  if (order.status !== "paid") {
    return {
      ok: false,
      error:
        order.status === "cancelled"
          ? "Cancelled orders are not prepared."
          : "Only paid orders reach the kitchen. Collect payment first.",
    };
  }

  const lines = await db
    .select({
      id: orderItems.id,
      status: orderItems.fulfillmentStatus,
      station: menuItems.station,
    })
    .from(orderItems)
    .leftJoin(menuItems, eq(menuItems.id, orderItems.menuItemId))
    .where(eq(orderItems.orderId, orderId));

  const scoped = station
    ? lines.filter((line) => line.station === station)
    : lines;

  if (station && scoped.length === 0) {
    return {
      ok: false,
      error: `This order has no ${STATION_LABELS[station].toLowerCase()} items.`,
    };
  }

  const currentStatus = (
    scoped.length > 0
      ? rollupKitchenStatus(scoped.map((line) => line.status))
      : (order.fulfillmentStatus as KitchenStatus)
  ) as KitchenStatus;

  if (currentStatus === targetStatus) {
    return {
      ok: false,
      error:
        station
          ? `The ${STATION_LABELS[station].toLowerCase()} items on this order are already ${targetStatus}.`
          : "That order is already in this state.",
    };
  }

  const allowed = ALLOWED_TRANSITIONS[currentStatus] ?? [];
  if (!allowed.includes(targetStatus)) {
    return {
      ok: false,
      error: `An order that is ${currentStatus} cannot move straight to ${targetStatus.replace("_", " ")}.`,
    };
  }

  const scopedIds = new Set(scoped.map((line) => line.id));
  const now = new Date();
  let orderStatus: KitchenStatus = targetStatus;

  if (scoped.length > 0) {
    await db
      .update(orderItems)
      .set({ fulfillmentStatus: targetStatus, fulfillmentUpdatedAt: now })
      .where(inArray(orderItems.id, [...scopedIds]));

    orderStatus = rollupKitchenStatus(
      lines.map((line) =>
        scopedIds.has(line.id) ? targetStatus : line.status,
      ),
    );

    await db
      .update(orders)
      .set({
        fulfillmentStatus: orderStatus,
        fulfillmentUpdatedAt: now,
        updatedAt: now,
      })
      .where(eq(orders.id, orderId));
  } else {
    // Legacy orders captured without item lines move as a single unit.
    await db
      .update(orders)
      .set({
        fulfillmentStatus: targetStatus,
        fulfillmentUpdatedAt: now,
        updatedAt: now,
      })
      .where(eq(orders.id, orderId));
    orderStatus = targetStatus;
  }

  const stationLabel = station ? STATION_LABELS[station] : null;

  await recordAudit({
    actor,
    action: "order.fulfillment_changed",
    entityType: "order",
    entityId: orderId,
    branchId: order.branchId,
    description: stationLabel
      ? `Order ${order.orderNumber} ${stationLabel.toLowerCase()} items marked ${targetStatus}.`
      : `Order ${order.orderNumber} marked ${targetStatus} by the kitchen.`,
    metadata: {
      before: currentStatus,
      after: targetStatus,
      station: station ?? null,
      orderStatus,
    },
    meta,
  });

  publishKitchenEvent({
    type: "order.fulfillment",
    branchId: order.branchId,
    orderId,
    orderNumber: order.orderNumber,
    fulfillmentStatus: orderStatus,
    station: station ?? null,
    at: new Date().toISOString(),
  });

  return {
    ok: true,
    orderStatus,
    stationStatus: targetStatus,
  };
}

/** Paid orders still outstanding, used by the order screen status strip. */
export async function getOrderFulfillment(orderId: string) {
  const [row] = await db
    .select({
      status: orders.status,
      fulfillmentStatus: orders.fulfillmentStatus,
      fulfillmentUpdatedAt: orders.fulfillmentUpdatedAt,
    })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  return row ?? null;
}
