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
import { branchScope } from "@/lib/auth/access";
import { listBranches } from "@/lib/public-data";
import { getSetting } from "@/lib/public-data";
import { useIsMounted } from "@/lib/hooks";

export default function EventsPage() {
  const [searchParams] = useSearchParams();
  const router = useRouter();
  const [toast] = useToast();
  const [isMounted] = useIsMounted();

  const branchId = searchParams.get("branch") || "";

  const [branches, setBranches] = useState([]);
  const [events, setEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const allBranches = await listBranches(undefined, { includeInactive: false });
        setBranches(allBranches);

        // Load events - in production this would come from a database
        const defaultEvents = [
          {
            id: "1",
            title: "New Year's Eve Gala",
            date: "December 31, 2026",
            description:
              "Celebrate the night away with premium champagne, live music, and a special tasting menu.",
            image: "/placeholder-event-1.jpg",
            branchId: "kimironko",
          },
          {
            id: "2",
            title: "Wine Tasting Evening",
            date: "January 15, 2027",
            description:
              "An evening of fine wines paired with artisanal cheeses and canapés.",
            image: "/placeholder-event-2.jpg",
            branchId: "rond-point",
          },
          {
            id: "3",
            title: "Valentine's Day Dinner",
            date: "February 14, 2027",
            description:
              "Romantic dinner for two with a special three-course menu and live violin.",
            image: "/placeholder-event-3.jpg",
            branchId: "kimironko",
          },
        ];

        setEvents(defaultEvents);
        setIsLoading(false);
      } catch (err) {
        console.error("Failed to load events:", err);
        setError("Failed to load events. Please try again.");
        setIsLoading(false);
      }
    }

    load();
  }, [branchId, isMounted]);

  useEffect(() => {
    if (branchId) {
      localStorage.setItem("vista_branch", branchId);
      router.push("?branch=" + branchId);
    }
  }, [branchId, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="prose prose-invert max-w-none">
          <p>Loading events…</p>
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

  const branch = branches.find((b) => b.id === branchId) || branches[0] || {};

  // Build branch URL path
  const branchPath = branch.id === "kimironko" ? "kimironko" : branch.id === "rond-point" ? "rond-point" : "";

  return (
    <div className="min-h-screen bg-gradient-to-b from-sand to-ember/5 min-h-screen">
      <nav className="border-b border-line/50 bg-white/90 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="font-display text-xl font-bold text-ember">Vista Kigali</span>
          </Link>
          <div className="hidden md:flex items-center gap-4">
            <Link href="/" className="text-[12px] font-semibold text-ink hover:text-ember transition">
              Home
            </Link>
            <Link
              href={`/events${branchPath}`}
              className="text-[12px] font-semibold text-ink hover:text-ember transition"
            >
              Events
            </Link>
            <Link
              href={`/menu${branchPath}`}
              className="text-[12px] font-semibold text-ink hover:text-ember transition"
            >
              Menu
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <select
              onChange={(e) => {
                const selected = branches.find((b) => b.id === e.target.value);
                if (selected) {
                  router.push("?branch=" + selected.id);
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
              {branch.name || ""}
            </span>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tight mb-2">
            Events
          </h1>
          <p className="text-[16px] text-muted">
            Upcoming events at Vista Kigali
          </p>
        </div>

        <Card className="overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
            {events.map((event) => (
              <div
                key={event.id}
                className="border rounded-xl overflow-hidden hover:shadow-xl transition-shadow cursor-pointer"
                onClick={() => router.push("/event/" + event.id)}
              >
                <img
                  src={event.image}
                  alt={event.title}
                  className="w-full h-48 object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <div className="p-4">
                  <h3 className="font-display text-xl font-bold mb-1">
                    {event.title}
                  </h3>
                  <p className="text-[12px] text-muted mb-2">{event.date}</p>
                  <p className="text-[12px] text-muted line-clamp-2">
                    {event.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Branch selector */}
        {branches.length > 0 && (
          <div className="mt-8 p-6 bg-white/5 rounded-2xl">
            <h3 className="font-display text-lg font-bold mb-4">
              Select branch
            </h3>
            <p className="text-[13px] text-muted mb-4">
              View events from:
            </p>
            <select
              onChange={(e) => {
                router.push("?branch=" + e.target.value);
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
          </div>
        )}

        {/* Empty state */}
        {events.length === 0 && branches.length > 0 && (
          <div className="mt-8 p-8 text-center bg-white/5 rounded-2xl">
            <h3 className="font-display text-xl font-bold mb-2">
              No events scheduled
            </h3>
            <p className="text-muted mb-6">
              No events are currently scheduled. Check back soon or contact us for more information.
            </p>
            <ButtonLink href="/" variant="secondary">Back Home</ButtonLink>
          </div>
        )}
      </main>
    </div>
  );
}