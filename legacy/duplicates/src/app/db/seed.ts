import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  branches,
  menuCategories,
  menuItems,
  orders,
  permissions as permissionsTable,
  reservations,
  restaurantTables,
  rolePermissions,
  roles,
  staffProfiles,
  users,
} from "@/db/schema";
import { ALL_PERMISSION_IDS, PERMISSIONS, ROLE_DEFINITIONS } from "@/lib/permissions";
import { hashPassword } from "@/lib/auth/password";
import { ensureDefaultSettings } from "@/services/settings";

interface SeedAccount {
  email: string;
  fullName: string;
  password: string;
  role: string;
  branchCode: string | null;
  employeeCode: string;
  jobTitle: string;
  mustChangePassword: boolean;
}

const ACCOUNTS: SeedAccount[] = [
  {
    email: "admin@vistakigali.rw",
    fullName: "Aline Uwase",
    password: "VistaAdmin#2026",
    role: "super_admin",
    branchCode: null,
    employeeCode: "VK-0001",
    jobTitle: "Group Administrator",
    mustChangePassword: false,
  },
  {
    email: "manager.kimironko@vistakigali.rw",
    fullName: "Eric Mugisha",
    password: "Kimironko#2026",
    role: "branch_manager",
    branchCode: "KIM",
    employeeCode: "VK-0101",
    jobTitle: "Branch Manager — Kimironko",
    mustChangePassword: false,
  },
  {
    email: "manager.rondpoint@vistakigali.rw",
    fullName: "Diane Ingabire",
    password: "RondPoint#2026",
    role: "branch_manager",
    branchCode: "RDP",
    employeeCode: "VK-0201",
    jobTitle: "Branch Manager — Rond-Point",
    mustChangePassword: false,
  },
  {
    email: "cashier.kimironko@vistakigali.rw",
    fullName: "Jean Bosco Habimana",
    password: "Cashier#2026",
    role: "cashier",
    branchCode: "KIM",
    employeeCode: "VK-0102",
    jobTitle: "Head Cashier",
    mustChangePassword: true,
  },
  {
    email: "waiter.kimironko@vistakigali.rw",
    fullName: "Sandrine Mukamana",
    password: "Waiter#2026",
    role: "waiter",
    branchCode: "KIM",
    employeeCode: "VK-0103",
    jobTitle: "Senior Waitress",
    mustChangePassword: true,
  },
  {
    email: "kitchen.kimironko@vistakigali.rw",
    fullName: "Patrick Nshimiyimana",
    password: "Kitchen#2026",
    role: "kitchen_staff",
    branchCode: "KIM",
    employeeCode: "VK-0104",
    jobTitle: "Chef de Partie",
    mustChangePassword: true,
  },
  {
    email: "reception.rondpoint@vistakigali.rw",
    fullName: "Claudine Uwimana",
    password: "Reception#2026",
    role: "accommodation_receptionist",
    branchCode: "RDP",
    employeeCode: "VK-0202",
    jobTitle: "Accommodation Receptionist",
    mustChangePassword: true,
  },
  {
    email: "inventory.rondpoint@vistakigali.rw",
    fullName: "Emmanuel Rukundo",
    password: "Inventory#2026",
    role: "inventory_manager",
    branchCode: "RDP",
    employeeCode: "VK-0203",
    jobTitle: "Inventory Manager",
    mustChangePassword: true,
  },
];

async function seedRolesAndPermissions() {
  for (const permission of PERMISSIONS) {
    await db
      .insert(permissionsTable)
      .values({
        id: permission.id,
        label: permission.label,
        description: permission.description,
        category: permission.category,
      })
      .onConflictDoUpdate({
        target: permissionsTable.id,
        set: { label: permission.label, description: permission.description, category: permission.category },
      });
  }

  for (const definition of ROLE_DEFINITIONS) {
    await db
      .insert(roles)
      .values({
        id: definition.name,
        name: definition.name,
        label: definition.label,
        description: definition.description,
        rank: definition.rank,
        isSystem: true,
      })
      .onConflictDoUpdate({
        target: roles.id,
        set: { label: definition.label, description: definition.description, rank: definition.rank },
      });

    const desired =
      definition.permissions[0] === "*" ? ALL_PERMISSION_IDS : definition.permissions;
    await db.delete(rolePermissions).where(eq(rolePermissions.roleId, definition.name));
    for (const permissionId of desired) {
      await db
        .insert(rolePermissions)
        .values({ roleId: definition.name, permissionId })
        .onConflictDoNothing();
    }
  }
}

async function seedBranches() {
  const rows = [
    {
      name: "Kimironko — Ku Isangano",
      code: "KIM",
      slug: "kimironko-ku-isangano",
      address: "Ku Isangano, Kimironko",
      city: "Kigali",
      phone: "+250 788 111 001",
      email: "kimironko@vistakigali.rw",
    },
    {
      name: "Rond-Point — Kuri Azam",
      code: "RDP",
      slug: "rond-point-kuri-azam",
      address: "Kuri Azam, Rond-Point",
      city: "Kigali",
      phone: "+250 788 111 002",
      email: "rondpoint@vistakigali.rw",
    },
  ];

  const byCode = new Map<string, string>();
  for (const row of rows) {
    const [existing] = await db
      .select({ id: branches.id })
      .from(branches)
      .where(eq(branches.code, row.code))
      .limit(1);

    if (existing) {
      byCode.set(row.code, existing.id);
      continue;
    }

    const [created] = await db
      .insert(branches)
      .values({ ...row, openingTime: "08:00", closingTime: "23:30", isActive: true })
      .returning({ id: branches.id });
    byCode.set(row.code, created.id);
  }
  return byCode;
}

async function seedAccounts(branchIds: Map<string, string>) {
  for (const account of ACCOUNTS) {
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, account.email))
      .limit(1);
    if (existing) continue;

    const branchId = account.branchCode ? branchIds.get(account.branchCode) ?? null : null;
    const passwordHash = await hashPassword(account.password);

    const created = db.transaction((tx) => {
      const userRow = tx
        .insert(users)
        .values({
          email: account.email,
          passwordHash,
          fullName: account.fullName,
          roleId: account.role,
          branchId,
          isActive: true,
          mustChangePassword: account.mustChangePassword,
          passwordChangedAt: new Date(),
        })
        .returning({ id: users.id })
        .get();

      tx.insert(staffProfiles)
        .values({
          userId: userRow.id,
          employeeCode: account.employeeCode,
          jobTitle: account.jobTitle,
          hiredAt: "2024-02-01",
          employmentType: "full_time",
        })
        .run();

      return userRow;
    });

    console.log(`  · ${account.email} (${account.role})${created ? "" : ""}`);
  }
}

interface SeedDish {
  name: string;
  price: number;
  description: string;
  station: "kitchen" | "bar" | "pastry";
  prepMinutes: number;
  featured?: boolean;
}

const MENU: { category: string; sortOrder: number; items: SeedDish[] }[] = [
  {
    category: "Starters",
    sortOrder: 10,
    items: [
      { name: "Sambaza, fried", price: 950000, description: "Lake fish, lime and chilli", station: "kitchen", prepMinutes: 12 },
      { name: "Chicken liver brochette", price: 700000, description: "Grilled with onion and pepper", station: "kitchen", prepMinutes: 12 },
      { name: "Avocado & tomato salad", price: 650000, description: "With red onion and vinaigrette", station: "kitchen", prepMinutes: 8 },
    ],
  },
  {
    category: "Main Courses",
    sortOrder: 20,
    items: [
      { name: "Grilled tilapia", price: 1800000, description: "Whole fish, chips and salad", station: "kitchen", prepMinutes: 25, featured: true },
      { name: "Beef brochette platter", price: 1450000, description: "Two skewers, plantain and chips", station: "kitchen", prepMinutes: 25 },
      { name: "Goat stew", price: 1300000, description: "Slow cooked, served with rice", station: "kitchen", prepMinutes: 30 },
      { name: "Half grilled chicken", price: 1650000, description: "Chilli sauce and chips", station: "kitchen", prepMinutes: 28 },
      { name: "Isombe", price: 800000, description: "Cassava leaves, spinach and peanuts", station: "kitchen", prepMinutes: 20 },
    ],
  },
  {
    category: "Cocktails",
    sortOrder: 30,
    items: [
      { name: "Tropical cocktail", price: 850000, description: "Rum, passion fruit, lime", station: "bar", prepMinutes: 6, featured: true },
      { name: "Primus, 33cl", price: 350000, description: "Rwanda's lager", station: "bar", prepMinutes: 2 },
      { name: "Mutzig, 33cl", price: 350000, description: "Pilsner", station: "bar", prepMinutes: 2 },
    ],
  },
  {
    category: "Beverages",
    sortOrder: 40,
    items: [
      { name: "Fanta or Coke, 30cl", price: 200000, description: "Chilled", station: "bar", prepMinutes: 2 },
      { name: "Fresh passion juice", price: 400000, description: "Pressed to order", station: "bar", prepMinutes: 5 },
      { name: "Still water, 50cl", price: 150000, description: "", station: "bar", prepMinutes: 1 },
      { name: "Rwandan coffee", price: 250000, description: "Black or with milk", station: "bar", prepMinutes: 5 },
    ],
  },
  {
    category: "Wines",
    sortOrder: 35,
    items: [
      { name: "House red wine, glass", price: 700000, description: "Selected every season", station: "bar", prepMinutes: 2 },
    ],
  },
  {
    category: "Spirits",
    sortOrder: 36,
    items: [
      { name: "Whisky, dose", price: 600000, description: "Served with ice on request", station: "bar", prepMinutes: 2 },
    ],
  },
  {
    category: "Desserts",
    sortOrder: 50,
    items: [
      { name: "Chocolate fondant", price: 650000, description: "With vanilla ice cream", station: "pastry", prepMinutes: 15 },
      { name: "Seasonal fruit plate", price: 500000, description: "Market fruit of the day", station: "pastry", prepMinutes: 10 },
    ],
  },
];

async function seedMenu() {
  const [existing] = await db.select({ id: menuItems.id }).from(menuItems).limit(1);
  if (existing) return;

  for (const group of MENU) {
    const [category] = await db
      .insert(menuCategories)
      .values({
        name: group.category,
        sortOrder: group.sortOrder,
        isActive: true,
      })
      .onConflictDoNothing({ target: menuCategories.name })
      .returning({ id: menuCategories.id });

    const categoryId =
      category?.id ??
      (
        await db
          .select({ id: menuCategories.id })
          .from(menuCategories)
          .where(eq(menuCategories.name, group.category))
          .limit(1)
      )[0]?.id;

    if (!categoryId) continue;

    for (const dish of group.items) {
      await db.insert(menuItems).values({
        categoryId,
        name: dish.name,
        price: dish.price,
        description: dish.description || null,
        station: dish.station,
        prepMinutes: dish.prepMinutes,
        isFeatured: dish.featured ?? false,
        isActive: true,
      });
    }
  }
}

const TABLE_PLAN = [
  { code: "T-01", capacity: 2, section: "Main room" },
  { code: "T-02", capacity: 2, section: "Main room" },
  { code: "T-03", capacity: 4, section: "Main room" },
  { code: "T-04", capacity: 4, section: "Main room" },
  { code: "T-05", capacity: 6, section: "Terrace" },
  { code: "T-06", capacity: 6, section: "Terrace" },
  { code: "T-07", capacity: 8, section: "Garden" },
  { code: "T-08", capacity: 10, section: "Garden" },
];

async function seedRestaurantTables(branchIds: Map<string, string>) {
  const [existing] = await db
    .select({ id: restaurantTables.id })
    .from(restaurantTables)
    .limit(1);
  if (existing) return;

  for (const branchId of branchIds.values()) {
    for (const table of TABLE_PLAN) {
      await db.insert(restaurantTables).values({
        branchId,
        code: table.code,
        capacity: table.capacity,
        section: table.section,
        status: "available",
        qrToken: crypto.randomUUID().replace(/-/g, ""),
        isActive: true,
      });
    }
  }
}

async function seedDemoReservations(branchIds: Map<string, string>) {
  const [existing] = await db
    .select({ id: reservations.id })
    .from(reservations)
    .limit(1);
  if (existing) return;

  const today = new Date();
  const dateFor = (offset: number) =>
    new Date(today.getTime() + offset * 86400000).toISOString().slice(0, 10);

  const plans = [
    { offset: 0, time: "12:30", guests: 2, name: "Claudine Mutoni", phone: "+250 788 300 111", status: "confirmed" },
    { offset: 0, time: "19:00", guests: 6, name: "Yves Nkurunziza", phone: "+250 788 300 222", status: "pending" },
    { offset: 1, time: "13:00", guests: 4, name: "Aline Kamikazi", phone: "+250 788 300 333", status: "confirmed" },
    { offset: 2, time: "18:30", guests: 8, name: "Robert Habyarimana", phone: "+250 788 300 444", status: "pending" },
  ];

  for (const [index, branchId] of [...branchIds.values()].entries()) {
    const tables = await db
      .select({ id: restaurantTables.id, code: restaurantTables.code })
      .from(restaurantTables)
      .where(eq(restaurantTables.branchId, branchId))
      .orderBy(restaurantTables.code);
    if (tables.length === 0) continue;

    for (const [planIndex, plan] of plans.entries()) {
      const table =
        tables[(index + planIndex) % tables.length];
      await db.insert(reservations).values({
        branchId,
        tableId: table.id,
        customerName: plan.name,
        customerPhone: plan.phone,
        reservationDate: dateFor(plan.offset),
        startTime: plan.time,
        durationMinutes: 90,
        guestCount: plan.guests,
        status: plan.status,
        specialRequests:
          planIndex === 2 ? "Window table if possible." : null,
        confirmedAt: plan.status === "confirmed" ? new Date() : null,
      });
    }
  }
}

async function seedDemoOrders(branchIds: Map<string, string>) {
  const [existing] = await db.select({ id: orders.id }).from(orders).limit(1);
  if (existing) return;

  const statuses = ["paid", "paid", "paid", "served", "preparing", "pending", "cancelled"];
  const channels = ["dine_in", "dine_in", "takeaway", "room_service", "bar"];
  const [admin] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, "admin@vistakigali.rw"))
    .limit(1);

  const branchCodes = ["KIM", "RDP"];
  let sequence = 0;

  for (const code of branchCodes) {
    const branchId = branchIds.get(code);
    if (!branchId) continue;

    for (let day = 0; day < 7; day += 1) {
      const dailyOrders = 6 + ((day * 3 + code.length) % 6);
      for (let index = 0; index < dailyOrders; index += 1) {
        sequence += 1;
        const status = statuses[(sequence + day) % statuses.length];
        const subtotal = 450000 + ((sequence * 37600) % 2100000);
        const tax = Math.round(subtotal * 0.18);
        const total = subtotal + tax;
        const createdAt = new Date(Date.now() - day * 86400000 - index * 2700000);

        await db.insert(orders).values({
          orderNumber: `${code}-${String(sequence).padStart(5, "0")}`,
          branchId,
          status,
          // Historical demo orders were never cooked by this kitchen board.
          fulfillmentStatus: status === "paid" ? "served" : "queued",
          fulfillmentUpdatedAt: createdAt,
          channel: channels[sequence % channels.length],
          subtotal,
          tax,
          total,
          currency: "RWF",
          createdByUserId: admin?.id ?? null,
          paidAt: status === "paid" ? createdAt : null,
          createdAt,
          updatedAt: createdAt,
        });
      }
    }
  }
}

async function main() {
  console.log("Seeding Vista Kigali foundation…");
  await seedRolesAndPermissions();
  const branchIds = await seedBranches();
  await seedAccounts(branchIds);
  await ensureDefaultSettings();
  await seedMenu();
  await seedRestaurantTables(branchIds);

  if (process.env.SEED_DEMO_DATA === "true") {
    await seedDemoOrders(branchIds);
    await seedDemoReservations(branchIds);
    console.log("  · demo order history and reservations seeded (SEED_DEMO_DATA=true)");
  }

  console.log("\nSeed complete.");
  console.log("Super administrator: admin@vistakigali.rw / VistaAdmin#2026");
  console.log("Branch manager (Kimironko): manager.kimironko@vistakigali.rw / Kimironko#2026");
  console.log("Branch manager (Rond-Point): manager.rondpoint@vistakigali.rw / RondPoint#2026");
  console.log("Change these credentials before any real deployment.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
