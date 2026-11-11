import type { Metadata } from "next";
import { ForgotPasswordForm } from "./forgot-form";

export const metadata: Metadata = { title: "Reset your password" };

export default function ForgotPasswordPage() {
  return (
    <div>
      <p className="eyebrow">Account recovery</p>
      <h2 className="mt-2 font-display text-3xl text-ink">Reset password</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        Enter the email on your staff account. If it matches an active account,
        we will send a single-use reset link that expires in 30 minutes.
      </p>
      <div className="mt-6">
        <ForgotPasswordForm />
      </div>
    </div>
  );
}
