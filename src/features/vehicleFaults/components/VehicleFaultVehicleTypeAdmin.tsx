import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, ArrowUp, ArrowDown, EyeOff, Eye } from "lucide-react";

interface VehicleFaultVehicleTypeAdminProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function VehicleFaultVehicleTypeAdmin({
  open,
  onOpenChange,
}: VehicleFaultVehicleTypeAdminProps) {
  const isMobile = useIsMobile();
  const allTypes = useQuery(api.vehicleFaultVehicleTypes.getAllVehicleTypes);
  const addType = useMutation(api.vehicleFaultVehicleTypes.addVehicleType);
  const updateType = useMutation(api.vehicleFaultVehicleTypes.updateVehicleType);
  const deleteType = useMutation(api.vehicleFaultVehicleTypes.deleteVehicleType);
  const reorder = useMutation(api.vehicleFaultVehicleTypes.reorderVehicleTypes);

  const [newTypeName, setNewTypeName] = useState("");
  const [editingId, setEditingId] = useState<Id<"vehicleFaultVehicleTypes"> | null>(null);
  const [editingName, setEditingName] = useState("");

  const handleAdd = async () => {
    const name = newTypeName.trim();
    if (!name) return;

    try {
      await addType({ name });
      setNewTypeName("");
      toast.success("Vehicle type added");
    } catch {
      toast.error("Failed to add vehicle type");
    }
  };

  const handleRename = async (id: Id<"vehicleFaultVehicleTypes">) => {
    const name = editingName.trim();
    if (!name) return;

    try {
      await updateType({ id, name });
      setEditingId(null);
      toast.success("Vehicle type renamed");
    } catch {
      toast.error("Failed to rename");
    }
  };

  const handleToggleActive = async (id: Id<"vehicleFaultVehicleTypes">, isActive: boolean) => {
    try {
      await updateType({ id, isActive: !isActive });
      toast.success(isActive ? "Vehicle type deactivated" : "Vehicle type activated");
    } catch {
      toast.error("Failed to update");
    }
  };

  const handleDelete = async (id: Id<"vehicleFaultVehicleTypes">) => {
    try {
      await deleteType({ id });
      toast.success("Vehicle type removed");
    } catch {
      toast.error("Failed to delete");
    }
  };

  const handleMove = async (index: number, direction: "up" | "down") => {
    if (!allTypes) return;
    const sorted = [...allTypes].sort((a, b) => a.order - b.order);
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= sorted.length) return;

    const reordered = [...sorted];
    [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];

    try {
      await reorder({ orderedIds: reordered.map((t) => t._id) });
    } catch {
      toast.error("Failed to reorder");
    }
  };

  const sorted = allTypes ? [...allTypes].sort((a, b) => a.order - b.order) : [];

  const content = (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto space-y-4">
        {/* Add new type */}
        <div className="flex gap-2">
          <Input
            placeholder="New vehicle type..."
            value={newTypeName}
            onChange={(e) => setNewTypeName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            className="flex-1"
          />
          <Button onClick={handleAdd} size="sm" disabled={!newTypeName.trim()} className="gap-1">
            <Plus className="h-4 w-4" />
            Add
          </Button>
        </div>

        {/* Type list */}
        <div className="space-y-1">
          {sorted.map((vt, index) => (
            <div
              key={vt._id}
              className={`flex items-center gap-2 p-2 rounded-md border ${
                vt.isActive
                  ? "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
                  : "border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 opacity-60"
              }`}
            >
              {/* Reorder arrows */}
              <div className="flex flex-col gap-0.5">
                <button
                  onClick={() => handleMove(index, "up")}
                  disabled={index === 0}
                  className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                >
                  <ArrowUp className="h-3 w-3" />
                </button>
                <button
                  onClick={() => handleMove(index, "down")}
                  disabled={index === sorted.length - 1}
                  className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                >
                  <ArrowDown className="h-3 w-3" />
                </button>
              </div>

              {/* Name (editable) */}
              <div className="flex-1 min-w-0">
                {editingId === vt._id ? (
                  <Input
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onBlur={() => handleRename(vt._id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleRename(vt._id);
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    className="h-7 text-sm"
                    autoFocus
                  />
                ) : (
                  <button
                    onClick={() => {
                      setEditingId(vt._id);
                      setEditingName(vt.name);
                    }}
                    className="text-sm font-medium text-gray-900 dark:text-white hover:text-red-600 dark:hover:text-red-400 text-left truncate w-full"
                  >
                    {vt.name}
                  </button>
                )}
              </div>

              {/* Actions */}
              <button
                onClick={() => handleToggleActive(vt._id, vt.isActive)}
                className="p-1 text-gray-400 hover:text-gray-600"
                title={vt.isActive ? "Deactivate" : "Activate"}
              >
                {vt.isActive ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
              <button
                onClick={() => handleDelete(vt._id)}
                className="p-1 text-gray-400 hover:text-red-500"
                title="Delete"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}

          {sorted.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No vehicle types configured. Add one above.
            </p>
          )}
        </div>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="h-[80vh] flex flex-col border-gray-700">
          <DrawerHeader>
            <DrawerTitle>Manage Vehicle Types</DrawerTitle>
          </DrawerHeader>
          <div className="flex-1 overflow-hidden px-6 pb-6">{content}</div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-sm p-6 flex flex-col">
        <SheetHeader>
          <SheetTitle>Manage Vehicle Types</SheetTitle>
          <SheetDescription>Add, rename, reorder, or deactivate vehicle types.</SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-hidden mt-4">{content}</div>
      </SheetContent>
    </Sheet>
  );
}
