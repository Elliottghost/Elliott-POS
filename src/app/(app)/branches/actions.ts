"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { recordAudit } from "@/lib/audit";
import {
  assertBranchAccess,
  hasPermission,
  isSuperAdmin,
} from "@/lib/auth/access";
import { getRequestMeta, requireUser } from "@/lib/auth/session";
import { branchInputSchema, flattenFieldErrors } from "@/lib/validation";
import { createBranch, getBranchById, updateBranch } from "@/services/branches";
import type { FormState } from "@/lib/forms";

function parseBranchForm(formData: FormData) {
  return branchInputSchema.safeParse({
    name: formData.get("name"),
    code: formData.get("code"),
    address: formData.get("address"),
    city: formData.get("city") || "Kigali",
    phone: formData.get("phone") || undefined,
    email: formData.get("email") || undefined,
    openingTime: formData.get("openingTime") || "08:00",
    closingTime: formData.get("closingTime") || "23:00",
    isActive: formData.get("isActive") === "on",
  });
}

export async function createBranchAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  if (!hasPermission(user, "branches.manage")) {
    return { error: "You do not have permission to create branches." };
  }

  const parsed = parseBranchForm(formData);
  if (!parsed.success) {
    return {
      error: "Check the highlighted fields.",
      fieldErrors: flattenFieldErrors(parsed.error),
    };
  }

  const meta = await getRequestMeta();
  const result = await createBranch(user, parsed.data, meta);

  if (!result.ok) {
    return { error: result.error, fieldErrors: result.fieldErrors };
  }

  revalidatePath("/branches");
  revalidatePath("/dashboard");
  redirect(`/branches/${result.branchId}?created=1`);
}

export async function updateBranchAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const branchId = String(formData.get("branchId") ?? "");

  if (!hasPermission(user, "branches.manage")) {
    return { error: "You do not have permission to edit branches." };
  }

  const branch = await getBranchById(branchId);
  if (!branch) return { error: "Branch not found." };

  if (!isSuperAdmin(user)) {
    try {
      assertBranchAccess(user, branchId);
    } catch {
      return { error: "This branch is outside your scope." };
    }
  }

  const parsed = parseBranchForm(formData);
  if (!parsed.success) {
    return {
      error: "Check the highlighted fields.",
      fieldErrors: flattenFieldErrors(parsed.error),
    };
  }

  const meta = await getRequestMeta();
  const result = await updateBranch(user, branchId, parsed.data, meta);

  if (!result.ok) {
    return { error: result.error, fieldErrors: result.fieldErrors };
  }

  revalidatePath("/branches");
  revalidatePath(`/branches/${branchId}`);
  revalidatePath("/dashboard");
  redirect(`/branches/${branchId}?updated=1`);
}
