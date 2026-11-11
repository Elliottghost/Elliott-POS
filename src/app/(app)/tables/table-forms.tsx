"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { Field } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { saveTableAction, setTableStatusAction } from "./actions";
import type { FormState } from "@/lib/forms";

const initial: FormState = {};

const STATUS_OPTIONS = [
  { value: "available", label: "Available" },
  { value: "occupied", label: "Occupied" },
  { value: "reserved", label: "Reserved" },
  { value: "unavailable", label: "Unavailable" },
];

export function TableForm({
  branches,
  table,
}: {
  branches: { id: string; name: string; code: string }[];
  table?: {
    id: string;
    branchId: string;
    code: string;
    name: string | null;
    capacity: number;
    section: string;
    status: string;
    isActive: boolean;
  };
}) {
  const [state, formAction] = useActionState(saveTableAction, initial);

  return (
    <form action={formAction} className="space-y-4">
      {table ? <input type="hidden" name="tableId" value={table.id} /> : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label="Branch"
          htmlFor="branchId"
          hint={branches.length === 1 ? "Your assigned branch." : "Which house this table lives in."}
          errors={state.fieldErrors?.branchId}
        >
          <select
            id="branchId"
            name="branchId"
            defaultValue={table?.branchId ?? branches[0]?.id ?? ""}
            className="field-input"
            disabled={branches.length === 1}
            required
          >
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
          {branches.length === 1 ? (
            <input type="hidden" name="branchId" value={branches[0].id} />
          ) : null}
        </Field>
        <Field
          label="Table number or name"
          htmlFor="code"
          hint="For example T-04, Terrace 2, VIP."
          errors={state.fieldErrors?.code}
        >
          <input
            id="code"
            name="code"
            required
            maxLength={20}
            defaultValue={table?.code ?? ""}
            placeholder="T-04"
            className="field-input"
          />
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Seats" htmlFor="capacity" errors={state.fieldErrors?.capacity}>
          <input
            id="capacity"
            name="capacity"
            type="number"
            min={1}
            max={40}
            required
            defaultValue={table?.capacity ?? 4}
            className="field-input tabular-nums"
          />
        </Field>
        <Field
          label="Section"
          htmlFor="section"
          hint="Main room, terrace, garden…"
          errors={state.fieldErrors?.section}
        >
          <input
            id="section"
            name="section"
            required
            maxLength={60}
            defaultValue={table?.section ?? "Main room"}
            className="field-input"
          />
        </Field>
        <Field label="Status" htmlFor="status">
          <select
            id="status"
            name="status"
            defaultValue={table?.status ?? "available"}
            className="field-input"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Internal name" htmlFor="name" hint="Optional note for staff, e.g. “by the window”.">
        <input
          id="name"
          name="name"
          maxLength={60}
          defaultValue={table?.name ?? ""}
          className="field-input"
        />
      </Field>

      <label className="flex items-center gap-2.5 text-[13px] text-ink/80">
        <input
          type="checkbox"
          name="isActive"
          defaultChecked={table?.isActive ?? true}
          className="h-4 w-4 rounded border-line text-ember focus:ring-ember"
        />
        Table in service (shown on the floor plan and reservation book)
      </label>

      {state.error ? <Alert tone="error">{state.error}</Alert> : null}

      <div className="flex items-center gap-2">
        <SubmitButton pendingLabel="Saving…">
          {table ? "Save table" : "Add table"}
        </SubmitButton>
        <Link
          href="/tables"
          className="inline-flex h-10 items-center rounded-lg px-3 text-[13px] font-semibold text-ink/60 hover:bg-sand/70 hover:text-ink"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}

export function TableStatusForm({
  tableId,
  current,
  returnTo,
}: {
  tableId: string;
  current: string;
  returnTo: string;
}) {
  return (
    <form action={setTableStatusAction} className="flex items-center gap-1.5">
      <input type="hidden" name="tableId" value={tableId} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <label className="sr-only" htmlFor={`status-${tableId}`}>
        Table status
      </label>
      <select
        id={`status-${tableId}`}
        name="status"
        defaultValue={current}
        className="rounded-md border border-line bg-white px-2 py-1 text-[11.5px] font-medium text-ink"
      >
        {STATUS_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <SubmitButton size="sm" variant="secondary" pendingLabel="…" className="h-8 px-2 text-[11.5px]">
        Set
      </SubmitButton>
    </form>
  );
}
