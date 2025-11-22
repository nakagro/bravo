import React, { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Textarea } from "../../../components/ui/textarea";
import { Badge } from "../../../components/ui/badge";
import { PlusIcon, TrashIcon, PencilIcon } from "@heroicons/react/24/outline";
import { useNavigate } from "react-router-dom";

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
  const updateTemplate = useMutation(api.inventoryTemplates.updateApplianceTemplate);
  const deleteTemplate = useMutation(api.inventoryTemplates.deleteApplianceTemplate);
  const publishTemplate = useMutation(api.inventoryTemplates.publishTemplate);
  const navigate = useNavigate();

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  // Inline editor removed; we navigate to a dedicated editor page now

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const id = await createTemplate({ name: newName.trim(), description: newDescription.trim() || undefined });
    setShowCreate(false);
    setNewName("");
    setNewDescription("");
    navigate(`/inventory/templates/${id}` as string);
  };

  const handleDelete = async (tpl: ApplianceTemplateDoc) => {
    if (!confirm("Delete this template, all sections and items?")) return;
    await deleteTemplate({ templateId: tpl._id });
    // no-op: navigation-based editor
  };


  return (
    <div className="space-y-4" data-component="InventoryTemplateList">
      <div className="flex justify-end">
        <Button onClick={() => setShowCreate((v) => !v)}>
          <PlusIcon className="h-4 w-4 mr-1" /> New Template
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
            className="bg-white dark:bg-gray-800 shadow-sm rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow"
          >
            {/* Header */}
            <div className="p-4 bg-gradient-to-r from-gray-50 to-white dark:from-gray-800 dark:to-gray-800">
              <div className="flex items-start justify-between gap-3 mb-2">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{tpl.name}</h3>
                <Badge variant="outline">v{tpl.version}</Badge>
              </div>
              {tpl.description && (
                <p className="text-sm text-gray-600 dark:text-gray-400">{tpl.description}</p>
              )}
            </div>

            {/* Footer with Actions */}
            <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900/50 flex flex-col gap-2">
              <Button
                variant="default"
                size="sm"
                className="w-full bg-red-600 hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700"
                onClick={() => navigate(`/inventory/templates/${tpl._id}`)}
              >
                <PencilIcon className="h-4 w-4 mr-2" /> Edit Template
              </Button>
              <Button
                variant="destructive"
                size="sm"
                className="w-full"
                onClick={() => handleDelete(tpl)}
              >
                <TrashIcon className="h-4 w-4 mr-2" /> Delete
              </Button>
            </div>
          </div>
        ))}
      </div>

      {(!templates || templates.length === 0) && !showCreate && (
        <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
          <div className="p-6 text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              No templates yet. Create your first one for the Pumper.
            </p>
          </div>
        </div>
      )}
      {/* Editor moved to dedicated route */}
    </div>
  );
}

export default InventoryTemplateList;
