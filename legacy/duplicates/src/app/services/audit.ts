import { and, desc, eq, gte, inArray, like, lte, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db/client";
import { auditLogs, branches, users } from "@/db/schema";

export interface AuditFilters {
  search?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  branchId?: string;
  from?: string;
  to?: string;
  limit?: number;
}

export async function listAuditLogs(scope: string[] | null, filters: AuditFilters = {}) {
  const conditions: SQL[] = [];

  if (scope !== null) {
    if (scope.length === 0) return [];
    conditions.push(inArray(auditLogs.branchId, scope));
  }
  if (filters.search) {
    const term = `%${filters.search.trim()}%`;
    const search = or(
      like(auditLogs.description, term),
      like(auditLogs.actorName, term),
      like(auditLogs.actorEmail, term),
      like(auditLogs.action, term),
    );
    if (search) conditions.push(search);
  }
  if (filters.action) conditions.push(eq(auditLogs.action, filters.action));
  if (filters.entityType) conditions.push(eq(auditLogs.entityType, filters.entityType));
  if (filters.entityId) conditions.push(eq(auditLogs.entityId, filters.entityId));
  if (filters.branchId) conditions.push(eq(auditLogs.branchId, filters.branchId));
  if (filters.from) conditions.push(gte(auditLogs.createdAt, new Date(filters.from)));
  if (filters.to) conditions.push(lte(auditLogs.createdAt, new Date(`${filters.to}T23:59:59`)));

  return db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      entityType: auditLogs.entityType,
      entityId: auditLogs.entityId,
      description: auditLogs.description,
      actorName: auditLogs.actorName,
      actorEmail: auditLogs.actorEmail,
      branchName: branches.name,
      ipAddress: auditLogs.ipAddress,
      createdAt: auditLogs.createdAt,
    })
    .from(auditLogs)
    .leftJoin(branches, eq(branches.id, auditLogs.branchId))
    .leftJoin(users, eq(users.id, auditLogs.actorUserId))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(auditLogs.createdAt))
    .limit(filters.limit ?? 100);
}

export async function listAuditActions() {
  const rows = await db
    .select({ action: auditLogs.action, count: sql<number>`count(*)` })
    .from(auditLogs)
    .groupBy(auditLogs.action)
    .orderBy(desc(sql`count(*)`));
  return rows.map((row) => ({ ...row, count: Number(row.count) }));
}
