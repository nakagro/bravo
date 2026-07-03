import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ResponsiveModal } from "@/components/shared/ResponsiveModal";
import { Badge } from "@/components/ui/badge";
import { Crown, UserMinus, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { getUserFullName } from "../types";

interface CrewMembersPanelProps {
  crewId: Id<"dutyCrew"> | null;
  onClose: () => void;
}

export function CrewMembersPanel({ crewId, onClose }: CrewMembersPanelProps) {
  const dutyCrews = useQuery(api.dutyCrew.getAllDutyCrews, {});
  const users = useQuery(api.users.getUsers, {});
  const updateDutyCrew = useMutation(api.dutyCrew.updateDutyCrew);
  const [selectedUserId, setSelectedUserId] = useState<string>("");

  const crew = dutyCrews?.find((c) => c._id === crewId) ?? null;

  if (!crewId) return null;

  const getUser = (userId: Id<"users">) =>
    users?.find((u: any) => u._id === userId);

  const availableUsers = (users ?? []).filter(
    (user: any) => crew && !crew.members.includes(user._id)
  );

  const addMember = async () => {
    if (!crew || !selectedUserId) return;
    try {
      await updateDutyCrew({
        id: crew._id,
        members: [...crew.members, selectedUserId as Id<"users">],
      });
      setSelectedUserId("");
      toast.success("Member added");
    } catch (error) {
      toast.error("Failed to add member");
    }
  };

  const removeMember = async (userId: Id<"users">) => {
    if (!crew) return;
    try {
      await updateDutyCrew({
        id: crew._id,
        members: crew.members.filter((id) => id !== userId),
      });
      toast.success("Member removed");
    } catch (error) {
      toast.error("Failed to remove member");
    }
  };

  const setLeader = async (userId: Id<"users">) => {
    if (!crew) return;
    try {
      await updateDutyCrew({ id: crew._id, leader: userId });
      toast.success("Leader updated");
    } catch (error) {
      toast.error("Failed to set leader");
    }
  };

  return (
    <ResponsiveModal
      open={!!crewId}
      onClose={onClose}
      title={crew ? `${crew.name} Members` : "Members"}
    >
      {!crew || !users ? (
        <div className="space-y-3 pb-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-11 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"
            />
          ))}
        </div>
      ) : (
        <div className="space-y-4 pb-4">
          {/* Add member */}
          <div className="flex items-center gap-2">
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger className="flex-1 min-h-[44px]">
                <SelectValue placeholder="Select a member to add" />
              </SelectTrigger>
              <SelectContent>
                {availableUsers.map((user: any) => (
                  <SelectItem key={user._id} value={user._id}>
                    {getUserFullName(user)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={addMember}
              disabled={!selectedUserId}
              className="min-h-[44px]"
            >
              <UserPlus className="h-4 w-4 mr-1" />
              Add
            </Button>
          </div>

          {/* Member list */}
          {crew.members.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500 italic text-center py-6">
              No members assigned yet
            </p>
          ) : (
            <div className="space-y-1">
              {crew.members.map((memberId) => {
                const user = getUser(memberId);
                const isLeader = crew.leader === memberId;
                return (
                  <div
                    key={memberId}
                    className="flex items-center justify-between gap-2 min-h-[44px] px-2 py-1 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/60"
                  >
                    <span className="flex items-center gap-1.5 text-sm text-gray-700 dark:text-gray-300 min-w-0">
                      {isLeader && (
                        <Crown className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
                      )}
                      <span className="truncate">
                        {user ? getUserFullName(user) : "Unknown User"}
                      </span>
                      {isLeader && (
                        <Badge
                          variant="outline"
                          className="text-[9px] px-1 py-0 border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 flex-shrink-0"
                        >
                          Leader
                        </Badge>
                      )}
                    </span>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {!isLeader && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-9 text-xs text-blue-600 dark:text-blue-400"
                          onClick={() => setLeader(memberId)}
                        >
                          Make Leader
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-red-500 hover:text-red-700"
                        aria-label="Remove member"
                        onClick={() => removeMember(memberId)}
                      >
                        <UserMinus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </ResponsiveModal>
  );
}
