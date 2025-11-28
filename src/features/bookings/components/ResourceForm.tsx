import { useState, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { XMarkIcon, UsersIcon, CheckIcon } from "@heroicons/react/24/outline";
import { useIsMobile } from "@/hooks/use-mobile";

interface ResourceFormProps {
  resourceId: Id<"bookingResources"> | null;
  onClose: () => void;
}

export function ResourceForm({ resourceId, onClose }: ResourceFormProps) {
  const isMobile = useIsMobile();
  
  // Fetch existing resource if editing
  const resources = useQuery(api.bookings.getBookingResources);
  const existingResource = resources?.find(r => r._id === resourceId);
  
  // Fetch all users for approver selection
  const allUsers = useQuery(api.bookings.getAllUsers);
  
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    isActive: true,
  });
  const [selectedApprovers, setSelectedApprovers] = useState<Id<"users">[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const createResource = useMutation(api.bookings.createBookingResource);
  const updateResource = useMutation(api.bookings.updateBookingResource);

  // Load existing resource data if editing
  useEffect(() => {
    if (existingResource) {
      setFormData({
        name: existingResource.name,
        description: existingResource.description || "",
        isActive: existingResource.isActive,
      });
      setSelectedApprovers(existingResource.approvers);
    }
  }, [existingResource]);

  // Format user display name
  const formatUserName = (user: any) => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName} ${user.lastName}`;
    } else if (user?.name) {
      return user.name;
    } else {
      return "Unknown User";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast.error("Please enter a resource name");
      return;
    }
    
    if (selectedApprovers.length === 0) {
      toast.error("Please select at least one approver");
      return;
    }

    setIsSubmitting(true);

    try {
      if (resourceId) {
        await updateResource({
          resourceId,
          name: formData.name.trim(),
          description: formData.description.trim() || undefined,
          isActive: formData.isActive,
          approvers: selectedApprovers,
        });
        toast.success("Resource updated successfully");
      } else {
        await createResource({
          name: formData.name.trim(),
          description: formData.description.trim() || undefined,
          approvers: selectedApprovers,
        });
        toast.success("Resource created successfully");
      }
      onClose();
    } catch (error) {
      console.error("Error saving resource:", error);
      toast.error("Failed to save resource", {
        description: error instanceof Error ? error.message : "An unexpected error occurred.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleApprover = (userId: Id<"users">) => {
    setSelectedApprovers(prev => 
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  // Form content - shared between mobile and desktop
  const formContent = (
    <form id="resource-form" onSubmit={handleSubmit} className="space-y-5">
      {/* Resource Name */}
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Resource Name *
        </label>
        <input
          id="name"
          type="text"
          value={formData.name}
          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
          placeholder="e.g., Pumper, Meeting Room, Training Facility"
          className="w-full px-4 py-3 text-base border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
        />
      </div>

      {/* Description */}
      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Description (Optional)
        </label>
        <textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
          rows={2}
          placeholder="Additional details about this resource..."
          className="w-full px-4 py-3 text-base border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
        />
      </div>

      {/* Approvers Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
          <UsersIcon className="h-4 w-4" />
          Approvers * <span className="font-normal text-gray-500">({selectedApprovers.length} selected)</span>
        </label>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
          Select users who can approve booking requests for this resource.
        </p>
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg max-h-48 overflow-y-auto">
          {allUsers?.map((user) => {
            const isSelected = selectedApprovers.includes(user._id);
            return (
              <button
                key={user._id}
                type="button"
                onClick={() => toggleApprover(user._id)}
                className={`w-full flex items-center justify-between px-4 py-3 text-left border-b border-gray-100 dark:border-gray-700 last:border-b-0 transition-colors ${
                  isSelected 
                    ? 'bg-red-50 dark:bg-red-900/20' 
                    : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                <div>
                  <div className="font-medium text-sm">{formatUserName(user)}</div>
                  {user.rank && (
                    <div className="text-xs text-gray-500 dark:text-gray-400">{user.rank}</div>
                  )}
                </div>
                {isSelected && (
                  <CheckIcon className="h-5 w-5 text-red-600 dark:text-red-400" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Status - Only show when editing */}
      {resourceId && (
        <div className="pt-2">
          <label className="flex items-center gap-3 cursor-pointer">
            <div className="relative">
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-red-300 dark:peer-focus:ring-red-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-red-600"></div>
            </div>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Resource is active (can be booked)
            </span>
          </label>
        </div>
      )}
    </form>
  );

  // Footer with action buttons
  const formFooter = (
    <div className="flex gap-3 p-4 pb-8 md:pb-4 border-t border-gray-200 dark:border-gray-700 bg-background">
      <Button type="button" variant="outline" onClick={onClose} className="flex-1 h-12 text-base">
        Cancel
      </Button>
      <Button 
        type="submit" 
        form="resource-form" 
        disabled={isSubmitting}
        className="flex-1 h-12 text-base bg-red-700 hover:bg-red-800"
      >
        {isSubmitting ? "Saving..." : (resourceId ? "Update" : "Create")} Resource
      </Button>
    </div>
  );

  // Mobile: Full-screen drawer sliding up from bottom
  if (isMobile) {
    return (
      <Drawer open onOpenChange={(open) => { if (!open) onClose(); }}>
        <DrawerContent className="h-[90vh] flex flex-col border-gray-700">
          <DrawerHeader className="flex-shrink-0 border-b border-gray-200 dark:border-gray-700 pb-4">
            <div className="flex items-center justify-between">
              <DrawerTitle className="text-xl font-bold">
                {resourceId ? 'Edit Resource' : 'Add New Resource'}
              </DrawerTitle>
              <Button variant="ghost" size="icon" onClick={onClose} className="h-10 w-10">
                <XMarkIcon className="h-6 w-6" />
              </Button>
            </div>
          </DrawerHeader>
          <div className="flex-1 overflow-y-auto px-4 pt-4">
            {formContent}
          </div>
          <DrawerFooter className="flex-shrink-0 p-0">
            {formFooter}
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    );
  }

  // Desktop: Traditional dialog
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col p-0 dark:border-gray-700">
        <DialogHeader className="flex-shrink-0 p-6 pb-4 border-b border-gray-200 dark:border-gray-700">
          <DialogTitle className="text-xl font-bold">
            {resourceId ? 'Edit Resource' : 'Add New Resource'}
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto px-6 pt-4 pb-4">
          {formContent}
        </div>
        <div className="flex-shrink-0">
          {formFooter}
        </div>
      </DialogContent>
    </Dialog>
  );
}
