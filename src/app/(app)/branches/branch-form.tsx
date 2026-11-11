"use client";

import { useActionState } from "react";
import Link from "next/link";
import { createBranchAction, updateBranchAction } from "./actions";
import { Alert } from "@/components/ui/alert";
import { Field } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import type { FormState } from "@/lib/forms";

export interface BranchFormValues {
  id?: string;
  name: string;
  code: string;
  address: string;
  city: string;
  phone: string;
  email: string;
  openingTime: string;
  closingTime: string;
  isActive: boolean;
}

const initialState: FormState = {};

export function BranchForm({
  mode,
  defaultValues,
}: {
  mode: "create" | "update";
  defaultValues?: Partial<BranchFormValues>;
}) {
  const action = mode === "create" ? createBranchAction : updateBranchAction;
  const [state, formAction] = useActionState(action, initialState);
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}

      {defaultValues?.id ? (
        <input type="hidden" name="branchId" value={defaultValues.id} />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Branch name"
          htmlFor="name"
          errors={errors.name}
          hint="How the location appears across the platform."
          className="sm:col-span-2"
        >
          <input
            id="name"
            name="name"
            className="field-input"
            required
            defaultValue={defaultValues?.name ?? ""}
            placeholder="Kimironko — Ku Isangano"
          />
        </Field>

        <Field
          label="Branch code"
          htmlFor="code"
          errors={errors.code}
          hint="Short unique code, e.g. KIM."
        >
          <input
            id="code"
            name="code"
            className="field-input uppercase"
            required
            maxLength={10}
            defaultValue={defaultValues?.code ?? ""}
            placeholder="KIM"
          />
        </Field>

        <Field label="City" htmlFor="city" errors={errors.city}>
          <input
            id="city"
            name="city"
            className="field-input"
            defaultValue={defaultValues?.city ?? "Kigali"}
            placeholder="Kigali"
          />
        </Field>

        <Field
          label="Address / landmark"
          htmlFor="address"
          errors={errors.address}
          className="sm:col-span-2"
        >
          <input
            id="address"
            name="address"
            className="field-input"
            required
            defaultValue={defaultValues?.address ?? ""}
            placeholder="Ku Isangano, Kimironko"
          />
        </Field>

        <Field label="Phone" htmlFor="phone" errors={errors.phone}>
          <input
            id="phone"
            name="phone"
            className="field-input"
            defaultValue={defaultValues?.phone ?? ""}
            placeholder="+250 788 000 000"
          />
        </Field>

        <Field label="Email" htmlFor="email" errors={errors.email}>
          <input
            id="email"
            name="email"
            type="email"
            className="field-input"
            defaultValue={defaultValues?.email ?? ""}
            placeholder="branch@vistakigali.rw"
          />
        </Field>

        <Field label="Opening time" htmlFor="openingTime" errors={errors.openingTime}>
          <input
            id="openingTime"
            name="openingTime"
            type="time"
            className="field-input"
            defaultValue={defaultValues?.openingTime ?? "08:00"}
          />
        </Field>

        <Field label="Closing time" htmlFor="closingTime" errors={errors.closingTime}>
          <input
            id="closingTime"
            name="closingTime"
            type="time"
            className="field-input"
            defaultValue={defaultValues?.closingTime ?? "23:00"}
          />
        </Field>
      </div>

      <label className="flex items-start gap-3 rounded-lg border border-line bg-sand/40 px-3.5 py-3">
        <input
          type="checkbox"
          name="isActive"
          defaultChecked={defaultValues?.isActive ?? true}
          className="mt-0.5 h-4 w-4 rounded border-line text-ember focus:ring-ember"
        />
        <span>
          <span className="block text-[13px] font-medium text-ink">
            Trading location is active
          </span>
          <span className="block text-[12px] text-muted">
            Inactive branches cannot receive new staff assignments.
          </span>
        </span>
      </label>

      <div className="flex flex-wrap gap-2 border-t border-line pt-4">
        <SubmitButton pendingLabel={mode === "create" ? "Creating…" : "Saving…"}>
          {mode === "create" ? "Create branch" : "Save changes"}
        </SubmitButton>
        <Link
          href="/branches"
          className="inline-flex h-10 items-center rounded-lg px-4 text-sm font-medium text-muted hover:bg-sand/60 hover:text-ink"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
