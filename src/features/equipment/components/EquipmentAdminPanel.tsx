import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Plus, Pencil, Trash2, Package, FolderPlus } from "lucide-react";

export function EquipmentAdminPanel() {
  const categories = useQuery(api.equipment.getAllCategories);
  const items = useQuery(api.equipment.getItems);

  const createCategory = useMutation(api.equipment.createCategory);
  const updateCategory = useMutation(api.equipment.updateCategory);
  const deleteCategory = useMutation(api.equipment.deleteCategory);
  const createItem = useMutation(api.equipment.createItem);
  const updateItem = useMutation(api.equipment.updateItem);
  const deleteItem = useMutation(api.equipment.deleteItem);

  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  const [showItemDialog, setShowItemDialog] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Id<"equipmentCategories"> | null>(null);
  const [editingItem, setEditingItem] = useState<Id<"equipmentItems"> | null>(null);

  // Category form state
  const [categoryName, setCategoryName] = useState("");
  const [categoryDescription, setCategoryDescription] = useState("");

  // Item form state
  const [itemName, setItemName] = useState("");
  const [itemCategoryId, setItemCategoryId] = useState<Id<"equipmentCategories"> | "">("");
  const [itemDescription, setItemDescription] = useState("");
  const [itemSize, setItemSize] = useState("");
  const [itemInitialStock, setItemInitialStock] = useState(0);
  const [itemMinimumStock, setItemMinimumStock] = useState<number | undefined>(undefined);
  const [itemUnit, setItemUnit] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetCategoryForm = () => {
    setCategoryName("");
    setCategoryDescription("");
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
        setEditingCategory(categoryId);
      }
    } else {
      resetCategoryForm();
    }
    setShowCategoryDialog(true);
  };

  const handleOpenItemDialog = (itemId?: Id<"equipmentItems">) => {
    if (itemId && items) {
      const item = items.find((i) => i._id === itemId);
      if (item) {
        setItemName(item.name);
        setItemCategoryId(item.categoryId);
        setItemDescription(item.description || "");
        setItemSize(item.size || "");
        setItemMinimumStock(item.minimumStock);
        setItemUnit(item.unit || "");
        setEditingItem(itemId);
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
        });
      } else {
        await createCategory({
          name: categoryName.trim(),
          description: categoryDescription.trim() || undefined,
        });
      }
      setShowCategoryDialog(false);
      resetCategoryForm();
    } catch (error) {
      console.error("Failed to save category:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCategory = async (categoryId: Id<"equipmentCategories">) => {
    if (!confirm("Are you sure you want to delete this category? This cannot be undone.")) return;
    try {
      await deleteCategory({ categoryId });
    } catch (error) {
      alert("Cannot delete category with items. Please move or delete items first.");
    }
  };

  const handleSaveItem = async () => {
    if (!itemName.trim() || !itemCategoryId) return;
    setIsSubmitting(true);
    try {
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
      }
      setShowItemDialog(false);
      resetItemForm();
    } catch (error) {
      console.error("Failed to save item:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteItem = async (itemId: Id<"equipmentItems">) => {
    if (!confirm("Are you sure you want to delete this item? All transaction history will be lost.")) return;
    try {
      await deleteItem({ itemId });
    } catch (error) {
      console.error("Failed to delete item:", error);
    }
  };

  const handleToggleItemActive = async (itemId: Id<"equipmentItems">, currentlyActive: boolean) => {
    try {
      await updateItem({
        itemId,
        isActive: !currentlyActive,
      });
    } catch (error) {
      console.error("Failed to toggle item:", error);
    }
  };

  if (!categories || !items) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
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

  return (
    <div className="space-y-6">
      {/* Action Buttons */}
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

      {/* Categories and Items */}
      {categories.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <p>No categories yet. Create a category to get started.</p>
        </div>
      ) : (
        <Accordion type="multiple" defaultValue={categories.map((c) => c._id)} className="space-y-2">
          {categories.map((category) => {
            const categoryItems = itemsByCategory.get(category._id) || [];
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
                    {!category.isActive && (
                      <Badge variant="outline" className="text-xs">
                        Inactive
                      </Badge>
                    )}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <div className="flex gap-2 mb-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpenCategoryDialog(category._id)}
                    >
                      <Pencil className="h-3 w-3 mr-1" />
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteCategory(category._id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3 mr-1" />
                      Delete
                    </Button>
                  </div>

                  {categoryItems.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No items in this category</p>
                  ) : (
                    <div className="space-y-2">
                      {categoryItems.map((item) => (
                        <div
                          key={item._id}
                          className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">
                              {item.name}
                              {item.size && (
                                <span className="text-muted-foreground ml-1">({item.size})</span>
                              )}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Stock: {item.currentStock}
                              {item.minimumStock !== undefined && ` (min: ${item.minimumStock})`}
                              {item.unit && ` ${item.unit}`}
                            </p>
                          </div>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleOpenItemDialog(item._id)}
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => handleDeleteItem(item._id)}
                            >
                              <Trash2 className="h-3 w-3" />
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

      {/* Category Dialog */}
      <Dialog open={showCategoryDialog} onOpenChange={setShowCategoryDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? "Edit Category" : "Add Category"}
            </DialogTitle>
            <DialogDescription>
              Categories help organize equipment items.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="categoryName">Name *</Label>
              <Input
                id="categoryName"
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                placeholder="e.g., PPE, Batteries, Tools"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="categoryDescription">Description</Label>
              <Textarea
                id="categoryDescription"
                value={categoryDescription}
                onChange={(e) => setCategoryDescription(e.target.value)}
                placeholder="Optional description"
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCategoryDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveCategory} disabled={isSubmitting || !categoryName.trim()}>
              {isSubmitting ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Item Dialog */}
      <Dialog open={showItemDialog} onOpenChange={setShowItemDialog}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? "Edit Item" : "Add Item"}
            </DialogTitle>
            <DialogDescription>
              Add equipment items to track in the cupboard.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="itemName">Name *</Label>
              <Input
                id="itemName"
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                placeholder="e.g., Gloves, AA Batteries"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="itemCategory">Category *</Label>
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
            </div>

            <div className="space-y-2">
              <Label htmlFor="itemSize">Size (optional)</Label>
              <Input
                id="itemSize"
                value={itemSize}
                onChange={(e) => setItemSize(e.target.value)}
                placeholder="e.g., XL, Medium, 9V"
              />
            </div>

            {!editingItem && (
              <div className="space-y-2">
                <Label htmlFor="itemInitialStock">Initial Stock</Label>
                <Input
                  id="itemInitialStock"
                  type="number"
                  value={itemInitialStock}
                  onChange={(e) => setItemInitialStock(parseInt(e.target.value) || 0)}
                  min={0}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="itemMinimumStock">Minimum Stock (optional)</Label>
              <Input
                id="itemMinimumStock"
                type="number"
                value={itemMinimumStock ?? ""}
                onChange={(e) => setItemMinimumStock(e.target.value ? parseInt(e.target.value) : undefined)}
                placeholder="Alert when stock falls below"
                min={0}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="itemUnit">Unit (optional)</Label>
              <Input
                id="itemUnit"
                value={itemUnit}
                onChange={(e) => setItemUnit(e.target.value)}
                placeholder="e.g., pairs, units, boxes"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="itemDescription">Description (optional)</Label>
              <Textarea
                id="itemDescription"
                value={itemDescription}
                onChange={(e) => setItemDescription(e.target.value)}
                placeholder="Additional details"
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowItemDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveItem}
              disabled={isSubmitting || !itemName.trim() || !itemCategoryId}
            >
              {isSubmitting ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
