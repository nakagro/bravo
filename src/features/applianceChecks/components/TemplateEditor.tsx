import React, { useState } from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../components/ui/select";
import { PlusIcon, PencilIcon, TrashIcon } from "@heroicons/react/24/outline";
import { Bars3Icon } from "@heroicons/react/24/solid";
import { useToast } from "../../../hooks/use-toast";
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
};

type ApplianceSection = {
  _id: Id<"applianceSections">;
  name: string;
  order: number;
  items?: ApplianceItem[];
};

// Component for editing template metadata
function TemplateMetaEditor({ template, onSave }: { template: any; onSave: (name: string, description: string) => Promise<void> }) {
  const [name, setName] = useState(template?.name ?? "");
  const [description, setDescription] = useState(template?.description ?? "");
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  React.useEffect(() => {
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
    } catch (error) {
      toast({ title: "Error", description: "Failed to update template", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="w-full sm:w-auto">
          <PencilIcon className="h-4 w-4 sm:mr-2" />
          <span className="hidden sm:inline">Edit Template</span>
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
              placeholder="e.g., Pumper Weekly Check"
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
    } catch (error) {
      toast({ title: "Error", description: "Failed to add section", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full">
          <PlusIcon className="h-4 w-4 mr-2" />
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
function AddItemDialog({ sectionId, onAdd }: { sectionId: string; onAdd: (name: string, type: string) => Promise<void> }) {
  const [name, setName] = useState("");
  const [itemType, setItemType] = useState("boolean_with_notes");
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleAdd = async () => {
    if (!name.trim()) return;
    setIsLoading(true);
    try {
      await onAdd(name.trim(), itemType);
      toast({ title: "Success", description: "Item added successfully" });
      setName("");
      setItemType("boolean_with_notes");
      setOpen(false);
    } catch (error) {
      toast({ title: "Error", description: "Failed to add item", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-muted-foreground w-full justify-start">
          <PlusIcon className="h-4 w-4 mr-2" />
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
          </div>
          <div>
            <label className="text-sm font-medium">Item Type</label>
            <Select value={itemType} onValueChange={setItemType} disabled={isLoading}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="boolean_with_notes">Checkbox with Notes</SelectItem>
                <SelectItem value="boolean">Checkbox Only</SelectItem>
                <SelectItem value="text">Text Input</SelectItem>
              </SelectContent>
            </Select>
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
  trigger: React.ReactNode;
}) {
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  React.useEffect(() => {
    if (open) setValue(defaultValue);
  }, [open, defaultValue]);

  const handleSave = async () => {
    if (!value.trim()) return;
    setIsLoading(true);
    try {
      await onSave(value.trim());
      toast({ title: "Success", description: `${title} updated successfully` });
      setOpen(false);
    } catch (error) {
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

// Sortable item component
function SortableItem({ item, onRename, onDelete }: { 
  item: ApplianceItem; 
  onRename: (name: string) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
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
      className="flex items-center justify-between p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors gap-2"
    >
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <button
          className="cursor-grab active:cursor-grabbing touch-none p-1 hover:bg-muted rounded"
          {...attributes}
          {...listeners}
        >
          <Bars3Icon className="h-5 w-5 text-muted-foreground" />
        </button>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 flex-1 min-w-0">
          <span className="text-sm font-medium truncate">{item.name}</span>
          <Badge variant="secondary" className="text-xs w-fit">
            {item.itemType === "boolean_with_notes" ? "✓ + Notes" : 
             item.itemType === "boolean" ? "✓ Only" : "Text"}
          </Badge>
        </div>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <EditDialog
          title="Rename Item"
          label="Item Name"
          defaultValue={item.name}
          onSave={onRename}
          trigger={
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <PencilIcon className="h-4 w-4" />
              <span className="sr-only">Edit item</span>
            </Button>
          }
        />
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive h-8 w-8 p-0">
              <TrashIcon className="h-4 w-4" />
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

export function TemplateEditor({ templateId }: TemplateEditorProps) {
  const data = useQuery(api.applianceTemplates.getTemplateStructure, { templateId });
  const updateTemplate = useMutation(api.applianceTemplates.updateApplianceTemplate);
  const createSection = useMutation(api.applianceTemplates.createSection);
  const updateSection = useMutation(api.applianceTemplates.updateSection);
  const deleteSection = useMutation(api.applianceTemplates.deleteSection);
  const createItem = useMutation(api.applianceTemplates.createItem);
  const updateItem = useMutation(api.applianceTemplates.updateItem);
  const deleteItem = useMutation(api.applianceTemplates.deleteItem);
  const reorderItems = useMutation(api.applianceTemplates.reorderItems);
  const publishTemplate = useMutation(api.applianceTemplates.publishTemplate);
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
    } catch (error) {
      toast({ title: "Error", description: "Failed to delete section", variant: "destructive" });
    }
  };

  const handleAddItem = async (sectionId: Id<"applianceSections">, name: string, itemType: string) => {
    await createItem({ templateId, sectionId, name, itemType: itemType as any });
  };

  const handleRenameItem = async (itemId: Id<"applianceItems">, name: string) => {
    await updateItem({ itemId, name });
  };

  const handleDeleteItem = async (itemId: Id<"applianceItems">) => {
    try {
      await deleteItem({ itemId });
      toast({ title: "Success", description: "Item deleted successfully" });
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
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
    <div className="space-y-6">
      {/* Template Header */}
      <Card>
        <CardHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <CardTitle className="text-xl">{template.name}</CardTitle>
              {template.description && (
                <p className="text-sm text-muted-foreground">{template.description}</p>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">Version {template.version}</Badge>
                {template.hasUnpublishedChanges && (
                  <Badge variant="destructive">Unpublished Changes</Badge>
                )}
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <TemplateMetaEditor template={template} onSave={handleSaveTemplate} />
              {template.hasUnpublishedChanges && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="default" size="sm" className="w-full sm:w-auto">
                      Publish Changes
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Publish Template Changes</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will create a new version of the template and make all changes available for use in new appliance checks.
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
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">Template Sections</h2>
          <AddSectionDialog onAdd={handleAddSection} />
        </div>

        {sections.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <div className="mx-auto w-12 h-12 bg-muted rounded-full flex items-center justify-center mb-4">
                  <PlusIcon className="h-6 w-6 text-muted-foreground" />
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
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-base flex-1">{section.name}</CardTitle>
                    <div className="flex items-center gap-1">
                      <EditDialog
                        title="Rename Section"
                        label="Section Name"
                        defaultValue={section.name}
                        onSave={(name) => handleRenameSection(section._id, name)}
                        trigger={
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <PencilIcon className="h-4 w-4" />
                            <span className="sr-only">Edit section</span>
                          </Button>
                        }
                      />
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive h-8 w-8 p-0">
                            <TrashIcon className="h-4 w-4" />
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
                <CardContent className="pt-0">
                  <div className="space-y-2">
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
                            />
                          ))}
                        </SortableContext>
                      </DndContext>
                    ) : null}
                    
                    {/* Add Item to Section */}
                    {section.items && section.items.length > 0 && (
                      <div className="pt-2 border-t border-dashed" />
                    )}
                    <AddItemDialog 
                      sectionId={section._id} 
                      onAdd={(name, type) => handleAddItem(section._id, name, type)} 
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

export default TemplateEditor;
