import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { recipes, recipeIngredients, inventoryItems } from "@/db/schema";
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
      id: recipes.id,
      name: recipes.name,
      description: recipes.description,
      isActive: recipes.isActive,
    })
    .from(recipes)
    .where(
      sql`exists (select 1 from ${recipeIngredients} where ${recipeIngredients.recipe_id} = ${recipes.id} and exists (select 1 from ${inventoryItems} where ${inventoryItems.id} = ${recipeIngredients.inventory_item_id} and ${inventoryItems.branchId} = ${branchId}))`
    )
    .orderBy(recipes.name);

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
  const { name, description, ingredients } = body;

  if (!name) {
    return new Response(
      JSON.stringify({ error: "Recipe name is required." }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  if (!ingredients || ingredients.length === 0) {
    return new Response(
      JSON.stringify({ error: "Recipe must have at least one ingredient." }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  // Validate ingredients exist for this branch
  for (const ingredient of ingredients) {
    const [invItem] = await db
      .select()
      .from(inventoryItems)
      .where(and(eq(inventoryItems.id, ingredient.inventoryItemId), eq(inventoryItems.branchId, branchId)))
      .limit(1);

    if (!invItem) {
      return new Response(
        JSON.stringify({ error: `Ingredient not found or not assigned to branch ${branchId}.` }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    if (ingredient.quantity <= 0) {
      return new Response(
        JSON.stringify({ error: "Quantity must be greater than zero." }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }
  }

  const [created] = await db
    .insert(recipes)
    .values({
      name,
      description: description ?? null,
      isActive: true,
    })
    .returning({ id: recipes.id });

  // Insert recipe ingredients
  for (const ingredient of ingredients) {
    await db
      .insert(recipeIngredients)
      .values({
        recipeId: created.id,
        inventoryItemId: ingredient.inventoryItemId,
        quantity: ingredient.quantity,
        unitOfMeasurement: ingredient.unitOfMeasurement ?? "pieces",
      })
      .run();
  }

  await recordAudit({
    actor: user,
    action: "recipe.created",
    entityType: "recipe",
    entityId: created.id,
    branchId,
    description: `Recipe "${name}" created with ${ingredients.length} ingredient(s).`,
    metadata: { recipeName: name, ingredientCount: ingredients.length, branchId },
  });

  return new Response(JSON.stringify({ id: created.id }), {
    status: 201,
    headers: { "Content-Type": "application/json" },
  });
}