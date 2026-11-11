"use client";

import { useActionState } from "react";
import { updateSettingsAction } from "./actions";
import { Alert } from "@/components/ui/alert";
import { SubmitButton } from "@/components/ui/submit-button";
import { Field } from "@/components/ui/form";
import type { FormState } from "@/lib/forms";

const initialState: FormState = {};

export interface SettingRow {
  key: string;
  value: string;
  type: string;
  group: string;
  label: string;
  description: string | null;
}

export function SettingsForm({
  groups,
  readOnly,
}: {
  groups: { name: string; rows: SettingRow[] }[];
  readOnly: boolean;
}) {
  const [state, formAction] = useActionState(updateSettingsAction, initialState);

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.notice ? <Alert tone="success">{state.notice}</Alert> : null}

      {groups.map((group) => (
        <section key={group.name} className="card overflow-hidden">
          <div className="border-b border-line px-4 py-3.5 sm:px-5">
            <h2 className="text-lg">{group.name}</h2>
          </div>
          <div className="grid gap-4 px-4 py-4 sm:grid-cols-2 sm:px-5">
            {group.rows.map((row) => (
              <Field
                key={row.key}
                label={row.label}
                htmlFor={`setting:${row.key}`}
                hint={row.description}
              >
                <input
                  id={`setting:${row.key}`}
                  name={`setting:${row.key}`}
                  type={row.type === "number" ? "number" : "text"}
                  step={row.type === "number" ? "any" : undefined}
                  defaultValue={row.value}
                  readOnly={readOnly}
                  disabled={readOnly}
                  className={`field-input ${readOnly ? "bg-sand/50 text-muted" : ""}`}
                />
              </Field>
            ))}
          </div>
        </section>
      ))}

      {!readOnly ? (
        <div className="flex flex-wrap items-center gap-3">
          <SubmitButton pendingLabel="Saving settings…">Save settings</SubmitButton>
          <p className="text-[12px] text-muted">
            Changes are written to the database and recorded in the audit trail.
          </p>
        </div>
      ) : (
        <Alert tone="info">
          You have view-only access to business settings. Ask a super
          administrator to make changes.
        </Alert>
      )}
    </form>
  );
}
