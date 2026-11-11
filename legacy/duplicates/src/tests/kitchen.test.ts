import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  auditLogs,
  branches,
  menuCategories,
  menuItems,
  orders,
  roles,
  users,
} from "@/db/schema";
import { loadPermissionsForRole } from "@/lib/auth/session";
import type { SessionUser as SessionUserType } from "@/lib/auth/session";
import { ROLE_DEFINITIONS, type PermissionId } from "@/lib/permissions";
import { createOrder, getOrderById, recordPayment } from "@/services/orders";
import {
  getKitchenSummary,
  getUnpaidKitchenCount,
  listKitchenOrders,
  setFulfillmentStatus,
} from "@/services/kitchen";
import {
  DEFAULT_PREP_MINUTES,
  targetPrepMinutes,
  ticketTiming,
} from "@/lib/kitchen-time";
import {
  rollupKitchenStatus,
  stationLabel,
} from "@/lib/kitchen-stations";
import {
  kitchenSubscriberCount,
  publishKitchenEvent,
  resetKitchenSubscribers,
  subscribeToKitchen,
  type KitchenEvent,
} from "@/lib/realtime/kitchen-events";

async function asSessionUser(email: string): Promise<SessionUserType> {
  const [row] = await db
    .select({ user: users, role: roles })
    .from(users)
    .innerJoin(roles, eq(roles.id, users.roleId))
    .where(eq(users.email, email))
    .limit(1);

  if (!row) throw new Error(`Missing fixture user ${email}`);
  const permissions = await loadPermissionsForRole(row.role.id);
  return {
    id: row.user.id,
    email: row.user.email,
    fullName: row.user.fullName,
    phone: row.user.phone,
    roleId: row.role.id,
    roleName: row.role.name,
    roleLabel: row.role.label,
    branchId: row.user.branchId,
    branchName: null,
    branchCode: null,
    permissions,
    mustChangePassword: row.user.mustChangePassword,
    lastLoginAt: row.user.lastLoginAt,
    createdAt: row.user.createdAt,
  };
}

async function branchIdFor(code: string) {
  const [row] = await db
    .select({ id: branches.id })
    .from(branches)
    .where(eq(branches.code, code))
    .limit(1);
  if (!row) throw new Error(`Missing fixture branch ${code}`);
  return row.id;
}

const fixture = {
  kimironkoId: "",
  rondPointId: "",
  admin: null as SessionUserType | null,
  cashier: null as SessionUserType | null,
  kitchen: null as SessionUserType | null,
  itemId: "",
  barItemId: "",
  pastryItemId: "",
  paidOrderId: "",
  unpaidOrderId: "",
};

async function placeAndPay(
  branchId: string,
  quantity = 1,
  actor: SessionUserType = fixture.cashier!,
) {
  const created = await createOrder(actor, {
    branchId,
    channel: "dine_in",
    tableLabel: "K-1",
    guestCount: 2,
    items: [{ menuItemId: fixture.itemId, quantity }],
  });
  if (!created.ok || !created.id) throw new Error("order was not created");

  const order = await getOrderById(created.id);
  const paid = await recordPayment(actor, {
    orderId: created.id,
    method: "cash",
    amount: order!.total,
  });
  if (!paid.ok) throw new Error("payment failed");

  return created.id;
}

beforeAll(async () => {
  fixture.kimironkoId = await branchIdFor("KIM");
  fixture.rondPointId = await branchIdFor("RDP");
  fixture.admin = await asSessionUser("admin@vistakigali.rw");
  fixture.cashier = await asSessionUser("cashier.kimironko@vistakigali.rw");

  const kitchenEmail = "kitchen.test@vistakigali.rw";
  const [existingKitchen] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, kitchenEmail))
    .limit(1);

  if (!existingKitchen) {
    await db.insert(users).values({
      email: kitchenEmail,
      passwordHash: "not-used-in-this-suite",
      fullName: "Test Chef",
      roleId: "kitchen_staff",
      branchId: fixture.kimironkoId,
      isActive: true,
    });
  }
  fixture.kitchen = await asSessionUser(kitchenEmail);

  const [category] = await db
    .insert(menuCategories)
    .values({ name: `Kitchen ${Math.random().toString(36).slice(2, 7)}`, sortOrder: 5 })
    .returning({ id: menuCategories.id });

  const [item] = await db
    .insert(menuItems)
    .values({
      categoryId: category.id,
      name: "Kitchen test dish",
      price: 500_000,
      station: "kitchen",
      prepMinutes: 10,
    })
    .returning({ id: menuItems.id });
  fixture.itemId = item.id;

  const [barItem] = await db
    .insert(menuItems)
    .values({
      categoryId: category.id,
      name: "Station cocktail",
      price: 850_000,
      station: "bar",
      prepMinutes: 4,
    })
    .returning({ id: menuItems.id });
  fixture.barItemId = barItem.id;

  const [pastryItem] = await db
    .insert(menuItems)
    .values({
      categoryId: category.id,
      name: "Station fondant",
      price: 650_000,
      station: "pastry",
      prepMinutes: 9,
    })
    .returning({ id: menuItems.id });
  fixture.pastryItemId = pastryItem.id;

  fixture.paidOrderId = await placeAndPay(fixture.kimironkoId);

  const unpaid = await createOrder(fixture.cashier!, {
    branchId: fixture.kimironkoId,
    channel: "takeaway",
    items: [{ menuItemId: fixture.itemId, quantity: 1 }],
  });
  if (!unpaid.ok || !unpaid.id) throw new Error("unpaid order failed");
  fixture.unpaidOrderId = unpaid.id;
});

describe("kitchen queue", () => {
  it("shows paid orders only, with their item lines", async () => {
    const orders = await listKitchenOrders([fixture.kimironkoId]);
    const ids = orders.map((order) => order.id);

    expect(ids).toContain(fixture.paidOrderId);
    expect(ids).not.toContain(fixture.unpaidOrderId);

    const paid = orders.find((order) => order.id === fixture.paidOrderId);
    expect(paid?.fulfillmentStatus).toBe("queued");
    expect(paid?.items[0]?.name).toBe("Kitchen test dish");
    expect(paid?.items[0]?.quantity).toBe(1);
    expect(paid?.items[0]?.prepMinutes).toBe(10);
    expect(paid?.targetPrepMinutes).toBe(10);

    const unpaidCount = await getUnpaidKitchenCount([fixture.kimironkoId]);
    expect(unpaidCount).toBeGreaterThan(0);
  });

  it("scopes the queue to the branch", async () => {
    const otherBranch = await listKitchenOrders([fixture.rondPointId]);
    expect(otherBranch.some((order) => order.id === fixture.paidOrderId)).toBe(false);
  });
});

describe("kitchen workflow", () => {
  it("moves an order queued → preparing → ready → served", async () => {
    const toPreparing = await setFulfillmentStatus(
      fixture.kitchen!,
      fixture.paidOrderId,
      "preparing",
    );
    expect(toPreparing.ok).toBe(true);

    let board = await listKitchenOrders([fixture.kimironkoId]);
    expect(
      board.find((order) => order.id === fixture.paidOrderId)?.fulfillmentStatus,
    ).toBe("preparing");

    const toReady = await setFulfillmentStatus(
      fixture.kitchen!,
      fixture.paidOrderId,
      "ready",
    );
    expect(toReady.ok).toBe(true);

    const toServed = await setFulfillmentStatus(
      fixture.kitchen!,
      fixture.paidOrderId,
      "served",
    );
    expect(toServed.ok).toBe(true);

    board = await listKitchenOrders([fixture.kimironkoId]);
    expect(board.some((order) => order.id === fixture.paidOrderId)).toBe(false);

    const [audit] = await db
      .select()
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.action, "order.fulfillment_changed"),
          eq(auditLogs.entityId, fixture.paidOrderId),
        ),
      )
      .limit(1);
    expect(audit).toBeTruthy();

    const summary = await getKitchenSummary([fixture.kimironkoId]);
    expect(summary.servedToday).toBeGreaterThanOrEqual(1);
  });

  it("refuses skipped steps, unpaid orders and cross-branch moves", async () => {
    const skip = await setFulfillmentStatus(
      fixture.kitchen!,
      fixture.unpaidOrderId,
      "served",
    );
    expect(skip.ok).toBe(false);
    if (!skip.ok) expect(skip.error).toContain("paid orders");

    const secondPaid = await placeAndPay(fixture.kimironkoId);
    const jump = await setFulfillmentStatus(fixture.kitchen!, secondPaid, "ready");
    expect(jump.ok).toBe(false);
    if (!jump.ok) expect(jump.error).toContain("cannot move straight");

    const foreign = await placeAndPay(fixture.rondPointId, 1, fixture.admin!);
    const cross = await setFulfillmentStatus(fixture.kitchen!, foreign, "preparing");
    expect(cross.ok).toBe(false);
    if (!cross.ok) expect(cross.error).toContain("another branch");

    const adminCross = await setFulfillmentStatus(
      fixture.admin!,
      foreign,
      "preparing",
    );
    expect(adminCross.ok).toBe(true);
  });
});

describe("kitchen push events", () => {
  afterEach(() => resetKitchenSubscribers());

  it("fans out to group subscribers and only the matching branch", () => {
    const all: KitchenEvent[] = [];
    const kim: KitchenEvent[] = [];
    const rdp: KitchenEvent[] = [];

    subscribeToKitchen(null, (event) => all.push(event));
    subscribeToKitchen(fixture.kimironkoId, (event) => kim.push(event));
    subscribeToKitchen(fixture.rondPointId, (event) => rdp.push(event));

    publishKitchenEvent({
      type: "order.fulfillment",
      branchId: fixture.kimironkoId,
      orderId: "order-1",
      orderNumber: "KIM-1",
      fulfillmentStatus: "preparing",
      at: new Date().toISOString(),
    });

    expect(all).toHaveLength(1);
    expect(kim).toHaveLength(1);
    expect(rdp).toHaveLength(0);
    expect(kim[0].fulfillmentStatus).toBe("preparing");
  });

  it("stops delivering after unsubscribe and drops a broken stream", () => {
    const received: KitchenEvent[] = [];
    const unsubscribe = subscribeToKitchen(fixture.kimironkoId, (event) =>
      received.push(event),
    );
    subscribeToKitchen(fixture.kimironkoId, () => {
      throw new Error("stream closed");
    });

    const event = {
      type: "order.paid" as const,
      branchId: fixture.kimironkoId,
      orderId: "order-2",
      orderNumber: "KIM-2",
      fulfillmentStatus: "queued",
      at: new Date().toISOString(),
    };

    expect(() => publishKitchenEvent(event)).not.toThrow();
    expect(received).toHaveLength(1);
    expect(kitchenSubscriberCount()).toBe(1);

    unsubscribe();
    publishKitchenEvent(event);
    expect(received).toHaveLength(1);
  });

  it("publishes when a paid ticket moves and when a payment settles", async () => {
    const events: KitchenEvent[] = [];
    subscribeToKitchen(fixture.kimironkoId, (event) => events.push(event));

    const orderId = await placeAndPay(fixture.kimironkoId);
    expect(events.map((event) => event.type)).toContain("order.paid");
    expect(events.find((event) => event.orderId === orderId)?.orderNumber).toMatch(
      /^KIM-/,
    );

    const moved = await setFulfillmentStatus(
      fixture.kitchen!,
      orderId,
      "preparing",
    );
    expect(moved.ok).toBe(true);
    const moveEvent = events.find(
      (event) => event.orderId === orderId && event.type === "order.fulfillment",
    );
    expect(moveEvent?.fulfillmentStatus).toBe("preparing");

    // A part payment must not tell the kitchen a ticket is ready.
    const before = events.length;
    const open = await createOrder(fixture.cashier!, {
      branchId: fixture.kimironkoId,
      channel: "bar",
      items: [{ menuItemId: fixture.itemId, quantity: 1 }],
    });
    if (!open.ok || !open.id) throw new Error("open order failed");
    const partial = await recordPayment(fixture.cashier!, {
      orderId: open.id,
      method: "cash",
      amount: 1_000,
    });
    expect(partial.ok).toBe(true);
    expect(events.length).toBe(before);
  });
});

describe("station roll-up", () => {
  it("combines line progress into one ticket status", () => {
    expect(rollupKitchenStatus([])).toBe("served");
    expect(rollupKitchenStatus(["queued", "queued"])).toBe("queued");
    expect(rollupKitchenStatus(["queued", "preparing"])).toBe("preparing");
    expect(rollupKitchenStatus(["ready", "preparing"])).toBe("preparing");
    expect(rollupKitchenStatus(["served", "queued"])).toBe("preparing");
    expect(rollupKitchenStatus(["ready", "served"])).toBe("ready");
    expect(rollupKitchenStatus(["served", "served"])).toBe("served");
    expect(stationLabel("bar")).toBe("Bar");
    expect(stationLabel("pastry")).toBe("Dessert");
    expect(stationLabel("nope")).toBeNull();
  });
});

describe("station routing", () => {
  let mixedOrderId = "";
  let kitchenOnlyOrderId = "";

  beforeAll(async () => {
    const mixed = await createOrder(fixture.cashier!, {
      branchId: fixture.kimironkoId,
      channel: "dine_in",
      tableLabel: "K-2",
      items: [
        { menuItemId: fixture.itemId, quantity: 1 },
        { menuItemId: fixture.barItemId, quantity: 2 },
        { menuItemId: fixture.pastryItemId, quantity: 1 },
      ],
    });
    if (!mixed.ok || !mixed.id) throw new Error("mixed order failed");
    const mixedOrder = await getOrderById(mixed.id);
    const mixedPaid = await recordPayment(fixture.cashier!, {
      orderId: mixed.id,
      method: "cash",
      amount: mixedOrder!.total,
    });
    if (!mixedPaid.ok) throw new Error("mixed payment failed");
    mixedOrderId = mixed.id;

    kitchenOnlyOrderId = await placeAndPay(fixture.kimironkoId);
  });

  it("shows each section only its own lines and target", async () => {
    const bar = (await listKitchenOrders([fixture.kimironkoId], { station: "bar" }))
      .find((order) => order.id === mixedOrderId);
    expect(bar?.items.map((item) => item.name)).toEqual(["Station cocktail"]);
    expect(bar?.targetPrepMinutes).toBe(4);
    expect(bar?.stationStatus).toBe("queued");

    const food = (
      await listKitchenOrders([fixture.kimironkoId], { station: "kitchen" })
    ).find((order) => order.id === mixedOrderId);
    expect(food?.items.map((item) => item.name)).toEqual(["Kitchen test dish"]);
    expect(food?.targetPrepMinutes).toBe(10);

    const dessert = (
      await listKitchenOrders([fixture.kimironkoId], { station: "pastry" })
    ).find((order) => order.id === mixedOrderId);
    expect(dessert?.items.map((item) => item.name)).toEqual(["Station fondant"]);
    expect(dessert?.targetPrepMinutes).toBe(9);
  });

  it("moves one section without touching another", async () => {
    const started = await setFulfillmentStatus(
      fixture.kitchen!,
      mixedOrderId,
      "preparing",
      undefined,
      "bar",
    );
    expect(started.ok).toBe(true);

    let bar = (
      await listKitchenOrders([fixture.kimironkoId], { station: "bar" })
    ).find((order) => order.id === mixedOrderId);
    let food = (
      await listKitchenOrders([fixture.kimironkoId], { station: "kitchen" })
    ).find((order) => order.id === mixedOrderId);
    expect(bar?.stationStatus).toBe("preparing");
    expect(food?.stationStatus).toBe("queued");

    const ready = await setFulfillmentStatus(
      fixture.kitchen!,
      mixedOrderId,
      "ready",
      undefined,
      "bar",
    );
    expect(ready.ok).toBe(true);
    if (ready.ok) {
      expect(ready.stationStatus).toBe("ready");
      expect(ready.orderStatus).toBe("preparing");
    }

    const [orderRow] = await db
      .select({ status: orders.fulfillmentStatus })
      .from(orders)
      .where(eq(orders.id, mixedOrderId))
      .limit(1);
    expect(orderRow.status).toBe("preparing");

    const served = await setFulfillmentStatus(
      fixture.kitchen!,
      mixedOrderId,
      "served",
      undefined,
      "bar",
    );
    expect(served.ok).toBe(true);

    bar = (await listKitchenOrders([fixture.kimironkoId], { station: "bar" }))
      .find((order) => order.id === mixedOrderId);
    food = (await listKitchenOrders([fixture.kimironkoId], { station: "kitchen" }))
      .find((order) => order.id === mixedOrderId);
    expect(bar).toBeUndefined();
    expect(food?.stationStatus).toBe("queued");
  });

  it("marks the order served only when every section is done", async () => {
    for (const station of ["kitchen", "pastry"] as const) {
      expect(
        (
          await setFulfillmentStatus(
            fixture.kitchen!,
            mixedOrderId,
            "preparing",
            undefined,
            station,
          )
        ).ok,
      ).toBe(true);
      expect(
        (
          await setFulfillmentStatus(
            fixture.kitchen!,
            mixedOrderId,
            "ready",
            undefined,
            station,
          )
        ).ok,
      ).toBe(true);
      const last = await setFulfillmentStatus(
        fixture.kitchen!,
        mixedOrderId,
        "served",
        undefined,
        station,
      );
      expect(last.ok).toBe(true);
      if (last.ok) {
        expect(last.orderStatus).toBe(
          station === "pastry" ? "served" : "preparing",
        );
      }
    }

    const [orderRow] = await db
      .select({ status: orders.fulfillmentStatus })
      .from(orders)
      .where(eq(orders.id, mixedOrderId))
      .limit(1);
    expect(orderRow.status).toBe("served");

    for (const station of ["kitchen", "bar", "pastry"] as const) {
      const board = await listKitchenOrders([fixture.kimironkoId], { station });
      expect(board.some((order) => order.id === mixedOrderId)).toBe(false);
    }

    const audits = await db
      .select()
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.entityId, mixedOrderId),
          eq(auditLogs.action, "order.fulfillment_changed"),
        ),
      );
    expect(
      audits.some((audit) =>
        audit.description?.toLowerCase().includes("dessert"),
      ),
    ).toBe(true);
  });

  it("refuses a section with nothing on the ticket", async () => {
    const result = await setFulfillmentStatus(
      fixture.kitchen!,
      kitchenOnlyOrderId,
      "preparing",
      undefined,
      "bar",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("no bar items");
  });

  it("counts a station's own queue, not whole tickets", async () => {
    const barSummary = await getKitchenSummary(
      [fixture.kimironkoId],
      undefined,
      "bar",
    );
    expect(barSummary.servedToday).toBeGreaterThanOrEqual(1);

    const foodBoard = await listKitchenOrders([fixture.kimironkoId], {
      station: "kitchen",
    });
    const queuedKitchen = foodBoard.filter(
      (order) => order.stationStatus === "queued",
    ).length;
    const foodSummary = await getKitchenSummary(
      [fixture.kimironkoId],
      undefined,
      "kitchen",
    );
    expect(foodSummary.queued).toBe(queuedKitchen);
  });
});

describe("prep-time alarm maths", () => {
  it("uses the slowest dish, falling back to the house default", () => {
    expect(targetPrepMinutes([5, 25, null, 0])).toBe(25);
    expect(targetPrepMinutes([12])).toBe(12);
    expect(targetPrepMinutes([])).toBe(DEFAULT_PREP_MINUTES);
    expect(targetPrepMinutes([null, 0])).toBe(DEFAULT_PREP_MINUTES);
  });

  it("counts down and then reports minutes late", () => {
    const now = Date.now();
    const paidFiveMinutesAgo = new Date(now - 5 * 60_000);

    const onTime = ticketTiming(paidFiveMinutesAgo, 10, now)!;
    expect(onTime.isLate).toBe(false);
    expect(onTime.minutesLeft).toBe(5);
    expect(onTime.minutesLate).toBe(0);

    const due = ticketTiming(new Date(now - 10 * 60_000), 10, now)!;
    expect(due.isLate).toBe(true);
    expect(due.minutesLate).toBe(0);

    const late = ticketTiming(new Date(now - 13 * 60_000), 10, now)!;
    expect(late.isLate).toBe(true);
    expect(late.minutesLate).toBe(3);
    expect(late.minutesLeft).toBe(0);

    expect(ticketTiming(null, 10, now)).toBeNull();
  });
});

describe("kitchen permissions", () => {
  const permissionsFor = (role: string): PermissionId[] => {
    const definition = ROLE_DEFINITIONS.find((item) => item.name === role);
    if (!definition || definition.permissions[0] === "*") return [];
    return definition.permissions as PermissionId[];
  };

  it("lets kitchen staff run the board and managers supervise it", () => {
    expect(permissionsFor("kitchen_staff")).toContain("kitchen.manage");
    expect(permissionsFor("branch_manager")).toContain("kitchen.manage");
    expect(fixture.admin!.permissions).toContain("kitchen.manage");
  });

  it("gives waiters and cashiers a read-only board", () => {
    for (const role of ["waiter", "cashier", "accommodation_receptionist"]) {
      expect(permissionsFor(role)).toContain("kitchen.view");
      expect(permissionsFor(role)).not.toContain("kitchen.manage");
    }
  });

  it("keeps unprivileged roles off the board", () => {
    expect(permissionsFor("inventory_manager")).not.toContain("kitchen.view");
  });
});
