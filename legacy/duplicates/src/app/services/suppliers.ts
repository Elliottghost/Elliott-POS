import { db } from "@/db/client";
import { suppliers, inventoryItems } from "@/db/schema";
import { and, sql } from "drizzle-orm";
import { recordAudit } from "@/lib/audit";
import { canAccessBranch } from "@/lib/auth/access";
import type { RequestMeta, SessionUser } from "@/lib/auth/session";

/** Supplier row */
export interface SupplierRow {
  id: string;
  name: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  isActive: boolean;
  itemCount: number;
}

/** List suppliers */
export async function listSuppliers(
  options: { branchId?: string; includeInactive?: boolean } = {},
): Promise<SupplierRow[]> {
  const conditions: any[] = [];

  if (options.branchId) {
    // Filter items by branch via inventory items
    conditions.push(inventoryItems.branchId === options.branchId);
  }

  if (options.includeInactive === undefined) {
    conditions.push(suppliers.isActive === true);
  } else if (!options.includeInactive) {
    conditions.push(suppliers.isActive === true);
  }

  const rows = await db
    .select({
      id: suppliers.id,
      name: suppliers.name,
      contactPerson: suppliers.contactPerson,
      phone: suppliers.phone,
      email: suppliers.email,
      address: suppliers.address,
      notes: suppliers.notes,
      isActive: suppliers.isActive,
    })
    .from(suppliers)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(asc(suppliers.name));

  return rows;
}

/** Get a single supplier */
export async function getSupplier(id: string) {
  const [row] = await db
    .select()
    .from(suppliers)
    .where(eq(suppliers.id, id))
    .limit(1);
  return row ?? null;
}

/** Create a supplier */
export async function createSupplier(
  actor: SessionUser,
  input: {
    name: string;
    contactPerson?: string;
    phone?: string;
    email?: string;
    address?: string;
    notes?: string;
  },
  meta?: RequestMeta,
): Promise<{ ok: true; id: string } | { ok: false; error: string; fieldErrors?: Record<string, string[]> }> {
  // Check name uniqueness
  const [existing] = await db
    .select({ id: suppliers.id })
    .from(suppliers)
    .where(eq(suppliers.name, input.name))
    .limit(1);

  if (existing) {
    return {
      ok: false,
      error: "A supplier with that name already exists.",
      fieldErrors: { name: ["Supplier name must be unique."] },
    };
  }

  const [created] = await db
    .insert(suppliers)
    .values({
      name: input.name,
      contactPerson: input.contactPerson ?? null,
      phone: input.phone ?? null,
      email: input.email ?? null,
      address: input.address ?? null,
      notes: input.notes ?? null,
      isActive: true,
    })
    .returning({ id: suppliers.id });

  await recordAudit({
    actor,
    action: "supplier.created",
    entityType: "supplier",
    entityId: created.id,
    branchId: null,
    description: `Supplier "${input.name}" created.`,
    metadata: { name: input.name },
    meta,
  });

  return { ok: true, id: created.id };
}

/** Update a supplier */
export async function updateSupplier(
  actor: SessionUser,
  id: string,
  input: {
    name?: string;
    contactPerson?: string;
    phone?: string;
    email?: string;
    address?: string;
    notes?: string;
  },
  meta?: RequestMeta,
): Promise<{ ok: true; id: string } | { ok: false; error: string; fieldErrors?: Record<string, string[]> > > {
  const existing = await getSupplier(id);
  if (!existing) return { ok: false, error: "Supplier not found." };

  // If name is changing, check uniqueness
  if (input.name && input.name !== existing.name) {
    const [nameOwner] = await db
      .select({ id: suppliers.id })
      .from(suppliers)
      .where(and(eq(suppliers.name, input.name), ne(suppliers.id, id)))
      .limit(1);

    if (nameOwner) {
      return {
        ok: false,
        error: "A supplier with that name already exists.",
        fieldErrors: { name: ["Supplier name must be unique."] },
      };
    }
  }

  await db
    .update(suppliers)
    .set({
      name: input.name ?? existing.name,
      contactPerson: input.contactPerson ?? existing.contactPerson,
      phone: input.phone ?? existing.phone,
      email: input.email ?? existing.email,
      address: input.address ?? existing.address,
      notes: input.notes ?? existing.notes,
      updatedAt: new Date(),
    })
    .where(eq(suppliers.id, id));

  await recordAudit({
    actor,
    action: "supplier.updated",
    entityType: "supplier",
    entityId: id,
    branchId: null,
    description: `Supplier "${input.name ?? existing.name}" updated.`,
    metadata: {
      before: { name: existing.name },
      after: { name: input.name ?? existing.name },
    },
    meta,
  });

  return { ok: true, id: id };
}

/** Delete (deactivate) a supplier */
export async function deleteSupplier(
  actor: SessionUser,
  id: string,
  meta?: RequestMeta,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const existing = await getSupplier(id);
  if (!existing) return { ok: false, error: "Supplier not found." };

  // Check if supplier has associated inventory items
  const [itemCountRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(inventoryItems)
    .where(and(eq(inventoryItems.supplierId, id), eq(inventoryItems.isActive, true)));

  const itemCount = Number(itemCountRow?.count ?? 0);
  if (itemCount > 0) {
    return {
      ok: false,
      error: `Supplier "${existing.name}" still has ${itemCount} active inventory item${itemCount === 1 ? "" : "s"}. Reassign or deactivate those items first.`,
    };
  }

  await db
    .update(suppliers)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(suppliers.id, id));

  await recordAudit({
    actor,
    action: "supplier.deleted",
    entityType: "supplier",
    entityId: id,
    branchId: null,
    description: `Supplier "${existing.name}" deactivated.`,
    metadata: { name: existing.name },
    meta,
  });

  return { ok: true };
}

/** Get inventory items by supplier */
export async function getItemsBySupplier(supplierId: string) {
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
    .where(and(eq(inventoryItems.supplierId, supplierId), eq(inventoryItems.isActive, true)));

  return rows;
}