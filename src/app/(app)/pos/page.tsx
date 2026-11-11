import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { branchScope } from "@/lib/auth/access";
import { requireUser } from "@/lib/auth/session";
import { listBranches } from "@/services/branches";
import { getPosMenu } from "@/services/menu";
import { getSetting } from "@/services/settings";
import { PosTerminal } from "./pos-terminal";

export const metadata: Metadata = { title: "Point of Sale" };
export const dynamic = "force-dynamic";

export default async function PosPage() {
  const user = await requireUser();
  const branches = await listBranches(branchScope(user));
  const branchId = user.branchId ?? branches[0]?.id ?? "";

  const [menu, currency, servicePercent, taxPercent] = await Promise.all([
    branchId ? getPosMenu(branchId) : Promise.resolve([]),
    getSetting("business.currency", "RWF"),
    getSetting("orders.service_charge_percent", "10"),
    getSetting("orders.vat_percent", "18"),
  ]);

  return (
    <>
      <PageHeader eyebrow="POS" title="Point of Sale" />
      <PosTerminal
        branches={branches.map((branch) => ({
          id: branch.id,
          name: branch.name,
          code: branch.code,
        }))}
        branchId={branchId}
        menu={menu}
        currency={currency}
        servicePercent={Number(servicePercent) || 10}
        taxPercent={Number(taxPercent) || 18}
      />
    </>
  );
}
