import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { getGuestFolio, updateGuestFolio, recordRoomTransaction } from "@/services/accommodation";
import { getBranchIdFromUrl } from "@/lib/branches";

interface CheckOutFormValues {
  reservationId: string;
  totalPaid: number;
  paymentMethod: string;
  notes?: string;
}

const checkOutSchema = z.object({
  reservationId: z.string().nonempty("Reservation is required"),
  totalPaid: z.number().min(0, "Total paid must be at least 0"),
  paymentMethod: z.enum(["cash", "mobile_money", "card", "bank_transfer"]),
  notes: z.string().optional(),
});

type CheckOutForm = z.infer<typeof checkOutSchema>;

export default function CheckOutPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();
  const [branchId, setBranchId] = useState(getBranchIdFromUrl(searchParams) || "kimironko");
  const [reservations, setReservations] = useState<any[]>([]);
  const [selectedReservation, setSelectedReservation] = useState<any | null>(null);
  const [folio, setFolio] = useState<any>(null);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [formData, setFormData] = useState<CheckOutForm>({
    reservationId: "",
    totalPaid: 0,
    paymentMethod: "cash",
    notes: "",
  });

  // Fetch branch ID from URL if changed
  useEffect(() => {
    const paramsBranch = getBranchIdFromUrl(searchParams);
    if (paramsBranch && paramsBranch !== branchId) {
      setBranchId(paramsBranch);
      setSelectedReservation(null);
      setFolio(null);
      setFormData({
        reservationId: "",
        totalPaid: 0,
        paymentMethod: "cash",
        notes: "",
      });
    }
  }, [searchParams, branchId]);

  useEffect(() => {
    loadReservations();
  }, [branchId]);

  const getBranchIdFromUrl = (params: URLSearchParams): string => {
    const branch = params.get("branch");
    if (branch === "kimironko" || branch === "kim") return "kimironko";
    if (branch === "rond-point" || branch === "rdp") return "rond-point";
    return "kimironko";
  };

  const loadReservations = async () => {
    try {
      const reservationsRes = await fetch(
        `/api/accommodation/reservations?branchId=${branchId}&status=checked_in`
      );
      const reservationsData = await reservationsRes.json();
      setReservations(reservationsData.data ?? []);
    } catch (error) {
      console.error("Error loading checked-in reservations:", error);
      toast({
        title: "Error",
        description: "Failed to load reservations",
        variant: "destructive",
      });
    }
  };

  const loadFolio = async (reservationId: string) => {
    try {
      const folioData = await getGuestFolio(reservationId);
      setFolio(folioData);
      setFormData({
        reservationId,
        totalPaid: folioData?.outstandingBalance ?? 0,
        paymentMethod: "cash",
        notes: "",
      });
    } catch (error) {
      console.error("Error loading folio:", error);
      toast({
        title: "Error",
        description: "Failed to load guest folio",
        variant: "destructive",
      });
    }
  };

  const handleCheckOut = async (data: CheckOutForm) => {
    setIsCheckingOut(true);

    // First update reservation status to checked_out
    const statusResult = await updateReservationStatus(
      { id: "", name: "", email: "", role: "", branchId, permissions: [] } as any,
      data.reservationId,
      "checked_out",
      { requestId: crypto.randomUUID(), origin: window.location.origin, userId: "" }
    );

    if (!statusResult.ok) {
      toast({ title: "Error", description: statusResult.error, variant: "destructive" });
      setIsCheckingOut(false);
      return;
    }

    // Record the check-out transaction (negative amount for payout)
    const transactionResult = await recordRoomTransaction(
      { id: "", name: "", email: "", role: "", branchId, permissions: [] } as any,
      {
        reservationId: data.reservationId,
        roomId: selectedReservation?.roomId ?? "",
        branchId,
        transactionType: "check_out",
        amount: -(formData.totalPaid - (folio?.roomCharges ?? 0)), // Calculate difference
        description: "Guest checked out",
      },
      { requestId: crypto.randomUUID(), origin: window.location.origin, userId: "" }
    );

    if (!transactionResult.ok) {
      toast({ title: "Error", description: transactionResult.error, variant: "destructive" });
      setIsCheckingOut(false);
      return;
    }

    // Update folio to mark as settled
    await updateGuestFolio(data.reservationId, {
      totalPaid: formData.totalPaid,
    });

    toast({ title: "Success", description: "Guest checked out successfully" });
    setIsCheckingOut(false);
    setSelectedReservation(null);
    setFolio(null);
    setFormData({
      reservationId: "",
      totalPaid: 0,
      paymentMethod: "cash",
      notes: "",
    });
    loadReservations();
    router.push("/accommodation-dashboard");
  };

  return (
    <div className="space-y-6">
      {/* Branch Selector */}
      <Card>
        <CardHeader>
          <CardTitle>Branch Selection</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-4">
          <Select onValueChange={(val: string) => {
            setBranchId(val);
            setSelectedReservation(null);
            setFolio(null);
            setFormData({
              reservationId: "",
              totalPaid: 0,
              paymentMethod: "cash",
              notes: "",
            });
            router.push(`?branch=${val === "kimironko" ? "kim" : "rdp"}`);
          }}>
            <SelectTrigger>
              <SelectValue placeholder="Select branch" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="kimironko">Kimironko (KIM)</SelectItem>
              <SelectItem value="rond-point">Rond-Point (RDP)</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Select Reservation */}
      <Card>
        <CardHeader>
          <CardTitle>Select Reservation for Check-Out</CardTitle>
        </CardHeader>
        <CardContent>
          {reservations.length === 0 ? (
            <p className="text-muted-verse">No checked-in reservations found for this branch.</p>
          ) : (
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {reservations.map((res) => (
                <div key={res.id} className="p-3 rounded border flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start text-sm">
                      <span className="font-medium">{res.customerName}</span>
                      <span className="text-xs text-muted-verse">
                        Check-in: {res.checkInDate} · Status: {res.status}
                      </span>
                    </div>
                    <p className="text-xs text-muted-verse">
                      {res.guestCount} guests · Room: {res.roomTypeId || "Any"}
                    </p>
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      setSelectedReservation(res);
                      loadFolio(res.id);
                    }}
                    disabled={isCheckingOut}
                  >
                    Check Out
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Folio Display (shown after reservation selection) */}
      {selectedReservation && folio && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-lg p-6">
            <CardHeader>
              <CardTitle>Check-Out: {selectedReservation.customerName}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-verse mb-2">
                Check-in: {selectedReservation.checkInDate}
              </p>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-muted-verse mb-1">Outstanding Balance</p>
                  <p className="text-2xl font-bold text-red-600">
                    {folio.outstandingBalance?.toLocaleString()} RWF
                  </p>
                </div>
                <div>
                  <p className="text-muted-verse mb-1">Total Paid</p>
                  <p className="text-2xl font-bold">
                    {folio.totalPaid?.toLocaleString()} RWF
                  </p>
                </div>
              </div>

              <form
                onSubmit={async (e: React.FormEvent) => {
                  e.preventDefault();
                  const formData = new FormData(e.target as HTMLFormElement);
                  const data: CheckOutForm = {
                    reservationId: formData.get("reservationId") as string,
                    totalPaid: formData.get("totalPaid") ? Number(formData.get("totalPaid")) : folio.outstandingBalance ?? 0,
                    paymentMethod: formData.get("paymentMethod") as string,
                    notes: formData.get("notes") as string,
                  };

                  const validated = checkOutSchema.safeParse(data);
                  if (!validated.success) {
                    toast({
                      title: "Validation Error",
                      description: validated.error.issues.map((i) => i.message).join(", "),
                      variant: "destructive",
                    });
                    return;
                  }

                  await handleCheckOut(validated.data);
                }}
              >
                <Input
                  type="hidden"
                  name="reservationId"
                  defaultValue={folio.reservationId || selectedReservation.id}
                />
                <Input
                  type="number"
                  name="totalPaid"
                  placeholder="Total paid (RWF)"
                  defaultValue={folio.outstandingBalance?.toString() || "0"}
                  min={folio.outstandingBalance ?? 0}
                  required
                />
                <Select
                  name="paymentMethod"
                  defaultValue="cash"
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="mobile_money">Mobile Money</SelectItem>
                    <SelectItem value="card">Card</SelectItem>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  </SelectContent>
                </Select>

                <Input
                  placeholder="Notes (optional)"
                  name="notes"
                />

                <div className="mt-4 flex gap-2">
                  <Button type="submit" disabled={isCheckingOut}>
                    Complete Check-Out
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isCheckingOut}
                    onClick={() => setSelectedReservation(null)}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {!folio && selectedReservation && (
        <Card>
          <CardHeader>
            <CardTitle>Guest Folio</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-verse">
              No folio found for this reservation. The outstanding balance will be calculated at check-out.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}