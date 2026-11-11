import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { Alert } from "@/components/ui/alert";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirectTo?: string; reset?: string }>;
}) {
  const user = await getSessionUser();
  if (user) redirect("/dashboard");

  const params = await searchParams;

  return (
    <div>
      <p className="eyebrow">Staff portal</p>
      <h2 className="mt-2 font-display text-3xl text-ink">Welcome back</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        Sign in with the staff account issued to you by your branch manager.
      </p>

      {params.reset === "1" ? (
        <div className="mt-5">
          <Alert tone="success">
            Your password has been updated. Sign in with your new password.
          </Alert>
        </div>
      ) : null}

      <div className="mt-6">
        <LoginForm redirectTo={params.redirectTo} />
      </div>
    </div>
  );
}
