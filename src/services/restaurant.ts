import { and, eq, gte, inArray, sql, type SQL } from "drizzle-orm";
import { db } from "@/db/client";
import {
  branchMenuItems,
  branches,
  menuItems,
  orders,
  reservations,
  restaurantTables,
} from "@/db/schema";
import { startOfBusinessDay, todayKigali } from "@/lib/format";
import { getReservationStats, getUpcomingReservations } from "@/services/reservations";

export interface BranchRestaurantPerformance {
  branchId: string;
  branchCode: string;
  branchName: string;
  menuSoldOut: number;
  tables: number;
  tablesAvailable: number;
  tablesOccupied: number;
  reservationsToday: number;
  pendingReservations: number;
  ordersToday: number;
  revenueToday: number;
}

export interface RestaurantOverview {
  menu: { total: number; available: number; unavailable: number; featured: number };
  tables: {
    total: number;
    available: number;
    occupied: number;
    reserved: number;
    unavailable: number;
    seats: number;
  };
  reservations: { today: number; pending: number; confirmedToday: number; seated: number };
  today: string;
  branches: BranchRestaurantPerformance[];
  upcoming: Awaited<ReturnType<typeof getUpcomingReservations>>;
  revenueToday: number;
  ordersToday: number;
  openOrders: number;
}

function scopedBranchIds(scope: string[] | null, branchId?: string): string[] | null {
  if (branchId) return [branchId];
  return scope;
}

/**
 * Restaurant command-centre figures. Everything is read from the operational
 * tables and scoped exactly like the rest of the app: one branch for staff,
 * every branch for a super administrator (or a chosen branch).
 */
export async function getRestaurantOverview(
  scope: string[] | null,
  branchId?: string,
): Promise<RestaurantOverview> {
  const branchIds = scopedBranchIds(scope, branchId);

  const branchConditions: SQL[] = [];
  if (branchIds) {
    if (branchIds.length === 0) {
      return {
        menu: { total: 0, available: 0, unavailable: 0, featured: 0 },
        tables: { total: 0, available: 0, occupied: 0, reserved: 0, unavailable: 0, seats: 0 },
        reservations: { today: 0, pending: 0, confirmedToday: 0, seated: 0 },
        today: todayKigali(),
        branches: [],
        upcoming: [],
        revenueToday: 0,
        ordersToday: 0,
        openOrders: 0,
      };
    }
    branchConditions.push(inArray(branches.id, branchIds));
  }

  const branchRows = await db
    .select({
      id: branches.id,
      code: branches.code,
      name: branches.name,
    })
    .from(branches)
    .where(branchConditions.length ? and(...branchConditions) : undefined)
    .orderBy(branches.name);

  const [menuRow] = await db
    .select({
      total: sql<number>`count(*)`,
      active: sql<number>`sum(case when ${menuItems.isActive} = 1 then 1 else 0 end)`,
      featured: sql<number>`sum(case when ${menuItems.isFeatured} = 1 then 1 else 0 end)`,
    })
    .from(menuItems);

  const total = Number(menuRow?.total ?? 0);
  const active = Number(menuRow?.active ?? 0);
  const featured = Number(menuRow?.featured ?? 0);

  // A single-branch scope (a manager) behaves like a branch-specific view.
  const effectiveBranchId =
    branchId ?? (branchIds && branchIds.length === 1 ? branchIds[0] : undefined);

  let menuAvailable = active;
  if (effectiveBranchId) {
    const [soldOut] = await db
      .select({ count: sql<number>`count(distinct ${branchMenuItems.menuItemId})` })
      .from(branchMenuItems)
      .innerJoin(menuItems, eq(menuItems.id, branchMenuItems.menuItemId))
      .where(
        and(
          eq(branchMenuItems.branchId, effectiveBranchId),
          eq(branchMenuItems.isAvailable, false),
          eq(menuItems.isActive, true),
        ),
      );
    menuAvailable = Math.max(active - Number(soldOut?.count ?? 0), 0);
  }

  const tableConditions: SQL[] = [eq(restaurantTables.isActive, true)];
  if (branchIds) tableConditions.push(inArray(restaurantTables.branchId, branchIds));

  const tableRows = await db
    .select({
      status: restaurantTables.status,
      count: sql<number>`count(*)`,
      seats: sql<number>`coalesce(sum(${restaurantTables.capacity}), 0)`,
    })
    .from(restaurantTables)
    .where(and(...tableConditions))
    .groupBy(restaurantTables.status);

  const tables = {
    total: 0,
    available: 0,
    occupied: 0,
    reserved: 0,
    unavailable: 0,
    seats: 0,
  };
  for (const row of tableRows) {
    const count = Number(row.count);
    tables.total += count;
    tables.seats += Number(row.seats);
    if (row.status === "available") tables.available += count;
    if (row.status === "occupied") tables.occupied += count;
    if (row.status === "reserved") tables.reserved += count;
    if (row.status === "unavailable") tables.unavailable += count;
  }

  const dayStart = startOfBusinessDay();
  const orderConditions: SQL[] = [gte(orders.createdAt, dayStart)];
  if (branchIds) orderConditions.push(inArray(orders.branchId, branchIds));

  const orderRows = await db
    .select({
      branchId: orders.branchId,
      orders: sql<number>`count(*)`,
      revenue: sql<number>`coalesce(sum(case when ${orders.status} = 'paid' then ${orders.total} else 0 end), 0)`,
      open: sql<number>`sum(case when ${orders.status} = 'pending' then 1 else 0 end)`,
    })
    .from(orders)
    .where(and(...orderConditions))
    .groupBy(orders.branchId);

  const orderByBranch = new Map(orderRows.map((row) => [row.branchId, row]));

  const reservationStats = await getReservationStats(scope, branchId);
  const perBranch = await Promise.all(
    branchRows.map(async (branch) => {
      const [soldOut] = await db
        .select({ count: sql<number>`count(distinct ${branchMenuItems.menuItemId})` })
        .from(branchMenuItems)
        .innerJoin(menuItems, eq(menuItems.id, branchMenuItems.menuItemId))
        .where(
          and(
            eq(branchMenuItems.branchId, branch.id),
            eq(branchMenuItems.isAvailable, false),
            eq(menuItems.isActive, true),
          ),
        );

      const [tableCount] = await db
        .select({
          total: sql<number>`count(*)`,
          available: sql<number>`sum(case when ${restaurantTables.status} = 'available' then 1 else 0 end)`,
          occupied: sql<number>`sum(case when ${restaurantTables.status} = 'occupied' then 1 else 0 end)`,
        })
        .from(restaurantTables)
        .where(
          and(
            eq(restaurantTables.branchId, branch.id),
            eq(restaurantTables.isActive, true),
          ),
        );

      const [reservationCount] = await db
        .select({
          today: sql<number>`sum(case when ${reservations.reservationDate} = ${todayKigali()} and ${reservations.status} != 'cancelled' then 1 else 0 end)`,
          pending: sql<number>`sum(case when ${reservations.status} = 'pending' then 1 else 0 end)`,
        })
        .from(reservations)
        .where(eq(reservations.branchId, branch.id));

      const performance = orderByBranch.get(branch.id);

      return {
        branchId: branch.id,
        branchCode: branch.code,
        branchName: branch.name,
        menuSoldOut: Number(soldOut?.count ?? 0),
        tables: Number(tableCount?.total ?? 0),
        tablesAvailable: Number(tableCount?.available ?? 0),
        tablesOccupied: Number(tableCount?.occupied ?? 0),
        reservationsToday: Number(reservationCount?.today ?? 0),
        pendingReservations: Number(reservationCount?.pending ?? 0),
        ordersToday: Number(performance?.orders ?? 0),
        revenueToday: Number(performance?.revenue ?? 0),
      };
    }),
  );

  const revenueToday = orderRows.reduce((sum, row) => sum + Number(row.revenue), 0);
  const ordersToday = orderRows.reduce((sum, row) => sum + Number(row.orders), 0);
  const openOrders = orderRows.reduce((sum, row) => sum + Number(row.open ?? 0), 0);

  const upcoming = await getUpcomingReservations(scope, 6, branchId);

  return {
    menu: {
      total,
      available: menuAvailable,
      unavailable: effectiveBranchId ? total - menuAvailable : total - active,
      featured,
    },
    tables,
    reservations: reservationStats,
    today: todayKigali(),
    branches: perBranch,
    upcoming,
    revenueToday,
    ordersToday,
    openOrders,
  };
}
