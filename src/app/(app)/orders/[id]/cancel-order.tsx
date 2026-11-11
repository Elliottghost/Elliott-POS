"use client";

import { useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { SubmitButton } from "@/components/ui/submit-button";
import { cancelOrderAction } from "../actions";
import type { FormState } from "@/lib/forms";

const initial: FormState = {};

export function CancelOrder({ orderId }: { orderId: string }) {
  const [state, formAction] = useActionState(cancelOrderAction, initial);

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="orderId" value={orderId} />
      <label className="field-label" htmlFor="reason">
        Cancel this order
      </label>
      <input
        id="reason"
        name="reason"
        maxLength={200}
        placeholder="Reason (optional)"
        className="field-input"
      />
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      <SubmitButton
        variant="danger"
        size="sm"
        className="w-full"
        confirmMessage="Cancel this order? This cannot be undone."
        pendingLabel="Cancelling…"
      >
        Cancel order
      </SubmitButton>
    </form>
  );
}
