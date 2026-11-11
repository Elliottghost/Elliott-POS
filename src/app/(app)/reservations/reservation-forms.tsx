"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { Field } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { saveReservationAction, setReservationStatusAction } from "./actions";
import type { FormState } from "@/lib/forms";
import { todayKigali } from "@/lib/format";

const initial: FormState = {};

export interface ReservationTableOption {
  id: string;
  branchId: string;
  code: string;
  capacity: number;
  section: string;
  status: string;
}

const STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "seated", label: "Seated" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "no_show", label: "No-show" },
];

export function ReservationForm({
  branches,
  tables,
  reservation,
}: {
  branches: { id: string; name: string; code: string }[];
  tables: ReservationTableOption[];
  reservation?: {
    id: string;
    branchId: string;
    tableId: string | null;
    customerName: string;
    customerPhone: string;
    reservationDate: string;
    startTime: string;
    durationMinutes: number;
    guestCount: number;
    status: string;
    specialRequests: string | null;
  };
}) {
  const [state, formAction] = useActionState(saveReservationAction, initial);
  const [branchId, setBranchId] = useState(
    reservation?.branchId ?? branches[0]?.id ?? "",
  );
  const [tableId, setTableId] = useState(reservation?.tableId ?? "");

  const branchTables = useMemo(
    () => tables.filter((table) => table.branchId === branchId),
    [tables, branchId],
  );

  const selectedTable = branchTables.find((table) => table.id === tableId);
  const today = todayKigali();

  return (
    <form action={formAction} className="space-y-4">
      {reservation ? (
        <input type="hidden" name="reservationId" value={reservation.id} />
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Guest name" htmlFor="customerName" errors={state.fieldErrors?.customerName}>
          <input
            id="customerName"
            name="customerName"
            required
            maxLength={80}
            defaultValue={reservation?.customerName ?? ""}
            placeholder="Claudine Mutoni"
            className="field-input"
          />
        </Field>
        <Field label="Phone number" htmlFor="customerPhone" errors={state.fieldErrors?.customerPhone}>
          <input
            id="customerPhone"
            name="customerPhone"
            required
            maxLength={24}
            defaultValue={reservation?.customerPhone ?? ""}
            placeholder="+250 788 000 000"
            className="field-input"
            inputMode="tel"
          />
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label="Branch"
          htmlFor="branchId"
          errors={state.fieldErrors?.branchId}
          hint={branches.length === 1 ? "Bookings stay in this branch." : undefined}
        >
          <select
            id="branchId"
            name="branchId"
            value={branchId}
            onChange={(event) => {
              setBranchId(event.target.value);
              setTableId("");
            }}
            className="field-input"
            disabled={branches.length === 1}
            required
          >
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.code} · {branch.name}
              </option>
            ))}
          </select>
          {branches.length === 1 ? (
            <input type="hidden" name="branchId" value={branches[0].id} />
          ) : null}
        </Field>
        <Field
          label="Table"
          htmlFor="tableId"
          errors={state.fieldErrors?.tableId}
          hint={
            selectedTable
              ? `${selectedTable.capacity} seats · ${selectedTable.section}`
              : "Leave unassigned to seat on arrival."
          }
        >
          <select
            id="tableId"
            name="tableId"
            value={tableId}
            onChange={(event) => setTableId(event.target.value)}
            className="field-input"
          >
            <option value="">No table yet</option>
            {branchTables.map((table) => (
              <option key={table.id} value={table.id}>
                {table.code} · {table.section} · {table.capacity} seats
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Date" htmlFor="reservationDate" errors={state.fieldErrors?.reservationDate}>
          <input
            id="reservationDate"
            name="reservationDate"
            type="date"
            required
            min={reservation ? undefined : today}
            defaultValue={reservation?.reservationDate ?? today}
            className="field-input"
          />
        </Field>
        <Field label="Time" htmlFor="startTime" errors={state.fieldErrors?.startTime}>
          <input
            id="startTime"
            name="startTime"
            type="time"
            required
            step={900}
            defaultValue={reservation?.startTime ?? "19:00"}
            className="field-input"
          />
        </Field>
        <Field label="Duration" htmlFor="durationMinutes" hint="Keeps the table held for this long.">
          <select
            id="durationMinutes"
            name="durationMinutes"
            defaultValue={String(reservation?.durationMinutes ?? 90)}
            className="field-input"
          >
            {[60, 75, 90, 120, 150, 180].map((minutes) => (
              <option key={minutes} value={minutes}>
                {minutes} minutes
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Guests" htmlFor="guestCount" errors={state.fieldErrors?.guestCount}>
          <input
            id="guestCount"
            name="guestCount"
            type="number"
            min={1}
            max={200}
            required
            defaultValue={reservation?.guestCount ?? 2}
            className="field-input tabular-nums"
          />
        </Field>
        <Field label="Status" htmlFor="status">
          <select
            id="status"
            name="status"
            defaultValue={reservation?.status ?? "pending"}
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

      <Field label="Special requests" htmlFor="specialRequests" hint="Allergies, celebrations, seating preferences.">
        <textarea
          id="specialRequests"
          name="specialRequests"
          rows={2}
          maxLength={300}
          defaultValue={reservation?.specialRequests ?? ""}
          className="field-input resize-none"
        />
      </Field>

      {state.error ? <Alert tone="error">{state.error}</Alert> : null}

      <div className="flex items-center gap-2">
        <SubmitButton pendingLabel="Saving…">
          {reservation ? "Save reservation" : "Book the table"}
        </SubmitButton>
        <Link
          href="/reservations"
          className="inline-flex h-10 items-center rounded-lg px-3 text-[13px] font-semibold text-ink/60 hover:bg-sand/70 hover:text-ink"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}

export function ReservationStatusActions({
  reservationId,
  status,
}: {
  reservationId: string;
  status: string;
}) {
  const nextActions = [
    { status: "confirmed", label: "Confirm", tone: "primary" as const, show: status === "pending" },
    { status: "seated", label: "Seat guests", tone: "ember" as const, show: ["pending", "confirmed"].includes(status) },
    { status: "completed", label: "Complete", tone: "secondary" as const, show: status === "seated" },
    { status: "cancelled", label: "Cancel", tone: "danger" as const, show: !["completed", "cancelled"].includes(status) },
    { status: "no_show", label: "No-show", tone: "secondary" as const, show: ["pending", "confirmed"].includes(status) },
    { status: "confirmed", label: "Reopen", tone: "secondary" as const, show: ["cancelled", "no_show", "completed"].includes(status) },
  ].filter((action) => action.show);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {nextActions.map((action) => (
          <form key={action.label} action={setReservationStatusAction}>
            <input type="hidden" name="reservationId" value={reservationId} />
            <input type="hidden" name="status" value={action.status} />
            <input type="hidden" name="returnTo" value={`/reservations/${reservationId}`} />
            <SubmitButton
              size="sm"
              variant={action.tone}
              pendingLabel="Updating…"
              confirmMessage={
                action.status === "cancelled"
                  ? "Cancel this reservation? The table is released immediately."
                  : undefined
              }
            >
              {action.label}
            </SubmitButton>
          </form>
        ))}
      </div>

      {!["completed", "cancelled"].includes(status) ? (
        <form action={setReservationStatusAction} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="reservationId" value={reservationId} />
          <input type="hidden" name="status" value="cancelled" />
          <input type="hidden" name="returnTo" value={`/reservations/${reservationId}`} />
          <div className="min-w-[12rem] flex-1">
            <label className="field-label" htmlFor="cancellationReason">
              Cancellation reason
            </label>
            <input
              id="cancellationReason"
              name="cancellationReason"
              maxLength={200}
              placeholder="Guest called to cancel"
              className="field-input"
            />
          </div>
          <SubmitButton size="sm" variant="danger" pendingLabel="Cancelling…">
            Cancel with reason
          </SubmitButton>
        </form>
      ) : null}
    </div>
  );
}
