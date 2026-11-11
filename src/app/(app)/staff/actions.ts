"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/auth/access";
import { getRequestMeta, requireUser } from "@/lib/auth/session";
import type { FormState } from "@/lib/forms";
import {
  flattenFieldErrors,
  staffCreateSchema,
  staffUpdateSchema,
} from "@/lib/validation";
import {
  createStaffAccount,
  generateTemporaryPassword,
  getStaffDetail,
  updateStaffAccount,
} from "@/services/staff";

export interface TemporaryPasswordState {
  error?: string;
  temporaryPassword?: string;
}

export async function createStaffAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  if (!hasPermission(user, "staff.manage")) {
    return { error: "You do not have permission to add staff." };
  }

  const parsed = staffCreateSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    phone: formData.get("phone") || undefined,
    roleId: formData.get("roleId"),
    branchId: formData.get("branchId") || undefined,
    password: formData.get("password"),
    employeeCode: formData.get("employeeCode"),
    jobTitle: formData.get("jobTitle") || undefined,
    employmentType: formData.get("employmentType") || "full_time",
    hiredAt: formData.get("hiredAt") || undefined,
    nationalId: formData.get("nationalId") || undefined,
    residentialAddress: formData.get("residentialAddress") || undefined,
    emergencyContactName: formData.get("emergencyContactName") || undefined,
    emergencyContactPhone: formData.get("emergencyContactPhone") || undefined,
    notes: formData.get("notes") || undefined,
  });

  if (!parsed.success) {
    return {
      error: "Check the highlighted fields.",
      fieldErrors: flattenFieldErrors(parsed.error),
    };
  }

  const meta = await getRequestMeta();
  const result = await createStaffAccount(user, parsed.data, meta);

  if (!result.ok) {
    return { error: result.error, fieldErrors: result.fieldErrors };
  }

  revalidatePath("/staff");
  revalidatePath("/dashboard");
  redirect(`/staff/${result.userId}?created=1`);
}

export async function updateStaffAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  if (!hasPermission(user, "staff.manage")) {
    return { error: "You do not have permission to edit staff." };
  }

  const userId = String(formData.get("userId") ?? "");
  const existing = await getStaffDetail(userId);
  if (!existing) return { error: "Staff member not found." };

  const parsed = staffUpdateSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    phone: formData.get("phone") || undefined,
    roleId: formData.get("roleId"),
    branchId: formData.get("branchId") || undefined,
    jobTitle: formData.get("jobTitle") || undefined,
    employmentType: formData.get("employmentType") || "full_time",
    nationalId: formData.get("nationalId") || undefined,
    residentialAddress: formData.get("residentialAddress") || undefined,
    emergencyContactName: formData.get("emergencyContactName") || undefined,
    emergencyContactPhone: formData.get("emergencyContactPhone") || undefined,
    notes: formData.get("notes") || undefined,
    isActive: formData.get("isActive") === "on",
  });

  if (!parsed.success) {
    return {
      error: "Check the highlighted fields.",
      fieldErrors: flattenFieldErrors(parsed.error),
    };
  }

  const meta = await getRequestMeta();
  const result = await updateStaffAccount(user, userId, parsed.data, meta);

  if (!result.ok) {
    return { error: result.error, fieldErrors: result.fieldErrors };
  }

  revalidatePath("/staff");
  revalidatePath(`/staff/${userId}`);
  revalidatePath("/dashboard");
  return { notice: "Staff record updated." };
}

export async function issueTemporaryPasswordAction(
  _prev: TemporaryPasswordState,
  formData: FormData,
): Promise<TemporaryPasswordState> {
  const user = await requireUser();
  if (!hasPermission(user, "staff.manage")) {
    return { error: "You do not have permission to reset passwords." };
  }

  const userId = String(formData.get("userId") ?? "");
  const meta = await getRequestMeta();
  const result = await generateTemporaryPassword(user, userId, meta);

  if (!result.ok) return { error: result.error };

  revalidatePath(`/staff/${userId}`);
  return {
    temporaryPassword: result.temporaryPassword,
  };
}
