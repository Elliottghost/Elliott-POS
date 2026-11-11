import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { recipes, recipeIngredients, inventoryItems } from "@/db/schema";
import { requireUser } from "@/lib/auth/session";
import { canAccessBranch } from "@/lib/auth/access";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireUser();
  const { id } = await params;

  const [recipe] = await db
    .select({
      id: recipes.id,
      name: recipes.name,
    })
    .from(recipes)
    .where(eq(recipes.id, id))
    .limit(1);

  if (!recipe) return new Response("Not found", { status: 404 });

  if (!canAccessBranch(user, "")) {
    return new Response("Forbidden", { status: 403 });
  }

  // Get all ingredients with current purchase prices
  const ingredients = await db
    .select({
      inventoryItemId: recipeIngredients.inventoryItemId,
      quantity: recipeIngredients.quantity,
      unitOfMeasurement: recipeIngredients.unitOfMeasurement,
    })
    .from(recipeIngredients)
    .where(eq(recipeIngredients.recipeId, id));

  let totalIngredientCost = 0;
  const ingredientDetails = [];

  for (const ing of ingredients) {
    const [item] = await db
      .select({
        purchasePrice: inventoryItems.purchasePrice,
        name: inventoryItems.name,
        sku: inventoryItems.sku,
      })
      .from(inventoryItems)
      .where(eq(inventoryItems.id, ing.inventoryItemId))
      .limit(1);

    if (item) {
      const ingredientCost = item.purchasePrice * ing.quantity;
      totalIngredientCost += ingredientCost;

      ingredientDetails.push({
        name: item.name,
        sku: item.sku,
        quantity: ing.quantity,
        unit: ing.unitOfMeasurement ?? item.unitOfMeasurement ?? "pieces",
        purchasePrice: item.purchasePrice,
        cost: ingredientCost,
        unitCost: item.purchasePrice,
      });
    }
  }

  return new Response(JSON.stringify({
    ok: true,
    recipeId: recipe.id,
    recipeName: recipe.name,
    totalIngredientCost,
    ingredientDetails,
    costPerServing: totalIngredientCost,
  }), {
    headers: { "Content-Type": "application/json" },
  });
}