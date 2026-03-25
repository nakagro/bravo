import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2, UserPlus, UserMinus, Crown, ArrowUp, ArrowDown } from "lucide-react";
import { toast } from "sonner";
import { getUserFullName } from "../types";

export function CrewManagementSection() {
  const dutyCrews = useQuery(api.dutyCrew.getAllDutyCrews, {});
  const users = useQuery(api.users.getUsers, {});
  const createDutyCrew = useMutation(api.dutyCrew.createDutyCrew);
  const updateDutyCrew = useMutation(api.dutyCrew.updateDutyCrew);
  const deleteDutyCrew = useMutation(api.dutyCrew.deleteDutyCrew);

  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<Id<"dutyCrew"> | null>(null);
  const [newName, setNewName] = useState("");
  const [newNumber, setNewNumber] = useState<number>(1);
  const [managingMembersId, setManagingMembersId] = useState<Id<"dutyCrew"> | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string>("");

  if (!dutyCrews || !users) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  const getUserName = (userId: Id<"users">) => {
    const user = users.find((u: any) => u._id === userId);
    return user ? getUserFullName(user) : "Unknown User";
  };

  const handleCreate = async () => {
    if (!newName) return;
    try {
      await createDutyCrew({ name: newName, number: newNumber, members: [] });
      setNewName("");
      setNewNumber(1);
      setIsCreating(false);
      toast.success("Duty crew created");
    } catch (error: any) {
      toast.error(error.message || "Failed to create duty crew");
    }
  };

  const handleUpdate = async (id: Id<"dutyCrew">) => {
    if (!newName) return;
    try {
      await updateDutyCrew({ id, name: newName });
      setNewName("");
      setEditingId(null);
      toast.success("Duty crew updated");
    } catch (error) {
      toast.error("Failed to update duty crew");
    }
  };

  const handleDelete = async (id: Id<"dutyCrew">) => {
    if (!confirm("Are you sure you want to delete this duty crew?")) return;
    try {
      await deleteDutyCrew({ id });
      toast.success("Duty crew deleted");
    } catch (error: any) {
      toast.error(error.message || "Failed to delete duty crew");
    }
  };

  const addMember = async (dutyCrewId: Id<"dutyCrew">, userId: Id<"users">) => {
    const crew = dutyCrews.find((c) => c._id === dutyCrewId);
    if (!crew || crew.members.includes(userId)) return;
    try {
      await updateDutyCrew({ id: dutyCrewId, members: [...crew.members, userId] });
      setSelectedUserId("");
      toast.success("Member added");
    } catch (error) {
      toast.error("Failed to add member");
    }
  };

  const removeMember = async (dutyCrewId: Id<"dutyCrew">, userId: Id<"users">) => {
    const crew = dutyCrews.find((c) => c._id === dutyCrewId);
    if (!crew) return;
    try {
      await updateDutyCrew({ id: dutyCrewId, members: crew.members.filter((id) => id !== userId) });
      toast.success("Member removed");
    } catch (error) {
      toast.error("Failed to remove member");
    }
  };

  const setLeader = async (dutyCrewId: Id<"dutyCrew">, userId: Id<"users">) => {
    try {
      await updateDutyCrew({ id: dutyCrewId, leader: userId });
      toast.success("Leader updated");
    } catch (error) {
      toast.error("Failed to set leader");
    }
  };

  const handleReorder = async (crewId: Id<"dutyCrew">, direction: "up" | "down") => {
    if (!dutyCrews) return;
    const sorted = [...dutyCrews].sort((a, b) => a.number - b.number);
    const currentIndex = sorted.findIndex((c) => c._id === crewId);
    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= sorted.length) return;
    const current = sorted[currentIndex];
    const target = sorted[targetIndex];
    try {
      await updateDutyCrew({ id: current._id, number: target.number });
      await updateDutyCrew({ id: target._id, number: current.number });
    } catch (error) {
      toast.error("Failed to reorder duty crews");
    }
  };

  const ordinalSuffix = (n: number) =>
    n === 1 ? "1st" : n === 2 ? "2nd" : n === 3 ? "3rd" : `${n}th`;

  return (
    <div className="space-y-4">
      {/* Create button */}
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setIsCreating(true)} disabled={isCreating}>
          <Plus className="h-4 w-4 mr-1" />
          New Duty Crew
        </Button>
      </div>

      {/* Create form */}
      {isCreating && (
        <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Crew Name</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g., Duty Crew 1"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Sunday Number (1-4)</Label>
              <Select value={newNumber.toString()} onValueChange={(v) => setNewNumber(parseInt(v))}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4].map((n) => (
                    <SelectItem key={n} value={n.toString()}>
                      {ordinalSuffix(n)} Sunday
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => { setIsCreating(false); setNewName(""); }}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleCreate} disabled={!newName}>
              Create
            </Button>
          </div>
        </div>
      )}

      {/* Crew list */}
      {dutyCrews.length === 0 ? (
        <p className="text-center py-6 text-sm text-gray-500 dark:text-gray-400">
          No duty crews configured. Create one to get started.
        </p>
      ) : (
        <div className="space-y-4">
          {dutyCrews.map((crew) => (
            <div
              key={crew._id}
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4"
            >
              {editingId === crew._id ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="flex-1"
                  />
                  <Button size="sm" onClick={() => handleUpdate(crew._id)} disabled={!newName}>
                    Save
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setEditingId(null)}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                          {crew.name}
                        </h4>
                        <Badge variant="outline" className="text-[10px]">
                          {ordinalSuffix(crew.number)} Sunday
                        </Badge>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleReorder(crew._id, "up")}
                        disabled={dutyCrews.indexOf(crew) === 0}
                        title="Move up"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleReorder(crew._id, "down")}
                        disabled={dutyCrews.indexOf(crew) === dutyCrews.length - 1}
                        title="Move down"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </Button>
                      {managingMembersId !== crew._id && (
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => setManagingMembersId(crew._id)}
                          title="Manage members"
                        >
                          <UserPlus className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => {
                          setEditingId(crew._id);
                          setNewName(crew.name);
                        }}
                        title="Edit"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="destructive"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleDelete(crew._id)}
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Members list */}
                  <div className="mt-3">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                      Members ({crew.members.length})
                    </p>
                    {crew.members.length === 0 ? (
                      <p className="text-xs text-gray-400 dark:text-gray-500 italic">
                        No members assigned
                      </p>
                    ) : (
                      <div className="space-y-1">
                        {crew.members.map((memberId) => (
                          <div
                            key={memberId}
                            className="flex items-center justify-between text-sm py-1"
                          >
                            <span className="flex items-center gap-1.5 text-gray-700 dark:text-gray-300">
                              {crew.leader === memberId && (
                                <Crown className="h-3 w-3 text-blue-500" />
                              )}
                              {getUserName(memberId)}
                              {crew.leader === memberId && (
                                <Badge
                                  variant="outline"
                                  className="text-[9px] px-1 py-0 border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400"
                                >
                                  Leader
                                </Badge>
                              )}
                            </span>
                            <div className="flex items-center gap-1">
                              {crew.leader !== memberId && (
                                <button
                                  onClick={() => setLeader(crew._id, memberId)}
                                  className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline"
                                >
                                  Make Leader
                                </button>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-red-500 hover:text-red-700"
                                onClick={() => removeMember(crew._id, memberId)}
                              >
                                <UserMinus className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Add member */}
                  {managingMembersId === crew._id && (
                    <div className="mt-3 flex items-center gap-2">
                      <Select
                        value={selectedUserId}
                        onValueChange={setSelectedUserId}
                      >
                        <SelectTrigger className="flex-1 h-8 text-sm">
                          <SelectValue placeholder="Select a member to add" />
                        </SelectTrigger>
                        <SelectContent>
                          {users
                            .filter((user: any) => !crew.members.includes(user._id))
                            .map((user: any) => (
                              <SelectItem key={user._id} value={user._id}>
                                {getUserFullName(user)}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        className="h-8"
                        onClick={() => {
                          if (selectedUserId) addMember(crew._id, selectedUserId as Id<"users">);
                        }}
                        disabled={!selectedUserId}
                      >
                        Add
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8"
                        onClick={() => setManagingMembersId(null)}
                      >
                        Done
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
