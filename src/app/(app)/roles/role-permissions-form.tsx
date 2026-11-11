"use client";

import { useActionState } from "react";
import Link from "next/link";
import { updateRolePermissionsAction } from "./actions";
import { Alert } from "@/components/ui/alert";
import { SubmitButton } from "@/components/ui/submit-button";
import type { FormState } from "@/lib/forms";

const initialState: FormState = {};

export interface PermissionGroup {
  category: string;
  items: { id: string; label: string; description: string | null }[];
}

export function RolePermissionsForm({
  roleId,
  roleLabel,
  groups,
  granted,
  readOnly,
}: {
  roleId: string;
  roleLabel: string;
  groups: PermissionGroup[];
  granted: string[];
  readOnly: boolean;
}) {
  const [state, formAction] = useActionState(
    updateRolePermissionsAction,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-5">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.notice ? <Alert tone="success">{state.notice}</Alert> : null}

      <input type="hidden" name="roleId" value={roleId} />

      <div className="grid gap-4 sm:grid-cols-2">
        {groups.map((group) => (
          <fieldset
            key={group.category}
            className="rounded-xl border border-line bg-white p-4"
          >
            <legend className="eyebrow px-1">{group.category}</legend>
            <div className="mt-2 space-y-2.5">
              {group.items.map((permission) => (
                <label
                  key={permission.id}
                  className="flex items-start gap-2.5 text-[13px]"
                >
                  <input
                    type="checkbox"
                    name="permission"
                    value={permission.id}
                    defaultChecked={granted.includes(permission.id)}
                    disabled={readOnly}
                    className="mt-0.5 h-4 w-4 rounded border-line text-ember focus:ring-ember"
                  />
                  <span>
                    <span className="block font-medium text-ink">
                      {permission.label}
                    </span>
                    {permission.description ? (
                      <span className="block text-[12px] leading-snug text-muted">
                        {permission.description}
                      </span>
                    ) : null}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        ))}
      </div>

      {!readOnly ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
          <SubmitButton pendingLabel="Saving permissions…">
            Save {roleLabel} permissions
          </SubmitButton>
          <Link
            href="/roles"
            className="inline-flex h-10 items-center rounded-lg px-4 text-sm font-medium text-muted hover:bg-sand/60 hover:text-ink"
          >
            Back to roles
          </Link>
          <p className="text-[12px] text-muted">
            Permission changes are audited and apply immediately.
          </p>
        </div>
      ) : null}
    </form>
  );
}
