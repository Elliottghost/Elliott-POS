"use client";

import { useEffect, useState } from "react";
import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams, usePathname, useRouter } from "next/navigation";
import { useToast } from "@/components/ui/use-toast";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { useParams } from "next/navigation";
import { listBranches, branchScope } from "@/lib/auth/access";
import { createReservation, getReservation, listReservations } from "@/services/reservations";
import { formatCurrency } from "@/lib/format";
import { format } from "@/lib/format";
import { useIsMounted } from "@/lib/hooks";

export default function ReservationsPage() {
  const [searchParams] = useSearchParams();
  const router = useRouter();
  const [toast] = useToast();
  const [isMounted] = useIsMounted();

  const branchId = searchParams.get("branch") || "";
  const reservationId = searchParams.get("reservationId") || "";

  const [branches, setBranches] = useState([]);
  const [formData, setFormData] = useState({
    branchId: "",
    date: "",
    guestCount: "",
    name: "",
    phone: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reservations, setReservations] = useState([]);
  const [viewingReservation, setViewingReservation] = useState(null);

  // Load branches
  useEffect(() => {
    async function load() {
      try {
        const allBranches = await listBranches(undefined, { includeInactive: false });
        setBranches(allBranches);

        // Load existing reservations for the selected branch
        if (branchId) {
          const reservations = await listReservations(branchId);
          setReservations(reservations);
        }
        setIsLoading(false);
      } catch (err) {
        console.error("Failed to load reservations:", err);
        setError("Failed to load reservations.");
        setIsLoading(false);
      }
    }

    load();
  }, [branchId, isMounted]);

  // Update branch when selected
  useEffect(() => {
    if (branchId) {
      localStorage.setItem("vista_branch", branchId);
      router.push("?branch=" + branchId;
    }
  }, [branchId, router]);

  // Handle form changes
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const reservation = await createReservation({
        ...formData,
        branchId: branchId || undefined,
      });
      setSubmitted(true);
      setFormData({
        branchId: "",
        date: "",
        guestCount: "",
        name: "",
        phone: "",
      });
      toast({
        title: "Reservation submitted",
        description: `Your reservation reference is ${reservation.reference}.`,
      });
    } catch (err) {
      console.error("Reservation failed:", err);
      setError("Failed to submit reservation. Please try again.");
      toast({
        title: "Reservation failed",
        description: "Please try again or contact us directly.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Load single reservation for viewing
  useEffect(() => {
    async function load() {
      if (reservationId) {
        try {
          const reservation = await getReservation(reservationId);
          if (reservation) {
            setViewingReservation(reservation);
          }
        } catch (err) {
          console.error("Failed to load reservation:", err);
        }
      }
    }

    load();
  }, [reservationId, isMounted]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="prose prose-invert max-w-none">
          <p>Loading reservations…</p>
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
            <ButtonLink href="/">Back to homepage</ButtonLink>
          </div>
        </Card>
      </div>
    );
  }

  const selectedBranch = branches.find((b) => b.id === branchId) || branches[0] || {};

  // If viewing a specific reservation
  if (viewingReservation) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-sand to-ember/5 min-h-screen">
        <nav className="border-b border-line/50 bg-white/90 backdrop-blur-sm sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <span className="font-display text-xl font-bold text-ember">Vista Kigali</span>
            </Link>
            <div className="hidden md:flex items-center gap-4">
              <Link href="/" className="text-[12px] font-semibold text-ink hover:text-ember transition">Home</Link>
              <Link href="/reservations?branch=${selectedBranch.id || ""}" className="text-[12px] font-semibold text-ink hover:text-ember transition">Reservations</Link>
            </div>
          </div>
        </nav>

        <main className="max-w-7xl mx-auto px-6 py-8">
          <div className="mb-8">
            <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tight mb-2">
              Reservation Details
            </h1>
            <p className="text-[16px] text-muted">
              Reference: {viewingReservation.reference}
            </p>
          </div>

          <Card className="p-6">
            <dl className="space-y-4">
              <div className="flex items-start gap-4">
                <dt className="font-medium text-ink">Reference</dt>
                <dd>
                  <span className="font-mono text-ember underline cursor-default">
                    {viewingReservation.reference}
                  </span>
                </dd>
              </div>
              <div className="flex items-start gap-4">
                <dt className="font-medium text-ink">Branch</dt>
                <dd>{viewingBranchName}</dd>
              </div>
              <div className="flex items-start gap-4">
                <dt className="font-medium text-ink">Date</dt>
                <dd>{format(new Date(viewingReservation.reservationDate), "dd MMM yyyy")}</dd>
              </div>
              <div className="flex items-start gap-4">
                <dt className="font-medium text-ink">Guests</dt>
                <dd>{viewingReservation.guestCount}</dd>
              </div>
              <div className="flex items-start gap-4">
                <dt className="font-medium text-ink">Name</dt>
                <dd>{viewingReservation.customerName}</dd>
              </div>
              <div className="flex items-start gap-4">
                <dt className="font-medium text-ink">Phone</dt>
                <dd>
                  <a href={`tel:${viewingReservation.customerPhone}`} className="text-ember hover:underline">
                    {viewingReservation.customerPhone}
                  </a>
                </dd>
              </div>
              <div className="flex items-start gap-4">
                <dt className="font-medium text-ink">Status</dt>
                <dd>
                  <Badge
                    tone={
                      viewingReservation.status === "confirmed"
                        ? "success"
                        : viewingReservation.status === "seated"
                          ? "primary"
                          : "neutral"
                    }
                  >
                    {viewingReservation.status}
                  </Badge>
                </dd>
              </div>
            </dl>
          </Card>
        </main>
      </div>
    );
  }

  // If on branch page showing reservations list
  return (
    <div className="min-h-screen bg-gradient-to-b from-sand to-ember/5 min-h-screen">
      <nav className="border-b border-line/50 bg-white/90 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="font-display text-xl font-bold text-ember">Vista Kigali</span>
          </Link>
          <div className="hidden md:flex items-center gap-4">
            <Link href="/" className="text-[12px] font-semibold text-ink hover:text-ember transition">Home</Link>
            <Link href="/reservations?branch=${selectedBranch.id || ""}" className="text-[12px] font-semibold text-ink hover:text-ember transition">Reservations</Link>
            <Link href="/menu?branch=${selectedBranch.id || ""}" className="text-[12px] font-semibold text-ink hover:text-ember transition">Menu</Link>
          </div>
          <div className="flex items-center gap-2">
            <select
              onChange={(e) => {
                const selected = branches.find((b) => b.id === e.target.value);
                if (selected) {
                  router.push("?branch=" + e.target.value;
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
            Table Reservations
          </h1>
          <p className="text-[16px] text-muted">
            Book a table at Vista Kigali
          </p>
        </div>

        {/* Reservation form */}
        <Card className="mb-6 p-6">
          <h2 className="font-display text-2xl font-bold text-ember mb-4">
            Make a Reservation
          </h2>
          {submitted ? (
            <div className="mb-4 p-4 bg-green/5 border-green/20 rounded-xl">
              <p className="font-display text-lg font-bold text-green mb-1">
                Reservation successful!
              </p>
              <p className="text-muted">
                Your reference number is: <span className="font-mono text-ember">
                  {formData.reference || "KIM-XXXXX"}
                </span>
              </p>
              <ButtonLink href="/" variant="primary">
                Go Home
              </ButtonLink>
            </div>
          )
            : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <input
                  type="hidden"
                  name="branchId"
                  value={branchId}
                  defaultValue={branchId}
                />
                <input
                  type="hidden"
                  name="reference"
                  defaultValue={
                    branchId === "kimironko"
                      ? "KIM-" + Math.floor(10000 + Math.random() * 89999)
                      : "RDP-" + Math.floor(10000 + Math.random() * 89999)
                  }
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="field-label text-[11px] uppercase tracking-[0.1em] text-muted mb-1">
                      Full Name
                    </label>
                    <input
                      type="text"
                      name="name"
                      placeholder="John Doe"
                      value={formData.name}
                      onChange={handleChange}
                      required
                      className="field-input rounded-lg border border-line px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="field-label text-[11px] uppercase tracking-[0.1em] text-muted mb-1">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      name="phone"
                      placeholder="+250 788 000 000"
                      value={formData.phone}
                      onChange={handleChange}
                      required
                      className="field-input rounded-lg border border-line px-3 py-2"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="field-label text-[11px] uppercase tracking-[0.1em] text-muted mb-1">
                      Guest Count
                    </label>
                    <input
                      type="number"
                      name="guestCount"
                      min="1"
                      max="20"
                      value={formData.guestCount}
                      onChange={handleChange}
                      required
                      className="field-input rounded-lg border border-line px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="field-label text-[11px] uppercase tracking-[0.1em] text-muted mb-1">
                      Date
                    </label>
                    <input
                      type="date"
                      name="date"
                      min={new Date().toISOString().split("T")[0]}
                      value={formData.date}
                      onChange={handleChange}
                      required
                      className="field-input rounded-lg border border-line px-3 py-2"
                    />
                  </div>
                </div>

                <Button type="submit" className="w-full">
                  Reserve Table
                </Button>
              </form>
            )
          )}
        </Card>

        {/* Existing reservations list */}
        {branches.length > 0 && !submitted && (
          <div className="mb-6">
            <h2 className="font-display text-xl font-bold text-ember mb-4">
              Existing Reservations
            </h2>
            <p className="text-[13px] text-muted mb-3">
              Previous and upcoming reservations
            </p>
            <div className="overflow-x-auto">
              <table className="table w-full">
                <thead>
                  <tr>
                    <th className="text-left">Reference</th>
                    <th className="text-left">Branch</th>
                    <th className="text-left">Date</th>
                    <th className="text-left">Guests</th>
                    <th className="text-left">Status</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {reservations.map((res) => (
                    <tr key={res.id} className="border-b border-line/50 hover:bg-ember/5 transition">
                      <td className="font-medium text-ink">
                        {res.reference}
                      </td>
                      <td>{res.branchCode}</td>
                      <td>
                        {format(new Date(res.reservationDate), "dd MMM yyyy")}
                      </td>
                      <td>{res.guestCount}</td>
                      <td>
                        <Badge
                          tone={
                            res.status === "confirmed"
                              ? "success"
                              : res.status === "seated"
                                ? "primary"
                                : "neutral"
                          }
                        >
                          {res.status}
                        </Badge>
                      </td>
                      <td className="text-right">
                        <ButtonLink
                          href={`/reservations?reservationId=${res.id}&branch=${res.branchId}`}
                          variant="outline"
                          size="sm"
                        >
                          View
                        </ButtonLink>
                      </td>
                    </tr>
                  ))}
                  {reservations.length === 0 && (
                    <tr>
                      <td colSpan="6" className="text-center py-8 text-muted">
                        No reservations found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Empty state when no branch selected */}
        {branches.length === 0 && !submitted && (
          <div className="mt-8 p-8 text-center bg-white/5 rounded-2xl">
            <h3 className="font-display text-xl font-bold mb-2">Select a branch</h3>
            <p className="text-muted mb-6">
              Please select a branch to view or make reservations.
            </p>
            <ButtonLink href="/" variant="secondary">Back Home</ButtonLink>
          </div>
        )}
      </main>
    </div>
  );
}