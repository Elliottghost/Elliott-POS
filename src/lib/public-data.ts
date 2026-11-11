"use client";

/**
 * Browser-safe read helpers for the public website.
 *
 * The marketing pages are client components, so they cannot import the
 * server-side service modules (those talk to SQLite/D1). They read the public
 * catalogue from a single server route instead.
 */

interface Branch {
  id: string;
  name: string;
  code?: string;
  isActive?: boolean;
}

interface MenuCategory {
  id: string;
  name: string;
  isActive?: boolean;
  sortOrder?: number;
}

interface MenuItem {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  station?: string;
  categoryId?: string;
  categoryName?: string;
  imagePath?: string | null;
  isFeatured?: boolean;
  isActive?: boolean;
}

interface Catalog {
  branches: Branch[];
  categories: MenuCategory[];
  items: MenuItem[];
  settings: Record<string, string>;
}

const empty: Catalog = { branches: [], categories: [], items: [], settings: {} };

let cached: Promise<Catalog> | null = null;

function loadCatalog(): Promise<Catalog> {
  if (!cached) {
    cached = fetch("/api/public/catalog", { cache: "no-store" })
      .then((response) => (response.ok ? (response.json() as Promise<Catalog>) : empty))
      .catch(() => empty);
  }
  return cached;
}

export async function listBranches(
  _scope?: string[] | null,
  options: { includeInactive?: boolean } = {},
): Promise<Branch[]> {
  const { branches } = await loadCatalog();
  return options.includeInactive ? branches : branches.filter((branch) => branch.isActive !== false);
}

export async function listMenuCategories(
  options: { includeInactive?: boolean } = {},
): Promise<MenuCategory[]> {
  const { categories } = await loadCatalog();
  return options.includeInactive
    ? categories
    : categories.filter((category) => category.isActive !== false);
}

export async function listMenuItems(
  options: {
    includeInactive?: boolean;
    categoryId?: string;
    search?: string;
    featuredOnly?: boolean;
    station?: string;
  } = {},
): Promise<MenuItem[]> {
  const { items } = await loadCatalog();
  const term = options.search?.trim().toLowerCase();

  return items.filter((item) => {
    if (!options.includeInactive && item.isActive === false) return false;
    if (options.categoryId && item.categoryId !== options.categoryId) return false;
    if (options.featuredOnly && !item.isFeatured) return false;
    if (options.station && item.station !== options.station) return false;
    if (term) {
      const haystack = `${item.name} ${item.description ?? ""} ${item.categoryName ?? ""}`.toLowerCase();
      if (!haystack.includes(term)) return false;
    }
    return true;
  });
}

export async function getMenuItem(id: string): Promise<MenuItem | null> {
  const { items } = await loadCatalog();
  return items.find((item) => item.id === id) ?? null;
}

export async function getSetting(key: string, fallback = ""): Promise<string> {
  const { settings } = await loadCatalog();
  return settings[key] ?? fallback;
}

export async function getSettingsMap(): Promise<Record<string, string>> {
  const { settings } = await loadCatalog();
  return settings;
}
