import { and, asc, eq, gt, inArray, like, ne, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db/client";
import {
  branches,
  reservations,
  restaurantTables,
  users,
} from "@/db/schema";
import { recordAudit } from "@/lib/audit";
import { canAccessBranch } from "@/lib/auth/access";
import type { RequestMeta, SessionUser } from "@/lib/auth/session";
import {
  addMinutesToTime,
  minutesFromTime,
  todayKigali,
} from "@/lib/format";
import type { ReservationInput } from "@/lib/validation";

export const BLOCKING_STATUSES = ["pending", "confirmed", "seated"] as const;

export interface ReservationRow {
  id: string;
  branchId: string;
  branchName: string;
  branchCode: string;
  tableId: string | null;
  tableCode: string | null;
  tableSection: string | null;
  customerName: string;
  customerPhone: string;
  reservationDate: string;
  startTime: string;
  durationMinutes: number;
  guestCount: number;
  status: string;
  specialRequests: string | null;
  createdAt: Date;
}

export type ReservationServiceResult =
  | { ok: true; id: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

function timeRange(start: string, duration: number) {
  const from = minutesFromTime(start);
  return { from, to: from + duration };
}

function overlaps(
  aStart: string,
  aDuration: number,
  bStart: string,
  bDuration: number,
) {
  const a = timeRange(aStart, aDuration);
  const b = timeRange(bStart, bDuration);
  return a.from < b.to && b.from < a.to;
}

export async function listReservations(
  scope: string[] | null,
  filters: {
    branchId?: string;
    date?: string;
    status?: string;
    search?: string;
    limit?: number;
  } = {},
): Promise<ReservationRow[]> {
  const conditions: SQL[] = [];

  if (filters.branchId) conditions.push(eq(reservations.branchId, filters.branchId));
  else if (scope !== null) {
    if (scope.length === 0) return [];
    conditions.push(inArray(reservations.branchId, scope));
  }

  if (filters.date) conditions.push(eq(reservations.reservationDate, filters.date));
  if (filters.status && filters.status !== "all") {
    conditions.push(eq(reservations.status, filters.status));
  }

  if (filters.search) {
    const term = `%${filters.search.trim().toLowerCase()}%`;
    const search = or(
      like(sql`lower(${reservations.customerName})`, term),
      like(sql`lower(${reservations.customerPhone})`, term),
      like(sql`lower(coalesce(${restaurantTables.code}, ''))`, term),
    );
    if (search) conditions.push(search);
  }

  const rows = await db
    .select({
      id: reservations.id,
      branchId: reservations.branchId,
      branchName: branches.name,
      branchCode: branches.code,
      tableId: reservations.tableId,
      tableCode: restaurantTables.code,
      tableSection: restaurantTables.section,
      customerName: reservations.customerName,
      customerPhone: reservations.customerPhone,
      reservationDate: reservations.reservationDate,
      startTime: reservations.startTime,
      durationMinutes: reservations.durationMinutes,
      guestCount: reservations.guestCount,
      status: reservations.status,
      specialRequests: reservations.specialRequests,
      createdAt: reservations.createdAt,
    })
    .from(reservations)
    .innerJoin(branches, eq(branches.id, reservations.branchId))
    .leftJoin(restaurantTables, eq(restaurantTables.id, reservations.tableId))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(asc(reservations.reservationDate), asc(reservations.startTime))
    .limit(Math.min(filters.limit ?? 200, 400));

  return rows;
}

export async function getReservationById(id: string) {
  const [row] = await db
    .select({
      reservation: reservations,
      branchName: branches.name,
      branchCode: branches.code,
      branchSlug: branches.slug,
      tableCode: restaurantTables.code,
      tableSection: restaurantTables.section,
      tableCapacity: restaurantTables.capacity,
      createdByName: users.fullName,
    })
    .from(reservations)
    .innerJoin(branches, eq(branches.id, reservations.branchId))
    .leftJoin(restaurantTables, eq(restaurantTables.id, reservations.tableId))
    .leftJoin(users, eq(users.id, reservations.createdByUserId))
    .where(eq(reservations.id, id))
    .limit(1);
  return row ?? null;
}

/** Reservations that already hold the table during the requested window. */
export async function findTableConflicts(input: {
  tableId: string;
  reservationDate: string;
  startTime: string;
  durationMinutes: number;
  excludeReservationId?: string;
}) {
  const conditions: SQL[] = [
    eq(reservations.tableId, input.tableId),
    eq(reservations.reservationDate, input.reservationDate),
    inArray(reservations.status, [...BLOCKING_STATUSES]),
  ];

  if (input.excludeReservationId) {
    conditions.push(ne(reservations.id, input.excludeReservationId));
  }

  const rows = await db
    .select({
      id: reservations.id,
      customerName: reservations.customerName,
      startTime: reservations.startTime,
      durationMinutes: reservations.durationMinutes,
      status: reservations.status,
    })
    .from(reservations)
    .where(and(...conditions));

  return rows.filter((row) =>
    overlaps(
      input.startTime,
      input.durationMinutes,
      row.startTime,
      row.durationMinutes,
    ),
  );
}

async function validateReservation(
  actor: SessionUser,
  input: ReservationInput,
  excludeReservationId?: string,
): Promise<{ ok: true } | { ok: false; error: string; fieldErrors?: Record<string, string[]> }> {
  if (!canAccessBranch(actor, input.branchId)) {
    return {
      ok: false,
      error: "You can only manage reservations for your own branch.",
    };
  }

  const [branch] = await db
    .select({ id: branches.id, isActive: branches.isActive })
    .from(branches)
    .where(eq(branches.id, input.branchId))
    .limit(1);

  if (!branch) return { ok: false, error: "Branch not found." };
  if (!branch.isActive) return { ok: false, error: "This branch is closed." };

  if (
    (input.status === "pending" || input.status === "confirmed") &&
    input.reservationDate < todayKigali()
  ) {
    return {
      ok: false,
      error: "A new reservation cannot be booked in the past.",
      fieldErrors: { reservationDate: ["Choose today or a future date."] },
    };
  }

  if (input.tableId) {
    const [table] = await db
      .select()
      .from(restaurantTables)
      .where(eq(restaurantTables.id, input.tableId))
      .limit(1);

    if (!table) {
      return {
        ok: false,
        error: "Choose a table from this branch.",
        fieldErrors: { tableId: ["Table not found."] },
      };
    }
    if (table.branchId !== input.branchId) {
      return {
        ok: false,
        error: "That table belongs to another branch.",
        fieldErrors: { tableId: ["Choose a table from this branch."] },
      };
    }
    if (!table.isActive) {
      return {
        ok: false,
        error: "That table is out of service.",
        fieldErrors: { tableId: ["Choose an active table."] },
      };
    }
    if (input.guestCount > table.capacity) {
      return {
        ok: false,
        error: `Table ${table.code} seats ${table.capacity} guests. Choose a larger table or split the party.`,
        fieldErrors: { tableId: [`Maximum ${table.capacity} guests at this table.`] },
      };
    }

    const conflicts = await findTableConflicts({
      tableId: input.tableId,
      reservationDate: input.reservationDate,
      startTime: input.startTime,
      durationMinutes: input.durationMinutes,
      excludeReservationId,
    });

    if (conflicts.length > 0) {
      const conflict = conflicts[0];
      const end = addMinutesToTime(conflict.startTime, conflict.durationMinutes);
      return {
        ok: false,
        error: `Table ${table.code} is already booked ${conflict.startTime}–${end} for ${conflict.customerName}. Choose another time or table.`,
        fieldErrors: {
          tableId: ["That table is taken during this time."],
          startTime: [`Clashes with a ${conflict.startTime}–${end} booking.`],
        },
      };
    }
  }

  return { ok: true };
}

export async function createReservation(
  actor: SessionUser,
  input: ReservationInput,
  meta?: RequestMeta,
): Promise<ReservationServiceResult> {
  const valid = await validateReservation(actor, input);
  if (!valid.ok) return valid;

  const [created] = await db
    .insert(reservations)
    .values({
      branchId: input.branchId,
      tableId: input.tableId ?? null,
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      reservationDate: input.reservationDate,
      startTime: input.startTime,
      durationMinutes: input.durationMinutes,
      guestCount: input.guestCount,
      status: input.status,
      specialRequests: input.specialRequests ?? null,
      createdByUserId: actor.id,
      updatedByUserId: actor.id,
      confirmedAt: input.status === "confirmed" ? new Date() : null,
    })
    .returning({ id: reservations.id });

  if (input.tableId && input.status === "seated") {
    await db
      .update(restaurantTables)
      .set({ status: "occupied", updatedAt: new Date() })
      .where(eq(restaurantTables.id, input.tableId));
  }

  await recordAudit({
    actor,
    action: "reservation.created",
    entityType: "reservation",
    entityId: created.id,
    branchId: input.branchId,
    description: `Reservation for ${input.customerName} on ${input.reservationDate} at ${input.startTime} (${input.guestCount} guests).`,
    metadata: {
      customerName: input.customerName,
      date: input.reservationDate,
      time: input.startTime,
      status: input.status,
      tableId: input.tableId ?? null,
    },
    meta,
  });

  return { ok: true, id: created.id };
}

export async function updateReservation(
  actor: SessionUser,
  reservationId: string,
  input: ReservationInput,
  meta?: RequestMeta,
): Promise<ReservationServiceResult> {
  const existing = await getReservationById(reservationId);
  if (!existing) return { ok: false, error: "Reservation not found." };
  if (!canAccessBranch(actor, existing.reservation.branchId)) {
    return { ok: false, error: "This reservation belongs to another branch." };
  }
  if (input.branchId !== existing.reservation.branchId) {
    return { ok: false, error: "Reservations cannot be moved to another branch." };
  }

  const valid = await validateReservation(actor, input, reservationId);
  if (!valid.ok) return valid;

  await db
    .update(reservations)
    .set({
      tableId: input.tableId ?? null,
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      reservationDate: input.reservationDate,
      startTime: input.startTime,
      durationMinutes: input.durationMinutes,
      guestCount: input.guestCount,
      status: input.status,
      specialRequests: input.specialRequests ?? null,
      updatedByUserId: actor.id,
      updatedAt: new Date(),
      confirmedAt:
        input.status === "confirmed" && !existing.reservation.confirmedAt
          ? new Date()
          : existing.reservation.confirmedAt,
      cancellationReason:
        input.status === "cancelled"
          ? existing.reservation.cancellationReason
          : null,
    })
    .where(eq(reservations.id, reservationId));

  await recordAudit({
    actor,
    action: "reservation.updated",
    entityType: "reservation",
    entityId: reservationId,
    branchId: existing.reservation.branchId,
    description: `Reservation for ${input.customerName} updated.`,
    metadata: {
      before: {
        date: existing.reservation.reservationDate,
        time: existing.reservation.startTime,
        status: existing.reservation.status,
        tableId: existing.reservation.tableId,
      },
      after: {
        date: input.reservationDate,
        time: input.startTime,
        status: input.status,
        tableId: input.tableId ?? null,
      },
    },
    meta,
  });

  return { ok: true, id: reservationId };
}

const TERMINAL_STATUSES = ["completed", "cancelled", "no_show"];

export async function setReservationStatus(
  actor: SessionUser,
  reservationId: string,
  status: string,
  cancellationReason: string | null,
  meta?: RequestMeta,
): Promise<ReservationServiceResult> {
  const existing = await getReservationById(reservationId);
  if (!existing) return { ok: false, error: "Reservation not found." };
  if (!canAccessBranch(actor, existing.reservation.branchId)) {
    return { ok: false, error: "This reservation belongs to another branch." };
  }

  const current = existing.reservation.status;
  if (current === status) {
    return { ok: false, error: "That reservation is already in this state." };
  }

  if (TERMINAL_STATUSES.includes(current) && status === "seated") {
    return {
      ok: false,
      error: "Reopen the reservation before seating the guests.",
    };
  }

  if (status === "seated" && existing.reservation.tableId) {
    const conflicts = await findTableConflicts({
      tableId: existing.reservation.tableId,
      reservationDate: existing.reservation.reservationDate,
      startTime: existing.reservation.startTime,
      durationMinutes: existing.reservation.durationMinutes,
      excludeReservationId: reservationId,
    });
    if (conflicts.length > 0) {
      return {
        ok: false,
        error: "Another confirmed booking holds this table. Move the reservation first.",
      };
    }
  }

  const reason = status === "cancelled" ? cancellationReason?.trim() || null : null;

  await db
    .update(reservations)
    .set({
      status,
      cancellationReason: reason ?? (status === "cancelled" ? undefined : null),
      updatedByUserId: actor.id,
      updatedAt: new Date(),
      confirmedAt:
        status === "confirmed" && !existing.reservation.confirmedAt
          ? new Date()
          : existing.reservation.confirmedAt,
    })
    .where(eq(reservations.id, reservationId));

  if (existing.reservation.tableId) {
    if (status === "seated") {
      await db
        .update(restaurantTables)
        .set({ status: "occupied", updatedAt: new Date() })
        .where(eq(restaurantTables.id, existing.reservation.tableId));
    } else if (TERMINAL_STATUSES.includes(status)) {
      const [remaining] = await db
        .select({ count: sql<number>`count(*)` })
        .from(reservations)
        .where(
          and(
            eq(reservations.tableId, existing.reservation.tableId),
            eq(reservations.reservationDate, existing.reservation.reservationDate),
            eq(reservations.status, "seated"),
          ),
        );

      if (Number(remaining?.count ?? 0) === 0) {
        const [table] = await db
          .select({ id: restaurantTables.id, status: restaurantTables.status })
          .from(restaurantTables)
          .where(eq(restaurantTables.id, existing.reservation.tableId))
          .limit(1);

        if (table && table.status === "occupied") {
          await db
            .update(restaurantTables)
            .set({ status: "available", updatedAt: new Date() })
            .where(eq(restaurantTables.id, table.id));
        }
      }
    }
  }

  await recordAudit({
    actor,
    action: "reservation.status_changed",
    entityType: "reservation",
    entityId: reservationId,
    branchId: existing.reservation.branchId,
    description: `Reservation for ${existing.reservation.customerName} marked ${status.replace("_", " ")}${reason ? ` — ${reason}` : ""}.`,
    metadata: { before: current, after: status, reason },
    meta,
  });

  return { ok: true, id: reservationId };
}

/** Tables for a branch with the bookings already holding them that day. */
export async function getTablePlan(branchId: string, date: string) {
  const tables = await db
    .select({
      id: restaurantTables.id,
      code: restaurantTables.code,
      name: restaurantTables.name,
      capacity: restaurantTables.capacity,
      section: restaurantTables.section,
      status: restaurantTables.status,
    })
    .from(restaurantTables)
    .where(
      and(
        eq(restaurantTables.branchId, branchId),
        eq(restaurantTables.isActive, true),
      ),
    )
    .orderBy(asc(restaurantTables.section), asc(restaurantTables.code));

  const bookings = await db
    .select({
      tableId: reservations.tableId,
      startTime: reservations.startTime,
      durationMinutes: reservations.durationMinutes,
      customerName: reservations.customerName,
      status: reservations.status,
    })
    .from(reservations)
    .where(
      and(
        eq(reservations.branchId, branchId),
        eq(reservations.reservationDate, date),
        inArray(reservations.status, [...BLOCKING_STATUSES]),
      ),
    )
    .orderBy(asc(reservations.startTime));

  return tables.map((table) => ({
    ...table,
    bookings: bookings
      .filter((booking) => booking.tableId === table.id)
      .map((booking) => ({
        ...booking,
        endTime: addMinutesToTime(booking.startTime, booking.durationMinutes),
      })),
  }));
}

export interface ReservationStats {
  today: number;
  pending: number;
  confirmedToday: number;
  upcomingGuests: number;
  seated: number;
}

export async function getReservationStats(
  scope: string[] | null,
  branchId?: string,
): Promise<ReservationStats> {
  const base: SQL[] = [];
  if (branchId) base.push(eq(reservations.branchId, branchId));
  else if (scope !== null) {
    if (scope.length === 0) {
      return { today: 0, pending: 0, confirmedToday: 0, upcomingGuests: 0, seated: 0 };
    }
    base.push(inArray(reservations.branchId, scope));
  }

  const today = todayKigali();

  const [row] = await db
    .select({
      today: sql<number>`sum(case when reservation_date = ${today} and status not in ('cancelled') then 1 else 0 end)`,
      pending: sql<number>`sum(case when status = 'pending' then 1 else 0 end)`,
      confirmedToday: sql<number>`sum(case when reservation_date = ${today} and status = 'confirmed' then 1 else 0 end)`,
      upcomingGuests: sql<number>`sum(case when reservation_date >= ${today} and status in ('pending','confirmed') then guest_count else 0 end)`,
      seated: sql<number>`sum(case when status = 'seated' then 1 else 0 end)`,
    })
    .from(reservations)
    .where(base.length ? and(...base) : undefined);

  return {
    today: Number(row?.today ?? 0),
    pending: Number(row?.pending ?? 0),
    confirmedToday: Number(row?.confirmedToday ?? 0),
    upcomingGuests: Number(row?.upcomingGuests ?? 0),
    seated: Number(row?.seated ?? 0),
  };
}

/** Today's (or a chosen day's) diary, grouped by time for the floor team. */
export async function getReservationDay(
  scope: string[] | null,
  date: string,
  branchId?: string,
) {
  return listReservations(scope, { date, branchId, limit: 200 });
}

export async function getUpcomingReservations(
  scope: string[] | null,
  limit = 6,
  branchId?: string,
) {
  const today = todayKigali();
  const conditions: SQL[] = [
    inArray(reservations.status, ["pending", "confirmed"]),
    sql`${reservations.reservationDate} >= ${today}`,
  ];

  if (branchId) conditions.push(eq(reservations.branchId, branchId));
  else if (scope !== null) {
    if (scope.length === 0) return [];
    conditions.push(inArray(reservations.branchId, scope));
  }

  return db
    .select({
      id: reservations.id,
      customerName: reservations.customerName,
      reservationDate: reservations.reservationDate,
      startTime: reservations.startTime,
      guestCount: reservations.guestCount,
      status: reservations.status,
      branchCode: branches.code,
      tableCode: restaurantTables.code,
    })
    .from(reservations)
    .innerJoin(branches, eq(branches.id, reservations.branchId))
    .leftJoin(restaurantTables, eq(restaurantTables.id, reservations.tableId))
    .where(and(...conditions))
    .orderBy(asc(reservations.reservationDate), asc(reservations.startTime))
    .limit(limit);
}
