import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { requirePermissionPage } from "@/lib/auth/access";
import { requireUser } from "@/lib/auth/session";
import { listMenuCategories } from "@/services/menu";
import { CategoryForm } from "../menu-forms";

export const metadata: Metadata = { title: "Menu categories" };
export const dynamic = "force-dynamic";

export default async function MenuCategoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const user = await requireUser();
  requirePermissionPage(user, "menu.manage");

  const [categories, params] = await Promise.all([
    listMenuCategories({ includeInactive: true }),
    searchParams,
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Menu"
        title="Categories"
        description="Categories group the till and the menu board. Lower order numbers appear first."
        actions={
          <Link
            href="/menu"
            className="text-[12.5px] font-semibold text-ember-strong hover:underline"
          >
            Back to menu
          </Link>
        }
      />

      {params.saved ? (
        <div className="mb-4">
          <Alert tone="success">
            {params.saved === "deleted" ? "Category deleted." : "Category saved."}
          </Alert>
        </div>
      ) : null}
      {params.error ? (
        <div className="mb-4">
          <Alert tone="error">{params.error}</Alert>
        </div>
      ) : null}

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Card className="overflow-hidden">
          <CardHeader
            title="All categories"
            subtitle={`${categories.length} categor${categories.length === 1 ? "y" : "ies"}.`}
          />
          {categories.length === 0 ? (
            <p className="px-4 py-10 text-center text-[13px] text-muted sm:px-5">
              No categories yet. Add the first one on the right.
            </p>
          ) : (
            <ul className="divide-y divide-line/70">
              {categories.map((category) => (
                <li key={category.id} className="px-4 py-3 sm:px-5">
                  <details>
                    <summary className="flex cursor-pointer items-center justify-between gap-3">
                      <span className="min-w-0">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="text-[13.5px] font-medium text-ink">
                            {category.name}
                          </span>
                          {!category.isActive ? <Badge tone="neutral">Hidden</Badge> : null}
                        </span>
                        <span className="mt-0.5 block text-[11px] text-muted">
                          {category.itemCount} item{category.itemCount === 1 ? "" : "s"} ·
                          order {category.sortOrder}
                        </span>
                      </span>
                      <span className="shrink-0 text-[11.5px] font-semibold text-ember-strong">
                        Edit
                      </span>
                    </summary>
                    <div className="mt-3 rounded-lg bg-sand/40 p-3">
                      <CategoryForm
                        category={{
                          id: category.id,
                          name: category.name,
                          description: category.description,
                          sortOrder: category.sortOrder,
                          isActive: category.isActive,
                        }}
                      />
                    </div>
                  </details>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Add a category" subtitle="For example Starters, Grill, Bar." />
          <CardBody>
            <CategoryForm />
          </CardBody>
        </Card>
      </div>
    </>
  );
}
