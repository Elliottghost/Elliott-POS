import { and, asc, eq, inArray, sql, type SQL } from "drizzle-orm";
import { db } from "@/db/client";
import {
  purchaseOrders,
  purchaseOrderItems,
  suppliers,
  inventoryItems,
} from "@/db/schema";
import { recordAudit } from "@/lib/audit";
import { canAccessBranch } from "@/lib/auth/access";
import type { RequestMeta, SessionUser } from "@/lib/auth/session";
import { getSetting } from "@/services/settings";

/** Purchase order row */
export interface PurchaseOrderRow {
  id: string;
  orderNumber: string;
  supplierId: string;
  supplierName: string;
  branchId: string;
  status: string;
  totalAmount: number;
  paidAmount: number;
  createdAt: Date;
  createdByName: string | null;
}

/** Purchase order item row */
export interface PurchaseOrderItemRow {
  id: string;
  inventoryItemId: string;
  inventoryItemName: string;
  sku: string;
  quantityOrdered: number;
  quantityReceived: number;
  unitCost: number;
  lineTotal: number;
}

/** Create purchase order */
export async function createPurchaseOrder(
  actor: SessionUser,
  input: {
    supplierId: string;
    branchId: string;
    items: {
      inventoryItemId: string;
      quantity: number;
      unitCost: number;
    }[];
    notes?: string;
  },
  meta?: RequestMeta,
): Promise<{ ok: true; id: string } | { ok: false; error: string; fieldErrors?: Record<string, string[]> }> {
  // Validate supplier
  const [supplier] = await db
    .select({ id: suppliers.id })
    .from(suppliers)
    .where(eq(suppliers.id, input.supplierId))
    .limit(1);

  if (!supplier) {
    return {
      ok: false,
      error: "Supplier not found.",
      fieldErrors: { supplierId: ["Supplier not found."] },
    };
  }

  // Validate branch access
  if (!canAccessBranch(actor, input.branchId)) {
    return {
      ok: false,
      error: "You can only create purchase orders for your assigned branch.",
    };
  }

  // Validate items
  const branchId = input.branchId;
  const validatedItems = [];

  for (const itemInput of input.items) {
    const [menuItem] = await db
      .select()
      .from(inventoryItems)
      .where(and(eq(inventoryItems.id, itemInput.inventoryItemId), eq(inventoryItems.branchId, branchId)))
      .limit(1);

    if (!menuItem) {
      return {
        ok: false,
        error: `Inventory item not found or not assigned to branch ${branchId}.`,
      };
    }

    if (itemInput.quantity <= 0) {
      return {
        ok: false,
        error: `Quantity must be greater than zero for item ${menuItem.name}.`,
      };
    }

    if (itemInput.unitCost <= 0) {
      return {
        ok: false,
        error: `Unit cost must be greater than zero for item ${menuItem.name}.`,
      };
    }

    const lineTotal = itemInput.quantity * itemInput.unitCost;
    validatedItems.push({
      ...itemInput,
      inventoryItemName: menuItem.name,
      sku: menuItem.sku,
      lineTotal,
    });
  }

  // Calculate total
  const totalAmount = validatedItems.reduce((sum, item) => sum + item.lineTotal, 0);

  const orderNumber = `PO-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${
    Math.floor(Math.random() * 9000) + 1000
  }`;

  const [createdOrder] = await db
    .insert(purchaseOrders)
    .values({
      orderNumber,
      supplierId: input.supplierId,
      branchId,
      status: "draft",
      totalAmount,
      paidAmount: 0,
      notes: input.notes ?? null,
      createdByUserId: actor.id,
    })
    .returning({ id: purchaseOrders.id });

  // Insert order items
  for (const item of validatedItems) {
    await db
      .insert(purchaseOrderItems)
      .values({
        purchaseOrderId: createdOrder.id,
        inventoryItemId: item.inventoryItemId,
        quantityOrdered: item.quantity,
        quantityReceived: 0,
        unitCost: item.unitCost,
        lineTotal: item.lineTotal,
      });
  }

  await recordAudit({
    actor,
    action: "purchase_order.created",
    entityType: "purchase_order",
    entityId: createdOrder.id,
    branchId,
    description: `Purchase order ${orderNumber} created from supplier ${input.supplierId}. ${validatedItems.length} item(s), total ${totalAmount} RWF.`,
    metadata: {
      orderNumber,
      supplierId: input.supplierId,
      totalAmount,
      itemCount: validatedItems.length,
    },
    meta,
  });

  return { ok: true, id: createdOrder.id };
}

/** List purchase orders */
export async function listPurchaseOrders(
  options: {
    branchId?: string;
    supplierId?: string;
    status?: string;
    includeInactive?: boolean;
  } = {},
): Promise<PurchaseOrderRow[]> {
  const conditions: SQL[] = [];

  if (options.branchId) {
    conditions.push(eq(purchaseOrders.branchId, options.branchId));
  }

  if (options.supplierId) {
    conditions.push(eq(purchaseOrders.supplierId, options.supplierId));
  }

  if (options.status) {
    conditions.push(eq(purchaseOrders.status, options.status));
  }

  if (options.includeInactive === undefined) {
    conditions.push(eq(purchaseOrders.status !== "cancelled"));
  }

  const rows = await db
    .select({
      id: purchaseOrders.id,
      orderNumber: purchaseOrders.orderNumber,
      supplierId: purchaseOrders.supplierId,
      branchId: purchaseOrders.branchId,
      status: purchaseOrders.status,
      totalAmount: purchaseOrders.totalAmount,
      paidAmount: purchaseOrders.paidAmount,
      createdAt: purchaseOrders.createdAt,
    })
    .from(purchaseOrders)
    .leftJoin(suppliers, eq(suppliers.id, purchaseOrders.supplierId))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(purchaseOrders.createdAt));

  return rows.map((row) => ({
    ...row,
    supplierName: row.supplierId ? row.supplierName ?? "Supplier " + row.supplierId : null,
    createdAt: row.createdAt ? new Date(row.createdAt) : new Date(),
  }));
}

/** Get a single purchase order with items */
export async function getPurchaseOrder(id: string) {
  const [order] = await db
    .select({
      id: purchaseOrders.id,
      orderNumber: purchaseOrders.orderNumber,
      supplierId: purchaseOrders.supplierId,
      branchId: purchaseOrders.branchId,
      status: purchaseOrders.status,
      totalAmount: purchaseOrders.totalAmount,
      paidAmount: purchaseOrders.paidAmount,
      expectedDelivery: purchaseOrders.expectedDelivery,
      notes: purchaseOrders.notes,
      createdAt: purchaseOrders.createdAt,
    })
    .from(purchaseOrders)
    .where(eq(purchaseOrders.id, id))
    .limit(1);

  if (!order) return null;

  const items = await db
    .select({
      id: purchaseOrderItems.id,
      inventoryItemId: purchaseOrderItems.inventoryItemId,
      quantityOrdered: purchaseOrderItems.quantityOrdered,
      quantityReceived: purchaseOrderItems.quantityReceived,
      unitCost: purchaseOrderItems.unitCost,
      lineTotal: purchaseOrderItems.lineTotal,
    })
    .from(purchaseOrderItems)
    .where(eq(purchaseOrderItems.purchaseOrderId, id));

  // Fetch supplier name
  const [supplier] = await db
    .select({ name: suppliers.name })
    .from(suppliers)
    .where(eq(suppliers.id, order.supplierId));

  return {
    ...order,
    supplierName: supplier?.name ?? "Unknown",
    items,
  };
}

/** Receive purchase order items */
export async function receivePurchaseOrder(
  actor: SessionUser,
  purchaseOrderId: string,
  quantityReceived: number,
  meta?: RequestMeta,
): Promise<{ ok: true; received: boolean } | { ok: false; error: string }> {
  const [order] = await db
    .select()
    .from(purchaseOrders)
    .where(eq(purchaseOrders.id, purchaseOrderId))
    .limit(1);

  if (!order) return { ok: false, error: "Purchase order not found." };

  // Validate branch access
  if (!canAccessBranch(actor, order.branchId)) {
    return { ok: false, error: "This purchase order belongs to another branch." };
  }

  if (order.status === "received") {
    return { ok: false, error: "This purchase order has already been received." };
  }

  if (quantityReceived <= 0) {
    return { ok: false, error: "Quantity received must be greater than zero." };
  }

  if (quantityReceived > order.totalAmount) {
    // This is a rough check; in reality we'd check per-item
    return { ok: false, error: "Received quantity exceeds order total." };
  }

  // Update purchase order status and received amount
  await db
    .update(purchaseOrders)
    .set({
      status: quantityReceived >= order.totalAmount ? "received" : "partially_received",
      receivedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(purchaseOrders.id, purchaseOrderId));

  // Update each item's received quantity and inventory stock
  const items = await db
    .select()
    .from(purchaseOrderItems)
    .where(eq(purchaseOrderItems.purchaseOrderId, purchaseOrderId));

  for (const item of items) {
    const receivedSoFar = item.quantityReceived ?? 0;
    const newReceived = receivedSoFar + quantityReceived;

    await db
      .update(purchaseOrderItems)
      .set({
        quantityReceived: newReceived,
      })
      .where(eq(purchaseOrderItems.id, item.id));

    // Update inventory item stock
    const [invItem] = await db
      .select()
      .from(inventoryItems)
      .where(eq(inventoryItems.id, item.inventoryItemId))
      .limit(1);

    if (invItem) {
      const newStock = invItem.currentStock + quantityReceived;

      await db
        .update(inventoryItems)
        .set({
          currentStock: newStock,
          updatedAt: new Date(),
        })
        .where(eq(inventoryItems.id, item.inventoryItemId));

      // Record stock movement
      await db
        .insert(stockMovements)
        .values({
          inventoryItemId: item.inventoryItemId,
          movementType: "received",
          quantity: quantityReceived,
          sourceBranchId: invItem.branchId,
          destinationBranchId: invItem.branchId,
          referenceType: "purchase_order",
          referenceId: purchaseOrderId,
          staffUserId: actor.id,
          reason: `Purchase order ${order.orderNumber} received`,
        });
    }
  }

  // Record audit
  await recordAudit({
    actor,
    action: "purchase_order.received",
    entityType: "purchase_order",
    entityId: purchaseOrderId,
    branchId: order.branchId,
    description: `Purchase order ${order.orderNumber} received: ${quantityReceived} units. Stock updated.`,
    metadata: {
      purchaseOrderId,
      quantityReceived,
      newStatus: order.status,
    },
    meta,
  });

  return { ok: true, received: true };
}

/** Get items by purchase order */
export async function getPurchaseOrderItems(purchaseOrderId: string) {
  return await db
    .select({
      id: purchaseOrderItems.id,
      inventoryItemId: purchaseOrderItems.inventoryItemId,
      quantityOrdered: purchaseOrderItems.quantityOrdered,
      quantityReceived: purchaseOrderItems.quantityReceived,
      unitCost: purchaseOrderItems.unitCost,
      lineTotal: purchaseOrderItems.lineTotal,
    })
    .from(purchaseOrderItems)
    .where(eq(purchaseOrderItems.purchaseOrderId, purchaseOrderId));
}