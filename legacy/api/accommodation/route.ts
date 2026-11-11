import { type NextRequest, type NextResponse } from "next/server";
import { getUser } from "@/lib/auth/access";
import { type RequestMeta } from "@/lib/auth/session";
import { getBranchIdFromRequest } from "@/lib/branches";
import {
  listRoomTypes,
  getRoomType,
  listRooms,
  getRoom,
  createRoom,
  updateRoom,
  deleteRoom,
  getRoomsByBranch,
  checkRoomAvailability,
  listAccommodationReservations,
  createReservation,
  getReservation,
  updateReservationStatus,
  getGuestFolio,
  updateGuestFolio,
  recordRoomTransaction,
  listHousekeepingTasks,
  createHousekeepingTask,
  updateHousekeepingTask,
} from "@/services/accommodation";

/* ============================================================
   ROOM TYPES
   ============================================================ */

/** GET /api/accommodation/room-types - List room types */
export async function GET(request: NextRequest) {
  const user = await getUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const includeInactive = searchParams.get("includeInactive") === "true";

  const types = await listRoomTypes({ includeInactive });
  return NextResponse.json({ success: true, data: types });
}

/* ============================================================
   ROOMS
   ============================================================ */

/** GET /api/accommodation/rooms - List rooms */
export async function GET_ROOMS(request: NextRequest) {
  const user = await getUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const branchId = searchParams.get("branchId");
  const roomTypeId = searchParams.get("roomTypeId");
  const status = searchParams.get("status");
  const includeInactive = searchParams.get("includeInactive") === "true";

  const rooms = await listRooms({ branchId, roomTypeId, status, includeInactive });
  return NextResponse.json({ success: true, data: rooms });
}

/** GET /api/accommodation/rooms/[id] - Get a room */
export async function GET_ROOM(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const room = await getRoom(params.id);
  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true, data: room });
}

/** POST /api/accommodation/rooms - Create a room */
export async function POST_ROOM(request: NextRequest) {
  const user = await getUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const meta: RequestMeta = {
    requestId: crypto.randomUUID(),
    origin: request.headers.get("origin") ?? "unknown",
    userId: user.id,
  };

  const result = await createRoom(user, body, meta);

  if (!result.ok) {
    return NextResponse.json(
      { success: false, error: result.error, fieldErrors: result.fieldErrors },
      { status: 400 },
    );
  }

  return NextResponse.json({ success: true, data: { id: result.id } }, { status: 201 });
}

/** PUT /api/accommodation/rooms/[id] - Update a room */
export async function PUT_ROOM(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const meta: RequestMeta = {
    requestId: crypto.randomUUID(),
    origin: request.headers.get("origin") ?? "unknown",
    userId: user.id,
  };

  const result = await updateRoom(user, params.id, body, meta);

  if (!result.ok) {
    return NextResponse.json(
      { success: false, error: result.error, fieldErrors: result.fieldErrors },
      { status: 400 },
    );
  }

  return NextResponse.json({ success: true, data: { id: result.id } });
}

/** DELETE /api/accommodation/rooms/[id] - Delete (deactivate) a room */
export async function DELETE_ROOM(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const meta: RequestMeta = {
    requestId: crypto.randomUUID(),
    origin: request.headers.get("origin") ?? "unknown",
    userId: user.id,
  };

  const result = await deleteRoom(user, params.id, meta);

  if (!result.ok) {
    return NextResponse.json({ success: false, error: result.error }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}

/* ============================================================
   RESERVATIONS
   ============================================================ */

/** GET /api/accommodation/reservations - List reservations */
export async function GET_RESERVATIONS(request: NextRequest) {
  const user = await getUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const branchId = searchParams.get("branchId");
  const status = searchParams.get("status");
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");

  const reservations = await listAccommodationReservations({
    branchId,
    status,
    dateFrom,
    dateTo,
  });

  return NextResponse.json({ success: true, data: reservations });
}

/** POST /api/accommodation/reservations - Create a reservation */
export async function POST_RESERVATION(request: NextRequest) {
  const user = await getUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const meta: RequestMeta = {
    requestId: crypto.randomUUID(),
    origin: request.headers.get("origin") ?? "unknown",
    userId: user.id,
  };

  const result = await createReservation(user, body, meta);

  if (!result.ok) {
    return NextResponse.json(
      { success: false, error: result.error },
      { status: 400 },
    );
  }

  return NextResponse.json(
    { success: true, data: result.reservation },
    { status: 201 },
  );
}

/** GET /api/accommodation/reservations/[id] - Get a reservation */
export async function GET_RESERVATION(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const reservation = await getReservation(params.id);
  if (!reservation) {
    return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true, data: reservation });
}

/** PUT /api/accommodation/reservations/[id]/status - Update reservation status */
export async function PUT_RESERVATION_STATUS(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const user = await getUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { status } = body;

  if (!status) {
    return NextResponse.json(
      { success: false, error: "Status is required" },
      { status: 400 },
    );
  }

  const result = await updateReservationStatus(user, params.id, status, {
    requestId: crypto.randomUUID(),
    origin: request.headers.get("origin") ?? "unknown",
    userId: user.id,
  });

  if (!result.ok) {
    return NextResponse.json({ success: false, error: result.error }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}

/* ============================================================
   GUEST FOLIO
   ============================================================ */

/** GET /api/accommodation/reservations/[id]/folio - Get guest folio */
export async function GET_FOLIO(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const user = await getUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const folio = await getGuestFolio(params.id);
  if (!folio) {
    return NextResponse.json(
      { success: false, error: "Folio not found" },
      { status: 404 },
    );
  }

  return NextResponse.json({ success: true, data: folio });
}

/* ============================================================
   ROOM TRANSACTIONS
   ============================================================ */

/** POST /api/accommodation/transactions - Record a transaction */
export async function POST_TRANSACTION(request: NextRequest) {
  const user = await getUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const meta: RequestMeta = {
    requestId: crypto.randomUUID(),
    origin: request.headers.get("origin") ?? "unknown",
    userId: user.id,
  };

  const result = await recordRoomTransaction(user, body, meta);

  if (!result.ok) {
    return NextResponse.json({ success: false, error: result.error }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}

/* ============================================================
   HOUSEKEEPING
   ============================================================ */

/** GET /api/accommodation/housekeeping - List housekeeping tasks */
export async function GET_HOUSEKEEPING(request: NextRequest) {
  const user = await getUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const branchId = searchParams.get("branchId");
  const roomId = searchParams.get("roomId");
  const status = searchParams.get("status");
  const taskType = searchParams.get("taskType");

  const tasks = await listHousekeepingTasks({
    branchId,
    roomId,
    status,
    taskType,
  });

  return NextResponse.json({ success: true, data: tasks });
}

/** POST /api/accommodation/housekeeping - Create a housekeeping task */
export async function POST_HOUSEKEEPING(request: NextRequest) {
  const user = await getUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const meta: RequestMeta = {
    requestId: crypto.randomUUID(),
    origin: request.headers.get("origin") ?? "unknown",
    userId: user.id,
  };

  const result = await createHousekeepingTask(user, body, meta);

  if (!result.ok) {
    return NextResponse.json({ success: false, error: result.error }, { status: 400 });
  }

  return NextResponse.json({ success: true, data: { id: result.id } }, { status: 201 });
}

/** PUT /api/accommodation/housekeeping/[id]/status - Update housekeeping task status */
export async function PUT_HOUSEKEEPING_STATUS(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const user = await getUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { status, notes } = body;

  if (!status) {
    return NextResponse.json(
      { success: false, error: "Status is required" },
      { status: 400 },
    );
  }

  const result = await updateHousekeepingTask(user, params.id, status, notes, {
    requestId: crypto.randomUUID(),
    origin: request.headers.get("origin") ?? "unknown",
    userId: user.id,
  });

  if (!result.ok) {
    return NextResponse.json({ success: false, error: result.error }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}