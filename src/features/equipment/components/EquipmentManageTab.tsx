import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Field, FieldLabel } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { ResponsiveModal } from "@/components/shared/ResponsiveModal";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Pencil, Trash2, Package, FolderPlus, Copy, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Spinner } from "@/components/ui/spinner";
import { EmptyState } from "@/components/shared/EmptyState";

export function EquipmentManageTab() {
  const categories = useQuery(api.equipment.getAllCategories);
  const items = useQuery(api.equipment.getItems);

  const createCategory = useMutation(api.equipment.createCategory);
  const updateCategory = useMutation(api.equipment.updateCategory);
  const deleteCategory = useMutation(api.equipment.deleteCategory);
  const createItem = useMutation(api.equipment.createItem);
  const updateItem = useMutation(api.equipment.updateItem);
  const deleteItem = useMutation(api.equipment.deleteItem);

  // Category/Item form state
  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  const [showItemDialog, setShowItemDialog] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Id<"equipmentCategories"> | null>(null);
  const [editingItem, setEditingItem] = useState<Id<"equipmentItems"> | null>(null);

  const [categoryName, setCategoryName] = useState("");
  const [categoryDescription, setCategoryDescription] = useState("");
  const [categoryCollapseItems, setCategoryCollapseItems] = useState(false);

  const [itemName, setItemName] = useState("");
  const [itemCategoryId, setItemCategoryId] = useState<Id<"equipmentCategories"> | "">("");
  const [itemDescription, setItemDescription] = useState("");
  const [itemSize, setItemSize] = useState("");
  const [itemInitialStock, setItemInitialStock] = useState(0);
  const [itemMinimumStock, setItemMinimumStock] = useState<number | undefined>(undefined);
  const [itemUnit, setItemUnit] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete confirmation state
  const [deleteCategoryId, setDeleteCategoryId] = useState<Id<"equipmentCategories"> | null>(null);
  const [deleteItemId, setDeleteItemId] = useState<Id<"equipmentItems"> | null>(null);

  const resetCategoryForm = () => {
    setCategoryName("");
    setCategoryDescription("");
    setCategoryCollapseItems(false);
    setEditingCategory(null);
  };

  const resetItemForm = () => {
    setItemName("");
    setItemCategoryId("");
    setItemDescription("");
    setItemSize("");
    setItemInitialStock(0);
    setItemMinimumStock(undefined);
    setItemUnit("");
    setEditingItem(null);
  };

  const handleOpenCategoryDialog = (categoryId?: Id<"equipmentCategories">) => {
    if (categoryId && categories) {
      const category = categories.find((c) => c._id === categoryId);
      if (category) {
        setCategoryName(category.name);
        setCategoryDescription(category.description || "");
        setCategoryCollapseItems(category.collapseItems ?? false);
        setEditingCategory(categoryId);
      }
    } else {
      resetCategoryForm();
    }
    setShowCategoryDialog(true);
  };

  const handleOpenItemDialog = (itemId?: Id<"equipmentItems">, clone?: boolean) => {
    if (itemId && items) {
      const item = items.find((i) => i._id === itemId);
      if (item) {
        setItemName(item.name);
        setItemCategoryId(item.categoryId);
        setItemDescription(item.description || "");
        setItemSize(clone ? "" : (item.size || ""));
        setItemMinimumStock(item.minimumStock);
        setItemUnit(item.unit || "");
        setEditingItem(clone ? null : itemId);
        setItemInitialStock(0);
      }
    } else {
      resetItemForm();
    }
    setShowItemDialog(true);
  };

  const handleSaveCategory = async () => {
    if (!categoryName.trim()) return;
    setIsSubmitting(true);
    try {
      if (editingCategory) {
        await updateCategory({
          categoryId: editingCategory,
          name: categoryName.trim(),
          description: categoryDescription.trim() || undefined,
          collapseItems: categoryCollapseItems,
        });
        toast.success(`Category "${categoryName.trim()}" updated`);
      } else {
        await createCategory({
          name: categoryName.trim(),
          description: categoryDescription.trim() || undefined,
          collapseItems: categoryCollapseItems,
        });
        toast.success(`Category "${categoryName.trim()}" created`);
      }
      setShowCategoryDialog(false);
      resetCategoryForm();
    } catch (error: any) {
      toast.error(error?.message || "Failed to save category");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCategory = async () => {
    if (!deleteCategoryId) return;
    try {
      await deleteCategory({ categoryId: deleteCategoryId });
      toast.success("Category deleted");
    } catch (error: any) {
      toast.error(error?.message || "Cannot delete category. It may still have items.");
    } finally {
      setDeleteCategoryId(null);
    }
  };

  const handleSaveItem = async () => {
    if (!itemName.trim() || !itemCategoryId) return;
    setIsSubmitting(true);
    try {
      const label = itemSize.trim() ? `${itemName.trim()} (${itemSize.trim()})` : itemName.trim();
      if (editingItem) {
        await updateItem({
          itemId: editingItem,
          name: itemName.trim(),
          categoryId: itemCategoryId as Id<"equipmentCategories">,
          description: itemDescription.trim() || undefined,
          size: itemSize.trim() || undefined,
          minimumStock: itemMinimumStock,
          unit: itemUnit.trim() || undefined,
        });
        toast.success(`"${label}" updated`);
      } else {
        await createItem({
          name: itemName.trim(),
          categoryId: itemCategoryId as Id<"equipmentCategories">,
          description: itemDescription.trim() || undefined,
          size: itemSize.trim() || undefined,
          initialStock: itemInitialStock,
          minimumStock: itemMinimumStock,
          unit: itemUnit.trim() || undefined,
        });
        toast.success(`"${label}" created`);
      }
      setShowItemDialog(false);
      resetItemForm();
    } catch (error: any) {
      toast.error(error?.message || "Failed to save item");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteItem = async () => {
    if (!deleteItemId) return;
    try {
      await deleteItem({ itemId: deleteItemId });
      toast.success("Item deleted");
    } catch (error: any) {
      toast.error(error?.message || "Failed to delete item");
    } finally {
      setDeleteItemId(null);
    }
  };

  if (!categories || !items) {
    return (
      <div className="flex items-center justify-center py-8">
        <Spinner className="size-8 text-muted-foreground" />
      </div>
    );
  }

  // Group items by category
  const itemsByCategory = new Map<string, typeof items>();
  for (const item of items) {
    if (!itemsByCategory.has(item.categoryId)) {
      itemsByCategory.set(item.categoryId, []);
    }
    itemsByCategory.get(item.categoryId)!.push(item);
  }

  const deleteCategoryName = deleteCategoryId
    ? categories.find(c => c._id === deleteCategoryId)?.name
    : null;

  const deleteItemName = deleteItemId
    ? (() => {
        const item = items.find(i => i._id === deleteItemId);
        return item ? (item.size ? `${item.name} (${item.size})` : item.name) : null;
      })()
    : null;

  return (
    <div className="space-y-4">
      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => handleOpenCategoryDialog()} size="sm">
          <FolderPlus className="h-4 w-4 mr-2" />
          Add Category
        </Button>
        <Button onClick={() => handleOpenItemDialog()} size="sm" variant="outline">
          <Package className="h-4 w-4 mr-2" />
          Add Item
        </Button>
      </div>

      {/* Categories & Items */}
      {categories.length === 0 ? (
        <EmptyState
          icon={<FolderPlus />}
          title="No categories yet"
          description="Create a category to start adding equipment items."
        />
      ) : (
        <Accordion type="multiple" defaultValue={categories.map((c) => c._id)} className="space-y-2">
          {[...categories].sort((a, b) => a.name.localeCompare(b.name)).map((category) => {
            const categoryItems = itemsByCategory.get(category._id) || [];
            const lowCount = categoryItems.filter(i => i.isLowStock).length;

            return (
              <AccordionItem
                key={category._id}
                value={category._id}
                className="border rounded-lg overflow-hidden"
              >
                <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/50">
                  <div className="flex items-center gap-3 flex-1">
                    <span className="font-semibold">{category.name}</span>
                    <Badge variant="secondary" className="text-xs">
                      {categoryItems.length} items
                    </Badge>
                    {lowCount > 0 && (
                      <Badge variant="destructive" className="text-xs flex items-center gap-1">
                        <TriangleAlert className="h-3 w-3" />
                        {lowCount} low
                      </Badge>
                    )}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  {/* Category actions */}
                  <div className="flex gap-2 mb-3 pb-3 border-b border-border">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpenCategoryDialog(category._id)}
                      className="h-8 text-xs"
                    >
                      <Pencil className="h-3 w-3 mr-1" />
                      Edit Category
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteCategoryId(category._id)}
                      className="h-8 text-xs text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3 mr-1" />
                      Delete
                    </Button>
                  </div>

                  {categoryItems.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No items in this category.{" "}
                      <button
                        onClick={() => {
                          resetItemForm();
                          setItemCategoryId(category._id);
                          setShowItemDialog(true);
                        }}
                        className="text-primary underline underline-offset-2 hover:no-underline"
                      >
                        Add one
                      </button>
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {categoryItems.map((item) => (
                        <div
                          key={item._id}
                          className="flex items-center justify-between p-3 bg-muted/30 rounded-lg group"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-medium text-sm truncate">
                                {item.name}
                                {item.size && (
                                  <span className="text-muted-foreground ml-1">({item.size})</span>
                                )}
                              </p>
                              {item.isLowStock && (
                                <Badge variant="destructive" className="text-xs flex items-center gap-1">
                                  <TriangleAlert className="h-3 w-3" />
                                  Low
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Stock: <span className={item.isLowStock ? "text-destructive font-medium" : ""}>{item.currentStock}</span>
                              {item.minimumStock !== undefined && <span> / {item.minimumStock} min</span>}
                              {item.unit && <span> {item.unit}</span>}
                            </p>
                          </div>
                          <div className="flex gap-0.5 shrink-0 ml-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleOpenItemDialog(item._id)}
                              title="Edit item"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleOpenItemDialog(item._id, true)}
                              title="Clone as new size variant"
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => setDeleteItemId(item._id)}
                              title="Delete item"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}

      {/* Delete Category Confirmation */}
      <ConfirmDialog
        open={!!deleteCategoryId}
        onOpenChange={(open) => { if (!open) setDeleteCategoryId(null); }}
        title="Delete Category?"
        description={<>Are you sure you want to delete "{deleteCategoryName}"? This cannot be undone. Categories with items cannot be deleted. Move or delete items first.</>}
        confirmLabel="Delete Category"
        tone="destructive"
        onConfirm={handleDeleteCategory}
      />

      {/* Delete Item Confirmation */}
      <ConfirmDialog
        open={!!deleteItemId}
        onOpenChange={(open) => { if (!open) setDeleteItemId(null); }}
        title="Delete Item?"
        description={<>Are you sure you want to delete "{deleteItemName}"? All transaction history for this item will be permanently lost.</>}
        confirmLabel="Delete Item"
        tone="destructive"
        onConfirm={handleDeleteItem}
      />

      {/* Category Dialog */}
      <ResponsiveModal
        open={showCategoryDialog}
        onClose={() => setShowCategoryDialog(false)}
        drawerHeight="max-h-[85vh]"
        title={editingCategory ? "Edit Category" : "Add Category"}
        footer={
          <>
            <Button variant="outline" onClick={() => setShowCategoryDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveCategory} disabled={isSubmitting || !categoryName.trim()}>
              {isSubmitting ? "Saving..." : "Save"}
            </Button>
          </>
        }
      >
          <div className="space-y-4 pb-4">
            <p className="text-sm text-muted-foreground">
              Categories help organize equipment items.
            </p>
            <Field>
              <FieldLabel htmlFor="categoryName">Name *</FieldLabel>
              <Input
                id="categoryName"
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                placeholder="e.g., PPE, Batteries, Tools"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="categoryDescription">Description</FieldLabel>
              <Textarea
                id="categoryDescription"
                value={categoryDescription}
                onChange={(e) => setCategoryDescription(e.target.value)}
                placeholder="Optional description"
                rows={2}
              />
            </Field>
            <div className="flex items-center gap-3 pt-2">
              <input
                type="checkbox"
                id="categoryCollapse"
                checked={categoryCollapseItems}
                onChange={(e) => setCategoryCollapseItems(e.target.checked)}
                className="h-4 w-4 rounded border-border"
              />
              <div>
                <Label htmlFor="categoryCollapse" className="cursor-pointer">Group items together</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Items appear as a single row in Take/Replenish. Useful for categories with diverse, unrelated items.
                </p>
              </div>
            </div>
          </div>
      </ResponsiveModal>

      {/* Item Dialog */}
      <ResponsiveModal
        open={showItemDialog}
        onClose={() => setShowItemDialog(false)}
        title={editingItem ? "Edit Item" : "Add Item"}
        footer={
          <>
            <Button variant="outline" onClick={() => setShowItemDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveItem}
              disabled={isSubmitting || !itemName.trim() || !itemCategoryId}
            >
              {isSubmitting ? "Saving..." : "Save"}
            </Button>
          </>
        }
      >
          <div className="space-y-4 pb-4">
            <p className="text-sm text-muted-foreground">
              {editingItem ? "Update this equipment item." : "Add equipment items to track. Use Clone to quickly create size variants."}
            </p>
            <Field>
              <FieldLabel htmlFor="itemName">Name *</FieldLabel>
              <Input
                id="itemName"
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                placeholder="e.g., Gloves, AA Batteries"
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="itemCategory">Category *</FieldLabel>
              <Select
                value={itemCategoryId}
                onValueChange={(value) => setItemCategoryId(value as Id<"equipmentCategories">)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat._id} value={cat._id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel htmlFor="itemSize">Size (optional)</FieldLabel>
              <Input
                id="itemSize"
                value={itemSize}
                onChange={(e) => setItemSize(e.target.value)}
                placeholder="e.g., XL, Medium, 9V"
              />
            </Field>

            {!editingItem && (
              <Field>
                <FieldLabel htmlFor="itemInitialStock">Initial Stock</FieldLabel>
                <Input
                  id="itemInitialStock"
                  type="number"
                  value={itemInitialStock}
                  onChange={(e) => setItemInitialStock(parseInt(e.target.value) || 0)}
                  min={0}
                />
              </Field>
            )}

            <Field>
              <FieldLabel htmlFor="itemMinimumStock">Minimum Stock (optional)</FieldLabel>
              <Input
                id="itemMinimumStock"
                type="number"
                value={itemMinimumStock ?? ""}
                onChange={(e) => setItemMinimumStock(e.target.value ? parseInt(e.target.value) : undefined)}
                placeholder="Alert when stock falls below"
                min={0}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="itemUnit">Unit (optional)</FieldLabel>
              <Input
                id="itemUnit"
                value={itemUnit}
                onChange={(e) => setItemUnit(e.target.value)}
                placeholder="e.g., pairs, units, boxes"
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="itemDescription">Description (optional)</FieldLabel>
              <Textarea
                id="itemDescription"
                value={itemDescription}
                onChange={(e) => setItemDescription(e.target.value)}
                placeholder="Additional details"
                rows={2}
              />
            </Field>
          </div>
      </ResponsiveModal>
    </div>
  );
}

export default EquipmentManageTab;
