import { relations, sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

const createdAt = () =>
  integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`);

const updatedAt = () =>
  integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`)
    .$onUpdateFn(() => new Date());

/* -------------------------------------------------------------------------- */
/* Roles & permissions                                                        */
/* -------------------------------------------------------------------------- */

export const roles = sqliteTable("roles", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  label: text("label").notNull(),
  description: text("description"),
  rank: integer("rank").notNull().default(100),
  isSystem: integer("is_system", { mode: "boolean" }).notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const permissions = sqliteTable("permissions", {
  id: text("id").primaryKey(),
  label: text("label").notNull(),
  description: text("description"),
  category: text("category").notNull().default("general"),
  createdAt: createdAt(),
});

export const rolePermissions = sqliteTable(
  "role_permissions",
  {
    roleId: text("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    permissionId: text("permission_id")
      .notNull()
      .references(() => permissions.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.roleId, table.permissionId] })],
);

/* -------------------------------------------------------------------------- */
/* Branches                                                                   */
/* -------------------------------------------------------------------------- */

export const branches = sqliteTable(
  "branches",
  {
    id: id(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    code: text("code").notNull().unique(),
    address: text("address").notNull(),
    city: text("city").notNull().default("Kigali"),
    phone: text("phone"),
    email: text("email"),
    openingTime: text("opening_time").notNull().default("08:00"),
    closingTime: text("closing_time").notNull().default("23:00"),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index("branches_active_idx").on(table.isActive)],
);

/* -------------------------------------------------------------------------- */
/* Users, sessions, password resets                                           */
/* -------------------------------------------------------------------------- */

export const users = sqliteTable(
  "users",
  {
    id: id(),
    email: text("email").notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    fullName: text("full_name").notNull(),
    phone: text("phone"),
    roleId: text("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "restrict" }),
    branchId: text("branch_id").references(() => branches.id, {
      onDelete: "set null",
    }),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    mustChangePassword: integer("must_change_password", { mode: "boolean" })
      .notNull()
      .default(false),
    lastLoginAt: integer("last_login_at", { mode: "timestamp_ms" }),
    passwordChangedAt: integer("password_changed_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("users_branch_idx").on(table.branchId),
    index("users_role_idx").on(table.roleId),
  ],
);

export const staffProfiles = sqliteTable(
  "staff_profiles",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: "cascade" }),
    employeeCode: text("employee_code").notNull().unique(),
    jobTitle: text("job_title"),
    nationalId: text("national_id"),
    dateOfBirth: text("date_of_birth"),
    gender: text("gender"),
    residentialAddress: text("residential_address"),
    emergencyContactName: text("emergency_contact_name"),
    emergencyContactPhone: text("emergency_contact_phone"),
    hiredAt: text("hired_at"),
    employmentType: text("employment_type").notNull().default("full_time"),
    notes: text("notes"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index("staff_profiles_hired_idx").on(table.hiredAt)],
);

export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(), // sha256 of the session token
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: createdAt(),
  },
  (table) => [
    index("sessions_user_idx").on(table.userId),
    index("sessions_expiry_idx").on(table.expiresAt),
  ],
);

export const passwordResetTokens = sqliteTable(
  "password_reset_tokens",
  {
    id: text("id").primaryKey(), // sha256 of the reset token
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    usedAt: integer("used_at", { mode: "timestamp_ms" }),
    requestedIp: text("requested_ip"),
    createdAt: createdAt(),
  },
  (table) => [index("password_reset_user_idx").on(table.userId)],
);

/* -------------------------------------------------------------------------- */
/* Audit logs                                                                 */
/* -------------------------------------------------------------------------- */

export const auditLogs = sqliteTable(
  "audit_logs",
  {
    id: id(),
    actorUserId: text("actor_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    actorName: text("actor_name"),
    actorEmail: text("actor_email"),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    branchId: text("branch_id").references(() => branches.id, {
      onDelete: "set null",
    }),
    description: text("description"),
    metadata: text("metadata", { mode: "json" }).$type<
      Record<string, unknown>
    >(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: createdAt(),
  },
  (table) => [
    index("audit_logs_created_idx").on(table.createdAt),
    index("audit_logs_branch_idx").on(table.branchId),
    index("audit_logs_entity_idx").on(table.entityType, table.entityId),
  ],
);

/* -------------------------------------------------------------------------- */
/* Business settings                                                          */
/* -------------------------------------------------------------------------- */

export const businessSettings = sqliteTable("business_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  type: text("type").notNull().default("text"),
  group: text("group").notNull().default("general"),
  label: text("label").notNull(),
  description: text("description"),
  updatedByUserId: text("updated_by_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  updatedAt: updatedAt(),
});

/* -------------------------------------------------------------------------- */
/* Menu                                                                       */
/* -------------------------------------------------------------------------- */

export const menuCategories = sqliteTable(
  "menu_categories",
  {
    id: id(),
    name: text("name").notNull().unique(),
    description: text("description"),
    sortOrder: integer("sort_order").notNull().default(100),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index("menu_categories_order_idx").on(table.sortOrder)],
);

export const menuItems = sqliteTable(
  "menu_items",
  {
    id: id(),
    categoryId: text("category_id")
      .notNull()
      .references(() => menuCategories.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    description: text("description"),
    /** Stored in minor currency units (cents) to keep money arithmetic exact. */
    price: integer("price").notNull(),
    station: text("station").notNull().default("kitchen"),
    /** Relative path of the uploaded photograph, served by /api/menu-images. */
    imagePath: text("image_path"),
    prepMinutes: integer("prep_minutes"),
    isFeatured: integer("is_featured", { mode: "boolean" })
      .notNull()
      .default(false),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("menu_items_category_idx").on(table.categoryId),
  ],
);

/**
 * Inventory items track stock levels per branch.
 */
export const inventoryItems = sqliteTable(
  "inventory_items",
  {
    id: id(),
    name: text("name").notNull(),
    unit: text("unit").notNull().default("pcs"),
    currentStock: integer("current_stock").notNull().default(0),
    minimumStock: integer("minimum_stock").notNull().default(0),
    branchId: text("branch_id").references(() => branches.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index("inventory_items_branch_idx").on(table.branchId)],
);

/**
 * Recipes define how menu items are prepared with ingredient quantities.
 */
export const recipes = sqliteTable(
  "recipes",
  {
    id: id(),
    name: text("name").notNull(),
    description: text("description"),
    prepMinutes: integer("prep_minutes").notNull().default(10),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [],
);

/**
 * Recipe ingredients link recipes to inventory items with required quantities.
 */
export const recipeIngredients = sqliteTable(
  "recipe_ingredients",
  {
    id: id(),
    recipeId: text("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    inventoryItemId: text("inventory_item_id")
      .notNull()
      .references(() => inventoryItems.id, { onDelete: "cascade" }),
    quantity: integer("quantity").notNull().default(1),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [primaryKey({ columns: [table.recipeId, table.inventoryItemId] })],
);

/**    index("menu_items_active_idx").on(table.isActive),
  ],
);

/**
 * Per-branch menu row: availability plus an optional price override so the two
 * houses can sell the same dish at different prices. No row means "on sale at
 * the brand price".
 */
export const branchMenuItems = sqliteTable(
  "branch_menu_items",
  {
    branchId: text("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "cascade" }),
    menuItemId: text("menu_item_id")
      .notNull()
      .references(() => menuItems.id, { onDelete: "cascade" }),
    isAvailable: integer("is_available", { mode: "boolean" })
      .notNull()
      .default(true),
    priceOverride: integer("price_override"),
    updatedAt: updatedAt(),
  },
  (table) => [primaryKey({ columns: [table.branchId, table.menuItemId] })],
);

export const TABLE_STATUSES = [
  "available",
  "occupied",
  "reserved",
  "unavailable",
] as const;

/* -------------------------------------------------------------------------- */
/* Tables & reservations                                                      */
/* -------------------------------------------------------------------------- */

export const restaurantTables = sqliteTable(
  "restaurant_tables",
  {
    id: id(),
    branchId: text("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "cascade" }),
    /** Short label printed on the floor plan and used on tickets, e.g. T-04. */
    code: text("code").notNull(),
    name: text("name"),
    capacity: integer("capacity").notNull().default(4),
    section: text("section").notNull().default("Main room"),
    status: text("status").notNull().default("available"),
    /** Stable token encoded in the table's QR code; never reused. */
    qrToken: text("qr_token").notNull().unique(),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("restaurant_tables_branch_code_idx").on(
      table.branchId,
      table.code,
    ),
    index("restaurant_tables_branch_idx").on(table.branchId),
  ],
);

export const RESERVATION_STATUSES = [
  "pending",
  "confirmed",
  "seated",
  "completed",
  "cancelled",
  "no_show",
] as const;

/** Statuses that hold a table and therefore block overlapping bookings. */
export const RESERVATION_BLOCKING_STATUSES = [
  "pending",
  "confirmed",
  "seated",
] as const;

export const reservations = sqliteTable(
  "reservations",
  {
    id: id(),
    branchId: text("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "restrict" }),
    tableId: text("table_id").references(() => restaurantTables.id, {
      onDelete: "set null",
    }),
    customerName: text("customer_name").notNull(),
    customerPhone: text("customer_phone").notNull(),
    /** Business date (Africa/Kigali) as YYYY-MM-DD. */
    reservationDate: text("reservation_date").notNull(),
    /** Local start time as HH:MM. */
    startTime: text("start_time").notNull(),
    durationMinutes: integer("duration_minutes").notNull().default(90),
    guestCount: integer("guest_count").notNull().default(2),
    status: text("status").notNull().default("pending"),
    specialRequests: text("special_requests"),
    cancellationReason: text("cancellation_reason"),
    createdByUserId: text("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    updatedByUserId: text("updated_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    confirmedAt: integer("confirmed_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("reservations_branch_date_idx").on(
      table.branchId,
      table.reservationDate,
    ),
    index("reservations_table_date_idx").on(
      table.tableId,
      table.reservationDate,
    ),
    index("reservations_status_idx").on(table.status),
  ],
);

/* -------------------------------------------------------------------------- */
/* Orders & payments                                                          */
/* -------------------------------------------------------------------------- */

export const orders = sqliteTable(
  "orders",
  {
    id: id(),
    orderNumber: text("order_number").notNull().unique(),
    branchId: text("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "restrict" }),
    status: text("status").notNull().default("pending"),
    /** Kitchen progress, independent from payment status. */
    fulfillmentStatus: text("fulfillment_status").notNull().default("queued"),
    fulfillmentUpdatedAt: integer("fulfillment_updated_at", {
      mode: "timestamp_ms",
    }),
    channel: text("channel").notNull().default("dine_in"),
    subtotal: integer("subtotal").notNull().default(0),
    serviceCharge: integer("service_charge").notNull().default(0),
    tax: integer("tax").notNull().default(0),
    total: integer("total").notNull().default(0),
    currency: text("currency").notNull().default("RWF"),
    customerName: text("customer_name"),
    tableLabel: text("table_label"),
    guestCount: integer("guest_count"),
    notes: text("notes"),
    cancelledReason: text("cancelled_reason"),
    createdByUserId: text("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    paidAt: integer("paid_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("orders_branch_created_idx").on(table.branchId, table.createdAt),
    index("orders_status_idx").on(table.status),
  ],
);

export const orderItems = sqliteTable(
  "order_items",
  {
    id: id(),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    menuItemId: text("menu_item_id").references(() => menuItems.id, {
      onDelete: "set null",
    }),
    /** Snapshot so a receipt never changes when the menu is repriced. */
    nameSnapshot: text("name_snapshot").notNull(),
    unitPrice: integer("unit_price").notNull(),
    quantity: integer("quantity").notNull(),
    lineTotal: integer("line_total").notNull(),
    notes: text("notes"),
    /** Station-level progress; the order status is the roll-up of these lines. */
    fulfillmentStatus: text("fulfillment_status").notNull().default("queued"),
    fulfillmentUpdatedAt: integer("fulfillment_updated_at", {
      mode: "timestamp_ms",
    }),
    createdAt: createdAt(),
  },
  (table) => [index("order_items_order_idx").on(table.orderId)],
);

export const payments = sqliteTable(
  "payments",
  {
    id: id(),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    method: text("method").notNull().default("cash"),
    amount: integer("amount").notNull(),
    reference: text("reference"),
    receivedByUserId: text("received_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: createdAt(),
  },
  (table) => [index("payments_order_idx").on(table.orderId)],
);

/* -------------------------------------------------------------------------- */
/* Suppliers                                                                  */
/* -------------------------------------------------------------------------- */

export const suppliers = sqliteTable(
  "suppliers",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    contactPerson: text("contact_person"),
    phone: text("phone"),
    email: text("email"),
    address: text("address"),
    notes: text("notes"),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
});

/* -------------------------------------------------------------------------- */
/* Stock Movements                                                            */
/* -------------------------------------------------------------------------- */

export const stockMovements = sqliteTable(
  "stock_movements",
  {
    id: id(),
    inventoryItemId: text("inventory_item_id")
      .notNull()
      .references(() => inventoryItems.id, { onDelete: "cascade" }),
    movementType: text("movement_type").notNull(),
    quantity: integer("quantity").notNull().default(0),
    sourceBranchId: text("source_branch_id").references(() => branches.id, { onDelete: "set null" }),
    destinationBranchId: text("destination_branch_id").references(() => branches.id, { onDelete: "set null" }),
    referenceType: text("reference_type"),
    referenceId: text("reference_id"),
    staffUserId: text("staff_user_id").references(() => users.id, { onDelete: "set null" }),
    reason: text("reason"),
    createdAt: createdAt(),
  },
  (table) => [index("stock_movements_inventory_item_idx").on(table.inventoryItemId)],
);

/**
 * Purchase orders from suppliers.
 */
export const purchaseOrders = sqliteTable(
  "purchase_orders",
  {
    id: id(),
    orderNumber: text("order_number").notNull(),
    supplierId: text("supplier_id")
      .notNull()
      .references(() => suppliers.id, { onDelete: "restrict" }),
    branchId: text("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "restrict" }),
    status: text("status").notNull().default("draft"),
    expectedDelivery: text("expected_delivery"),
    notes: text("notes"),
    totalAmount: integer("total_amount").notNull().default(0),
    paidAmount: integer("paid_amount").notNull().default(0),
    confirmedAt: integer("confirmed_at", { mode: "timestamp_ms" }),
    receivedAt: integer("received_at", { mode: "timestamp_ms" }),
    createdByUserId: text("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("purchase_orders_branch_created_idx").on(table.branchId, table.createdAt),
    index("purchase_orders_status_idx").on(table.status),
  ],
);

/**
 * Purchase order items.
 */
export const purchaseOrderItems = sqliteTable(
  "purchase_order_items",
  {
    id: id(),
    purchaseOrderId: text("purchase_order_id")
      .notNull()
      .references(() => purchaseOrders.id, { onDelete: "cascade" }),
    inventoryItemId: text("inventory_item_id").references(() => inventoryItems.id, { onDelete: "restrict" }),
    quantityOrdered: integer("quantity_ordered").notNull().default(1),
    quantityReceived: integer("quantity_received").notNull().default(0),
    unitCost: integer("unit_cost").notNull().default(0),
    lineTotal: integer("line_total").notNull().default(0),
    notes: text("notes"),
    createdAt: createdAt(),
  },
  (table) => [index("purchase_order_items_order_idx").on(table.purchaseOrderId)],
);

/**
 * Room service orders for accommodation service.
 */
export const roomServiceOrders = sqliteTable(
  "room_service_orders",
  {
    id: id(),
    branchId: text("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "restrict" }),
    status: text("status").notNull().default("pending"),
    fulfillmentStatus: text("fulfillment_status").notNull().default("queued"),
    subtotal: integer("subtotal").notNull().default(0),
    serviceCharge: integer("service_charge").notNull().default(0),
    tax: integer("tax").notNull().default(0),
    total: integer("total").notNull().default(0),
    currency: text("currency").notNull().default("RWF"),
    specialRequests: text("special_requests"),
    createdByUserId: text("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("room_service_orders_branch_created_idx").on(table.branchId, table.createdAt),
    index("room_service_orders_status_idx").on(table.status),
  ],
);

/**
 * Room service order items.
 */
export const roomServiceItems = sqliteTable(
  "room_service_items",
  {
    id: id(),
    orderId: text("order_id").notNull()
      .references(() => roomServiceOrders.id, { onDelete: "cascade" }),
    menuItemId: text("menu_item_id").references(() => menuItems.id, {
      onDelete: "set null",
    }),
    nameSnapshot: text("name_snapshot").notNull(),
    unitPrice: integer("unit_price").notNull(),
    quantity: integer("quantity").notNull(),
    lineTotal: integer("line_total").notNull(),
    notes: text("notes"),
    fulfillmentStatus: text("fulfillment_status").notNull().default("queued"),
    fulfillmentUpdatedAt: integer("fulfillment_updated_at", {
      mode: "timestamp_ms",
    }),
    createdAt: createdAt(),
  },
  (table) => [index("room_service_items_order_idx").on(table.orderId)],
);

/**
 * Accommodation reservations.
 */
export const accommodationReservations = sqliteTable(
  "accommodation_reservations",
  {
    id: id(),
    branchId: text("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "restrict" }),
    customerName: text("customer_name").notNull(),
    customerPhone: text("customer_phone").notNull(),
    checkInDate: text("check_in_date").notNull(),
    checkOutDate: text("check_out_date").notNull(),
    guestCount: integer("guest_count").notNull().default(2),
    roomType: text("room_type"),
    status: text("status").notNull().default("pending"),
    specialRequests: text("special_requests"),
    createdByUserId: text("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("accommodation_reservations_branch_date_idx").on(
      table.branchId,
      table.checkInDate,
    ),
    index("accommodation_reservations_status_idx").on(table.status),
  ],
);

/**
 * Room types and room inventory.
 */
export const rooms = sqliteTable(
  "rooms",
  {
    id: id(),
    branchId: text("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "restrict" }),
    roomNumber: text("room_number").notNull(),
    roomType: text("room_type").notNull(),
    capacity: integer("capacity").notNull().default(2),
    basePrice: integer("base_price").notNull().default(0),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index("rooms_branch_idx").on(table.branchId)],
);

/* -------------------------------------------------------------------------- */
/* Relations                                                                  */
/* -------------------------------------------------------------------------- */

export const rolesRelations = relations(roles, ({ many }) => ({
  users: many(users),
  rolePermissions: many(rolePermissions),
}));

export const permissionsRelations = relations(permissions, ({ many }) => ({
  rolePermissions: many(rolePermissions),
}));

export const rolePermissionsRelations = relations(rolePermissions, ({ one }) => ({
  role: one(roles, {
    fields: [rolePermissions.roleId],
    references: [roles.id],
  }),
  permission: one(permissions, {
    fields: [rolePermissions.permissionId],
    references: [permissions.id],
  }),
}));

export const branchesRelations = relations(branches, ({ many }) => ({
  users: many(users),
  orders: many(orders),
  tables: many(restaurantTables),
  reservations: many(reservations),
}));

export const restaurantTablesRelations = relations(
  restaurantTables,
  ({ one, many }) => ({
    branch: one(branches, {
      fields: [restaurantTables.branchId],
      references: [branches.id],
    }),
    reservations: many(reservations),
  }),
);

export const reservationsRelations = relations(reservations, ({ one }) => ({
  branch: one(branches, {
    fields: [reservations.branchId],
    references: [branches.id],
  }),
  table: one(restaurantTables, {
    fields: [reservations.tableId],
    references: [restaurantTables.id],
  }),
  createdBy: one(users, {
    fields: [reservations.createdByUserId],
    references: [users.id],
  }),
}));

export type RestaurantTable = typeof restaurantTables.$inferSelect;
export type Reservation = typeof reservations.$inferSelect;

export const usersRelations = relations(users, ({ one, many }) => ({
  role: one(roles, { fields: [users.roleId], references: [roles.id] }),
  branch: one(branches, { fields: [users.branchId], references: [branches.id] }),
  staffProfile: one(staffProfiles),
  sessions: many(sessions),
}));

export const staffProfilesRelations = relations(staffProfiles, ({ one }) => ({
  user: one(users, { fields: [staffProfiles.userId], references: [users.id] }),
}));

export const menuCategoriesRelations = relations(menuCategories, ({ many }) => ({
  items: many(menuItems),
}));

export const menuItemsRelations = relations(menuItems, ({ one, many }) => ({
  category: one(menuCategories, {
    fields: [menuItems.categoryId],
    references: [menuCategories.id],
  }),
  branchOverrides: many(branchMenuItems),
  orderItems: many(orderItems),
}));

export const branchMenuItemsRelations = relations(branchMenuItems, ({ one }) => ({
  branch: one(branches, {
    fields: [branchMenuItems.branchId],
    references: [branches.id],
  }),
  menuItem: one(menuItems, {
    fields: [branchMenuItems.menuItemId],
    references: [menuItems.id],
  }),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  branch: one(branches, {
    fields: [orders.branchId],
    references: [branches.id],
  }),
  createdBy: one(users, {
    fields: [orders.createdByUserId],
    references: [users.id],
  }),
  items: many(orderItems),
  payments: many(payments),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
  menuItem: one(menuItems, {
    fields: [orderItems.menuItemId],
    references: [menuItems.id],
  }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  order: one(orders, {
    fields: [payments.orderId],
    references: [orders.id],
  }),
  receivedBy: one(users, {
    fields: [payments.receivedByUserId],
    references: [users.id],
  }),
}))

/* -------------------------------------------------------------------------- */
/* Cashier Shifts                                                             */
/* -------------------------------------------------------------------------- */

export const cashierShifts = sqliteTable(
  "cashier_shifts",
  {
    id: id(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    openingBalance: integer("opening_balance").notNull().default(0),
    closingBalance: integer("closing_balance"),
    expectedBalance: integer("expected_balance").notNull().default(0),
    actualBalance: integer("actual_balance").notNull().default(0),
    openingTime: integer("opening_time", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`),
    closingTime: integer("closing_time", { mode: "timestamp_ms" }),
    status: text("status").notNull().default("open"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index("cashier_shifts_user_idx").on(table.userId)],
);
;

export type Role = typeof roles.$inferSelect;
export type Permission = typeof permissions.$inferSelect;
export type Branch = typeof branches.$inferSelect;
export type User = typeof users.$inferSelect;
export type StaffProfile = typeof staffProfiles.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
export type BusinessSetting = typeof businessSettings.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type MenuCategory = typeof menuCategories.$inferSelect;
export type MenuItem = typeof menuItems.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
export type Payment = typeof payments.$inferSelect;
