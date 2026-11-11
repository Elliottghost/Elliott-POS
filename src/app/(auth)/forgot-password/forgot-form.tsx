"use client";

import { useActionState } from "react";
import Link from "next/link";
import { forgotPasswordAction, type AuthFormState } from "@/app/actions/auth";
import { Alert } from "@/components/ui/alert";
import { Field } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";

const initialState: AuthFormState = {};

export function ForgotPasswordForm() {
  const [state, formAction] = useActionState(
    forgotPasswordAction,
    initialState,
  );
  const fieldErrors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.notice ? <Alert tone="success">{state.notice}</Alert> : null}

      {state.devResetUrl ? (
        <Alert tone="info">
          <p className="font-semibold">Development delivery</p>
          <p className="mt-1">
            No mail provider is configured, so the reset link is shown here:
          </p>
          <Link
            href={state.devResetUrl}
            className="mt-2 block break-all font-medium text-ember-strong underline"
          >
            {state.devResetUrl}
          </Link>
        </Alert>
      ) : null}

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

      <SubmitButton className="w-full" size="lg" pendingLabel="Sending…">
        Send reset link
      </SubmitButton>

      <p className="text-center text-[13px] text-muted">
        <Link href="/login" className="font-medium text-ember-strong hover:underline">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
