import { type NextRequest, type NextResponse } from "next/server";
import { getUser } from "@/lib/auth/access";
import { type RequestMeta } from "@/lib/auth/session";
import { getBranchIdFromRequest } from "@/lib/branches";
import {
  listRoomServiceOrders,
  createRoomServiceOrder,
  updateRoomServiceOrderStatus,
  completeRoomServiceOrder,
} from "@/services/room-service";

/* ============================================================
   ROOM SERVICE ORDERS
   ============================================================ */

/** GET /api/room-service/orders - List room service orders */
export async function GET(request: NextRequest) {
  const user = await getUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const branchId = searchParams.get("branchId");
  const reservationId = searchParams.get("reservationId");
  const status = searchParams.get("status");

  const orders = await listRoomServiceOrders({ branchId, reservationId, status });
  return NextResponse.json({ success: true, data: orders });
}

/** POST /api/room-service/orders - Create a room service order */
export async function POST(request: NextRequest) {
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

  const result = await createRoomServiceOrder(user, body, meta);

  if (!result.ok) {
    return NextResponse.json(
      { success: false, error: result.error },
      { status: 400 },
    );
  }

  return NextResponse.json(
    { success: true, data: result.order },
    { status: 201 },
  );
}

/** PUT /api/room-service/orders/[id]/status - Update room service order status */
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
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

  const result = await updateRoomServiceOrderStatus(user, params.id, status, {
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
   COMPLETE ROOM SERVICE ORDER
   ============================================================ */

/** POST /api/room-service/orders/[id]/complete - Mark order as served and charge folio */
export async function POST_COMPLETE(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const user = await getUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await completeRoomServiceOrder(user, params.id, {
    requestId: crypto.randomUUID(),
    origin: request.headers.get("origin") ?? "unknown",
    userId: user.id,
  });

  if (!result.ok) {
    return NextResponse.json({ success: false, error: result.error }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}