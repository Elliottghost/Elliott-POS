import { existsSync } from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  branches,
  menuCategories,
  menuItems,
  reservations,
  restaurantTables,
  roles,
  users,
} from "@/db/schema";
import { loadPermissionsForRole } from "@/lib/auth/session";
import type { SessionUser as SessionUserType } from "@/lib/auth/session";
import { ROLE_DEFINITIONS, type PermissionId } from "@/lib/permissions";
import { todayKigali } from "@/lib/format";
import {
  createMenuCategory,
  createMenuItem,
  deleteMenuCategory,
  deleteMenuItem,
  getPosMenu,
  listMenuItems,
  setBranchMenuItem,
  updateMenuCategory,
  updateMenuItem,
} from "@/services/menu";
import {
  createTable,
  deleteTable,
  getTableByQrToken,
  getTableStats,
  listTables,
  setTableStatus,
  updateTable,
} from "@/services/tables";
import {
  createReservation,
  getReservationById,
  getReservationStats,
  setReservationStatus,
  updateReservation,
} from "@/services/reservations";
import { createOrder } from "@/services/orders";
import { getRestaurantOverview } from "@/services/restaurant";
import { removeMenuImage, saveMenuImage } from "@/lib/uploads";

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

const tomorrow = () => todayKigali(new Date(Date.now() + 86_400_000));
const unique = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 7)}`;

const fixture = {
  kimironkoId: "",
  rondPointId: "",
  admin: null as SessionUserType | null,
  kimManager: null as SessionUserType | null,
  rdManager: null as SessionUserType | null,
  categoryId: "",
  itemId: "",
  tableId: "",
};

beforeAll(async () => {
  fixture.kimironkoId = await branchIdFor("KIM");
  fixture.rondPointId = await branchIdFor("RDP");
  fixture.admin = await asSessionUser("admin@vistakigali.rw");
  fixture.kimManager = await asSessionUser("manager.kimironko@vistakigali.rw");

  // A second-branch manager for isolation checks.
  const rdEmail = "manager.rondpoint.test@vistakigali.rw";
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, rdEmail))
    .limit(1);

  if (!existing) {
    await db.insert(users).values({
      email: rdEmail,
      passwordHash: "not-used-in-this-suite",
      fullName: "Diane Ingabire",
      roleId: "branch_manager",
      branchId: fixture.rondPointId,
      isActive: true,
    });
  }
  fixture.rdManager = await asSessionUser(rdEmail);
});

describe("menu categories", () => {
  it("creates, edits and deletes a category", async () => {
    const name = unique("Tasting");
    const created = await createMenuCategory(fixture.admin!, {
      name,
      description: "Chef's selection",
      sortOrder: 77,
      isActive: true,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    fixture.categoryId = created.id;

    const updated = await updateMenuCategory(fixture.admin!, created.id, {
      name: `${name} menu`,
      sortOrder: 78,
      isActive: false,
    });
    expect(updated.ok).toBe(true);

    const [row] = await db
      .select()
      .from(menuCategories)
      .where(eq(menuCategories.id, created.id));
    expect(row.name).toBe(`${name} menu`);
    expect(row.isActive).toBe(false);

    const removed = await deleteMenuCategory(fixture.admin!, created.id);
    expect(removed.ok).toBe(true);

    const [gone] = await db
      .select()
      .from(menuCategories)
      .where(eq(menuCategories.id, created.id));
    expect(gone).toBeUndefined();
  });

  it("refuses to delete a category that still holds dishes", async () => {
    const [category] = await db
      .insert(menuCategories)
      .values({ name: unique("Protected"), sortOrder: 80 })
      .returning({ id: menuCategories.id });

    const created = await createMenuItem(fixture.admin!, {
      categoryId: category.id,
      name: "Test dish",
      price: 500_000,
      station: "kitchen",
      prepMinutes: 10,
      isFeatured: false,
      isActive: true,
    });
    expect(created.ok).toBe(true);

    const result = await deleteMenuCategory(fixture.admin!, category.id);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("still holds");
  });
});

describe("menu items", () => {
  it("creates an item with an image, prep time and featured flag", async () => {
    const name = unique("Signature dish");
    const [category] = await db.select().from(menuCategories).limit(1);
    const created = await createMenuItem(
      fixture.admin!,
      {
        categoryId: category.id,
        name,
        description: "Slow braised",
        price: 1_250_000,
        station: "kitchen",
        prepMinutes: 35,
        isFeatured: true,
        isActive: true,
      },
      undefined,
      "/api/menu-images/test-dish.png",
    );

    expect(created.ok).toBe(true);
    if (!created.ok) return;
    fixture.itemId = created.id;

    const [row] = await db.select().from(menuItems).where(eq(menuItems.id, created.id));
    expect(row.imagePath).toBe("/api/menu-images/test-dish.png");
    expect(row.prepMinutes).toBe(35);
    expect(row.isFeatured).toBe(true);

    const search = await listMenuItems({ search: name });
    expect(search).toHaveLength(1);

    const featured = await listMenuItems({ featuredOnly: true });
    expect(featured.some((item) => item.id === created.id)).toBe(true);
  });

  it("edits and deletes an item without touching past receipts", async () => {
    const updated = await updateMenuItem(fixture.admin!, fixture.itemId, {
      categoryId: (await db.select().from(menuItems).where(eq(menuItems.id, fixture.itemId)))[0]
        .categoryId,
      name: "Renamed signature dish",
      price: 1_300_000,
      station: "kitchen",
      prepMinutes: 30,
      isFeatured: false,
      isActive: true,
    });
    expect(updated.ok).toBe(true);

    const [row] = await db.select().from(menuItems).where(eq(menuItems.id, fixture.itemId));
    expect(row.name).toBe("Renamed signature dish");
    expect(row.price).toBe(1_300_000);

    const removed = await deleteMenuItem(fixture.admin!, fixture.itemId);
    expect(removed.ok).toBe(true);
    const [gone] = await db.select().from(menuItems).where(eq(menuItems.id, fixture.itemId));
    expect(gone).toBeUndefined();
  });
});

describe("menu images", () => {
  it("stores an uploaded photograph and serves it by path", async () => {
    const file = new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], "dish.png", {
      type: "image/png",
    });

    const saved = await saveMenuImage(file);
    expect(saved?.ok).toBe(true);
    if (!saved || !saved.ok) return;

    expect(saved.path.startsWith("/api/menu-images/")).toBe(true);
    const filename = path.basename(saved.path);
    expect(existsSync(path.join(process.cwd(), "data", "uploads", "menu", filename))).toBe(
      true,
    );

    await removeMenuImage(saved.path);
    expect(existsSync(path.join(process.cwd(), "data", "uploads", "menu", filename))).toBe(
      false,
    );
  });

  it("rejects files that are not photographs", async () => {
    const file = new File(["not an image"], "notes.txt", { type: "text/plain" });
    const saved = await saveMenuImage(file);
    expect(saved?.ok).toBe(false);
  });
});

describe("branch-specific prices", () => {
  it("sells the same dish at different prices per branch", async () => {
    const [category] = await db
      .insert(menuCategories)
      .values({ name: unique("Priced"), sortOrder: 90 })
      .returning({ id: menuCategories.id });

    const item = await createMenuItem(fixture.admin!, {
      categoryId: category.id,
      name: "Branch priced dish",
      price: 1_000_000,
      station: "kitchen",
      prepMinutes: 10,
      isFeatured: false,
      isActive: true,
    });
    if (!item.ok) throw new Error("item creation failed");

    await setBranchMenuItem(fixture.admin!, {
      branchId: fixture.kimironkoId,
      menuItemId: item.id,
      isAvailable: true,
      priceOverride: 1_250_000,
    });

    const kim = (await getPosMenu(fixture.kimironkoId))
      .flatMap((group) => group.items)
      .find((entry) => entry.id === item.id);
    const rdp = (await getPosMenu(fixture.rondPointId))
      .flatMap((group) => group.items)
      .find((entry) => entry.id === item.id);

    expect(kim?.price).toBe(1_250_000);
    expect(kim?.hasBranchPrice).toBe(true);
    expect(rdp?.price).toBe(1_000_000);
    expect(rdp?.hasBranchPrice).toBe(false);

    const order = await createOrder(fixture.kimManager!, {
      branchId: fixture.kimironkoId,
      channel: "dine_in",
      items: [{ menuItemId: item.id, quantity: 2 }],
    });
    expect(order.ok).toBe(true);
    if (order.ok && order.id) {
      const { getOrderById } = await import("@/services/orders");
      const placed = await getOrderById(order.id);
      expect(placed?.subtotal).toBe(2_500_000);
    }
  });

  it("keeps sold-out flags independent between branches", async () => {
    const item = (
      await db.select().from(menuItems).limit(1)
    )[0];

    await setBranchMenuItem(fixture.kimManager!, {
      branchId: fixture.kimironkoId,
      menuItemId: item.id,
      isAvailable: false,
      priceOverride: null,
    });
    await setBranchMenuItem(fixture.rdManager!, {
      branchId: fixture.rondPointId,
      menuItemId: item.id,
      isAvailable: true,
      priceOverride: null,
    });

    const kim = (await getPosMenu(fixture.kimironkoId))
      .flatMap((group) => group.items)
      .find((entry) => entry.id === item.id);
    const rdp = (await getPosMenu(fixture.rondPointId))
      .flatMap((group) => group.items)
      .find((entry) => entry.id === item.id);

    expect(kim?.isAvailable).toBe(false);
    expect(rdp?.isAvailable).toBe(true);

    await setBranchMenuItem(fixture.kimManager!, {
      branchId: fixture.kimironkoId,
      menuItemId: item.id,
      isAvailable: true,
      priceOverride: null,
    });
  });
});

describe("tables", () => {
  it("creates a table with a QR token and updates it", async () => {
    const code = unique("T").toUpperCase();
    const created = await createTable(fixture.kimManager!, {
      branchId: fixture.kimironkoId,
      code,
      name: "Window",
      capacity: 4,
      section: "Terrace",
      status: "available",
      isActive: true,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    fixture.tableId = created.id;

    const [row] = await db
      .select()
      .from(restaurantTables)
      .where(eq(restaurantTables.id, created.id));
    expect(row.qrToken).toHaveLength(32);
    expect(row.section).toBe("Terrace");

    const byToken = await getTableByQrToken(row.qrToken);
    expect(byToken?.table.id).toBe(row.id);
    expect(byToken?.branchSlug).toBeTruthy();

    const updated = await updateTable(fixture.kimManager!, created.id, {
      branchId: fixture.kimironkoId,
      code,
      name: "Window seat",
      capacity: 6,
      section: "Terrace",
      status: "reserved",
      isActive: true,
    });
    expect(updated.ok).toBe(true);

    const status = await setTableStatus(fixture.kimManager!, created.id, "occupied");
    expect(status.ok).toBe(true);

    const [after] = await db
      .select()
      .from(restaurantTables)
      .where(eq(restaurantTables.id, created.id));
    expect(after.capacity).toBe(6);
    expect(after.status).toBe("occupied");
  });

  it("rejects duplicate table numbers in a branch and cross-branch edits", async () => {
    const [existing] = await db
      .select()
      .from(restaurantTables)
      .where(eq(restaurantTables.branchId, fixture.kimironkoId))
      .limit(1);

    const duplicate = await createTable(fixture.kimManager!, {
      branchId: fixture.kimironkoId,
      code: existing.code,
      capacity: 4,
      section: "Main room",
      status: "available",
      isActive: true,
    });
    expect(duplicate.ok).toBe(false);

    const crossBranch = await createTable(fixture.kimManager!, {
      branchId: fixture.rondPointId,
      code: unique("X").toUpperCase(),
      capacity: 4,
      section: "Main room",
      status: "available",
      isActive: true,
    });
    expect(crossBranch.ok).toBe(false);

    const foreignDelete = await deleteTable(fixture.kimManager!, fixture.tableId);
    expect(foreignDelete.ok).toBe(true); // own table, no bookings yet
  });

  it("scopes table figures to the manager's branch", async () => {
    await createTable(fixture.kimManager!, {
      branchId: fixture.kimironkoId,
      code: unique("S").toUpperCase(),
      capacity: 4,
      section: "Main room",
      status: "available",
      isActive: true,
    });

    const kimTables = await listTables([fixture.kimironkoId]);
    expect(kimTables.every((table) => table.branchId === fixture.kimironkoId)).toBe(true);

    const kimStats = await getTableStats([fixture.kimironkoId]);
    const allStats = await getTableStats(null);
    expect(kimStats.total).toBeGreaterThan(0);
    expect(allStats.total).toBeGreaterThanOrEqual(kimStats.total);
  });
});

describe("reservations", () => {
  it("books a table, confirms it and moves it through service", async () => {
    const created = await createTable(fixture.kimManager!, {
      branchId: fixture.kimironkoId,
      code: unique("R").toUpperCase(),
      capacity: 4,
      section: "Garden",
      status: "available",
      isActive: true,
    });
    if (!created.ok) throw new Error("table creation failed");

    const reservation = await createReservation(fixture.kimManager!, {
      branchId: fixture.kimironkoId,
      tableId: created.id,
      customerName: "Test Guest",
      customerPhone: "+250 788 999 000",
      reservationDate: tomorrow(),
      startTime: "19:00",
      durationMinutes: 90,
      guestCount: 4,
      status: "pending",
    });
    expect(reservation.ok).toBe(true);
    if (!reservation.ok) return;

    const confirmed = await setReservationStatus(
      fixture.kimManager!,
      reservation.id,
      "confirmed",
      null,
    );
    expect(confirmed.ok).toBe(true);

    const detail = await getReservationById(reservation.id);
    expect(detail?.reservation.status).toBe("confirmed");
    expect(detail?.tableCode).toBeTruthy();
    expect(detail?.reservation.confirmedAt).toBeTruthy();

    const seat = await setReservationStatus(fixture.kimManager!, reservation.id, "seated", null);
    expect(seat.ok).toBe(true);

    const [table] = await db
      .select()
      .from(restaurantTables)
      .where(eq(restaurantTables.id, created.id));
    expect(table.status).toBe("occupied");

    const completed = await setReservationStatus(
      fixture.kimManager!,
      reservation.id,
      "completed",
      null,
    );
    expect(completed.ok).toBe(true);

    const [freed] = await db
      .select()
      .from(restaurantTables)
      .where(eq(restaurantTables.id, created.id));
    expect(freed.status).toBe("available");
  });

  it("refuses a reservation that overlaps an existing one", async () => {
    const table = await createTable(fixture.kimManager!, {
      branchId: fixture.kimironkoId,
      code: unique("O").toUpperCase(),
      capacity: 6,
      section: "Garden",
      status: "available",
      isActive: true,
    });
    if (!table.ok) throw new Error("table creation failed");

    const first = await createReservation(fixture.kimManager!, {
      branchId: fixture.kimironkoId,
      tableId: table.id,
      customerName: "First Guest",
      customerPhone: "+250 788 111 222",
      reservationDate: tomorrow(),
      startTime: "18:00",
      durationMinutes: 90,
      guestCount: 2,
      status: "confirmed",
    });
    expect(first.ok).toBe(true);

    const overlapping = await createReservation(fixture.kimManager!, {
      branchId: fixture.kimironkoId,
      tableId: table.id,
      customerName: "Second Guest",
      customerPhone: "+250 788 333 444",
      reservationDate: tomorrow(),
      startTime: "18:30",
      durationMinutes: 90,
      guestCount: 2,
      status: "pending",
    });
    expect(overlapping.ok).toBe(false);
    if (!overlapping.ok) {
      expect(overlapping.error).toContain("already booked");
    }

    // Directly after the first booking ends, the table is free again.
    const adjacent = await createReservation(fixture.kimManager!, {
      branchId: fixture.kimironkoId,
      tableId: table.id,
      customerName: "Late Guest",
      customerPhone: "+250 788 555 666",
      reservationDate: tomorrow(),
      startTime: "19:30",
      durationMinutes: 60,
      guestCount: 2,
      status: "pending",
    });
    expect(adjacent.ok).toBe(true);

    if (first.ok) {
      const moved = await updateReservation(fixture.kimManager!, first.id, {
        branchId: fixture.kimironkoId,
        tableId: table.id,
        customerName: "First Guest",
        customerPhone: "+250 788 111 222",
        reservationDate: tomorrow(),
        startTime: "18:00",
        durationMinutes: 90,
        guestCount: 2,
        status: "confirmed",
      });
      expect(moved.ok).toBe(true);
    }
  });

  it("blocks cross-branch reservations and oversized parties", async () => {
    const foreign = await createReservation(fixture.kimManager!, {
      branchId: fixture.rondPointId,
      customerName: "Foreign Guest",
      customerPhone: "+250 788 000 000",
      reservationDate: tomorrow(),
      startTime: "12:00",
      durationMinutes: 60,
      guestCount: 2,
      status: "pending",
    });
    expect(foreign.ok).toBe(false);

    const table = await createTable(fixture.kimManager!, {
      branchId: fixture.kimironkoId,
      code: unique("C").toUpperCase(),
      capacity: 2,
      section: "Main room",
      status: "available",
      isActive: true,
    });
    if (!table.ok) throw new Error("table creation failed");

    const tooMany = await createReservation(fixture.kimManager!, {
      branchId: fixture.kimironkoId,
      tableId: table.id,
      customerName: "Big Party",
      customerPhone: "+250 788 777 888",
      reservationDate: tomorrow(),
      startTime: "13:00",
      durationMinutes: 60,
      guestCount: 6,
      status: "pending",
    });
    expect(tooMany.ok).toBe(false);
  });

  it("counts today's bookings for the branch", async () => {
    const stats = await getReservationStats([fixture.kimironkoId]);
    expect(stats.today).toBeGreaterThanOrEqual(0);
    const all = await getReservationStats(null);
    expect(all.today).toBeGreaterThanOrEqual(stats.today);
  });
});

describe("restaurant overview", () => {
  it("aggregates menu, floor and reservation figures for the scope", async () => {
    const overview = await getRestaurantOverview(null);
    expect(overview.menu.total).toBeGreaterThan(0);
    expect(overview.tables.total).toBeGreaterThan(0);
    expect(overview.branches.length).toBe(2);

    const branchOverview = await getRestaurantOverview(
      [fixture.kimironkoId],
      fixture.kimironkoId,
    );
    expect(branchOverview.branches).toHaveLength(1);
    expect(branchOverview.branches[0].branchId).toBe(fixture.kimironkoId);
    expect(branchOverview.tables.total).toBeLessThanOrEqual(overview.tables.total);
  });
});

describe("restaurant permissions", () => {
  const permissionsFor = (role: string): PermissionId[] => {
    const definition = ROLE_DEFINITIONS.find((item) => item.name === role);
    if (!definition || definition.permissions[0] === "*") return [];
    return definition.permissions as PermissionId[];
  };

  it("lets waiters read menus and tables without changing prices", () => {
    const permissions = permissionsFor("waiter");
    expect(permissions).toContain("menu.view");
    expect(permissions).toContain("tables.view");
    expect(permissions).not.toContain("menu.pricing");
    expect(permissions).not.toContain("menu.manage");
    expect(permissions).not.toContain("tables.manage");
  });

  it("lets cashiers see availability but not manage tables or reservations", () => {
    const permissions = permissionsFor("cashier");
    expect(permissions).toContain("tables.view");
    expect(permissions).toContain("reservations.view");
    expect(permissions).not.toContain("tables.manage");
    expect(permissions).not.toContain("reservations.manage");
  });

  it("gives branch managers their branch and receptionists the reservation book", () => {
    const manager = permissionsFor("branch_manager");
    expect(manager).toContain("menu.pricing");
    expect(manager).toContain("tables.manage");
    expect(manager).toContain("reservations.manage");

    const reception = permissionsFor("accommodation_receptionist");
    expect(reception).toContain("reservations.manage");
    expect(reception).toContain("tables.manage");
  });

  it("keeps the super administrator unrestricted", () => {
    expect(fixture.admin!.roleName).toBe("super_admin");
    expect(fixture.admin!.permissions.length).toBeGreaterThan(10);
  });
});

describe("persistence", () => {
  it("keeps categories, tables and reservations after fresh reads", async () => {
    const category = await createMenuCategory(fixture.admin!, {
      name: unique("Persist"),
      sortOrder: 95,
      isActive: true,
    });
    expect(category.ok).toBe(true);

    const categoryId = (category as { id: string }).id;
    const [stored] = await db
      .select()
      .from(menuCategories)
      .where(eq(menuCategories.id, categoryId));
    expect(stored).toBeTruthy();

    const counts = {
      tables: (await db.select().from(restaurantTables)).length,
      reservations: (await db.select().from(reservations)).length,
    };
    expect(counts.tables).toBeGreaterThan(0);
    expect(counts.reservations).toBeGreaterThan(0);

    await deleteMenuCategory(fixture.admin!, categoryId);
    const [gone] = await db
      .select()
      .from(menuCategories)
      .where(eq(menuCategories.id, categoryId));
    expect(gone).toBeUndefined();
  });
});
