import { useState, useEffect, type ReactNode } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Textarea } from "../../../components/ui/textarea";
import { Badge } from "../../../components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../../../components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "../../../components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Info, Image, GripVertical } from "lucide-react";
import { useToast } from "../../../hooks/use-toast";
import { DetailsEditorModal } from "./DetailsEditorModal";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface TemplateEditorProps {
  templateId: Id<"applianceTemplates">;
}

type ApplianceItem = {
  _id: Id<"applianceItems">;
  name: string;
  itemType: "boolean_with_notes" | "boolean" | "text";
  order: number;
  description?: string;
  imageStorageId?: Id<"_storage">;
  expectedQuantity?: number;
};

type ApplianceSection = {
  _id: Id<"applianceSections">;
  name: string;
  order: number;
  description?: string;
  imageStorageId?: Id<"_storage">;
  items?: ApplianceItem[];
};

// Component for editing template metadata
function TemplateMetaEditor({ template, onSave }: { template: any; onSave: (name: string, description: string) => Promise<void> }) {
  const [name, setName] = useState(template?.name ?? "");
  const [description, setDescription] = useState(template?.description ?? "");
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (template && open) {
      setName(template.name ?? "");
      setDescription(template.description ?? "");
    }
  }, [template, open]);

  const handleSave = async () => {
    if (!name.trim()) {
      toast({ title: "Error", description: "Template name is required", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      await onSave(name.trim(), description.trim());
      toast({ title: "Success", description: "Template updated successfully" });
      setOpen(false);
    } catch  {
      toast({ title: "Error", description: "Failed to update template", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="default" className="w-full sm:w-auto min-h-[44px]">
          <Pencil className="h-5 w-5 mr-2" />
          <span>Edit Template</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Template Details</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Template Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Pumper Weekly Inventory"
              className="mt-1"
              disabled={isLoading}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Description</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this template..."
              className="mt-1"
              rows={3}
              disabled={isLoading}
            />
          </div>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={isLoading} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isLoading || !name.trim()} className="w-full sm:w-auto">
              {isLoading ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Component for adding new sections
function AddSectionDialog({ onAdd }: { onAdd: (name: string) => Promise<void> }) {
  const [name, setName] = useState("");
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleAdd = async () => {
    if (!name.trim()) return;
    setIsLoading(true);
    try {
      await onAdd(name.trim());
      toast({ title: "Success", description: "Section added successfully" });
      setName("");
      setOpen(false);
    } catch  {
      toast({ title: "Error", description: "Failed to add section", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full min-h-[48px] text-base">
          <Plus className="h-5 w-5 mr-2" />
          Add Section
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add New Section</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Section Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Cabin, Locker 1, Engine Bay"
              className="mt-1"
              onKeyDown={(e) => e.key === "Enter" && !isLoading && handleAdd()}
              disabled={isLoading}
              autoFocus
            />
          </div>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={isLoading} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button onClick={handleAdd} disabled={!name.trim() || isLoading} className="w-full sm:w-auto">
              {isLoading ? "Adding..." : "Add Section"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Component for adding new items to a section
function AddItemDialog({ onAdd }: { onAdd: (name: string) => Promise<void> }) {
  const [name, setName] = useState("");
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleAdd = async () => {
    if (!name.trim()) return;
    setIsLoading(true);
    try {
      await onAdd(name.trim());
      toast({ title: "Success", description: "Item added successfully" });
      setName("");
      setOpen(false);
    } catch  {
      toast({ title: "Error", description: "Failed to add item", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="default" className="text-muted-foreground w-full justify-start min-h-[44px]">
          <Plus className="h-5 w-5 mr-2" />
          Add Item
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add New Item</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Item Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Seatbelts, BA Sets, Radio"
              className="mt-1"
              onKeyDown={(e) => e.key === "Enter" && !isLoading && handleAdd()}
              disabled={isLoading}
              autoFocus
            />
            <p className="text-xs text-muted-foreground mt-1.5">
              All items are Yes/No checks with optional notes
            </p>
          </div>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={isLoading} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button onClick={handleAdd} disabled={!name.trim() || isLoading} className="w-full sm:w-auto">
              {isLoading ? "Adding..." : "Add Item"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Reusable edit dialog for sections and items
function EditDialog({
  title,
  label,
  defaultValue,
  onSave,
  trigger
}: {
  title: string;
  label: string;
  defaultValue: string;
  onSave: (value: string) => Promise<void>;
  trigger: ReactNode;
}) {
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) setValue(defaultValue);
  }, [open, defaultValue]);

  const handleSave = async () => {
    if (!value.trim()) return;
    setIsLoading(true);
    try {
      await onSave(value.trim());
      toast({ title: "Success", description: `${title} updated successfully` });
      setOpen(false);
    } catch  {
      toast({ title: "Error", description: `Failed to update ${title.toLowerCase()}`, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">{label}</label>
            <Input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="mt-1"
              onKeyDown={(e) => e.key === "Enter" && !isLoading && handleSave()}
              disabled={isLoading}
              autoFocus
            />
          </div>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={isLoading} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!value.trim() || isLoading} className="w-full sm:w-auto">
              {isLoading ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Component for editing section details (description + image)
function SectionDetailsDialog({ section, onSave }: {
  section: ApplianceSection;
  onSave: (description?: string, imageStorageId?: Id<"_storage"> | null) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const hasInfo = section.description || section.imageStorageId;

  return (
    <>
      <Button
        variant="ghost"
        size="default"
        onClick={() => setOpen(true)}
        className={`min-h-[44px] min-w-[44px] p-0 ${hasInfo ? 'text-blue-600 dark:text-blue-400' : ''}`}
        title="Add section description or image"
      >
        <Image className="h-5 w-5" />
        <span className="sr-only">Section details</span>
      </Button>
      <DetailsEditorModal
        open={open}
        onClose={() => setOpen(false)}
        title={`Section Details: ${section.name}`}
        subjectName={section.name}
        initialDescription={section.description}
        imageStorageId={section.imageStorageId}
        descriptionPlaceholder="Describe this section (e.g., 'Left side locker when facing the truck')..."
        descriptionHint="Help users identify this section of the appliance"
        uploadHint="Take a photo of the section (e.g., locker door open) to help users identify it"
        onSave={onSave}
      />
    </>
  );
}

// Component for editing item details (description + image)
function ItemDetailsDialog({ item, onSave }: {
  item: ApplianceItem;
  onSave: (description?: string, imageStorageId?: Id<"_storage"> | null) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const hasInfo = item.description || item.imageStorageId;

  return (
    <>
      <Button
        variant="ghost"
        size="default"
        onClick={() => setOpen(true)}
        className={`min-h-[44px] min-w-[44px] p-0 ${hasInfo ? 'text-blue-600 dark:text-blue-400' : ''}`}
        title="Add description or image"
      >
        <Info className="h-5 w-5" />
        <span className="sr-only">Item details</span>
      </Button>
      <DetailsEditorModal
        open={open}
        onClose={() => setOpen(false)}
        title={`Item Details: ${item.name}`}
        subjectName={item.name}
        initialDescription={item.description}
        imageStorageId={item.imageStorageId}
        descriptionPlaceholder="Help text for users checking this item..."
        descriptionHint="Explain what this item is and where to find it"
        uploadHint="Image will be compressed to ~300KB automatically"
        onSave={onSave}
      />
    </>
  );
}

// Sortable item component
function SortableItem({ item, onRename, onDelete, onUpdateDetails, onUpdateQuantity }: {
  item: ApplianceItem;
  onRename: (name: string) => Promise<void>;
  onDelete: () => Promise<void>;
  onUpdateDetails: (description?: string, imageStorageId?: Id<"_storage"> | null) => Promise<void>;
  onUpdateQuantity: (quantity?: number) => Promise<void>;
}) {
  const [quantity, setQuantity] = useState<string>(item.expectedQuantity?.toString() || "");

  // Sync quantity state when item changes
  useEffect(() => {
    setQuantity(item.expectedQuantity?.toString() || "");
  }, [item.expectedQuantity]);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item._id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 sm:p-4 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors gap-2 sm:gap-3 min-h-[60px]"
    >
      <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
        <button
          className="cursor-grab active:cursor-grabbing touch-none p-2 hover:bg-muted rounded min-w-[44px] min-h-[44px] flex items-center justify-center flex-shrink-0"
          aria-label={`Reorder ${item.name}`}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-6 w-6 text-muted-foreground" />
        </button>
        <div className="flex-1 min-w-0">
          {/* No quantity prefix - the Qty box on this row is the same number */}
          <div className="text-base font-medium break-words">
            {item.name}
          </div>
          <div className="text-xs text-muted-foreground">
            {quantity ? "Quantity item" : "Yes/No item"}
          </div>
        </div>
      </div>
      {/* Quantity and actions drop to their own line on phones. Inline, the
          fixed chrome here (grip + qty + three 44px buttons) left barely
          40px for the item name on a 390px screen. */}
      <div className="flex items-center justify-end gap-1 sm:gap-2 flex-shrink-0">
        <Input
          type="number"
          min="1"
          step="1"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === '.' || e.key === '-' || e.key === 'e' || e.key === 'E') {
              e.preventDefault();
            }
          }}
          onBlur={() => {
            const num = quantity.trim() ? parseInt(quantity.trim(), 10) : undefined;
            if (typeof num !== "undefined" && !isNaN(num) && num >= 1) {
              onUpdateQuantity(num);
            } else if (!quantity.trim()) {
              onUpdateQuantity(undefined);
            }
          }}
          placeholder="Qty"
          className="w-16 h-9 text-sm text-center"
        />
        <ItemDetailsDialog
          item={item}
          onSave={onUpdateDetails}
        />
        <EditDialog
          title="Rename Item"
          label="Item Name"
          defaultValue={item.name}
          onSave={onRename}
          trigger={
            <Button variant="ghost" size="default" className="min-h-[44px] min-w-[44px] p-0">
              <Pencil className="h-5 w-5" />
              <span className="sr-only">Edit item</span>
            </Button>
          }
        />
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="default" className="text-destructive hover:text-destructive min-h-[44px] min-w-[44px] p-0">
              <Trash2 className="h-5 w-5" />
              <span className="sr-only">Delete item</span>
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Item</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete "{item.name}"? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-col-reverse sm:flex-row gap-2">
              <AlertDialogCancel className="w-full sm:w-auto">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={onDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90 w-full sm:w-auto"
              >
                Delete Item
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

export function InventoryTemplateEditor({ templateId }: TemplateEditorProps) {
  const data = useQuery(api.inventoryTemplates.getTemplateStructure, { templateId });
  const updateTemplate = useMutation(api.inventoryTemplates.updateApplianceTemplate);
  const createSection = useMutation(api.inventoryTemplates.createSection);
  const updateSection = useMutation(api.inventoryTemplates.updateSection);
  const deleteSection = useMutation(api.inventoryTemplates.deleteSection);
  const createItem = useMutation(api.inventoryTemplates.createItem);
  const updateItem = useMutation(api.inventoryTemplates.updateItem);
  const deleteItem = useMutation(api.inventoryTemplates.deleteItem);
  const reorderItems = useMutation(api.inventoryTemplates.reorderItems);
  const publishTemplate = useMutation(api.inventoryTemplates.publishTemplate);
  const { toast } = useToast();

  const template = data?.template;
  const sections: ApplianceSection[] = (data?.sections as ApplianceSection[]) ?? [];

  // Local state for optimistic updates during drag
  const [optimisticSections, setOptimisticSections] = useState<Record<string, ApplianceItem[]>>({});

  // Merge server data with optimistic updates
  const displaySections = sections.map(section => ({
    ...section,
    items: optimisticSections[section._id] || section.items
  }));

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement required before drag starts
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handler functions
  const handleSaveTemplate = async (name: string, description: string) => {
    if (!template) return;
    await updateTemplate({ templateId: template._id, name, description });
  };

  const handleAddSection = async (name: string) => {
    await createSection({ templateId, name });
  };

  const handleRenameSection = async (sectionId: Id<"applianceSections">, name: string) => {
    await updateSection({ sectionId, name });
  };

  const handleDeleteSection = async (sectionId: Id<"applianceSections">) => {
    try {
      await deleteSection({ sectionId });
      toast({ title: "Success", description: "Section deleted successfully" });
    } catch  {
      toast({ title: "Error", description: "Failed to delete section", variant: "destructive" });
    }
  };

  const handleUpdateSectionDetails = async (
    sectionId: Id<"applianceSections">,
    description?: string,
    imageStorageId?: Id<"_storage"> | null
  ) => {
    await updateSection({ sectionId, description, imageStorageId });
  };

  const handleAddItem = async (sectionId: Id<"applianceSections">, name: string) => {
    await createItem({ templateId, sectionId, name, itemType: "boolean_with_notes" });
  };

  const handleRenameItem = async (itemId: Id<"applianceItems">, name: string) => {
    await updateItem({ itemId, name });
  };

  const handleUpdateItemDetails = async (
    itemId: Id<"applianceItems">,
    description?: string,
    imageStorageId?: Id<"_storage"> | null
  ) => {
    await updateItem({ itemId, description, imageStorageId });
  };

  const handleUpdateQuantity = async (itemId: Id<"applianceItems">, expectedQuantity?: number) => {
    await updateItem({ itemId, expectedQuantity });
  };

  const handleDeleteItem = async (itemId: Id<"applianceItems">) => {
    try {
      await deleteItem({ itemId });
      toast({ title: "Success", description: "Item deleted successfully" });
    } catch  {
      toast({ title: "Error", description: "Failed to delete item", variant: "destructive" });
    }
  };

  const handleDragEnd = async (event: DragEndEvent, sectionId: Id<"applianceSections">, items: ApplianceItem[]) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      // Clear optimistic state if drag was cancelled
      setOptimisticSections(prev => {
        const newState = { ...prev };
        delete newState[sectionId];
        return newState;
      });
      return;
    }

    const oldIndex = items.findIndex((item) => item._id === active.id);
    const newIndex = items.findIndex((item) => item._id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    const reorderedItems = arrayMove(items, oldIndex, newIndex);
    const itemIds = reorderedItems.map((item) => item._id);

    // Optimistically update UI immediately
    setOptimisticSections(prev => ({
      ...prev,
      [sectionId]: reorderedItems
    }));

    try {
      await reorderItems({ sectionId, itemIds });
      // Clear optimistic state after successful server update
      setOptimisticSections(prev => {
        const newState = { ...prev };
        delete newState[sectionId];
        return newState;
      });
      toast({ title: "Success", description: "Items reordered successfully" });
    } catch  {
      // Revert optimistic update on error
      setOptimisticSections(prev => {
        const newState = { ...prev };
        delete newState[sectionId];
        return newState;
      });
      toast({ title: "Error", description: "Failed to reorder items", variant: "destructive" });
    }
  };

  const handlePublishTemplate = async () => {
    if (!template) return;
    try {
      await publishTemplate({ templateId: template._id });
      toast({ title: "Success", description: `Version ${template.version + 1} published successfully` });
    } catch  {
      toast({ title: "Error", description: "Failed to publish template", variant: "destructive" });
    }
  };

  if (!template) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading template...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-6">
      {/* Template Header */}
      <Card>
        <CardHeader className="p-4 sm:p-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <CardTitle className="text-xl sm:text-2xl">{template.name}</CardTitle>
              {template.description && (
                <p className="text-sm sm:text-base text-muted-foreground">{template.description}</p>
              )}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Badge variant="outline" className="text-sm">Version {template.version}</Badge>
                {template.hasUnpublishedChanges && (
                  <Badge variant="destructive" className="text-sm">Unpublished Changes</Badge>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <TemplateMetaEditor template={template} onSave={handleSaveTemplate} />
              {template.hasUnpublishedChanges && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="default" size="default" className="w-full min-h-[48px] text-base">
                      Publish Changes
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Publish Template Changes</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will create a new version of the template and make all changes available for use in new inventory checks.
                        Existing in-progress checks will continue to use the previous version.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="flex-col-reverse sm:flex-row gap-2">
                      <AlertDialogCancel className="w-full sm:w-auto">Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handlePublishTemplate} className="w-full sm:w-auto">
                        Publish Version {template.version + 1}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Sections */}
      <div className="space-y-4">
        <div className="space-y-3 px-1">
          <h2 className="text-lg sm:text-xl font-semibold">Template Sections</h2>
          <AddSectionDialog onAdd={handleAddSection} />
        </div>

        {sections.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <div className="mx-auto w-12 h-12 bg-muted rounded-full flex items-center justify-center mb-4">
                  <Plus className="h-6 w-6 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium mb-2">No sections yet</h3>
                <p className="text-muted-foreground mb-4">
                  Start by adding your first section to organize the checklist items.
                </p>
                <AddSectionDialog onAdd={handleAddSection} />
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {displaySections.map((section: ApplianceSection) => (
              <Card key={section._id} className="overflow-hidden">
                <CardHeader className="p-4 sm:p-6 pb-3">
                  <div className="flex items-center justify-between gap-3">
                    <CardTitle className="text-lg sm:text-xl flex-1 break-words">{section.name}</CardTitle>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <SectionDetailsDialog
                        section={section}
                        onSave={(description, imageStorageId) =>
                          handleUpdateSectionDetails(section._id, description, imageStorageId)
                        }
                      />
                      <EditDialog
                        title="Rename Section"
                        label="Section Name"
                        defaultValue={section.name}
                        onSave={(name) => handleRenameSection(section._id, name)}
                        trigger={
                          <Button variant="ghost" size="default" className="min-h-[44px] min-w-[44px] p-0">
                            <Pencil className="h-5 w-5" />
                            <span className="sr-only">Edit section</span>
                          </Button>
                        }
                      />
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="default" className="text-destructive hover:text-destructive min-h-[44px] min-w-[44px] p-0">
                            <Trash2 className="h-5 w-5" />
                            <span className="sr-only">Delete section</span>
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Section</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete "{section.name}" and all its items? This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter className="flex-col-reverse sm:flex-row gap-2">
                            <AlertDialogCancel className="w-full sm:w-auto">Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteSection(section._id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 w-full sm:w-auto"
                            >
                              Delete Section
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 p-4 sm:p-6">
                  <div className="space-y-3">
                    {section.items && section.items.length > 0 ? (
                      <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={(event) => handleDragEnd(event, section._id, section.items!)}
                      >
                        <SortableContext
                          items={section.items.map((item) => item._id)}
                          strategy={verticalListSortingStrategy}
                        >
                          {section.items.map((item: ApplianceItem) => (
                            <SortableItem
                              key={item._id}
                              item={item}
                              onRename={(name) => handleRenameItem(item._id, name)}
                              onDelete={() => handleDeleteItem(item._id)}
                              onUpdateDetails={(description, imageStorageId) =>
                                handleUpdateItemDetails(item._id, description, imageStorageId)
                              }
                              onUpdateQuantity={(quantity) => handleUpdateQuantity(item._id, quantity)}
                            />
                          ))}
                        </SortableContext>
                      </DndContext>
                    ) : null}

                    {/* Add Item to Section */}
                    {section.items && section.items.length > 0 && (
                      <div className="pt-1 border-t border-dashed" />
                    )}
                    <AddItemDialog
                      onAdd={(name) => handleAddItem(section._id, name)}
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default InventoryTemplateEditor;
