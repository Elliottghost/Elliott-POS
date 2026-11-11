"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/format";

import { openShift, closeShift, getOpenShifts, getShiftSummary } from "@/services/cashierShifts";

export default function CashierShiftsPage() {
  const router = useRouter();
  const [shifts, setShifts] = useState([]);
  const [openShiftModal, setOpenShiftModal] = useState({ open: false, balance: 0 });
  const [closeShiftModal, setCloseShiftModal] = useState({ open: false, shiftId: "" });
  const [currentShift, setCurrentShift] = useState(null);
  const [user, setUser] = useState({ id: "cashier-1", fullName: "Cashier" });

  useEffect(() => {
    setUser({ id: "cashier-1", fullName: "Cashier" });
    loadOpenShifts();
  }, []);

  const loadOpenShifts = async () => {
    try {
      const shiftsData = await getOpenShifts();
      setShifts(shiftsData);
    } catch (error) {
      console.error("Failed to load open shifts:", error);
    }
  };

  const handleOpenShift = async () => {
    try {
      const shift = await openShift({ openingBalance: 0 }, user);
      setOpenShiftModal({ open: false });
      loadOpenShifts();
      setCurrentShift({
        shiftId: shift.id,
        openingBalance: shift.openingBalance,
        closingBalance: shift.closingBalance || 0,
        expectedBalance: shift.openingBalance,
        actualBalance: shift.closingBalance || 0,
        discrepancy: shift.openingBalance - (shift.closingBalance || 0),
        totalSales: 0,
        totalRefunds: 0,
        netBalance: shift.closingBalance || 0 - shift.openingBalance,
        status: "open",
        openTime: shift.openingTime,
        closeTime: null,
      });
    } catch (error: any) {
      alert(error || "Failed to open shift");
    }
  };

  const handleCloseShift = async () => {
    try {
      const result = await closeShift(
        currentShift?.shiftId || "",
        { closingBalance: currentShift?.closingBalance || 0, refunds: 0, cashMovements: 0 },
        user
      );
      setCloseShiftModal({ open: false });
      loadOpenShifts();
      setCurrentShift(null);
    } catch (error: any) {
      alert(error || "Failed to close shift");
    }
  };

  return (
    <Card className="p-4">
      <h3 className="font-semibold text-ink mb-3">Cashier Shifts</h3>
      <div className="mb-4">
        <Button variant="ember" onClick={() => setOpenShiftModal({ open: true })}>Open Shift</Button>
        <Button variant="secondary" onClick={() => setCloseShiftModal({ open: true })}>Close Shift</Button>
      </div>
      {shifts.length > 0 && (
        <Card className="p-4 mb-4">
          <h4 className="font-semibold text-ink mb-3">Open Shifts</h4>
          {shifts.map((shift) => (
            <div key={shift.id} className="p-3 border rounded mb-2">
              <div className="flex justify-between items-start">
                <span className="text-[11px] text-ink">Shift by {shift.openingBalance} balance</span>
                <span className="text-[10px] text-muted">opened {new Date(shift.openingTime).toLocaleTimeString()}</span>
              </div>
              <div className="mt-1"><Button variant="link">View Summary</Button></div>
            </div>
          ))}
        </Card>
      )}
      {currentShift && (
        <Card className="p-4">
          <h4 className="font-semibold text-ink mb-3">Shift Summary: {currentShift.shiftId}</h4>
          <div className="space-y-3">
            <div><span className="text-[11px] text-ink">Opening Balance</span><span className="text-[12px] font-medium text-ember-strong">{formatCurrency(currentShift.openingBalance, "RWF")}</span></div>
            <div><span className="text-[11px] text-ink">Closing Balance</span><span className="text-[12px] font-medium text-ember-strong">{formatCurrency(currentShift.closingBalance, "RWF")}</span></div>
            <div><span className="text-[11px] text-ink">Expected Balance</span><span className="text-[12px] font-medium text-ember-strong">{formatCurrency(currentShift.expectedBalance, "RWF")}</span></div>
            <div><span className="text-[11px] text-ink">Actual Balance</span><span className="text-[12px] font-medium text-ember-strong">{formatCurrency(currentShift.actualBalance, "RWF")}</span></div>
            <div><span className="text-[11px] text-ink">Discrepancy</span><span className={currentShift.discrepancy > 0 ? "text-ember-soft" : "text-ember-strong"}>{formatCurrency(currentShift.discrepancy, "RWF")}</span></div>
            <div><span className="text-[11px] text-ink">Total Sales</span><span className="text-[12px] font-medium text-ember-strong">{formatCurrency(currentShift.totalSales, "RWF")}</span></div>
            <div><span className="text-[11px] text-ink">Net Balance</span><span className="text-[12px] font-medium text-ember-strong">{formatCurrency(currentShift.netBalance, "RWF")}</span></div>
          </div>
          <div className="mt-4 pt-3 border-t border-line/70"><Button variant="secondary" onClick={() => setCurrentShift(null)}>Close</Button></div>
        </Card>
      )}
      {openShiftModal.open && (
        <Card className="p-4"><h4 className="font-semibold text-ink mb-3">Open Cashier Shift</h4><p className="text-[11px] text-muted mb-3">Enter opening cash balance</p><Input placeholder="Opening balance (RWF)" value={openShiftModal.balance} onChange={(e) => setOpenShiftModal({ ...openShiftModal, balance: Number(e.target.value) || 0 })} type="number" /><div className="mt-4"><Button variant="secondary" onClick={() => setOpenShiftModal({ open: false })}>Cancel</Button><Button variant="ember" onClick={handleOpenShift}>Open Shift</Button></div></Card>
      )}
      {closeShiftModal.open && currentShift && (
        <Card className="p-4"><h4 className="font-semibold text-ink mb-3">Close Cashier Shift</h4><p className="text-[11px] text-muted mb-3">Enter closing cash balance</p><Input placeholder="Closing balance (RWF)" value={closeShiftModal ? "0" : ""} onChange={(e) => setCloseShiftModal({ ...closeShiftModal, balance: Number(e.target.value) || 0 })} type="number" /><div className="mt-4"><Button variant="secondary" onClick={() => setCloseShiftModal({ open: false })}>Cancel</Button><Button variant="ember" onClick={handleCloseShift}>Close Shift</Button></div></Card>
      )}
    </Card>
  );
}
