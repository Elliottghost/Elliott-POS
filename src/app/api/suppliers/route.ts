import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { suppliers } from "@/db/schema";
import { recordAudit } from "@/lib/audit";
import { requireUser } from "@/lib/auth/session";
import { canAccessBranch } from "@/lib/auth/access";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ branchId: string }> },
) {
  const user = await requireUser();
  const { branchId } = await params;

  if (!canAccessBranch(user, branchId)) {
    return new Response("Forbidden", { status: 403 });
  }

  const rows = await db
    .select({
      id: suppliers.id,
      name: suppliers.name,
      contactPerson: suppliers.contactPerson,
      phone: suppliers.phone,
      email: suppliers.email,
      address: suppliers.address,
      notes: suppliers.notes,
      isActive: suppliers.isActive,
    })
    .from(suppliers)
    .where(eq(suppliers.isActive, true))
    .orderBy(suppliers.name);

  return new Response(JSON.stringify(rows), {
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
  const { name, contactPerson, phone, email, address, notes } = body;

  if (!name) {
    return new Response(
      JSON.stringify({ error: "Supplier name is required." }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  // Check name uniqueness
  const [existing] = await db
    .select({ id: suppliers.id })
    .from(suppliers)
    .where(eq(suppliers.name, name))
    .limit(1);

  if (existing) {
    return new Response(
      JSON.stringify({ error: "A supplier with that name already exists." }),
      { status: 409, headers: { "Content-Type": "application/json" } },
    );
  }

  const [created] = await db
    .insert(suppliers)
    .values({
      name,
      contactPerson: contactPerson ?? null,
      phone: phone ?? null,
      email: email ?? null,
      address: address ?? null,
      notes: notes ?? null,
      isActive: true,
    })
    .returning({ id: suppliers.id });

  await recordAudit({
    actor: user,
    action: "supplier.created",
    entityType: "supplier",
    entityId: created.id,
    branchId,
    description: `Supplier "${name}" created.`,
    metadata: { name },
  });

  return new Response(JSON.stringify({ id: created.id }), {
    status: 201,
    headers: { "Content-Type": "application/json" },
  });
}