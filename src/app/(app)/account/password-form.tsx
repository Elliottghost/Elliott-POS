"use client";

import { useActionState } from "react";
import { changePasswordAction, type AuthFormState } from "@/app/actions/auth";
import { Alert } from "@/components/ui/alert";
import { Field } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";

const initialState: AuthFormState = {};

export function ChangePasswordForm() {
  const [state, formAction] = useActionState(changePasswordAction, initialState);
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.notice ? <Alert tone="success">{state.notice}</Alert> : null}

      <Field
        label="Current password"
        htmlFor="currentPassword"
        errors={errors.currentPassword}
      >
        <input
          id="currentPassword"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
          className="field-input"
        />
      </Field>

      <Field
        label="New password"
        htmlFor="password"
        errors={errors.password}
        hint="At least 10 characters with upper and lower case letters and a number."
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
        errors={errors.confirmPassword}
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

      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
        <SubmitButton pendingLabel="Updating…">Update password</SubmitButton>
        <p className="text-[12px] text-muted">
          All other devices are signed out. This session stays active.
        </p>
      </div>
    </form>
  );
}
