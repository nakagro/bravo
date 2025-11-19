import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Button } from "../../../components/ui/button";
import { TemplateEditor } from "../components/TemplateEditor";

export function InventoryTemplateTab() {
  const { templateId } = useParams<{ templateId: string }>();
  const navigate = useNavigate();

  if (!templateId) {
    return (
      <div className="bg-white dark:bg-gray-800 shadow-sm rounded overflow-hidden">
        <div className="p-3 text-sm text-muted-foreground">Missing template ID</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="mb-4 bg-white dark:bg-gray-800 shadow-sm rounded overflow-hidden">
        <div className="p-3 flex flex-row items-center justify-between border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-medium">Inventory Template Editor</h2>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => navigate(-1)}>Back</Button>
          </div>
        </div>
      </div>

      <TemplateEditor templateId={templateId as Id<"applianceTemplates">} />
    </div>
  );
}

export default InventoryTemplateTab;
