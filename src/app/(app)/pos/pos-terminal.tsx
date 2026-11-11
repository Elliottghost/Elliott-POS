"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { SubmitButton } from "@/components/ui/submit-button";
import { Field } from "@/components/ui/form";
import { SearchIcon } from "@/components/icons";
import { formatCurrency } from "@/lib/format";
import {
  ORDER_CHANNELS,
  ORDER_CHANNEL_LABELS,
} from "@/lib/validation";
import type { PosMenuCategory, PosMenuItem } from "@/services/menu";
import { createOrderAction } from "./actions";
import type { FormState } from "@/lib/forms";

interface CartLine {
  item: PosMenuItem;
  quantity: number;
}

interface BranchOption {
  id: string;
  name: string;
  code: string;
}

const initial: FormState = {};

export function PosTerminal({
  branches,
  branchId,
  menu,
  currency,
  servicePercent,
  taxPercent,
}: {
  branches: BranchOption[];
  branchId: string;
  menu: PosMenuCategory[];
  currency: string;
  servicePercent: number;
  taxPercent: number;
}) {
  const [state, formAction] = useActionState(createOrderAction, initial);
  const [cart, setCart] = useState<Record<string, CartLine>>({});
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("all");

  const lines = Object.values(cart);
  const count = lines.reduce((sum, line) => sum + line.quantity, 0);
  const subtotal = lines.reduce(
    (sum, line) => sum + line.item.price * line.quantity,
    0,
  );
  const service = Math.round((subtotal * servicePercent) / 100);
  const tax = Math.round(((subtotal + service) * taxPercent) / 100);
  const total = subtotal + service + tax;

  const visibleMenu = useMemo(() => {
    const term = query.trim().toLowerCase();
    return menu
      .filter((group) => category === "all" || group.id === category)
      .map((group) => ({
        ...group,
        items: group.items.filter(
          (item) =>
            !term ||
            item.name.toLowerCase().includes(term) ||
            (item.description ?? "").toLowerCase().includes(term),
        ),
      }))
      .filter((group) => group.items.length > 0);
  }, [menu, category, query]);

  function add(item: PosMenuItem) {
    if (!item.isAvailable) return;
    setCart((current) => {
      const existing = current[item.id];
      const quantity = Math.min((existing?.quantity ?? 0) + 1, 99);
      return { ...current, [item.id]: { item, quantity } };
    });
  }

  function step(itemId: string, delta: number) {
    setCart((current) => {
      const existing = current[itemId];
      if (!existing) return current;
      const quantity = existing.quantity + delta;
      if (quantity <= 0) {
        const next = { ...current };
        delete next[itemId];
        return next;
      }
      return { ...current, [itemId]: { ...existing, quantity: Math.min(quantity, 99) } };
    });
  }

  const payload = JSON.stringify(
    lines.map((line) => ({
      menuItemId: line.item.id,
      quantity: line.quantity,
    })),
  );

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[minmax(0,1fr)_24rem]">
      <div className="min-w-0 space-y-4">
        {branches.length > 1 ? (
          <div className="flex flex-wrap gap-2">
            {branches.map((branch) => (
              <Link
                key={branch.id}
                href={`/pos?branch=${branch.id}`}
                className={`rounded-full border px-3.5 py-1.5 text-[12px] font-semibold transition ${
                  branch.id === branchId
                    ? "border-charcoal bg-charcoal text-cream"
                    : "border-line bg-white text-ink/70 hover:border-charcoal/25"
                }`}
              >
                {branch.code} · {branch.name}
              </Link>
            ))}
          </div>
        ) : null}

        <div className="card flex items-center gap-2 px-3 py-2">
          <SearchIcon className="h-4 w-4 shrink-0 text-muted" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search dishes and drinks…"
            aria-label="Search the menu"
            className="w-full bg-transparent text-[14px] text-ink placeholder:text-muted/70 focus:outline-none"
          />
        </div>

        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          <button
            type="button"
            onClick={() => setCategory("all")}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition ${
              category === "all"
                ? "border-ember bg-ember-soft text-ember-strong"
                : "border-line bg-white text-ink/65"
            }`}
          >
            All
          </button>
          {menu.map((group) => (
            <button
              key={group.id}
              type="button"
              onClick={() => setCategory(group.id)}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition ${
                category === group.id
                  ? "border-ember bg-ember-soft text-ember-strong"
                  : "border-line bg-white text-ink/65"
              }`}
            >
              {group.name}
            </button>
          ))}
        </div>

        {visibleMenu.length === 0 ? (
          <div className="card px-4 py-10 text-center text-[13px] text-muted">
            {menu.length === 0
              ? "No dishes are on sale yet. Add menu items to start taking orders."
              : "Nothing matches that search."}
          </div>
        ) : (
          visibleMenu.map((group) => (
            <section key={group.id} className="space-y-2.5">
              <h2 className="px-1 text-[13px] font-semibold uppercase tracking-[0.14em] text-muted">
                {group.name}
              </h2>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4">
                {group.items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => add(item)}
                    disabled={!item.isAvailable}
                    className="card group flex min-h-[92px] flex-col justify-between p-3 text-left transition hover:border-ember/40 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span className="text-[13px] font-medium leading-snug text-ink">
                      {item.name}
                    </span>
                    <span className="mt-2 flex items-end justify-between gap-1">
                      <span className="text-[12.5px] font-semibold tabular-nums text-ember-strong">
                        {formatCurrency(item.price, currency)}
                      </span>
                      {item.isAvailable ? (
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-charcoal text-[13px] leading-none text-cream">
                          +
                        </span>
                      ) : (
                        <Badge tone="neutral">Sold out</Badge>
                      )}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          ))
        )}
      </div>

      <form action={formAction} className="card min-w-0 lg:sticky lg:top-5">
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <div>
            <h2 className="text-lg leading-tight">Current order</h2>
            <p className="text-[11.5px] text-muted">
              {count === 0
                ? "Tap a dish to begin"
                : `${count} item${count === 1 ? "" : "s"} · table draft`}
            </p>
          </div>
          <span className="rounded-full bg-sand px-2.5 py-1 text-[11px] font-semibold text-ink/70">
            {currency}
          </span>
        </div>

        <div className="space-y-3 px-4 py-3">
          <div className="grid grid-cols-2 gap-2">
            <Field label="Service" htmlFor="channel">
              <select
                id="channel"
                name="channel"
                defaultValue="dine_in"
                className="field-input"
              >
                {ORDER_CHANNELS.map((channel) => (
                  <option key={channel} value={channel}>
                    {ORDER_CHANNEL_LABELS[channel]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Table" htmlFor="tableLabel">
              <input
                id="tableLabel"
                name="tableLabel"
                placeholder="T-04"
                maxLength={20}
                className="field-input"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Field label="Guest name" htmlFor="customerName">
              <input
                id="customerName"
                name="customerName"
                placeholder="Optional"
                maxLength={80}
                className="field-input"
              />
            </Field>
            <Field label="Guests" htmlFor="guestCount">
              <input
                id="guestCount"
                name="guestCount"
                type="number"
                min={0}
                max={200}
                placeholder="2"
                className="field-input"
              />
            </Field>
          </div>

          <input type="hidden" name="branchId" value={branchId} />
          <input type="hidden" name="items" value={payload} />

          {lines.length === 0 ? (
            <p className="rounded-lg border border-dashed border-line px-3 py-6 text-center text-[12.5px] text-muted">
              No items yet.
            </p>
          ) : (
            <ul className="divide-y divide-line/70">
              {lines.map((line) => (
                <li key={line.item.id} className="py-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 flex-1 text-[13px] font-medium leading-snug text-ink">
                      {line.item.name}
                    </p>
                    <span className="shrink-0 text-right text-[12.5px] font-semibold tabular-nums text-ink">
                      {formatCurrency(line.item.price * line.quantity, currency)}
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between gap-2">
                    <p className="text-[11px] tabular-nums text-muted">
                      {formatCurrency(line.item.price, currency)} each
                    </p>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => step(line.item.id, -1)}
                        aria-label={`Remove one ${line.item.name}`}
                        className="flex h-7 w-7 items-center justify-center rounded-md border border-line bg-white text-[15px] leading-none text-ink/70"
                      >
                        −
                      </button>
                      <span className="w-6 text-center text-[12.5px] font-semibold tabular-nums">
                        {line.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => step(line.item.id, 1)}
                        aria-label={`Add one ${line.item.name}`}
                        className="flex h-7 w-7 items-center justify-center rounded-md border border-line bg-white text-[15px] leading-none text-ink/70"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <Field label="Order note" htmlFor="notes">
            <textarea
              id="notes"
              name="notes"
              rows={2}
              maxLength={300}
              placeholder="Allergies, serving instructions…"
              className="field-input resize-none"
            />
          </Field>

          <div className="space-y-1.5 rounded-lg bg-sand/60 px-3 py-2.5 text-[12.5px]">
            <div className="flex justify-between text-muted">
              <span>Subtotal</span>
              <span className="tabular-nums">{formatCurrency(subtotal, currency)}</span>
            </div>
            <div className="flex justify-between text-muted">
              <span>Service {servicePercent > 0 ? `(${servicePercent}%)` : ""}</span>
              <span className="tabular-nums">{formatCurrency(service, currency)}</span>
            </div>
            <div className="flex justify-between text-muted">
              <span>VAT {taxPercent > 0 ? `(${taxPercent}%)` : ""}</span>
              <span className="tabular-nums">{formatCurrency(tax, currency)}</span>
            </div>
            <div className="flex justify-between border-t border-line pt-1.5 text-[14px] font-semibold text-ink">
              <span>Total</span>
              <span className="tabular-nums">{formatCurrency(total, currency)}</span>
            </div>
          </div>

          {state.error ? <Alert tone="error">{state.error}</Alert> : null}

          <SubmitButton
            variant="ember"
            className="w-full"
            pendingLabel="Opening order…"
            disabled={lines.length === 0}
          >
            Open order
          </SubmitButton>
          <p className="text-center text-[11px] leading-relaxed text-muted">
            Prices and totals are recalculated on the server before the order is
            saved.
          </p>
        </div>
      </form>
    </div>
  );
}
