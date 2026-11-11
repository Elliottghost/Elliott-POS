import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { inventoryCategories } from "@/db/schema";
import { recordAudit } from "@/lib/audit";
import { requireUser } from "@/lib/auth/session";
import { canAccessBranch } from "@/lib/auth/access";
import type { RequestMeta } from "@/lib/auth/session";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ branchId: string }> },
) {
  const user = await requireUser();
  const { branchId } = await params;

  if (!canAccessBranch(user, branchId)) {
    return new Response("Forbidden", { status: 403 });
  }

  const categories = await db
    .select({
      id: inventoryCategories.id,
      name: inventoryCategories.name,
      description: inventoryCategories.description,
      isActive: inventoryCategories.isActive,
    })
    .from(inventoryCategories)
    .where(eq(inventoryCategories.isActive, true))
    .orderBy(inventoryCategories.name);

  return new Response(JSON.stringify(categories), {
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ branchId: string }> },
) {
  const user = await requireUser();
  const { branchId } = await params;

  if (!canAccessBranch(user, branchId)) {
    return new Response("Forbidden", { status: 403 });
  }

  const body = await request.json();
  const { name, description, isActive } = body;

  if (!name) {
    return new Response(
      JSON.stringify({ error: "Category name is required." }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const result = await createInventoryCategory(
    user,
    { name, description, isActive },
    {},
  );

  if (!result.ok) {
    const status = result.error.includes("already") ? 409 : 400;
    return new Response(JSON.stringify({ error: result.error }), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ id: result.id }), {
    status: 201,
    headers: { "Content-Type": "application/json" },
  });
}