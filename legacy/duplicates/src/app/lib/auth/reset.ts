import { and, eq, gt, isNull } from "drizzle-orm";
import { createHash, randomBytes } from "node:crypto";
import { db } from "@/db/client";
import { passwordResetTokens, users } from "@/db/schema";
import { mailer } from "@/lib/mail";
import { hashPassword, validatePasswordStrength } from "./password";

const DEFAULT_TTL_MINUTES = 30;

function resetTtlMinutes() {
  const configured = Number(process.env.AUTH_RESET_TOKEN_TTL_MINUTES);
  return Number.isFinite(configured) && configured > 0
    ? configured
    : DEFAULT_TTL_MINUTES;
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export interface ResetRequestResult {
  /** Always true-ish flow: never disclose whether the email exists. */
  requested: boolean;
  /** Only populated for local operators when AUTH_EXPOSE_RESET_LINKS=true. */
  devResetUrl?: string;
}

export async function requestPasswordReset(
  email: string,
  ipAddress: string | null,
): Promise<ResetRequestResult> {
  const normalizedEmail = email.trim().toLowerCase();
  const [user] = await db
    .select({ id: users.id, email: users.email, fullName: users.fullName, isActive: users.isActive })
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .limit(1);

  if (!user || !user.isActive) {
    return { requested: true };
  }

  // One live token per account.
  await db
    .delete(passwordResetTokens)
    .where(eq(passwordResetTokens.userId, user.id));

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + resetTtlMinutes() * 60 * 1000);

  await db.insert(passwordResetTokens).values({
    id: hashToken(token),
    userId: user.id,
    expiresAt,
    requestedIp: ipAddress,
  });

  const appUrl = (process.env.APP_URL ?? "http://localhost:3000").replace(
    /\/$/,
    "",
  );
  const resetUrl = `${appUrl}/reset-password?token=${token}`;

  await mailer.deliver({
    to: user.email,
    subject: "Reset your Vista Kigali password",
    text: [
      `Hello ${user.fullName},`,
      "",
      "A password reset was requested for your Vista Kigali staff account.",
      `Open this link within ${resetTtlMinutes()} minutes to choose a new password:`,
      resetUrl,
      "",
      "If you did not request this, you can ignore this message.",
    ].join("\n"),
  });

  const expose =
    process.env.AUTH_EXPOSE_RESET_LINKS === "true" &&
    process.env.NODE_ENV !== "production";

  return { requested: true, devResetUrl: expose ? resetUrl : undefined };
}

export interface ResetPasswordResult {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
  userId?: string;
}

export async function completePasswordReset(
  token: string,
  newPassword: string,
): Promise<ResetPasswordResult> {
  const issues = validatePasswordStrength(newPassword);
  if (issues.length > 0) {
    return {
      ok: false,
      error: "Choose a stronger password.",
      fieldErrors: { password: issues.map((issue) => issue.message) },
    };
  }

  const [record] = await db
    .select({
      id: passwordResetTokens.id,
      userId: passwordResetTokens.userId,
    })
    .from(passwordResetTokens)
    .where(
      and(
        eq(passwordResetTokens.id, hashToken(token)),
        isNull(passwordResetTokens.usedAt),
        gt(passwordResetTokens.expiresAt, new Date()),
      ),
    )
    .limit(1);

  if (!record) {
    return {
      ok: false,
      error: "This reset link is invalid or has expired. Request a new one.",
    };
  }

  const passwordHash = await hashPassword(newPassword);

  await db
    .update(users)
    .set({
      passwordHash,
      mustChangePassword: false,
      passwordChangedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(users.id, record.userId));

  await db
    .update(passwordResetTokens)
    .set({ usedAt: new Date() })
    .where(eq(passwordResetTokens.id, record.id));

  // Invalidate existing sessions so a stolen cookie cannot survive a reset.
  const { revokeSessionsForUser } = await import("./session");
  await revokeSessionsForUser(record.userId);

  return { ok: true, userId: record.userId };
}

export async function validateResetToken(token: string): Promise<boolean> {
  if (!token) return false;
  const [record] = await db
    .select({ id: passwordResetTokens.id })
    .from(passwordResetTokens)
    .where(
      and(
        eq(passwordResetTokens.id, hashToken(token)),
        isNull(passwordResetTokens.usedAt),
        gt(passwordResetTokens.expiresAt, new Date()),
      ),
    )
    .limit(1);
  return Boolean(record);
}
