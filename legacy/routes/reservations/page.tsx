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
import { listAccommodationReservations, createReservation, updateReservationStatus } from "@/services/accommodation";
import { getBranchIdFromUrl } from "@/lib/branches";

interface ReservationFormValues {
  branchId: string;
  roomTypeId: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  checkInDate: string;
  checkOutDate: string;
  guestCount?: number;
  specialRequests?: string;
  roomId?: string;
}

const reservationSchema = z.object({
  branchId: z.string().nonempty("Branch is required"),
  roomTypeId: z.string().nonempty("Room type is required"),
  customerName: z.string().nonempty("Customer name is required"),
  customerPhone: z.string().nonempty("Customer phone is required"),
  customerEmail: z.string().optional(),
  checkInDate: z.string().nonempty("Check-in date is required"),
  checkOutDate: z.string().nonempty("Check-out date is required"),
  guestCount: z.number().min(1, "Guest count must be at least 1").default(2),
  specialRequests: z.string().optional(),
});

type ReservationForm = z.infer<typeof reservationSchema>;

export default function ReservationsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();
  const [branchId, setBranchId] = useState(getBranchIdFromUrl(searchParams) || "kimironko");
  const [reservations, setReservations] = useState<any[]>([]);
  const [roomTypes, setRoomTypes] = useState<any[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingReservation, setEditingReservation] = useState<any | null>(null);

  // Fetch branch ID from URL if changed
  useEffect(() => {
    const paramsBranch = getBranchIdFromUrl(searchParams);
    if (paramsBranch && paramsBranch !== branchId) {
      setBranchId(paramsBranch);
    }
  }, [searchParams, branchId]);

  useEffect(() => {
    loadData();
  }, [branchId]);

  const getBranchIdFromUrl = (params: URLSearchParams): string => {
    const branch = params.get("branch");
    if (branch === "kimironko" || branch === "kim") return "kimironko";
    if (branch === "rond-point" || branch === "rdp") return "rond-point";
    return "kimironko";
  };

  const loadData = async () => {
    try {
      // Load reservations
      const reservationsRes = await fetch(
        `/api/accommodation/reservations?branchId=${branchId}`
      );
      const reservationsData = await reservationsRes.json();
      setReservations(reservationsData.data ?? []);

      // Load room types
      const typesRes = await fetch(`/api/accommodation/room-types?includeInactive=false`);
      const typesData = await typesRes.json();
      setRoomTypes(typesData.data ?? []);
    } catch (error) {
      console.error("Error loading reservation data:", error);
      toast({
        title: "Error",
        description: "Failed to load reservation data",
        variant: "destructive",
      });
    }
  };

  const onSubmit = async (data: ReservationForm) => {
    setIsCreating(true);

    const result = await createReservation(
      { id: "", name: "", email: "", role: "", branchId, permissions: [] } as any,
      {
        branchId: data.branchId,
        roomTypeId: data.roomTypeId,
        customerName: data.customerName,
        customerPhone: data.customerPhone,
        customerEmail: data.customerEmail,
        checkInDate: data.checkInDate,
        checkOutDate: data.checkOutDate,
        guestCount: data.guestCount,
        specialRequests: data.specialRequests,
      },
      { requestId: crypto.randomUUID(), origin: window.location.origin, userId: "" }
    );

    if (!result.ok) {
      toast({ title: "Error", description: result.error, variant: "destructive" });
      setIsCreating(false);
      return;
    }

    toast({ title: "Success", description: "Reservation created successfully" });
    setIsCreating(false);
    loadData();
    setIsEditing(false);
  };

  const handleEdit = (reservation: any) => {
    setEditingReservation(reservation);
    setIsEditing(true);
  };

  const handleDelete = async (reservationId: string) => {
    const confirmed = window.confirm("Are you sure you want to cancel this reservation?");
    if (!confirmed) return;

    const result = await updateReservationStatus(
      { id: "", name: "", email: "", role: "", branchId: branchId, permissions: [] } as any,
      reservationId,
      "cancelled",
      { requestId: crypto.randomUUID(), origin: window.location.origin, userId: "" }
    );

    if (!result.ok) {
      toast({ title: "Error", description: result.error, variant: "destructive" });
      return;
    }

    toast({ title: "Success", description: "Reservation cancelled successfully" });
    loadData();
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

      {/* Create Reservation Form */}
      <Card>
        <CardHeader>
          <CardTitle>Create New Reservation</CardTitle>
        </CardHeader>
        <CardContent>
          {isCreating ? (
            <p>Creating reservation...</p>
          ) : (
            <form
              onSubmit={async (e: React.FormEvent) => {
                e.preventDefault();
                const formData = new FormData(e.target as HTMLFormElement);
                const data: ReservationForm = {
                  branchId,
                  roomTypeId: formData.get("roomTypeId") as string,
                  customerName: formData.get("customerName") as string,
                  customerPhone: formData.get("customerPhone") as string,
                  customerEmail: formData.get("customerEmail") as string,
                  checkInDate: formData.get("checkInDate") as string,
                  checkOutDate: formData.get("checkOutDate") as string,
                  guestCount: formData.get("guestCount") ? Number(formData.get("guestCount")) : 2,
                  specialRequests: formData.get("specialRequests") as string,
                };

                // Validate
                const validated = reservationSchema.safeParse(data);
                if (!validated.success) {
                  toast({
                    title: "Validation Error",
                    description: validated.error.issues.map((i) => i.message).join(", "),
                    variant: "destructive",
                  });
                  return;
                }

                await onSubmit(validated.data);
              }}
            >
              <div className="grid grid-cols-2 gap-3 mb-3">
                <Input
                  placeholder="Branch"
                  defaultValue={branchId}
                  disabled
                />
                <Input
                  placeholder="Room type"
                  name="roomTypeId"
                />
                <Select onValueChange={(val: string) => {
                  // Handle room type change
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select room type" />
                  </SelectTrigger>
                  <SelectContent>
                    {roomTypes.map((rt) => (
                      <SelectItem key={rt.id} value={rt.id}>
                        {rt.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-3">
                <Input
                  placeholder="Customer name"
                  name="customerName"
                  required
                />
                <Input
                  placeholder="Customer phone"
                  name="customerPhone"
                  required
                />
                <Input
                  placeholder="Customer email"
                  name="customerEmail"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 mb-3">
                <Input
                  type="date"
                  name="checkInDate"
                  required
                />
                <Input
                  type="date"
                  name="checkOutDate"
                  required
                />
                <Input
                  type="number"
                  name="guestCount"
                  placeholder="Guest count"
                  defaultValue={2}
                />
              </div>

              <Input
                placeholder="Special requests (optional)"
                name="specialRequests"
              />

              <div className="mt-4 flex gap-2">
                <Button type="submit" disabled={isCreating}>
                  Create Reservation
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={isCreating}
                  onClick={() => setIsEditing(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      {/* Existing Reservations List */}
      <Card>
        <CardHeader>
          <CardTitle>Reservations ({reservations.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {reservations.length === 0 ? (
            <p className="text-muted-verse">No reservations found.</p>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {reservations.map((res) => (
                <div key={res.id} className="p-3 rounded border flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start text-sm">
                      <span className="font-medium">{res.customerName}</span>
                      <span className="text-xs text-muted-verse">
                        {res.status} · {res.checkInDate}
                      </span>
                    </div>
                    <p className="text-xs text-muted-verse">
                      {res.guestCount} guests · {res.roomTypeId || "Any room"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {res.status === "pending" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(reservation)}
                        title="Edit"
                      >
                        Edit
                      </Button>
                    )}
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(res.id)}
                      title="Cancel"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}