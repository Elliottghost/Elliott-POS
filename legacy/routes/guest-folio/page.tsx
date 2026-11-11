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
import { getGuestFolio, updateGuestFolio } from "@/services/accommodation";
import { getBranchIdFromUrl } from "@/lib/branches";

interface FolioFormValues {
  reservationId: string;
  roomCharges?: number;
  foodBeverageCharges?: number;
  roomServiceCharges?: number;
  otherCharges?: number;
  totalPaid?: number;
}

const folioFormSchema = z.object({
  reservationId: z.string().nonempty("Reservation is required"),
  roomCharges: z.number().min(0, "Room charges must be at least 0").optional(),
  foodBeverageCharges: z.number().min(0, "Food & beverage charges must be at least 0").optional(),
  roomServiceCharges: z.number().min(0, "Room service charges must be at least 0").optional(),
  otherCharges: z.number().min(0, "Other charges must be at least 0").optional(),
  totalPaid: z.number().min(0, "Total paid must be at least 0").optional(),
});

type FolioForm = z.infer<typeof folioFormSchema>;

export default function GuestFolioPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();
  const [branchId, setBranchId] = useState(getBranchIdFromUrl(searchParams) || "kimironko");
  const [reservationId, setReservationId] = useState<string | null>(null);
  const [folio, setFolio] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<FolioForm>({
    reservationId: "",
    roomCharges: 0,
    foodBeverageCharges: 0,
    roomServiceCharges: 0,
    otherCharges: 0,
    totalPaid: 0,
  });

  // Fetch branch ID from URL if changed
  useEffect(() => {
    const paramsBranch = getBranchIdFromUrl(searchParams);
    if (paramsBranch && paramsBranch !== branchId) {
      setBranchId(paramsBranch);
      setReservationId(null);
      setFolio(null);
    }
  }, [searchParams, branchId]);

  useEffect(() => {
    loadFolio();
  }, [reservationId]);

  const getBranchIdFromUrl = (params: URLSearchParams): string => {
    const branch = params.get("branch");
    if (branch === "kimironko" || branch === "kim") return "kimironko";
    if (branch === "rond-point" || branch === "rdp") return "rond-point";
    return "kimironko";
  };

  const loadFolio = async () => {
    if (!reservationId) return;

    try {
      const folioData = await getGuestFolio(reservationId);
      setFolio(folioData);
      // Set initial form values
      setFormData({
        reservationId,
        roomCharges: folioData?.roomCharges ?? 0,
        foodBeverageCharges: folioData?.foodBeverageCharges ?? 0,
        roomServiceCharges: folioData?.roomServiceCharges ?? 0,
        otherCharges: folioData?.otherCharges ?? 0,
        totalPaid: folioData?.totalPaid ?? 0,
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

  const onSubmit = async (data: FolioForm) => {
    setIsEditing(true);

    try {
      const result = await updateGuestFolio(reservationId, {
        roomCharges: data.roomCharges,
        foodBeverageCharges: data.foodBeverageCharges,
        roomServiceCharges: data.roomServiceCharges,
        otherCharges: data.otherCharges,
        totalPaid: data.totalPaid,
      });

      if (!result.ok) {
        toast({ title: "Error", description: result.error, variant: "destructive" });
        setIsEditing(false);
        return;
      }

      toast({ title: "Success", description: "Folio updated successfully" });
      setIsEditing(false);
      loadFolio();
    } catch (error) {
      console.error("Error updating folio:", error);
      toast({
        title: "Error",
        description: "Failed to update guest folio",
        variant: "destructive",
      });
      setIsEditing(false);
    }
  };

  const selectReservation = async (id: string) => {
    setReservationId(id);
    await loadFolio();
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
            setReservationId(null);
            setFolio(null);
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

      {/* Reservation Selector */}
      {branchId && (
        <Card>
          <CardHeader>
            <CardTitle>Select Reservation</CardTitle>
          </CardHeader>
          <CardContent>
            <Select onValueChange={selectReservation}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a reservation" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">No reservation selected</SelectItem>
                {/* Reservations would be fetched here */}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      )}

      {/* Folio Display */}
      {folio && (
        <Card>
          <CardHeader>
            <CardTitle>Guest Folio - {folio.customerName}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-muted-verse mb-1">Room Charges</p>
                <p className="text-2xl font-bold">{folio.roomCharges?.toLocaleString()} RWF</p>
              </div>
              <div>
                <p className="text-muted-verse mb-1">Food & Beverage</p>
                <p className="text-2xl font-bold">{folio.foodBeverageCharges?.toLocaleString()} RWF</p>
              </div>
              <div>
                <p className="text-muted-verse mb-1">Room Service</p>
                <p className="text-2xl font-bold">{folio.roomServiceCharges?.toLocaleString()} RWF</p>
              </div>
              <div>
                <p className="text-muted-verse mb-1">Other Charges</p>
                <p className="text-2xl font-bold">{folio.otherCharges?.toLocaleString()} RWF</p>
              </div>
            </div>

            <div className="mt-4 p-3 rounded border" style={{ background: "var(--chakra-bg)" }}>
              <p className="text-muted-verse mb-2">Transaction History</p>
              <p className="text-sm text-muted-verse">
                Total Paid: {folio.totalPaid?.toLocaleString()} RWF<br/>
                Outstanding Balance: {folio.outstandingBalance?.toLocaleString() || 0} RWF
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Folio Edit Form */}
      {!folio && (
        <Card>
          <CardHeader>
            <CardTitle>Select a reservation to view folio</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-verse">Choose a reservation from the branch selector above to view and edit the guest folio.</p>
          </CardContent>
        </Card>
      )}

      {/* Edit Folio Form (shown when folio is loaded but we want to update) */}
      {folio && isEditing && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-lg p-6">
            <CardHeader>
              <CardTitle>Update Guest Folio</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={async (e: React.FormEvent) => {
                  e.preventDefault();
                  const formData = new FormData(e.target as HTMLFormElement);
                  const data: FolioForm = {
                    reservationId: formData.get("reservationId") as string,
                    roomCharges: formData.get("roomCharges") ? Number(formData.get("roomCharges")) : undefined,
                    foodBeverageCharges: formData.get("foodBeverageCharges") ? Number(formData.get("foodBeverageCharges")) : undefined,
                    roomServiceCharges: formData.get("roomServiceCharges") ? Number(formData.get("roomServiceCharges")) : undefined,
                    otherCharges: formData.get("otherCharges") ? Number(formData.get("otherCharges")) : undefined,
                    totalPaid: formData.get("totalPaid") ? Number(formData.get("totalPaid")) : undefined,
                  };

                  const validated = folioFormSchema.safeParse(data);
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
                <Input
                  type="hidden"
                  name="reservationId"
                  defaultValue={folio.reservationId || ""}
                />
                <Input
                  placeholder="Room charges (RWF)"
                  name="roomCharges"
                  defaultValue={folio.roomCharges?.toString() || "0"}
                  type="number"
                />
                <Input
                  placeholder="Food & beverage charges (RWF)"
                  name="foodBeverageCharges"
                  defaultValue={folio.foodBeverageCharges?.toString() || "0"}
                  type="number"
                />
                <Input
                  placeholder="Room service charges (RWF)"
                  name="roomServiceCharges"
                  defaultValue={folio.roomServiceCharges?.toString() || "0"}
                  type="number"
                />
                <Input
                  placeholder="Other charges (RWF)"
                  name="otherCharges"
                  defaultValue={folio.otherCharges?.toString() || "0"}
                  type="number"
                />
                <Input
                  placeholder="Total paid (RWF)"
                  name="totalPaid"
                  defaultValue={folio.totalPaid?.toString() || "0"}
                  type="number"
                />

                <div className="mt-4 flex gap-2">
                  <Button type="submit" disabled={isEditing}>
                    Update Folio
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isEditing}
                    onClick={() => setIsEditing(false)}
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