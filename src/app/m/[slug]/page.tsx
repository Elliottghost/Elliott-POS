import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/db/client";
import { branches } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getBranchMenu } from "@/services/menu";
import { getTableByQrToken } from "@/services/tables";
import { getSettingsMap } from "@/services/settings";
import { formatCurrency, formatTimeRange } from "@/lib/format";

export const dynamic = "force-dynamic";

async function loadBranch(slug: string) {
  const [branch] = await db
    .select()
    .from(branches)
    .where(eq(branches.slug, slug))
    .limit(1);
  return branch ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const branch = await loadBranch(slug);
  return {
    title: branch ? `${branch.name} · Menu` : "Menu",
    description: branch
      ? `The menu at ${branch.name}, Vista Kigali.`
      : "Vista Kigali menu",
  };
}

export default async function PublicMenuPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const branch = await loadBranch(slug);
  if (!branch) notFound();

  const [menu, settings] = await Promise.all([
    getBranchMenu(branch.id),
    getSettingsMap(),
  ]);

  const tableRow = query.t ? await getTableByQrToken(query.t) : null;
  const table =
    tableRow && tableRow.table.branchId === branch.id ? tableRow.table : null;

  const currency = settings["business.currency"] ?? "RWF";
  const businessName = settings["business.name"] ?? "Vista Kigali";
  const tagline = settings["business.tagline"] ?? "Bar · Resto · Accommodation";
  const servicePercent = Number(settings["operations.service_charge_percent"] ?? 0);
  const taxPercent = Number(settings["operations.tax_percent"] ?? 0);

  const categories = menu.filter((category) => category.items.length > 0);

  return (
    <div className="min-h-svh bg-cream">
      <header className="bg-charcoal px-5 pb-8 pt-9 text-cream sm:px-8">
        <div className="mx-auto max-w-3xl">
          <p className="text-[10.5px] uppercase tracking-[0.28em] text-ember">
            {businessName}
          </p>
          <h1 className="mt-3 font-display text-[30px] leading-[1.1] sm:text-[38px]">
            {branch.name}
          </h1>
          <p className="mt-2 text-[12.5px] text-cream/55">{tagline}</p>

          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px] text-cream/70">
            <span>{branch.address}</span>
            {branch.phone ? <span>{branch.phone}</span> : null}
            <span className="tabular-nums">
              {formatTimeRange(branch.openingTime, branch.closingTime)}
            </span>
          </div>

          {table ? (
            <p className="mt-5 inline-flex items-center gap-2 rounded-full border border-ember/40 bg-ember/15 px-3.5 py-1.5 text-[12px] font-semibold text-ember">
              Table {table.code}
              {table.section ? ` · ${table.section}` : ""}
            </p>
          ) : null}

          {!branch.isActive ? (
            <p className="mt-5 rounded-lg border border-ember/40 bg-ember/10 px-3 py-2 text-[12.5px] text-ember">
              We are closed right now. Please ask a member of staff for today's
              service.
            </p>
          ) : null}
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pb-16 pt-6 sm:px-8">
        {categories.length === 0 ? (
          <div className="rounded-2xl border border-line bg-white p-8 text-center">
            <p className="font-display text-lg text-ink">The menu is being prepared</p>
            <p className="mt-1 text-[13px] text-muted">
              Ask our team what is cooking today.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {categories.map((category) => (
              <section key={category.id}>
                <div className="mb-2 flex items-baseline justify-between gap-3 border-b border-line pb-1.5">
                  <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">
                    {category.name}
                  </h2>
                  <span className="text-[10.5px] text-muted">
                    {category.items.length} item{category.items.length === 1 ? "" : "s"}
                  </span>
                </div>
                <ul className="divide-y divide-line/60">
                  {category.items.map((item) => (
                    <li
                      key={item.id}
                      className={`flex items-start gap-3 py-3 ${
                        item.isAvailable ? "" : "opacity-55"
                      }`}
                    >
                      {item.imagePath ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.imagePath}
                          alt=""
                          className="h-16 w-16 shrink-0 rounded-lg border border-line object-cover"
                        />
                      ) : null}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-[14px] font-medium leading-snug text-ink">
                              {item.name}
                              {item.isFeatured ? (
                                <span className="ml-2 align-middle text-[9.5px] font-semibold uppercase tracking-[0.12em] text-ember-strong">
                                  Signature
                                </span>
                              ) : null}
                            </p>
                            {item.description ? (
                              <p className="mt-0.5 text-[12px] leading-relaxed text-muted">
                                {item.description}
                              </p>
                            ) : null}
                            <p className="mt-0.5 text-[10.5px] text-muted">
                              {item.prepMinutes ? `About ${item.prepMinutes} min` : " "}
                              {!item.isAvailable ? " · Sold out" : ""}
                            </p>
                          </div>
                          <p className="shrink-0 text-[13px] font-semibold tabular-nums text-ink">
                            {formatCurrency(item.price, currency)}
                          </p>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}

        <footer className="mt-8 space-y-2 border-t border-line pt-4 text-[11px] leading-relaxed text-muted">
          <p>
            Prices in {currency}
            {servicePercent > 0 || taxPercent > 0
              ? `, excluding ${servicePercent > 0 ? `${servicePercent}% service` : ""}${
                  servicePercent > 0 && taxPercent > 0 ? " and " : ""
                }${taxPercent > 0 ? `${taxPercent}% VAT` : ""}.`
              : "."}
          </p>
          <p>
            Ordered at the table? Your waiter will confirm availability before the
            kitchen starts.
          </p>
          <p className="pt-2 text-[10.5px] text-ink/40">
            {businessName} · {branch.city}
          </p>
        </footer>
      </main>
    </div>
  );
}
