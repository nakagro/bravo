import { useState, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ResponsiveModal } from "@/components/shared/ResponsiveModal";
import { DeleteConfirmDialog } from "@/components/shared/DeleteConfirmDialog";
import { useDirtyDraftGuard } from "@/hooks/useDirtyDraftGuard";
import { LoaderCircle, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export interface TemplateFormValue {
  id?: Id<"stationChecks">;
  name: string;
  description: string;
  area: string;
  subItems: string[];
  isPriority: boolean;
  isActive: boolean;
  linkedApplianceTemplateId?: Id<"applianceTemplates">;
}

/** Sentinel for the "no link" option - Radix Select can't hold an empty value. */
const NO_LINK = "none";

interface CheckTemplateFormPanelProps {
  /** null = closed; id undefined = create, id set = edit */
  value: TemplateFormValue | null;
  /** Distinct areas already in use, shown as tappable suggestion chips */
  areaSuggestions: string[];
  onClose: () => void;
}

export function CheckTemplateFormPanel({
  value,
  areaSuggestions,
  onClose,
}: CheckTemplateFormPanelProps) {
  const createStationCheck = useMutation(api.stationChecks.createStationCheck);
  const updateStationCheck = useMutation(api.stationChecks.updateStationCheck);
  // Active *and* inactive: the active-only default would blank the select when
  // editing a check whose appliance is currently off the run, hiding the
  // existing link exactly when the admin needs to see it. This query is gated
  // on being signed in, so a duty crew admin who isn't an inventory admin can
  // still read it.
  const inventoryTemplates = useQuery(api.inventoryTemplates.listTemplates, {
    statuses: ["active", "inactive"],
  });

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [area, setArea] = useState("");
  const [subItems, setSubItems] = useState<string[]>([]);
  const [isPriority, setIsPriority] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [linkedTemplateId, setLinkedTemplateId] = useState<string>(NO_LINK);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (value) {
      setName(value.name);
      setDescription(value.description);
      setArea(value.area);
      setSubItems(value.subItems);
      setIsPriority(value.isPriority);
      setIsActive(value.isActive);
      setLinkedTemplateId(value.linkedApplianceTemplateId ?? NO_LINK);
    }
  }, [value]);

  // No react-hook-form here, so dirtiness is a straight compare against what
  // the panel opened with.
  const isDirty =
    value !== null &&
    (name !== value.name ||
      description !== value.description ||
      area !== value.area ||
      JSON.stringify(subItems) !== JSON.stringify(value.subItems) ||
      isPriority !== value.isPriority ||
      isActive !== value.isActive ||
      linkedTemplateId !== (value.linkedApplianceTemplateId ?? NO_LINK));
  const guard = useDirtyDraftGuard(isDirty, onClose);

  if (!value) return null;

  const isEditing = value.id !== undefined;

  const handleSave = async () => {
    if (!name.trim()) return;
    try {
      setIsSaving(true);
      if (isEditing) {
        await updateStationCheck({
          id: value.id!,
          name: name.trim(),
          description: description.trim() || undefined,
          area: area.trim() || undefined,
          subItems: subItems.map((item) => item.trim()).filter(Boolean),
          isPriority,
          isActive,
          // null clears an existing link; the server distinguishes that from
          // "not mentioned".
          linkedApplianceTemplateId:
            linkedTemplateId === NO_LINK
              ? null
              : (linkedTemplateId as Id<"applianceTemplates">),
        });
        toast.success("Check template updated");
      } else {
        await createStationCheck({
          name: name.trim(),
          description: description.trim() || undefined,
          area: area.trim() || undefined,
          subItems: subItems.map((item) => item.trim()).filter(Boolean),
          isPriority,
          isActive,
          linkedApplianceTemplateId:
            linkedTemplateId === NO_LINK
              ? undefined
              : (linkedTemplateId as Id<"applianceTemplates">),
        });
        toast.success("Check template created");
      }
      guard.release();
      onClose();
    } catch (error) {
      console.error("Error saving check template:", error);
      toast.error(
        isEditing
          ? "Failed to update check template"
          : "Failed to create check template"
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <ResponsiveModal
        open={!!value}
        onClose={onClose}
        onRequestClose={guard.requestClose}
        title={isEditing ? "Edit Check" : "New Check"}
        drawerHeight="h-auto max-h-[90vh]"
        footer={
          <div className="flex flex-col gap-2 p-4 pt-2">
            <Button
              onClick={handleSave}
              disabled={!name.trim() || isSaving}
              className="w-full"
              size="lg"
            >
              {isSaving ? (
                <span className="flex items-center gap-2">
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  Saving...
                </span>
              ) : isEditing ? (
                "Save"
              ) : (
                "Create"
              )}
            </Button>
          </div>
        }
      >
        <div className="space-y-4 pb-4">
          <div>
            <Label>Check Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Empty bins"
              className="mt-1 text-base md:text-sm"
              autoFocus={!isEditing}
            />
          </div>

          <div>
            <Label>Area (Optional)</Label>
            <Input
              value={area}
              onChange={(e) => setArea(e.target.value)}
              placeholder="e.g., Kitchen"
              className="mt-1 text-base md:text-sm"
            />
            {areaSuggestions.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {areaSuggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => setArea(suggestion)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                      area.trim().toLowerCase() === suggestion.toLowerCase()
                        ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                    }`}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
            <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
              Checks with the same area are grouped together in the weekly list.
            </p>
          </div>

          <div>
            <Label>Description (Optional)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add detailed instructions..."
              className="mt-1 resize-none h-20 text-base md:text-sm"
            />
          </div>

          <div className="flex flex-col gap-2">
            <div>
              <Label>Required subitems (Optional)</Label>
              <p className="mt-1 text-xs text-muted-foreground">
                Add the steps that must be checked off alongside this item.
              </p>
            </div>
            {subItems.map((subItem, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input
                  value={subItem}
                  onChange={(event) =>
                    setSubItems((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index ? event.target.value : item
                      )
                    )
                  }
                  aria-label={`Subitem ${index + 1}`}
                  placeholder={`Required step ${index + 1}`}
                  className="text-base md:text-sm"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove subitem ${index + 1}`}
                  onClick={() =>
                    setSubItems((current) =>
                      current.filter((_, itemIndex) => itemIndex !== index)
                    )
                  }
                >
                  <Trash2 aria-hidden="true" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="self-start"
              onClick={() => setSubItems((current) => [...current, ""])}
            >
              <Plus data-icon="inline-start" aria-hidden="true" />
              Add subitem
            </Button>
          </div>

          <div className="flex items-center justify-between gap-3 py-1">
            <div>
              <Label htmlFor="template-priority-switch">Priority</Label>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Emphasised and listed first - for checks that can't be skipped
              </p>
            </div>
            <Switch
              id="template-priority-switch"
              checked={isPriority}
              onCheckedChange={setIsPriority}
            />
          </div>

          <div className="flex items-center justify-between gap-3 py-1">
            <div>
              <Label htmlFor="template-active-switch">Active</Label>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Inactive checks are hidden from the weekly list
              </p>
            </div>
            <Switch
              id="template-active-switch"
              checked={isActive}
              onCheckedChange={setIsActive}
            />
          </div>

          <div className="py-1">
            <Label htmlFor="linked-inventory-select">Linked inventory check</Label>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 mb-2">
              Tie this item to an appliance's inventory check. It then becomes
              read-only and ticks itself when that check is completed for the
              week, and hides from the list while the appliance is out of
              service.
            </p>
            <Select value={linkedTemplateId} onValueChange={setLinkedTemplateId}>
              <SelectTrigger id="linked-inventory-select">
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_LINK}>None</SelectItem>
                {(inventoryTemplates ?? []).map((template) => (
                  <SelectItem key={template._id} value={template._id}>
                    {template.name}
                    {template.status === "inactive" ? " (out of service)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </ResponsiveModal>

      <DeleteConfirmDialog
        open={guard.promptOpen}
        onOpenChange={guard.setPromptOpen}
        title="Discard unsaved changes?"
        description="This check has unsaved changes. Leaving now will lose them."
        confirmLabel="Discard"
        onConfirm={guard.confirmDiscard}
      />
    </>
  );
}
