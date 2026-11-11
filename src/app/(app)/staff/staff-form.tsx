"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { createStaffAction, updateStaffAction } from "./actions";
import { Alert } from "@/components/ui/alert";
import { Field } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import type { FormState } from "@/lib/forms";

export interface RoleOption {
  id: string;
  name: string;
  label: string;
}

export interface BranchOption {
  id: string;
  name: string;
  code: string;
}

export interface StaffFormValues {
  userId?: string;
  fullName: string;
  email: string;
  phone: string;
  roleId: string;
  branchId: string;
  jobTitle: string;
  employmentType: string;
  hiredAt: string;
  nationalId: string;
  residentialAddress: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  notes: string;
  isActive: boolean;
}

const initialState: FormState = {};

export function StaffForm({
  mode,
  roles,
  branches,
  defaultValues,
}: {
  mode: "create" | "update";
  roles: RoleOption[];
  branches: BranchOption[];
  defaultValues?: Partial<StaffFormValues>;
}) {
  const action = mode === "create" ? createStaffAction : updateStaffAction;
  const [state, formAction] = useActionState(action, initialState);
  const errors = state.fieldErrors ?? {};

  const initialRoleId =
    defaultValues?.roleId ??
    roles.find((role) => role.name === "waiter")?.id ??
    roles[roles.length - 1]?.id ??
    "";

  const [roleId, setRoleId] = useState(initialRoleId);
  const selectedRole = roles.find((role) => role.id === roleId);
  const isBranchFree = selectedRole?.name === "super_admin";

  return (
    <form action={formAction} className="space-y-6" noValidate>
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.notice ? <Alert tone="success">{state.notice}</Alert> : null}

      {defaultValues?.userId ? (
        <input type="hidden" name="userId" value={defaultValues.userId} />
      ) : null}

      <fieldset className="space-y-4">
        <legend className="eyebrow mb-2">Identity</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Full name"
            htmlFor="fullName"
            errors={errors.fullName}
            className="sm:col-span-2"
          >
            <input
              id="fullName"
              name="fullName"
              className="field-input"
              required
              defaultValue={defaultValues?.fullName ?? ""}
              placeholder="Sandrine Mukamana"
            />
          </Field>

          <Field label="Work email" htmlFor="email" errors={errors.email}>
            <input
              id="email"
              name="email"
              type="email"
              className="field-input"
              required
              autoComplete="off"
              defaultValue={defaultValues?.email ?? ""}
              placeholder="name@vistakigali.rw"
            />
          </Field>

          <Field label="Phone" htmlFor="phone" errors={errors.phone}>
            <input
              id="phone"
              name="phone"
              className="field-input"
              defaultValue={defaultValues?.phone ?? ""}
              placeholder="+250 7…"
            />
          </Field>

          {mode === "create" ? (
            <Field
              label="Employee code"
              htmlFor="employeeCode"
              errors={errors.employeeCode}
              hint="Unique staff number, e.g. VK-0105."
            >
              <input
                id="employeeCode"
                name="employeeCode"
                className="field-input uppercase"
                required
                maxLength={20}
                defaultValue=""
                placeholder="VK-0105"
              />
            </Field>
          ) : null}

          <Field label="National ID (optional)" htmlFor="nationalId" errors={errors.nationalId}>
            <input
              id="nationalId"
              name="nationalId"
              className="field-input"
              defaultValue={defaultValues?.nationalId ?? ""}
            />
          </Field>

          <Field
            label="Residential address"
            htmlFor="residentialAddress"
            errors={errors.residentialAddress}
            className="sm:col-span-2"
          >
            <input
              id="residentialAddress"
              name="residentialAddress"
              className="field-input"
              defaultValue={defaultValues?.residentialAddress ?? ""}
              placeholder="Kigali, Gasabo"
            />
          </Field>
        </div>
      </fieldset>

      <fieldset className="space-y-4 border-t border-line pt-5">
        <legend className="eyebrow mb-2">Access & branch</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Role"
            htmlFor="roleId"
            errors={errors.roleId}
            hint="Roles control which screens and actions are allowed."
          >
            <select
              id="roleId"
              name="roleId"
              className="field-input"
              required
              value={roleId}
              onChange={(event) => setRoleId(event.target.value)}
            >
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.label}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="Assigned branch"
            htmlFor="branchId"
            errors={errors.branchId}
            hint={
              isBranchFree
                ? "Super administrators operate across every branch."
                : "Staff only see records for this branch."
            }
          >
            <select
              id="branchId"
              name="branchId"
              className="field-input"
              required={!isBranchFree}
              disabled={isBranchFree}
              defaultValue={defaultValues?.branchId ?? ""}
            >
              <option value="">
                {isBranchFree ? "All branches (global)" : "Select a branch…"}
              </option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name} ({branch.code})
                </option>
              ))}
            </select>
          </Field>
        </div>

        {mode === "create" ? (
          <Field
            label="Initial password"
            htmlFor="password"
            errors={errors.password}
            hint="At least 10 characters, with upper and lower case and a number. The staff member must change it at first sign-in."
          >
            <input
              id="password"
              name="password"
              type="password"
              className="field-input"
              required
              autoComplete="new-password"
            />
          </Field>
        ) : null}

        {mode === "update" ? (
          <label className="flex items-start gap-3 rounded-lg border border-line bg-sand/40 px-3.5 py-3">
            <input
              type="checkbox"
              name="isActive"
              defaultChecked={defaultValues?.isActive ?? true}
              className="mt-0.5 h-4 w-4 rounded border-line text-ember focus:ring-ember"
            />
            <span>
              <span className="block text-[13px] font-medium text-ink">
                Account is active
              </span>
              <span className="block text-[12px] text-muted">
                Deactivating signs the person out everywhere and blocks sign-in.
                Their history is retained.
              </span>
            </span>
          </label>
        ) : null}
      </fieldset>

      <fieldset className="space-y-4 border-t border-line pt-5">
        <legend className="eyebrow mb-2">Employment</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Job title" htmlFor="jobTitle" errors={errors.jobTitle}>
            <input
              id="jobTitle"
              name="jobTitle"
              className="field-input"
              defaultValue={defaultValues?.jobTitle ?? ""}
              placeholder="Senior Waitress"
            />
          </Field>

          <Field label="Employment type" htmlFor="employmentType" errors={errors.employmentType}>
            <select
              id="employmentType"
              name="employmentType"
              className="field-input"
              defaultValue={defaultValues?.employmentType ?? "full_time"}
            >
              <option value="full_time">Full time</option>
              <option value="part_time">Part time</option>
              <option value="contract">Contract</option>
              <option value="intern">Intern</option>
            </select>
          </Field>

          {mode === "create" ? (
            <Field label="Hire date" htmlFor="hiredAt" errors={errors.hiredAt}>
              <input
                id="hiredAt"
                name="hiredAt"
                type="date"
                className="field-input"
                defaultValue={new Date().toISOString().slice(0, 10)}
              />
            </Field>
          ) : null}

          <Field
            label="Emergency contact"
            htmlFor="emergencyContactName"
            errors={errors.emergencyContactName}
          >
            <input
              id="emergencyContactName"
              name="emergencyContactName"
              className="field-input"
              defaultValue={defaultValues?.emergencyContactName ?? ""}
            />
          </Field>

          <Field
            label="Emergency phone"
            htmlFor="emergencyContactPhone"
            errors={errors.emergencyContactPhone}
          >
            <input
              id="emergencyContactPhone"
              name="emergencyContactPhone"
              className="field-input"
              defaultValue={defaultValues?.emergencyContactPhone ?? ""}
            />
          </Field>

          <Field
            label="Internal notes"
            htmlFor="notes"
            errors={errors.notes}
            className="sm:col-span-2"
          >
            <textarea
              id="notes"
              name="notes"
              rows={3}
              className="field-input resize-y"
              defaultValue={defaultValues?.notes ?? ""}
              placeholder="Shift preferences, certifications, remarks…"
            />
          </Field>
        </div>
      </fieldset>

      <div className="flex flex-wrap gap-2 border-t border-line pt-4">
        <SubmitButton pendingLabel={mode === "create" ? "Creating account…" : "Saving changes…"}>
          {mode === "create" ? "Create staff account" : "Save changes"}
        </SubmitButton>
        <Link
          href="/staff"
          className="inline-flex h-10 items-center rounded-lg px-4 text-sm font-medium text-muted hover:bg-sand/60 hover:text-ink"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
