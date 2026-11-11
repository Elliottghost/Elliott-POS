import type { Metadata } from "next";
import Link from "next/link";
import { validateResetToken } from "@/lib/auth/reset";
import { Alert } from "@/components/ui/alert";
import { ResetPasswordForm } from "./reset-form";

export const metadata: Metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const valid = token ? await validateResetToken(token) : false;

  if (!valid) {
    return (
      <div>
        <p className="eyebrow">Account recovery</p>
        <h2 className="mt-2 font-display text-3xl text-ink">Link unavailable</h2>
        <div className="mt-5">
          <Alert tone="error">
            This reset link is invalid, already used, or expired. Request a new
            link to continue.
          </Alert>
        </div>
        <p className="mt-5 text-sm text-muted">
          <Link
            href="/forgot-password"
            className="font-medium text-ember-strong hover:underline"
          >
            Request a new reset link
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div>
      <p className="eyebrow">Account recovery</p>
      <h2 className="mt-2 font-display text-3xl text-ink">
        Choose a new password
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        At least 10 characters with upper and lower case letters and a number.
        All existing sessions will be signed out.
      </p>
      <div className="mt-6">
        <ResetPasswordForm token={token!} />
      </div>
    </div>
  );
}
