"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Brand } from "@/components/brand";
import {
  BranchIcon,
  DashboardIcon,
  CloseIcon,
  KitchenIcon,
  LogoutIcon,
  MenuIcon,
  MenuBookIcon,
  PosIcon,
  ReceiptIcon,
  ReservationIcon,
  RestaurantIcon,
  TableIcon,
  ScrollIcon,
  SettingsIcon,
  ShieldIcon,
  StaffIcon,
  UserIcon,
} from "@/components/icons";
import type { NavItem, NavIcon } from "@/lib/navigation";
import { logoutAction } from "@/app/actions/auth";

const ICONS: Record<NavIcon, (props: { className?: string }) => ReactNode> = {
  dashboard: DashboardIcon,
  pos: PosIcon,
  orders: ReceiptIcon,
  menu: MenuBookIcon,
  restaurant: RestaurantIcon,
  kitchen: KitchenIcon,
  tables: TableIcon,
  reservations: ReservationIcon,
  branches: BranchIcon,
  staff: StaffIcon,
  roles: ShieldIcon,
  audit: ScrollIcon,
  settings: SettingsIcon,
  account: UserIcon,
};

export interface ShellUser {
  fullName: string;
  email: string;
  roleLabel: string;
  branchName: string | null;
  branchCode: string | null;
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function NavList({
  items,
  onNavigate,
}: {
  items: NavItem[];
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav className="space-y-1" aria-label="Main navigation">
      {items.map((item) => {
        const Icon = ICONS[item.icon];
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13.5px] font-medium transition ${
              active
                ? "bg-cream/[0.09] text-cream shadow-[inset_2px_0_0_var(--color-ember)]"
                : "text-cream/55 hover:bg-cream/[0.05] hover:text-cream/85"
            }`}
          >
            <Icon
              className={`h-[18px] w-[18px] shrink-0 ${
                active ? "text-ember" : "text-cream/40 group-hover:text-cream/70"
              }`}
            />
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarContent({
  user,
  items,
  businessName,
  onNavigate,
}: {
  user: ShellUser;
  items: NavItem[];
  businessName: string;
  onNavigate?: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="px-5 pb-5 pt-6">
        <Brand />
        <p className="mt-4 truncate text-[11px] uppercase tracking-[0.16em] text-cream/30">
          {businessName}
        </p>
      </div>

      <div className="mx-4 mb-4 rounded-lg border border-cream/10 bg-cream/[0.04] px-3 py-2.5">
        <p className="text-[10px] uppercase tracking-[0.2em] text-cream/35">
          Signed-in branch
        </p>
        <p className="mt-1 truncate text-[13px] text-cream/80">
          {user.branchName ?? "All branches · consolidated"}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-3 scrollbar-thin">
        <NavList items={items} onNavigate={onNavigate} />
      </div>

      <div className="border-t border-cream/10 p-3">
        <div className="flex items-center gap-3 rounded-lg px-2 py-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ember/15 text-[12px] font-semibold text-ember ring-1 ring-ember/30">
            {initials(user.fullName) || "VK"}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium text-cream/90">
              {user.fullName}
            </p>
            <p className="truncate text-[11px] text-cream/40">{user.roleLabel}</p>
          </div>
        </div>
        <form action={logoutAction}>
          <button
            type="submit"
            className="mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium text-cream/50 transition hover:bg-cream/[0.05] hover:text-cream/85"
          >
            <LogoutIcon className="h-[18px] w-[18px] text-cream/40" />
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}

export function AppShell({
  user,
  items,
  businessName,
  notice,
  children,
}: {
  user: ShellUser;
  items: NavItem[];
  businessName: string;
  notice?: ReactNode;
  children: ReactNode;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDrawerOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  return (
    <div className="min-h-svh bg-cream">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[17.5rem] flex-col bg-charcoal lg:flex">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(120% 70% at 0% 0%, rgba(217,119,66,0.14) 0%, rgba(26,22,19,0) 52%)",
          }}
        />
        <div className="relative flex h-full flex-col">
          <SidebarContent
            user={user}
            items={items}
            businessName={businessName}
          />
        </div>
      </aside>

      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-line bg-cream/95 px-4 py-3 backdrop-blur lg:hidden">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-white text-ink"
          aria-label="Open navigation"
          aria-expanded={drawerOpen}
        >
          <MenuIcon className="h-5 w-5" />
        </button>
        <Brand tone="light" compact />
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-charcoal text-[11px] font-semibold text-cream">
          {initials(user.fullName) || "VK"}
        </span>
      </header>

      {drawerOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-ink/60 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-[17.5rem] bg-charcoal shadow-2xl">
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              className="absolute right-3 top-3 z-10 inline-flex h-8 w-8 items-center justify-center rounded-lg text-cream/60 hover:bg-cream/10 hover:text-cream"
              aria-label="Close navigation"
            >
              <CloseIcon className="h-5 w-5" />
            </button>
            <SidebarContent
              user={user}
              items={items}
              businessName={businessName}
              onNavigate={() => setDrawerOpen(false)}
            />
          </div>
        </div>
      ) : null}

      <div className="lg:pl-[17.5rem]">
        <main className="mx-auto w-full max-w-[90rem] px-4 pb-16 pt-5 sm:px-6 lg:px-10 lg:pt-9">
          {notice}
          {children}
        </main>
      </div>
    </div>
  );
}
