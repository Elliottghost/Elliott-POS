"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { canAccessBranch, hasPermission } from "@/lib/auth/access";
import { getRequestMeta, requireUser } from "@/lib/auth/session";
import { createOrder } from "@/services/orders";
import { flattenFieldErrors, orderCreateSchema } from "@/lib/validation";
import type { FormState } from "@/lib/forms";

function parseItems(raw: FormDataEntryValue | null) {
  if (typeof raw !== "string" || !raw.trim()) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function createOrderAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  if (!hasPermission(user, "orders.create")) {
    return { error: "You do not have permission to open orders." };
  }

  const parsed = orderCreateSchema.safeParse({
    branchId: formData.get("branchId"),
    channel: formData.get("channel") || "dine_in",
    customerName: formData.get("customerName") || undefined,
    tableLabel: formData.get("tableLabel") || undefined,
    guestCount: formData.get("guestCount") || "",
    notes: formData.get("notes") || undefined,
    items: parseItems(formData.get("items")),
  });

  if (!parsed.success) {
    return {
      error: "Check the order details and add at least one item.",
      fieldErrors: flattenFieldErrors(parsed.error),
    };
  }

  if (!canAccessBranch(user, parsed.data.branchId)) {
    return { error: "You can only open orders for your assigned branch." };
  }

  const meta = await getRequestMeta();
  const result = await createOrder(user, parsed.data, meta);

  if (!result.ok) {
    return { error: result.error };
  }

  revalidatePath("/orders");
  revalidatePath("/pos");
  revalidatePath("/dashboard");
  redirect(`/orders/${result.id}?created=1`);
}
