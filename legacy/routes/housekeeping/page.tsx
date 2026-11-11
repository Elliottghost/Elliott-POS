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
import { listHousekeepingTasks, createHousekeepingTask, updateHousekeepingTask } from "@/services/accommodation";
import { getBranchIdFromUrl } from "@/lib/branches";

interface HousekeepingTaskFormValues {
  roomId: string;
  branchId: string;
  taskType: string;
  priority?: number;
}

const taskSchema = z.object({
  roomId: z.string().nonempty("Room is required"),
  branchId: z.string().nonempty("Branch is required"),
  taskType: z.enum(["cleaning", "maintenance", "inspection"]),
  priority: z.number().min(1, "Priority must be at least 1").default(1),
});

type HousekeepingTaskForm = z.infer<typeof taskSchema>;

export default function HousekeepingPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();
  const [branchId, setBranchId] = useState(getBranchIdFromUrl(searchParams) || "kimironko");
  const [tasks, setTasks] = useState<any[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [editingTask, setEditingTask] = useState<any | null>(null);

  // Fetch branch ID from URL if changed
  useEffect(() => {
    const paramsBranch = getBranchIdFromUrl(searchParams);
    if (paramsBranch && paramsBranch !== branchId) {
      setBranchId(paramsBranch);
      setEditingTask(null);
    }
  }, [searchParams, branchId]);

  useEffect(() => {
    loadTasks();
  }, [branchId]);

  const getBranchIdFromUrl = (params: URLSearchParams): string => {
    const branch = params.get("branch");
    if (branch === "kimironko" || branch === "kim") return "kimironko";
    if (branch === "rond-point" || branch === "rdp") return "rond-point";
    return "kimironko";
  };

  const loadTasks = async () => {
    try {
      const tasksRes = await fetch(
        `/api/accommodation/housekeeping?branchId=${branchId}`
      );
      const tasksData = await tasksRes.json();
      setTasks(tasksData.data ?? []);
    } catch (error) {
      console.error("Error loading housekeeping tasks:", error);
      toast({
        title: "Error",
        description: "Failed to load housekeeping tasks",
        variant: "destructive",
      });
    }
  };

  const onSubmit = async (data: HousekeepingTaskForm) => {
    setIsCreating(true);

    const result = await createHousekeepingTask(
      { id: "", name: "", email: "", role: "", branchId, permissions: [] } as any,
      {
        roomId: data.roomId,
        branchId,
        taskType: data.taskType,
        priority: data.priority,
      },
      { requestId: crypto.randomUUID(), origin: window.location.origin, userId: "" }
    );

    if (!result.ok) {
      toast({ title: "Error", description: result.error, variant: "destructive" });
      setIsCreating(false);
      return;
    }

    toast({ title: "Success", description: "Housekeeping task created successfully" });
    setIsCreating(false);
    loadTasks();
    setEditingTask(null);
  };

  const handleEdit = (task: any) => {
    setEditingTask(task);
  };

  const handleComplete = async (taskId: string, notes?: string) => {
    const result = await updateHousekeepingTask(
      { id: "", name: "", email: "", role: "", branchId, permissions: [] } as any,
      taskId,
      "completed",
      notes,
      { requestId: crypto.randomUUID(), origin: window.location.origin, userId: "" }
    );

    if (!result.ok) {
      toast({ title: "Error", description: result.error, variant: "destructive" });
      return;
    }

    toast({ title: "Success", description: "Housekeeping task marked as completed" });
    loadTasks();
  };

  const handleDelete = async (taskId: string) => {
    // In housekeeping, we'd typically just mark as cancelled or remove
    const confirmed = window.confirm("Are you sure you want to remove this task?");
    if (!confirmed) return;

    // For now, just update status to cancelled
    await updateHousekeepingTask(
      { id: "", name: "", email: "", role: "", branchId, permissions: [] } as any,
      taskId,
      "cancelled",
      "",
      { requestId: crypto.randomUUID(), origin: window.location.origin, userId: "" }
    );

    toast({ title: "Success", description: "Housekeeping task removed" });
    loadTasks();
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
            setEditingTask(null);
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

      {/* Create Task Form */}
      <Card>
        <CardHeader>
          <CardTitle>Create Housekeeping Task</CardTitle>
        </CardHeader>
        <CardContent>
          {isCreating ? (
            <p>Creating task...</p>
          ) : (
            <form
              onSubmit={async (e: React.FormEvent) => {
                e.preventDefault();
                const formData = new FormData(e.target as HTMLFormElement);
                const data: HousekeepingTaskForm = {
                  roomId: formData.get("roomId") as string,
                  branchId,
                  taskType: formData.get("taskType") as string,
                  priority: formData.get("priority") ? Number(formData.get("priority")) : 1,
                };

                const validated = taskSchema.safeParse(data);
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
                  placeholder="Room number"
                  name="roomId"
                />
                <Select onValueChange={(val: string) => {
                  // Handle branch change
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select branch" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="kimironko">Kimironko (KIM)</SelectItem>
                    <SelectItem value="rond-point">Rond-Point (RDP)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-3">
                <Select
                  placeholder="Task Type"
                  name="taskType"
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cleaning">Cleaning</SelectItem>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                    <SelectItem value="inspection">Inspection</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  name="priority"
                  placeholder="Priority"
                  defaultValue={1}
                  min={1}
                />
              </div>

              <div className="mt-4 flex gap-2">
                <Button type="submit" disabled={isCreating}>
                  Create Task
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={isCreating}
                  onClick={() => setEditingTask(null)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      {/* Existing Tasks List */}
      <Card>
        <CardHeader>
          <CardTitle>Housekeeping Tasks ({tasks.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {tasks.length === 0 ? (
            <p className="text-muted-verse">No housekeeping tasks found for this branch.</p>
          ) : (
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {tasks.map((task) => {
                const statusColor =
                  task.status === "completed"
                    ? "text-green-600"
                    : task.status === "in_progress"
                      ? "text-yellow-600"
                      : "text-blue-600";

                return (
                  <div key={task.id} className="p-3 rounded border flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start">
                        <span className="font-medium">
                          Room {task.roomId?.replace("kim-", "").replace("rdp-", "") || task.roomId}
                        </span>
                        <span className="text-xs text-muted-verse capitalize">{task.status}</span>
                      </div>
                      <p className="text-xs text-muted-verse">
                        Type: {task.taskType} · Priority: {task.priority}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {task.status !== "completed" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleComplete(task.id)}
                        >
                          Mark Complete
                        </Button>
                      )}
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(task.id)}
                        title="Cancel"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Task Form (modal) */}
      {editingTask && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-lg p-6">
            <CardHeader>
              <CardTitle>Edit Housekeeping Task</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={async (e: React.FormEvent) => {
                  e.preventDefault();
                  const formData = new FormData(e.target as HTMLFormElement);
                  const data: HousekeepingTaskForm = {
                    roomId: formData.get("roomId") as string,
                    branchId,
                    taskType: formData.get("taskType") as string,
                    priority: formData.get("priority") ? Number(formData.get("priority")) : 1,
                  };

                  const validated = taskSchema.safeParse(data);
                  if (!validated.success) {
                    toast({
                      title: "Validation Error",
                      description: validated.error.issues.map((i) => i.message).join(", "),
                      variant: "destructive",
                    });
                    return;
                  }

                  // Just update the task with the new data
                  await handleComplete(editingTask.id, formData.get("notes") as string);
                }}
              >
                <Input
                  placeholder="Room"
                  defaultValue={editingTask.roomId || ""}
                  disabled
                />
                <Select
                  placeholder="Task Type"
                  defaultValue={editingTask.taskType}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cleaning">Cleaning</SelectItem>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                    <SelectItem value="inspection">Inspection</SelectItem>
                  </SelectContent>
                </Select>

                <Input
                  type="number"
                  name="priority"
                  defaultValue={editingTask.priority || "1"}
                  min={1}
                />

                <Input
                  placeholder="Notes"
                  defaultValue={editingTask.notes || ""}
                />

                <div className="mt-4 flex gap-2">
                  <Button type="submit" disabled={isCreating}>
                    Update Task
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isCreating}
                    onClick={() => setEditingTask(null)}
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