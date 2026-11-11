"use server";

import { revalidatePath } from "next/cache";
import { hasPermission } from "@/lib/auth/access";
import { getRequestMeta, requireUser } from "@/lib/auth/session";
import type { FormState } from "@/lib/forms";
import { updateSettings } from "@/services/settings";

export async function updateSettingsAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requireUser();
  if (!hasPermission(actor, "settings.manage")) {
    return { error: "You do not have permission to change business settings." };
  }

  const updates: { key: string; value: string }[] = [];
  for (const [field, value] of formData.entries()) {
    if (!field.startsWith("setting:")) continue;
    updates.push({ key: field.slice("setting:".length), value: String(value) });
  }

  if (updates.length === 0) {
    return { error: "No settings were submitted." };
  }

  const meta = await getRequestMeta();
  const result = await updateSettings(actor, updates, meta);

  if (!result.ok) return { error: result.error };

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/", "layout");
  return { notice: "Business settings saved." };
}
