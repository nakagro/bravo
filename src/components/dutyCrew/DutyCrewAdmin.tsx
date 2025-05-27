import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { PencilIcon, TrashIcon, PlusIcon, UserPlusIcon, UserMinusIcon } from "@heroicons/react/24/outline";

export function DutyCrewAdmin() {
  const dutyCrews = useQuery(api.dutyCrew.getAllDutyCrews, {});
  const users = useQuery(api.users.getUsers, {});
  
  const createDutyCrew = useMutation(api.dutyCrew.createDutyCrew);
  const updateDutyCrew = useMutation(api.dutyCrew.updateDutyCrew);
  const deleteDutyCrew = useMutation(api.dutyCrew.deleteDutyCrew);
  
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<Id<"dutyCrew"> | null>(null);
  const [newDutyCrewName, setNewDutyCrewName] = useState("");
  const [newDutyCrewNumber, setNewDutyCrewNumber] = useState<number>(1);
  
  // For member management
  const [managingMembersId, setManagingMembersId] = useState<Id<"dutyCrew"> | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<Id<"users"> | "">("");
  
  if (!dutyCrews || !users) {
    return (
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-4">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-4"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full mb-2"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full mb-2"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
        </div>
      </div>
    );
  }
  
  const handleCreateDutyCrew = async () => {
    if (!newDutyCrewName || newDutyCrewNumber < 1 || newDutyCrewNumber > 4) return;
    
    try {
      await createDutyCrew({
        name: newDutyCrewName,
        number: newDutyCrewNumber,
        members: [],
      });
      
      setNewDutyCrewName("");
      setNewDutyCrewNumber(1);
      setIsCreating(false);
    } catch (error) {
      console.error("Error creating duty crew:", error);
    }
  };
  
  const handleUpdateDutyCrew = async (id: Id<"dutyCrew">) => {
    if (!newDutyCrewName) return;
    
    try {
      await updateDutyCrew({
        id,
        name: newDutyCrewName,
      });
      
      setNewDutyCrewName("");
      setEditingId(null);
    } catch (error) {
      console.error("Error updating duty crew:", error);
    }
  };
  
  const handleDeleteDutyCrew = async (id: Id<"dutyCrew">) => {
    if (!confirm("Are you sure you want to delete this duty crew?")) return;
    
    try {
      await deleteDutyCrew({ id });
    } catch (error) {
      console.error("Error deleting duty crew:", error);
    }
  };
  
  const startEditing = (dutyCrew: any) => {
    setEditingId(dutyCrew._id);
    setNewDutyCrewName(dutyCrew.name);
  };
  
  const startManagingMembers = (dutyCrew: any) => {
    setManagingMembersId(dutyCrew._id);
  };
  
  const addMemberToCrew = async (dutyCrewId: Id<"dutyCrew">, userId: Id<"users">) => {
    const dutyCrew = dutyCrews.find(crew => crew._id === dutyCrewId);
    if (!dutyCrew) return;
    
    // Check if user is already a member
    if (dutyCrew.members.includes(userId)) return;
    
    try {
      await updateDutyCrew({
        id: dutyCrewId,
        members: [...dutyCrew.members, userId],
      });
      
      setSelectedUserId("");
    } catch (error) {
      console.error("Error adding member to duty crew:", error);
    }
  };
  
  const removeMemberFromCrew = async (dutyCrewId: Id<"dutyCrew">, userId: Id<"users">) => {
    const dutyCrew = dutyCrews.find(crew => crew._id === dutyCrewId);
    if (!dutyCrew) return;
    
    try {
      await updateDutyCrew({
        id: dutyCrewId,
        members: dutyCrew.members.filter(id => id !== userId),
      });
    } catch (error) {
      console.error("Error removing member from duty crew:", error);
    }
  };
  
  const setCrewLeader = async (dutyCrewId: Id<"dutyCrew">, userId: Id<"users">) => {
    try {
      await updateDutyCrew({
        id: dutyCrewId,
        leader: userId,
      });
    } catch (error) {
      console.error("Error setting crew leader:", error);
    }
  };
  
  // Get user name by ID
  const getUserName = (userId: Id<"users">) => {
    const user = users.find((u: any) => u._id === userId);
    return user ? (user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.name || user.email) : "Unknown User";
  };
  
  return (
    <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
      <div className="px-4 py-5 sm:px-6 border-b border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">
            Duty Crew Administration
          </h3>
          <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
            Manage duty crews and their members
          </p>
        </div>
        <button
          onClick={() => setIsCreating(true)}
          className="inline-flex items-center justify-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 w-full sm:w-auto"
        >
          <PlusIcon className="h-4 w-4 mr-1" />
          New Duty Crew
        </button>
      </div>
      
      {isCreating && (
        <div className="px-4 py-5 sm:p-6 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700">
          <h4 className="text-md font-medium text-gray-900 dark:text-white mb-3">Create New Duty Crew</h4>
          <div className="grid grid-cols-1 gap-y-4 sm:grid-cols-2 lg:grid-cols-3 sm:gap-x-4">
            <div>
              <label htmlFor="new-crew-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Duty Crew Name
              </label>
              <input
                type="text"
                id="new-crew-name"
                value={newDutyCrewName}
                onChange={(e) => setNewDutyCrewName(e.target.value)}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                placeholder="e.g., Duty Crew 1"
              />
            </div>
            <div>
              <label htmlFor="new-crew-number" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Duty Crew Number (1-4)
              </label>
              <select
                id="new-crew-number"
                value={newDutyCrewNumber}
                onChange={(e) => setNewDutyCrewNumber(parseInt(e.target.value))}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-white"
              >
                <option value={1}>1 - First Sunday</option>
                <option value={2}>2 - Second Sunday</option>
                <option value={3}>3 - Third Sunday</option>
                <option value={4}>4 - Fourth Sunday</option>
              </select>
            </div>
            <div className="flex items-end space-x-3 col-span-1 sm:col-span-2 lg:col-span-1">
              <button
                onClick={handleCreateDutyCrew}
                className="flex-1 inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Create
              </button>
              <button
                onClick={() => setIsCreating(false)}
                className="flex-1 inline-flex items-center justify-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      
      <div className="px-4 py-5 sm:p-6">
        {dutyCrews.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-center py-4">
            No duty crews found. Create one to get started.
          </p>
        ) : (
          <div className="space-y-6">
            {dutyCrews.map((dutyCrew) => (
              <div key={dutyCrew._id} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                {editingId === dutyCrew._id ? (
                  <div className="flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-4">
                    <input
                      type="text"
                      value={newDutyCrewName}
                      onChange={(e) => setNewDutyCrewName(e.target.value)}
                      className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                    />
                    <div className="flex space-x-2 w-full sm:w-auto">
                      <button
                        onClick={() => handleUpdateDutyCrew(dutyCrew._id)}
                        className="flex-1 sm:flex-none inline-flex items-center justify-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="flex-1 sm:flex-none inline-flex items-center justify-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-700"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
                    <div>
                      <h4 className="text-lg font-medium text-gray-900 dark:text-white flex flex-wrap items-center gap-2">
                        {dutyCrew.name}
                        <span className="px-2 py-0.5 text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full">
                          {dutyCrew.number === 1 ? "1st" : 
                           dutyCrew.number === 2 ? "2nd" : 
                           dutyCrew.number === 3 ? "3rd" : "4th"} Sunday
                        </span>
                      </h4>
                      
                      {/* Members section */}
                      <div className="mt-2">
                        <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Members:</h5>
                        {dutyCrew.members.length === 0 ? (
                          <p className="text-sm text-gray-500 dark:text-gray-400">No members assigned</p>
                        ) : (
                          <ul className="space-y-1">
                            {dutyCrew.members.map((memberId) => (
                              <li key={memberId} className="text-sm text-gray-600 dark:text-gray-300 flex items-center justify-between">
                                <span className="flex items-center">
                                  {dutyCrew.leader === memberId && (
                                    <span className="mr-1 px-1.5 py-0.5 text-xs bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 rounded-full">
                                      Leader
                                    </span>
                                  )}
                                  {getUserName(memberId)}
                                </span>
                                <div className="flex space-x-2">
                                  {dutyCrew.leader !== memberId && (
                                    <button
                                      onClick={() => setCrewLeader(dutyCrew._id, memberId)}
                                      className="text-xs text-yellow-600 dark:text-yellow-400 hover:text-yellow-800 dark:hover:text-yellow-300"
                                      title="Set as leader"
                                    >
                                      Make Leader
                                    </button>
                                  )}
                                  <button
                                    onClick={() => removeMemberFromCrew(dutyCrew._id, memberId)}
                                    className="text-xs text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
                                    title="Remove member"
                                  >
                                    <UserMinusIcon className="h-4 w-4" />
                                  </button>
                                </div>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                      
                      {/* Add member section */}
                      {managingMembersId === dutyCrew._id && (
                        <div className="mt-3 flex flex-col sm:flex-row items-start sm:items-center gap-2">
                          <select
                            value={selectedUserId}
                            onChange={(e) => setSelectedUserId(e.target.value as Id<"users">)}
                            className="block w-full border border-gray-300 rounded-md shadow-sm py-1 px-2 text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                          >
                            <option value="">Select a member to add</option>
                            {users
                              .filter((user: any) => !dutyCrew.members.includes(user._id))
                              .map((user: any) => (
                                <option key={user._id} value={user._id}>
                                  {user.firstName && user.lastName 
                                    ? `${user.firstName} ${user.lastName}` 
                                    : user.name || user.email}
                                </option>
                              ))}
                          </select>
                          <div className="flex space-x-2 w-full sm:w-auto">
                            <button
                              onClick={() => {
                                if (selectedUserId) {
                                  addMemberToCrew(dutyCrew._id, selectedUserId as Id<"users">);
                                }
                              }}
                              disabled={!selectedUserId}
                              className="flex-1 sm:flex-none inline-flex items-center justify-center px-2 py-1 border border-transparent text-sm leading-4 font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
                            >
                              <UserPlusIcon className="h-4 w-4 sm:mr-1" />
                              <span className="hidden sm:inline">Add</span>
                            </button>
                            <button
                              onClick={() => setManagingMembersId(null)}
                              className="flex-1 sm:flex-none inline-flex items-center justify-center px-2 py-1 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-700"
                            >
                              Done
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex space-x-2 self-start">
                      {managingMembersId !== dutyCrew._id && (
                        <button
                          onClick={() => startManagingMembers(dutyCrew)}
                          className="inline-flex items-center px-2 py-1 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-700"
                          title="Manage members"
                        >
                          <UserPlusIcon className="h-4 w-4 sm:mr-1" />
                          <span className="hidden sm:inline">Members</span>
                        </button>
                      )}
                      <button
                        onClick={() => startEditing(dutyCrew)}
                        className="inline-flex items-center px-2 py-1 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-700"
                        title="Edit duty crew"
                      >
                        <PencilIcon className="h-4 w-4 sm:mr-1" />
                        <span className="hidden sm:inline">Edit</span>
                      </button>
                      <button
                        onClick={() => handleDeleteDutyCrew(dutyCrew._id)}
                        className="inline-flex items-center px-2 py-1 border border-transparent text-sm leading-4 font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                        title="Delete duty crew"
                      >
                        <TrashIcon className="h-4 w-4 sm:mr-1" />
                        <span className="hidden sm:inline">Delete</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
