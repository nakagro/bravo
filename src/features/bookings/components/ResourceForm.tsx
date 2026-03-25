import { useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { ResponsiveModal } from "../../../components/shared/ResponsiveModal";
import { formatUserName } from "../types";
import { UsersIcon, CheckIcon, LockClosedIcon, LockOpenIcon } from "@heroicons/react/24/outline";

const resourceSchema = z.object({
  name: z.string().min(1, "Resource name is required"),
  description: z.string(),
  isActive: z.boolean(),
  approverOnly: z.boolean(),
  approvers: z.array(z.string()).min(1, "Select at least one approver"),
});

type ResourceFormValues = z.infer<typeof resourceSchema>;

interface ResourceFormProps {
  resourceId: Id<"bookingResources"> | null;
  onClose: () => void;
}

export function ResourceForm({ resourceId, onClose }: ResourceFormProps) {
  const resources = useQuery(api.bookings.getBookingResources);
  const existingResource = resources?.find((r) => r._id === resourceId);
  const allUsers = useQuery(api.bookings.getAllUsers);

  const createResource = useMutation(api.bookings.createBookingResource);
  const updateResource = useMutation(api.bookings.updateBookingResource);

  const form = useForm<ResourceFormValues>({
    resolver: zodResolver(resourceSchema),
    defaultValues: {
      name: "",
      description: "",
      isActive: true,
      approverOnly: false,
      approvers: [],
    },
  });

  const { isSubmitting } = form.formState;
  const selectedApprovers = form.watch("approvers");

  // Load existing resource data when editing
  useEffect(() => {
    if (existingResource) {
      form.reset({
        name: existingResource.name,
        description: existingResource.description || "",
        isActive: existingResource.isActive,
        approverOnly: existingResource.approverOnly || false,
        approvers: existingResource.approvers as string[],
      });
    }
  }, [existingResource, form]);

  const toggleApprover = (userId: string) => {
    const current = form.getValues("approvers");
    form.setValue(
      "approvers",
      current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId],
      { shouldValidate: true }
    );
  };

  const onSubmit = async (values: ResourceFormValues) => {
    try {
      if (resourceId) {
        await updateResource({
          resourceId,
          name: values.name.trim(),
          description: values.description.trim() || undefined,
          isActive: values.isActive,
          approvers: values.approvers as Id<"users">[],
          approverOnly: values.approverOnly,
        });
        toast.success("Resource updated successfully");
      } else {
        await createResource({
          name: values.name.trim(),
          description: values.description.trim() || undefined,
          approvers: values.approvers as Id<"users">[],
          approverOnly: values.approverOnly,
        });
        toast.success("Resource created successfully");
      }
      onClose();
    } catch (error) {
      console.error("Error saving resource:", error);
      toast.error("Failed to save resource", {
        description: error instanceof Error ? error.message : "An unexpected error occurred.",
      });
    }
  };

  const formContent = (
    <Form {...form}>
      <form id="resource-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        {/* Resource Name */}
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Resource Name *
              </FormLabel>
              <FormControl>
                <input
                  {...field}
                  type="text"
                  placeholder="e.g., Pumper, Meeting Room, Training Facility"
                  className="w-full px-4 py-3 text-base border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Description */}
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Description (Optional)
              </FormLabel>
              <FormControl>
                <textarea
                  {...field}
                  rows={2}
                  placeholder="Additional details about this resource..."
                  className="w-full px-4 py-3 text-base border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Approvers Selection */}
        <FormField
          control={form.control}
          name="approvers"
          render={() => (
            <FormItem>
              <FormLabel className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                <UsersIcon className="h-4 w-4" />
                Approvers *{" "}
                <span className="font-normal text-gray-500">
                  ({selectedApprovers.length} selected)
                </span>
              </FormLabel>
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
                          ? "bg-red-50 dark:bg-red-900/20"
                          : "hover:bg-gray-50 dark:hover:bg-gray-800"
                      }`}
                    >
                      <div>
                        <div className="font-medium text-sm">{formatUserName(user)}</div>
                        {user.rank && (
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {user.rank}
                          </div>
                        )}
                      </div>
                      {isSelected && (
                        <CheckIcon className="h-5 w-5 text-red-600 dark:text-red-400" />
                      )}
                    </button>
                  );
                })}
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Booking Permissions */}
        <FormField
          control={form.control}
          name="approverOnly"
          render={({ field }) => (
            <FormItem className="pt-2 border-t border-gray-100 dark:border-gray-700">
              <FormLabel className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                {field.value ? (
                  <LockClosedIcon className="h-4 w-4 text-amber-500" />
                ) : (
                  <LockOpenIcon className="h-4 w-4 text-green-500" />
                )}
                Booking Permissions
              </FormLabel>
              <div className="space-y-2">
                <label
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    !field.value
                      ? "border-green-500 bg-green-50 dark:bg-green-900/20"
                      : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
                  }`}
                >
                  <input
                    type="radio"
                    name="approverOnly"
                    checked={!field.value}
                    onChange={() => field.onChange(false)}
                    className="sr-only"
                  />
                  <div className="flex-1">
                    <div className="font-medium text-sm flex items-center gap-2">
                      <LockOpenIcon className="h-4 w-4" />
                      Open Booking
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      Anyone can request a booking. Approvers will review and approve/reject
                      requests.
                    </p>
                  </div>
                  {!field.value && (
                    <CheckIcon className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0" />
                  )}
                </label>

                <label
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    field.value
                      ? "border-amber-500 bg-amber-50 dark:bg-amber-900/20"
                      : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
                  }`}
                >
                  <input
                    type="radio"
                    name="approverOnly"
                    checked={field.value}
                    onChange={() => field.onChange(true)}
                    className="sr-only"
                  />
                  <div className="flex-1">
                    <div className="font-medium text-sm flex items-center gap-2">
                      <LockClosedIcon className="h-4 w-4" />
                      Approver Only
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      Only designated approvers can create bookings. No approval process needed.
                    </p>
                  </div>
                  {field.value && (
                    <CheckIcon className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                  )}
                </label>
              </div>
            </FormItem>
          )}
        />

        {/* Active Status - Only show when editing */}
        {resourceId && (
          <FormField
            control={form.control}
            name="isActive"
            render={({ field }) => (
              <FormItem className="pt-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={field.value}
                      onChange={field.onChange}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-red-300 dark:peer-focus:ring-red-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-red-600" />
                  </div>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Resource is active (can be booked)
                  </span>
                </label>
              </FormItem>
            )}
          />
        )}
      </form>
    </Form>
  );

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
        {isSubmitting ? "Saving..." : resourceId ? "Update Resource" : "Create Resource"}
      </Button>
    </div>
  );

  return (
    <ResponsiveModal
      open
      onClose={onClose}
      title={resourceId ? "Edit Resource" : "Add New Resource"}
      footer={formFooter}
    >
      {formContent}
    </ResponsiveModal>
  );
}
