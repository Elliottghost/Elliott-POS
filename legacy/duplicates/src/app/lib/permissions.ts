/**
 * Central permission catalogue. Permission ids are stable database keys —
 * rename the label, never the id.
 */

export const PERMISSIONS = [
  {
    id: "dashboard.view",
    label: "View dashboard",
    category: "Dashboard",
    description: "Access the operational dashboard.",
  },
  {
    id: "branches.view",
    label: "View branches",
    category: "Branches",
    description: "See branch records and branch details.",
  },
  {
    id: "branches.manage",
    label: "Manage branches",
    category: "Branches",
    description: "Create and edit branches.",
  },
  {
    id: "staff.view",
    label: "View staff",
    category: "Staff",
    description: "See staff accounts and profiles.",
  },
  {
    id: "staff.manage",
    label: "Manage staff",
    category: "Staff",
    description: "Create, edit, deactivate staff and reset passwords.",
  },
  {
    id: "roles.view",
    label: "View roles & permissions",
    category: "Access control",
    description: "Inspect the role permission matrix.",
  },
  {
    id: "roles.manage",
    label: "Manage roles & permissions",
    category: "Access control",
    description: "Grant or revoke permissions on non-system roles.",
  },
  {
    id: "audit.view",
    label: "View audit logs",
    category: "Compliance",
    description: "Read the audit trail for the authorised scope.",
  },
  {
    id: "settings.view",
    label: "View business settings",
    category: "Settings",
    description: "See business-wide configuration.",
  },
  {
    id: "settings.manage",
    label: "Manage business settings",
    category: "Settings",
    description: "Update business-wide configuration.",
  },
  {
    id: "menu.view",
    label: "View menu",
    category: "Menu",
    description: "See menu categories, dishes and prices.",
  },
  {
    id: "menu.manage",
    label: "Manage menu",
    category: "Menu",
    description: "Create and edit categories, dishes, prices and branch availability.",
  },
  {
    id: "menu.availability",
    label: "Mark dishes sold out",
    category: "Menu",
    description: "Turn dishes on or off for the assigned branch only.",
  },
  {
    id: "menu.pricing",
    label: "Set branch prices",
    category: "Menu",
    description:
      "Override menu prices for the assigned branch without changing the brand price list.",
  },
  {
    id: "tables.view",
    label: "View tables",
    category: "Restaurant floor",
    description: "See the floor plan, seating capacity and table status.",
  },
  {
    id: "tables.manage",
    label: "Manage tables",
    category: "Restaurant floor",
    description:
      "Add, edit, print QR codes for and change the status of branch tables.",
  },
  {
    id: "reservations.view",
    label: "View reservations",
    category: "Reservations",
    description: "Read the reservation book for the authorised branch.",
  },
  {
    id: "reservations.manage",
    label: "Manage reservations",
    category: "Reservations",
    description:
      "Create, confirm, edit, seat, complete and cancel table reservations.",
  },
  {
    id: "kitchen.view",
    label: "View kitchen board",
    category: "Kitchen",
    description: "See paid orders waiting to be prepared, ready or served.",
  },
  {
    id: "kitchen.manage",
    label: "Move kitchen orders",
    category: "Kitchen",
    description: "Advance a paid order through preparing, ready and served.",
  },
  {
    id: "orders.view",
    label: "View orders",
    category: "Point of sale",
    description: "See orders and receipts for the authorised branch.",
  },
  {
    id: "orders.create",
    label: "Create orders",
    category: "Point of sale",
    description: "Capture orders from the point of sale terminal.",
  },
  {
    id: "orders.manage",
    label: "Manage orders",
    category: "Point of sale",
    description: "Cancel orders and correct mistakes at the till.",
  },
  {
    id: "payments.collect",
    label: "Collect payments",
    category: "Point of sale",
    description: "Record cash, mobile money and card payments against orders.",
  },
  {
    id: "reports.view",
    label: "View branch reports",
    category: "Reports",
    description: "See performance figures for the assigned branch.",
  },
  {
    id: "reports.view_all",
    label: "View consolidated reports",
    category: "Reports",
    description: "Compare figures across every branch.",
  },
] as const;

export type PermissionId = (typeof PERMISSIONS)[number]["id"];

export const ALL_PERMISSION_IDS = PERMISSIONS.map((p) => p.id) as PermissionId[];

export type RoleName =
  | "super_admin"
  | "branch_manager"
  | "cashier"
  | "waiter"
  | "kitchen_staff"
  | "accommodation_receptionist"
  | "inventory_manager";

export interface RoleDefinition {
  name: RoleName;
  label: string;
  description: string;
  rank: number;
  /** "*" grants every permission and bypasses branch scoping. */
  permissions: PermissionId[] | ["*"];
}

export const ROLE_DEFINITIONS: RoleDefinition[] = [
  {
    name: "super_admin",
    label: "Super Administrator",
    description:
      "Full control of every branch, staff account, permission and setting.",
    rank: 1,
    permissions: ["*"],
  },
  {
    name: "branch_manager",
    label: "Branch Manager",
    description:
      "Runs a single branch: staff, branch performance and local audit trail.",
    rank: 10,
    permissions: [
      "dashboard.view",
      "branches.view",
      "staff.view",
      "staff.manage",
      "menu.view",
      "menu.availability",
      "menu.pricing",
      "kitchen.view",
      "kitchen.manage",
      "orders.view",
      "orders.create",
      "orders.manage",
      "payments.collect",
      "tables.view",
      "tables.manage",
      "reservations.view",
      "reservations.manage",
      "reports.view",
      "audit.view",
      "settings.view",
    ],
  },
  {
    name: "cashier",
    label: "Cashier",
    description: "Handles payments and the branch till for the day.",
    rank: 20,
    permissions: [
      "dashboard.view",
      "menu.view",
      "kitchen.view",
      "orders.view",
      "orders.create",
      "payments.collect",
      "tables.view",
      "reservations.view",
      "reports.view",
    ],
  },
  {
    name: "waiter",
    label: "Waiter / Waitress",
    description: "Serves guests on the floor of the assigned branch.",
    rank: 30,
    permissions: [
      "dashboard.view",
      "menu.view",
      "kitchen.view",
      "orders.view",
      "orders.create",
      "tables.view",
      "reservations.view",
    ],
  },
  {
    name: "kitchen_staff",
    label: "Kitchen Staff",
    description: "Prepares and dispatches kitchen orders.",
    rank: 30,
    permissions: [
      "dashboard.view",
      "menu.view",
      "kitchen.view",
      "kitchen.manage",
      "orders.view",
    ],
  },
  {
    name: "accommodation_receptionist",
    label: "Accommodation Receptionist",
    description: "Handles check-in and guest accommodation at the branch.",
    rank: 30,
    permissions: [
      "dashboard.view",
      "menu.view",
      "kitchen.view",
      "orders.view",
      "orders.create",
      "payments.collect",
      "tables.view",
      "tables.manage",
      "reservations.view",
      "reservations.manage",
      "reports.view",
    ],
  },
  {
    name: "inventory_manager",
    label: "Inventory Manager",
    description: "Oversees stock levels and supply movements for a branch.",
    rank: 25,
    permissions: [
      "dashboard.view",
      "menu.view",
      "menu.manage",
      "menu.availability",
      "orders.view",
      "reports.view",
    ],
  },
];

export const ROLE_LABELS: Record<RoleName, string> = Object.fromEntries(
  ROLE_DEFINITIONS.map((role) => [role.name, role.label]),
) as Record<RoleName, string>;
