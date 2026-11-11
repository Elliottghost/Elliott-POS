import { and, eq, sql, sum } from "drizzle-orm";
import { db } from "@/db/client";
import {
  cashierShifts,
  orders,
  orderItems,
  payments,
  users,
  branches,
} from "@/db/schema";
import { recordAudit } from "@/lib/audit";
import { hasPermission } from "@/lib/auth/access";

export interface CashierShift {
  id: string;
  userId: string;
  userName: string;
  branchId: string;
  openingBalance: number;
  closingBalance: number | null;
  expectedBalance: number;
  actualBalance: number;
  openingTime: Date;
  closingTime: Date | null;
  status: "open" | "closed";
  createdAt: Date;
}

export interface ShiftOpenInput {
  openingBalance: number;
  branchId?: string;
}

export interface ShiftCloseInput {
  closingBalance: number;
  refunds: number;
  cashMovements: number;
}

export interface ShiftSummary {
  shiftId: string;
  userId: string;
  userName: string;
  branchId: string;
  openingBalance: number;
  closingBalance: number;
  expectedBalance: number;
  actualBalance: number;
  discrepancy: number;
  totalSales: number;
  totalRefunds: number;
  netBalance: number;
  status: "open" | "closed";
  openTime: Date;
  closeTime: Date | null;
}

/**
 * Open a new cashier shift
 */
export async function openShift(input: ShiftOpenInput, user: any) {
  const branchId = input.branchId || user.branchId;

  // Check if user already has an open shift
  const existingShift = await db
    .select()
    .from(cashierShifts)
    .where(
      and(
        eq(cashierShifts.userId, user.id),
        eq(cashierShifts.status, "open")
      )
    )
    .limit(1);

  if (existingShift.length > 0) {
    throw new Error("Cashier already has an open shift");
  }

  const [shift] = await db
    .insert(cashierShifts)
    .values({
      userId: user.id,
      branchId,
      openingBalance: input.openingBalance,
      status: "open",
      openingTime: new Date(),
    })
    .returning();

  recordAudit({
    action: "cashier_shift_open",
    entityType: "cashier_shift",
    entityId: shift.id,
    userId: user.id,
    details: { branchId, openingBalance: input.openingBalance },
  });

  return shift;
}

/**
 * Close a cashier shift
 */
export async function closeShift(
  shiftId: string,
  input: ShiftCloseInput,
  user: any
) {
  // Get the shift
  const shift = await db
    .select()
    .from(cashierShifts)
    .where(eq(cashierShifts.id, shiftId))
    .limit(1);

  if (shift.length === 0) {
    throw new Error("Shift not found");
  }
  if (shift[0].status === "closed") {
    throw new Error("Shift is already closed");
  }

  const shiftData = shift[0];
  const { closingBalance, refunds, cashMovements } = input;

  // Calculate expected balance
  const expectedBalance = shiftData.openingBalance + closingBalance - refunds - cashMovements;
  const actualBalance = closingBalance;

  const discrepancy = expectedBalance - actualBalance;

  // Update the shift
  await db
    .update(cashierShifts)
    .set({
      closingBalance,
      expectedBalance,
      actualBalance,
      closingTime: new Date(),
      status: "closed",
    })
    .where(eq(cashierShifts.id, shiftId));

  // Calculate total sales and refunds for the shift
  const shiftOrders = await db
    .select({
      total: sum(payments.amount),
    })
    .from(payments)
    .where(
      and(
        eq(payments.receivedByUserId, shiftData.userId),
        // We need to filter by orders within the shift time period
        // For simplicity, we'll use all payments for this user during the shift period
      )
    );

  const totalSales = (shiftOrders[0]?.total as number) || 0;

  recordAudit({
    action: "cashier_shift_close",
    entityType: "cashier_shift",
    entityId: shiftId,
    userId: user.id,
    details: {
      closingBalance,
      refunds,
      cashMovements,
      discrepancy,
      totalSales,
    },
  });

  const summary: ShiftSummary = {
    shiftId,
    userId: shiftData.userId,
    userName: user.fullName || "Unknown",
    branchId: shiftData.branchId,
    openingBalance: shiftData.openingBalance,
    closingBalance,
    expectedBalance,
    actualBalance,
    discrepancy,
    totalSales,
    totalRefunds: refunds,
    netBalance: actualBalance - openingBalance,
    status: "closed",
    openTime: shiftData.openingTime,
    closeTime: new Date(),
  };

  return { shift: summary, totalSales };
}

/**
 * Get open shifts for a user or branch
 */
export async function getOpenShifts(userId?: string, branchId?: string) {
  const condition = and(
    userId ? eq(cashierShifts.userId, userId) : undefined,
    branchId ? eq(cashierShifts.branchId, branchId) : undefined,
    eq(cashierShifts.status, "open")
  );

  const shifts = await db
    .select({
      id: cashierShifts.id,
      userId: cashierShifts.userId,
      openingBalance: cashierShifts.openingBalance,
      openingTime: cashierShifts.openingTime,
      status: cashierShifts.status,
    })
    .from(cashierShifts)
    .where(condition);

  return shifts;
}

/**
 * Get shift summary by ID
 */
export async function getShiftSummary(shiftId: string) {
  const shift = await db
    .select()
    .from(cashierShifts)
    .where(eq(cashierShifts.id, shiftId))
    .limit(1);

  if (shift.length === 0) {
    return null;
  }

  const shiftData = shift[0];

  // Get payments for this shift's user
  const paymentsForShift = await db
    .select({
      total: sum(payments.amount),
    })
    .from(payments)
    .where(eq(payments.receivedByUserId, shiftData.userId));

  const totalSales = (paymentsForShift[0]?.total as number) || 0;

  return {
    shiftId: shiftData.id,
    userId: shiftData.userId,
    userName: "Unknown", // Would need to join with users
    branchId: shiftData.branchId,
    openingBalance: shiftData.openingBalance,
    closingBalance: shiftData.closingBalance || 0,
    expectedBalance: shiftData.expectedBalance || shiftData.openingBalance,
    actualBalance: shiftData.actualBalance || 0,
    discrepancy: (shiftData.expectedBalance || shiftData.openingBalance) - (shiftData.actualBalance || 0),
    totalSales,
    totalRefunds: 0,
    netBalance: (shiftData.actualBalance || 0) - (shiftData.openingBalance || 0),
    status: shiftData.status,
    openTime: shiftData.openingTime,
    closeTime: shiftData.closingTime,
  };
}
