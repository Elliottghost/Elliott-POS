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
import { getOrderById } from "@/services/orders";
import { listKitchenOrders } from "@/services/kitchen";
import { formatCurrency } from "@/lib/format";
import { useIsMounted } from "@/lib/hooks";

export default function TrackOrderPage() {
  const [searchParams] = useSearchParams();
  const router = useRouter();
  const [toast] = useToast();
  const [isMounted] = useIsMounted();

  const reference = searchParams.get("orderReference") || "";
  const phone = searchParams.get("phone") || "";

  const [order, setOrder] = useState<Order | null>(null);
  const [kitchenStatus, setKitchenStatus] = useState<KitchenStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState<{ id: string; code: string; name: string } | null>(null);

  useEffect(() => {
    async function load() {
      try {
        // Load branches for context
        const allBranches = await listBranches(undefined, { includeInactive: false });
        setBranches(allBranches);

        // Determine branch from reference or use default
        let branchId = "";
        if (reference.startsWith("KIM")) {
          branchId = "kimironko";
        } else if (reference.startsWith("RDP")) {
          branchId = "rond-point";
        }

        const selectedBranch = allBranches.find((b) => b.id === branchId) || allBranches[0] || {};
        setSelectedBranch(selectedBranch);

        // Load order details
        if (reference) {
          const orderData = await getOrderById(reference);
          if (orderData) {
            setOrder(orderData);
            
            // Get kitchen status for this order
            const kitchenOrders = await listKitchenOrders([branchId]);
            const kitchenOrder = kitchenOrders.find((o) => o.id === reference);
            if (kitchenOrder) {
              setKitchenStatus(kitchenOrder.fulfillmentStatus as KitchenStatus);
            }
          } else {
            setError("Order not found. Please check your reference and phone number.");
          }
        }
        setLoading(false);
      } catch (err) {
        console.error("Failed to load order tracking:", err);
        setError("Failed to load order. Please try again.");
        setLoading(false);
      }
    }

    load();
  }, [reference, phone, isMounted]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="prose prose-invert max-w-none">
          <p>Tracking order…</p>
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

  // Kitchen status labels
  const statusLabels: Record<KitchenStatus, string> = {
    queued: "Order Received",
    preparing: "Preparing",
    ready: "Ready to serve",
    served: "Served / Completed",
    cancelled: "Cancelled",
  };

  if (!order) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-sand to-ember/5 min-h-screen">
        <nav className="border-b border-line/50 bg-white/90 backdrop-blur-sm sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <span className="font-display text-xl font-bold text-ember">Vista Kigali</span>
            </Link>
            <Link href="/" className="text-[12px] font-semibold text-ink hover:text-ember transition">Home</Link>
          </div>
        </nav>

        <main className="max-w-7xl mx-auto px-6 py-8">
          <div className="mb-8">
            <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tight mb-2">
              Track Order
            </h1>
          </div>

          <Card className="p-6">
            <p className="text-[14px] text-muted mb-6">
              Enter your order reference and phone number to track your order status.
            </p>
            <form className="space-y-4">
              <div>
                <label className="field-label text-[11px] uppercase tracking-[0.1em] text-muted mb-1">
                  Order Reference
                </label>
                <input
                  type="text"
                  placeholder="e.g., KIM-12345 or RDP-67890"
                  value={reference}
                  onChange={(e) => router.push("?orderReference=" + e.target.value + "&phone=" + phone)}
                  className="field-input rounded-lg border border-line px-3 py-2"
                />
              </div>
              <div>
                <label className="field-label text-[11px] uppercase tracking-[0.1em] text-muted mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  placeholder="+250 788 000 000"
                  value={phone}
                  onChange={(e) => router.push("?orderReference=" + reference + "&phone=" + e.target.value)}
                  className="field-input rounded-lg border border-line px-3 py-2"
                />
              </div>
              <Button type="submit" className="w-full">
                Track Order
              </form>
            </Card>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-sand to-ember/5 min-h-screen">
      <nav className="border-b border-line/50 bg-white/90 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="font-display text-xl font-bold text-ember">Vista Kigali</span>
          </Link>
          <div className="hidden md:flex items-center gap-4">
            <Link href="/" className="text-[12px] font-semibold text-ink hover:text-ember transition">Home</Link>
            <Link href="/track-order" className="text-[12px] font-semibold text-ink hover:text-ember transition">Track Order</Link>
            <Link href="/menu?branch=" + (selectedBranch?.id || "") className="text-[12px] font-semibold text-ink hover:text-ember transition">Menu</Link>
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
                <option key={branch.id} value={branch.id} selected={branch.id === selectedBranch?.id}>
                  {branch.code}
                </option>
              ))}
            </select>
            <span className="text-[11px] text-muted opacity-70">
              {selectedBranch?.name || ""}
            </span>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tight mb-2">
            Order #${order?.orderNumber || reference}
          </h1>
          <p className="text-[16px] text-muted">
            {order?.customerName || "Guest"} — {order?.customerPhone || "Phone on file"}
          </p>
        </div>

        <Card className="p-6">
          {/* Order Details */}
          <dl className="space-y-4">
            <div>
              <dt className="font-medium text-ink">Order Reference</dt>
              <dd className="font-mono text-ember">
                {order.orderNumber}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-ink">Branch</dt>
              <dd>{selectedBranch?.code || ""}</dd>
            </div>
            <div>
              <dt className="font-medium text-ink">Order Type</dt>
              <dd>
                {order.channel === "dine_in" ? "Dine-in" : order.channel === "takeaway" ? "Takeaway" : "Delivery"}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-ink">Items</dt>
              <dd>{order.items.length} items</dd>
            </div>
            <div>
              <dt className="font-medium text-ink">Subtotal</dt>
              <dd>
                {formatCurrency(order.subtotal, "RWF")}
              </dd>
            </div>
            {order.total > 0 && (
              <div>
                <dt className="font-medium text-ink">Total Paid</dt>
                <dd className="font-medium tabular-nums">
                  {formatCurrency(order.total, "RWF")}
                </dd>
              </div>
            )}
            {order.paidAt && (
              <div>
                <dt className="font-medium text-ink">Paid At</dt>
                <dd>{format(new Date(order.paidAt), "dd MMM yyyy, hh:mm a")}</dd>
              </div>
            )}
          </dl>

          {/* Kitchen Status */}
          {order && (
            <div className="mt-6 p-4 bg-ember/5 rounded-xl">
              <h3 className="font-display text-semibold text-ember mb-3">Kitchen Status</h3>
              <p className="text-[13px] text-muted">
                Current status: <strong className="text-ember">
                  {kitchenStatus ? statusLabels[kitchenStatus] : "Order Received"}
                </strong>
              </p>
              {kitchenStatus && (
                <Badge
                  tone={
                    kitchenStatus === "ready"
                      ? "success"
                      : kitchenStatus === "served"
                        ? "primary"
                        : kitchenStatus === "cancelled"
                          ? "error"
                          : "neutral"
                  }
                >
                  {statusLabels[kitchenStatus]}
                </Badge>
              )}
              <p className="text-muted mt-2">
                The kitchen is {'kitchenStatus === 'ready' ? 'preparing your order' : kitchenStatus === 'served' ? 'your order has been served' : 'working on your order'}. Refresh to see updates.
              </p>
            </div>
          )}
        </Card>

        {/* Refresh button */}
        <div className="mt-8 text-center">
          <Button
            onClick={() => {
              router.push(`?orderReference=${reference}&phone=${phone}`);
            }}
            className="w-full rounded-lg border ember bg-ember/10 text-ember px-4 py-2 text-sm font-semibold"
          >
            Refresh Status
          </Button>
        </div>
      </main>
    </div>
  );
}

// Types
type Order = {
  id: string;
  orderNumber: string;
  branchId: string;
  channel: string;
  tableLabel: string | null;
  customerName: string | null;
  guestCount: number | null;
  notes: string | null;
  total: number;
  currency: string;
  paidAt: Date | null;
  fulfillmentStatus: string;
  items: CartItem[];
};

type CartItem = {
  itemId: string;
  itemName: string;
  quantity: number;
  price: number;
};

type KitchenStatus =
  | "queued"
  | "preparing"
  | "ready"
  | "served"
  | "cancelled";

const statusLabels: Record<KitchenStatus, string> = {
  queued: "Order Received",
  preparing: "Preparing",
  ready: "Ready to serve",
  served: "Served / Completed",
  cancelled: "Cancelled",
};