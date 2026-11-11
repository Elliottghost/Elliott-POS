import { beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  auditLogs,
  branches,
  menuCategories,
  menuItems,
  orderItems,
  orders,
  roles,
  users,
} from "@/db/schema";
import { loadPermissionsForRole } from "@/lib/auth/session";
import type { SessionUser as SessionUserType } from "@/lib/auth/session";
import { ROLE_DEFINITIONS, type PermissionId } from "@/lib/permissions";
import { moneyInputSchema } from "@/lib/validation";
import {
  computeTotals,
  createOrder,
  getOrderDetail,
  cancelOrder,
  recordPayment,
  getOrderById,
} from "@/services/orders";
import {
  getPosMenu,
  setBranchItemAvailability,
  updateMenuItem,
} from "@/services/menu";

async function asSessionUser(email: string): Promise<SessionUserType> {
  const [row] = await db
    .select({ user: users, role: roles })
    .from(users)
    .innerJoin(roles, eq(roles.id, users.roleId))
    .where(eq(users.email, email))
    .limit(1);

  if (!row) throw new Error(`Missing fixture user ${email}`);
  const permissions = await loadPermissionsForRole(row.role.id);
  const [branch] = row.user.branchId
    ? await db.select().from(branches).where(eq(branches.id, row.user.branchId)).limit(1)
    : [];

  return {
    id: row.user.id,
    email: row.user.email,
    fullName: row.user.fullName,
    phone: row.user.phone,
    roleId: row.role.id,
    roleName: row.role.name,
    roleLabel: row.role.label,
    branchId: row.user.branchId,
    branchName: branch?.name ?? null,
    branchCode: branch?.code ?? null,
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
  categoryId: "",
  tilapiaId: "",
  waterId: "",
  admin: null as SessionUserType | null,
  cashier: null as SessionUserType | null,
  manager: null as SessionUserType | null,
};

beforeAll(async () => {
  fixture.kimironkoId = await branchIdFor("KIM");
  fixture.rondPointId = await branchIdFor("RDP");
  fixture.admin = await asSessionUser("admin@vistakigali.rw");
  fixture.cashier = await asSessionUser("cashier.kimironko@vistakigali.rw");
  fixture.manager = await asSessionUser("manager.kimironko@vistakigali.rw");

  const [category] = await db
    .insert(menuCategories)
    .values({ name: "Grill", sortOrder: 10 })
    .returning({ id: menuCategories.id });
  fixture.categoryId = category.id;

  const [tilapia] = await db
    .insert(menuItems)
    .values({
      categoryId: category.id,
      name: "Grilled tilapia",
      price: 900000,
      station: "kitchen",
    })
    .returning({ id: menuItems.id });

  const [water] = await db
    .insert(menuItems)
    .values({
      categoryId: category.id,
      name: "Still water",
      price: 150000,
      station: "bar",
    })
    .returning({ id: menuItems.id });

  fixture.tilapiaId = tilapia.id;
  fixture.waterId = water.id;
});

describe("POS money", () => {
  it("applies service charge then VAT on the combined subtotal", () => {
    const totals = computeTotals(1_000_000, {
      servicePercent: 10,
      taxPercent: 18,
    });

    expect(totals).toEqual({
      subtotal: 1_000_000,
      serviceCharge: 100_000,
      tax: 198_000,
      total: 1_298_000,
    });
  });

  it("parses staff-entered francs into exact cents", () => {
    expect(moneyInputSchema.parse("8,500")).toBe(850_000);
    expect(moneyInputSchema.parse(" 1250 ")).toBe(125_000);
    expect(moneyInputSchema.safeParse("0").success).toBe(false);
    expect(moneyInputSchema.safeParse("eight").success).toBe(false);
    expect(moneyInputSchema.safeParse("-40").success).toBe(false);
  });
});

describe("menu management", () => {
  it("lists the sellable menu for a branch", async () => {
    const menu = await getPosMenu(fixture.kimironkoId);
    const names = menu.flatMap((group) => group.items.map((item) => item.name));

    expect(names).toContain("Grilled tilapia");
    expect(names).toContain("Still water");
  });

  it("marks a dish sold out for one branch only", async () => {
    await setBranchItemAvailability(
      fixture.manager!,
      fixture.kimironkoId,
      fixture.tilapiaId,
      false,
    );

    const kim = await getPosMenu(fixture.kimironkoId);
    const rdp = await getPosMenu(fixture.rondPointId);

    const kimTilapia = kim
      .flatMap((group) => group.items)
      .find((item) => item.id === fixture.tilapiaId);
    const rdpTilapia = rdp
      .flatMap((group) => group.items)
      .find((item) => item.id === fixture.tilapiaId);

    expect(kimTilapia?.isAvailable).toBe(false);
    expect(rdpTilapia?.isAvailable).toBe(true);

    await setBranchItemAvailability(
      fixture.manager!,
      fixture.kimironkoId,
      fixture.tilapiaId,
      true,
    );
  });
});

describe("order capture", () => {
  it("prices an order from the database and snapshots each line", async () => {
    const result = await createOrder(fixture.cashier!, {
      branchId: fixture.kimironkoId,
      channel: "dine_in",
      tableLabel: "T-04",
      guestCount: 2,
      items: [
        { menuItemId: fixture.tilapiaId, quantity: 2 },
        { menuItemId: fixture.waterId, quantity: 1 },
      ],
    });

    expect(result.ok).toBe(true);
    if (!result.ok || !result.id) throw new Error("order was not created");

    const order = await getOrderById(result.id);
    expect(order).toBeTruthy();
    expect(order!.subtotal).toBe(2 * 900_000 + 150_000);
    expect(order!.serviceCharge).toBe(195_000);
    expect(order!.tax).toBe(386_100);
    expect(order!.total).toBe(2_531_100);
    expect(order!.status).toBe("pending");
    expect(order!.orderNumber.startsWith("KIM-")).toBe(true);

    const lines = await db
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, order!.id));
    expect(lines).toHaveLength(2);
    expect(lines.find((line) => line.nameSnapshot === "Grilled tilapia")?.unitPrice).toBe(
      900_000,
    );

    const [audit] = await db
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.action, "order.created"), eq(auditLogs.entityId, order!.id)));
    expect(audit?.branchId).toBe(fixture.kimironkoId);
  });

  it("refuses a sold-out dish at that branch", async () => {
    await setBranchItemAvailability(
      fixture.manager!,
      fixture.kimironkoId,
      fixture.waterId,
      false,
    );

    const result = await createOrder(fixture.cashier!, {
      branchId: fixture.kimironkoId,
      channel: "takeaway",
      items: [{ menuItemId: fixture.waterId, quantity: 1 }],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("sold out");

    await setBranchItemAvailability(
      fixture.manager!,
      fixture.kimironkoId,
      fixture.waterId,
      true,
    );
  });

  it("stops a cashier opening an order for another branch", async () => {
    const result = await createOrder(fixture.cashier!, {
      branchId: fixture.rondPointId,
      channel: "dine_in",
      items: [{ menuItemId: fixture.tilapiaId, quantity: 1 }],
    });

    expect(result.ok).toBe(false);
  });

  it("lets a super administrator trade at either branch", async () => {
    const result = await createOrder(fixture.admin!, {
      branchId: fixture.rondPointId,
      channel: "bar",
      items: [{ menuItemId: fixture.waterId, quantity: 3 }],
    });

    expect(result.ok).toBe(true);
    if (result.ok && result.id) {
      const order = await getOrderById(result.id);
      expect(order!.branchId).toBe(fixture.rondPointId);
      expect(order!.orderNumber.startsWith("RDP-")).toBe(true);
    }
  });

  it("keeps historical line prices when the menu is repriced", async () => {
    const created = await createOrder(fixture.cashier!, {
      branchId: fixture.kimironkoId,
      channel: "takeaway",
      items: [{ menuItemId: fixture.waterId, quantity: 1 }],
    });
    if (!created.ok || !created.id) throw new Error("order was not created");

    await updateMenuItem(fixture.admin!, fixture.waterId, {
      categoryId: fixture.categoryId,
      name: "Still water",
      price: 200_000,
      station: "bar",
      isFeatured: false,
      isActive: true,
    });

    const detail = await getOrderDetail(created.id);
    expect(detail?.items[0].unitPrice).toBe(150_000);

    const repriced = await createOrder(fixture.cashier!, {
      branchId: fixture.kimironkoId,
      channel: "takeaway",
      items: [{ menuItemId: fixture.waterId, quantity: 1 }],
    });
    if (!repriced.ok || !repriced.id) throw new Error("repriced order failed");
    const fresh = await getOrderDetail(repriced.id);
    expect(fresh?.items[0].unitPrice).toBe(200_000);
  });
});

describe("payments", () => {
  it("accepts part payments and settles only when fully paid", async () => {
    const created = await createOrder(fixture.cashier!, {
      branchId: fixture.kimironkoId,
      channel: "dine_in",
      items: [{ menuItemId: fixture.tilapiaId, quantity: 1 }],
    });
    if (!created.ok || !created.id) throw new Error("order was not created");

    const order = await getOrderById(created.id);
    expect(order!.total).toBe(1_168_200); // 900,000 + 90,000 + 178,200

    const part = await recordPayment(fixture.cashier!, {
      orderId: created.id,
      method: "cash",
      amount: 500_000,
    });
    expect(part.ok).toBe(true);
    if (part.ok) {
      expect(part.paid).toBe(500_000);
      expect(part.balance).toBe(668_200);
    }
    expect((await getOrderById(created.id))!.status).toBe("pending");

    const overpay = await recordPayment(fixture.cashier!, {
      orderId: created.id,
      method: "momo",
      amount: 900_000,
    });
    expect(overpay.ok).toBe(false);

    const settle = await recordPayment(fixture.cashier!, {
      orderId: created.id,
      method: "momo",
      amount: 668_200,
      reference: "MOMO-99120",
    });
    expect(settle.ok).toBe(true);

    const settled = await getOrderById(created.id);
    expect(settled!.status).toBe("paid");
    expect(settled!.paidAt).toBeTruthy();

    const detail = await getOrderDetail(created.id);
    expect(detail?.paid).toBe(1_168_200);
    expect(detail?.balance).toBe(0);
    expect(detail?.payments).toHaveLength(2);

    const again = await recordPayment(fixture.cashier!, {
      orderId: created.id,
      method: "cash",
      amount: 1_000,
    });
    expect(again.ok).toBe(false);
  });

  it("blocks payment on an order from another branch", async () => {
    const created = await createOrder(fixture.admin!, {
      branchId: fixture.rondPointId,
      channel: "bar",
      items: [{ menuItemId: fixture.tilapiaId, quantity: 1 }],
    });
    if (!created.ok || !created.id) throw new Error("order was not created");

    const result = await recordPayment(fixture.cashier!, {
      orderId: created.id,
      method: "cash",
      amount: 1_000,
    });

    expect(result.ok).toBe(false);
  });
});

describe("cancellation", () => {
  it("cancels an unpaid order and refuses later payment", async () => {
    const created = await createOrder(fixture.cashier!, {
      branchId: fixture.kimironkoId,
      channel: "dine_in",
      items: [{ menuItemId: fixture.waterId, quantity: 1 }],
    });
    if (!created.ok || !created.id) throw new Error("order was not created");

    const cancelled = await cancelOrder(fixture.cashier!, created.id, "Guest left");
    expect(cancelled.ok).toBe(true);

    const order = await getOrderById(created.id);
    expect(order!.status).toBe("cancelled");
    expect(order!.cancelledReason).toBe("Guest left");

    const payment = await recordPayment(fixture.cashier!, {
      orderId: created.id,
      method: "cash",
      amount: 1_000,
    });
    expect(payment.ok).toBe(false);

    const second = await cancelOrder(fixture.cashier!, created.id, null);
    expect(second.ok).toBe(false);
  });

  it("refuses to cancel a paid order", async () => {
    const created = await createOrder(fixture.cashier!, {
      branchId: fixture.kimironkoId,
      channel: "takeaway",
      items: [{ menuItemId: fixture.waterId, quantity: 1 }],
    });
    if (!created.ok || !created.id) throw new Error("order was not created");

    const order = await getOrderById(created.id);
    const paid = await recordPayment(fixture.cashier!, {
      orderId: created.id,
      method: "cash",
      amount: order!.total,
    });
    expect(paid.ok).toBe(true);

    const result = await cancelOrder(fixture.cashier!, created.id, "Mistake");
    expect(result.ok).toBe(false);

    const stillPaid = await db
      .select({ status: orders.status })
      .from(orders)
      .where(eq(orders.id, created.id));
    expect(stillPaid[0]?.status).toBe("paid");
  });
});

describe("POS role permissions", () => {
  const permissionsFor = (role: string): PermissionId[] => {
    const definition = ROLE_DEFINITIONS.find((item) => item.name === role);
    if (!definition || definition.permissions[0] === "*") return [];
    return definition.permissions as PermissionId[];
  };

  it("lets cashiers take orders and payments but not edit prices", async () => {
    const permissions = permissionsFor("cashier");
    expect(permissions).toContain("orders.create");
    expect(permissions).toContain("payments.collect");
    expect(permissions).toContain("menu.view");
    expect(permissions).not.toContain("menu.manage");
  });

  it("keeps waiters away from the till while allowing order capture", () => {
    const permissions = permissionsFor("waiter");
    expect(permissions).toContain("orders.create");
    expect(permissions).not.toContain("payments.collect");
  });

  it("gives branch managers local availability control and cancellation", () => {
    const permissions = permissionsFor("branch_manager");
    expect(permissions).toContain("menu.availability");
    expect(permissions).toContain("orders.manage");
    expect(permissions).not.toContain("menu.manage");
  });

  it("assigns menu editing to the super administrator and inventory manager", () => {
    expect(fixture.admin!.permissions).toContain("menu.manage");
    expect(permissionsFor("inventory_manager")).toContain("menu.manage");
    expect(permissionsFor("kitchen_staff")).not.toContain("orders.create");
  });
});
