import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Textarea } from "../../../components/ui/textarea";
import { Badge } from "../../../components/ui/badge";
import { Plus, Trash2, Pencil, FileText, Copy, MoreVertical, Download, Upload } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useConvex } from "convex/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../../components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog";
import { EmptyState } from "@/components/shared/EmptyState";

interface ApplianceTemplateDoc {
  _id: Id<"applianceTemplates">;
  name: string;
  description?: string;
  version: number;
  hasUnpublishedChanges?: boolean;
  createdBy: Id<"users">;
  createdAt: number;
  updatedAt: number;
  updatedBy: Id<"users">;
}

export function InventoryTemplateList() {
  const templates = useQuery(api.inventoryTemplates.getApplianceTemplates) as ApplianceTemplateDoc[] | undefined;
  const createTemplate = useMutation(api.inventoryTemplates.createApplianceTemplate);
  const deleteTemplate = useMutation(api.inventoryTemplates.deleteApplianceTemplate);
  const cloneTemplate = useMutation(api.inventoryTemplates.cloneTemplate);
  const importTemplate = useMutation(api.inventoryTemplates.importTemplate);
  const convex = useConvex();
  const navigate = useNavigate();

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  
  // Clone dialog state
  const [cloneDialogOpen, setCloneDialogOpen] = useState(false);
  const [cloneTarget, setCloneTarget] = useState<ApplianceTemplateDoc | null>(null);
  const [cloneName, setCloneName] = useState("");
  const [isCloning, setIsCloning] = useState(false);

  // Import dialog state
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importName, setImportName] = useState("");
  const [importData, setImportData] = useState<any>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const id = await createTemplate({ name: newName.trim(), description: newDescription.trim() || undefined });
    setShowCreate(false);
    setNewName("");
    setNewDescription("");
    navigate(`/inventory/templates/${id}` as string);
  };

  const handleDelete = async (tpl: ApplianceTemplateDoc) => {
    if (!confirm(`Delete "${tpl.name}" and all its sections and items?`)) return;
    try {
      await deleteTemplate({ templateId: tpl._id });
      toast.success("Template deleted");
    } catch (error) {
      toast.error("Failed to delete template", {
        description: error instanceof Error ? error.message : "An unexpected error occurred.",
      });
    }
  };

  const openCloneDialog = (tpl: ApplianceTemplateDoc) => {
    setCloneTarget(tpl);
    setCloneName(`${tpl.name} (Copy)`);
    setCloneDialogOpen(true);
  };

  const handleClone = async () => {
    if (!cloneTarget || !cloneName.trim()) return;
    setIsCloning(true);
    try {
      const newId = await cloneTemplate({ templateId: cloneTarget._id, newName: cloneName.trim() });
      toast.success("Template cloned successfully");
      setCloneDialogOpen(false);
      setCloneTarget(null);
      setCloneName("");
      navigate(`/inventory/templates/${newId}` as string);
    } catch (error) {
      toast.error("Failed to clone template", {
        description: error instanceof Error ? error.message : "An unexpected error occurred.",
      });
    } finally {
      setIsCloning(false);
    }
  };

  const handleExport = async (tpl: ApplianceTemplateDoc) => {
    try {
      const data = await convex.query(api.inventoryTemplates.exportTemplate, { templateId: tpl._id });
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${tpl.name.replace(/[^a-z0-9]/gi, "_").toLowerCase()}_template.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Template exported");
    } catch (error) {
      toast.error("Failed to export template", {
        description: error instanceof Error ? error.message : "An unexpected error occurred.",
      });
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (!data.exportVersion || !data.template || !data.sections) {
          setImportError("Invalid template file format");
          setImportData(null);
          return;
        }
        setImportData(data);
        setImportName(data.template.name);
        setImportError(null);
      } catch {
        setImportError("Failed to parse JSON file");
        setImportData(null);
      }
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!importData || !importName.trim()) return;
    setIsImporting(true);
    try {
      const newId = await importTemplate({ data: importData, templateName: importName.trim() });
      toast.success("Template imported successfully");
      setImportDialogOpen(false);
      setImportData(null);
      setImportName("");
      setImportError(null);
      navigate(`/inventory/templates/${newId}` as string);
    } catch (error) {
      toast.error("Failed to import template", {
        description: error instanceof Error ? error.message : "An unexpected error occurred.",
      });
    } finally {
      setIsImporting(false);
    }
  };

  const openImportDialog = () => {
    setImportData(null);
    setImportName("");
    setImportError(null);
    setImportDialogOpen(true);
  };


  return (
    <div className="space-y-4" data-component="InventoryTemplateList">
      <div className="flex justify-end gap-2">
        <Button 
          variant="outline"
          onClick={openImportDialog}
        >
          <Upload className="h-4 w-4 mr-1" /> Import
        </Button>
        <Button 
          onClick={() => setShowCreate((v) => !v)}
          className="bg-red-600 hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700"
        >
          <Plus className="h-4 w-4 mr-1" /> New Template
        </Button>
      </div>

      {showCreate && (
        <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
          <div className="p-4 bg-gradient-to-r from-gray-50 to-white dark:from-gray-800 dark:to-gray-800 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Create New Template</h3>
          </div>
          <div className="p-4 space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Name</label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g., Pumper" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Description</label>
              <Textarea
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Weekly appliance checklist for the Pumper"
              />
            </div>
          </div>
          <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900/50 flex gap-2">
            <Button onClick={handleCreate}>Create</Button>
            <Button variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Template grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates?.map((tpl) => (
          <div
            key={tpl._id}
            className="bg-white dark:bg-gray-800 shadow-sm rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => navigate(`/inventory/templates/${tpl._id}`)}
          >
            {/* Header */}
            <div className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white truncate">{tpl.name}</h3>
                  {tpl.description && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{tpl.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Badge variant="outline" className="text-xs">v{tpl.version}</Badge>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <MoreVertical className="h-4 w-4" />
                        <span className="sr-only">Actions</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenuItem onClick={() => navigate(`/inventory/templates/${tpl._id}`)}>
                        <Pencil className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => openCloneDialog(tpl)}>
                        <Copy className="h-4 w-4 mr-2" />
                        Clone
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleExport(tpl)}>
                        <Download className="h-4 w-4 mr-2" />
                        Export
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        onClick={() => handleDelete(tpl)}
                        className="text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
              {tpl.hasUnpublishedChanges && (
                <Badge variant="secondary" className="mt-2 text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                  Unpublished changes
                </Badge>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Clone Dialog */}
      <Dialog open={cloneDialogOpen} onOpenChange={setCloneDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clone Template</DialogTitle>
            <DialogDescription>
              Create a copy of "{cloneTarget?.name}" with all its sections and items.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
              New Template Name
            </label>
            <Input
              value={cloneName}
              onChange={(e) => setCloneName(e.target.value)}
              placeholder="Enter name for the cloned template"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCloneDialogOpen(false)} disabled={isCloning}>
              Cancel
            </Button>
            <Button 
              onClick={handleClone} 
              disabled={!cloneName.trim() || isCloning}
              className="bg-red-600 hover:bg-red-700"
            >
              {isCloning ? "Cloning..." : "Clone Template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Template</DialogTitle>
            <DialogDescription>
              Import a template from a previously exported JSON file.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                Select File
              </label>
              <Input
                type="file"
                accept=".json"
                onChange={handleFileSelect}
                className="cursor-pointer"
              />
            </div>
            {importError && (
              <p className="text-sm text-red-600 dark:text-red-400">{importError}</p>
            )}
            {importData && (
              <>
                <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg text-sm">
                  <p className="font-medium text-gray-900 dark:text-white">{importData.template.name}</p>
                  {importData.template.description && (
                    <p className="text-gray-500 dark:text-gray-400 mt-1">{importData.template.description}</p>
                  )}
                  <p className="text-gray-500 dark:text-gray-400 mt-2">
                    {importData.sections.length} section{importData.sections.length !== 1 ? "s" : ""}, {" "}
                    {importData.sections.reduce((acc: number, s: any) => acc + s.items.length, 0)} item{importData.sections.reduce((acc: number, s: any) => acc + s.items.length, 0) !== 1 ? "s" : ""}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                    Template Name
                  </label>
                  <Input
                    value={importName}
                    onChange={(e) => setImportName(e.target.value)}
                    placeholder="Enter name for the imported template"
                  />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportDialogOpen(false)} disabled={isImporting}>
              Cancel
            </Button>
            <Button 
              onClick={handleImport} 
              disabled={!importData || !importName.trim() || isImporting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isImporting ? "Importing..." : "Import Template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {(!templates || templates.length === 0) && !showCreate && (
        <EmptyState
          icon={<FileText className="h-10 w-10 text-red-500 dark:text-red-400" />}
          title="No templates yet"
          description="Create your first inventory check template to get started."
          actionLabel="Create First Template"
          onAction={() => setShowCreate(true)}
        />
      )}
      {/* Editor moved to dedicated route */}
    </div>
  );
}

export default InventoryTemplateList;
