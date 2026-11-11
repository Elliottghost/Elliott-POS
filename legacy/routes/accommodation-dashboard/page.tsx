import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent, Button } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { getBranchIdFromUrl } from "@/lib/branches";

interface RoomSummary {
  total: number;
  available: number;
  occupied: number;
  reserved: number;
  dirty: number;
  underMaintenance: number;
}

interface RevenueSummary {
  totalRevenue: number;
  todayRevenue: number;
  upcomingRevenue: number;
}

export default function AccommodationDashboard() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();

  const branchId = getBranchIdFromUrl(searchParams) || "kimironko";
  const [roomSummary, setRoomSummary] = useState<RoomSummary>({
    total: 0,
    available: 0,
    occupied: 0,
    reserved: 0,
    dirty: 0,
    underMaintenance: 0,
  });
  const [revenueSummary, setRevenueSummary] = useState<RevenueSummary>({
    totalRevenue: 0,
    todayRevenue: 0,
    upcomingRevenue: 0,
  });
  const [rooms, setRooms] = useState<any[]>([]);
  const [reservations, setReservations] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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
    setIsLoading(true);
    try {
      // Fetch rooms
      const roomsRes = await fetch(`/api/accommodation/rooms?branchId=${branchId}`);
      const roomsData = await roomsRes.json();
      setRooms(roomsData.data ?? []);

      // Fetch reservations
      const reservationsRes = await fetch(
        `/api/accommodation/reservations?branchId=${branchId}&status=pending`
      );
      const reservationsData = await reservationsRes.json();
      setReservations(reservationsData.data ?? []);

      // Calculate summaries
      const totalRooms = roomsData.data?.length ?? 0;
      const statusCounts: Record<string, number> = {
        available: 0,
        occupied: 0,
        reserved: 0,
        dirty: 0,
        under_maintenance: 0,
        checked_in: 0,
        checked_out: 0,
      };

      roomsData.data?.forEach((room: any) => {
        const status = room.status ?? "available";
        if (statusCounts[status] !== undefined) {
          statusCounts[status]++;
        }
      });

      setRoomSummary({
        total: totalRooms,
        available: statusCounts.available ?? 0,
        occupied: statusCounts.occupied ?? 0,
        reserved: statusCounts.reserved ?? 0,
        dirty: statusCounts.dirty ?? 0,
        underMaintenance: statusCounts.under_maintenance ?? 0,
      });

      // Calculate revenue (simple example)
      let totalRevenue = 0;
      let todayRevenue = 0;
      let upcomingRevenue = 0;

      reservationsData.data?.forEach((res: any) => {
        const status = res.status ?? "pending";
        const amount = res.total_amount ?? 0;

        if (status === "checked_in" || status === "occupied") {
          totalRevenue += amount;
        }

        if (status === "pending" || status === "confirmed") {
          upcomingRevenue += amount;
        }
      });

      setRevenueSummary({
        totalRevenue,
        todayRevenue: todayRevenue,
        upcomingRevenue,
      });

    } catch (error) {
      console.error("Error loading accommodation data:", error);
      toast({
        title: "Error",
        description: "Failed to load accommodation data",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[600px] items-center justify-center p-8">
        <span>Loading accommodation dashboard...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Room Summary Section */}
      <Card>
        <CardHeader>
          <CardTitle>Room Summary</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <div>
            <p className="text-2xl font-bold">{roomSummary.total}</p>
            <p className="text-sm text-muted-verse">Total Rooms</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-green-600">{roomSummary.available}</p>
            <p className="text-sm text-green-600">Available</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-orange-600">{roomSummary.occupied}</p>
            <p className="text-sm text-orange-600">Occupied</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-blue-600">{roomSummary.reserved}</p>
            <p className="text-sm text-blue-600">Reserved</p>
          </div>
        </CardContent>
      </Card>

      {/* Dirty & Maintenance Section */}
      <Card>
        <CardHeader>
          <CardTitle>Room Status</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-2">
          <div>
            <p className="text-xl font-bold text-red-600">{roomSummary.dirty}</p>
            <p className="text-sm text-red-600">Dirty</p>
          </div>
          <div>
            <p className="text-xl font-bold text-yellow-600">{roomSummary.underMaintenance}</p>
            <p className="text-sm text-yellow-600">Under Maintenance</p>
          </div>
        </CardContent>
      </Card>

      {/* Revenue Summary Section */}
      <Card>
        <CardHeader>
          <CardTitle>Revenue Summary</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-2">
          <div>
            <p className="text-2xl font-bold text-green-600">{revenueSummary.todayRevenue.toLocaleString()} RWF</p>
            <p className="text-sm text-green-600">Today</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-blue-600">{revenueSummary.upcomingRevenue.toLocaleString()} RWF</p>
            <p className="text-sm text-blue-600">Upcoming</p>
          </div>
          <div>
            <p className="text-2xl font-bold">{revenueSummary.totalRevenue.toLocaleString()} RWF</p>
            <p className="text-sm">Total</p>
          </div>
        </CardContent>
      </Card>

      {/* Rooms List */}
      <Card>
        <CardHeader>
          <CardTitle>Rooms</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p>Loading rooms...</p>
          ) : rooms.length === 0 ? (
            <p className="text-muted-verse">No rooms found for this branch.</p>
          ) : (
            <div className="space-y-3">
              {rooms.map((room) => (
                <div key={room.id} className="p-3 rounded border">
                  <div className="flex justify-between items-start">
                    <span className="font-medium">{room.roomNumber}</span>
                    <span className="text-sm text-muted-verse capitalize">{room.status}</span>
                  </div>
                  <p className="text-xs text-muted-verse">
                    {room.capacity} capacity · {room.bedCount} bed(s) ·
                    {room.standardPrice?.toLocaleString()} RWF/night
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upcoming Reservations */}
      <Card>
        <CardHeader>
          <CardTitle>Upcoming Reservations</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p>Loading reservations...</p>
          ) : reservations.length === 0 ? (
            <p className="text-muted-verse">No upcoming reservations.</p>
          ) : (
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {reservations.map((res) => (
                <div key={res.id} className="p-2 rounded border-b">
                  <div className="flex justify-between items-start text-sm">
                    <span className="font-medium">{res.customerName}</span>
                    <span className="text-xs text-muted-verse">{res.checkInDate} - {res.checkOutDate}</span>
                  </div>
                  <p className="text-xs text-muted-verse">
                    {res.guestCount} guests · Status: {res.status}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}