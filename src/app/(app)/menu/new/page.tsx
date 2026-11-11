import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Card, CardBody } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { branchScope, hasPermission, requirePermissionPage } from "@/lib/auth/access";
import { requireUser } from "@/lib/auth/session";
import { listMenuCategories } from "@/services/menu";
import { listBranches } from "@/services/branches";
import { MenuItemForm } from "../menu-forms";

export const metadata: Metadata = { title: "New menu item" };
export const dynamic = "force-dynamic";

export default async function NewMenuItemPage() {
  const user = await requireUser();
  requirePermissionPage(user, "menu.manage");

  const [categories, branches] = await Promise.all([
    listMenuCategories(),
    listBranches(branchScope(user), { includeInactive: false }),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Menu"
        title="Add a dish or drink"
        description="It becomes sellable at both branches as soon as it is saved; branch prices can be set afterwards."
      />
      <Card className="max-w-2xl">
        <CardBody className="py-5 sm:px-6">
          {categories.length === 0 ? (
            <Alert tone="info">
              Create at least one category first.{" "}
              <Link href="/menu/categories" className="font-semibold underline">
                Manage categories
              </Link>
            </Alert>
          ) : (
            <MenuItemForm categories={categories} />
          )}
        </CardBody>
      </Card>
      {hasPermission(user, "menu.pricing") && branches.length > 0 ? (
        <p className="mt-3 max-w-2xl text-[11.5px] leading-relaxed text-muted">
          After saving you can give each branch its own price, photograph and
          availability from the item screen.
        </p>
      ) : null}
    </>
  );
}
