import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Button, ButtonLink } from "@/components/ui/button";
import { branchScope, hasPermission, requirePermissionPage } from "@/lib/auth/access";
import { requireUser } from "@/lib/auth/session";
import { listBranches } from "@/services/branches";
import {
  listBranchAvailability,
  listMenuCategories,
  listMenuItems,
} from "@/services/menu";
import { getSetting } from "@/services/settings";
import { formatCurrency } from "@/lib/format";
import { setAvailabilityAction } from "./actions";

export const metadata: Metadata = { title: "Menu" };
export const dynamic = "force-dynamic";

const STATION_LABELS: Record<string, string> = {
  kitchen: "Kitchen",
  bar: "Bar",
  pastry: "Pastry",
};

export default async function MenuPage({
  searchParams,
}: {
  searchParams: Promise<{
    saved?: string;
    error?: string;
    q?: string;
    category?: string;
    state?: string;
  }>;
}) {
  const user = await requireUser();
  requirePermissionPage(user, "menu.view");

  const params = await searchParams;
  const canManage = hasPermission(user, "menu.manage");
  const canToggle = hasPermission(user, "menu.availability");
  const canPrice = hasPermission(user, "menu.pricing");
  const scope = branchScope(user);

  const [categories, branches, currency] = await Promise.all([
    listMenuCategories({ includeInactive: canManage }),
    canToggle || canPrice ? listBranches(scope, { includeInactive: true }) : Promise.resolve([]),
    getSetting("business.currency", "RWF"),
  ]);

  const state = params.state ?? "all";
  const items = await listMenuItems({
    includeInactive: canManage,
    categoryId: params.category || undefined,
    search: params.q?.trim() || undefined,
    featuredOnly: state === "featured",
  });

  const visibleItems =
    state === "hidden"
      ? items.filter((item) => !item.isActive)
      : state === "active"
        ? items.filter((item) => item.isActive)
        : items;

  const availability = canToggle || canPrice
    ? await listBranchAvailability(branches.map((branch) => branch.id))
    : [];

  const availabilityKey = new Map(
    availability.map((row) => [
      `${row.branchId}:${row.menuItemId}`,
      row,
    ]),
  );

  const branchConfig = (branchId: string, itemId: string) =>
    availabilityKey.get(`${branchId}:${itemId}`);

  return (
    <>
      <PageHeader
        eyebrow="Offer"
        title="Menu & prices"
        description="The sellable menu for both houses. Prices feed the point of sale; availability and price overrides are per branch."
        actions={
          <div className="flex flex-wrap gap-2">
            {canManage ? (
              <>
                <ButtonLink href="/menu/categories" variant="secondary" size="sm">
                  Categories
                </ButtonLink>
                <ButtonLink href="/menu/new" size="sm">
                  New dish
                </ButtonLink>
              </>
            ) : null}
          </div>
        }
      />

      {params.saved ? (
        <div className="mb-4">
          <Alert tone="success">
            {params.saved === "availability"
              ? "Branch availability updated."
              : params.saved === "deleted"
                ? "Menu item deleted. Past receipts keep their prices."
                : "Menu changes saved."}
          </Alert>
        </div>
      ) : null}

      {params.error ? (
        <div className="mb-4">
          <Alert tone="error">{params.error}</Alert>
        </div>
      ) : null}

      {!canManage ? (
        <div className="mb-4">
          <Alert tone="info">
            Prices and dishes are managed centrally. You can mark dishes sold out
            for your branch, which takes effect at the till immediately.
          </Alert>
        </div>
      ) : null}

      <Card className="mb-4">
        <form className="grid gap-3 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_10rem_10rem_auto] sm:items-end sm:px-5">
          <div>
            <label className="field-label" htmlFor="q">
              Search
            </label>
            <input
              id="q"
              name="q"
              defaultValue={params.q ?? ""}
              placeholder="Dish, drink or category"
              className="field-input"
            />
          </div>
          <div>
            <label className="field-label" htmlFor="category">
              Category
            </label>
            <select
              id="category"
              name="category"
              defaultValue={params.category ?? ""}
              className="field-input"
            >
              <option value="">All categories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label" htmlFor="state">
              Status
            </label>
            <select id="state" name="state" defaultValue={state} className="field-input">
              <option value="all">All items</option>
              <option value="active">On sale</option>
              <option value="featured">Featured</option>
              {canManage ? <option value="hidden">Hidden</option> : null}
            </select>
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="md">
              Filter
            </Button>
            <ButtonLink href="/menu" variant="ghost" size="md">
              Clear
            </ButtonLink>
          </div>
        </form>
      </Card>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3 sm:px-5">
          <div>
            <h2 className="text-lg leading-tight">Dishes & drinks</h2>
            <p className="text-[12px] text-muted">
              {visibleItems.length} item{visibleItems.length === 1 ? "" : "s"} across{" "}
              {categories.length} categor{categories.length === 1 ? "y" : "ies"}
              {params.q ? ` matching “${params.q}”` : ""}
            </p>
          </div>
          {branches.length > 0 ? (
            <p className="text-[11px] uppercase tracking-[0.14em] text-muted">
              {canPrice ? "Price & availability" : "Availability"}
            </p>
          ) : null}
        </div>

        {visibleItems.length === 0 ? (
          <div className="px-4 py-12 text-center sm:px-5">
            <p className="font-display text-lg text-ink">
              {params.q || params.category ? "No matching items" : "The menu is empty"}
            </p>
            <p className="mx-auto mt-1 max-w-sm text-[13px] leading-relaxed text-muted">
              {canManage
                ? "Create a category, then add dishes with their selling price. They appear on the till immediately."
                : "Ask an administrator to add dishes and prices."}
            </p>
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="table-base min-w-[56rem]">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Category</th>
                    <th>Prep</th>
                    <th className="text-right">Price</th>
                    {branches.map((branch) => (
                      <th key={branch.id} className="text-center">
                        {branch.code}
                      </th>
                    ))}
                    <th>Status</th>
                    {canManage || canPrice ? <th className="text-right">Edit</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {visibleItems.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-line bg-sand/50">
                            {item.imagePath ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={item.imagePath}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <span className="text-[9px] uppercase tracking-wide text-muted">
                                {item.name.slice(0, 2)}
                              </span>
                            )}
                          </span>
                          <span className="min-w-0">
                            <span className="flex items-center gap-1.5">
                              <span className="font-medium text-ink">{item.name}</span>
                              {item.isFeatured ? <Badge tone="ember">Featured</Badge> : null}
                            </span>
                            {item.description ? (
                              <span className="block max-w-[20rem] truncate text-[11px] text-muted">
                                {item.description}
                              </span>
                            ) : null}
                          </span>
                        </div>
                      </td>
                      <td className="text-muted">{item.categoryName}</td>
                      <td className="text-muted">
                        {item.prepMinutes ? `${item.prepMinutes} min` : "—"}
                        <span className="block text-[10.5px]">
                          {STATION_LABELS[item.station] ?? item.station}
                        </span>
                      </td>
                      <td className="text-right font-medium tabular-nums">
                        {formatCurrency(item.price, currency)}
                      </td>
                      {branches.map((branch) => {
                        const config = branchConfig(branch.id, item.id);
                        const on = config?.isAvailable ?? true;
                        const override = config?.priceOverride ?? null;
                        return (
                          <td key={branch.id} className="text-center">
                            <form action={setAvailabilityAction}>
                              <input type="hidden" name="branchId" value={branch.id} />
                              <input type="hidden" name="menuItemId" value={item.id} />
                              <input type="hidden" name="isAvailable" value={on ? "0" : "1"} />
                              <input type="hidden" name="returnTo" value="/menu" />
                              <button
                                type="submit"
                                disabled={!canToggle}
                                aria-label={`Mark ${item.name} ${on ? "sold out" : "available"} at ${branch.name}`}
                                className={`rounded-full border px-2.5 py-1 text-[10.5px] font-semibold transition disabled:opacity-60 ${
                                  on
                                    ? "border-success/25 bg-success/10 text-success hover:bg-success/15"
                                    : "border-line bg-sand text-muted hover:border-charcoal/25"
                                }`}
                              >
                                {on ? "On sale" : "Sold out"}
                              </button>
                            </form>
                            <p className="mt-1 text-[10.5px] tabular-nums text-muted">
                              {override
                                ? formatCurrency(override, currency)
                                : "brand price"}
                            </p>
                          </td>
                        );
                      })}
                      <td>
                        <Badge tone={item.isActive ? "success" : "neutral"}>
                          {item.isActive ? "Active" : "Hidden"}
                        </Badge>
                      </td>
                      {canManage || canPrice ? (
                        <td className="text-right">
                          <Link
                            href={`/menu/${item.id}`}
                            className="text-[12px] font-semibold text-ember-strong hover:underline"
                          >
                            {canManage ? "Edit" : "Prices"}
                          </Link>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="divide-y divide-line/70 lg:hidden">
              {visibleItems.map((item) => (
                <li key={item.id} className="px-4 py-3">
                  <div className="flex items-start gap-3">
                    <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-line bg-sand/50">
                      {item.imagePath ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.imagePath} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-[9px] uppercase tracking-wide text-muted">
                          {item.name.slice(0, 2)}
                        </span>
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-[13.5px] font-medium leading-snug text-ink">
                            {item.name}
                          </p>
                          <p className="text-[11px] text-muted">
                            {item.categoryName}
                            {item.prepMinutes ? ` · ${item.prepMinutes} min` : ""}
                          </p>
                        </div>
                        <p className="shrink-0 text-[13px] font-semibold tabular-nums">
                          {formatCurrency(item.price, currency)}
                        </p>
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        {item.isFeatured ? <Badge tone="ember">Featured</Badge> : null}
                        {!item.isActive ? <Badge tone="neutral">Hidden</Badge> : null}
                        {canManage || canPrice ? (
                          <Link
                            href={`/menu/${item.id}`}
                            className="ml-auto text-[12px] font-semibold text-ember-strong hover:underline"
                          >
                            {canManage ? "Edit" : "Branch price"}
                          </Link>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  {branches.length > 0 ? (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-line/60 pt-2">
                      {branches.map((branch) => {
                        const config = branchConfig(branch.id, item.id);
                        const on = config?.isAvailable ?? true;
                        return (
                          <form key={branch.id} action={setAvailabilityAction}>
                            <input type="hidden" name="branchId" value={branch.id} />
                            <input type="hidden" name="menuItemId" value={item.id} />
                            <input type="hidden" name="isAvailable" value={on ? "0" : "1"} />
                            <input type="hidden" name="returnTo" value="/menu" />
                            <button
                              type="submit"
                              disabled={!canToggle}
                              className={`rounded-full border px-2.5 py-1 text-[10.5px] font-semibold disabled:opacity-60 ${
                                on
                                  ? "border-success/25 bg-success/10 text-success"
                                  : "border-line bg-sand text-muted"
                              }`}
                            >
                              {branch.code} · {on ? "on sale" : "sold out"}
                              {config?.priceOverride
                                ? ` · ${formatCurrency(config.priceOverride, currency)}`
                                : ""}
                            </button>
                          </form>
                        );
                      })}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>
    </>
  );
}
