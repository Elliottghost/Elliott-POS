import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import { listMenuCategories, listMenuItems } from "@/services/menu";
import { getSettingsMap } from "@/services/settings";

export const metadata: Metadata = {
  title: "Menu · Vista Kigali",
  description: "Restaurant and bar menu at Vista Kigali, Kimironko and Rond-Point.",
};

export const dynamic = "force-dynamic";

export default async function PublicMenuPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string }>;
}) {
  const params = await searchParams;
  const search = params.q?.trim() ?? "";
  const categoryId = params.category ?? "";

  const [categories, items, settings] = await Promise.all([
    listMenuCategories({ includeInactive: false }),
    listMenuItems({
      includeInactive: false,
      categoryId: categoryId || undefined,
      search: search || undefined,
    }),
    getSettingsMap(),
  ]);

  const currency = settings["business.currency"] ?? "RWF";
  const grouped = categories
    .map((category) => ({
      category,
      items: items.filter((item) => item.categoryId === category.id),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <div className="min-h-screen bg-cream">
      <header className="border-b border-line/60 bg-white/90 sticky top-0 z-40">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <a href="/public" className="font-display text-xl font-bold text-ember">
            Vista Kigali
          </a>
          <nav className="flex items-center gap-3 text-[12px] font-semibold text-ink">
            <a href="/public/bar" className="hover:text-ember">
              Bar
            </a>
            <a href="/public/accommodation" className="hover:text-ember">
              Stay
            </a>
            <a href="/public/contact" className="hover:text-ember">
              Contact
            </a>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10">
        <Badge>Kitchen &amp; bar</Badge>
        <h1 className="mt-3 font-display text-4xl font-bold tracking-tight">Menu</h1>
        <p className="mt-2 text-[14px] text-muted">
          All prices in {currency}. Service charge and VAT are added at billing.
        </p>

        <form className="mt-6 flex flex-wrap items-end gap-3" action="/public/menu">
          <label className="flex flex-col gap-1 text-[12px] font-semibold text-muted">
            Search
            <input
              type="search"
              name="q"
              defaultValue={search}
              placeholder="Dish or drink"
              className="h-10 w-56 rounded-lg border border-line bg-white px-3 text-sm text-ink"
            />
          </label>
          <label className="flex flex-col gap-1 text-[12px] font-semibold text-muted">
            Category
            <select
              name="category"
              defaultValue={categoryId}
              className="h-10 w-56 rounded-lg border border-line bg-white px-3 text-sm text-ink"
            >
              <option value="">All categories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="h-10 rounded-lg bg-charcoal px-4 text-sm font-semibold text-cream"
          >
            Filter
          </button>
          {search || categoryId ? (
            <a href="/public/menu" className="text-[12px] font-semibold text-ember">
              Clear
            </a>
          ) : null}
        </form>

        <div className="mt-8 space-y-8">
          {grouped.length === 0 ? (
            <Card className="p-8 text-center text-[14px] text-muted">
              No items match that search.
            </Card>
          ) : (
            grouped.map((group) => (
              <section key={group.category.id}>
                <h2 className="mb-3 font-display text-2xl font-bold">{group.category.name}</h2>
                <div className="grid gap-3 md:grid-cols-2">
                  {group.items.map((item) => (
                    <Card key={item.id} className="flex items-start justify-between gap-4 p-4">
                      <div className="min-w-0">
                        <h3 className="text-[15px] font-semibold text-ink">{item.name}</h3>
                        {item.description ? (
                          <p className="mt-1 text-[13px] leading-relaxed text-muted">
                            {item.description}
                          </p>
                        ) : null}
                        <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-muted">
                          {item.station}
                        </p>
                      </div>
                      <span className="whitespace-nowrap text-[14px] font-semibold text-ember">
                        {formatCurrency(item.price, currency)}
                      </span>
                    </Card>
                  ))}
                </div>
              </section>
            ))
          )}
        </div>

        <div className="mt-10">
          <ButtonLink href="/public" variant="secondary">
            Back home
          </ButtonLink>
        </div>
      </main>
    </div>
  );
}
