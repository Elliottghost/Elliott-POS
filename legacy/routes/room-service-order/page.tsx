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
import { listAccommodationReservations, createRoomServiceOrder } from "@/services/accommodation";
import { listRoomServiceOrders } from "@/services/room-service";
import { getBranchIdFromUrl } from "@/lib/branches";

interface RoomServiceItem {
  menuItemId: string;
  quantity: number;
  notes?: string;
}

interface CreateRoomServiceFormValues {
  reservationId: string;
  roomNumber: string;
  guestName: string;
  items: RoomServiceItem[];
}

const createRoomServiceSchema = z.object({
  reservationId: z.string().nonempty("Reservation is required"),
  roomNumber: z.string().nonempty("Room number is required"),
  guestName: z.string().nonempty("Guest name is required"),
  items: z
    .array(
      z.object({
        menuItemId: z.string().nonempty("Menu item is required"),
        quantity: z.number().min(1, "Quantity must be at least 1").max(99),
        notes: z.string().optional(),
      })
    )
    .min(1, "Add at least one item"),
});

type CreateRoomServiceForm = z.infer<typeof createRoomServiceSchema>;

export default function RoomServiceOrderPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();
  const [branchId, setBranchId] = useState(getBranchIdFromUrl(searchParams) || "kimironko");
  const [reservations, setReservations] = useState<any[]>([]);
  const [roomServiceOrders, setRoomServiceOrders] = useState<any[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [editingOrder, setEditingOrder] = useState<any | null>(null);

  // Fetch branch ID from URL if changed
  useEffect(() => {
    const paramsBranch = getBranchIdFromUrl(searchParams);
    if (paramsBranch && paramsBranch !== branchId) {
      setBranchId(paramsBranch);
      setEditingOrder(null);
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
      // Load reservations for this branch that are checked in
      const reservationsRes = await fetch(
        `/api/accommodation/reservations?branchId=${branchId}&status=checked_in`
      );
      const reservationsData = await reservationsRes.json();
      setReservations(reservationsData.data ?? []);

      // Load existing room service orders
      const rsoRes = await fetch(
        `/api/room-service/orders?branchId=${branchId}`
      );
      const rsoData = await rsoRes.json();
      setRoomServiceOrders(rsoData.data ?? []);
    } catch (error) {
      console.error("Error loading room service data:", error);
      toast({
        title: "Error",
        description: "Failed to load room service data",
        variant: "destructive",
      });
    }
  };

  const onSubmit = async (data: CreateRoomServiceForm) => {
    setIsCreating(true);

    const result = await createRoomServiceOrder(
      { id: "", name: "", email: "", role: "", branchId, permissions: [] } as any,
      {
        reservationId: data.reservationId,
        branchId,
        roomNumber: data.roomNumber,
        guestName: data.guestName,
        items: data.items,
      },
      { requestId: crypto.randomUUID(), origin: window.location.origin, userId: "" }
    );

    if (!result.ok) {
      toast({ title: "Error", description: result.error, variant: "destructive" });
      setIsCreating(false);
      return;
    }

    toast({ title: "Success", description: "Room service order created successfully" });
    setIsCreating(false);
    loadData();
    setEditingOrder(null);
  };

  const handleEdit = (order: any) => {
    setEditingOrder(order);
  };

  const handleClose = () => {
    setEditingOrder(null);
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
            setEditingOrder(null);
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

      {/* Create Room Service Order Form */}
      <Card>
        <CardHeader>
          <CardTitle>Create Room Service Order</CardTitle>
        </CardHeader>
        <CardContent>
          {isCreating ? (
            <p>Creating room service order...</p>
          ) : (
            <form
              onSubmit={async (e: React.FormEvent) => {
                e.preventDefault();
                const formData = new FormData(e.target as HTMLFormElement);
                const data: CreateRoomServiceForm = {
                  reservationId: formData.get("reservationId") as string,
                  roomNumber: formData.get("roomNumber") as string,
                  guestName: formData.get("guestName") as string,
                  items: JSON.parse(formData.get("items") as string || "[]"),
                };

                const validated = createRoomServiceSchema.safeParse(data);
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
                <Select onValueChange={(val: string) => {}}>
                  <SelectTrigger>
                    <SelectValue placeholder="Reservation" />
                  </SelectTrigger>
                  <SelectContent>
                    {reservations.map((res) => (
                      <SelectItem key={res.id} value={res.id}>
                        {res.customerName} - {res.checkInDate} to {res.checkOutDate}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Room number"
                  name="roomNumber"
                  defaultValue="101"
                />
                <Input
                  placeholder="Guest name"
                  name="guestName"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 mb-3">
                {/* Menu items would be fetched from the menu system */}
                <Select
                  placeholder="Menu item"
                  name="menuItemId"
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select menu item" />
                  </SelectTrigger>
                  <SelectContent>
                    {/* Items would be populated from menu service */}
                    <SelectItem value="food-1">Food Item 1</SelectItem>
                    <SelectItem value="drink-1">Drink Item 1</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  name="quantity"
                  placeholder="Quantity"
                  min={1}
                  max={99}
                  defaultValue={1}
                />
              </div>

              <Input
                placeholder="Notes (optional)"
                name="notes"
              />

              <div className="mt-4 flex gap-2">
                <Button type="submit" disabled={isCreating}>
                  Create Order
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={isCreating}
                  onClick={() => setEditingOrder(null)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      {/* Existing Room Service Orders */}
      <Card>
        <CardHeader>
          <CardTitle>Room Service Orders ({roomServiceOrders.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {roomServiceOrders.length === 0 ? (
            <p className="text-muted-verse">No room service orders found.</p>
          ) : (
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {roomServiceOrders.map((order) => {
                const statusColors: Record<string, string> = {
                  pending: "text-yellow-600",
                  queued: "text-yellow-600",
                  preparing: "text-blue-500",
                  ready: "text-green-600",
                  served: "text-green-600",
                  closed: "text-muted-verse",
                };

                const status = order.fulfillmentStatus ?? order.status ?? "pending";
                const color = statusColors[status] || "text-gray-600";

                return (
                  <div key={order.id} className="p-3 rounded border flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start text-sm">
                        <span className="font-medium">{order.guestName}</span>
                        <span className="text-xs {color} capitalize">
                          {status}
                        </span>
                      </div>
                      <p className="text-xs text-muted-verse">
                        Room {order.roomNumber} · Total: {order.total?.toLocaleString()} RWF
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {order.status !== "served" && order.status !== "closed" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(order)}
                          title="Update Status"
                        >
                          Update Status
                        </Button>
                      )}
                      {order.fulfillmentStatus !== "served" && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => {
                            // Would complete the order
                          }}
                          title="Complete"
                        >
                          Complete
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Order Modal (shown when editing) */}
      {editingOrder && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-lg p-6">
            <CardHeader>
              <CardTitle>Update Room Service Order: {editingOrder.guestName}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-verse mb-2">
                Room {editingOrder.roomNumber} · Status: {editingOrder.fulfillmentStatus || editingOrder.status}
              </p>
              <p className="text-sm text-muted-verse mb-4">
                Total: {editingOrder.total?.toLocaleString()} RWF
              </p>
              <p className="text-muted-verse mb-4">
                Items: {editingOrder.itemsJson?.split(',').length || 0} items
              </p>
              <Button
                variant="primary"
                onClick={() => setEditingOrder(null)}
              >
                Close
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}