import React, { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Textarea } from "../../../components/ui/textarea";
import { Badge } from "../../../components/ui/badge";
import { PlusIcon, TrashIcon, EyeIcon, PlayIcon } from "@heroicons/react/24/outline";
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

export function ApplianceTemplateList() {
  const templates = useQuery(api.applianceTemplates.getApplianceTemplates) as ApplianceTemplateDoc[] | undefined;
  const createTemplate = useMutation(api.applianceTemplates.createApplianceTemplate);
  const updateTemplate = useMutation(api.applianceTemplates.updateApplianceTemplate);
  const deleteTemplate = useMutation(api.applianceTemplates.deleteApplianceTemplate);
  const startRun = useMutation(api.applianceCheckRuns.startRun);
  const publishTemplate = useMutation(api.applianceTemplates.publishTemplate);
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
    navigate(`/appliances/templates/${id}` as string);
  };

  const handleDelete = async (tpl: ApplianceTemplateDoc) => {
    if (!confirm("Delete this template, all sections and items?")) return;
    await deleteTemplate({ templateId: tpl._id });
    // no-op: navigation-based editor
  };

  const handleStartCheck = async (tpl: ApplianceTemplateDoc) => {
    if (tpl.hasUnpublishedChanges) {
      alert("This template has unpublished changes. Please publish before starting a check.");
      return;
    }
    // Optional: use today's date at midnight as scheduledDate anchor
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const runId = await startRun({ templateId: tpl._id, scheduledDate: today.getTime() });
    navigate(`/appliances/run/${runId}`);
  };

  return (
    <div className="space-y-6" data-component="ApplianceTemplateList">
      <div className="flex justify-end">
        <Button onClick={() => setShowCreate((v) => !v)}>
          <PlusIcon className="h-4 w-4 mr-1" /> New Template
        </Button>
      </div>

      {showCreate && (
        <Card>
          <CardHeader>
            <CardTitle>Create New Template</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1">Name</label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g., Pumper" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <Textarea
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Weekly appliance checklist for the Pumper"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleCreate}>Create</Button>
              <Button variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Template grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {templates?.map((tpl) => (
          <Card key={tpl._id}>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                {tpl.name}
                <Badge variant="outline">v{tpl.version}</Badge>
              </CardTitle>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => navigate(`/appliances/templates/${tpl._id}`)}>
                  <EyeIcon className="h-4 w-4 mr-1" /> Open
                </Button>
                <Button variant="default" size="sm" onClick={() => handleStartCheck(tpl)}>
                  <PlayIcon className="h-4 w-4 mr-1" /> Start Check
                </Button>
                <Button variant="destructive" size="sm" onClick={() => handleDelete(tpl)}>
                  <TrashIcon className="h-4 w-4 mr-1" /> Delete
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {tpl.description ? (
                <p className="text-sm text-muted-foreground">{tpl.description}</p>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>

      {(!templates || templates.length === 0) && !showCreate && (
        <div className="text-sm text-muted-foreground">
          No templates yet. Create your first one for the Pumper.
        </div>
      )}
      {/* Editor moved to dedicated route */}
    </div>
  );
}

export default ApplianceTemplateList;
