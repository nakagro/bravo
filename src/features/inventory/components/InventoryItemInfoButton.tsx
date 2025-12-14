import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Button } from "../../../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../../../components/ui/dialog";
import { Info } from "lucide-react";
import type { RunItemDoc } from "../types/inventory.types";

interface InventoryItemInfoButtonProps {
  item: RunItemDoc;
}

export function InventoryItemInfoButton({ item }: InventoryItemInfoButtonProps) {
  const imageUrl = useQuery(
    api.inventoryTemplates.getImageUrl,
    item.imageStorageId ? { storageId: item.imageStorageId } : "skip"
  );

  const hasInfo = item.description || item.imageStorageId;

  if (!hasInfo) {
    return null;
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 shrink-0 min-h-[44px] min-w-[44px] p-2"
          title="View item details"
        >
          <Info className="w-5 h-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{item.itemName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {item.description && (
            <div>
              <h4 className="text-sm font-medium mb-2">Description</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                {item.description}
              </p>
            </div>
          )}
          {imageUrl && (
            <div>
              <h4 className="text-sm font-medium mb-2">Reference Image</h4>
              <img
                src={imageUrl}
                alt={item.itemName}
                className="w-full rounded-lg border"
              />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default InventoryItemInfoButton;
