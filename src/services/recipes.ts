import { and, asc, eq, sql, type SQL } from "drizzle-orm";
import { db } from "@/db/client";
import {
  recipes,
  recipeIngredients,
  inventoryItems,
  menuItems,
} from "@/db/schema";
import { recordAudit } from "@/lib/audit";
import { canAccessBranch } from "@/lib/auth/access";
import type { RequestMeta, SessionUser } from "@/lib/auth/session";

/** Recipe row */
export interface RecipeRow {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: Date;
}

/** Recipe ingredient row */
export interface RecipeIngredientRow {
  id: string;
  recipeId: string;
  ingredientName: string;
  sku: string;
  quantity: number;
  unitOfMeasurement: string;
}

/** List recipes */
export async function listRecipes(
  options: { branchId?: string; includeInactive?: boolean } = {},
): Promise<RecipeRow[]> {
  const conditions: SQL[] = [];

  if (options.branchId) {
    // Filter recipes that have ingredients for this branch's items
    conditions.push(
      sql`exists (select 1 from ${recipeIngredients} where ${recipeIngredients.recipe_id} = ${recipes.id} and exists (select 1 from ${inventoryItems} where ${inventoryItems.id} = ${recipeIngredients.inventory_item_id} and ${inventoryItems.branchId} = ${options.branchId}))`
    );
  }

  if (options.includeInactive === undefined) {
    conditions.push(eq(recipes.isActive, true));
  }

  const rows = await db
    .select({
      id: recipes.id,
      name: recipes.name,
      description: recipes.description,
      isActive: recipes.isActive,
      createdAt: recipes.createdAt,
    })
    .from(recipes)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(recipes.createdAt));

  return rows;
}

/** Get a single recipe with ingredients */
export async function getRecipe(id: string) {
  const [recipe] = await db
    .select()
    .from(recipes)
    .where(eq(recipes.id, id))
    .limit(1);

  if (!recipe) return null;

  const ingredients = await db
    .select({
      id: recipeIngredients.id,
      ingredientName: inventoryItems.name,
      sku: inventoryItems.sku,
      quantity: recipeIngredients.quantity,
      unitOfMeasurement: recipeIngredients.unitOfMeasurement,
    })
    .from(recipeIngredients)
    .leftJoin(inventoryItems, eq(inventoryItems.id, recipeIngredients.inventoryItemId))
    .where(eq(recipeIngredients.recipeId, id));

  return {
    ...recipe,
    ingredients,
  };
}

/** Create a recipe */
export async function createRecipe(
  actor: SessionUser,
  input: {
    name: string;
    description?: string;
    ingredients: {
      inventoryItemId: string;
      quantity: number;
      unitOfMeasurement?: string;
    }[];
    branchId: string;
  },
  meta?: RequestMeta,
): Promise<{ ok: true; id: string } | { ok: false; error: string; fieldErrors?: Record<string, string[]> }> {
  // Validate branch access
  if (!canAccessBranch(actor, input.branchId)) {
    return {
      ok: false,
      error: "You can only create recipes for your assigned branch.",
    };
  }

  // Validate that all ingredients exist and belong to the branch
  for (const ingredient of input.ingredients) {
    const [invItem] = await db
      .select()
      .from(inventoryItems)
      .where(and(eq(inventoryItems.id, ingredient.inventoryItemId), eq(inventoryItems.branchId, input.branchId)))
      .limit(1);

    if (!invItem) {
      return {
        ok: false,
        error: `Ingredient not found or not assigned to branch ${input.branchId}.`,
        fieldErrors: { ingredients: [`Ingredient not found for item ${ingredient.inventoryItemId}`] },
      };
    }

    if (ingredient.quantity <= 0) {
      return {
        ok: false,
        error: `Quantity must be greater than zero.`,
        fieldErrors: { ingredients: [`Quantity must be greater than zero.`] },
      };
    }
  }

  const [created] = await db
    .insert(recipes)
    .values({
      name: input.name,
      description: input.description ?? null,
      isActive: true,
    })
    .returning({ id: recipes.id });

  // Insert recipe ingredients
  for (const ingredient of input.ingredients) {
    await db
      .insert(recipeIngredients)
      .values({
        recipeId: created.id,
        inventoryItemId: ingredient.inventoryItemId,
        quantity: ingredient.quantity,
        unitOfMeasurement: ingredient.unitOfMeasurement ?? "pieces",
      });
  }

  await recordAudit({
    actor,
    action: "recipe.created",
    entityType: "recipe",
    entityId: created.id,
    branchId: input.branchId,
    description: `Recipe "${input.name}" created with ${input.ingredients.length} ingredient(s).`,
    metadata: {
      recipeName: input.name,
      ingredientCount: input.ingredients.length,
      branchId: input.branchId,
    },
    meta,
  });

  return { ok: true, id: created.id };
}

/** Update a recipe */
export async function updateRecipe(
  actor: SessionUser,
  recipeId: string,
  input: {
    name?: string;
    description?: string;
    ingredients?: {
      remove?: string[];
      add: {
        inventoryItemId: string;
        quantity: number;
        unitOfMeasurement?: string;
      }[];
    };
  },
  meta?: RequestMeta,
): Promise<{ ok: true; id: string } | { ok: false; error: string; fieldErrors?: Record<string, string[]> }> {
  const existing = await getRecipe(recipeId);
  if (!existing) return { ok: false, error: "Recipe not found." };

  // Validate branch access
  if (!canAccessBranch(actor, existing.branchId ?? "")) {
    return {
      ok: false,
      error: "You can only update recipes for your assigned branch.",
    };
  }

  // If name or description changing
  await db
    .update(recipes)
    .set({
      name: input.name ?? existing.name,
      description: input.description ?? existing.description,
      updatedAt: new Date(),
    })
    .where(eq(recipes.id, recipeId));

  // Handle ingredient changes
  if (input.ingredients) {
    // Remove ingredients if specified
    if (input.ingredients.remove && input.ingredients.remove.length > 0) {
      await db
        .delete(recipeIngredients)
        .where(
          and(
            eq(recipeIngredients.recipeId, recipeId),
            inArray(recipeIngredients.id, input.ingredients.remove)
          )
        );
    }

    // Add new ingredients if specified
    if (input.ingredients.add && input.ingredients.add.length > 0) {
      for (const newIngredient of input.ingredients.add) {
        // Validate ingredient exists for this branch
        const [invItem] = await db
          .select()
          .from(inventoryItems)
          .where(and(eq(inventoryItems.id, newIngredient.inventoryItemId), eq(inventoryItems.branchId, existing.branchId ?? "")))
          .limit(1);

        if (!invItem) {
          return {
            ok: false,
            error: `Ingredient not found or not assigned to this branch.`,
            fieldErrors: { ingredients: [`Invalid ingredient: ${newIngredient.inventoryItemId}`] },
          };
        }

        if (newIngredient.quantity <= 0) {
          return {
            ok: false,
            error: `Quantity must be greater than zero.`,
            fieldErrors: { ingredients: [`Quantity must be greater than zero.`] },
          };
        }

        await db
          .insert(recipeIngredients)
          .values({
            recipeId: recipeId,
            inventoryItemId: newIngredient.inventoryItemId,
            quantity: newIngredient.quantity,
            unitOfMeasurement: newIngredient.unitOfMeasurement ?? "pieces",
          });
      }
    }
  }

  await recordAudit({
    actor,
    action: "recipe.updated",
    entityType: "recipe",
    entityId: recipeId,
    branchId: existing.branchId ?? "",
    description: `Recipe "${existing.name}" updated.`,
    metadata: {
      recipeName: existing.name,
      ingredientChanges: input.ingredients ? { removed: input.ingredients.remove?.length, added: input.ingredients.add?.length } : 0,
    },
    meta,
  });

  return { ok: true, id: recipeId };
}

/** Delete a recipe */
export async function deleteRecipe(
  actor: SessionUser,
  recipeId: string,
  meta?: RequestMeta,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const existing = await getRecipe(recipeId);
  if (!existing) return { ok: false, error: "Recipe not found." };

  // Check if recipe is used in any orders - we'll soft delete by deactivating
  const [orderRef] = await db
    .select({ count: sql<number>`count(*)` })
    .from(inventoryItems)
    .where(sql`exists (select 1 from ${recipeIngredients} where ${recipeIngredients.recipe_id} = ${recipeId})`);

  // Just deactivate the recipe instead of deleting
  await db
    .update(recipes)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(recipes.id, recipeId));

  await recordAudit({
    actor,
    action: "recipe.deleted",
    entityType: "recipe",
    entityId: recipeId,
    branchId: existing.branchId ?? "",
    description: `Recipe "${existing.name}" deactivated.`,
    metadata: { recipeName: existing.name },
    meta,
  });

  return { ok: true };
}

/** Get recipes by branch */
export async function getRecipesByBranch(branchId: string) {
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
    .orderBy(desc(recipes.createdAt));

  return rows;
}

/** Get recipe cost calculation */
export async function getRecipeCost(recipeId: string) {
  const recipe = await getRecipe(recipeId);
  if (!recipe) return { ok: false, error: "Recipe not found." };

  // Get all ingredients with current purchase prices and stock
  const ingredients = recipe.ingredients;

  // Calculate total ingredient cost
  let totalIngredientCost = 0;
  const ingredientDetails = [];

  for (const ing of ingredients) {
    const [item] = await db
      .select({
        purchasePrice: inventoryItems.purchasePrice,
        currentStock: inventoryItems.currentStock,
        unitOfMeasurement: inventoryItems.unitOfMeasurement,
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

  return {
    ok: true,
    recipeId,
    totalIngredientCost,
    ingredientDetails,
    costPerServing: totalIngredientCost, // Would need guest count info
  };
}