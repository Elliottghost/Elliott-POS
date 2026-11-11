import { and, desc, eq, gte, inArray, sql, type SQL } from "drizzle-orm";
import { db } from "@/db/client";
import { auditLogs, branches, orders, roles, users } from "@/db/schema";
import type { SessionUser } from "@/lib/auth/session";
import { branchScope } from "@/lib/auth/access";

const KIGALI_SQL_OFFSET = "+2 hours";

function scopeSql(scope: string[] | null): SQL | undefined {
  if (scope === null) return undefined;
  if (scope.length === 0) return sql`1 = 0`;
  return inArray(orders.branchId, scope);
}

export interface SalesSummary {
  revenueToday: number;
  ordersToday: number;
  paidOrdersToday: number;
  openOrders: number;
  cancelledOrdersToday: number;
  averageTicket: number;
}

export async function getSalesSummary(scope: string[] | null): Promise<SalesSummary> {
  const conditions: SQL[] = [
    sql`date(orders.created_at / 1000, 'unixepoch', ${KIGALI_SQL_OFFSET}) = date('now', ${KIGALI_SQL_OFFSET})`,
  ];
  const scoped = scopeSql(scope);
  if (scoped) conditions.push(scoped);

  const [row] = await db
    .select({
      revenueToday: sql<number>`coalesce(sum(case when orders.status = 'paid' then orders.total else 0 end), 0)`,
      ordersToday: sql<number>`count(*)`,
      paidOrdersToday: sql<number>`sum(case when orders.status = 'paid' then 1 else 0 end)`,
      openOrders: sql<number>`sum(case when orders.status in ('pending','preparing','ready','served') then 1 else 0 end)`,
      cancelledOrdersToday: sql<number>`sum(case when orders.status = 'cancelled' then 1 else 0 end)`,
    })
    .from(orders)
    .where(and(...conditions));

  const revenueToday = Number(row?.revenueToday ?? 0);
  const paidOrdersToday = Number(row?.paidOrdersToday ?? 0);

  return {
    revenueToday,
    ordersToday: Number(row?.ordersToday ?? 0),
    paidOrdersToday,
    openOrders: Number(row?.openOrders ?? 0),
    cancelledOrdersToday: Number(row?.cancelledOrdersToday ?? 0),
    averageTicket: paidOrdersToday > 0 ? Math.round(revenueToday / paidOrdersToday) : 0,
  };
}

export interface RevenuePoint {
  day: string;
  label: string;
  revenue: number;
  orders: number;
}

export async function getRevenueTrend(
  scope: string[] | null,
  days = 7,
): Promise<RevenuePoint[]> {
  const conditions: SQL[] = [
    gte(orders.createdAt, new Date(Date.now() - days * 24 * 60 * 60 * 1000)),
  ];
  const scoped = scopeSql(scope);
  if (scoped) conditions.push(scoped);

  const rows = await db
    .select({
      day: sql<string>`date(orders.created_at / 1000, 'unixepoch', ${KIGALI_SQL_OFFSET})`,
      revenue: sql<number>`coalesce(sum(case when orders.status = 'paid' then orders.total else 0 end), 0)`,
      orders: sql<number>`count(*)`,
    })
    .from(orders)
    .where(and(...conditions))
    .groupBy(sql`date(orders.created_at / 1000, 'unixepoch', ${KIGALI_SQL_OFFSET})`)
    .orderBy(sql`date(orders.created_at / 1000, 'unixepoch', ${KIGALI_SQL_OFFSET})`);

  const byDay = new Map(rows.map((row) => [row.day, row]));
  const points: RevenuePoint[] = [];

  const keyFormatter = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Africa/Kigali",
  });
  const labelFormatter = new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    timeZone: "Africa/Kigali",
  });

  for (let index = days - 1; index >= 0; index -= 1) {
    const date = new Date(Date.now() - index * 24 * 60 * 60 * 1000);
    const parts = keyFormatter.formatToParts(date);
    const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
    const key = `${get("year")}-${get("month")}-${get("day")}`;
    const row = byDay.get(key);
    points.push({
      day: key,
      label: labelFormatter.format(date),
      revenue: Number(row?.revenue ?? 0),
      orders: Number(row?.orders ?? 0),
    });
  }

  return points;
}

export async function getStaffSummary(scope: string[] | null) {
  const conditions: SQL[] = [];
  if (scope !== null) {
    if (scope.length === 0) return { total: 0, active: 0, byRole: [] as { roleName: string; roleLabel: string; count: number }[] };
    conditions.push(inArray(users.branchId, scope));
  }

  const [row] = await db
    .select({
      total: sql<number>`count(*)`,
      active: sql<number>`sum(case when ${users.isActive} = 1 then 1 else 0 end)`,
    })
    .from(users)
    .where(conditions.length ? and(...conditions) : undefined);

  const byRole = await db
    .select({
      roleName: roles.name,
      roleLabel: roles.label,
      count: sql<number>`count(*)`,
    })
    .from(users)
    .innerJoin(roles, eq(roles.id, users.roleId))
    .where(
      conditions.length
        ? and(...conditions, eq(users.isActive, true))
        : eq(users.isActive, true),
    )
    .groupBy(roles.name, roles.label, roles.rank)
    .orderBy(roles.rank);

  return {
    total: Number(row?.total ?? 0),
    active: Number(row?.active ?? 0),
    byRole: byRole.map((item) => ({ ...item, count: Number(item.count) })),
  };
}

export async function getBranchSummary(scope: string[] | null) {
  const conditions: SQL[] = [];
  if (scope !== null) {
    if (scope.length === 0) return { total: 0, active: 0, list: [] };
    conditions.push(inArray(branches.id, scope));
  }

  const rows = await db
    .select({
      id: branches.id,
      name: branches.name,
      code: branches.code,
      city: branches.city,
      isActive: branches.isActive,
      staffCount: sql<number>`(
        select count(*) from users
        where users.branch_id = branches.id and users.is_active = 1
      )`,
      revenueToday: sql<number>`coalesce((
        select sum(orders.total) from orders
        where orders.branch_id = branches.id
          and orders.status = 'paid'
          and date(orders.created_at / 1000, 'unixepoch', ${KIGALI_SQL_OFFSET}) = date('now', ${KIGALI_SQL_OFFSET})
      ), 0)`,
      ordersToday: sql<number>`(
        select count(*) from orders
        where orders.branch_id = branches.id
          and date(orders.created_at / 1000, 'unixepoch', ${KIGALI_SQL_OFFSET}) = date('now', ${KIGALI_SQL_OFFSET})
      )`,
    })
    .from(branches)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(branches.name);

  return {
    total: rows.length,
    active: rows.filter((row) => row.isActive).length,
    list: rows.map((row) => ({
      ...row,
      staffCount: Number(row.staffCount),
      revenueToday: Number(row.revenueToday),
      ordersToday: Number(row.ordersToday),
    })),
  };
}

export async function getRecentActivity(scope: string[] | null, limit = 8) {
  const conditions: SQL[] = [];
  if (scope !== null) {
    if (scope.length === 0) return [];
    conditions.push(inArray(auditLogs.branchId, scope));
  }

  return db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      description: auditLogs.description,
      actorName: auditLogs.actorName,
      entityType: auditLogs.entityType,
      branchName: branches.name,
      createdAt: auditLogs.createdAt,
    })
    .from(auditLogs)
    .leftJoin(branches, eq(branches.id, auditLogs.branchId))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit);
}

export async function getDashboardData(user: SessionUser) {
  const scope = branchScope(user);
  const [sales, trend, staff, branchSummary, activity] = await Promise.all([
    getSalesSummary(scope),
    getRevenueTrend(scope),
    getStaffSummary(scope),
    getBranchSummary(scope),
    getRecentActivity(scope),
  ]);

  return { sales, trend, staff, branchSummary, activity, scope };
}
