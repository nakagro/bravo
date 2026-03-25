import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { toast } from "sonner";

export function CheckTemplatesSection() {
  const stationChecks = useQuery(api.stationChecks.getAllStationChecks, {
    includeInactive: true,
  });
  const createStationCheck = useMutation(api.stationChecks.createStationCheck);
  const updateStationCheck = useMutation(api.stationChecks.updateStationCheck);
  const deleteStationCheck = useMutation(api.stationChecks.deleteStationCheck);

  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<Id<"stationChecks"> | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);

  const resetForm = () => {
    setName("");
    setDescription("");
    setIsActive(true);
    setIsCreating(false);
    setEditingId(null);
  };

  const handleCreate = async () => {
    if (!name) return;
    try {
      await createStationCheck({
        name,
        description: description || undefined,
        isActive,
      });
      resetForm();
      toast.success("Check template created");
    } catch (error) {
      toast.error("Failed to create check template");
    }
  };

  const handleUpdate = async (id: Id<"stationChecks">) => {
    if (!name) return;
    try {
      await updateStationCheck({
        id,
        name,
        description: description || undefined,
        isActive,
      });
      resetForm();
      toast.success("Check template updated");
    } catch (error) {
      toast.error("Failed to update check template");
    }
  };

  const handleDelete = async (id: Id<"stationChecks">) => {
    if (!confirm("Are you sure you want to delete this check? Past submission history will not be affected.")) return;
    try {
      await deleteStationCheck({ id });
      toast.success("Check template deleted");
    } catch (error) {
      toast.error("Failed to delete check template");
    }
  };

  const handleReorder = async (
    id: Id<"stationChecks">,
    direction: "up" | "down"
  ) => {
    if (!stationChecks || stationChecks.length < 2) return;
    const currentIndex = stationChecks.findIndex((c) => c._id === id);
    if (currentIndex === -1) return;
    const adjacentIndex =
      direction === "up"
        ? Math.max(0, currentIndex - 1)
        : Math.min(stationChecks.length - 1, currentIndex + 1);
    if (currentIndex === adjacentIndex) return;
    const current = stationChecks[currentIndex];
    const adjacent = stationChecks[adjacentIndex];
    try {
      await updateStationCheck({ id: current._id, order: adjacent.order });
      await updateStationCheck({ id: adjacent._id, order: current.order });
    } catch (error) {
      toast.error("Failed to reorder checks");
    }
  };

  if (!stationChecks) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-14 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          size="sm"
          onClick={() => setIsCreating(true)}
          disabled={isCreating}
        >
          <Plus className="h-4 w-4 mr-1" />
          New Check
        </Button>
      </div>

      {isCreating && (
        <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 space-y-3">
          <div>
            <Label>Check Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Clean multipurpose room"
              className="mt-1"
            />
          </div>
          <div>
            <Label>Description (Optional)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add detailed instructions..."
              className="mt-1 resize-none h-20"
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={isActive} onCheckedChange={setIsActive} />
            <Label>Active</Label>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={resetForm}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleCreate} disabled={!name}>
              Create
            </Button>
          </div>
        </div>
      )}

      {stationChecks.length === 0 ? (
        <p className="text-center py-6 text-sm text-gray-500 dark:text-gray-400">
          No check templates yet. Create your first one above.
        </p>
      ) : (
        <div className="space-y-2">
          {stationChecks.map((check) => (
            <div
              key={check._id}
              className={`p-3 rounded-lg border ${
                check.isActive
                  ? "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
                  : "border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 opacity-60"
              }`}
            >
              {editingId === check._id ? (
                <div className="space-y-3">
                  <div>
                    <Label>Check Name</Label>
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Description</Label>
                    <Textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="mt-1 resize-none h-20"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={isActive} onCheckedChange={setIsActive} />
                    <Label>Active</Label>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" size="sm" onClick={resetForm}>
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleUpdate(check._id)}
                      disabled={!name}
                    >
                      Save
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                        {check.name}
                      </h4>
                      {!check.isActive && (
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1.5 py-0"
                        >
                          Inactive
                        </Badge>
                      )}
                    </div>
                    {check.description && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1">
                        {check.description}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => handleReorder(check._id, "up")}
                    >
                      <ArrowUp className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => handleReorder(check._id, "down")}
                    >
                      <ArrowDown className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => {
                        setEditingId(check._id);
                        setName(check.name);
                        setDescription(check.description || "");
                        setIsActive(check.isActive);
                      }}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="destructive"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => handleDelete(check._id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
