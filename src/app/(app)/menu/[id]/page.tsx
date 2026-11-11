import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { branchScope, hasPermission } from "@/lib/auth/access";
import { requireUser } from "@/lib/auth/session";
import {
  getMenuAvailabilityByBranch,
  getMenuItem,
  listMenuCategories,
} from "@/services/menu";
import { listBranches } from "@/services/branches";
import { getSetting } from "@/services/settings";
import { BranchPricingForms, MenuItemForm } from "../menu-forms";
import { deleteMenuItemAction } from "../actions";
import { SubmitButton } from "@/components/ui/submit-button";

export const metadata: Metadata = { title: "Edit menu item" };
export const dynamic = "force-dynamic";

export default async function EditMenuItemPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const user = await requireUser();
  const canEdit = hasPermission(user, "menu.manage");
  if (!canEdit && !hasPermission(user, "menu.pricing")) {
    redirect("/forbidden?permission=menu.manage");
  }

  const [{ id }, query] = await Promise.all([params, searchParams]);
  const [item, categories, branches, overrides, currency] = await Promise.all([
    getMenuItem(id),
    listMenuCategories({ includeInactive: true }),
    listBranches(branchScope(user), { includeInactive: false }),
    getMenuAvailabilityByBranch(id),
    getSetting("business.currency", "RWF"),
  ]);

  if (!item) notFound();

  const canPrice = hasPermission(user, "menu.pricing");
  const canToggle = hasPermission(user, "menu.availability");
  const overrideKey = new Map(overrides.map((row) => [row.branchId, row]));

  return (
    <>
      <PageHeader
        eyebrow="Menu"
        title={item.name}
        description={
          canEdit
            ? "Edit the dish, its photograph, price and the station that prepares it."
            : "Set what this dish sells for at your branch, and whether it is on sale."
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {item.isFeatured ? <Badge tone="ember">Featured</Badge> : null}
            <Badge tone={item.isActive ? "success" : "neutral"}>
              {item.isActive ? "On sale" : "Hidden"}
            </Badge>
            <span className="text-[12.5px] font-semibold text-ember-strong">
              <Link href="/menu" className="hover:underline">
                Back to menu
              </Link>
            </span>
          </div>
        }
      />

      {query.saved ? (
        <div className="mb-4 max-w-2xl">
          <Alert tone="success">
            {query.saved === "branch"
              ? "Branch price and availability saved."
              : "Menu item saved."}
          </Alert>
        </div>
      ) : null}
      {query.error ? (
        <div className="mb-4 max-w-2xl">
          <Alert tone="error">{query.error}</Alert>
        </div>
      ) : null}

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_24rem]">
        {canEdit ? (
        <Card>
          <CardBody className="py-5 sm:px-6">
            <MenuItemForm
              categories={categories}
              item={{
                id: item.id,
                categoryId: item.categoryId,
                name: item.name,
                description: item.description,
                price: item.price,
                station: item.station,
                prepMinutes: item.prepMinutes,
                isFeatured: item.isFeatured,
                imagePath: item.imagePath,
                isActive: item.isActive,
              }}
            />
          </CardBody>
        </Card>
        ) : (
          <Card>
            <CardHeader
              title="Menu item"
              subtitle="Prices and descriptions are maintained centrally by the group."
            />
            <CardBody className="space-y-3">
              {item.imagePath ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.imagePath}
                  alt=""
                  className="h-40 w-full rounded-lg border border-line object-cover"
                />
              ) : null}
              <div>
                <p className="text-[15px] font-medium text-ink">{item.name}</p>
                <p className="mt-0.5 text-[12.5px] text-muted">
                  {categories.find((category) => category.id === item.categoryId)?.name}
                  {item.prepMinutes ? ` · ${item.prepMinutes} min` : ""}
                </p>
                {item.description ? (
                  <p className="mt-2 text-[12.5px] leading-relaxed text-ink/70">
                    {item.description}
                  </p>
                ) : null}
              </div>
              <p className="rounded-lg bg-sand/50 px-3 py-2 text-[12px] text-muted">
                Your branch can price this dish differently and stop selling it
                without affecting the other house.
              </p>
            </CardBody>
          </Card>
        )}

        <div className="space-y-4">
          <Card>
            <CardHeader
              title="Branch menu"
              subtitle={
                canPrice
                  ? "Each house can sell this item at its own price, or stop selling it."
                  : "Mark the dish sold out for your branch. Prices are set centrally."
              }
            />
            <CardBody>
              {branches.length === 0 ? (
                <p className="text-[12.5px] text-muted">
                  No branches are in your scope.
                </p>
              ) : (
                <BranchPricingForms
                  menuItemId={item.id}
                  price={item.price}
                  currency={currency}
                  canToggle={canToggle}
                  canPrice={canPrice}
                  rows={branches.map((branch) => ({
                    branchId: branch.id,
                    branchName: branch.name,
                    branchCode: branch.code,
                    basePrice: item.price,
                    priceOverride: overrideKey.get(branch.id)?.priceOverride ?? null,
                    isAvailable: overrideKey.get(branch.id)?.isAvailable ?? true,
                  }))}
                />
              )}
              <p className="mt-3 text-[11px] leading-relaxed text-muted">
                A blank branch price falls back to the brand price. Past receipts
                keep the price they were sold at.
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Guest menu" subtitle="What guests see after scanning a table QR code." />
            <CardBody className="space-y-2">
              {branches.map((branch) => (
                <a
                  key={branch.id}
                  href={`/m/${branch.slug}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between rounded-lg border border-line bg-white px-3 py-2 text-[12.5px] font-semibold text-ink hover:border-charcoal/25"
                >
                  <span>{branch.code} · {branch.name}</span>
                  <span className="text-ember-strong">Open ↗</span>
                </a>
              ))}
            </CardBody>
          </Card>

          {canEdit ? (
          <Card className="border-danger/25">
            <CardHeader
              title="Delete this item"
              subtitle="Removes it from the menu and the till. Historical orders keep their price snapshot."
            />
            <CardBody>
              <form action={deleteMenuItemAction}>
                <input type="hidden" name="itemId" value={item.id} />
                <SubmitButton
                  variant="danger"
                  size="sm"
                  pendingLabel="Deleting…"
                  confirmMessage={`Delete "${item.name}" from the menu?`}
                >
                  Delete item
                </SubmitButton>
              </form>
            </CardBody>
          </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}
