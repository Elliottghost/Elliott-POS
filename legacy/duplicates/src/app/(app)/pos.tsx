import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { PosForm } from "./pos-client";

export const metadata: Metadata = { title: "Point of Sale" };
export const dynamic = "force-dynamic";

export default function PosPage() {
  return (
    <>
      <PageHeader eyebrow="POS" title="Restaurant POS" />
      <PosForm />
    </>
  );
}
