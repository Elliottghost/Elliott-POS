import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { Card, CardBody } from "@/components/ui/card";
import { requirePermissionPage } from "@/lib/auth/access";
import { requireUser } from "@/lib/auth/session";
import { BranchForm } from "../branch-form";

export const metadata: Metadata = { title: "New branch" };

export default async function NewBranchPage() {
  const user = await requireUser();
  requirePermissionPage(user, "branches.manage");

  return (
    <>
      <PageHeader
        eyebrow="Locations"
        title="Add a branch"
        description="Create a new trading location. Staff, records and reports are scoped to each branch."
      />
      <Card className="max-w-3xl">
        <CardBody className="py-5 sm:px-6">
          <BranchForm mode="create" />
        </CardBody>
      </Card>
    </>
  );
}
