import type { PermissionId } from "./permissions";

export type NavIcon =
  | "dashboard"
  | "pos"
  | "orders"
  | "menu"
  | "restaurant"
  | "kitchen"
  | "tables"
  | "reservations"
  | "branches"
  | "staff"
  | "roles"
  | "audit"
  | "settings"
  | "account";

export interface NavItem {
  href: string;
  label: string;
  icon: NavIcon;
  permission?: PermissionId;
  exact?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard", permission: "dashboard.view" },
  { href: "/restaurant", label: "Restaurant", icon: "restaurant", permission: "menu.view" },
  { href: "/kitchen", label: "Kitchen", icon: "kitchen", permission: "kitchen.view" },
  { href: "/pos", label: "Point of sale", icon: "pos", permission: "orders.create" },
  { href: "/orders", label: "Orders", icon: "orders", permission: "orders.view" },
  { href: "/menu", label: "Menu", icon: "menu", permission: "menu.view" },
  { href: "/tables", label: "Tables", icon: "tables", permission: "tables.view" },
  { href: "/(app)/reservations", label: "Reservations", icon: "reservations", permission: "reservations.view" },
  { href: "/branches", label: "Branches", icon: "branches", permission: "branches.view" },
  { href: "/staff", label: "Staff", icon: "staff", permission: "staff.view" },
  { href: "/roles", label: "Roles & access", icon: "roles", permission: "roles.view" },
  { href: "/audit-logs", label: "Audit trail", icon: "audit", permission: "audit.view" },
  { href: "/settings", label: "Business settings", icon: "settings", permission: "settings.view" },
  { href: "/account", label: "My account", icon: "account" },
];
