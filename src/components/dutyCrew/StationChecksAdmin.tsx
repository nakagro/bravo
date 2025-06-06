import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { 
  PencilIcon, 
  TrashIcon, 
  PlusIcon, 
  ArrowUpIcon, 
  ArrowDownIcon,
  ClipboardDocumentCheckIcon
} from "@heroicons/react/24/outline";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Switch } from "../ui/switch";
import { Label } from "../ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../ui/card";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";

export function StationChecksAdmin() {
  const stationChecks = useQuery(api.stationChecks.getAllStationChecks, { includeInactive: true });
  const createStationCheck = useMutation(api.stationChecks.createStationCheck);
  const updateStationCheck = useMutation(api.stationChecks.updateStationCheck);
  const deleteStationCheck = useMutation(api.stationChecks.deleteStationCheck);
  
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<Id<"stationChecks"> | null>(null);
  
  // Form state
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
  
  const handleCreateCheck = async () => {
    if (!name) return;
    
    try {
      await createStationCheck({
        name,
        description: description || undefined,
        isActive,
      });
      
      resetForm();
    } catch (error) {
      console.error("Error creating station check:", error);
    }
  };
  
  const handleUpdateCheck = async (id: Id<"stationChecks">) => {
    if (!name) return;
    
    try {
      await updateStationCheck({
        id,
        name,
        description: description || undefined,
        isActive,
      });
      
      resetForm();
    } catch (error) {
      console.error("Error updating station check:", error);
    }
  };
  
  const handleDeleteCheck = async (id: Id<"stationChecks">) => {
    if (!confirm("Are you sure you want to delete this station check?")) return;
    
    try {
      const result = await deleteStationCheck({ id });
      
      if (!result) {
        alert("This check is used in submissions and cannot be deleted. It has been marked as inactive instead.");
      }
    } catch (error) {
      console.error("Error deleting station check:", error);
    }
  };
  
  const startEditing = (check: any) => {
    setEditingId(check._id);
    setName(check.name);
    setDescription(check.description || "");
    setIsActive(check.isActive);
  };
  
  const handleReorderCheck = async (id: Id<"stationChecks">, direction: "up" | "down") => {
    if (!stationChecks || stationChecks.length < 2) return;
    
    const currentIndex = stationChecks.findIndex(check => check._id === id);
    if (currentIndex === -1) return;
    
    const adjacentIndex = direction === "up" 
      ? Math.max(0, currentIndex - 1) 
      : Math.min(stationChecks.length - 1, currentIndex + 1);
    
    if (currentIndex === adjacentIndex) return;
    
    const currentCheck = stationChecks[currentIndex];
    const adjacentCheck = stationChecks[adjacentIndex];
    
    try {
      // Swap orders
      await updateStationCheck({
        id: currentCheck._id,
        order: adjacentCheck.order,
      });
      
      await updateStationCheck({
        id: adjacentCheck._id,
        order: currentCheck.order,
      });
    } catch (error) {
      console.error("Error reordering station checks:", error);
    }
  };
  
  if (!stationChecks) {
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
  
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="text-xl font-bold flex items-center">
            <ClipboardDocumentCheckIcon className="h-5 w-5 mr-2" />
            Station Checks Administration
          </CardTitle>
          <CardDescription>
            Manage the station checks checklist items
          </CardDescription>
        </div>
        <Button
          onClick={() => setIsCreating(true)}
          className="flex items-center"
          size="sm"
        >
          <PlusIcon className="h-4 w-4 mr-1" />
          New Check
        </Button>
      </CardHeader>
      
      <CardContent>
        {isCreating && (
          <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg mb-6 border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              Add New Station Check
            </h3>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="new-check-name">Check Name</Label>
                <Input
                  id="new-check-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Clean multipurpose room"
                  className="mt-1"
                />
              </div>
              
              <div>
                <Label htmlFor="new-check-description">Description (Optional)</Label>
                <Textarea
                  id="new-check-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Add any detailed instructions or notes about this check..."
                  className="mt-1 resize-none h-20"
                />
              </div>
              
              <div className="flex items-center">
                <Switch
                  id="new-check-active"
                  checked={isActive}
                  onCheckedChange={setIsActive}
                />
                <Label htmlFor="new-check-active" className="ml-2">
                  Active
                </Label>
              </div>
              
              <div className="flex justify-end space-x-2 pt-2">
                <Button
                  variant="outline"
                  onClick={resetForm}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateCheck}
                  disabled={!name}
                >
                  Create
                </Button>
              </div>
            </div>
          </div>
        )}
        
        {stationChecks.length === 0 ? (
          <Alert>
            <AlertTitle>No station checks found</AlertTitle>
            <AlertDescription>
              Create your first station check to get started.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-4">
            {stationChecks.map((check) => (
              <div 
                key={check._id} 
                className={`p-4 rounded-lg border ${
                  check.isActive 
                    ? 'border-gray-200 dark:border-gray-700' 
                    : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50'
                }`}
              >
                {editingId === check._id ? (
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor={`edit-check-name-${check._id}`}>Check Name</Label>
                      <Input
                        id={`edit-check-name-${check._id}`}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor={`edit-check-description-${check._id}`}>Description (Optional)</Label>
                      <Textarea
                        id={`edit-check-description-${check._id}`}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="mt-1 resize-none h-20"
                      />
                    </div>
                    
                    <div className="flex items-center">
                      <Switch
                        id={`edit-check-active-${check._id}`}
                        checked={isActive}
                        onCheckedChange={setIsActive}
                      />
                      <Label htmlFor={`edit-check-active-${check._id}`} className="ml-2">
                        Active
                      </Label>
                    </div>
                    
                    <div className="flex justify-end space-x-2 pt-2">
                      <Button
                        variant="outline"
                        onClick={resetForm}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={() => handleUpdateCheck(check._id)}
                        disabled={!name}
                      >
                        Save
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className={`text-md font-medium ${
                        check.isActive 
                          ? 'text-gray-900 dark:text-white' 
                          : 'text-gray-500 dark:text-gray-400'
                      }`}>
                        {check.name}
                        {!check.isActive && (
                          <span className="ml-2 px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full">
                            Inactive
                          </span>
                        )}
                      </h4>
                      
                      {check.description && (
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                          {check.description}
                        </p>
                      )}
                    </div>
                    
                    <div className="flex space-x-1">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleReorderCheck(check._id, "up")}
                        title="Move up"
                        className="h-8 w-8"
                      >
                        <ArrowUpIcon className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleReorderCheck(check._id, "down")}
                        title="Move down"
                        className="h-8 w-8"
                      >
                        <ArrowDownIcon className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => startEditing(check)}
                        title="Edit check"
                        className="h-8 w-8"
                      >
                        <PencilIcon className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="destructive"
                        size="icon"
                        onClick={() => handleDeleteCheck(check._id)}
                        title="Delete check"
                        className="h-8 w-8"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
