"use client";

import { useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { Field } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { formatCurrency } from "@/lib/format";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from "@/lib/validation";
import { recordPaymentAction } from "../actions";
import type { FormState } from "@/lib/forms";

const initial: FormState = {};

export function PaymentForm({
  orderId,
  balance,
  currency,
}: {
  orderId: string;
  balance: number;
  currency: string;
}) {
  const [state, formAction] = useActionState(recordPaymentAction, initial);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="orderId" value={orderId} />

      <div className="rounded-lg bg-charcoal px-3.5 py-3 text-cream">
        <p className="text-[10px] uppercase tracking-[0.18em] text-cream/45">
          Balance due
        </p>
        <p className="mt-0.5 font-display text-2xl tabular-nums">
          {formatCurrency(balance, currency)}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Field label="Method" htmlFor="method">
          <select id="method" name="method" defaultValue="cash" className="field-input">
            {PAYMENT_METHODS.map((method) => (
              <option key={method} value={method}>
                {PAYMENT_METHOD_LABELS[method]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Amount" htmlFor="amount">
          <input
            id="amount"
            name="amount"
            inputMode="decimal"
            defaultValue={(balance / 100).toFixed(0)}
            className="field-input tabular-nums"
            required
          />
        </Field>
      </div>

      <Field
        label="Reference"
        htmlFor="reference"
        hint="MoMo or card reference, if any."
      >
        <input
          id="reference"
          name="reference"
          maxLength={60}
          placeholder="Optional"
          className="field-input"
        />
      </Field>

      {state.error ? <Alert tone="error">{state.error}</Alert> : null}

      <SubmitButton variant="ember" className="w-full" pendingLabel="Recording…">
        Record payment
      </SubmitButton>
      <p className="text-[11px] leading-relaxed text-muted">
        Part payments are allowed; the order is marked paid only when the full
        total has been received.
      </p>
    </form>
  );
}
