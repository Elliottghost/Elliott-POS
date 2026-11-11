"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { Field } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  deleteCategoryAction,
  saveBranchMenuAction,
  saveCategoryAction,
  saveMenuItemAction,
} from "./actions";
import type { FormState } from "@/lib/forms";
import { formatCurrency } from "@/lib/format";

const initial: FormState = {};

interface CategoryOption {
  id: string;
  name: string;
}

export function MenuItemForm({
  categories,
  item,
}: {
  categories: CategoryOption[];
  item?: {
    id: string;
    categoryId: string;
    name: string;
    description: string | null;
    price: number;
    station: string;
    prepMinutes: number | null;
    isFeatured: boolean;
    imagePath: string | null;
    isActive: boolean;
  };
}) {
  const [state, formAction] = useActionState(saveMenuItemAction, initial);
  const [preview, setPreview] = useState<string | null>(item?.imagePath ?? null);

  return (
    <form action={formAction} className="space-y-4">
      {item ? <input type="hidden" name="itemId" value={item.id} /> : null}

      <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Field
          label="Dish or drink"
          htmlFor="name"
          errors={state.fieldErrors?.name}
        >
          <input
            id="name"
            name="name"
            required
            maxLength={80}
            defaultValue={item?.name ?? ""}
            placeholder="Grilled tilapia"
            className="field-input"
          />
        </Field>
        <Field
          label="Category"
          htmlFor="categoryId"
          errors={state.fieldErrors?.categoryId}
        >
          <select
            id="categoryId"
            name="categoryId"
            defaultValue={item?.categoryId ?? categories[0]?.id ?? ""}
            className="field-input"
            required
          >
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Description" htmlFor="description" hint="Optional. Shown on the till tile and guest menu.">
        <textarea
          id="description"
          name="description"
          rows={2}
          maxLength={300}
          defaultValue={item?.description ?? ""}
          className="field-input resize-none"
        />
      </Field>

      <div className="grid gap-3 sm:grid-cols-3">
        <Field
          label="Price (RWF)"
          htmlFor="price"
          hint="Whole francs."
          errors={state.fieldErrors?.price}
        >
          <input
            id="price"
            name="price"
            inputMode="decimal"
            required
            defaultValue={item ? String(item.price / 100) : ""}
            placeholder="8500"
            className="field-input tabular-nums"
          />
        </Field>
        <Field label="Prep time (min)" htmlFor="prepMinutes" hint="Kitchen estimate.">
          <input
            id="prepMinutes"
            name="prepMinutes"
            type="number"
            min={0}
            max={360}
            defaultValue={item?.prepMinutes ?? 15}
            className="field-input tabular-nums"
          />
        </Field>
        <Field label="Station" htmlFor="station" hint="Where it is prepared.">
          <select
            id="station"
            name="station"
            defaultValue={item?.station ?? "kitchen"}
            className="field-input"
          >
            <option value="kitchen">Kitchen</option>
            <option value="bar">Bar</option>
            <option value="pastry">Pastry</option>
          </select>
        </Field>
      </div>

      <div className="rounded-xl border border-line bg-sand/25 p-3">
        <p className="field-label">Photograph</p>
        <div className="mt-2 flex items-center gap-3">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-line bg-white">
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="text-[10px] uppercase tracking-wide text-muted">No image</span>
            )}
          </span>
          <div className="min-w-0 flex-1">
            <input
              type="file"
              name="image"
              accept="image/png,image/jpeg,image/webp"
              onChange={(event) => {
                const file = event.target.files?.[0];
                setPreview(file ? URL.createObjectURL(file) : item?.imagePath ?? null);
              }}
              className="block w-full text-[12px] text-ink/70 file:mr-3 file:rounded-md file:border-0 file:bg-charcoal file:px-3 file:py-1.5 file:text-[12px] file:font-semibold file:text-cream"
            />
            <p className="mt-1 text-[11px] text-muted">JPG, PNG or WebP, up to 3 MB.</p>
            {item?.imagePath ? (
              <label className="mt-1.5 flex items-center gap-2 text-[11.5px] text-ink/70">
                <input
                  type="checkbox"
                  name="removeImage"
                  className="h-3.5 w-3.5 rounded border-line text-ember focus:ring-ember"
                />
                Remove the current photo
              </label>
            ) : null}
          </div>
        </div>
        {state.fieldErrors?.image ? (
          <p className="field-error">{state.fieldErrors.image[0]}</p>
        ) : null}
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <label className="flex items-center gap-2.5 text-[13px] text-ink/80">
          <input
            type="checkbox"
            name="isFeatured"
            defaultChecked={item?.isFeatured ?? false}
            className="h-4 w-4 rounded border-line text-ember focus:ring-ember"
          />
          Feature on the menu
        </label>
        <label className="flex items-center gap-2.5 text-[13px] text-ink/80">
          <input
            type="checkbox"
            name="isActive"
            defaultChecked={item?.isActive ?? true}
            className="h-4 w-4 rounded border-line text-ember focus:ring-ember"
          />
          Available for sale
        </label>
      </div>

      {state.error ? <Alert tone="error">{state.error}</Alert> : null}

      <div className="flex items-center gap-2">
        <SubmitButton pendingLabel="Saving…">
          {item ? "Save changes" : "Add to menu"}
        </SubmitButton>
        <Link
          href="/menu"
          className="inline-flex h-10 items-center rounded-lg px-3 text-[13px] font-semibold text-ink/60 hover:bg-sand/70 hover:text-ink"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}

export function CategoryForm({
  category,
}: {
  category?: {
    id: string;
    name: string;
    description: string | null;
    sortOrder: number;
    isActive: boolean;
  };
}) {
  const [state, formAction] = useActionState(saveCategoryAction, initial);

  return (
    <div className="space-y-3">
      <form action={formAction} className="space-y-3">
      {category ? <input type="hidden" name="categoryId" value={category.id} /> : null}
      <Field label="Name" htmlFor={`cat-name-${category?.id ?? "new"}`} errors={state.fieldErrors?.name}>
        <input
          id={`cat-name-${category?.id ?? "new"}`}
          name="name"
          required
          maxLength={60}
          defaultValue={category?.name ?? ""}
          placeholder="Main Courses"
          className="field-input"
        />
      </Field>
      <div className="grid grid-cols-[minmax(0,1fr)_5.5rem] gap-2">
        <Field label="Description" htmlFor={`cat-desc-${category?.id ?? "new"}`}>
          <input
            id={`cat-desc-${category?.id ?? "new"}`}
            name="description"
            maxLength={200}
            defaultValue={category?.description ?? ""}
            placeholder="Optional"
            className="field-input"
          />
        </Field>
        <Field label="Order" htmlFor={`cat-sort-${category?.id ?? "new"}`}>
          <input
            id={`cat-sort-${category?.id ?? "new"}`}
            name="sortOrder"
            type="number"
            min={0}
            max={999}
            defaultValue={category?.sortOrder ?? 100}
            className="field-input tabular-nums"
          />
        </Field>
      </div>
      <label className="flex items-center gap-2.5 text-[13px] text-ink/80">
        <input
          type="checkbox"
          name="isActive"
          defaultChecked={category?.isActive ?? true}
          className="h-4 w-4 rounded border-line text-ember focus:ring-ember"
        />
        Visible on the menu
      </label>

      {state.error ? <Alert tone="error">{state.error}</Alert> : null}

      <SubmitButton size="sm" pendingLabel="Saving…">
        {category ? "Save category" : "Add category"}
      </SubmitButton>
      </form>

      {category ? (
        <form
          action={deleteCategoryAction}
          onSubmit={(event) => {
            if (
              !window.confirm(
                `Delete the category "${category.name}"? Categories that still hold dishes cannot be deleted.`,
              )
            ) {
              event.preventDefault();
            }
          }}
        >
          <input type="hidden" name="categoryId" value={category.id} />
          <SubmitButton size="sm" variant="danger" pendingLabel="Deleting…">
            Delete category
          </SubmitButton>
        </form>
      ) : null}
    </div>
  );
}

interface BranchPriceRow {
  branchId: string;
  branchName: string;
  branchCode: string;
  basePrice: number;
  priceOverride: number | null;
  isAvailable: boolean;
}

export function BranchPricingForms({
  menuItemId,
  price,
  rows,
  currency,
  canToggle,
  canPrice,
}: {
  menuItemId: string;
  price: number;
  rows: BranchPriceRow[];
  currency: string;
  canToggle: boolean;
  canPrice: boolean;
}) {
  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <form
          key={row.branchId}
          action={saveBranchMenuAction}
          className="rounded-xl border border-line bg-white p-3"
        >
          <input type="hidden" name="branchId" value={row.branchId} />
          <input type="hidden" name="menuItemId" value={menuItemId} />

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[13.5px] font-medium text-ink">
                {row.branchCode} · {row.branchName}
              </p>
              <p className="text-[11px] text-muted">
                Brand price {formatCurrency(price, currency)}
                {row.priceOverride
                  ? ` · this branch sells at ${formatCurrency(row.priceOverride, currency)}`
                  : ""}
              </p>
            </div>
            <span
              className={`rounded-full border px-2 py-0.5 text-[10.5px] font-semibold ${
                row.isAvailable
                  ? "border-success/25 bg-success/10 text-success"
                  : "border-line bg-sand text-muted"
              }`}
            >
              {row.isAvailable ? "On sale" : "Sold out"}
            </span>
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-end">
            <Field
              label="Branch price (RWF)"
              htmlFor={`override-${row.branchId}`}
              hint="Leave blank to use the brand price."
            >
              <input
                id={`override-${row.branchId}`}
                name="priceOverride"
                inputMode="decimal"
                defaultValue={
                  row.priceOverride ? String(row.priceOverride / 100) : ""
                }
                placeholder={String(price / 100)}
                disabled={!canPrice}
                className="field-input tabular-nums disabled:bg-sand/60 disabled:text-muted"
              />
            </Field>
            <label className="flex h-10 items-center gap-2 text-[12.5px] text-ink/75">
              <input
                type="checkbox"
                name="isAvailable"
                defaultChecked={row.isAvailable}
                disabled={!canToggle}
                className="h-4 w-4 rounded border-line text-ember focus:ring-ember disabled:opacity-50"
              />
              On sale
            </label>
            <SubmitButton size="sm" pendingLabel="Saving…">
              Save
            </SubmitButton>
          </div>
        </form>
      ))}
    </div>
  );
}
