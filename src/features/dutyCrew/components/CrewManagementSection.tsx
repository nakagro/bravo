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
  Users,
  UserPlus,
  Crown,
  ArrowUp,
  ArrowDown,
  MoreVertical,
} from "lucide-react";
import { toast } from "sonner";
import { getUserFullName, ordinalSuffix } from "../types";
import { CrewFormPanel, type CrewFormValue } from "./CrewFormPanel";
import { CrewMembersPanel } from "./CrewMembersPanel";

export function CrewManagementSection() {
  const dutyCrews = useQuery(api.dutyCrew.getAllDutyCrews, {});
  const users = useQuery(api.users.getMemberUsers, {});
  const updateDutyCrew = useMutation(api.dutyCrew.updateDutyCrew);
  const deleteDutyCrew = useMutation(api.dutyCrew.deleteDutyCrew);

  const [formValue, setFormValue] = useState<CrewFormValue | null>(null);
  const [managingMembersId, setManagingMembersId] =
    useState<Id<"dutyCrew"> | null>(null);
  const [deletingId, setDeletingId] = useState<Id<"dutyCrew"> | null>(null);

  if (!dutyCrews || !users) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-20 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"
          />
        ))}
      </div>
    );
  }

  const getLeaderName = (crew: (typeof dutyCrews)[number]) => {
    if (!crew.leader) return null;
    const leader = users.find((u: any) => u._id === crew.leader);
    return leader ? getUserFullName(leader) : null;
  };

  const handleDelete = async (id: Id<"dutyCrew">) => {
    try {
      await deleteDutyCrew({ id });
      toast.success("Duty crew deleted");
    } catch (error: any) {
      toast.error(error.message || "Failed to delete duty crew");
    }
  };

  const handleReorder = async (crewId: Id<"dutyCrew">, direction: "up" | "down") => {
    const sorted = [...dutyCrews].sort((a, b) => a.number - b.number);
    const currentIndex = sorted.findIndex((c) => c._id === crewId);
    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= sorted.length) return;
    const current = sorted[currentIndex];
    const target = sorted[targetIndex];
    try {
      await updateDutyCrew({ id: current._id, number: target.number });
      await updateDutyCrew({ id: target._id, number: current.number });
    } catch  {
      toast.error("Failed to reorder duty crews");
    }
  };

  const deletingCrew = dutyCrews.find((c) => c._id === deletingId) ?? null;

  // Members not allocated to any duty crew — the stragglers list
  const allocatedIds = new Set(dutyCrews.flatMap((crew) => crew.members));
  const unallocatedMembers = users.filter(
    (user: any) => !allocatedIds.has(user._id)
  );

  const handleAddToCrew = async (
    userId: Id<"users">,
    crew: (typeof dutyCrews)[number]
  ) => {
    try {
      await updateDutyCrew({
        id: crew._id,
        members: [...crew.members, userId],
      });
      toast.success(`Added to ${crew.name}`);
    } catch {
      toast.error("Failed to add member to crew");
    }
  };

  return (
    <div className="space-y-3">
      {/* Crew list */}
      {dutyCrews.length === 0 ? (
        <p className="text-center py-6 text-sm text-gray-500 dark:text-gray-400">
          No duty crews configured. Create one to get started.
        </p>
      ) : (
        <div className="space-y-3">
          {dutyCrews.map((crew, index) => {
            const leaderName = getLeaderName(crew);
            return (
              <div
                key={crew._id}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                        {crew.name}
                      </h4>
                      <Badge variant="outline" className="text-[10px]">
                        {ordinalSuffix(crew.number)} Sunday
                      </Badge>
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {crew.members.length} member
                        {crew.members.length !== 1 ? "s" : ""}
                      </span>
                      {leaderName && (
                        <span className="flex items-center gap-1 truncate">
                          <Crown className="h-3 w-3 text-blue-500 flex-shrink-0" />
                          {leaderName}
                        </span>
                      )}
                    </div>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-10 w-10 flex-shrink-0"
                        aria-label={`Actions for ${crew.name}`}
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        disabled={index === 0}
                        onClick={() => handleReorder(crew._id, "up")}
                      >
                        <ArrowUp className="h-4 w-4 mr-2" />
                        Move up
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={index === dutyCrews.length - 1}
                        onClick={() => handleReorder(crew._id, "down")}
                      >
                        <ArrowDown className="h-4 w-4 mr-2" />
                        Move down
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() =>
                          setFormValue({
                            id: crew._id,
                            name: crew.name,
                            number: crew.number,
                          })
                        }
                      >
                        <Pencil className="h-4 w-4 mr-2" />
                        Rename
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400"
                        onClick={() => setDeletingId(crew._id)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <Button
                  variant="outline"
                  className="w-full mt-3 min-h-[44px]"
                  onClick={() => setManagingMembersId(crew._id)}
                >
                  <Users className="h-4 w-4 mr-2" />
                  Manage members
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {/* Create button */}
      <button
        onClick={() => setFormValue({ name: "", number: dutyCrews.length + 1 })}
        className="w-full py-3 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600 hover:text-gray-700 dark:hover:text-gray-200 transition-colors active:scale-[0.98]"
      >
        <Plus className="h-4 w-4 inline mr-1" />
        New duty crew
      </button>

      {/* Members without a crew */}
      {unallocatedMembers.length > 0 && (
        <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 overflow-hidden">
          <div className="px-3 py-2 border-b border-amber-200 dark:border-amber-800 bg-amber-100/50 dark:bg-amber-900/20 flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <h4 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
              Not in a duty crew
            </h4>
            <span className="ml-auto text-xs font-medium text-amber-700 dark:text-amber-400 tabular-nums">
              {unallocatedMembers.length}
            </span>
          </div>
          <div className="divide-y divide-amber-100 dark:divide-amber-900/40">
            {unallocatedMembers.map((user: any) => (
              <div
                key={user._id}
                className="flex items-center gap-2 pl-3 pr-1 py-1 min-h-[48px]"
              >
                <span className="flex-1 min-w-0 text-sm text-gray-800 dark:text-gray-200 truncate">
                  {getUserFullName(user)}
                </span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-10 px-3 text-xs text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40"
                    >
                      <UserPlus className="h-3.5 w-3.5 mr-1" />
                      Add to crew
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {dutyCrews.map((crew) => (
                      <DropdownMenuItem
                        key={crew._id}
                        onClick={() => handleAddToCrew(user._id, crew)}
                      >
                        {crew.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create/rename panel */}
      <CrewFormPanel value={formValue} onClose={() => setFormValue(null)} />

      {/* Members panel */}
      <CrewMembersPanel
        crewId={managingMembersId}
        onClose={() => setManagingMembersId(null)}
      />

      {/* Delete confirmation */}
      <DeleteConfirmDialog
        title={deletingCrew ? `Delete ${deletingCrew.name}?` : "Delete crew?"}
        description="This permanently removes the crew and its member assignments. Crews used in schedule overrides cannot be deleted."
        open={!!deletingCrew}
        onOpenChange={(open) => {
          if (!open) setDeletingId(null);
        }}
        onConfirm={() => {
          if (deletingCrew) handleDelete(deletingCrew._id);
          setDeletingId(null);
        }}
      />
    </div>
  );
}
