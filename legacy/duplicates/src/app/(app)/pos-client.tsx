"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";
import { ORDER_CHANNEL_LABELS, ORDER_CHANNELS } from "@/lib/validation";
import { useRouter } from "next/navigation";
import { createOrder } from "@/services/orders";
import { getPosMenu } from "@/services/menu";

export default function PosForm() {
  const router = useRouter();
  const [channel, setChannel] = useState("dine_in");
  const [branchId, setBranchId] = useState("") as any;
  const [items, setItems] = useState([] as any);
  const [discountPercent, setDiscountPercent] = useState(0);

  useEffect(() => {
    getPosMenu("448fc226-abd6-4e13-9518-0cac41d4fed3").then((menu: any) => {
      const itemsList: any[] = [];
      if (menu && menu.length > 0) {
        for (const group of menu) {
          if (group && group.items) {
            for (const item of group.items) {
              itemsList.push({ id: item.id, name: item.name, price: item.price });
            }
          }
        }
      }
      setItems(itemsList);
    });
  }, []);

  const handleAdd = (item: any) => {
    const existing = items.find((x: any) => x.id === item.id);
    if (existing) return;
    setItems((prev: any) => [...prev, { ...item, quantity: 1, lineTotal: item.price } as any]);
  };

  const handleIncrease = (menuItemId: string) => {
    const existing = items.find((item: any) => item.menuItemId === menuItemId);
    if (!existing) return;
    if (existing.quantity >= 99) return;
    setItems(prev => prev.map(item => item.menuItemId === menuItemId ? { ...item, quantity: item.quantity + 1, lineTotal: item.unitPrice * (item.quantity + 1) } as any : item));
  };

  const handleDecrease = (menuItemId: string) => {
    const existing = items.find((item: any) => item.menuItemId === menuItemId);
    if (!existing) return;
    if (existing.quantity <= 1) {
      setItems(prev => prev.filter(item => item.menuItemId !== menuItemId) as any);
    } else {
      setItems(prev => prev.map(item => item.menuItemId === menuItemId ? { ...item, quantity: item.quantity - 1, lineTotal: item.unitPrice * (item.quantity - 1) } as any : item));
    }
  };

  const handleRemove = (menuItemId: string) => {
    setItems(prev => prev.filter(item => item.menuItemId !== menuItemId) as any);
  };

  const handleDiscountChange = (value: string) => {
    const percent = Number(value);
    if (isNaN(percent) || percent < 0 || percent > 100) {
      setDiscountPercent(0);
    } else {
      setDiscountPercent(percent);
    }
  };

  const subtotal = items.reduce((sum: number, item: any) => sum + item.quantity * item.unitPrice, 0);
  const serviceCharge = Math.round((subtotal * 10) / 100);
  const taxableAmount = subtotal + serviceCharge;
  const tax = Math.round((taxableAmount * 18) / 100);
  const discountAmount = Math.round(subtotal * discountPercent / 100);
  const discountedSubtotal = subtotal - discountAmount;
  const grandTotal = discountedSubtotal + serviceCharge + tax;

  const handleOpen = async () => {
    if (items.length === 0) return;
    const inputItems = items.map((item: any) => ({
      menuItemId: item.menuItemId,
      quantity: item.quantity,
    }));
    const input = {
      branchId: branchId,
      channel,
      customerName: "",
      tableLabel: channel === "dine_in" ? "" : undefined,
      guestCount: channel === "dine_in" ? 2 : undefined,
      notes: "",
      items: inputItems,
    };
    const result = await createOrder(undefined as any, input as any);
    if (result && (result as any).ok) {
      router.push("/orders/" + (result as any).id);
    } else {
      alert((result as any).error || "Failed to create order");
    }
  };

  return (
    <>
      <Card className="p-4">
        <div className="mb-4">
          <select onChange={(e) => setBranchId((e.target: any).value)} className="w-full p-2">
            <option value="">-- Select --</option>
            <option value="448fc226-abd6-4e13-9518-0cac41d4fed3">KIM</option>
            <option value="1956bb00-5a54-49cc-b732-136ef0eadf62">RDP</option>
          </select>
        </div>
        <div className="mb-4">
          {ORDER_CHANNELS.map((ch: string) => (
            <label key={ch} className="flex items-center gap-2">
              <input
                type="radio"
                name="channel"
                value={ch}
                checked={channel === ch}
                onChange={() => setChannel(ch)}
                className="h-4 w-4"
              />
              <span>{ORDER_CHANNEL_LABELS[ch as keyof typeof ORDER_CHANNEL_LABELS]} as any}</span>
            </label>
          ))}
        </div>
        {channel === "dine_in" && (
          <div className="mb-4">
            <label className="font-semibold text-ink mb-3">Table</label>
            <select onChange={(e) => {}} className="w-full p-2 border rounded">
              <option value="">-- Table --</option>
            </select>
          </div>
        )}
        {channel && items.length > 0 && (
          <Card className="p-4 mb-4">
            <h4 className="font-semibold text-ink mb-3">Menu</h4>
            <p className="text-[11px] text-muted mb-3">Available items</p>
            <div className="grid grid-cols-2 gap-3">
              {items.map((item: any, idx: number) => (
                <Card
                  key={item.id}
                  className={item.isAvailable ? "" : "opacity-50 cursor-not-allowed"}
                  onClick={() => handleAdd(item)}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-[11px] text-ember-strong">{item.name}</span>
                  </div>
                  <div className="mt-1 flex justify-between">
                    <span className="text-[12px] font-semibold text-ember-strong">
                      {formatCurrency(item.price, "RWF")}
                    </span>
                  </div>
                </Card>
              ))}
            </div>
          </Card>
        )}

        {items.length > 0 && (
          <Card className="p-4 mb-4">
            <h4 className="font-semibold text-ink mb-3">Order Summary</h4>
            <div className="space-y-2">
              {items.map((item: any, idx: number) => (
                <div key={item.menuItemId} className="flex items-center justify-between">
                  <span className="text-[11px] text-ink">
                    {item.name} x {item.quantity}
                  </span>
                  <span className="text-right text-[11px] tabular-nums text-ember-strong">
                    {formatCurrency(item.lineTotal, "RWF")}
                  </span>
                </div>
              ))}
              <div className="pt-2 border-t border-line/70"></div>
              <div className="flex justify-between text-muted text-[11px]">
                <span>Subtotal</span>
                <span>{formatCurrency(subtotal, "RWF")}</span>
              </div>
              {discountPercent > 0 && (
                <div className="flex justify-between text-muted text-[11px]">
                  <span>Discount — {discountPercent}%</span>
                  <span>{formatCurrency(-discountAmount, "RWF")}</span>
                </div>
              )}
              <div className="flex justify-between text-ink font-medium text-[12px]">
                <span>Service charge (10%)</span>
                <span>{formatCurrency(serviceCharge, "RWF")}</span>
              </div>
              <div className="flex justify-between text-ink font-medium text-[12px]">
                <span>VAT (18%)</span>
                <span>{formatCurrency(tax, "RWF")}</span>
              </div>
              <div className="flex justify-between text-ink font-bold text-[14px]">
                <span>Total</span>
                <span>{formatCurrency(grandTotal, "RWF")}</span>
              </div>
            </div>
          </Card>
        )}

        {!items.length > 0 && (
          <Card className="p-4 text-center">
            <p className="text-muted mb-2">No items added yet</p>
            <p className="text-[11px]">Select menu items to build an order</p>
          </Card>
        )}

        <div className="mt-6 flex gap-3">
          <Button variant="secondary" onClick={() => {}} disabled={items.length === 0}>Cancel Order</Button>
          <Button variant="ember" onClick={handleOpen} disabled={items.length === 0}>Open Order</Button>
        </div>
      </Card>
    </>
  );
}
