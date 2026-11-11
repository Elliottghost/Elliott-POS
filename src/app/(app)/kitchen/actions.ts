"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/auth/access";
import { getRequestMeta, requireUser } from "@/lib/auth/session";
import { setFulfillmentStatus } from "@/services/kitchen";
import { KITCHEN_STATUSES } from "@/lib/validation";
import { isKitchenStation } from "@/lib/kitchen-stations";

export async function advanceFulfillmentAction(formData: FormData) {
  const user = await requireUser();
  if (!hasPermission(user, "kitchen.manage")) {
    redirect("/forbidden?permission=kitchen.manage");
  }

  const orderId = String(formData.get("orderId") ?? "");
  const status = String(formData.get("status") ?? "");
  const stationValue = String(formData.get("station") ?? "");
  const station = isKitchenStation(stationValue) ? stationValue : null;
  const returnTo = String(formData.get("returnTo") ?? "/kitchen");

  if (!KITCHEN_STATUSES.includes(status as (typeof KITCHEN_STATUSES)[number])) {
    redirect(`${returnTo}?error=${encodeURIComponent("Unknown kitchen status.")}`);
  }

  const result = await setFulfillmentStatus(
    user,
    orderId,
    status,
    await getRequestMeta(),
    station,
  );

  revalidatePath("/kitchen");
  revalidatePath("/orders");
  if (orderId) revalidatePath(`/orders/${orderId}`);

  if (!result.ok) {
    redirect(`${returnTo}?error=${encodeURIComponent(result.error)}`);
  }

  redirect(returnTo);
}
