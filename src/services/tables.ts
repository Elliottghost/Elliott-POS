import { and, asc, eq, inArray, ne, sql, type SQL } from "drizzle-orm";
import { db } from "@/db/client";
import { branches, reservations, restaurantTables } from "@/db/schema";
import { recordAudit } from "@/lib/audit";
import { canAccessBranch } from "@/lib/auth/access";
import type { RequestMeta, SessionUser } from "@/lib/auth/session";
import { todayKigali } from "@/lib/format";
import type { TableInput } from "@/lib/validation";

export interface TableRow {
  id: string;
  branchId: string;
  branchName: string;
  branchCode: string;
  branchSlug: string;
  code: string;
  name: string | null;
  capacity: number;
  section: string;
  status: string;
  qrToken: string;
  isActive: boolean;
  reservationsToday: number;
}

export type TableServiceResult =
  | { ok: true; id: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export async function listTables(
  scope: string[] | null,
  options: { branchId?: string; includeInactive?: boolean } = {},
): Promise<TableRow[]> {
  const conditions: SQL[] = [];

  if (options.branchId) {
    conditions.push(eq(restaurantTables.branchId, options.branchId));
  } else if (scope !== null) {
    if (scope.length === 0) return [];
    conditions.push(inArray(restaurantTables.branchId, scope));
  }
  if (!options.includeInactive) {
    conditions.push(eq(restaurantTables.isActive, true));
  }

  const today = todayKigali();

  const rows = await db
    .select({
      id: restaurantTables.id,
      branchId: restaurantTables.branchId,
      branchName: branches.name,
      branchCode: branches.code,
      branchSlug: branches.slug,
      code: restaurantTables.code,
      name: restaurantTables.name,
      capacity: restaurantTables.capacity,
      section: restaurantTables.section,
      status: restaurantTables.status,
      qrToken: restaurantTables.qrToken,
      isActive: restaurantTables.isActive,
      reservationsToday: sql<number>`(
        select count(*) from reservations
        where reservations.table_id = restaurant_tables.id
          and reservations.reservation_date = ${today}
          and reservations.status in ('pending', 'confirmed', 'seated')
      )`,
    })
    .from(restaurantTables)
    .innerJoin(branches, eq(branches.id, restaurantTables.branchId))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(
      asc(branches.name),
      asc(restaurantTables.section),
      asc(restaurantTables.code),
    );

  return rows.map((row) => ({
    ...row,
    reservationsToday: Number(row.reservationsToday),
  }));
}

export async function getTableById(id: string) {
  const [row] = await db
    .select({
      table: restaurantTables,
      branchName: branches.name,
      branchCode: branches.code,
      branchSlug: branches.slug,
    })
    .from(restaurantTables)
    .innerJoin(branches, eq(branches.id, restaurantTables.branchId))
    .where(eq(restaurantTables.id, id))
    .limit(1);
  return row ?? null;
}

/** The QR code is scannable by guests, so this lookup is intentionally public. */
export async function getTableByQrToken(token: string) {
  const [row] = await db
    .select({
      table: restaurantTables,
      branchName: branches.name,
      branchSlug: branches.slug,
      branchCode: branches.code,
      branchPhone: branches.phone,
      branchAddress: branches.address,
      branchOpen: branches.openingTime,
      branchClose: branches.closingTime,
      branchActive: branches.isActive,
    })
    .from(restaurantTables)
    .innerJoin(branches, eq(branches.id, restaurantTables.branchId))
    .where(eq(restaurantTables.qrToken, token))
    .limit(1);
  return row ?? null;
}

export async function createTable(
  actor: SessionUser,
  input: TableInput,
  meta?: RequestMeta,
): Promise<TableServiceResult> {
  if (!canAccessBranch(actor, input.branchId)) {
    return { ok: false, error: "You can only manage tables for your own branch." };
  }

  const branch = await db
    .select({ id: branches.id, name: branches.name })
    .from(branches)
    .where(eq(branches.id, input.branchId))
    .limit(1);

  if (branch.length === 0) return { ok: false, error: "Branch not found." };

  const [duplicate] = await db
    .select({ id: restaurantTables.id })
    .from(restaurantTables)
    .where(
      and(
        eq(restaurantTables.branchId, input.branchId),
        eq(restaurantTables.code, input.code),
      ),
    )
    .limit(1);

  if (duplicate) {
    return {
      ok: false,
      error: "That table number already exists at this branch.",
      fieldErrors: { code: ["Use a unique table number per branch."] },
    };
  }

  const [created] = await db
    .insert(restaurantTables)
    .values({
      branchId: input.branchId,
      code: input.code,
      name: input.name ?? null,
      capacity: input.capacity,
      section: input.section,
      status: input.status,
      qrToken: crypto.randomUUID().replace(/-/g, ""),
      isActive: input.isActive,
    })
    .returning({ id: restaurantTables.id });

  await recordAudit({
    actor,
    action: "table.created",
    entityType: "restaurant_table",
    entityId: created.id,
    branchId: input.branchId,
    description: `Table ${input.code} added at ${branch[0].name} (${input.capacity} seats).`,
    metadata: { code: input.code, capacity: input.capacity, section: input.section },
    meta,
  });

  return { ok: true, id: created.id };
}

export async function updateTable(
  actor: SessionUser,
  tableId: string,
  input: TableInput,
  meta?: RequestMeta,
): Promise<TableServiceResult> {
  const existing = await getTableById(tableId);
  if (!existing) return { ok: false, error: "Table not found." };

  if (!canAccessBranch(actor, existing.table.branchId)) {
    return { ok: false, error: "This table belongs to another branch." };
  }
  if (!canAccessBranch(actor, input.branchId)) {
    return { ok: false, error: "You cannot move a table to another branch." };
  }

  const [duplicate] = await db
    .select({ id: restaurantTables.id })
    .from(restaurantTables)
    .where(
      and(
        eq(restaurantTables.branchId, input.branchId),
        eq(restaurantTables.code, input.code),
        ne(restaurantTables.id, tableId),
      ),
    )
    .limit(1);

  if (duplicate) {
    return {
      ok: false,
      error: "That table number already exists at this branch.",
      fieldErrors: { code: ["Use a unique table number per branch."] },
    };
  }

  await db
    .update(restaurantTables)
    .set({
      branchId: input.branchId,
      code: input.code,
      name: input.name ?? null,
      capacity: input.capacity,
      section: input.section,
      status: input.status,
      isActive: input.isActive,
      updatedAt: new Date(),
    })
    .where(eq(restaurantTables.id, tableId));

  await recordAudit({
    actor,
    action: "table.updated",
    entityType: "restaurant_table",
    entityId: tableId,
    branchId: input.branchId,
    description: `Table ${input.code} updated.`,
    metadata: {
      before: { code: existing.table.code, capacity: existing.table.capacity },
      after: { code: input.code, capacity: input.capacity },
    },
    meta,
  });

  return { ok: true, id: tableId };
}

export async function setTableStatus(
  actor: SessionUser,
  tableId: string,
  status: string,
  meta?: RequestMeta,
): Promise<TableServiceResult> {
  const existing = await getTableById(tableId);
  if (!existing) return { ok: false, error: "Table not found." };
  if (!canAccessBranch(actor, existing.table.branchId)) {
    return { ok: false, error: "This table belongs to another branch." };
  }

  await db
    .update(restaurantTables)
    .set({ status, updatedAt: new Date() })
    .where(eq(restaurantTables.id, tableId));

  await recordAudit({
    actor,
    action: "table.status_changed",
    entityType: "restaurant_table",
    entityId: tableId,
    branchId: existing.table.branchId,
    description: `Table ${existing.table.code} marked ${status}.`,
    metadata: { status, before: existing.table.status },
    meta,
  });

  return { ok: true, id: tableId };
}

/** Tables are physical records; ones with reservation history are deactivated. */
export async function deleteTable(
  actor: SessionUser,
  tableId: string,
  meta?: RequestMeta,
): Promise<TableServiceResult> {
  const existing = await getTableById(tableId);
  if (!existing) return { ok: false, error: "Table not found." };
  if (!canAccessBranch(actor, existing.table.branchId)) {
    return { ok: false, error: "This table belongs to another branch." };
  }

  const [countRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(reservations)
    .where(eq(reservations.tableId, tableId));

  const bookings = Number(countRow?.count ?? 0);

  if (bookings > 0) {
    await db
      .update(restaurantTables)
      .set({ isActive: false, status: "unavailable", updatedAt: new Date() })
      .where(eq(restaurantTables.id, tableId));

    await recordAudit({
      actor,
      action: "table.deactivated",
      entityType: "restaurant_table",
      entityId: tableId,
      branchId: existing.table.branchId,
      description: `Table ${existing.table.code} deactivated (it has ${bookings} reservation${bookings === 1 ? "" : "s"} on record).`,
      metadata: { bookings },
      meta,
    });

    return { ok: true, id: tableId };
  }

  await db.delete(restaurantTables).where(eq(restaurantTables.id, tableId));

  await recordAudit({
    actor,
    action: "table.deleted",
    entityType: "restaurant_table",
    entityId: tableId,
    branchId: existing.table.branchId,
    description: `Table ${existing.table.code} deleted.`,
    metadata: { code: existing.table.code },
    meta,
  });

  return { ok: true, id: tableId };
}

export interface TableStats {
  total: number;
  available: number;
  occupied: number;
  reserved: number;
  unavailable: number;
  seats: number;
}

export async function getTableStats(
  scope: string[] | null,
  branchId?: string,
): Promise<TableStats> {
  const conditions: SQL[] = [eq(restaurantTables.isActive, true)];
  if (branchId) conditions.push(eq(restaurantTables.branchId, branchId));
  else if (scope !== null) {
    if (scope.length === 0) {
      return { total: 0, available: 0, occupied: 0, reserved: 0, unavailable: 0, seats: 0 };
    }
    conditions.push(inArray(restaurantTables.branchId, scope));
  }

  const rows = await db
    .select({
      status: restaurantTables.status,
      count: sql<number>`count(*)`,
      seats: sql<number>`coalesce(sum(${restaurantTables.capacity}), 0)`,
    })
    .from(restaurantTables)
    .where(and(...conditions))
    .groupBy(restaurantTables.status);

  const stats: TableStats = {
    total: 0,
    available: 0,
    occupied: 0,
    reserved: 0,
    unavailable: 0,
    seats: 0,
  };

  for (const row of rows) {
    const count = Number(row.count);
    stats.total += count;
    stats.seats += Number(row.seats);
    if (row.status in stats && row.status !== "total" && row.status !== "seats") {
      stats[row.status as "available" | "occupied" | "reserved" | "unavailable"] += count;
    }
  }

  return stats;
}
