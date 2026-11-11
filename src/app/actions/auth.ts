"use server";

import { redirect } from "next/navigation";
import { recordAudit } from "@/lib/audit";
import {
  authenticate,
  createSession,
  destroyCurrentSession,
  getRequestMeta,
  getSessionUser,
  requireUser,
  touchLastLogin,
} from "@/lib/auth/session";
import {
  completePasswordReset,
  requestPasswordReset,
} from "@/lib/auth/reset";
import { changeOwnPassword } from "@/services/staff";
import {
  changePasswordSchema,
  flattenFieldErrors,
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
} from "@/lib/validation";

export interface AuthFormState {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  notice?: string;
  devResetUrl?: string;
}

const LOGIN_WINDOW_MS = 10 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 8;
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

function isThrottled(key: string) {
  const entry = loginAttempts.get(key);
  if (!entry) return false;
  if (entry.resetAt < Date.now()) {
    loginAttempts.delete(key);
    return false;
  }
  return entry.count >= LOGIN_MAX_ATTEMPTS;
}

function registerAttempt(key: string, success: boolean) {
  if (success) {
    loginAttempts.delete(key);
    return;
  }
  const entry = loginAttempts.get(key);
  if (!entry || entry.resetAt < Date.now()) {
    loginAttempts.set(key, { count: 1, resetAt: Date.now() + LOGIN_WINDOW_MS });
    return;
  }
  entry.count += 1;
}

export async function loginAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { fieldErrors: flattenFieldErrors(parsed.error) };
  }

  const meta = await getRequestMeta();
  const throttleKey = `${parsed.data.email}|${meta.ipAddress ?? "unknown"}`;

  if (isThrottled(throttleKey)) {
    return {
      error: "Too many attempts. Wait a few minutes and try again.",
    };
  }

  const user = await authenticate(parsed.data.email, parsed.data.password);

  if (!user) {
    registerAttempt(throttleKey, false);
    return { error: "Incorrect email or password." };
  }

  registerAttempt(throttleKey, true);
  await createSession(user.id, meta);
  await touchLastLogin(user.id);
  await recordAudit({
    actor: user,
    action: "auth.login",
    entityType: "session",
    entityId: user.id,
    branchId: user.branchId,
    description: `${user.fullName} signed in.`,
    meta,
  });

  const requested = String(formData.get("redirectTo") ?? "");
  const target =
    requested.startsWith("/") && !requested.startsWith("//")
      ? requested
      : "/dashboard";

  redirect(target);
}

export async function logoutAction(): Promise<void> {
  const user = await getSessionUser();
  const meta = await getRequestMeta();

  if (user) {
    await recordAudit({
      actor: user,
      action: "auth.logout",
      entityType: "session",
      entityId: user.id,
      branchId: user.branchId,
      description: `${user.fullName} signed out.`,
      meta,
    });
  }

  await destroyCurrentSession();
  redirect("/login");
}

export async function forgotPasswordAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = forgotPasswordSchema.safeParse({
    email: formData.get("email"),
  });

  if (!parsed.success) {
    return { fieldErrors: flattenFieldErrors(parsed.error) };
  }

  const meta = await getRequestMeta();
  const result = await requestPasswordReset(parsed.data.email, meta.ipAddress);

  return {
    notice:
      "If an active account matches that email, a password reset link has been sent.",
    devResetUrl: result.devResetUrl,
  };
}

export async function resetPasswordAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = resetPasswordSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return { fieldErrors: flattenFieldErrors(parsed.error) };
  }

  const result = await completePasswordReset(
    parsed.data.token,
    parsed.data.password,
  );

  if (!result.ok) {
    return { error: result.error, fieldErrors: result.fieldErrors };
  }

  redirect("/login?reset=1");
}

export async function changePasswordAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const user = await requireUser();
  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return { fieldErrors: flattenFieldErrors(parsed.error) };
  }

  const meta = await getRequestMeta();
  const result = await changeOwnPassword(
    user,
    parsed.data.currentPassword,
    parsed.data.password,
    meta,
  );

  if (!result.ok) {
    return { error: result.error, fieldErrors: result.fieldErrors };
  }

  return {
    notice:
      "Password updated. Other devices have been signed out of your account.",
  };
}
