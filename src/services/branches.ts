import { and, asc, eq, inArray, ne, sql, type SQL } from "drizzle-orm";
import { db } from "@/db/client";
import { branches, orders, roles, users } from "@/db/schema";
import { recordAudit } from "@/lib/audit";
import type { RequestMeta, SessionUser } from "@/lib/auth/session";
import type { BranchInput } from "@/lib/validation";

export interface BranchListItem {
  id: string;
  name: string;
  slug: string;
  code: string;
  address: string;
  city: string;
  phone: string | null;
  email: string | null;
  openingTime: string;
  closingTime: string;
  isActive: boolean;
  staffCount: number;
  managerName: string | null;
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function scopeFilter(scope: string[] | null): SQL | undefined {
  if (scope === null) return undefined;
  if (scope.length === 0) return sql`1 = 0`;
  return inArray(branches.id, scope);
}

export async function listBranches(
  scope: string[] | null,
  options: { includeInactive?: boolean } = {},
): Promise<BranchListItem[]> {
  const conditions: SQL[] = [];
  const scoped = scopeFilter(scope);
  if (scoped) conditions.push(scoped);
  if (!options.includeInactive) conditions.push(eq(branches.isActive, true));

  const rows = await db
    .select({
      id: branches.id,
      name: branches.name,
      slug: branches.slug,
      code: branches.code,
      address: branches.address,
      city: branches.city,
      phone: branches.phone,
      email: branches.email,
      openingTime: branches.openingTime,
      closingTime: branches.closingTime,
      isActive: branches.isActive,
      staffCount: sql<number>`(
        select count(*) from users
        where users.branch_id = branches.id and users.is_active = 1
      )`,
      managerName: sql<string | null>`(
        select users.full_name from users
        inner join roles on roles.id = users.role_id
        where users.branch_id = branches.id
          and roles.name = 'branch_manager' and users.is_active = 1
        limit 1
      )`,
    })
    .from(branches)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(asc(branches.name));

  return rows;
}

export async function getBranchById(id: string) {
  const [row] = await db.select().from(branches).where(eq(branches.id, id)).limit(1);
  return row ?? null;
}

export async function getBranchOverview(branchId: string) {
  const [branch] = await db
    .select()
    .from(branches)
    .where(eq(branches.id, branchId))
    .limit(1);
  if (!branch) return null;

  const [staffAgg] = await db
    .select({
      total: sql<number>`count(*)`,
      active: sql<number>`sum(case when ${users.isActive} = 1 then 1 else 0 end)`,
    })
    .from(users)
    .where(eq(users.branchId, branchId));

  const [orderAgg] = await db
    .select({
      totalOrders: sql<number>`count(*)`,
      revenue: sql<number>`coalesce(sum(case when ${orders.status} = 'paid' then ${orders.total} else 0 end), 0)`,
    })
    .from(orders)
    .where(eq(orders.branchId, branchId));

  return {
    branch,
    staffTotal: Number(staffAgg?.total ?? 0),
    staffActive: Number(staffAgg?.active ?? 0),
    totalOrders: Number(orderAgg?.totalOrders ?? 0),
    revenue: Number(orderAgg?.revenue ?? 0),
  };
}

export type BranchServiceResult =
  | { ok: true; branchId: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export async function createBranch(
  actor: SessionUser,
  input: BranchInput,
  meta?: RequestMeta,
): Promise<BranchServiceResult> {
  const [existingCode] = await db
    .select({ id: branches.id })
    .from(branches)
    .where(eq(branches.code, input.code))
    .limit(1);

  if (existingCode) {
    return { ok: false, error: "That branch code is already in use.", fieldErrors: { code: ["Branch code must be unique."] } };
  }

  const baseSlug = slugify(input.name) || slugify(input.code);
  let slug = baseSlug;
  let attempt = 1;
  while (
    (await db.select({ id: branches.id }).from(branches).where(eq(branches.slug, slug)).limit(1)).length > 0
  ) {
    slug = `${baseSlug}-${++attempt}`;
  }

  const [created] = await db
    .insert(branches)
    .values({
      name: input.name,
      code: input.code,
      slug,
      address: input.address,
      city: input.city,
      phone: input.phone ?? null,
      email: input.email ?? null,
      openingTime: input.openingTime,
      closingTime: input.closingTime,
      isActive: input.isActive,
    })
    .returning({ id: branches.id });

  await recordAudit({
    actor,
    action: "branch.created",
    entityType: "branch",
    entityId: created.id,
    branchId: created.id,
    description: `Branch "${input.name}" (${input.code}) created.`,
    metadata: { name: input.name, code: input.code },
    meta,
  });

  return { ok: true, branchId: created.id };
}

export async function updateBranch(
  actor: SessionUser,
  branchId: string,
  input: BranchInput,
  meta?: RequestMeta,
): Promise<BranchServiceResult> {
  const existing = await getBranchById(branchId);
  if (!existing) return { ok: false, error: "Branch not found." };

  const [codeOwner] = await db
    .select({ id: branches.id })
    .from(branches)
    .where(and(eq(branches.code, input.code), ne(branches.id, branchId)))
    .limit(1);

  if (codeOwner) {
    return { ok: false, error: "That branch code is already in use.", fieldErrors: { code: ["Branch code must be unique."] } };
  }

  await db
    .update(branches)
    .set({
      name: input.name,
      code: input.code,
      address: input.address,
      city: input.city,
      phone: input.phone ?? null,
      email: input.email ?? null,
      openingTime: input.openingTime,
      closingTime: input.closingTime,
      isActive: input.isActive,
      updatedAt: new Date(),
    })
    .where(eq(branches.id, branchId));

  await recordAudit({
    actor,
    action: "branch.updated",
    entityType: "branch",
    entityId: branchId,
    branchId,
    description: `Branch "${input.name}" updated.`,
    metadata: {
      before: { name: existing.name, code: existing.code, isActive: existing.isActive },
      after: { name: input.name, code: input.code, isActive: input.isActive },
    },
    meta,
  });

  return { ok: true, branchId };
}
