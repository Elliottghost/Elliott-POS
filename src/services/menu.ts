import { and, asc, eq, inArray, like, ne, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db/client";
import {
  branchMenuItems,
  menuCategories,
  menuItems,
} from "@/db/schema";
import { recordAudit } from "@/lib/audit";
import type { RequestMeta, SessionUser } from "@/lib/auth/session";
import type { MenuCategoryInput, MenuItemInput } from "@/lib/validation";

export interface MenuCategoryRow {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  itemCount: number;
}

export interface MenuItemRow {
  id: string;
  categoryId: string;
  categoryName: string;
  name: string;
  description: string | null;
  price: number;
  station: string;
  imagePath: string | null;
  prepMinutes: number | null;
  isFeatured: boolean;
  isActive: boolean;
}

export async function listMenuCategories(
  options: { includeInactive?: boolean } = {},
): Promise<MenuCategoryRow[]> {
  const rows = await db
    .select({
      id: menuCategories.id,
      name: menuCategories.name,
      description: menuCategories.description,
      sortOrder: menuCategories.sortOrder,
      isActive: menuCategories.isActive,
      itemCount: sql<number>`(
        select count(*) from menu_items where menu_items.category_id = menu_categories.id
      )`,
    })
    .from(menuCategories)
    .where(options.includeInactive ? undefined : eq(menuCategories.isActive, true))
    .orderBy(asc(menuCategories.sortOrder), asc(menuCategories.name));

  return rows.map((row) => ({ ...row, itemCount: Number(row.itemCount) }));
}

export async function listMenuItems(
  options: {
    includeInactive?: boolean;
    categoryId?: string;
    search?: string;
    featuredOnly?: boolean;
  } = {},
): Promise<MenuItemRow[]> {
  const conditions: SQL[] = [];

  if (!options.includeInactive) conditions.push(eq(menuItems.isActive, true));
  if (options.categoryId) conditions.push(eq(menuItems.categoryId, options.categoryId));
  if (options.featuredOnly) conditions.push(eq(menuItems.isFeatured, true));
  if (options.search) {
    const term = `%${options.search.trim().toLowerCase()}%`;
    const search = or(
      like(sql`lower(${menuItems.name})`, term),
      like(sql`lower(coalesce(${menuItems.description}, ''))`, term),
      like(sql`lower(${menuCategories.name})`, term),
    );
    if (search) conditions.push(search);
  }

  return db
    .select({
      id: menuItems.id,
      categoryId: menuItems.categoryId,
      categoryName: menuCategories.name,
      name: menuItems.name,
      description: menuItems.description,
      price: menuItems.price,
      station: menuItems.station,
      imagePath: menuItems.imagePath,
      prepMinutes: menuItems.prepMinutes,
      isFeatured: menuItems.isFeatured,
      isActive: menuItems.isActive,
    })
    .from(menuItems)
    .innerJoin(menuCategories, eq(menuCategories.id, menuItems.categoryId))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(asc(menuCategories.sortOrder), asc(menuItems.name));
}

export async function getMenuItem(id: string) {
  const [row] = await db.select().from(menuItems).where(eq(menuItems.id, id)).limit(1);
  return row ?? null;
}

export async function getMenuCategory(id: string) {
  const [row] = await db
    .select()
    .from(menuCategories)
    .where(eq(menuCategories.id, id))
    .limit(1);
  return row ?? null;
}

export type MenuServiceResult =
  | { ok: true; id: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export async function createMenuCategory(
  actor: SessionUser,
  input: MenuCategoryInput,
  meta?: RequestMeta,
): Promise<MenuServiceResult> {
  const [existing] = await db
    .select({ id: menuCategories.id })
    .from(menuCategories)
    .where(eq(menuCategories.name, input.name))
    .limit(1);

  if (existing) {
    return {
      ok: false,
      error: "A category with that name already exists.",
      fieldErrors: { name: ["Category names must be unique."] },
    };
  }

  const [created] = await db
    .insert(menuCategories)
    .values({
      name: input.name,
      description: input.description ?? null,
      sortOrder: input.sortOrder,
      isActive: input.isActive,
    })
    .returning({ id: menuCategories.id });

  await recordAudit({
    actor,
    action: "menu.category_created",
    entityType: "menu_category",
    entityId: created.id,
    branchId: null,
    description: `Menu category "${input.name}" created.`,
    metadata: { name: input.name },
    meta,
  });

  return { ok: true, id: created.id };
}

export async function updateMenuCategory(
  actor: SessionUser,
  categoryId: string,
  input: MenuCategoryInput,
  meta?: RequestMeta,
): Promise<MenuServiceResult> {
  const existing = await getMenuCategory(categoryId);
  if (!existing) return { ok: false, error: "Category not found." };

  const [nameOwner] = await db
    .select({ id: menuCategories.id })
    .from(menuCategories)
    .where(
      and(eq(menuCategories.name, input.name), ne(menuCategories.id, categoryId)),
    )
    .limit(1);

  if (nameOwner) {
    return {
      ok: false,
      error: "A category with that name already exists.",
      fieldErrors: { name: ["Category names must be unique."] },
    };
  }

  await db
    .update(menuCategories)
    .set({
      name: input.name,
      description: input.description ?? null,
      sortOrder: input.sortOrder,
      isActive: input.isActive,
      updatedAt: new Date(),
    })
    .where(eq(menuCategories.id, categoryId));

  await recordAudit({
    actor,
    action: "menu.category_updated",
    entityType: "menu_category",
    entityId: categoryId,
    branchId: null,
    description: `Menu category "${input.name}" updated.`,
    metadata: { before: { name: existing.name }, after: { name: input.name } },
    meta,
  });

  return { ok: true, id: categoryId };
}

/** Deletes an empty category. Categories still holding dishes are protected. */
export async function deleteMenuCategory(
  actor: SessionUser,
  categoryId: string,
  meta?: RequestMeta,
): Promise<MenuServiceResult> {
  const existing = await getMenuCategory(categoryId);
  if (!existing) return { ok: false, error: "Category not found." };

  const [countRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(menuItems)
    .where(eq(menuItems.categoryId, categoryId));

  const itemCount = Number(countRow?.count ?? 0);
  if (itemCount > 0) {
    return {
      ok: false,
      error: `"${existing.name}" still holds ${itemCount} item${itemCount === 1 ? "" : "s"}. Move or delete them first.`,
    };
  }

  await db.delete(menuCategories).where(eq(menuCategories.id, categoryId));

  await recordAudit({
    actor,
    action: "menu.category_deleted",
    entityType: "menu_category",
    entityId: categoryId,
    branchId: null,
    description: `Menu category "${existing.name}" deleted.`,
    metadata: { name: existing.name },
    meta,
  });

  return { ok: true, id: categoryId };
}

export async function createMenuItem(
  actor: SessionUser,
  input: MenuItemInput,
  meta?: RequestMeta,
  imagePath?: string | null,
): Promise<MenuServiceResult> {
  const category = await getMenuCategory(input.categoryId);
  if (!category) {
    return {
      ok: false,
      error: "Choose a valid category.",
      fieldErrors: { categoryId: ["Category not found."] },
    };
  }

  const [created] = await db
    .insert(menuItems)
    .values({
      categoryId: input.categoryId,
      name: input.name,
      description: input.description ?? null,
      price: input.price,
      station: input.station,
      prepMinutes: input.prepMinutes ?? null,
      isFeatured: input.isFeatured,
      isActive: input.isActive,
      imagePath: imagePath ?? null,
    })
    .returning({ id: menuItems.id });

  await recordAudit({
    actor,
    action: "menu.item_created",
    entityType: "menu_item",
    entityId: created.id,
    branchId: null,
    description: `Menu item "${input.name}" added at ${input.price / 100} RWF.`,
    metadata: {
      name: input.name,
      price: input.price,
      category: category.name,
      featured: input.isFeatured,
    },
    meta,
  });

  return { ok: true, id: created.id };
}

export async function updateMenuItem(
  actor: SessionUser,
  itemId: string,
  input: MenuItemInput,
  meta?: RequestMeta,
  imagePath?: string | null,
): Promise<MenuServiceResult> {
  const existing = await getMenuItem(itemId);
  if (!existing) return { ok: false, error: "Menu item not found." };

  const category = await getMenuCategory(input.categoryId);
  if (!category) {
    return {
      ok: false,
      error: "Choose a valid category.",
      fieldErrors: { categoryId: ["Category not found."] },
    };
  }

  await db
    .update(menuItems)
    .set({
      categoryId: input.categoryId,
      name: input.name,
      description: input.description ?? null,
      price: input.price,
      station: input.station,
      prepMinutes: input.prepMinutes ?? null,
      isFeatured: input.isFeatured,
      isActive: input.isActive,
      ...(imagePath === undefined ? {} : { imagePath }),
      updatedAt: new Date(),
    })
    .where(eq(menuItems.id, itemId));

  await recordAudit({
    actor,
    action: "menu.item_updated",
    entityType: "menu_item",
    entityId: itemId,
    branchId: null,
    description: `Menu item "${input.name}" updated.`,
    metadata: {
      before: {
        name: existing.name,
        price: existing.price,
        isActive: existing.isActive,
        isFeatured: existing.isFeatured,
      },
      after: {
        name: input.name,
        price: input.price,
        isActive: input.isActive,
        isFeatured: input.isFeatured,
      },
    },
    meta,
  });

  return { ok: true, id: itemId };
}

export async function deleteMenuItem(
  actor: SessionUser,
  itemId: string,
  meta?: RequestMeta,
): Promise<MenuServiceResult> {
  const existing = await getMenuItem(itemId);
  if (!existing) return { ok: false, error: "Menu item not found." };

  // Historical order lines keep their price snapshot but lose the reference, so
  // deleting a dish never rewrites a receipt.
  await db.delete(menuItems).where(eq(menuItems.id, itemId));

  await recordAudit({
    actor,
    action: "menu.item_deleted",
    entityType: "menu_item",
    entityId: itemId,
    branchId: null,
    description: `Menu item "${existing.name}" removed from the menu.`,
    metadata: { name: existing.name, price: existing.price },
    meta,
  });

  return { ok: true, id: itemId };
}

/**
 * Per-branch configuration: availability and an optional price override.
 * Package-level writes are what the branch menu screen and the till consume.
 */
export async function setBranchMenuItem(
  actor: SessionUser,
  input: {
    branchId: string;
    menuItemId: string;
    isAvailable: boolean;
    priceOverride: number | null;
  },
  meta?: RequestMeta,
): Promise<MenuServiceResult> {
  const item = await getMenuItem(input.menuItemId);
  if (!item) return { ok: false, error: "Menu item not found." };

  const priceOverride = input.priceOverride && input.priceOverride > 0
    ? input.priceOverride
    : null;

  await db
    .insert(branchMenuItems)
    .values({
      branchId: input.branchId,
      menuItemId: input.menuItemId,
      isAvailable: input.isAvailable,
      priceOverride,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [branchMenuItems.branchId, branchMenuItems.menuItemId],
      set: { isAvailable: input.isAvailable, priceOverride, updatedAt: new Date() },
    });

  await recordAudit({
    actor,
    action: "menu.branch_item_updated",
    entityType: "menu_item",
    entityId: input.menuItemId,
    branchId: input.branchId,
    description: `"${item.name}" configured for this branch — ${
      input.isAvailable ? "on sale" : "sold out"
    }${priceOverride ? ` at ${priceOverride / 100} RWF` : " at the brand price"}.`,
    metadata: {
      menuItemId: input.menuItemId,
      isAvailable: input.isAvailable,
      priceOverride,
    },
    meta,
  });

  return { ok: true, id: input.menuItemId };
}

/** Mark an item sold out (or available again) for one branch only. */
export async function setBranchItemAvailability(
  actor: SessionUser,
  branchId: string,
  menuItemId: string,
  isAvailable: boolean,
  meta?: RequestMeta,
): Promise<MenuServiceResult> {
  const [existing] = await db
    .select({ priceOverride: branchMenuItems.priceOverride })
    .from(branchMenuItems)
    .where(
      and(
        eq(branchMenuItems.branchId, branchId),
        eq(branchMenuItems.menuItemId, menuItemId),
      ),
    )
    .limit(1);

  return setBranchMenuItem(
    actor,
    {
      branchId,
      menuItemId,
      isAvailable,
      priceOverride: existing?.priceOverride ?? null,
    },
    meta,
  );
}

export interface PosMenuItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  basePrice: number;
  hasBranchPrice: boolean;
  imagePath: string | null;
  categoryId: string;
  categoryName: string;
  station: string;
  prepMinutes: number | null;
  isFeatured: boolean;
  isAvailable: boolean;
}

export interface PosMenuCategory {
  id: string;
  name: string;
  items: PosMenuItem[];
}

/**
 * Sellable menu for one branch: active items in active categories, with
 * per-branch sold-out flags and price overrides applied. This is the only
 * source the POS prices from.
 */
export async function getPosMenu(branchId: string): Promise<PosMenuCategory[]> {
  const rows = await db
    .select({
      id: menuItems.id,
      name: menuItems.name,
      description: menuItems.description,
      price: menuItems.price,
      imagePath: menuItems.imagePath,
      station: menuItems.station,
      prepMinutes: menuItems.prepMinutes,
      isFeatured: menuItems.isFeatured,
      categoryId: menuItems.categoryId,
      categoryName: menuCategories.name,
      categorySort: menuCategories.sortOrder,
      priceOverride: sql<
        number | null
      >`(select branch_menu_items.price_override from branch_menu_items
        where branch_menu_items.menu_item_id = menu_items.id
          and branch_menu_items.branch_id = ${branchId}
        limit 1)`,
      isAvailable: sql<number>`coalesce((
        select branch_menu_items.is_available from branch_menu_items
        where branch_menu_items.menu_item_id = menu_items.id
          and branch_menu_items.branch_id = ${branchId}
        limit 1
      ), 1)`,
    })
    .from(menuItems)
    .innerJoin(menuCategories, eq(menuCategories.id, menuItems.categoryId))
    .where(and(eq(menuItems.isActive, true), eq(menuCategories.isActive, true)))
    .orderBy(
      asc(menuCategories.sortOrder),
      asc(menuCategories.name),
      asc(menuItems.name),
    );

  const grouped = new Map<string, PosMenuCategory>();
  for (const row of rows) {
    const category = grouped.get(row.categoryId) ?? {
      id: row.categoryId,
      name: row.categoryName,
      items: [],
    };
    const override = row.priceOverride ? Number(row.priceOverride) : null;
    category.items.push({
      id: row.id,
      name: row.name,
      description: row.description,
      price: override && override > 0 ? override : row.price,
      basePrice: row.price,
      hasBranchPrice: Boolean(override && override > 0),
      imagePath: row.imagePath,
      categoryId: row.categoryId,
      categoryName: row.categoryName,
      station: row.station,
      prepMinutes: row.prepMinutes,
      isFeatured: row.isFeatured,
      isAvailable: Boolean(row.isAvailable),
    });
    grouped.set(row.categoryId, category);
  }

  return [...grouped.values()];
}

/** Availability and price overrides for the branches in scope. */
export async function listBranchAvailability(branchIds: string[]) {
  if (branchIds.length === 0) return [];
  return db
    .select({
      branchId: branchMenuItems.branchId,
      menuItemId: branchMenuItems.menuItemId,
      isAvailable: branchMenuItems.isAvailable,
      priceOverride: branchMenuItems.priceOverride,
    })
    .from(branchMenuItems)
    .where(inArray(branchMenuItems.branchId, branchIds));
}

/** Branch rows for one item, used by the item editor. */
export async function getMenuAvailabilityByBranch(menuItemId: string) {
  return db
    .select({
      branchId: branchMenuItems.branchId,
      isAvailable: branchMenuItems.isAvailable,
      priceOverride: branchMenuItems.priceOverride,
    })
    .from(branchMenuItems)
    .where(eq(branchMenuItems.menuItemId, menuItemId));
}

export interface PublicMenuCategory {
  id: string;
  name: string;
  items: {
    id: string;
    name: string;
    description: string | null;
    price: number;
    imagePath: string | null;
    prepMinutes: number | null;
    isFeatured: boolean;
    isAvailable: boolean;
  }[];
}

/** Menu shown to guests through the table QR code: one branch, effective prices. */
export async function getBranchMenu(branchId: string): Promise<PublicMenuCategory[]> {
  const menu = await getPosMenu(branchId);
  return menu.map((group) => ({
    id: group.id,
    name: group.name,
    items: group.items.map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      price: item.price,
      imagePath: item.imagePath,
      prepMinutes: item.prepMinutes,
      isFeatured: item.isFeatured,
      isAvailable: item.isAvailable,
    })),
  }));
}
