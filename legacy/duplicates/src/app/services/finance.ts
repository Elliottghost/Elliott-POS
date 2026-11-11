import { and, asc, eq, sql, type SQL } from "drizzle-orm";
import { db } from "@/db/client";
import {
  incomeRecords,
  expenses,
  users,
  branches,
} from "@/db/schema";
import { recordAudit } from "@/lib/audit";
import { canAccessBranch } from "@/lib/auth/access";
import type { RequestMeta, SessionUser } from "@/lib/auth/session";

/** Income record row */
export interface IncomeRecordRow {
  id: string;
  source: string;
  referenceType: string | null;
  referenceId: string | null;
  amount: number;
  branchId: string | null;
  currency: string;
  recordedByName: string | null;
  description: string | null;
  date: string;
  createdAt: Date;
}

/** Expense row */
export interface ExpenseRow {
  id: string;
  description: string;
  category: string;
  amount: number;
  branchId: string | null;
  paymentMethod: string;
  date: string;
  recordedByName: string | null;
  receiptPath: string | null;
  isRecurring: boolean;
  createdAt: Date;
}

/** Income summary by branch */
export interface IncomeByBranch {
  branchId: string;
  branchName: string;
  totalIncome: number;
  transactionCount: number;
}

/** Category summary */
export interface IncomeByCategory {
  category: string;
  totalIncome: number;
  transactionCount: number;
}

/** Expense summary by branch */
export interface ExpenseByBranch {
  branchId: string;
  branchName: string;
  totalExpenses: number;
  transactionCount: number;
}

/** Expense summary by category */
export interface ExpenseByCategory {
  category: string;
  totalExpenses: number;
  transactionCount: number;
}

/** Daily cash reconciliation */
export interface DailyCashReconciliation {
  date: string;
  openingCash: number;
  cashSales: number;
  otherCashIncome: number;
  cashExpenses: number;
  refunds: number;
  expectedClosingCash: number;
  actualClosingCash: number;
  cashDifference: number;
}

/** List income records */
export async function listIncomeRecords(
  options: {
    branchId?: string;
    startDate?: string;
    endDate?: string;
    source?: string;
    includeInactive?: boolean;
  } = {},
): Promise<IncomeRecordRow[]> {
  const conditions: SQL[] = [];

  if (options.branchId) {
    conditions.push(eq(incomeRecords.branchId, options.branchId));
  }

  if (options.source) {
    conditions.push(eq(incomeRecords.source, options.source));
  }

  if (options.startDate) {
    conditions.push(sql`${incomeRecords.date} >= ${options.startDate}`);
  }

  if (options.endDate) {
    conditions.push(sql`${incomeRecords.date} <= ${options.endDate}`);
  }

  if (options.includeInactive === undefined) {
    conditions.push(eq(incomeRecords.isActive !== false)); // Will add if column exists
  }

  const rows = await db
    .select({
      id: incomeRecords.id,
      source: incomeRecords.source,
      referenceType: incomeRecords.referenceType,
      referenceId: incomeRecords.referenceId,
      amount: incomeRecords.amount,
      branchId: incomeRecords.branchId,
      currency: incomeRecords.currency,
      recordedByName: users.fullName,
      description: incomeRecords.description,
      date: incomeRecords.date,
      createdAt: incomeRecords.createdAt,
    })
    .from(incomeRecords)
    .leftJoin(users, eq(users.id, incomeRecords.recordedByUserId))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(incomeRecords.createdAt));

  return rows.map((row) => ({
    ...row,
    createdAt: row.createdAt ? new Date(row.createdAt) : new Date(),
  }));
}

/** List expenses */
export async function listExpenses(
  options: {
    branchId?: string;
    startDate?: string;
    endDate?: string;
    category?: string;
    includeInactive?: boolean;
  } = {},
): Promise<ExpenseRow[]> {
  const conditions: SQL[] = [];

  if (options.branchId) {
    conditions.push(eq(expenses.branchId, options.branchId));
  }

  if (options.category) {
    conditions.push(eq(expenses.category, options.category));
  }

  if (options.startDate) {
    conditions.push(sql`${expenses.date} >= ${options.startDate}`);
  }

  if (options.endDate) {
    conditions.push(sql`${expenses.date} <= ${options.endDate}`);
  }

  const rows = await db
    .select({
      id: expenses.id,
      description: expenses.description,
      category: expenses.category,
      amount: expenses.amount,
      branchId: expenses.branchId,
      paymentMethod: expenses.paymentMethod,
      date: expenses.date,
      recordedByName: users.fullName,
      receiptPath: expenses.receiptPath,
      isRecurring: expenses.isRecurring,
      createdAt: expenses.createdAt,
    })
    .from(expenses)
    .leftJoin(users, eq(users.id, expenses.recordedByUserId))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(expenses.createdAt));

  return rows.map((row) => ({
    ...row,
    createdAt: row.createdAt ? new Date(row.createdAt) : new Date(),
  }));
}

/** Record income */
export async function recordIncome(
  actor: SessionUser,
  input: {
    source: string;
    referenceType?: string;
    referenceId?: string;
    amount: number;
    branchId: string;
    currency?: string;
    description?: string;
  },
  meta?: RequestMeta,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  // Validate branch access
  if (!canAccessBranch(actor, input.branchId)) {
    return { ok: false, error: "You can only record income for your assigned branch." };
  }

  const [created] = await db
    .insert(incomeRecords)
    .values({
      source: input.source,
      referenceType: input.referenceType ?? null,
      referenceId: input.referenceId ?? null,
      amount: input.amount,
      branchId: input.branchId,
      currency: input.currency ?? "RWF",
      description: input.description ?? null,
      recordedByUserId: actor.id,
    })
    .returning({ id: incomeRecords.id });

  await recordAudit({
    actor,
    action: "finance.income_recorded",
    entityType: "income_record",
    entityId: created.id,
    branchId: input.branchId,
    description: `Income recorded: ${input.source} - ${input.amount} ${input.currency ?? "RWF"}.`,
    metadata: {
      source: input.source,
      amount: input.amount,
      currency: input.currency ?? "RWF",
      branchId: input.branchId,
    },
    meta,
  });

  return { ok: true, id: created.id };
}

/** Record expense */
export async function recordExpense(
  actor: SessionUser,
  input: {
    description: string;
    category: string;
    amount: number;
    branchId: string;
    paymentMethod?: string;
    date?: string;
    receiptPath?: string;
  },
  meta?: RequestMeta,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  // Validate branch access
  if (!canAccessBranch(actor, input.branchId)) {
    return { ok: false, error: "You can only record expenses for your assigned branch." };
  }

  if (input.amount <= 0) {
    return { ok: false, error: "Amount must be greater than zero." };
  }

  const [created] = await db
    .insert(expenses)
    .values({
      description: input.description,
      category: input.category,
      amount: input.amount,
      branchId: input.branchId,
      paymentMethod: input.paymentMethod ?? "cash",
      date: input.date ?? new Date().toISOString().split("T")[0],
      recordedByUserId: actor.id,
      receiptPath: input.receiptPath ?? null,
      isRecurring: false,
    })
    .returning({ id: expenses.id });

  await recordAudit({
    actor,
    action: "finance.expense_recorded",
    entityType: "expense_record",
    entityId: created.id,
    branchId: input.branchId,
    description: `Expense recorded: ${input.description} - ${input.amount} ${input.currency ?? "RWF"}.`,
    metadata: {
      description: input.description,
      category: input.category,
      amount: input.amount,
      paymentMethod: input.paymentMethod ?? "cash",
      branchId: input.branchId,
    },
    meta,
  });

  return { ok: true, id: created.id };
}

/** Get daily cash reconciliation */
export async function getDailyCashReconciliation(
  date: string,
  branchId: string,
): Promise<DailyCashReconciliation> {
  // Opening cash from the current cashier shift
  const [currentShift] = await db
    .select({
      openingBalance: cashierShifts.openingBalance,
      expectedBalance: cashierShifts.expectedBalance,
      actualBalance: cashierShifts.actualBalance,
    })
    .from(cashierShifts)
    .where(and(eq(cashierShifts.branchId ?? "", branchId), eq(cashierShifts.status, "open")))
    .limit(1);

  // Cash sales from income records (restaurant_sales + bar_sales + takeaway_sales + online_orders)
  const [salesSummary] = await db
    .select({
      total: sql<number>`coalesce(sum(case when ${incomeRecords.source} in ('restaurant_sales', 'bar_sales', 'takeaway_sales', 'online_orders') then ${incomeRecords.amount} else 0 end), 0)`,
      count: sql<number>`coalesce(count(${incomeRecords.id}), 0)`,
    })
    .from(incomeRecords)
    .where(
      and(
        eq(incomeRecords.branchId, branchId),
        sql`${incomeRecords.date} = ${date}`,
        sql`${incomeRecords.source} in ('restaurant_sales', 'bar_sales', 'takeaway_sales', 'online_orders')`,
      ),
    );

  // Other cash income (from other sources)
  const [otherIncome] = await db
    .select({
      total: sql<number>`coalesce(sum(case when ${incomeRecords.source} != 'restaurant_sales' and ${incomeRecords.source} != 'bar_sales' and ${incomeRecords.source} != 'takeaway_sales' and ${incomeRecords.source} != 'online_orders' and ${incomeRecords.source} like 'cash%' then ${incomeRecords.amount} else 0 end), 0)`,
    })
    .from(incomeRecords)
    .where(
      and(
        eq(incomeRecords.branchId, branchId),
        sql`${incomeRecords.date} = ${date}`,
      ),
    );

  // Cash expenses
  const [cashExpensesSummary] = await db
    .select({
      total: sql<number>`coalesce(sum(case when ${expenses.paymentMethod} = 'cash' then ${expenses.amount} else 0 end), 0)`,
      count: sql<number>`coalesce(count(${expenses.id}), 0)`,
    })
    .from(expenses)
    .where(
      and(
        eq(expenses.branchId, branchId),
        sql`${expenses.date} = ${date}`,
        sql`${expenses.paymentMethod} = 'cash'`,
      ),
    );

  // Calculate reconciliation
  const opening = currentShift?.openingBalance ?? 0;
  const cashSales = Number(salesSummary?.total ?? 0);
  const otherCashIncome = Number(otherIncome?.total ?? 0);
  const cashExpenses = Number(cashExpensesSummary?.total ?? 0);
  const refunds = 0; // Would need separate refund tracking
  const expectedClosing = opening + cashSales + otherCashIncome - cashExpenses - refunds;

  // Actual closing cash would come from the shift closing
  const actualClosing = currentShift?.actualBalance ?? opening; // Fallback to opening if shift not closed

  const cashDifference = actualClosing - expectedClosing;

  return {
    date,
    openingCash: opening,
    cashSales,
    otherCashIncome,
    cashExpenses,
    refunds,
    expectedClosingCash: expectedClosing,
    actualClosingCash: actualClosing,
    cashDifference,
  };
}

/** Get income by branch */
export async function getIncomeByBranch(
  startDate?: string,
  endDate?: string,
): Promise<IncomeByBranch[]> {
  const conditions: SQL[] = [];

  if (startDate) {
    conditions.push(sql`${incomeRecords.date} >= ${startDate}`);
  }

  if (endDate) {
    conditions.push(sql`${incomeRecords.date} <= ${endDate}`);
  }

  const rows = await db
    .select({
      branchId: incomeRecords.branchId,
      branchName: branches.name,
      totalIncome: sql<number>`coalesce(sum(${incomeRecords.amount}), 0)`,
      transactionCount: sql<number>`coalesce(count(${incomeRecords.id}), 0)`,
    })
    .from(incomeRecords)
    .leftJoin(branches, eq(branches.id, incomeRecords.branchId))
    .where(conditions.length ? and(...conditions) : undefined)
    .groupBy(incomeRecords.branchId, branches.name)
    .orderBy(desc(totalIncome));

  return rows.map((row) => ({
    branchId: row.branchId,
    branchName: row.branchName ?? "Branch " + row.branchId,
    totalIncome: Number(row.totalIncome),
    transactionCount: Number(row.transactionCount),
  }));
}

/** Get income by category (source) */
export async function getIncomeByCategory(
  startDate?: string,
  endDate?: string,
): Promise<IncomeByCategory[]> {
  const conditions: SQL[] = [];

  if (startDate) {
    conditions.push(sql`${incomeRecords.date} >= ${startDate}`);
  }

  if (endDate) {
    conditions.push(sql`${incomeRecords.date} <= ${endDate}`);
  }

  const rows = await db
    .select({
      source: incomeRecords.source,
      totalIncome: sql<number>`coalesce(sum(${incomeRecords.amount}), 0)`,
      transactionCount: sql<number>`coalesce(count(${incomeRecords.id}), 0)`,
    })
    .from(incomeRecords)
    .where(conditions.length ? and(...conditions) : undefined)
    .groupBy(incomeRecords.source)
    .orderBy(desc(totalIncome));

  return rows.map((row) => ({
    category: row.source,
    totalIncome: Number(row.totalIncome),
    transactionCount: Number(row.transactionCount),
  }));
}

/** Get expenses by branch */
export async function getExpensesByBranch(
  startDate?: string,
  endDate?: string,
): Promise<ExpenseByBranch[]> {
  const conditions: SQL[] = [];

  if (startDate) {
    conditions.push(sql`${expenses.date} >= ${startDate}`);
  }

  if (endDate) {
    conditions.push(sql`${expenses.date} <= ${endDate}`);
  }

  const rows = await db
    .select({
      branchId: expenses.branchId,
      branchName: branches.name,
      totalExpenses: sql<number>`coalesce(sum(${expenses.amount}), 0)`,
      transactionCount: sql<number>`coalesce(count(${expenses.id}), 0)`,
    })
    .from(expenses)
    .leftJoin(branches, eq(branches.id, expenses.branchId))
    .where(conditions.length ? and(...conditions) : undefined)
    .groupBy(expenses.branchId, branches.name)
    .orderBy(desc(totalExpenses));

  return rows.map((row) => ({
    branchId: row.branchId,
    branchName: row.branchName ?? "Branch " + row.branchId,
    totalExpenses: Number(row.totalExpenses),
    transactionCount: Number(row.transactionCount),
  }));
}

/** Get expenses by category */
export async function getExpensesByCategory(
  startDate?: string,
  endDate?: string,
): Promise<ExpenseByCategory[]> {
  const conditions: SQL[] = [];

  if (startDate) {
    conditions.push(sql`${expenses.date} >= ${startDate}`);
  }

  if (endDate) {
    conditions.push(sql`${expenses.date} <= ${endDate}`);
  }

  const rows = await db
    .select({
      category: expenses.category,
      totalExpenses: sql<number>`coalesce(sum(${expenses.amount}), 0)`,
      transactionCount: sql<number>`coalesce(count(${expenses.id}), 0)`,
    })
    .from(expenses)
    .where(conditions.length ? and(...conditions) : undefined)
    .groupBy(expenses.category)
    .orderBy(desc(totalExpenses));

  return rows.map((row) => ({
    category: row.category,
    totalExpenses: Number(row.totalExpenses),
    transactionCount: Number(row.transactionCount),
  }));
}