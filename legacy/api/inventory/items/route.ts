import { and, eq, gte, lte } from "drizzle-orm";
import { db } from "@/db/client";
import { inventoryItems, inventoryCategories, suppliers } from "@/db/schema";
import { recordAudit } from "@/lib/audit";
import { requireUser } from "@/lib/auth/session";
import { canAccessBranch } from "@/lib/auth/access";
import type { RequestMeta } from "@/lib/auth/session";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ branchId: string }> },
) {
  const user = await requireUser();
  const { branchId } = await params;

  if (!canAccessBranch(user, branchId)) {
    return new Response("Forbidden", { status: 403 });
  }

  const items = await db
    .select({
      id: inventoryItems.id,
      name: inventoryItems.name,
      sku: inventoryItems.sku,
      categoryId: inventoryItems.categoryId,
      description: inventoryItems.description,
      unitOfMeasurement: inventoryItems.unitOfMeasurement,
      purchasePrice: inventoryItems.purchasePrice,
      currentStock: inventoryItems.currentStock,
      minimumStockLevel: inventoryItems.minimumStockLevel,
      supplierId: inventoryItems.supplierId,
      expiryDate: inventoryItems.expiryDate,
      storageLocation: inventoryItems.storageLocation,
      isActive: inventoryItems.isActive,
    })
    .from(inventoryItems)
    .where(and(eq(inventoryItems.branchId, branchId), eq(inventoryItems.isActive, true)))
    .orderBy(inventoryItems.name);

  return new Response(JSON.stringify(items), {
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
  const result = await createInventoryItem(
    user,
    {
      name: body.name,
      sku: body.sku,
      categoryId: body.categoryId,
      description: body.description,
      unitOfMeasurement: body.unitOfMeasurement,
      purchasePrice: body.purchasePrice,
      minimumStockLevel: body.minimumStockLevel,
      supplierId: body.supplierId,
      branchId,
      expiryDate: body.expiryDate,
      storageLocation: body.storageLocation,
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

  return new Response(JSON.stringify({ id: result.id }), {
    status: 201,
    headers: { "Content-Type": "application/json" },
  });
}