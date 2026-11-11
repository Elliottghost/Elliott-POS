"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/auth/access";
import { getRequestMeta, requireUser } from "@/lib/auth/session";
import {
  createReservation,
  getReservationById,
  setReservationStatus,
  updateReservation,
} from "@/services/reservations";
import {
  flattenFieldErrors,
  RESERVATION_STATUSES,
  reservationInputSchema,
} from "@/lib/validation";
import type { FormState } from "@/lib/forms";

function parseReservationForm(formData: FormData) {
  return reservationInputSchema.safeParse({
    branchId: formData.get("branchId"),
    tableId: formData.get("tableId") || undefined,
    customerName: formData.get("customerName"),
    customerPhone: formData.get("customerPhone"),
    reservationDate: formData.get("reservationDate"),
    startTime: formData.get("startTime"),
    durationMinutes: formData.get("durationMinutes") || 90,
    guestCount: formData.get("guestCount"),
    status: formData.get("status") || "pending",
    specialRequests: formData.get("specialRequests") || undefined,
  });
}

export async function saveReservationAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  if (!hasPermission(user, "reservations.manage")) {
    return { error: "You do not have permission to manage reservations." };
  }

  const reservationId = String(formData.get("reservationId") ?? "");
  const parsed = parseReservationForm(formData);
  if (!parsed.success) {
    return {
      error: "Check the highlighted fields.",
      fieldErrors: flattenFieldErrors(parsed.error),
    };
  }

  const meta = await getRequestMeta();
  const result = reservationId
    ? await updateReservation(user, reservationId, parsed.data, meta)
    : await createReservation(user, parsed.data, meta);

  if (!result.ok) {
    return { error: result.error, fieldErrors: result.fieldErrors };
  }

  revalidatePath("/reservations");
  revalidatePath("/restaurant");
  revalidatePath("/tables");
  redirect(
    `/reservations/${result.id}?saved=${reservationId ? "updated" : "created"}`,
  );
}

export async function setReservationStatusAction(formData: FormData) {
  const user = await requireUser();
  if (!hasPermission(user, "reservations.manage")) {
    redirect("/forbidden?permission=reservations.manage");
  }

  const reservationId = String(formData.get("reservationId") ?? "");
  const status = String(formData.get("status") ?? "");
  const reason = String(formData.get("cancellationReason") ?? "");
  const returnTo = String(formData.get("returnTo") ?? "/reservations");

  const reservation = await getReservationById(reservationId);
  if (!reservation) redirect("/reservations?error=not_found");

  if (!RESERVATION_STATUSES.includes(status as (typeof RESERVATION_STATUSES)[number])) {
    redirect(`${returnTo}?error=${encodeURIComponent("Unknown reservation status.")}`);
  }

  const result = await setReservationStatus(
    user,
    reservationId,
    status,
    reason || null,
    await getRequestMeta(),
  );

  revalidatePath("/reservations");
  revalidatePath(`/reservations/${reservationId}`);
  revalidatePath("/restaurant");
  revalidatePath("/tables");

  if (!result.ok) {
    redirect(`${returnTo}?error=${encodeURIComponent(result.error)}`);
  }

  redirect(returnTo);
}
