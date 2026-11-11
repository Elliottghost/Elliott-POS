"use client";

import { useActionState } from "react";
import Link from "next/link";
import { resetPasswordAction, type AuthFormState } from "@/app/actions/auth";
import { Alert } from "@/components/ui/alert";
import { Field } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";

const initialState: AuthFormState = {};

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction] = useActionState(resetPasswordAction, initialState);
  const fieldErrors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}

      <input type="hidden" name="token" value={token} />

      <Field
        label="New password"
        htmlFor="password"
        errors={fieldErrors.password}
        hint="At least 10 characters, with upper and lowercase letters and a number."
      >
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          className="field-input"
        />
      </Field>

      <Field
        label="Confirm new password"
        htmlFor="confirmPassword"
        errors={fieldErrors.confirmPassword}
      >
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          className="field-input"
        />
      </Field>

      <SubmitButton className="w-full" size="lg" pendingLabel="Updating…">
        Set new password
      </SubmitButton>

      <p className="text-center text-[13px] text-muted">
        <Link href="/login" className="font-medium text-ember-strong hover:underline">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
