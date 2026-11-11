import { and, asc, eq, sql, type SQL } from "drizzle-orm";
import { db } from "@/db/client";
import {
  roomTypes,
  rooms,
  accommodationReservations,
  extraGuestCharges,
  roomServiceOrders,
  roomServiceItems,
  guestFolios,
  roomTransactions,
  housekeepingTasks,
} from "@/db/schema";
import { recordAudit } from "@/lib/audit";
import { canAccessBranch } from "@/lib/auth/access";
import type { RequestMeta, SessionUser } from "@/lib/auth/session";
import { getSetting } from "@/services/settings";

/** Room type row */
export interface RoomTypeRow {
  id: string;
  name: string;
  description: string | null;
  category: string;
  basePrice: number;
  isActive: boolean;
}

/** List room types */
export async function listRoomTypes(
  options: { includeInactive?: boolean } = {},
): Promise<RoomTypeRow[]> {
  const conditions: SQL[] = [];

  if (options.includeInactive === undefined) {
    conditions.push(eq(roomTypes.isActive, true));
  }

  const rows = await db
    .select({
      id: roomTypes.id,
      name: roomTypes.name,
      description: roomTypes.description,
      category: roomTypes.category,
      basePrice: roomTypes.base_price,
      isActive: roomTypes.isActive,
    })
    .from(roomTypes)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(asc(roomTypes.category), asc(roomTypes.name));

  return rows;
}

/** Get a room type */
export async function getRoomType(id: string) {
  const [row] = await db
    .select()
    .from(roomTypes)
    .where(eq(roomTypes.id, id))
    .limit(1);
  return row ?? null;
}

/** Room row */
export interface RoomRow {
  id: string;
  roomNumber: string;
  roomTypeId: string;
  branchId: string;
  capacity: number;
  bedCount: number;
  description: string | null;
  amenities: string | null;
  imagePath: string | null;
  standardPrice: number;
  specialRate: number | null;
  status: string;
}

/** List rooms */
export async function listRooms(
  options: {
    branchId?: string;
    roomTypeId?: string;
    status?: string;
    includeInactive?: boolean;
  } = {},
): Promise<RoomRow[]> {
  const conditions: SQL[] = [];

  if (options.branchId) {
    conditions.push(eq(rooms.branchId, options.branchId));
  }

  if (options.roomTypeId) {
    conditions.push(eq(rooms.roomTypeId, options.roomTypeId));
  }

  if (options.status) {
    conditions.push(eq(rooms.status, options.status));
  }

  if (options.includeInactive === undefined) {
    conditions.push(eq(rooms.isActive, true));
  }

  const rows = await db
    .select({
      id: rooms.id,
      roomNumber: rooms.room_number,
      roomTypeId: rooms.room_type_id,
      branchId: rooms.branch_id,
      capacity: rooms.capacity,
      bedCount: rooms.bed_count,
      description: rooms.description,
      amenities: rooms.amenities,
      imagePath: rooms.image_path,
      standardPrice: rooms.standard_price,
      specialRate: rooms.special_rate,
      status: rooms.status,
    })
    .from(rooms)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(asc(rooms.roomNumber));

  return rows;
}

/** Get a room */
export async function getRoom(id: string) {
  const [row] = await db
    .select()
    .from(rooms)
    .where(eq(rooms.id, id))
    .limit(1);
  return row ?? null;
}

/** Create a room */
export async function createRoom(
  actor: SessionUser,
  input: {
    roomNumber: string;
    roomTypeId: string;
    branchId: string;
    capacity?: number;
    bedCount?: number;
    description?: string;
    amenities?: string;
    standardPrice?: number;
    specialRate?: number;
  },
  meta?: RequestMeta,): Promise<{ ok: true; id: string } | { ok: false; error: string; fieldErrors?: Record<string, string[]> }> {
  // Validate branch access
  if (!canAccessBranch(actor, input.branchId)) {
    return {
      ok: false,
      error: "You can only create rooms for your assigned branch.",
    };
  }

  // Validate room type exists
  const [roomType] = await db
    .select({ id: roomTypes.id })
    .from(roomTypes)
    .where(eq(roomTypes.id, input.roomTypeId))
    .limit(1);

  if (!roomType) {
    return {
      ok: false,
      error: "Room type not found.",
      fieldErrors: { roomTypeId: ["Room type not found."] },
    };
  }

  // Check room number uniqueness within branch
  const [existing] = await db
    .select({ id: rooms.id })
    .from(rooms)
    .where(and(eq(rooms.branchId, input.branchId), eq(rooms.room_number, input.roomNumber)))
    .limit(1);

  if (existing) {
    return {
      ok: false,
      error: "A room with that number already exists in this branch.",
      fieldErrors: { roomNumber: ["Room number must be unique within the branch."] },
    };
  }

  const [created] = await db
    .insert(rooms)
    .values({
      roomNumber: input.roomNumber,
      roomTypeId: input.roomTypeId,
      branchId: input.branchId,
      capacity: input.capacity ?? 2,
      bedCount: input.bedCount ?? 1,
      description: input.description ?? null,
      amenities: input.amenities ?? null,
      standardPrice: input.standardPrice ?? roomType.base_price,
      specialRate: input.specialRate ?? null,
      status: "available",
      isActive: true,
    })
    .returning({ id: rooms.id });

  await recordAudit({
    actor,
    action: "room.created",
    entityType: "room",
    entityId: created.id,
    branchId: input.branchId,
    description: `Room ${input.roomNumber} created at ${input.standardPrice ?? roomType.base_price} RWF.`,
    metadata: {
      roomNumber: input.roomNumber,
      roomTypeId: input.roomTypeId,
      branchId: input.branchId,
      standardPrice: input.standardPrice ?? roomType.base_price,
    },
    meta,
  });

  return { ok: true, id: created.id };
}

/** Update a room */
export async function updateRoom(
  actor: SessionUser,
  roomId: string,
  input: {
    roomNumber?: string;
    roomTypeId?: string;
    capacity?: number;
    bedCount?: number;
    description?: string;
    amenities?: string;
    standardPrice?: number;
    specialRate?: number;
    status?: string;
  },
  meta?: RequestMeta,
): Promise<{ ok: true; id: string } | { ok: false; error: string; fieldErrors?: Record<string, string[]>} {
  const existing = await getRoom(roomId);
  if (!existing) return { ok: false, error: "Room not found." };

  // Validate branch access
  if (!canAccessBranch(actor, existing.branchId ?? "")) {
    return {
      ok: false,
      error: "You can only update rooms for your assigned branch.",
    };
  }

  // If room number changing, check uniqueness
  if (input.roomNumber && input.roomNumber !== existing.roomNumber) {
    const [nameOwner] = await db
      .select({ id: rooms.id })
      .from(rooms)
      .where(and(eq(rooms.branchId, existing.branchId), eq(rooms.room_number, input.roomNumber)))
      .limit(1);

    if (nameOwner && nameOwner.id !== roomId) {
      return {
        ok: false,
        error: "A room with that number already exists in this branch.",
        fieldErrors: { roomNumber: ["Room number must be unique within the branch."] },
      };
    }
  }

  await db
    .update(rooms)
    .set({
      roomNumber: input.roomNumber ?? existing.roomNumber,
      roomTypeId: input.roomTypeId ?? existing.roomTypeId,
      capacity: input.capacity ?? existing.capacity,
      bedCount: input.bedCount ?? existing.bedCount,
      description: input.description ?? existing.description,
      amenities: input.amenities ?? existing.amenities,
      standardPrice: input.standardPrice ?? existing.standardPrice,
      specialRate: input.specialRate ?? existing.specialRate,
      status: input.status ?? existing.status,
      updatedAt: new Date(),
    })
    .where(eq(rooms.id, roomId));

  await recordAudit({
    actor,
    action: "room.updated",
    entityType: "room",
    entityId: roomId,
    branchId: existing.branchId ?? "",
    description: `Room ${existing.roomNumber} updated.`,
    metadata: {
      before: { roomNumber: existing.roomNumber, status: existing.status },
      after: { roomNumber: input.roomNumber ?? existing.roomNumber, status: input.status ?? existing.status },
    },
    meta,
  });

  return { ok: true, id: roomId };
}

/** Delete (deactivate) a room */
export async function deleteRoom(
  actor: SessionUser,
  roomId: string,
  meta?: RequestMeta,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const existing = await getRoom(roomId);
  if (!existing) return { ok: false, error: "Room not found." };

  // Check if room has active reservations
  const [activeReservation] = await db
    .select({ id: accommodationReservations.id })
    .from(accommodationReservations)
    .where(and(eq(accommodationReservations.roomId, roomId), eq(accommodationReservations.status, "pending")));

  if (activeReservation) {
    return {
      ok: false,
      error: "Cannot deactivate room with active reservations. Cancel or complete them first.",
    };
  }

  await db
    .update(rooms)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(rooms.id, roomId));

  await recordAudit({
    actor,
    action: "room.deleted",
    entityType: "room",
    entityId: roomId,
    branchId: existing.branchId ?? "",
    description: `Room ${existing.roomNumber} deactivated.`,
    metadata: { roomNumber: existing.roomNumber },
    meta,
  });

  return { ok: true };
}

/** Get rooms by branch */
export async function getRoomsByBranch(branchId: string) {
  return await listRooms({ branchId, includeInactive: true });
}

/** Check room availability */
export async function checkRoomAvailability(
  branchId: string,
  roomTypeId: string,
  checkInDate: string,
  checkOutDate: string,
): Promise<{ available: boolean; conflictingReservations: any[] }> {
  // Check for overlapping reservations
  const [conflicts] = await db
    .select({
      count: sql<number>`count(*)`,
    })
    .from(accommodationReservations)
    .where(
      and(
        eq(accommodationReservations.branchId, branchId),
        eq(accommodationReservations.roomTypeId ?? "", roomTypeId),
        sql`${accommodationReservations.check_in_date} < ${checkOutDate}
          AND ${accommodationReservations.check_out_date} > ${checkInDate}`,
      ),
    );

  const available = Number(conflicts?.count ?? 0) === 0;

  return {
    available,
    conflictingReservations: [], // Would need full reservation details
  };
}

/** Accommodation reservation row */
export interface AccommodationReservationRow {
  id: string;
  branchId: string;
  roomId: string | null;
  roomTypeId: string | null;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  checkInDate: string;
  checkInTime: string;
  checkOutDate: string;
  checkOutTime: string;
  guestCount: number;
  status: string;
  depositPaid: number;
  totalAmount: number;
  paidAmount: number;
  specialRequests: string | null;
}

/** List accommodation reservations */
export async function listAccommodationReservations(
  options: {
    branchId?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
    includeInactive?: boolean;
  } = {},
): Promise<AccommodationReservationRow[]> {
  const conditions: SQL[] = [];

  if (options.branchId) {
    conditions.push(eq(accommodationReservations.branchId, options.branchId));
  }

  if (options.status) {
    conditions.push(eq(accommodationReservations.status, options.status));
  }

  if (options.dateFrom) {
    conditions.push(sql`${accommodationReservations.check_in_date} >= ${options.dateFrom}`);
  }

  if (options.dateTo) {
    conditions.push(sql`${accommodationReservations.check_out_date} <= ${options.dateTo}`);
  }

  const rows = await db
    .select({
      id: accommodationReservations.id,
      branchId: accommodationReservations.branchId,
      roomId: accommodationReservations.room_id,
      roomTypeId: sql`(select ${roomTypes.id} from ${roomTypes} where ${roomTypes.id} = (select ${rooms.room_type_id} from ${rooms} where ${rooms.id} = accommodationReservations.room_id limit 1))`,
      customerName: accommodationReservations.customer_name,
      customerPhone: accommodationReservations.customer_phone,
      customerEmail: accommodationReservations.customer_email,
      checkInDate: accommodationReservations.check_in_date,
      checkInTime: accommodationReservations.check_in_time,
      checkOutDate: accommodationReservations.check_out_date,
      checkOutTime: accommodationReservations.check_out_time,
      guestCount: accommodationReservations.guest_count,
      status: accommodationReservations.status,
      depositPaid: accommodationReservations.deposit_paid,
      totalAmount: accommodationReservations.total_amount,
      paidAmount: accommodationReservations.paid_amount,
      specialRequests: accommodationReservations.special_requests,
    })
    .from(accommodationReservations)
    .leftJoin rooms on eq(rooms.id, accommodationReservations.room_id)
    .leftJoin roomTypes on eq(roomTypes.id, rooms.room_type_id)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(accommodationReservations.check_in_date));

  return rows as AccommodationReservationRow[];
}

/** Create a reservation */
export async function createReservation(
  actor: SessionUser,
  input: {
    branchId: string;
    roomTypeId: string;
    customerName: string;
    customerPhone: string;
    customerEmail?: string;
    checkInDate: string;
    checkOutDate: string;
    guestCount?: number;
    specialRequests?: string;
    roomId?: string;
  },
  meta?: RequestMeta,
): Promise<{ ok: true; reservation: AccommodationReservationRow } | { ok: false; error: string }> {
  // Validate branch access
  if (!canAccessBranch(actor, input.branchId)) {
    return {
      ok: false,
      error: "You can only create reservations for your assigned branch.",
    };
  }

  // Check room availability
  const availability = await checkRoomAvailability(
    input.branchId,
    input.roomTypeId,
    input.checkInDate,
    input.checkOutDate,
  );

  if (!availability.available) {
    return {
      ok: false,
      error: "No rooms available for the selected dates. Please choose different dates or room type.",
    };
  }

  // Calculate total amount
  const [roomType] = await getRoomType(input.roomTypeId);
  const nightCount = this.calculateNightCount(input.checkInDate, input.checkOutDate);
  const basePrice = roomType?.basePrice ?? 0;
  const totalAmount = basePrice * nightCount;

  // Calculate deposit (typically 30%)
  const depositAmount = Math.round(totalAmount * 0.3);

  const [created] = await db
    .insert(accommodationReservations)
    .values({
      branchId: input.branchId,
      roomId: input.roomId,
      roomTypeId: input.roomTypeId,
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      customerEmail: input.customerEmail ?? null,
      checkInDate: input.checkInDate,
      checkOutDate: input.checkOutDate,
      checkInTime: "14:00",
      checkOutTime: "11:00",
      guestCount: input.guestCount ?? 2,
      status: "pending",
      depositPaid: depositAmount,
      totalAmount,
      paidAmount: 0,
      specialRequests: input.specialRequests ?? null,
      createdByUserId: actor.id,
    })
    .returning({ id: accommodationReservations.id });

  // Record transaction
  await db
    .insert(roomTransactions)
    .values({
      reservationId: created.id,
      roomId: input.roomId ?? null,
      branchId: input.branchId,
      transactionType: "check_in",
      amount: depositAmount,
      description: "Reservation deposit received",
      recordedByUserId: actor.id,
    });

  await recordAudit({
    actor,
    action: "reservation.created",
    entityType: "accommodation_reservation",
    entityId: created.id,
    branchId: input.branchId,
    description: `Accommodation reservation created for ${input.customerName} - ${input.checkInDate} to ${input.checkOutDate}. Deposit: ${depositAmount} RWF.`,
    metadata: {
      customerName: input.customerName,
      checkInDate: input.checkInDate,
      checkOutDate: input.checkOutDate,
      depositAmount,
      totalAmount,
    },
    meta,
  });

  // Fetch the created reservation with room details
  const reservationRows = await listAccommodationReservations({
    branchId: input.branchId,
    status: "pending",
  });

  const reservation = reservationRows.find((r) => r.id === created.id);

  return {
    ok: true,
    reservation: reservation ?? {
      id: created.id,
      branchId: input.branchId,
      roomId: input.roomId,
      roomTypeId: input.roomTypeId,
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      customerEmail: input.customerEmail ?? null,
      checkInDate: input.checkInDate,
      checkInTime: "14:00",
      checkOutDate: input.checkOutDate,
      checkOutTime: "11:00",
      guestCount: input.guestCount ?? 2,
      status: "pending",
      depositPaid: depositAmount,
      totalAmount,
      paidAmount: 0,
      specialRequests: input.specialRequests ?? null,
    },
  };
}

/** Get a reservation */
export async function getReservation(id: string) {
  const rows = await listAccommodationReservations({});
  return rows.find((r) => r.id === id) ?? null;
}

/** Update reservation status */
export async function updateReservationStatus(
  actor: SessionUser,
  reservationId: string,
  status: string,
  meta?: RequestMeta,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const [reservation] = await getReservation(reservationId);
  if (!reservation) return { ok: false, error: "Reservation not found." };

  // Validate branch access
  if (!canAccessBranch(actor, reservation.branchId)) {
    return { ok: false, error: "This reservation belongs to another branch." };
  }

  // Valid statuses
  const validStatuses = [
    "pending", "confirmed", "checked_in", "checked_out", "cancelled", "no_show",
  ];
  if (!validStatuses.includes(status)) {
    return { ok: false, error: "Invalid reservation status." };
  }

  await db
    .update(accommodationReservations)
    .set({ status, updatedAt: new Date() })
    .where(eq(accommodationReservations.id, reservationId));

  // Record transaction based on status change
  let transactionType: string;
  let amount = 0;
  let description = "";

  switch (status) {
    case "confirmed":
      transactionType = "check_in"; // Or a confirmation transaction
      amount = reservation.depositPaid;
      description = "Reservation confirmed";
      break;
    case "checked_in":
      transactionType = "check_in";
      amount = reservation.totalAmount;
      description = "Guest checked in";
      break;
    case "checked_out":
      transactionType = "check_out";
      amount = -reservation.paidAmount; // Negative for payout
      description = "Guest checked out";
      break;
    case "cancelled":
      transactionType = "cancellation";
      // Refund deposit if no partial payments
      amount = reservation.depositPaid;
      description = "Reservation cancelled";
      break;
    case "no_show":
      transactionType = "no_show";
      description = "Guest no-show";
      break;
    default:
      transactionType = "adjustment";
  }

  if (amount !== 0) {
    await db
      .insert(roomTransactions)
      .values({
        reservationId: reservationId,
        roomId: reservation.roomId ?? null,
        branchId: reservation.branchId,
        transactionType,
        amount,
        description,
        recordedByUserId: actor.id,
      });
  }

  await recordAudit({
    actor,
    action: `reservation.${status}`,
    entityType: "accommodation_reservation",
    entityId: reservationId,
    branchId: reservation.branchId,
    description: `Reservation ${reservationId} status updated to ${status}.`,
    metadata: { newStatus: status },
    meta,
  });

  return { ok: true };
}

/** Guest folio row */
export interface GuestFolioRow {
  id: string;
  reservationId: string;
  branchId: string;
  roomId: string;
  openingBalance: number;
  currentBalance: number;
  roomCharges: number;
  foodBeverageCharges: number;
  roomServiceCharges: number;
  otherCharges: number;
  totalPaid: number;
  outstandingBalance: number;
  status: string;
}

/** Get guest folio */
export async function getGuestFolio(reservationId: string) {
  const [folio] = await db
    .select({
      id: guestFolios.id,
      branchId: guestFolios.branch_id,
      roomId: guestFolios.room_id,
      openingBalance: guestFolios.opening_balance,
      currentBalance: guestFolios.current_balance,
      roomCharges: guestFolios.room_charges,
      foodBeverageCharges: guestFolios.food_beverage_charges,
      roomServiceCharges: guestFolios.room_service_charges,
      otherCharges: guestFolios.other_charges,
      totalPaid: guestFolios.total_paid,
      outstandingBalance: guestFolios.outstanding_balance,
      status: guestFolios.status,
    })
    .from(guestFolios)
    .where(eq(guestFolios.reservation_id, reservationId))
    .limit(1);

  return folio ?? null;
}

/** Update guest folio */
export async function updateGuestFolio(
  reservationId: string,
  updates: {
    roomCharges?: number;
    foodBeverageCharges?: number;
    roomServiceCharges?: number;
    otherCharges?: number;
    totalPaid?: number;
  },
): Promise<{ ok: true; folio: GuestFolioRow } | { ok: false; error: string }> {
  // Get existing folio
  const [existingFolio] = await getGuestFolio(reservationId);
  if (!existingFolio) {
    // Create new folio
    const [created] = await db
      .insert(guestFolios)
      .values({
        reservationId,
        branchId: "", // Would need to get from reservation
        roomId: "",
        openingBalance: 0,
        currentBalance: 0,
        roomCharges: 0,
        foodBeverageCharges: 0,
        roomServiceCharges: 0,
        otherCharges: 0,
        totalPaid: 0,
        outstandingBalance: 0,
        status: "active",
      })
      .returning({ id: guestFolios.id });

    // Return created folio with defaults
    const [folio] = await db
      .select({
        id: guestFolios.id,
        branchId: guestFolios.branch_id,
        roomId: guestFolios.room_id,
        openingBalance: guestFolios.opening_balance,
        currentBalance: guestFolios.current_balance,
        roomCharges: guestFolios.room_charges,
        foodBeverageCharges: guestFolios.food_beverage_charges,
        roomServiceCharges: guestFolios.room_service_charges,
        otherCharges: guestFolios.other_charges,
        totalPaid: guestFolios.total_paid,
        outstandingBalance: guestFolios.outstanding_balance,
        status: guestFolios.status,
      })
      .from(guestFolios)
      .where(eq(guestFolios.id, created.id))
      .limit(1);

    return { ok: true, folio: folio as unknown as GuestFolioRow };
  }

  // Update existing folio
  const newCurrentBalance =
    (existingFolio.currentBalance ?? 0) +
    (updates.roomCharges ?? 0) +
    (updates.foodBeverageCharges ?? 0) +
    (updates.roomServiceCharges ?? 0) +
    (updates.otherCharges ?? 0) -
    (updates.totalPaid ?? 0);

  const [updated] = await db
    .update(guestFolios)
    .set({
      roomCharges: updates.roomCharges ?? existingFolio.roomCharges,
      foodBeverageCharges: updates.foodBeverageCharges ?? existingFolio.foodBeverageCharges,
      roomServiceCharges: updates.roomServiceCharges ?? existingFolio.roomServiceCharges,
      otherCharges: updates.otherCharges ?? existingFolio.otherCharges,
      totalPaid: updates.totalPaid ?? existingFolio.totalPaid,
      currentBalance: newCurrentBalance,
      outstandingBalance: Math.max(newCurrentBalance - (updates.totalPaid ?? existingFolio.totalPaid ?? 0), 0),
      updatedAt: new Date(),
    })
    .where(eq(guestFolios.id, existingFolio.id));

  const [folio] = await db
    .select({
      id: guestFolios.id,
      branchId: guestFolios.branch_id,
      roomId: guestFolios.room_id,
      openingBalance: guestFolios.opening_balance,
      currentBalance: guestFolios.current_balance,
      roomCharges: guestFolios.room_charges,
      foodBeverageCharges: guestFolios.food_beverage_charges,
      roomServiceCharges: guestFolios.room_service_charges,
      otherCharges: guestFolios.other_charges,
      totalPaid: guestFolios.total_paid,
      outstandingBalance: guestFolios.outstanding_balance,
      status: guestFolios.status,
    })
    .from(guestFolios)
    .where(eq(guestFolios.id, existingFolio.id))
    .limit(1);

  return { ok: true, folio: folio as unknown as GuestFolioRow };
}

/** Record room transaction */
export async function recordRoomTransaction(
  actor: SessionUser,
  input: {
    reservationId: string;
    roomId: string;
    branchId: string;
    transactionType: string;
    amount: number;
    description: string;
  },
  meta?: RequestMeta,
): Promise<{ ok: true } | { ok: false; error: string }> {
  // Validate branch access
  if (!canAccessBranch(actor, input.branchId)) {
    return { ok: false, error: "You can only record transactions for your assigned branch." };
  }

  const [created] = await db
    .insert(roomTransactions)
    .values({
      reservationId: input.reservationId,
      roomId: input.roomId,
      branchId: input.branchId,
      transactionType: input.transactionType,
      amount: input.amount,
      description: input.description,
      recordedByUserId: actor.id,
    })
    .returning({ id: roomTransactions.id });

  // Update guest folio if it exists
  await updateGuestFolio(input.reservationId, {
    roomCharges: input.transactionType === "room_service" ? input.amount : 0,
    totalPaid: input.transactionType === "payment" ? input.amount : 0,
  });

  await recordAudit({
    actor,
    action: `transaction.${input.transactionType}`,
    entityType: "room_transaction",
    entityId: created.id,
    branchId: input.branchId,
    description: `${input.transactionType}: ${input.description}`,
    metadata: {
      transactionType: input.transactionType,
      amount: input.amount,
      reservationId: input.reservationId,
    },
    meta,
  });

  return { ok: true };
}

/** Housekeeping task row */
export interface HousekeepingTaskRow {
  id: string;
  roomId: string;
  branchId: string;
  taskType: string;
  status: string;
  assignedToUserId: string | null;
  completedByUserId: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  notes: string | null;
  priority: number;
}

/** List housekeeping tasks */
export async function listHousekeepingTasks(
  options: {
    branchId?: string;
    roomId?: string;
    status?: string;
    taskType?: string;
  } = {},
): Promise<HousekeepingTaskRow[]> {
  const conditions: SQL[] = [];

  if (options.branchId) {
    conditions.push(eq(housekeepingTasks.branchId, options.branchId));
  }

  if (options.roomId) {
    conditions.push(eq(housekeepingTasks.roomId, options.roomId));
  }

  if (options.status) {
    conditions.push(eq(housekeepingTasks.status, options.status));
  }

  if (options.taskType) {
    conditions.push(eq(housekeepingTasks.taskType, options.taskType));
  }

  const rows = await db
    .select({
      id: housekeepingTasks.id,
      roomId: housekeepingTasks.room_id,
      branchId: housekeepingTasks.branch_id,
      taskType: housekeepingTasks.task_type,
      status: housekeepingTasks.status,
      assignedToUserId: housekeepingTasks.assigned_to_user_id,
      completedByUserId: housekeepingTasks.completed_by_user_id,
      startedAt: housekeepingTasks.started_at,
      completedAt: housekeepingTasks.completed_at,
      notes: housekeepingTasks.notes,
      priority: housekeepingTasks.priority,
    })
    .from(housekeepingTasks)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(asc(housekeepingTasks.priority), asc(housekeepingTasks.created_at));

  return rows as HousekeepingTaskRow[];
}

/** Create housekeeping task */
export async function createHousekeepingTask(
  actor: SessionUser,
  input: {
    roomId: string;
    branchId: string;
    taskType: string;
    priority?: number;
  },
  meta?: RequestMeta,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  // Validate branch access
  if (!canAccessBranch(actor, input.branchId)) {
    return { ok: false, error: "You can only create housekeeping tasks for your assigned branch." };
  }

  const [created] = await db
    .insert(housekeepingTasks)
    .values({
      roomId: input.roomId,
      branchId: input.branchId,
      taskType: input.taskType,
      status: "pending",
      priority: input.priority ?? 1,
    })
    .returning({ id: housekeepingTasks.id });

  await recordAudit({
    actor,
    action: "housekeeping_task.created",
    entityType: "housekeeping_task",
    entityId: created.id,
    branchId: input.branchId,
    description: `Housekeeping task created for room ${input.roomId}.`,
    metadata: { taskType: input.taskType, roomId: input.roomId },
    meta,
  });

  return { ok: true, id: created.id };
}

/** Update housekeeping task */
export async function updateHousekeepingTask(
  actor: SessionUser,
  taskId: string,
  status: string,
  notes?: string,
  meta?: RequestMeta,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const [task] = await db
    .select()
    .from(housekeepingTasks)
    .where(eq(housekeepingTasks.id, taskId))
    .limit(1);

  if (!task) return { ok: false, error: "Housekeeping task not found." };

  // Validate branch access
  if (!canAccessBranch(actor, task.branchId ?? "")) {
    return { ok: false, error: "This task belongs to another branch." };
  }

  const updates: any = { status };

  if (status === "in_progress" && !task.started_at) {
    updates.started_at = new Date().getTime();
  }

  if (status === "completed") {
    updates.status = "completed";
    updates.completed_at = new Date().getTime();
  }

  if (notes !== undefined) {
    updates.notes = notes;
  }

  await db
    .update(housekeepingTasks)
    .set(updates)
    .where(eq(housekeepingTasks.id, taskId));

  await recordAudit({
    actor,
    action: `housekeeping_task.${status}`,
    entityType: "housekeeping_task",
    entityId: taskId,
    branchId: task.branchId ?? "",
    description: `Housekeeping task ${taskId} updated to ${status}.`,
    metadata: { newStatus: status, notes },
    meta,
  });

  return { ok: true };
}

/** Calculate night count between dates */
function calculateNightCount(checkIn: string, checkOut: string): number {
  // Simple calculation - would need proper date parsing
  const checkInDate = new Date(checkIn);
  const checkOutDate = new Date(checkOut);
  const diffTime = Math.abs(checkOutDate.getTime() - checkInDate.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(diffDays, 1);
}