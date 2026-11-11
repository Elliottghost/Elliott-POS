import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { expenses, users, branches } from "@/db/schema";
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
      id: expenses.id,
      description: expenses.description,
      category: expenses.category,
      amount: expenses.amount,
      paymentMethod: expenses.paymentMethod,
      date: expenses.date,
      recordedByName: users.fullName,
      receiptPath: expenses.receiptPath,
      isRecurring: expenses.isRecurring,
    })
    .from(expenses)
    .leftJoin(users, eq(users.id, expenses.recordedByUserId))
    .where(eq(expenses.branchId, branchId))
    .orderBy(desc(expenses.createdAt));

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
  const result = await recordExpense(
    user,
    {
      description: body.description,
      category: body.category,
      amount: body.amount,
      branchId,
      paymentMethod: body.paymentMethod,
      date: body.date,
      receiptPath: body.receiptPath,
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