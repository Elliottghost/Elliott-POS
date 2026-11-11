import { asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { businessSettings } from "@/db/schema";
import { recordAudit } from "@/lib/audit";
import type { RequestMeta, SessionUser } from "@/lib/auth/session";

export const DEFAULT_SETTINGS = [
  {
    key: "business.name",
    value: "Vista Kigali Bar - Resto & Accommodation",
    type: "text",
    group: "Business",
    label: "Trading name",
    description: "Shown across the dashboard and on printed documents.",
  },
  {
    key: "business.tagline",
    value: "Bar · Resto · Accommodation",
    type: "text",
    group: "Business",
    label: "Tagline",
    description: "Short descriptor used in the app header.",
  },
  {
    key: "business.currency",
    value: "RWF",
    type: "text",
    group: "Business",
    label: "Currency",
    description: "ISO currency code used for all monetary values.",
  },
  {
    key: "business.timezone",
    value: "Africa/Kigali",
    type: "text",
    group: "Business",
    label: "Timezone",
    description: "Reporting day boundaries follow this timezone.",
  },
  {
    key: "business.public_url",
    value: "",
    type: "text",
    group: "Business",
    label: "Public menu URL",
    description:
      "Origin encoded in table QR codes, for example https://vistakigali.rw. Leave blank to use APP_URL.",
  },
  {
    key: "business.phone",
    value: "+250 788 000 000",
    type: "text",
    group: "Contact",
    label: "Phone",
    description: "Primary contact number for the business.",
  },
  {
    key: "business.email",
    value: "hello@vistakigali.rw",
    type: "text",
    group: "Contact",
    label: "Email",
    description: "Primary contact email for the business.",
  },
  {
    key: "business.address",
    value: "Kigali, Rwanda",
    type: "text",
    group: "Contact",
    label: "Head office address",
    description: "Used on documents and the dashboard footer.",
  },
  {
    key: "operations.service_charge_percent",
    value: "10",
    type: "number",
    group: "Operations",
    label: "Service charge (%)",
    description: "Applied to orders in the POS phase.",
  },
  {
    key: "operations.tax_percent",
    value: "18",
    type: "number",
    group: "Operations",
    label: "VAT (%)",
    description: "Rwanda VAT rate applied to taxable sales.",
  },
  {
    key: "security.session_hours",
    value: "12",
    type: "number",
    group: "Security",
    label: "Session lifetime (hours)",
    description: "How long a staff sign-in stays valid on a shared terminal.",
  },
] as const;

export async function ensureDefaultSettings() {
  for (const setting of DEFAULT_SETTINGS) {
    const [existing] = await db
      .select({ key: businessSettings.key })
      .from(businessSettings)
      .where(eq(businessSettings.key, setting.key))
      .limit(1);
    if (!existing) {
      await db.insert(businessSettings).values({
        key: setting.key,
        value: setting.value,
        type: setting.type,
        group: setting.group,
        label: setting.label,
        description: setting.description,
      });
    }
  }
}

export async function listSettings() {
  return db
    .select()
    .from(businessSettings)
    .orderBy(asc(businessSettings.group), asc(businessSettings.label));
}

export async function getSettingsMap(): Promise<Record<string, string>> {
  const rows = await listSettings();
  return Object.fromEntries(rows.map((row) => [row.key, row.value]));
}

export async function getSetting(key: string, fallback = "") {
  const [row] = await db
    .select({ value: businessSettings.value })
    .from(businessSettings)
    .where(eq(businessSettings.key, key))
    .limit(1);
  return row?.value ?? fallback;
}

export async function updateSettings(
  actor: SessionUser,
  updates: { key: string; value: string }[],
  meta?: RequestMeta,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (updates.length === 0) return { ok: true };

  const keys = updates.map((update) => update.key);
  const known = await db
    .select({ key: businessSettings.key, label: businessSettings.label })
    .from(businessSettings)
    .where(inArray(businessSettings.key, keys));

  if (known.length !== new Set(keys).size) {
    return { ok: false, error: "One or more settings are not recognised." };
  }

  for (const update of updates) {
    const definition = DEFAULT_SETTINGS.find((item) => item.key === update.key);
    if (definition?.type === "number" && !Number.isFinite(Number(update.value))) {
      return { ok: false, error: `${definition.label} must be a number.` };
    }
  }

  for (const update of updates) {
    await db
      .update(businessSettings)
      .set({ value: update.value.trim(), updatedByUserId: actor.id, updatedAt: new Date() })
      .where(eq(businessSettings.key, update.key));
  }

  await recordAudit({
    actor,
    action: "settings.updated",
    entityType: "business_settings",
    entityId: null,
    branchId: null,
    description: `Business settings updated: ${known.map((item) => item.label).join(", ")}.`,
    metadata: { keys },
    meta,
  });

  return { ok: true };
}
