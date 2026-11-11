import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  purchaseOrders,
  purchaseOrderItems,
  suppliers,
  inventoryItems,
} from "@/db/schema";
import { recordAudit } from "@/lib/audit";
import { requireUser } from "@/lib/auth/session";
import { canAccessBranch } from "@/lib/auth/access";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ branchId: string }> },
) {
  const user = await requireUser();
  const { branchId } = await params;

  if (!canAccessBranch(user, branchId)) {
    return new Response("Forbidden", { status: 403 });
  }

  const rows = await db
    .select({
      id: purchaseOrders.id,
      orderNumber: purchaseOrders.orderNumber,
      supplierId: purchaseOrders.supplierId,
      status: purchaseOrders.status,
      totalAmount: purchaseOrders.totalAmount,
      paidAmount: purchaseOrders.paidAmount,
      createdAt: purchaseOrders.createdAt,
    })
    .from(purchaseOrders)
    .where(eq(purchaseOrders.branchId, branchId))
    .orderBy(desc(purchaseOrders.createdAt));

  return new Response(JSON.stringify(rows), {
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ branchId: string }> },
) {
  const user = await requireUser();
  const { branchId } = await params;

  if (!canAccessBranch(user, branchId)) {
    return new Response("Forbidden", { status: 403 });
  }

  const body = await request.json();
  const result = await createPurchaseOrder(
    user,
    {
      supplierId: body.supplierId,
      branchId,
      items: body.items,
      notes: body.notes,
    },
    {},
  );

  if (!result.ok) {
    const status = result.error.includes("already") || result.error.includes("valid") ? 409 : 400;
    return new Response(JSON.stringify({ error: result.error }), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ id: result.id, orderNumber: result.id }), {
    status: 201,
    headers: { "Content-Type": "application/json" },
  });
}