import Link from "next/link";
import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { hasPermission } from "@/lib/auth/access";
import { requireUser } from "@/lib/auth/session";
import { NAV_ITEMS } from "@/lib/navigation";
import { getSettingsMap } from "@/services/settings";
import { AlertIcon } from "@/components/icons";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  const settings = await getSettingsMap();

  const items = NAV_ITEMS.filter(
    (item) => !item.permission || hasPermission(user, item.permission),
  );

  const notice = user.mustChangePassword ? (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ember/25 bg-ember-soft px-4 py-3 text-[13px] text-ember-strong">
      <span className="flex items-center gap-2">
        <AlertIcon className="h-4 w-4 shrink-0" />
        You are using an initial or temporary password. Set your own to secure
        your account.
      </span>
      <Link
        href="/account"
        className="rounded-lg border border-ember/30 bg-white px-3 py-1.5 text-[12px] font-semibold text-ember-strong hover:bg-white/70"
      >
        Update password
      </Link>
    </div>
  ) : null;

  return (
    <AppShell
      user={{
        fullName: user.fullName,
        email: user.email,
        roleLabel: user.roleLabel,
        branchName: user.branchName,
        branchCode: user.branchCode,
      }}
      items={items}
      businessName={settings["business.name"] ?? "Vista Kigali"}
      notice={notice}
    >
      {children}
    </AppShell>
  );
}
