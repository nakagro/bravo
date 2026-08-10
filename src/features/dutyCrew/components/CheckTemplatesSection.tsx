import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DeleteConfirmDialog } from "@/components/shared/DeleteConfirmDialog";
import {
  Plus,
  Pencil,
  Trash2,
  ArrowUp,
  ArrowDown,
  MoreVertical,
} from "lucide-react";
import { toast } from "sonner";
import {
  CheckTemplateFormPanel,
  type TemplateFormValue,
} from "./CheckTemplateFormPanel";

export function CheckTemplatesSection() {
  const stationChecks = useQuery(api.stationChecks.getAllStationChecks, {
    includeInactive: true,
  });
  const updateStationCheck = useMutation(api.stationChecks.updateStationCheck);
  const deleteStationCheck = useMutation(api.stationChecks.deleteStationCheck);

  const [formValue, setFormValue] = useState<TemplateFormValue | null>(null);
  const [deletingId, setDeletingId] = useState<Id<"stationChecks"> | null>(null);

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

  const areaSuggestions = Array.from(
    new Set(
      stationChecks
        .map((check) => check.area?.trim())
        .filter((area): area is string => !!area)
    )
  );

  // Group checks by area (first-seen order, following template order), with a
  // trailing "General" bucket for checks without an area - mirrors how the
  // This Week checklist displays them.
  type Check = (typeof stationChecks)[number];
  const groupedChecks = (() => {
    const named: { area?: string; items: Check[] }[] = [];
    const general: Check[] = [];
    for (const check of stationChecks) {
      const area = check.area?.trim();
      if (area) {
        const group = named.find((g) => g.area === area);
        if (group) group.items.push(check);
        else named.push({ area, items: [check] });
      } else {
        general.push(check);
      }
    }
    if (general.length > 0) {
      named.push({ area: undefined, items: general });
    }
    return named;
  })();
  const hasNamedAreas = groupedChecks.some((g) => g.area);

  const handleDelete = async (id: Id<"stationChecks">) => {
    try {
      await deleteStationCheck({ id });
      toast.success("Check template deleted");
    } catch  {
      toast.error("Failed to delete check template");
    }
  };

  // Reorder within the displayed area group by swapping global order values
  const handleReorder = async (
    groupItems: Check[],
    index: number,
    direction: "up" | "down"
  ) => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= groupItems.length) return;
    const current = groupItems[index];
    const adjacent = groupItems[targetIndex];
    try {
      await updateStationCheck({ id: current._id, order: adjacent.order });
      await updateStationCheck({ id: adjacent._id, order: current.order });
    } catch  {
      toast.error("Failed to reorder checks");
    }
  };

  const deletingCheck = stationChecks.find((c) => c._id === deletingId) ?? null;

  return (
    <div className="space-y-3">
      {stationChecks.length === 0 ? (
        <p className="text-center py-6 text-sm text-gray-500 dark:text-gray-400">
          No check templates yet. Create your first one below.
        </p>
      ) : (
        groupedChecks.map((group) => (
          <div key={group.area ?? "general"} className="space-y-2">
            {hasNamedAreas && (
              <div className="pt-1 flex items-center gap-2">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {group.area ?? "General"}
                </span>
                <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
              </div>
            )}

            <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700 overflow-hidden">
              {group.items.map((check, index) => (
                <div
                  key={check._id}
                  className={`flex items-center gap-2 pl-3 pr-1 py-1 min-h-[48px] ${
                    check.isActive ? "" : "opacity-60"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {check.name}
                      </h4>
                      {check.isPriority && (
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1.5 py-0 border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 flex-shrink-0 uppercase"
                        >
                          Priority
                        </Badge>
                      )}
                      {!check.isActive && (
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1.5 py-0 border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400 flex-shrink-0"
                        >
                          Inactive
                        </Badge>
                      )}
                    </div>
                    {check.description && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1">
                        {check.description}
                      </p>
                    )}
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-10 w-10 flex-shrink-0"
                        aria-label={`Actions for ${check.name}`}
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        disabled={index === 0}
                        onClick={() => handleReorder(group.items, index, "up")}
                      >
                        <ArrowUp className="h-4 w-4 mr-2" />
                        Move up
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={index === group.items.length - 1}
                        onClick={() => handleReorder(group.items, index, "down")}
                      >
                        <ArrowDown className="h-4 w-4 mr-2" />
                        Move down
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() =>
                          setFormValue({
                            id: check._id,
                            name: check.name,
                            description: check.description ?? "",
                            area: check.area ?? "",
                            isPriority: check.isPriority ?? false,
                            isActive: check.isActive,
                          })
                        }
                      >
                        <Pencil className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400"
                        onClick={() => setDeletingId(check._id)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {/* Create button */}
      <button
        onClick={() =>
          setFormValue({
            name: "",
            description: "",
            area: "",
            isPriority: false,
            isActive: true,
          })
        }
        className="w-full py-3 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600 hover:text-gray-700 dark:hover:text-gray-200 transition-colors active:scale-[0.98]"
      >
        <Plus className="h-4 w-4 inline mr-1" />
        New check
      </button>

      {/* Create/edit panel */}
      <CheckTemplateFormPanel
        value={formValue}
        areaSuggestions={areaSuggestions}
        onClose={() => setFormValue(null)}
      />

      {/* Delete confirmation */}
      <DeleteConfirmDialog
        title={deletingCheck ? `Delete "${deletingCheck.name}"?` : "Delete check?"}
        description="Past submission history will not be affected. Completed checks keep a snapshot of this item."
        open={!!deletingCheck}
        onOpenChange={(open) => {
          if (!open) setDeletingId(null);
        }}
        onConfirm={() => {
          if (deletingCheck) handleDelete(deletingCheck._id);
          setDeletingId(null);
        }}
      />
    </div>
  );
}
