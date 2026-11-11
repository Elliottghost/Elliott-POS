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
import { listAccommodationReservations, updateReservationStatus, recordRoomTransaction } from "@/services/accommodation";
import { getBranchIdFromUrl } from "@/lib/branches";

interface CheckInFormValues {
  reservationId: string;
  specialRequests?: string;
}

const checkInSchema = z.object({
  reservationId: z.string().nonempty("Reservation is required"),
  specialRequests: z.string().optional(),
});

type CheckInForm = z.infer<typeof checkInSchema>;

export default function CheckInPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();
  const [branchId, setBranchId] = useState(getBranchIdFromUrl(searchParams) || "kimironko");
  const [reservations, setReservations] = useState<any[]>([]);
  const [selectedReservation, setSelectedReservation] = useState<any | null>(null);
  const [isCheckingIn, setIsCheckingIn] = useState(false);

  // Fetch branch ID from URL if changed
  useEffect(() => {
    const paramsBranch = getBranchIdFromUrl(searchParams);
    if (paramsBranch && paramsBranch !== branchId) {
      setBranchId(paramsBranch);
      setSelectedReservation(null);
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
        `/api/accommodation/reservations?branchId=${branchId}&status=pending`
      );
      const reservationsData = await reservationsRes.json();
      setReservations(reservationsData.data ?? []);
    } catch (error) {
      console.error("Error loading reservations:", error);
      toast({
        title: "Error",
        description: "Failed to load reservations",
        variant: "destructive",
      });
    }
  };

  const handleCheckIn = async (data: CheckInForm) => {
    setIsCheckingIn(true);

    // First update reservation status to checked_in
    const statusResult = await updateReservationStatus(
      { id: "", name: "", email: "", role: "", branchId, permissions: [] } as any,
      data.reservationId,
      "checked_in",
      { requestId: crypto.randomUUID(), origin: window.location.origin, userId: "" }
    );

    if (!statusResult.ok) {
      toast({ title: "Error", description: statusResult.error, variant: "destructive" });
      setIsCheckingIn(false);
      return;
    }

    // Record the check-in transaction
    const transactionResult = await recordRoomTransaction(
      { id: "", name: "", email: "", role: "", branchId, permissions: [] } as any,
      {
        reservationId: data.reservationId,
        roomId: selectedReservation?.roomId ?? "",
        branchId,
        transactionType: "check_in",
        amount: selectedReservation?.depositPaid ?? 0,
        description: "Guest checked in",
      },
      { requestId: crypto.randomUUID(), origin: window.location.origin, userId: "" }
    );

    if (!transactionResult.ok) {
      toast({ title: "Error", description: transactionResult.error, variant: "destructive" });
      setIsCheckingIn(false);
      return;
    }

    toast({ title: "Success", description: "Guest checked in successfully" });
    setIsCheckingIn(false);
    setSelectedReservation(null);
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
          <CardTitle>Select Reservation for Check-In</CardTitle>
        </CardHeader>
        <CardContent>
          {reservations.length === 0 ? (
            <p className="text-muted-verse">No pending reservations found for this branch.</p>
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
                      {res.guestCount} guests · Room: {res.roomTypeId || "Any"} · Deposit: {res.depositPaid?.toLocaleString()} RWF
                    </p>
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setSelectedReservation(res)}
                    disabled={isCheckingIn}
                  >
                    Check In
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Check-in Form (shown after reservation selection) */}
      {selectedReservation && !isCheckingIn && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-lg p-6">
            <CardHeader>
              <CardTitle>Check-In: {selectedReservation.customerName}</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={async (e: React.FormEvent) => {
                  e.preventDefault();
                  const formData = new FormData(e.target as HTMLFormElement);
                  const data: CheckInForm = {
                    reservationId: selectedReservation.id,
                    specialRequests: formData.get("specialRequests") as string,
                  };

                  const validated = checkInSchema.safeParse(data);
                  if (!validated.success) {
                    toast({
                      title: "Validation Error",
                      description: validated.error.issues.map((i) => i.message).join(", "),
                      variant: "destructive",
                    });
                    return;
                  }

                  await handleCheckIn(validated.data);
                }}
              >
                <Input
                  type="text"
                  name="specialRequests"
                  placeholder="Special requests (optional)"
                />
                <div className="mt-4 flex gap-2">
                  <Button type="submit" disabled={isCheckingIn}>
                    Check In Guest
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isCheckingIn}
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
    </div>
  );
}