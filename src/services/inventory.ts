import { and, asc, eq, inArray, like, ne, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db/client";
import {
  inventoryCategories,
  inventoryItems,
  suppliers,
} from "@/db/schema";
import { recordAudit } from "@/lib/audit";
import { canAccessBranch } from "@/lib/auth/access";
import type { RequestMeta, SessionUser } from "@/lib/auth/session";
import { getSetting } from "@/services/settings";

/** Inventory category row */
export interface InventoryCategoryRow {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  itemCount: number;
}

/** Inventory item row */
export interface InventoryItemRow {
  id: string;
  name: string;
  sku: string;
  categoryId: string;
  categoryName: string;
  description: string | null;
  unitOfMeasurement: string;
  purchasePrice: number;
  currentStock: number;
  minimumStockLevel: number;
  supplierId: string | null;
  supplierName: string | null;
  branchId: string;
  expiryDate: string | null;
  storageLocation: string | null;
  isActive: boolean;
}

/** Low stock alert */
export interface LowStockAlert {
  itemId: string;
  name: string;
  sku: string;
  currentStock: number;
  minimumStockLevel: number;
  branchId: string;
  daysUntilExpiry: number | null;
}

/** Stock movement types */
export const STOCK_MOVEMENT_TYPES = [
  "received",
  "issued",
  "transfer_out",
  "transfer_in",
  "adjusted",
  "damaged",
  "expired",
  "wastage",
  "returned",
] as const;

/** Stock movement record */
export interface StockMovementRecord {
  id: string;
  inventoryItemId: string;
  movementType: string;
  quantity: number;
  sourceBranchId: string | null;
  destinationBranchId: string | null;
  referenceType: string | null;
  referenceId: string | null;
  staffUserId: string | null;
  reason: string | null;
  createdAt: Date;
}

/** Inventory service */
export async function listInventoryCategories(
  options: { includeInactive?: boolean } = {},
): Promise<InventoryCategoryRow[]> {
  const rows = await db
    .select({
      id: inventoryCategories.id,
      name: inventoryCategories.name,
      description: inventoryCategories.description,
      isActive: inventoryCategories.isActive,
      itemCount: sql<number>`(
        select count(*) from inventory_items where inventory_items.category_id = inventory_categories.id and inventory_items.is_active = true
      )`,
    })
    .from(inventoryCategories)
    .where(options.includeInactive ? undefined : eq(inventoryCategories.isActive, true))
    .orderBy(asc(inventoryCategories.name));

  return rows.map((row) => ({
    ...row,
    itemCount: Number(row.itemCount),
  }));
}

export async function getInventoryCategory(id: string) {
  const [row] = await db
    .select()
    .from(inventoryCategories)
    .where(eq(inventoryCategories.id, id))
    .limit(1);
  return row ?? null;
}

export async function createInventoryCategory(
  actor: SessionUser,
  input: { name: string; description?: string; isActive?: boolean },
  meta?: RequestMeta,
) {
  const [existing] = await db
    .select({ id: inventoryCategories.id })
    .from(inventoryCategories)
    .where(eq(inventoryCategories.name, input.name))
    .limit(1);

  if (existing) {
    return {
      ok: false,
      error: "A category with that name already exists.",
      fieldErrors: { name: ["Category names must be unique."] },
    };
  }

  const [created] = await db
    .insert(inventoryCategories)
    .values({
      name: input.name,
      description: input.description ?? null,
      isActive: input.isActive ?? true,
    })
    .returning({ id: inventoryCategories.id });

  await recordAudit({
    actor,
    action: "inventory.category_created",
    entityType: "inventory_category",
    entityId: created.id,
    branchId: null,
    description: `Inventory category "${input.name}" created.`,
    metadata: { name: input.name },
    meta,
  });

  return { ok: true, id: created.id };
}

export async function updateInventoryCategory(
  actor: SessionUser,
  categoryId: string,
  input: { name?: string; description?: string; isActive?: boolean },
  meta?: RequestMeta,
): Promise<{ ok: true; id: string } | { ok: false; error: string; fieldErrors?: Record<string, string[]> }> {
  const existing = await getInventoryCategory(categoryId);
  if (!existing) return { ok: false, error: "Category not found." };

  if (input.name) {
    const [nameOwner] = await db
      .select({ id: inventoryCategories.id })
      .from(inventoryCategories)
      .where(and(eq(inventoryCategories.name, input.name), ne(inventoryCategories.id, categoryId)))
      .limit(1);

    if (nameOwner) {
      return {
        ok: false,
        error: "A category with that name already exists.",
        fieldErrors: { name: ["Category names must be unique."] },
      };
    }
  }

  await db
    .update(inventoryCategories)
    .set({
      name: input.name ?? existing.name,
      description: input.description ?? existing.description,
      isActive: input.isActive ?? existing.isActive,
      updatedAt: new Date(),
    })
    .where(eq(inventoryCategories.id, categoryId));

  await recordAudit({
    actor,
    action: "inventory.category_updated",
    entityType: "inventory_category",
    entityId: categoryId,
    branchId: null,
    description: `Inventory category updated.`,
    metadata: {
      before: { name: existing.name },
      after: { name: input.name ?? existing.name },
    },
    meta,
  });

  return { ok: true, id: categoryId };
}

export async function deleteInventoryCategory(
  actor: SessionUser,
  categoryId: string,
  meta?: RequestMeta,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const existing = await getInventoryCategory(categoryId);
  if (!existing) return { ok: false, error: "Category not found." };

  const [countRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(inventoryItems)
    .where(and(eq(inventoryItems.categoryId, categoryId), eq(inventoryItems.isActive, true)));

  const itemCount = Number(countRow?.count ?? 0);
  if (itemCount > 0) {
    return {
      ok: false,
      error: `"${existing.name}" still holds ${itemCount} item${itemCount === 1 ? "" : "s"}. Move or delete them first.`,
    };
  }

  await db.delete(inventoryCategories).where(eq(inventoryCategories.id, categoryId));

  await recordAudit({
    actor,
    action: "inventory.category_deleted",
    entityType: "inventory_category",
    entityId: categoryId,
    branchId: null,
    description: `Inventory category "${existing.name}" deleted.`,
    metadata: { name: existing.name },
    meta,
  });

  return { ok: true };
}

/** List all inventory items, optionally filtered by branch and category */
export async function listInventoryItems(
  options: {
    branchId?: string;
    categoryId?: string;
    search?: string;
    includeInactive?: boolean;
    lowStockOnly?: boolean;
    outOfStockOnly?: boolean;
  } = {},
): Promise<InventoryItemRow[]> {
  const conditions: SQL[] = [];

  if (options.branchId) {
    conditions.push(eq(inventoryItems.branchId, options.branchId));
  }

  if (options.categoryId) {
    conditions.push(eq(inventoryItems.categoryId, options.categoryId));
  }

  if (!options.includeInactive) {
    conditions.push(eq(inventoryItems.isActive, true));
  }

  if (options.search) {
    const term = `%${options.search.trim().toLowerCase()}%`;
    const search = or(
      like(sql`lower(${inventoryItems.name})`, term),
      like(sql`lower(${inventoryItems.sku})`, term),
      like(sql`lower(coalesce(${inventoryItems.description}, ''))`, term),
    );
    if (search) conditions.push(search);
  }

  if (options.lowStockOnly) {
    conditions.push(sql`${inventoryItems.currentStock} <= ${inventoryItems.minimumStockLevel}`);
  }

  if (options.outOfStockOnly) {
    conditions.push(eq(inventoryItems.currentStock, 0));
  }

  const rows = await db
    .select({
      id: inventoryItems.id,
      name: inventoryItems.name,
      sku: inventoryItems.sku,
      categoryId: inventoryItems.categoryId,
      categoryName: sql<string>`(
        select ${inventoryCategories.name} from ${inventoryCategories} where ${inventoryCategories.id} = inventoryItems.category_id limit 1
      )`,
      description: inventoryItems.description,
      unitOfMeasurement: inventoryItems.unitOfMeasurement,
      purchasePrice: inventoryItems.purchasePrice,
      currentStock: inventoryItems.currentStock,
      minimumStockLevel: inventoryItems.minimumStockLevel,
      supplierId: inventoryItems.supplierId,
      branchId: inventoryItems.branchId,
      expiryDate: inventoryItems.expiryDate,
      storageLocation: inventoryItems.storageLocation,
      isActive: inventoryItems.isActive,
    })
    .from(inventoryItems)
    .leftJoin(inventoryCategories, eq(inventoryCategories.id, inventoryItems.categoryId))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(asc(inventoryItems.name));

  return rows.map((row) => ({
    ...row,
    supplierName: row.supplierId ? "Supplier " + row.supplierId : null,
  }));
}

export async function getInventoryItem(id: string) {
  const [row] = await db
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
      branchId: inventoryItems.branchId,
      expiryDate: inventoryItems.expiryDate,
      storageLocation: inventoryItems.storageLocation,
      isActive: inventoryItems.isActive,
    })
    .from(inventoryItems)
    .where(eq(inventoryItems.id, id))
    .limit(1);

  return row ?? null;
}

export async function createInventoryItem(
  actor: SessionUser,
  input: {
    name: string;
    sku: string;
    categoryId: string;
    description?: string;
    unitOfMeasurement?: string;
    purchasePrice?: number;
    minimumStockLevel?: number;
    supplierId?: string;
    branchId: string;
    expiryDate?: string;
    storageLocation?: string;
  },
  meta?: RequestMeta,
): Promise<{ ok: true; id: string } | { ok: false; error: string; fieldErrors?: Record<string, string[]> }> {
  // Validate category exists
  const category = await getInventoryCategory(input.categoryId);
  if (!category) {
    return {
      ok: false,
      error: "Choose a valid category.",
      fieldErrors: { categoryId: ["Category not found."] },
    };
  }

  // Validate supplier if provided
  if (input.supplierId) {
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
  }

  // Check SKU uniqueness
  const [skuExists] = await db
    .select({ id: inventoryItems.id })
    .from(inventoryItems)
    .where(eq(inventoryItems.sku, input.sku))
    .limit(1);

  if (skuExists) {
    return {
      ok: false,
      error: "An item with that SKU already exists.",
      fieldErrors: { sku: ["SKU must be unique."] },
    };
  }

  const [created] = await db
    .insert(inventoryItems)
    .values({
      name: input.name,
      sku: input.sku,
      categoryId: input.categoryId,
      description: input.description ?? null,
      unitOfMeasurement: input.unitOfMeasurement ?? "pieces",
      purchasePrice: input.purchasePrice ?? 0,
      minimumStockLevel: input.minimumStockLevel ?? 0,
      supplierId: input.supplierId ?? null,
      branchId: input.branchId,
      expiryDate: input.expiryDate ?? null,
      storageLocation: input.storageLocation ?? null,
      isActive: true,
    })
    .returning({ id: inventoryItems.id });

  await recordAudit({
    actor,
    action: "inventory.item_created",
    entityType: "inventory_item",
    entityId: created.id,
    branchId: input.branchId,
    description: `Inventory item "${input.name}" (SKU: ${input.sku}) created.`,
    metadata: {
      name: input.name,
      sku: input.sku,
      categoryId: input.categoryId,
      branchId: input.branchId,
    },
    meta,
  });

  return { ok: true, id: created.id };
}

export async function updateInventoryItem(
  actor: SessionUser,
  itemId: string,
  input: {
    name?: string;
    sku?: string;
    categoryId?: string;
    description?: string;
    unitOfMeasurement?: string;
    purchasePrice?: number;
    minimumStockLevel?: number;
    supplierId?: string;
    branchId?: string;
    expiryDate?: string;
    storageLocation?: string;
  },
  meta?: RequestMeta,
): Promise<{ ok: true; id: string } | { ok: false; error: string; fieldErrors?: Record<string, string[]> }> {
  const existing = await getInventoryItem(itemId);
  if (!existing) return { ok: false, error: "Inventory item not found." };

  // Validate new category if provided
  if (input.categoryId && input.categoryId !== existing.categoryId) {
    const category = await getInventoryCategory(input.categoryId);
    if (!category) {
      return {
        ok: false,
        error: "Choose a valid category.",
        fieldErrors: { categoryId: ["Category not found."] },
      };
    }
  }

  // Validate new supplier if provided
  if (input.supplierId && input.supplierId !== existing.supplierId) {
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
  }

  // Check SKU uniqueness if being changed
  if (input.sku && input.sku !== existing.sku) {
    const [skuExists] = await db
      .select({ id: inventoryItems.id })
      .from(inventoryItems)
      .where(and(eq(inventoryItems.sku, input.sku), ne(inventoryItems.id, itemId)))
      .limit(1);

    if (skuExists) {
      return {
        ok: false,
        error: "An item with that SKU already exists.",
        fieldErrors: { sku: ["SKU must be unique."] },
      };
    }
  }

  await db
    .update(inventoryItems)
    .set({
      name: input.name ?? existing.name,
      sku: input.sku ?? existing.sku,
      categoryId: input.categoryId ?? existing.categoryId,
      description: input.description ?? existing.description,
      unitOfMeasurement: input.unitOfMeasurement ?? existing.unitOfMeasurement,
      purchasePrice: input.purchasePrice ?? existing.purchasePrice,
      minimumStockLevel: input.minimumStockLevel ?? existing.minimumStockLevel,
      supplierId: input.supplierId ?? existing.supplierId,
      branchId: input.branchId ?? existing.branchId,
      expiryDate: input.expiryDate ?? existing.expiryDate,
      storageLocation: input.storageLocation ?? existing.storageLocation,
      updatedAt: new Date(),
    })
    .where(eq(inventoryItems.id, itemId));

  await recordAudit({
    actor,
    action: "inventory.item_updated",
    entityType: "inventory_item",
    entityId: itemId,
    branchId: existing.branchId,
    description: `Inventory item "${existing.name}" updated.`,
    metadata: {
      before: {
        name: existing.name,
        sku: existing.sku,
        categoryId: existing.categoryId,
      },
      after: {
        name: input.name ?? existing.name,
        sku: input.sku ?? existing.sku,
        categoryId: input.categoryId ?? existing.categoryId,
      },
    },
    meta,
  });

  return { ok: true, id: itemId };
}

export async function deleteInventoryItem(
  actor: SessionUser,
  itemId: string,
  meta?: RequestMeta,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const existing = await getInventoryItem(itemId);
  if (!existing) return { ok: false, error: "Inventory item not found." };

  // Check if item has stock movements that reference it - we allow deletion but audit
  await db.delete(inventoryItems).where(eq(inventoryItems.id, itemId));

  await recordAudit({
    actor,
    action: "inventory.item_deleted",
    entityType: "inventory_item",
    entityId: itemId,
    branchId: existing.branchId,
    description: `Inventory item "${existing.name}" (SKU: ${existing.sku}) deleted.`,
    metadata: { name: existing.name, sku: existing.sku },
    meta,
  });

  return { ok: true };
}

/** Get low stock alerts for a branch */
export async function getLowStockAlerts(branchId: string): Promise<LowStockAlert[]> {
  const rows = await db
    .select({
      id: inventoryItems.id,
      name: inventoryItems.name,
      sku: inventoryItems.sku,
      currentStock: inventoryItems.currentStock,
      minimumStockLevel: inventoryItems.minimumStockLevel,
      branchId: inventoryItems.branchId,
    })
    .from(inventoryItems)
    .where(and(eq(inventoryItems.branchId, branchId), sql`${inventoryItems.currentStock} <= ${inventoryItems.minimumStockLevel}`));

  return rows.map((row) => ({
    itemId: row.id,
    name: row.name,
    sku: row.sku,
    currentStock: row.currentStock,
    minimumStockLevel: row.minimumStockLevel,
    branchId: row.branchId,
    daysUntilExpiry: null, // Would need expiry date logic
  }));
}

/** Get out-of-stock items for a branch */
export async function getOutOfStockItems(branchId: string): Promise<InventoryItemRow[]> {
  const rows = await db
    .select({
      id: inventoryItems.id,
      name: inventoryItems.name,
      sku: inventoryItems.sku,
      categoryId: inventoryItems.categoryId,
      categoryName: sql<string>`(
        select ${inventoryCategories.name} from ${inventoryCategories} where ${inventoryCategories.id} = inventoryItems.category_id limit 1
      )`,
      description: inventoryItems.description,
      unitOfMeasurement: inventoryItems.unitOfMeasurement,
      purchasePrice: inventoryItems.purchasePrice,
      currentStock: inventoryItems.currentStock,
      minimumStockLevel: inventoryItems.minimumStockLevel,
      supplierId: inventoryItems.supplierId,
      branchId: inventoryItems.branchId,
      expiryDate: inventoryItems.expiryDate,
      storageLocation: inventoryItems.storageLocation,
      isActive: inventoryItems.isActive,
    })
    .from(inventoryItems)
    .leftJoin(inventoryCategories, eq(inventoryCategories.id, inventoryItems.categoryId))
    .where(and(eq(inventoryItems.branchId, branchId), eq(inventoryItems.currentStock, 0)));

  return rows.map((row) => ({
    ...row,
    supplierName: row.supplierId ? "Supplier " + row.supplierId : null,
  }));
}

/** Record a stock movement */
export async function recordStockMovement(
  actor: SessionUser,
  input: {
    inventoryItemId: string;
    movementType: string;
    quantity: number;
    sourceBranchId?: string;
    destinationBranchId?: string;
    referenceType?: string;
    referenceId?: string;
    reason?: string;
  },
  meta?: RequestMeta,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const item = await getInventoryItem(input.inventoryItemId);
  if (!item) return { ok: false, error: "Inventory item not found." };

  // Validate branch access
  if (input.sourceBranchId && input.sourceBranchId !== item.branchId) {
    if (!canAccessBranch(actor, input.sourceBranchId)) {
      return { ok: false, error: "You can only record stock movements for your assigned branch." };
    }
  }

  if (input.destinationBranchId && input.destinationBranchId !== item.branchId) {
    if (!canAccessBranch(actor, input.destinationBranchId)) {
      return { ok: false, error: "You can only record stock movements for your assigned branch." };
    }
  }

  // Validate movement type
  const validTypes = ["received", "issued", "transfer_out", "transfer_in", "adjusted", "damaged", "expired", "wastage", "returned"];
  if (!validTypes.includes(input.movementType)) {
    return { ok: false, error: "Invalid movement type." };
  }

  // For issues, check sufficient stock
  if (input.movementType === "issued" && item.currentStock < input.quantity) {
    return { ok: false, error: "Insufficient stock for issue." };
  }

  // For transfers out, check stock at source
  if (input.movementType === "transfer_out" && item.currentStock < input.quantity) {
    return { ok: false, error: "Insufficient stock at source branch for transfer." };
  }

  const [created] = await db
    .insert(stockMovements)
    .values({
      inventoryItemId: input.inventoryItemId,
      movementType: input.movementType,
      quantity: input.quantity,
      sourceBranchId: input.sourceBranchId ?? item.branchId,
      destinationBranchId: input.destinationBranchId,
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      staffUserId: actor.id,
      reason: input.reason,
    })
    .returning({ id: stockMovements.id });

  // Update stock quantity based on movement type
  let newStock = item.currentStock;

  switch (input.movementType) {
    case "received":
      newStock += input.quantity;
      break;
    case "issued":
      newStock -= input.quantity;
      break;
    case "transfer_out":
      newStock -= input.quantity;
      break;
    case "transfer_in":
      newStock += input.quantity;
      break;
    case "adjusted":
      // Adjustment - would need additional logic for direction
      // For now, we'll treat positive quantity as increase
      newStock += input.quantity;
      break;
    case "damaged":
      newStock -= input.quantity;
      break;
    case "expired":
      newStock -= input.quantity;
      break;
    case "wastage":
      newStock -= input.quantity;
      break;
    case "returned":
      newStock += input.quantity;
      break;
  }

  // Ensure stock doesn't go negative
  const finalStock = Math.max(newStock, 0);

  await db
    .update(inventoryItems)
    .set({
      currentStock: finalStock,
      updatedAt: new Date(),
    })
    .where(eq(inventoryItems.id, itemId));

  await recordAudit({
    actor,
    action: `inventory.movement_${input.movementType}`,
    entityType: "inventory_item",
    entityId: input.inventoryItemId,
    branchId: item.branchId,
    description: `Stock movement: ${input.movementType} of ${input.quantity} ${item.unitOfMeasurement} - ${item.name}.`,
    metadata: {
      movementType: input.movementType,
      quantity: input.quantity,
      referenceType: input.referenceType,
      referenceId: input.referenceId,
    },
    meta,
  });

  return { ok: true };
}

/** Get stock movement history for an item */
export async function getStockMovementHistory(
  inventoryItemId: string,
  options: { limit?: number } = {},
): Promise<StockMovementRecord[]> {
  const rows = await db
    .select({
      id: stockMovements.id,
      movementType: stockMovements.movementType,
      quantity: stockMovements.quantity,
      sourceBranchId: stockMovements.sourceBranchId,
      destinationBranchId: stockMovements.destinationBranchId,
      referenceType: stockMovements.referenceType,
      referenceId: stockMovements.referenceId,
      staffUserId: stockMovements.staffUserId,
      reason: stockMovements.reason,
      createdAt: stockMovements.createdAt,
    })
    .from(stockMovements)
    .where(eq(stockMovements.inventoryItemId, inventoryItemId))
    .orderBy(desc(stockMovements.createdAt))
    .limit(options.limit ?? 50);

  // Fetch user names for staff
  const userIds = [...new Set(rows.map((r) => r.staffUserId).filter(Boolean))].filter(
    (id): id is string => id !== undefined,
  );

  const userMap = new Map<string, string>();
  if (userIds.length > 0) {
    for (const userId of userIds) {
      const [user] = await db
        .select({ fullName: users.fullName })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      if (user) {
        userMap.set(userId, user.fullName);
      }
    }
  }

  return rows.map((row) => ({
    id: row.id,
    inventoryItemId: inventoryItemId,
    movementType: row.movementType,
    quantity: row.quantity,
    sourceBranchId: row.sourceBranchId,
    destinationBranchId: row.destinationBranchId,
    referenceType: row.referenceType,
    referenceId: row.referenceId,
    staffUserId: row.staffUserId,
    reason: row.reason,
    createdAt: row.createdAt ? new Date(row.createdAt) : new Date(),
    ...(row.staffUserId && { staffName: userMap.get(row.staffUserId) ?? "Unknown" }),
  }));
}

/** Get low stock items across all branches */
export async function getAllLowStockAlerts(): Promise<LowStockAlert[]> {
  const rows = await db
    .select({
      id: inventoryItems.id,
      name: inventoryItems.name,
      sku: inventoryItems.sku,
      currentStock: inventoryItems.currentStock,
      minimumStockLevel: inventoryItems.minimumStockLevel,
      branchId: inventoryItems.branchId,
    })
    .from(inventoryItems)
    .where(sql`${inventoryItems.currentStock} <= ${inventoryItems.minimumStockLevel}`)
    .orderBy(inventoryItems.name);

  return rows.map((row) => ({
    itemId: row.id,
    name: row.name,
    sku: row.sku,
    currentStock: row.currentStock,
    minimumStockLevel: row.minimumStockLevel,
    branchId: row.branchId,
    daysUntilExpiry: null,
  }));
}