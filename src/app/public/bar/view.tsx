"use client";

import { useEffect, useState } from "react";
import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams, usePathname, useRouter } from "next/navigation";
import { useToast } from "@/components/ui/use-toast";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";
import { listMenuCategories, listMenuItems } from "@/lib/public-data";
import { branchScope } from "@/lib/auth/access";
import { listBranches } from "@/lib/public-data";
import { getSetting } from "@/lib/public-data";
import { useIsMounted } from "@/lib/hooks";

export default function BarPage() {
  const [searchParams] = useSearchParams();
  const router = useRouter();
  const [toast] = useToast();
  const [isMounted] = useIsMounted();

  const branchId = searchParams.get("branch") || "";
  const query = searchParams.get("q") || "";

  const [branches, setBranches] = useState([]);
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const allBranches = await listBranches(undefined, { includeInactive: false });
        setBranches(allBranches);

        const allCategories = await listMenuCategories({ includeInactive: false });
        setCategories(allCategories);

        const items = await listMenuItems({
          includeInactive: false,
          search: query.trim() || undefined,
        });
        // Filter for bar station items
        const barItems = items.filter((item) => item.station === "bar");
        setItems(barItems);
        setLoading(false);
      } catch (err) {
        console.error("Failed to load bar menu:", err);
        setError("Failed to load bar menu. Please try again.");
        setLoading(false);
      }
    }

    load();
  }, [branchId, query, isMounted]);

  useEffect(() => {
    if (branchId) {
      localStorage.setItem("vista_branch", branchId);
      router.push(`?branch=${branchId}&q=${encodeURIComponent(query)}`);
    }
  }, [branchId, query, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="prose prose-invert max-w-none">
          <p>Loading bar menu…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen p-8">
        <Card className="max-w-md mx-auto bg-red/5 border-red/20">
          <div className="p-6">
            <h3 className="font-display text-xl font-bold text-red mb-2">Error</h3>
            <p className="text-muted">{error}</p>
            <ButtonLink href="/" className="mt-3">Back Home</ButtonLink>
          </div>
        </Card>
      </div>
    );
  }

  const selectedBranch = branches.find((b) => b.id === branchId) || branches[0] || {};

  return (
    <div className="min-h-screen bg-gradient-to-b from-sand to-ember/5 min-h-screen">
      <nav className="border-b border-line/50 bg-white/90 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="font-display text-xl font-bold text-ember">Vista Kigali</span>
          </Link>
          <div className="hidden md:flex items-center gap-4">
            <Link href="/" className="text-[12px] font-semibold text-ink hover:text-ember transition">Home</Link>
            <Link href={`/bar?branch=${selectedBranch.id}&q=${encodeURIComponent(query)}`} className="text-[12px] font-semibold text-ink hover:text-ember transition">Bar</Link>
            <Link href={`/menu?branch=${selectedBranch.id}`} className="text-[12px] font-semibold text-ink hover:text-ember transition">Food</Link>
          </div>
          <div className="flex items-center gap-2">
            <select
              onChange={(e) => {
                const selected = branches.find((b) => b.id === e.target.value);
                if (selected) {
                  router.push(`?branch=${e.target.value}&q=${encodeURIComponent(query)}`);
                }
              }}
              className="rounded-lg border border-line px-3 py-2 text-[12px] font-medium text-ink focus:outline-none focus:ring-2 focus:ring-ember/30"
            >
              <option value="">All branches</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id} selected={branch.id === branchId}>
                  {branch.code}
                </option>
              ))}
            </select>
            <span className="text-[11px] text-muted opacity-70">
              {selectedBranch.name || ""}
            </span>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tight mb-2">
            Bar & Drinks
          </h1>
          <p className="text-[16px] text-muted">
            Premium cocktails, wines, and spirits
          </p>
        </div>

        <div className="mb-8">
          <p className="text-[14px] text-muted mb-3">
            Select a branch to view the bar menu:
          </p>
          {branches.length === 0 ? (
            <p className="text-muted">No branches available</p>
          ) : (
            <select
              onChange={(e) => {
                router.push(`?branch=${e.target.value}&q=${encodeURIComponent(query)}`);
              }}
              className="rounded-lg border border-line px-3 py-2 text-[12px] font-medium text-ink focus:outline-none focus:ring-2 focus:ring-ember/30"
            >
              <option value="">All branches</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id} selected={branch.id === branchId}>
                  {branch.code}
                </option>
              ))}
            </select>
          )}
        </div>

        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-6 py-3 sm:px-8">
            <div>
              <h2 className="text-lg leading-tight">Drinks</h2>
              <p className="text-[11px] text-muted">
                {items.length} drink{item.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>

          <div className="hidden overflow-x-auto lg:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableCell className="w-48">Drink</TableCell>
                  <TableCell className="text-right w-28">Price</TableCell>
                  <TableCell className="text-right w-32">Type</TableCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id} className="border-b border-line/50 hover:bg-ember/5 transition">
                    <TableCell className="font-medium text-ink">
                      <div className="flex items-center gap-2">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-line bg-sand/50">
                          <svg
                            className="h-5 w-5 text-ember"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                          >
                            <path d="M3 3v18h18V3H3zm6 6v4h4V9H9zm6 6v4h4v-4h-4zM9 17H5v2h4v-2zm6-8c-3.31 0-6 2.69-6 6s2.69 6 6 6s6-2.69-6-6z" />
                          </svg>
                        </span>
                        <span>{item.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatCurrency(item.price, item.currency || "RWF")}
                    </TableCell>
                    <TableCell className="text-right text-muted">
                      {item.description || "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile list */}
          <ul className="divide-y divide-line/70 lg:hidden">
            {items.map((item) => (
              <li key={item.id} className="px-4 py-3">
                <div className="flex items-start gap-3">
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-line bg-sand/50">
                    <svg
                      className="h-5 w-5 text-ember"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M3 3v18h18V3H3zm6 6v4h4V9H9zm6 6v4h4v-4h-4zM9 17H5v2h4v-2zm6-8c-3.31 0-6 2.69-6 6s2.69 6 6 6s6-2.69-6-6z" />
                    </svg>
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[13.5px] font-medium leading-snug text-ink">
                          {item.name}
                        </p>
                        <p className="text-[11px] text-muted">
                          {item.description || "—"}
                        </p>
                      </div>
                      <p className="shrink-0 text-[13px] font-semibold tabular-nums">
                        {formatCurrency(item.price, item.currency || "RWF")}
                      </p>
                    </div>
                  </div>
                </div>
                {selectedBranch.code ? (
                  <div className="mt-2 flex items-center gap-1.5 border-t border-line/60 pt-2">
                    <span>{selectedBranch.code} · Available</span>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>

        {/* Empty state */}
        {items.length === 0 && (
          <div className="mt-8 p-8 text-center bg-white/5 rounded-2xl">
            <h3 className="font-display text-xl font-bold mb-2">No drinks found</h3>
            <p className="text-muted mb-6">
              Try adjusting your search or selecting a different branch.
            </p>
            <ButtonLink href={`/bar?branch=${branchId}&q=${encodeURIComponent(query)}`} variant="primary">
              View All Drinks
            </ButtonLink>
            <ButtonLink href="/" variant="secondary">Back Home</ButtonLink>
          </div>
        )}
      </main>
    </div>
  );
}