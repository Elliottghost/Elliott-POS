import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { hasPermission, requirePermissionPage } from "@/lib/auth/access";
import { requireUser } from "@/lib/auth/session";
import { listSettings } from "@/services/settings";
import { SettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Business settings" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireUser();
  requirePermissionPage(user, "settings.view");

  const settings = await listSettings();
  const canManage = hasPermission(user, "settings.manage");

  const groups = new Map<string, typeof settings>();
  for (const setting of settings) {
    groups.set(setting.group, [...(groups.get(setting.group) ?? []), setting]);
  }

  return (
    <>
      <PageHeader
        eyebrow="Configuration"
        title="Business settings"
        description="Business identity, currency and operational defaults used across every branch."
      />

      <div className="max-w-4xl">
        <SettingsForm
          readOnly={!canManage}
          groups={Array.from(groups.entries()).map(([name, rows]) => ({
            name,
            rows: rows.map((row) => ({
              key: row.key,
              value: row.value,
              type: row.type,
              group: row.group,
              label: row.label,
              description: row.description,
            })),
          }))}
        />
      </div>
    </>
  );
}
