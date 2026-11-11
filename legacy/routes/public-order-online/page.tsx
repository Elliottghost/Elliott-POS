"use client";

import { useEffect, useState } from "react";
import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams, usePathname, useRouter } from "next/navigation";
import { useToast } from "@/components/ui/use-toast";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectContent, SelectItem } from "@/components/ui/select";
import { useForm } from "@/lib/hooks";
import { formatCurrency } from "@/lib/format";
import { listMenuItems, listMenuCategories } from "@/services/menu";
import { listBranches, branchScope } from "@/lib/auth/access";
import { createOrder } from "@/services/orders";
import { getOrderById } from "@/services/orders";
import { recordPayment } from "@/services/orders";
import { useIsMounted } from "@/lib/hooks";

export default function OrderOnlinePage() {
  const [searchParams] = useSearchParams();
  const router = useRouter();
  const [toast] = useToast();
  const [isMounted] = useIsMounted();

  const branchId = searchParams.get("branch") || "";
  const orderId = searchParams.get("orderId") || "";

  const [branches, setBranches] = useState([]);
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [orderSubmitted, setOrderSubmitted] = useState(false);
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [showPayment, setShowPayment] = useState(false);

  // Load data
  useEffect(() => {
    async function load() {
      try {
        // Load branches
        const allBranches = await listBranches(undefined, { includeInactive: false });
        setBranches(allBranches);

        // Load categories
        const allCategories = await listMenuCategories({ includeInactive: false });
        setCategories(allCategories);

        // Load items for the selected branch
        const branch = allBranches.find((b) => b.id === branchId) || allBranches[0];
        if (branch) {
          const menuItems = await listMenuItems({
            includeInactive: false,
            categoryId: selectedCategory || undefined,
            search: searchQuery.trim() || undefined,
          });
          // Filter for items available at this branch
          const availableItems = menuItems.filter((item) => item.isActive);
          setItems(availableItems);
        }
        setLoading(false);
      } catch (err) {
        console.error("Failed to load order online data:", err);
        setError("Failed to load menu. Please try again.");
        setLoading(false);
      }
    }

    load();
  }, [branchId, selectedCategory, searchQuery, isMounted]);

  // Update branch when selected
  useEffect(() => {
    if (branchId) {
      localStorage.setItem("vista_branch", branchId);
      router.push(`?branch=${branchId}`);
    }
  }, [branchId, router]);

  // Format currency
  const currency = "RWF";

  // Cart operations
  const addToCart = (item: MenuItemRow, quantity: number) => {
    const existing = cart.find((ci) => ci.itemId === item.id);
    if (existing) {
      setCart(prev =>
        prev.map((ci) =>
          ci.itemId === item.id
            ? { ...ci, quantity: ci.quantity + quantity }
            : ci
        )
      );
    } else {
      setCart(prev => [...prev, { itemId: item.id, itemName: item.name, quantity, price: item.price }]);
    }
  };

  const removeFromCart = (itemId: string) => {
    setCart(prev => prev.filter((ci) => ci.itemId !== itemId));
  };

  const updateQuantity = (itemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(itemId);
    } else {
      setCart(prev =>
        prev.map((ci) =>
          ci.itemId === itemId ? { ...ci, quantity } : ci
        )
      );
    }
  };

  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const cartItemCount = cart.reduce((count, item) => count + item.quantity, 0);

  // Handle form submission - create order
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (cart.length === 0) {
      toast({
        title: "Cart is empty",
        description: "Please add items to your cart before submitting.",
        variant: "destructive",
      });
      return;
    }

    // Get the branch
    const branch = branches.find((b) => b.id === branchId);
    if (!branch) {
      toast({
        title: "Branch not found",
        description: "Please select a valid branch.",
        variant: "destructive",
      });
      return;
    }

    // Create the order
    try {
      const itemsForOrder = cart.map((item) => ({
        menuItemId: item.itemId,
        quantity: item.quantity,
        price: item.price, // Price at order time
      }));

      const created = await createOrder({
        branchId: branchId,
        channel: "dine_in", // Will be determined by order type
        tableLabel: "QR-ORDER", // QR table ordering
        guestCount: 1, // Will be updated
        items: itemsForOrder,
        notes: `Online order - customer: ${customerName || "guest"}, phone: ${customerPhone || "N/A"}`,
      });

      if (!created.ok || !created.id) {
        throw new Error("Order creation failed");
      }

      setOrder(created);
      setOrderSubmitted(true);

      toast({
        title: "Order confirmed!",
        description: `Order #${created.orderNumber} has been placed successfully.`,
      });

      // Clear cart
      setCart([]);
      setCustomerName("");
      setCustomerPhone("");
      setPaymentMethod("cash");
      setShowPayment(false);
    } catch (err) {
      console.error("Order creation failed:", err);
      setError("Failed to create order. Please try again.");
      toast({
        title: "Order failed",
        description: "Please try again or contact us directly.",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="prose prose-invert max-w-none">
          <p>Loading menu…</p>
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

  // Get branch
  const branch = branches.find((b) => b.id === branchId) || branches[0] || {};

  // If order was submitted, show confirmation
  if (orderSubmitted && order) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-sand to-ember/5 min-h-screen">
        <nav className="border-b border-line/50 bg-white/90 backdrop-blur-sm sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <span className="font-display text-xl font-bold text-ember">Vista Kigali</span>
            </Link>
            <div className="hidden md:flex items-center gap-4">
              <Link href="/" className="text-[12px] font-semibold text-ink hover:text-ember transition">Home</Link>
              <Link href="/order-online?branch=${branch.id}" className="text-[12px] font-semibold text-ink hover:text-ember transition">Order Online</Link>
              <Link href="/menu?branch=${branch.id}" className="text-[12px] font-semibold text-ink hover:text-ember transition">Menu</Link>
            </div>
          </div>
        </nav>

        <main className="max-w-7xl mx-auto px-6 py-8">
          <div className="mb-8">
            <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tight mb-2">
              Order Confirmation
            </h1>
            <p className="text-[16px] text-muted">
              Order #${order.orderNumber}
            </p>
          </div>

          <Card className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Order Details */}
              <div>
                <h2 className="font-display text-xl font-bold text-ember mb-4">Order Details</h2>
                <dl className="space-y-3">
                  <div>
                    <dt className="font-medium text-ink">Order Reference</dt>
                    <dd className="font-mono text-ember">
                      {order.orderNumber}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium text-ink">Branch</dt>
                    <dd>{branch.code}</dd>
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
                      {formatCurrency(order.subtotal, currency)}
                    </dd>
                  </div>
                </dl>
              </div>

              {/* Payment */}
              <div>
                <h2 className="font-display text-xl font-bold text-ember mb-4">Payment</h2>
                <dl className="space-y-3">
                  <div>
                    <dt className="font-medium text-ink">Payment Method</dt>
                    <dd>
                      {paymentMethod === "cash"
                        ? "Cash on arrival"
                        : paymentMethod === "mobile_money"
                          ? "Mobile Money"
                          : paymentMethod === "card"
                            ? "Card"
                            : "Bank transfer"}
                    </dd>
                  </div>
                  {order.total > 0 && (
                    <div>
                      <dt className="font-medium text-ink">Total</dt>
                      <dd className="font-medium tabular-nums">
                        {formatCurrency(order.total, currency)}
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
              </div>
            </div>

            {/* Items Summary */}
            <div className="mt-6 p-4 bg-ember/5 rounded-xl">
              <h3 className="font-display text-semibold text-ember mb-3">Order Summary</h3>
              <div className="space-y-2 text-sm">
                {order.items.map((item) => (
                  <div key={item.menuItemId} className="flex justify-between">
                    <span>{item.name} × {item.quantity}</span>
                    <span>{formatCurrency(item.totalPrice, currency)}</span>
                  </div>
                ))}
                <div className="pt-2 border-t border-line/50 flex justify-between">
                  <span>Total</span>
                  <span className="font-medium">{formatCurrency(order.total, currency)}</span>
                </div>
              </div>
            </div>
          </Card>

          {/* Order tracking */}
          <div className="mt-8 pt-8 border-t border-line/50">
            <p className="text-[12px] uppercase tracking-[0.15em] text-muted mb-4">
              Track your order
            </p>
            <p className="text-muted">
              Your order will progress through: <strong className="text-ember">Received → Confirmed → Preparing → Ready → Served</strong>
            </p>
            <ButtonLink
              href={`/track-order?orderReference=${order.orderNumber}&phone=${customerPhone || "guest"}`
            }
              variant="secondary"
            >
              Track Order Status
            </ButtonLink>
          </div>
        </main>
      </div>
    );
  }

  // Render the ordering form
  return (
    <div className="min-h-screen bg-gradient-to-b from-sand to-ember/5 min-h-screen">
      <nav className="border-b border-line/50 bg-white/90 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="font-display text-xl font-bold text-ember">Vista Kigali</span>
          </Link>
          <div className="hidden md:flex items-center gap-4">
            <Link href="/" className="text-[12px] font-semibold text-ink hover:text-ember transition">Home</Link>
            <Link href="/menu?branch=${branch.id}" className="text-[12px] font-semibold text-ink hover:text-ember transition">Menu</Link>
            <Link href="/reservations" className="text-[12px] font-semibold text-ink hover:text-ember transition">Reservations</Link>
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
              {branch.name || ""}
            </span>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tight mb-2">
            Order Online
          </h1>
          <p className="text-[16px] text-muted">
            Order from Vista Kigali for takeaway, dine-in, or delivery
          </p>
        </div>

        {/* Branch selector and search */}
        <Card className="mb-6 p-4">
          <form className="grid grid-cols-1 sm:grid-cols-[auto_1fr_auto] gap-3 sm:items-end" onSubmit={(e) => e.preventDefault()}>
            <div>
              <label className="field-label text-[11px] uppercase tracking-[0.1em] text-muted mb-1">
                Select branch
              </label>
              <select
                onChange={(e) => {
                  const selected = branches.find((b) => b.id === e.target.value);
                  if (selected) {
                    router.push(`?branch=${e.target.value}`);
                  }
                }}
                className="field-input rounded-lg border border-line px-3 py-2"
              >
                <option value="">All branches</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id} selected={branch.id === branchId}>
                    {branch.code}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="field-label text-[11px] uppercase tracking-[0.1em] text-muted mb-1">
                Search menu
              </label>
              <input
                type="text"
                placeholder="Dish, drink, or category"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="field-input flex-1 rounded-lg border border-line px-3 py-2"
              />
            </div>

            <div className="flex gap-2">
              <Select
                onValueChange={(value) => setSelectedCategory(value)}
                triggerClassName="rounded-lg border border-line"
                value={selectedCategory}
                className="relative"
              >
                <SelectTrigger>
                  <SelectValue className="pl-3 text-[12px] font-medium text-ink">
                    <span>Category</span>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                  <SelectItem value="">All categories</SelectItem>
                </SelectContent>
              </Select>

              <Button type="submit" className="flex-1">
                Filter
              </Button>
            </div>
          </form>
        </Card>

        {/* Menu Items Display */}
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-6 py-3 sm:px-8">
            <div>
              <h2 className="text-lg leading-tight">
                {items.length} item{items.length === 1 ? "" : "s"}
              </h2>
              <p className="text-[11px] text-muted">
                {branch.code} pricing
              </p>
            </div>
          </div>

          <div className="lg:block hidden">
            {/* Desktop: Table view */}
            <div className="overflow-x-auto">
              <table className="table w-full">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Category</th>
                    <th>Prep Time</th>
                    <th className="text-right">Price</th>
                    <th>Qty</th>
                    <th className="text-right">Subtotal</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className="border-b border-line/50 hover:bg-ember/5 transition">
                      <td>
                        <div className="flex items-center gap-3">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-line bg-sand/50">
                            {item.imagePath ? (
                              <img
                                src={item.imagePath}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <span className="text-[9px] uppercase tracking-wide text-muted">
                                {item.name.slice(0, 2)}
                              </span>
                            )}
                          </span>
                          <span className="min-w-0">
                            <span className="font-medium text-ink">{item.name}</span>
                            {item.isFeatured ? <Badge tone="ember">Featured</Badge> : null}
                          </span>
                        </div>
                      </td>
                      <td className="text-muted">{item.categoryName}</td>
                      <td className="text-muted">
                        {item.prepMinutes ? `${item.prepMinutes} min` : "—"}
                        <span className="block text-[10px]">
                          {STATION_LABELS[item.station] ?? item.station}
                        </span>
                      </td>
                      <td className="text-right font-medium tabular-nums">
                        {formatCurrency(item.price, currency)}
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <Button
                            onClick={() => removeFromCart(item.id)}
                            disabled={cart.some((ci) => ci.itemId === item.id) ? false : true}
                            className="h-8 w-8 rounded-lg border border-line px-2 text-[10px] font-semibold transition"
                          >
                            −
                          </Button>
                          <span className="min-w-0 flex-1 text-center">
                            {cart.some((ci) => ci.itemId === item.id) ? cart.find((ci) => ci.itemId === item.id)?.quantity : 0}
                          </span>
                          <Button
                            onClick={() => addToCart(item, 1)}
                            disabled={cart.some((ci) => ci.itemId === item.id)}
                            className="h-8 w-8 rounded-lg border-ember bg-ember/10 text-ember px-2 text-[10px] font-semibold transition"
                          >
                            +
                          </Button>
                        </div>
                      </td>
                      <td className="text-right font-medium tabular-nums">
                        {formatCurrency(item.price * (cart.find((ci) => ci.itemId === item.id)?.quantity || 0), currency)}
                      </td>
                      <td className="text-right">
                        <ButtonLink
                          variant="ghost"
                          size="sm"
                          onClick={() => addToCart(item, 1)}
                        >
                          Add
                        </ButtonLink>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile list view */}
          <ul className="divide-y divide-line/70 lg:hidden">
            {items.map((item) => (
              <li key={item.id} className="px-4 py-3">
                <div className="flex items-start gap-3">
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-line bg-sand/50">
                    {item.imagePath ? (
                      <img
                        src={item.imagePath}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-[9px] uppercase tracking-wide text-muted">
                        {item.name.slice(0, 2)}
                      </span>
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[13.5px] font-medium leading-snug text-ink">
                          {item.name}
                        </p>
                        <p className="text-[11px] text-muted">
                          {item.categoryName}
                          {item.prepMinutes ? ` · ${item.prepMinutes} min` : ""}
                        </p>
                      </div>
                      <div>
                        <span className="shrink-0 text-[13px] font-semibold tabular-nums">
                          {formatCurrency(item.price, currency)}
                        </span>
                        <Button
                          onClick={() => addToCart(item, 1)}
                          className="mt-1.5 rounded-lg border ember bg-ember/10 text-ember px-2 text-[10px] font-semibold"
                        >
                          Add
                        </Button>
                      </div>
                    </div>
                    {branch.code ? (
                      <div className="mt-2 flex items-center gap-1.5 border-t border-line/60 pt-2">
                        <span>{branch.code} · Available</span>
                      </div>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Card>

        {/* Cart Summary */}
        {cart.length > 0 && (
          <Card className="mt-6 p-4 bg-white/5 rounded-xl">
            <h3 className="font-display text-xl font-bold text-ember mb-4">Cart Summary</h3>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span>Items in cart</span>
                <span className="font-mono">{cartItemCount}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Subtotal</span>
                <span className="font-medium tabular-nums">
                  {formatCurrency(cartTotal, currency)}
                </span>
              </div>
              {cartTotal > 0 && (
                <div className="flex justify-between text-sm">
                  <span>Service charge (10%)</span>
                  <span className="text-ember/50">—</span>
                </div>
              )}
              {cartTotal > 0 && (
                <div className="flex justify-between text-sm">
                  <span>VAT (18%)</span>
                  <span className="text-ember/50">—</span>
                </div>
              )}
              <div className="pt-3 border-t border-line/50 flex justify-between font-medium">
                <span>Total</span>
                <span className="font-display text-2xl font-bold text-ember">
                  {formatCurrency(cartTotal * 1.28, currency)} {/* Approximate with taxes */}
                </span>
              </div>
              <Button
                onClick={() => setShowPayment(true)}
                className="w-full mt-4 rounded-lg border ember bg-ember/10 text-ember px-4 py-2 text-sm font-semibold"
              >
                Proceed to Payment
              </Button>
            </div>
          </Card>
        )}

        {/* Payment Form */}
        {showPayment && (
          <Card className="mt-6 p-6">
            <h2 className="font-display text-2xl font-bold text-ember mb-6">Payment</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="field-label text-[11px] uppercase tracking-[0.1em] text-muted mb-1">
                  Customer Name
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="John Doe"
                  className="field-input rounded-lg border border-line px-3 py-2"
                  required
                />
              </div>

              <div>
                <label className="field-label text-[11px] uppercase tracking-[0.1em] text-muted mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="+250 788 000 000"
                  className="field-input rounded-lg border border-line px-3 py-2"
                  required
                />
              </div>

              <div>
                <label className="field-label text-[11px] uppercase tracking-[0.1em] text-muted mb-1">
                  Payment Method
                </label>
                <Select
                  onValueChange={(value) => setPaymentMethod(value as PaymentMethod)}
                  triggerClassName="rounded-lg border border-line"
                  value={paymentMethod}
                  className="relative"
                >
                  <SelectTrigger>
                    <SelectValue className="pl-3 text-[12px] font-medium text-ink">
                      <span>Select method</span>
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash on arrival</SelectItem>
                    <SelectItem value="mobile_money">Mobile Money</SelectItem>
                    <SelectItem value="card">Card</SelectItem>
                    <SelectItem value="bank_transfer">Bank transfer</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button type="submit" className="w-full rounded-lg border ember bg-ember/10 text-ember px-4 py-2 text-sm font-semibold">
                Confirm Order
              </Button>
            </form>

            {orderSubmitted && order && (
              <div className="mt-6 p-4 bg-green/5 border-green/20 rounded-xl mt-4">
                <p className="font-display text-lg font-bold text-green mb-1">
                  Order confirmed!
                </p>
                <p className="text-muted">
                  Order reference: <span className="font-mono text-ember">
                    {order.orderNumber}
                  </span>
                </p>
                <p className="text-muted mt-2">
                  Your order has been sent to the kitchen. You can track it using the reference above.
                </p>
                <ButtonLink href="/" variant="primary">
                  Back Home
                </ButtonLink>
              </div>
            )}
          </Card>
        )}
      </main>
    </div>
  );
}

// Types
type CartItem = {
  itemId: string;
  itemName: string;
  quantity: number;
  price: number;
};

type MenuItemRow = {
  id: string;
  categoryId: string;
  categoryName: string | null;
  name: string;
  description: string | null;
  price: number;
  station: string;
  imagePath: string | null;
  prepMinutes: number | null;
  isFeatured: boolean;
  isActive: boolean;
};

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

type PaymentMethod = "cash" | "mobile_money" | "card" | "bank_transfer";

const STATION_LABELS: Record<string, string> = {
  kitchen: "Kitchen",
  bar: "Bar",
  pastry: "Pastry",
};