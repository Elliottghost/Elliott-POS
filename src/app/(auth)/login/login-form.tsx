"use client";

import { useActionState } from "react";
import Link from "next/link";
import { loginAction, type AuthFormState } from "@/app/actions/auth";
import { Alert } from "@/components/ui/alert";
import { Field } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";

const initialState: AuthFormState = {};

export function LoginForm({ redirectTo }: { redirectTo?: string }) {
  const [state, formAction] = useActionState(loginAction, initialState);
  const fieldErrors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}

      <Field label="Work email" htmlFor="email" errors={fieldErrors.email}>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@vistakigali.rw"
          className="field-input"
        />
      </Field>

      <Field label="Password" htmlFor="password" errors={fieldErrors.password}>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="field-input"
        />
      </Field>

      {redirectTo ? (
        <input type="hidden" name="redirectTo" value={redirectTo} />
      ) : null}

      <div className="flex items-center justify-between pt-1">
        <Link
          href="/forgot-password"
          className="text-[13px] font-medium text-ember-strong hover:underline"
        >
          Forgot your password?
        </Link>
      </div>

      <SubmitButton className="w-full" size="lg" pendingLabel="Signing in…">
        Sign in
      </SubmitButton>

      <p className="pt-2 text-center text-[12px] leading-relaxed text-muted">
        Access is restricted to authorised Vista Kigali staff. Sign-in attempts
        and account activity are recorded in the audit trail.
      </p>
    </form>
  );
}
