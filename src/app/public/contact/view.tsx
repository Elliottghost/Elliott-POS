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

export default function ContactPage() {
  const [searchParams] = useSearchParams();
  const router = useRouter();
  const [toast] = useToast();
  const [isMounted] = useIsMounted();

  const branchId = searchParams.get("branch") || "";

  const [branches, setBranches] = useState([]);
  const [contactInfo, setContactInfo] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const allBranches = await listBranches(undefined, { includeInactive: false });
        setBranches(allBranches);

        // Load contact settings
        const phone = await getSetting("business.phone", "+250 788 000 000");
        const email = await getSetting("business.email", "hello@vistakigali.rw");
        const address = await getSetting("business.address", "Kimironko, Kigali");

        setContactInfo({ phone, email, address });
        setIsLoading(false);
      } catch (err) {
        console.error("Failed to load contact info:", err);
        setError("Failed to load contact information.");
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
          <p>Loading contact info…</p>
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
            <Link href="/" className="text-[12px] font-semibold text-ink hover:text-ember transition">Home</Link>
            <Link
              href={`/contact${branchPath}`}
              className="text-[12px] font-semibold text-ink hover:text-ember transition"
            >
              Contact
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
            Contact
          </h1>
          <p className="text-[16px] text-muted">
            Get in touch with Vista Kigali
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Contact Info Card */}
          <Card className="p-6">
            <h2 className="font-display text-2xl font-bold text-ember mb-4">
              Contact Information
            </h2>
            <dl className="space-y-4">
              <div className="flex items-start gap-4">
                <dt className="font-medium text-ink">Phone</dt>
                <dd>
                  <a
                    href={`tel:${contactInfo.phone}`}
                    className="text-ember hover:underline"
                  >
                    {contactInfo.phone}
                  </a>
                </dd>
              </div>
              <div className="flex items-start gap-4">
                <dt className="font-medium text-ink">Email</dt>
                <dd>
                  <a
                    href={`mailto:${contactInfo.email}`}
                    className="text-ember hover:underline"
                  >
                    {contactInfo.email}
                  </a>
                </dd>
              </div>
              <div className="flex items-start gap-4">
                <dt className="font-medium text-ink">Address</dt>
                <dd>
                  <p>{contactInfo.address}</p>
                </dd>
              </div>
            </dl>
          </Card>

          {/* Map and social */}
          <Card className="p-6">
            <h2 className="font-display text-2xl font-bold text-ember mb-4">
              Location
            </h2>
            <div className="h-64 rounded-xl bg-ember/10 overflow-hidden">
              {/* Map would be integrated here */}
              <p className="text-center py-8 text-muted">
                Google Maps integration would appear here
              </p>
            </div>
            <div className="mt-4 flex gap-3">
              {/* Social links would go here */}
              <ButtonLink
                href="https://instagram.com/vistakigali"
                target="_blank"
                variant="outline"
                className="flex items-center gap-1.5"
              >
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path
                    d="M12 2.163c3.204 0 3.584.012 4.882.07 3.56.056 4.765 1.503 4.923 5.086a4.988 4.988 0 0 1-1.535 4.388 4.994 4.994 0 0 1-3.003 1.447l.001.003c-1.317.038-2.398.786-3.13 1.637.6 1.287 1.178 2.863 1.533 4.294-1.065-.156-2.093-.726-2.395-1.437-.3-.716-.533-1.477-.683-2.152-.15-1.295-.174-2.762-.063-4.05.258.012 1.02.096 2.133.483 1.113.387 2.25.773 3.326 1.296-.618.06-1.252.072-1.884.056-2.116-.364-3.506-1.067-4.426-2.677-.186-.2-.288-.417-.288-.635 0-.263.16- .512.308-.649.148-.136.316-.243.537-.303.339-.08 1.011-.06 2.027.053.605.037 1.242.03 2.07.03.696 0 1.328-.057 1.887-.23.42-.117.796-.283 1.123-.53.327-.247.536-.543.652-.898.116-.357.162-.67.15-1.141-.014-.534-.163-1.007-.378-1.418a11.828 11.828 0 0 1-.322-2.058 11.907 11.907 0 0 1-.165-2.494c0-.003 0-.006 0-.009zm0 5.818a6.272 6.272 0 1 0 0 12.544 6.272 6.272 0 0 0 0-12.544z"
                  />
                </svg>
                Instagram
              </ButtonLink>
              <ButtonLink
                href="https://facebook.com/vistakigali"
                target="_blank"
                variant="outline"
                className="flex items-center gap-1.5"
              >
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3zm-1.5 4.5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5S12 15.83 12 15 11.17 13.5 10.5 13.5 9 12.17 9 10.5 9.83 9 10.5 10.17 10.5 11 11.5 11.5 12 12.5z" />
                </svg>
                Facebook
              </ButtonLink>
            </div>
          </Card>
        </div>

        {/* Branch selector */}
        {branches.length > 0 && (
          <div className="mt-8 p-6 bg-white/5 rounded-2xl">
            <h3 className="font-display text-lg font-bold mb-4">
              Select branch
            </h3>
            <p className="text-[13px] text-muted mb-4">
              Contact branch:
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

        {/* Empty state / form */}
        {isLoading && branches.length === 0 && (
          <div className="mt-8 p-8 text-center bg-white/5 rounded-2xl">
            <h3 className="font-display text-xl font-bold mb-2">
              Loading…
            </h3>
            <p className="text-muted">
              Contact information is loading.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}