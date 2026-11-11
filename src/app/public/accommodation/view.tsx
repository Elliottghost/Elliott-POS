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

export default function AccommodationPage() {
  const [searchParams] = useSearchParams();
  const router = useRouter();
  const [toast] = useToast();
  const [isMounted] = useIsMounted();

  const branchId = searchParams.get("branch") || "";

  const [branches, setBranches] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const allBranches = await listBranches(undefined, { includeInactive: false });
        setBranches(allBranches);

        // Sample rooms - in production this would come from a database
        const defaultRooms = [
          {
            id: "1",
            type: "Deluxe Room",
            capacity: 2,
            description: "Elegant room with city views, premium amenities, and mini-bar.",
            price: 85_000,
            image: "/placeholder-room-1.jpg",
            branchId: "kimironko",
          },
          {
            id: "2",
            type: "Suite",
            capacity: 4,
            description: "Luxurious suite with separate living area, bathtub, and balcony.",
            price: 150_000,
            image: "/placeholder-room-2.jpg",
            branchId: "rond-point",
          },
          {
            id: "3",
            type: "Standard Room",
            capacity: 2,
            description: "Comfortable room with essential amenities and city view.",
            price: 65_000,
            image: "/placeholder-room-3.jpg",
            branchId: "kimironko",
          },
        ];

        setRooms(defaultRooms);
        setIsLoading(false);
      } catch (err) {
        console.error("Failed to load accommodation:", err);
        setError("Failed to load accommodation. Please try again.");
        setIsLoading(false);
      }
    }

    load();
  }, [branchId, isMounted]);

  useEffect(() => {
    if (branchId) {
      localStorage.setItem("vista_branch", branchId);
      router.push(`?branch=${branchId}`);
    }
  }, [branchId, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="prose prose-invert max-w-none">
          <p>Loading accommodation…</p>
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
            <ButtonLink href="/" className="mt-3">Back to homepage</ButtonLink>
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
            <Link href={`/accommodation?branch=${selectedBranch.id}`} className="text-[12px] font-semibold text-ink hover:text-ember transition">Accommodation</Link>
            <Link href={`/menu?branch=${selectedBranch.id}`} className="text-[12px] font-semibold text-ink hover:text-ember transition">Menu</Link>
          </div>
          <div className="flex items-center gap-2">
            <select
              onChange={(e) => {
                const selected = branches.find((b) => b.id === e.target.value);
                if (selected) {
                  router.push(`?branch=${e.target.value}`);
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
            Accommodation
          </h1>
          <p className="text-[16px] text-muted">
            Luxury rooms and suites
          </p>
        </div>

        <Card className="overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4">
            {rooms.map((room) => (
              <div
                key={room.id}
                className="border rounded-xl overflow-hidden hover:shadow-xl transition-shadow cursor-pointer"
              >
                <img
                  src={room.image}
                  alt={room.type}
                  className="w-full h-48 object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <div className="p-4">
                  <h3 className="font-display text-lg font-bold mb-1">{room.type}</h3>
                  <p className="text-[12px] text-muted mb-2">{room.description}</p>
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-ink">
                      {formatCurrency(room.price, selectedBranch.currency || "RWF")} per night
                    </span>
                    <Badge tone="success">Available</Badge>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Branch selector */}
        {branches.length > 0 && (
          <div className="mt-8 p-6 bg-white/5 rounded-2xl">
            <h3 className="font-display text-lg font-bold mb-4">Select branch</h3>
            <p className="text-[13px] text-muted mb-4">
              View rooms at:
            </p>
            <select
              onChange={(e) => {
                router.push(`?branch=${e.target.value}`);
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
        {rooms.length === 0 && branches.length > 0 && (
          <div className="mt-8 p-8 text-center bg-white/5 rounded-2xl">
            <h3 className="font-display text-xl font-bold mb-2">No rooms available</h3>
            <p className="text-muted mb-6">
              Accommodation details will be available soon. Please contact us for inquiries.
            </p>
            <ButtonLink href="/" variant="secondary">Back Home</ButtonLink>
          </div>
        )}
      </main>
    </div>
  );
}