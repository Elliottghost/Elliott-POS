import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { incomeRecords, users, branches } from "@/db/schema";
import { recordAudit } from "@/lib/audit";
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

  const rows = await db
    .select({
      id: incomeRecords.id,
      source: incomeRecords.source,
      referenceType: incomeRecords.referenceType,
      referenceId: incomeRecords.referenceId,
      amount: incomeRecords.amount,
      currency: incomeRecords.currency,
      description: incomeRecords.description,
      date: incomeRecords.date,
      recordedByName: users.fullName,
    })
    .from(incomeRecords)
    .leftJoin(users, eq(users.id, incomeRecords.recordedByUserId))
    .where(eq(incomeRecords.branchId, branchId))
    .orderBy(desc(incomeRecords.createdAt));

  return new Response(JSON.stringify(rows), {
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
  const result = await recordIncome(
    user,
    {
      source: body.source,
      referenceType: body.referenceType,
      referenceId: body.referenceId,
      amount: body.amount,
      branchId,
      currency: body.currency,
      description: body.description,
    },
    {},
  );

  if (!result.ok) {
    const status = 400;
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