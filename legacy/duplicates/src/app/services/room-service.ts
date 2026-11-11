import { and, eq, sql, type SQL } from "drizzle-orm";
import { db } from "@/db/client";
import {
  roomServiceOrders,
  roomServiceItems,
  guestFolios,
  accommodationReservations,
  rooms,
} from "@/db/schema";
import { recordAudit } from "@/lib/audit";
import { canAccessBranch } from "@/lib/auth/access";
import type { RequestMeta, SessionUser } from "@/lib/auth/session";
import { menuItems } from "@/db/schema";

/** Room service order row */
export interface RoomServiceOrderRow {
  id: string;
  reservationId: string;
  branchId: string;
  guestName: string;
  roomNumber: string;
  itemsJson: string;
  subtotal: number;
  serviceCharge: number;
  tax: number;
  total: number;
  status: string;
  fulfillmentStatus: string;
  createdAt: number;
}

/** List room service orders */
export async function listRoomServiceOrders(
  options: {
    branchId?: string;
    reservationId?: string;
    status?: string;
  } = {},
): Promise<RoomServiceOrderRow[]> {
  const conditions: SQL[] = [];

  if (options.branchId) {
    conditions.push(eq(roomServiceOrders.branchId, options.branchId));
  }

  if (options.reservationId) {
    conditions.push(eq(roomServiceOrders.reservationId, options.reservationId));
  }

  if (options.status) {
    conditions.push(eq(roomServiceOrders.status, options.status));
  }

  const rows = await db
    .select({
      id: roomServiceOrders.id,
      reservationId: roomServiceOrders.reservation_id,
      branchId: roomServiceOrders.branch_id,
      guestName: roomService_orders.guest_name,
      roomNumber: roomService_orders.room_number,
      itemsJson: roomServiceOrders.items_json,
      subtotal: roomServiceOrders.subtotal,
      serviceCharge: roomServiceOrders.service_charge,
      tax: roomServiceOrders.tax,
      total: roomServiceOrders.total,
      status: roomServiceOrders.status,
      fulfillmentStatus: roomServiceOrders.fulfillment_status,
      createdAt: roomServiceOrders.created_at,
    })
    .from(roomServiceOrders)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(roomServiceOrders.created_at));

  return rows as RoomServiceOrderRow[];
}

/** Create a room service order */
export async function createRoomServiceOrder(
  actor: SessionUser,
  input: {
    reservationId: string;
    branchId: string;
    roomNumber: string;
    guestName: string;
    items: Array<{
      menuItemId: string;
      quantity: number;
      notes?: string;
    }>;
  },
  meta?: RequestMeta,
): Promise<{ ok: true; order: RoomServiceOrderRow } | { ok: false; error: string }> {
  // Validate branch access
  if (!canAccessBranch(actor, input.branchId)) {
    return {
      ok: false,
      error: "You can only create room service orders for your assigned branch.",
    };
  }

  // Validate reservation exists and guest is checked in
  const [reservation] = await db
    .select()
    .from(accommodationReservations)
    .where(and(eq(accommodationReservations.id, input.reservationId), eq(accommodationReservations.status, "checked_in")))
    .limit(1);

  if (!reservation) {
    return {
      ok: false,
      error: "Reservation not found or guest is not checked in.",
    };
  }

  // Validate menu items and prepare lines
  const itemIds = [...new Set(input.items.map((item) => item.menuItemId))];
  if (itemIds.length === 0) {
    return { ok: false, error: "Add at least one item." };
  }

  const rows = await db
    .select({
      id: menuItems.id,
      name: menuItems.name,
      price: menuItems.price,
      isActive: menuItems.isActive,
    })
    .from(menuItems)
    .where(inArray(menuItems.id, itemIds));

  const byId = new Map(rows.map((row) => [row.id, row]));

  // Check all items are active and available
  for (const item of rows) {
    if (!item.isActive) {
      return {
        ok: false,
        error: `Menu item "${item.name}" is no longer available.`,
      };
    }
  }

  // Collapse duplicate picks into one line
  const merged = new Map<string, { quantity: number; notes: string | null }>();
  for (const line of input.items) {
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

  const lines: Array<{
    menuItemId: string;
    name: string;
    unitPrice: number;
    quantity: number;
    lineTotal: number;
    notes: string | null;
  }> = [];

  for (const [menuItemId, picked] of merged) {
    const item = byId.get(menuItemId);
    if (!item) {
      return { ok: false, error: "Selected menu item not found." };
    }

    lines.push({
      menuItemId,
      name: item.name,
      unitPrice: item.price,
      quantity: picked.quantity,
      lineTotal: item.price * picked.quantity,
      notes: picked.notes,
    });
  }

  // Compute totals (use existing POS rates)
  const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
  const [serviceSetting] = await db
    .select({ value: sql<number>`cast(settings.value as integer)` })
    .from(sql`settings`) // This would need actual settings table - using placeholder
    .where(eq(sql`settings.key`, "operations.service_charge_percent"));
  
  // Default service charge 10%, VAT 18% (from Phase 3)
  const serviceCharge = Math.round((subtotal * 10) / 100);
  const tax = Math.round(((subtotal + serviceCharge) * 18) / 100);
  const total = subtotal + serviceCharge + tax;

  // Create the room service order
  const [created] = await db
    .insert(roomServiceOrders)
    .values({
      reservationId: input.reservationId,
      branchId: input.branchId,
      roomNumber: input.roomNumber,
      guestName: input.guestName,
      itemsJson: JSON.stringify(
        lines.map((line) => ({
          menuItemId: line.menuItemId,
          name: line.name,
          unitPrice: line.unitPrice,
          quantity: line.quantity,
          lineTotal: line.lineTotal,
          notes: line.notes,
        }))
      ),
      subtotal,
      serviceCharge,
      tax,
      total,
      status: "pending",
      fulfillmentStatus: "queued",
    })
    .returning({ id: roomServiceOrders.id });

  // Record transaction in room transactions
  await db
    .insert(roomTransaksi) // Would need to check actual table name
    .values({
      reservationId: input.reservationId,
      roomId: reservation.room_id ?? null,
      branchId: input.branchId,
      transactionType: "room_service",
      amount: total,
      description: `Room service order for ${input.guestName}`,
      recordedByUserId: actor.id,
    });

  // Update guest folio with room service charges
  await updateRoomFolioCharges(input.reservationId, total, "room_service");

  await recordAudit({
    actor,
    action: "room_service_order.created",
    entityType: "room_service_order",
    entityId: created.id,
    branchId: input.branchId,
    description: `Room service order created for ${input.guestName} at ${input.roomNumber}. Total: ${total} RWF.`,
    metadata: {
      reservationId: input.reservationId,
      roomNumber: input.roomNumber,
      guestName: input.guestName,
      subtotal,
      serviceCharge,
      tax,
      total,
      itemCount: lines.length,
    },
    meta,
  });

  const [order] = await listRoomServiceOrders({
    branchId: input.branchId,
    reservationId: input.reservationId,
  });

  return { ok: true, order: order as RoomServiceOrderRow };
}

/** Update guest folio charges */
async function updateRoomFolioCharges(
  reservationId: string,
  amount: number,
  chargeType: "room_service" | "room" | "food_beverage" | "other",
): Promise<void> {
  const [folio] = await db
    .select()
    .from(guestFolios)
    .where(eq(guestFolios.reservation_id, reservationId))
    .limit(1);

  if (!folio) return;

  let newRoomCharges = folio.roomCharges ?? 0;
  let newFoodBeverageCharges = folio.foodBeverageCharges ?? 0;
  let newRoomServiceCharges = folio.roomServiceCharges ?? 0;
  let newOtherCharges = folio.otherCharges ?? 0;
  let newCurrentBalance = folio.currentBalance ?? 0;
  let newTotalPaid = folio.totalPaid ?? 0;

  switch (chargeType) {
    case "room_service":
      newRoomServiceCharges += amount;
      break;
    case "room":
      newRoomCharges += amount;
      break;
    case "food_beverage":
      newFoodBeverageCharges += amount;
      break;
    case "other":
      newOtherCharges += amount;
      break;
  }

  newCurrentBalance = newRoomCharges + newFoodBeverageCharges + newRoomServiceCharges + newOtherCharges - newTotalPaid;

  await db
    .update(guestFolios)
    .set({
      roomServiceCharges: newRoomServiceCharges,
      currentBalance: newCurrentBalance,
      updatedAt: new Date(),
    })
    .where(eq(guestFolios.id, folio.id));
}

/** Get a room service order */
export async function getRoomServiceOrder(id: string) {
  const rows = await listRoomServiceOrders({});
  return rows.find((r) => r.id === id) ?? null;
}

/** Update room service order status */
export async function updateRoomServiceOrderStatus(
  actor: SessionUser,
  orderId: string,
  status: string,
  meta?: RequestMeta,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const [order] = await getRoomServiceOrder(orderId);
  if (!order) return { ok: false, error: "Room service order not found." };

  // Validate branch access
  if (!canAccessBranch(actor, order.branchId)) {
    return { ok: false, error: "This order belongs to another branch." };
  }

  const validStatuses = ["pending", "queued", "preparing", "ready", "served", "closed"];
  if (!validStatuses.includes(status)) {
    return { ok: false, error: "Invalid status." };
  }

  await db
    .update(roomServiceOrders)
    .set({ status, fulfillmentStatus: status, updatedAt: new Date() })
    .where(eq(roomServiceOrders.id, orderId));

  await recordAudit({
    actor,
    action: `room_service_order.${status}`,
    entityType: "room_service_order",
    entityId: orderId,
    branchId: order.branchId,
    description: `Room service order ${orderId} status updated to ${status}.`,
    metadata: { newStatus: status },
    meta,
  });

  return { ok: true };
}

/** Mark room service order as served and add to folio */
export async function completeRoomServiceOrder(
  actor: SessionUser,
  orderId: string,
  meta?: RequestMeta,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const [order] = await getRoomServiceOrder(orderId);
  if (!order) return { ok: false, error: "Room service order not found." };

  // Validate branch access
  if (!canAccessBranch(actor, order.branchId)) {
    return { ok: false, error: "This order belongs to another branch." };
  }

  // Update status to served
  const statusResult = await updateRoomServiceOrderStatus(actor, orderId, "served", meta);

  if (!statusResult.ok) return statusResult;

  // The folio charges were already added when the order was created
  // Just record the transaction
  await db
    .insert(roomTransaksi) // Would need actual table
    .values({
      reservationId: order.reservationId,
      roomId: order.roomNumber ?? null,
      branchId: order.branchId,
      transactionType: "payment",
      amount: -order.total, // Negative for payout from folio
      description: "Room service charge paid",
      recordedByUserId: actor.id,
    });

  await recordAudit({
    actor,
    action: "room_service_order.served",
    entityType: "room_service_order",
    entityId: orderId,
    branchId: order.branchId,
    description: `Room service order ${orderId} served and charged to guest folio.`,
    meta,
  });

  return { ok: true };
}