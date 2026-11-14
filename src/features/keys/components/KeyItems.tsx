import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { toast } from "sonner";
import { KeyItemModal } from "./KeyItemModal";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Plus, Pencil, Trash2, KeyRound, CreditCard, Hash, FileText } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";

function getTypeIcon(type: string) {
  switch (type) {
    case "Key": return <KeyRound className="h-4 w-4" />;
    case "Fob": return <Hash className="h-4 w-4" />;
    case "Swipe": return <CreditCard className="h-4 w-4" />;
    case "Code": return <FileText className="h-4 w-4" />;
    default: return <KeyRound className="h-4 w-4" />;
  }
}

export function KeyItems({ keyId }: { keyId: Id<"keys"> }) {
  const keyItems = useQuery(api.keyItems.list, { keyId });
  const removeKeyItem = useMutation(api.keyItems.remove);

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingKeyItem, setEditingKeyItem] = useState<Id<"keyItems"> | null>(null);

  const handleDelete = async (id: Id<"keyItems">) => {
    try {
      await removeKeyItem({ id });
      toast.success("Key item deleted");
    } catch (error: any) {
      toast.error(error.message || "Failed to delete key item");
      console.error(error);
    }
  };

  if (keyItems === undefined) {
    return (
      <div className="flex justify-center items-center h-32">
        <Spinner className="size-6 text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Key Items ({keyItems.length})
        </h3>
        <Button
          type="button"
          onClick={() => setShowAddForm(true)}
          size="sm"
          className="bg-red-700 hover:bg-red-800 dark:bg-red-600 dark:hover:bg-red-700 text-white"
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          Add Item
        </Button>
      </div>

      {keyItems.length === 0 ? (
        <div className="text-center py-6 px-4 rounded-lg border border-dashed border-gray-300 dark:border-gray-700">
          <KeyRound className="h-8 w-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No items on this peg yet
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            Add keys, fobs, swipe cards, or access codes
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {keyItems.map((item) => (
            <div
              key={item._id}
              className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-gray-500 dark:text-gray-400 flex-shrink-0">
                  {getTypeIcon(item.type)}
                </span>
                <div className="min-w-0">
                  <span className="font-medium text-gray-900 dark:text-white text-sm">{item.type}</span>
                  <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{item.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                  onClick={() => setEditingKeyItem(item._id)}
                  title="Edit"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>

                <ConfirmDialog
                  trigger={
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                      title="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  }
                  title="Delete this item?"
                  description={<>This will permanently remove the {item.type.toLowerCase()} &ldquo;{item.description}&rdquo; from this key.</>}
                  confirmLabel="Delete"
                  tone="destructive"
                  onConfirm={() => handleDelete(item._id)}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Modal */}
      {showAddForm && (
        <KeyItemModal
          keyId={keyId}
          onClose={() => setShowAddForm(false)}
        />
      )}

      {/* Edit Modal */}
      {editingKeyItem && (
        <KeyItemModal
          keyId={keyId}
          keyItemId={editingKeyItem}
          onClose={() => setEditingKeyItem(null)}
        />
      )}
    </div>
  );
}
