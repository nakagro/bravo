import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { toast } from "sonner";

import { ResponsiveModal } from "@/components/shared/ResponsiveModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, ArrowUp, ArrowDown, EyeOff, Eye } from "lucide-react";
import { eventTypeColors, eventTypeColorKeys, defaultEventTypeColor } from "../types";

interface EventTypesManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Compact swatch row used both for the add form and per-row colour editing.
function ColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (color: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {eventTypeColorKeys.map((key) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          title={eventTypeColors[key].label}
          aria-label={eventTypeColors[key].label}
          aria-pressed={value === key}
          className={`h-6 w-6 rounded-full ${eventTypeColors[key].swatch} transition-transform ${
            value === key
              ? "ring-2 ring-offset-2 ring-gray-900 dark:ring-white dark:ring-offset-gray-900 scale-110"
              : "hover:scale-110"
          }`}
        />
      ))}
    </div>
  );
}

export function EventTypesManager({ open, onOpenChange }: EventTypesManagerProps) {
  const allTypes = useQuery(api.eventTypes.getAllEventTypes);
  const addType = useMutation(api.eventTypes.addEventType);
  const updateType = useMutation(api.eventTypes.updateEventType);
  const deleteType = useMutation(api.eventTypes.deleteEventType);
  const reorder = useMutation(api.eventTypes.reorderEventTypes);

  const [newTypeName, setNewTypeName] = useState("");
  const [newTypeColor, setNewTypeColor] = useState(defaultEventTypeColor);
  const [editingId, setEditingId] = useState<Id<"eventTypes"> | null>(null);
  const [editingName, setEditingName] = useState("");

  const handleAdd = async () => {
    const name = newTypeName.trim();
    if (!name) return;
    try {
      await addType({ name, color: newTypeColor });
      setNewTypeName("");
      setNewTypeColor(defaultEventTypeColor);
      toast.success("Event type added");
    } catch {
      toast.error("Failed to add event type");
    }
  };

  const handleRename = async (id: Id<"eventTypes">) => {
    const name = editingName.trim();
    if (!name) {
      setEditingId(null);
      return;
    }
    try {
      await updateType({ id, name });
      setEditingId(null);
      toast.success("Event type renamed");
    } catch {
      toast.error("Failed to rename");
    }
  };

  const handleRecolour = async (id: Id<"eventTypes">, color: string) => {
    try {
      await updateType({ id, color });
    } catch {
      toast.error("Failed to update colour");
    }
  };

  const handleToggleActive = async (id: Id<"eventTypes">, isActive: boolean) => {
    try {
      await updateType({ id, isActive: !isActive });
      toast.success(isActive ? "Event type deactivated" : "Event type activated");
    } catch {
      toast.error("Failed to update");
    }
  };

  const handleDelete = async (id: Id<"eventTypes">) => {
    try {
      await deleteType({ id });
      toast.success("Event type removed");
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
    <div className="flex flex-col pb-4">
      <div className="space-y-4">
        {/* Add new type */}
        <div className="space-y-2">
          <div className="flex gap-2">
            <Input
              placeholder="New event type..."
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
          <ColorPicker value={newTypeColor} onChange={setNewTypeColor} />
        </div>

        {/* Type list */}
        <div className="space-y-2">
          {sorted.map((et, index) => (
            <div
              key={et._id}
              className={`p-2 rounded-md border ${
                et.isActive
                  ? "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
                  : "border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 opacity-60"
              }`}
            >
              <div className="flex items-center gap-2">
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

                <span
                  className={`h-3 w-3 rounded-full flex-shrink-0 ${
                    eventTypeColors[et.color]?.swatch ?? "bg-gray-400"
                  }`}
                />

                {/* Name (editable) */}
                <div className="flex-1 min-w-0">
                  {editingId === et._id ? (
                    <Input
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onBlur={() => handleRename(et._id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleRename(et._id);
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      className="h-7 text-sm"
                      autoFocus
                    />
                  ) : (
                    <button
                      onClick={() => {
                        setEditingId(et._id);
                        setEditingName(et.name);
                      }}
                      className="text-sm font-medium text-gray-900 dark:text-white hover:text-red-600 dark:hover:text-red-400 text-left truncate w-full"
                    >
                      {et.name}
                    </button>
                  )}
                </div>

                {/* Actions */}
                <button
                  onClick={() => handleToggleActive(et._id, et.isActive)}
                  className="p-1 text-gray-400 hover:text-gray-600"
                  title={et.isActive ? "Deactivate" : "Activate"}
                >
                  {et.isActive ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
                <button
                  onClick={() => handleDelete(et._id)}
                  className="p-1 text-gray-400 hover:text-red-500"
                  title="Delete"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="pl-7 pt-2">
                <ColorPicker value={et.color} onChange={(color) => handleRecolour(et._id, color)} />
              </div>
            </div>
          ))}

          {sorted.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No event types configured. Add one above.
            </p>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <ResponsiveModal
      open={open}
      onClose={() => onOpenChange(false)}
      title="Manage Event Types"
      drawerHeight="h-[80vh]"
      maxWidth="sm:max-w-sm"
    >
      {content}
    </ResponsiveModal>
  );
}
