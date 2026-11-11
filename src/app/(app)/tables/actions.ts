"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/auth/access";
import { getRequestMeta, requireUser } from "@/lib/auth/session";
import { createTable, deleteTable, getTableById, setTableStatus, updateTable } from "@/services/tables";
import { flattenFieldErrors, tableInputSchema, TABLE_STATUSES } from "@/lib/validation";
import type { FormState } from "@/lib/forms";

function parseTableForm(formData: FormData) {
  return tableInputSchema.safeParse({
    branchId: formData.get("branchId"),
    code: formData.get("code"),
    name: formData.get("name") || undefined,
    capacity: formData.get("capacity") || 4,
    section: formData.get("section") || "Main room",
    status: formData.get("status") || "available",
    isActive: formData.get("isActive") === "on",
  });
}

export async function saveTableAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  if (!hasPermission(user, "tables.manage")) {
    return { error: "You do not have permission to manage tables." };
  }

  const tableId = String(formData.get("tableId") ?? "");
  const parsed = parseTableForm(formData);
  if (!parsed.success) {
    return {
      error: "Check the highlighted fields.",
      fieldErrors: flattenFieldErrors(parsed.error),
    };
  }

  const meta = await getRequestMeta();
  const result = tableId
    ? await updateTable(user, tableId, parsed.data, meta)
    : await createTable(user, parsed.data, meta);

  if (!result.ok) {
    return { error: result.error, fieldErrors: result.fieldErrors };
  }

  revalidatePath("/tables");
  revalidatePath("/restaurant");
  redirect(`/tables/${result.id}?saved=table`);
}

export async function setTableStatusAction(formData: FormData) {
  const user = await requireUser();
  if (!hasPermission(user, "tables.manage")) {
    redirect("/forbidden?permission=tables.manage");
  }

  const tableId = String(formData.get("tableId") ?? "");
  const status = String(formData.get("status") ?? "");
  const returnTo = String(formData.get("returnTo") ?? "/tables");

  if (!TABLE_STATUSES.includes(status as (typeof TABLE_STATUSES)[number])) {
    redirect(`${returnTo}?error=${encodeURIComponent("Unknown table status.")}`);
  }

  const result = await setTableStatus(
    user,
    tableId,
    status,
    await getRequestMeta(),
  );

  revalidatePath("/tables");
  revalidatePath(`/tables/${tableId}`);
  revalidatePath("/restaurant");

  if (!result.ok) {
    redirect(`${returnTo}?error=${encodeURIComponent(result.error)}`);
  }

  redirect(returnTo);
}

export async function deleteTableAction(formData: FormData) {
  const user = await requireUser();
  if (!hasPermission(user, "tables.manage")) {
    redirect("/forbidden?permission=tables.manage");
  }

  const tableId = String(formData.get("tableId") ?? "");
  const table = await getTableById(tableId);
  if (!table) redirect("/tables?error=not_found");

  const result = await deleteTable(user, tableId, await getRequestMeta());
  revalidatePath("/tables");
  revalidatePath("/restaurant");

  if (!result.ok) {
    redirect(`/tables/${tableId}?error=${encodeURIComponent(result.error)}`);
  }

  redirect("/tables?saved=table_removed");
}
