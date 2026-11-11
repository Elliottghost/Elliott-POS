import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { purchaseOrders, purchaseOrderItems, inventoryItems, stockMovements } from "@/db/schema";
import { recordAudit } from "@/lib/audit";
import { requireUser } from "@/lib/auth/session";
import { canAccessBranch } from "@/lib/auth/access";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireUser();
  const { id } = await params;

  const [order] = await db
    .select()
    .from(purchaseOrders)
    .where(eq(purchaseOrders.id, id))
    .limit(1);

  if (!order) return new Response("Not found", { status: 404 });

  if (!canAccessBranch(user, order.branchId)) {
    return new Response("Forbidden", { status: 403 });
  }

  const body = await request.json();
  const { quantityReceived } = body;

  if (!quantityReceived || quantityReceived <= 0) {
    return new Response(
      JSON.stringify({ error: "Quantity received is required and must be greater than zero." }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  // Update purchase order status
  const newStatus = quantityReceived >= order.totalAmount ? "received" : "partially_received";

  await db
    .update(purchaseOrders)
    .set({
      status: newStatus,
      receivedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(purchaseOrders.id, id));

  // Update each item's received quantity and inventory stock
  const items = await db
    .select()
    .from(purchaseOrderItems)
    .where(eq(purchaseOrderItems.purchaseOrderId, id));

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
          referenceId: id,
          staffUserId: user.id,
          reason: `Purchase order ${order.orderNumber} received`,
        });
    }
  }

  return new Response(JSON.stringify({ received: true, status: newStatus }), {
    headers: { "Content-Type": "application/json" },
  });
}