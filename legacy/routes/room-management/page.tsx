import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent, } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { listRoomTypes, createRoom, updateRoom, deleteRoom, getRoomsByBranch, getRoomType } from "@/services/accommodation";
import { getBranchIdFromUrl } from "@/lib/branches";

const roomTypeSchema = z.object({
  roomTypeId: z.string().nonempty("Room type is required"),
  roomNumber: z.string().nonempty("Room number is required"),
  branchId: z.string().nonempty("Branch is required"),
  capacity: z.number().min(1, "Capacity must be at least 1").default(2),
  bedCount: z.number().min(1, "Bed count must be at least 1").default(1),
  description: z.string().optional(),
  amenities: z.string().optional(),
  standardPrice: z.number().min(0, "Price must be at least 0").optional(),
  specialRate: z.number().min(0, "Special rate must be at least 0").optional(),
  status: z.enum(["available", "occupied", "reserved", "dirty", "cleaning", "maintenance", "out_of_service"]).optional(),
});

type RoomTypeForm = z.infer<typeof roomTypeSchema>;

export default function RoomManagementPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();
  const [branchId, setBranchId] = useState(getBranchIdFromUrl(searchParams) || "kimironko");
  const [roomTypes, setRoomTypes] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [editingRoom, setEditingRoom] = useState<{ id: string | null; data: RoomTypeForm } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      // Load room types
      const typesRes = await fetch(`/api/accommodation/room-types?includeInactive=false`);
      const typesData = await typesRes.json();
      setRoomTypes(typesData.data ?? []);

      // Load rooms
      const roomsRes = await fetch(`/api/accommodation/rooms?branchId=${branchId}&includeInactive=false`);
      const roomsData = await roomsRes.json();
      setRooms(roomsData.data ?? []);
    } catch (error) {
      console.error("Error loading room data:", error);
      toast({
        title: "Error",
        description: "Failed to load room data",
        variant: "destructive",
      });
    }
  };

  const onSubmit = async (data: RoomTypeForm) => {
    setIsSubmitting(true);

    // Check if we're creating or updating
    if (editingRoom?.id) {
      // Update existing room
      const result = await updateRoom(
        editingRoom.id,
        {
          roomNumber: data.roomNumber,
          roomTypeId: data.roomTypeId,
          branchId: branchId,
          capacity: data.capacity,
          bedCount: data.bedCount,
          description: data.description,
          amenities: data.amenities,
          standardPrice: data.standardPrice,
          specialRate: data.specialRate,
          status: data.status,
        },
        { requestId: crypto.randomUUID(), origin: window.location.origin, userId: "" }
      );

      if (!result.ok) {
        toast({ title: "Error", description: result.error, variant: "destructive" });
        setIsSubmitting(false);
        return;
      }

      toast({ title: "Success", description: "Room updated successfully" });
      setEditingRoom(null);
    } else {
      // Create new room
      const result = await createRoom(
        { id: "", name: "", email: "", role: "", branchId, permissions: [] } as any,
        {
          roomNumber: data.roomNumber,
          roomTypeId: data.roomTypeId,
          branchId,
          capacity: data.capacity,
          bedCount: data.bedCount,
          description: data.description,
          amenities: data.amenities,
          standardPrice: data.standardPrice,
          specialRate: data.specialRate,
          status: data.status,
        },
        { requestId: crypto.randomUUID(), origin: window.location.origin, userId: "" }
      );

      if (!result.ok) {
        toast({ title: "Error", description: result.error, variant: "destructive" });
        setIsSubmitting(false);
        return;
      }

      toast({ title: "Success", description: "Room created successfully" });
    }

    setIsSubmitting(false);
    loadData();
  };

  const handleDelete = async (roomId: string) => {
    const confirmed = window.confirm("Are you sure you want to deactivate this room?");
    if (!confirmed) return;

    const result = await deleteRoom(
      { id: "", name: "", email: "", role: "", branchId, permissions: [] } as any,
      roomId,
      { requestId: crypto.randomUUID(), origin: window.location.origin, userId: "" }
    );

    if (!result.ok) {
      toast({ title: "Error", description: result.error, variant: "destructive" });
      return;
    }

    toast({ title: "Success", description: "Room deactivated successfully" });
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

      {/* Room Type Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Room Types</CardTitle>
        </CardHeader>
        <CardContent>
          {roomTypes.length === 0 ? (
            <p className="text-muted-verse">No room types configured. Add room types first.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {roomTypes.map((rt) => (
                <div key={rt.id} className="p-3 rounded border">
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-medium">{rt.name}</span>
                    <span className="text-xs text-muted-verse">{rt.category}</span>
                  </div>
                  <p className="text-sm">
                    Base Price: {rt.base_price?.toLocaleString()} RWF/night
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Rooms List */}
      <Card>
        <CardHeader>
          <CardTitle>Rooms ({rooms.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {rooms.length === 0 ? (
            <p className="text-muted-verse">No rooms found for this branch.</p>
          ) : (
            <div className="space-y-3">
              {rooms.map((room) => (
                <div key={room.id} className="p-3 rounded border flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                      <span className="font-medium">{room.roomNumber}</span>
                      <span className="text-xs text-muted-verse capitalize">{room.status}</span>
                    </div>
                    <p className="text-xs text-muted-verse">
                      {room.capacity} capacity · {room.bedCount} bed(s) ·
                      {room.standardPrice?.toLocaleString()} RWF/night
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingRoom({ id: room.id, data: {
                        roomTypeId: room.room_type_id,
                        roomNumber: room.room_number,
                        branchId: room.branch_id,
                        capacity: room.capacity,
                        bedCount: room.bed_count,
                        description: room.description,
                        amenities: room.amenities,
                        standardPrice: room.standard_price,
                        specialRate: room.special_rate,
                        status: room.status,
                      }}}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(room.id)}
                    >
                      Deactivate
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Room Form Modal / Edit Section */}
      {editingRoom && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-lg p-6">
            <CardHeader>
              <CardTitle>{editingRoom.id ? "Edit Room" : "Create New Room"}</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={async (e: React.FormEvent) => {
                  e.preventDefault();
                  const formData = new FormData(e.target as HTMLFormElement);
                  const data: RoomTypeForm = {
                    roomTypeId: formData.get("roomTypeId") as string,
                    roomNumber: formData.get("roomNumber") as string,
                    branchId: branchId,
                    capacity: formData.get("capacity") ? Number(formData.get("capacity")) : 2,
                    bedCount: formData.get("bedCount") ? Number(formData.get("bedCount")) : 1,
                    description: formData.get("description") as string,
                    amenities: formData.get("amenities") as string,
                    standardPrice: formData.get("standardPrice") ? Number(formData.get("standardPrice")) : undefined,
                    specialRate: formData.get("specialRate") ? Number(formData.get("specialRate")) : undefined,
                    status: formData.get("status") as string,
                  };
                  await onSubmit(data);
                }}
              >
                <Input
                  placeholder="Room type"
                  defaultValue={editingRoom?.data.roomTypeId || ""}
                  disabled
                />
                <Input
                  placeholder="Room number"
                  name="roomNumber"
                  defaultValue={editingRoom?.data.roomNumber || ""}
                  required
                />
                <Select onValueChange={(val: string) => {
                  // Update room type selection
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

                <Input
                  placeholder="Capacity"
                  name="capacity"
                  defaultValue={editingRoom?.data.capacity || "2"}
                  type="number"
                />
                <Input
                  placeholder="Bed count"
                  name="bedCount"
                  defaultValue={editingRoom?.data.bedCount || "1"}
                  type="number"
                />
                <Input
                  placeholder="Description"
                  name="description"
                  defaultValue={editingRoom?.data.description || ""}
                />
                <Input
                  placeholder="Amenities"
                  name="amenities"
                  defaultValue={editingRoom?.data.amenities || ""}
                />
                <Input
                  placeholder="Standard price (RWF)"
                  name="standardPrice"
                  defaultValue={editingRoom?.data.standardPrice || ""}
                  type="number"
                />
                <Input
                  placeholder="Special rate (RWF)"
                  name="specialRate"
                  defaultValue={editingRoom?.data.specialRate || ""}
                  type="number"
                />

                <Select
                  placeholder="Status"
                  name="status"
                  defaultValue={editingRoom?.data.status || "available"}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="available">Available</SelectItem>
                    <SelectItem value="occupied">Occupied</SelectItem>
                    <SelectItem value="reserved">Reserved</SelectItem>
                    <SelectItem value="dirty">Dirty</SelectItem>
                    <SelectItem value="cleaning">Cleaning</SelectItem>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                    <SelectItem value="out_of_service">Out of Service</SelectItem>
                  </SelectContent>
                </Select>

                <div className="mt-4 flex gap-2">
                  <Button type="submit" disabled={isSubmitting}>
                    {editingRoom.id ? "Update Room" : "Create Room"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isSubmitting}
                    onClick={() => setEditingRoom(null)}
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