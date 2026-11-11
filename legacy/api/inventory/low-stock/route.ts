import { and, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { inventoryItems, inventoryCategories } from "@/db/schema";
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

  const alerts = await db
    .select({
      id: inventoryItems.id,
      name: inventoryItems.name,
      sku: inventoryItems.sku,
      currentStock: inventoryItems.currentStock,
      minimumStockLevel: inventoryItems.minimumStockLevel,
      category: sql<string>`${inventoryCategories.name}`,
    })
    .from(inventoryItems)
    .leftJoin(inventoryCategories, eq(inventoryCategories.id, inventoryItems.categoryId))
    .where(
      and(
        eq(inventoryItems.branchId, branchId),
        lte(inventoryItems.currentStock, inventoryItems.minimumStockLevel),
      ),
    )
    .orderBy(inventoryItems.name);

  return new Response(JSON.stringify(alerts), {
    headers: { "Content-Type": "application/json" },
  });
}