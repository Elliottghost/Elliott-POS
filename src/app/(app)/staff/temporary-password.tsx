"use client";

import { useActionState } from "react";
import {
  issueTemporaryPasswordAction,
  type TemporaryPasswordState,
} from "./actions";
import { Alert } from "@/components/ui/alert";
import { SubmitButton } from "@/components/ui/submit-button";

const initialState: TemporaryPasswordState = {};

export function TemporaryPasswordPanel({ userId }: { userId: string }) {
  const [state, formAction] = useActionState(
    issueTemporaryPasswordAction,
    initialState,
  );

  return (
    <div className="space-y-3">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}

      {state.temporaryPassword ? (
        <Alert tone="success">
          <p className="font-semibold">Temporary password issued</p>
          <p className="mt-1 font-mono text-[15px] tracking-wide text-ink">
            {state.temporaryPassword}
          </p>
          <p className="mt-1.5 text-[12px]">
            Copy it now — it will not be shown again. All existing sessions for
            this staff member were signed out.
          </p>
        </Alert>
      ) : null}

      <form action={formAction}>
        <input type="hidden" name="userId" value={userId} />
        <SubmitButton
          variant="secondary"
          size="sm"
          pendingLabel="Issuing…"
          confirmMessage="Issue a new temporary password? The staff member's current sessions will end immediately."
        >
          Issue temporary password
        </SubmitButton>
      </form>
    </div>
  );
}
