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
import { Separator } from "../../../components/ui/separator";
import { PlusIcon, PencilIcon, TrashIcon, EllipsisVerticalIcon, ArrowUpIcon, ArrowDownIcon } from "@heroicons/react/24/outline";

interface TemplateEditorProps {
  templateId: Id<"applianceTemplates">;
}

type ApplianceItem = {
  _id: Id<"applianceItems">;
  name: string;
  itemType: "boolean_with_notes" | "boolean" | "text";
};

type ApplianceSection = {
  _id: Id<"applianceSections">;
  name: string;
  order: number;
  items?: ApplianceItem[];
};

// Component for editing template metadata
function TemplateMetaEditor({ template, onSave }: { template: any; onSave: (name: string, description: string) => void }) {
  const [name, setName] = useState(template?.name ?? "");
  const [description, setDescription] = useState(template?.description ?? "");
  const [open, setOpen] = useState(false);

  React.useEffect(() => {
    if (template && open) {
      setName(template.name ?? "");
      setDescription(template.description ?? "");
    }
  }, [template, open]);

  const handleSave = () => {
    onSave(name, description);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <PencilIcon className="h-4 w-4 mr-2" />
          Edit Template
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
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>Save Changes</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Component for adding new sections
function AddSectionDialog({ onAdd }: { onAdd: (name: string) => void }) {
  const [name, setName] = useState("");
  const [open, setOpen] = useState(false);

  const handleAdd = () => {
    if (name.trim()) {
      onAdd(name.trim());
      setName("");
      setOpen(false);
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
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAdd} disabled={!name.trim()}>
              Add Section
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Component for adding new items to a section
function AddItemDialog({ sectionId, onAdd }: { sectionId: string; onAdd: (name: string, type: string) => void }) {
  const [name, setName] = useState("");
  const [itemType, setItemType] = useState("boolean_with_notes");
  const [open, setOpen] = useState(false);

  const handleAdd = () => {
    if (name.trim()) {
      onAdd(name.trim(), itemType);
      setName("");
      setOpen(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-muted-foreground">
          <PlusIcon className="h-4 w-4 mr-1" />
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
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Item Type</label>
            <Select value={itemType} onValueChange={setItemType}>
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
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAdd} disabled={!name.trim()}>
              Add Item
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
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
  const publishTemplate = useMutation(api.applianceTemplates.publishTemplate);

  const template = data?.template;
  const sections: ApplianceSection[] = (data?.sections as ApplianceSection[]) ?? [];

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
    await deleteSection({ sectionId });
  };

  const handleAddItem = async (sectionId: Id<"applianceSections">, name: string, itemType: string) => {
    await createItem({ templateId, sectionId, name, itemType: itemType as any });
  };

  const handleRenameItem = async (itemId: Id<"applianceItems">, name: string) => {
    await updateItem({ itemId, name });
  };

  const handleDeleteItem = async (itemId: Id<"applianceItems">) => {
    await deleteItem({ itemId });
  };

  const handlePublishTemplate = async () => {
    if (!template) return;
    await publishTemplate({ templateId: template._id });
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
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <CardTitle className="text-xl">{template.name}</CardTitle>
              {template.description && (
                <p className="text-sm text-muted-foreground">{template.description}</p>
              )}
              <div className="flex items-center gap-2">
                <Badge variant="outline">Version {template.version}</Badge>
                {template.hasUnpublishedChanges && (
                  <Badge variant="destructive">Unpublished Changes</Badge>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <TemplateMetaEditor template={template} onSave={handleSaveTemplate} />
              {template.hasUnpublishedChanges && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="default" size="sm">
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
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handlePublishTemplate}>
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
        <div className="flex items-center justify-between">
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
            {sections.map((section: ApplianceSection) => (
              <Card key={section._id} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{section.name}</CardTitle>
                    <div className="flex items-center gap-1">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <PencilIcon className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-md">
                          <DialogHeader>
                            <DialogTitle>Rename Section</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div>
                              <label className="text-sm font-medium">Section Name</label>
                              <Input
                                defaultValue={section.name}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    const target = e.target as HTMLInputElement;
                                    if (target.value.trim()) {
                                      handleRenameSection(section._id, target.value.trim());
                                      // Close dialog
                                      const closeButton = document.querySelector('[data-state="open"] button[data-radix-collection-item]') as HTMLElement;
                                      closeButton?.click();
                                    }
                                  }
                                }}
                                className="mt-1"
                              />
                            </div>
                            <div className="flex justify-end gap-2">
                              <Button variant="outline" onClick={() => {
                                const closeButton = document.querySelector('[data-state="open"] button[data-radix-collection-item]') as HTMLElement;
                                closeButton?.click();
                              }}>
                                Cancel
                              </Button>
                              <Button onClick={(e) => {
                                const input = (e.target as HTMLElement).closest('.space-y-4')?.querySelector('input') as HTMLInputElement;
                                if (input?.value.trim()) {
                                  handleRenameSection(section._id, input.value.trim());
                                  const closeButton = document.querySelector('[data-state="open"] button[data-radix-collection-item]') as HTMLElement;
                                  closeButton?.click();
                                }
                              }}>
                                Save
                              </Button>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                            <TrashIcon className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Section</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete "{section.name}" and all its items? This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteSection(section._id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
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
                    {section.items?.map((item: ApplianceItem) => (
                      <div key={item._id} className="group flex items-center justify-between p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-medium">{item.name}</span>
                          <Badge variant="secondary" className="text-xs">
                            {item.itemType === "boolean_with_notes" ? "Checkbox + Notes" : 
                             item.itemType === "boolean" ? "Checkbox" : "Text Input"}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <PencilIcon className="h-3 w-3" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-md">
                              <DialogHeader>
                                <DialogTitle>Rename Item</DialogTitle>
                              </DialogHeader>
                              <div className="space-y-4">
                                <div>
                                  <label className="text-sm font-medium">Item Name</label>
                                  <Input
                                    defaultValue={item.name}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") {
                                        const target = e.target as HTMLInputElement;
                                        if (target.value.trim()) {
                                          handleRenameItem(item._id, target.value.trim());
                                          const closeButton = document.querySelector('[data-state="open"] button[data-radix-collection-item]') as HTMLElement;
                                          closeButton?.click();
                                        }
                                      }
                                    }}
                                    className="mt-1"
                                  />
                                </div>
                                <div className="flex justify-end gap-2">
                                  <Button variant="outline" onClick={() => {
                                    const closeButton = document.querySelector('[data-state="open"] button[data-radix-collection-item]') as HTMLElement;
                                    closeButton?.click();
                                  }}>
                                    Cancel
                                  </Button>
                                  <Button onClick={(e) => {
                                    const input = (e.target as HTMLElement).closest('.space-y-4')?.querySelector('input') as HTMLInputElement;
                                    if (input?.value.trim()) {
                                      handleRenameItem(item._id, input.value.trim());
                                      const closeButton = document.querySelector('[data-state="open"] button[data-radix-collection-item]') as HTMLElement;
                                      closeButton?.click();
                                    }
                                  }}>
                                    Save
                                  </Button>
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                                <TrashIcon className="h-3 w-3" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Item</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete "{item.name}"? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteItem(item._id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Delete Item
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    ))}
                    
                    {/* Add Item to Section */}
                    <div className="pt-2 border-t border-dashed">
                      <AddItemDialog 
                        sectionId={section._id} 
                        onAdd={(name, type) => handleAddItem(section._id, name, type)} 
                      />
                    </div>
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
