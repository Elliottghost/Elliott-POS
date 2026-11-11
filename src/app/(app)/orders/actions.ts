"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { canAccessBranch, hasPermission } from "@/lib/auth/access";
import { getRequestMeta, requireUser } from "@/lib/auth/session";
import { cancelOrder, getOrderById, recordPayment } from "@/services/orders";
import { flattenFieldErrors, paymentSchema } from "@/lib/validation";
import type { FormState } from "@/lib/forms";

async function resolveOrder(formData: FormData) {
  const user = await requireUser();
  const orderId = String(formData.get("orderId") ?? "");
  const order = await getOrderById(orderId);

  if (!order) return { error: "Order not found." as const };
  if (!canAccessBranch(user, order.branchId)) {
    return { error: "This order belongs to another branch." as const };
  }

  return { user, order };
}

export async function recordPaymentAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const resolved = await resolveOrder(formData);
  if ("error" in resolved) return { error: resolved.error };

  const { user, order } = resolved;

  if (!hasPermission(user, "payments.collect")) {
    return { error: "You do not have permission to collect payments." };
  }

  const parsed = paymentSchema.safeParse({
    orderId: order.id,
    method: formData.get("method") || "cash",
    amount: String(formData.get("amount") ?? ""),
    reference: formData.get("reference") || undefined,
  });

  if (!parsed.success) {
    return {
      error: "Check the payment details.",
      fieldErrors: flattenFieldErrors(parsed.error),
    };
  }

  const meta = await getRequestMeta();
  const result = await recordPayment(user, parsed.data, meta);

  if (!result.ok) return { error: result.error };

  revalidatePath("/orders");
  revalidatePath(`/orders/${order.id}`);
  revalidatePath("/dashboard");
  revalidatePath("/pos");

  redirect(`/orders/${order.id}?paid=1`);
}

export async function cancelOrderAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const resolved = await resolveOrder(formData);
  if ("error" in resolved) return { error: resolved.error };

  const { user, order } = resolved;

  if (!hasPermission(user, "orders.manage")) {
    return { error: "You do not have permission to cancel orders." };
  }

  const reason = String(formData.get("reason") ?? "").trim().slice(0, 200);
  const meta = await getRequestMeta();
  const result = await cancelOrder(user, order.id, reason || null, meta);

  if (!result.ok) return { error: result.error };

  revalidatePath("/orders");
  revalidatePath(`/orders/${order.id}`);
  revalidatePath("/dashboard");

  redirect(`/orders/${order.id}?cancelled=1`);
}
