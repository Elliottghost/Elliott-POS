"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { canAccessBranch, hasPermission } from "@/lib/auth/access";
import { getRequestMeta, requireUser } from "@/lib/auth/session";
import { getBranchById } from "@/services/branches";
import {
  createMenuCategory,
  createMenuItem,
  deleteMenuCategory,
  deleteMenuItem,
  getMenuItem,
  listBranchAvailability,
  setBranchItemAvailability,
  setBranchMenuItem,
  updateMenuCategory,
  updateMenuItem,
} from "@/services/menu";
import {
  branchMenuSchema,
  flattenFieldErrors,
  menuCategorySchema,
  menuItemSchema,
  moneyInputSchema,
} from "@/lib/validation";
import { removeMenuImage, saveMenuImage } from "@/lib/uploads";
import type { FormState } from "@/lib/forms";

function parseCategoryForm(formData: FormData) {
  return menuCategorySchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    sortOrder: formData.get("sortOrder") || 100,
    isActive: formData.get("isActive") === "on",
  });
}

function parseItemForm(formData: FormData) {
  return menuItemSchema.safeParse({
    categoryId: formData.get("categoryId"),
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    price: String(formData.get("price") ?? ""),
    station: formData.get("station") || "kitchen",
    prepMinutes: formData.get("prepMinutes") || "",
    isFeatured: formData.get("isFeatured") === "on",
    isActive: formData.get("isActive") === "on",
  });
}

export async function saveCategoryAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  if (!hasPermission(user, "menu.manage")) {
    return { error: "You do not have permission to edit the menu." };
  }

  const categoryId = String(formData.get("categoryId") ?? "");
  const parsed = parseCategoryForm(formData);
  if (!parsed.success) {
    return {
      error: "Check the highlighted fields.",
      fieldErrors: flattenFieldErrors(parsed.error),
    };
  }

  const meta = await getRequestMeta();
  const result = categoryId
    ? await updateMenuCategory(user, categoryId, parsed.data, meta)
    : await createMenuCategory(user, parsed.data, meta);

  if (!result.ok) {
    return { error: result.error, fieldErrors: result.fieldErrors };
  }

  revalidatePath("/menu");
  revalidatePath("/menu/categories");
  revalidatePath("/pos");
  redirect("/menu/categories?saved=category");
}

export async function saveMenuItemAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  if (!hasPermission(user, "menu.manage")) {
    return { error: "You do not have permission to edit the menu." };
  }

  const itemId = String(formData.get("itemId") ?? "");
  const parsed = parseItemForm(formData);
  if (!parsed.success) {
    return {
      error: "Check the highlighted fields.",
      fieldErrors: flattenFieldErrors(parsed.error),
    };
  }

  const uploaded = await saveMenuImage(formData.get("image") as File | null);
  if (uploaded && !uploaded.ok) {
    return { error: uploaded.error, fieldErrors: { image: [uploaded.error] } };
  }
  const newImagePath = uploaded?.ok ? uploaded.path : undefined;

  const existing = itemId ? await getMenuItem(itemId) : null;
  const removeImage = formData.get("removeImage") === "on";

  const meta = await getRequestMeta();
  const result = itemId
    ? await updateMenuItem(
        user,
        itemId,
        parsed.data,
        meta,
        newImagePath ?? (removeImage ? null : undefined),
      )
    : await createMenuItem(user, parsed.data, meta, newImagePath ?? null);

  if (!result.ok) {
    if (newImagePath) await removeMenuImage(newImagePath);
    return { error: result.error, fieldErrors: result.fieldErrors };
  }

  if (newImagePath && existing?.imagePath) {
    await removeMenuImage(existing.imagePath);
  }
  if (removeImage && existing?.imagePath && !newImagePath) {
    await removeMenuImage(existing.imagePath);
  }

  revalidatePath("/menu");
  revalidatePath("/pos");
  revalidatePath(`/menu/${result.id}`);
  redirect(`/menu/${result.id}?saved=item`);
}

/** Deletes a dish. Historical order lines keep their captured price. */
export async function deleteMenuItemAction(formData: FormData) {
  const user = await requireUser();
  if (!hasPermission(user, "menu.manage")) {
    redirect("/forbidden?permission=menu.manage");
  }

  const itemId = String(formData.get("itemId") ?? "");
  const item = await getMenuItem(itemId);
  if (!item) redirect("/menu?error=not_found");

  const result = await deleteMenuItem(user, itemId, await getRequestMeta());
  if (!result.ok) {
    redirect(`/menu/${itemId}?error=${encodeURIComponent(result.error)}`);
  }

  revalidatePath("/menu");
  revalidatePath("/pos");
  redirect("/menu?saved=deleted");
}

export async function deleteCategoryAction(formData: FormData) {
  const user = await requireUser();
  if (!hasPermission(user, "menu.manage")) {
    redirect("/forbidden?permission=menu.manage");
  }

  const categoryId = String(formData.get("categoryId") ?? "");
  const result = await deleteMenuCategory(
    user,
    categoryId,
    await getRequestMeta(),
  );

  revalidatePath("/menu");
  revalidatePath("/menu/categories");
  revalidatePath("/pos");

  if (!result.ok) {
    redirect(`/menu/categories?error=${encodeURIComponent(result.error)}`);
  }

  redirect("/menu/categories?saved=deleted");
}

/** Per-branch sold-out toggle. Deliberately separate from brand-wide menu edits. */
export async function setAvailabilityAction(formData: FormData) {
  const user = await requireUser();
  if (!hasPermission(user, "menu.availability")) {
    redirect("/forbidden?permission=menu.availability");
  }

  const branchId = String(formData.get("branchId") ?? "");
  const menuItemId = String(formData.get("menuItemId") ?? "");
  const isAvailable = formData.get("isAvailable") === "1";

  if (!canAccessBranch(user, branchId)) {
    redirect("/forbidden?permission=branch_scope");
  }

  const branch = await getBranchById(branchId);
  const item = await getMenuItem(menuItemId);
  if (!branch || !item) {
    redirect("/menu?error=not_found");
  }

  await setBranchItemAvailability(
    user,
    branchId,
    menuItemId,
    isAvailable,
    await getRequestMeta(),
  );

  revalidatePath("/menu");
  revalidatePath("/pos");
  const back = String(formData.get("returnTo") ?? "/menu");
  redirect(`${back}${back.includes("?") ? "&" : "?"}saved=availability`);
}

/**
 * Saves a branch's own price (or resets it to the brand price) and availability.
 * Branch managers can only reach their assigned branch; the service re-checks.
 */
export async function saveBranchMenuAction(formData: FormData) {
  const user = await requireUser();
  const canPrice = hasPermission(user, "menu.pricing");
  const canToggle = hasPermission(user, "menu.availability");

  if (!canPrice && !canToggle) {
    redirect("/forbidden?permission=menu.pricing");
  }

  const parsed = branchMenuSchema.safeParse({
    branchId: formData.get("branchId"),
    menuItemId: formData.get("menuItemId"),
    priceOverride: String(formData.get("priceOverride") ?? "").trim(),
    isAvailable: formData.get("isAvailable") === "on",
  });

  const menuItemId = String(formData.get("menuItemId") ?? "");
  const returnTo = `/menu/${menuItemId}`;

  if (!parsed.success) {
    redirect(`${returnTo}?error=${encodeURIComponent("Check the branch price.")}`);
  }

  if (!canAccessBranch(user, parsed.data.branchId)) {
    redirect("/forbidden?permission=branch_scope");
  }

  let priceOverride: number | null = null;
  if (canPrice && parsed.data.priceOverride) {
    const money = moneyInputSchema.safeParse(parsed.data.priceOverride);
    if (!money.success) {
      redirect(
        `${returnTo}?error=${encodeURIComponent(
          money.error.issues[0]?.message ?? "Enter a valid branch price.",
        )}`,
      );
    }
    priceOverride = money.data;
  } else if (!canPrice) {
    // Someone without pricing rights (e.g. stock) must not wipe a branch price
    // while toggling availability.
    const rows = await listBranchAvailability([parsed.data.branchId]);
    priceOverride =
      rows.find((row) => row.menuItemId === parsed.data.menuItemId)?.priceOverride ?? null;
  }

  const existing = await getMenuItem(parsed.data.menuItemId);
  if (!existing) redirect("/menu?error=not_found");

  const result = await setBranchMenuItem(
    user,
    {
      branchId: parsed.data.branchId,
      menuItemId: parsed.data.menuItemId,
      isAvailable: canToggle ? parsed.data.isAvailable : true,
      priceOverride,
    },
    await getRequestMeta(),
  );

  revalidatePath("/menu");
  revalidatePath(returnTo);
  revalidatePath("/pos");

  if (!result.ok) {
    redirect(`${returnTo}?error=${encodeURIComponent(result.error)}`);
  }

  redirect(`${returnTo}?saved=branch`);
}
