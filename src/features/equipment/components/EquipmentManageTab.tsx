import { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { useIsMobile } from "@/hooks/use-mobile";
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
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
} from "@/components/ui/drawer";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Minus, Pencil, Trash2, Package, FolderPlus, X, Search, AlertTriangle, Copy, ChevronRight } from "lucide-react";

interface ReplenishVariant {
  _id: Id<"equipmentItems">;
  size?: string;
  label: string;
  currentStock: number;
  unit?: string;
  isLowStock: boolean;
}

interface ReplenishGroup {
  name: string;
  categoryName?: string;
  variants: ReplenishVariant[];
  totalStock: number;
  hasLowStock: boolean;
  hasSizes: boolean;
  isCollapsedCategory: boolean;
}

export function EquipmentManageTab() {
  const isMobile = useIsMobile();
  
  const categories = useQuery(api.equipment.getAllCategories);
  const items = useQuery(api.equipment.getItems);

  const createCategory = useMutation(api.equipment.createCategory);
  const updateCategory = useMutation(api.equipment.updateCategory);
  const deleteCategory = useMutation(api.equipment.deleteCategory);
  const createItem = useMutation(api.equipment.createItem);
  const updateItem = useMutation(api.equipment.updateItem);
  const deleteItem = useMutation(api.equipment.deleteItem);
  const replenishItem = useMutation(api.equipment.replenishItem);

  const [manageTab, setManageTab] = useState<"replenish" | "items">("replenish");
  
  // Replenish state - grouped by name like Take tab
  const [replenishSearch, setReplenishSearch] = useState("");
  const [selectedReplenishGroup, setSelectedReplenishGroup] = useState<ReplenishGroup | null>(null);
  const [selectedReplenishVariant, setSelectedReplenishVariant] = useState<ReplenishVariant | null>(null);
  const [replenishQuantity, setReplenishQuantity] = useState(1);
  const [replenishNotes, setReplenishNotes] = useState("");

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

  // Group items by name for replenish (or by category for collapsed categories)
  const groupedReplenishItems = useMemo(() => {
    if (!items) return [];

    const groups = new Map<string, ReplenishGroup>();

    for (const item of items) {
      const isCollapsed = item.categoryCollapseItems;
      const key = isCollapsed ? `cat:${item.categoryId}` : item.name;

      if (!groups.has(key)) {
        groups.set(key, {
          name: isCollapsed ? item.categoryName : item.name,
          categoryName: isCollapsed ? undefined : item.categoryName,
          variants: [],
          totalStock: 0,
          hasLowStock: false,
          hasSizes: false,
          isCollapsedCategory: isCollapsed,
        });
      }

      const group = groups.get(key)!;
      const label = isCollapsed
        ? (item.size ? `${item.name} (${item.size})` : item.name)
        : (item.size || "");

      group.variants.push({
        _id: item._id,
        size: item.size,
        label,
        currentStock: item.currentStock,
        unit: item.unit,
        isLowStock: item.isLowStock,
      });
      group.totalStock += item.currentStock;
      if (item.isLowStock) group.hasLowStock = true;
      if (isCollapsed) {
        if (group.variants.length > 1) group.hasSizes = true;
      } else {
        if (item.size) group.hasSizes = true;
      }
    }

    // Sort variants
    for (const group of groups.values()) {
      if (group.isCollapsedCategory) {
        group.variants.sort((a, b) => a.label.localeCompare(b.label));
      } else {
        group.variants.sort((a, b) => {
          if (!a.size && !b.size) return 0;
          if (!a.size) return -1;
          if (!b.size) return 1;
          const numA = parseFloat(a.size);
          const numB = parseFloat(b.size);
          if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
          const sizeOrder = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL', '3XL'];
          const indexA = sizeOrder.indexOf(a.size.toUpperCase());
          const indexB = sizeOrder.indexOf(b.size.toUpperCase());
          if (indexA !== -1 && indexB !== -1) return indexA - indexB;
          return a.size.localeCompare(b.size);
        });
      }
      if (group.isCollapsedCategory) {
        group.hasSizes = group.variants.length > 1;
      }
    }

    return Array.from(groups.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [items]);

  // Filter groups based on search
  const filteredReplenishGroups = useMemo(() => {
    if (!replenishSearch.trim()) return groupedReplenishItems;
    const query = replenishSearch.toLowerCase();
    return groupedReplenishItems.filter(group =>
      group.name.toLowerCase().includes(query) ||
      (group.categoryName && group.categoryName.toLowerCase().includes(query)) ||
      group.variants.some(v => v.label.toLowerCase().includes(query))
    );
  }, [groupedReplenishItems, replenishSearch]);

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
        // Clear size when cloning so user enters new size
        setItemSize(clone ? "" : (item.size || ""));
        setItemMinimumStock(item.minimumStock);
        setItemUnit(item.unit || "");
        // Don't set editingItem when cloning - treat as new item
        setEditingItem(clone ? null : itemId);
        // Reset initial stock for clones
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
      } else {
        await createCategory({
          name: categoryName.trim(),
          description: categoryDescription.trim() || undefined,
          collapseItems: categoryCollapseItems,
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

  const handleSelectReplenishGroup = (group: ReplenishGroup) => {
    setSelectedReplenishGroup(group);
    // If only one variant (no sizes), auto-select it
    if (!group.hasSizes || group.variants.length === 1) {
      setSelectedReplenishVariant(group.variants[0]);
    } else {
      setSelectedReplenishVariant(null);
    }
    setReplenishQuantity(1);
    setReplenishNotes("");
  };

  const handleSelectReplenishVariant = (variant: ReplenishVariant) => {
    setSelectedReplenishVariant(variant);
    setReplenishQuantity(1);
  };

  const handleCloseReplenish = () => {
    setSelectedReplenishGroup(null);
    setSelectedReplenishVariant(null);
    setReplenishQuantity(1);
    setReplenishNotes("");
  };

  const handleReplenishBack = () => {
    setSelectedReplenishVariant(null);
    setReplenishQuantity(1);
    setReplenishNotes("");
  };

  const handleReplenish = async () => {
    if (!selectedReplenishVariant || replenishQuantity <= 0) return;
    setIsSubmitting(true);
    try {
      await replenishItem({
        itemId: selectedReplenishVariant._id,
        quantity: replenishQuantity,
        notes: replenishNotes.trim() || undefined,
      });
      handleCloseReplenish();
    } catch (error) {
      console.error("Failed to replenish:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!categories || !items) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Group items by category for the items tab
  const itemsByCategory = new Map<string, typeof items>();
  for (const item of items) {
    if (!itemsByCategory.has(item.categoryId)) {
      itemsByCategory.set(item.categoryId, []);
    }
    itemsByCategory.get(item.categoryId)!.push(item);
  }

  const unitLabel = selectedReplenishVariant?.unit || "units";

  // Size/item selection content for replenish
  const replenishSizeContent = selectedReplenishGroup && !selectedReplenishVariant && selectedReplenishGroup.hasSizes && (
    <div className="space-y-4 py-4">
      <div className="text-center mb-4">
        <h3 className="text-lg font-semibold">{selectedReplenishGroup.name}</h3>
        <p className="text-sm text-muted-foreground">
          {selectedReplenishGroup.isCollapsedCategory ? "Select an item to replenish" : "Select a size to replenish"}
        </p>
      </div>

      <div className={`grid gap-2 px-4 ${selectedReplenishGroup.isCollapsedCategory ? 'grid-cols-2' : 'grid-cols-3'}`}>
        {selectedReplenishGroup.variants.map((variant) => (
          <button
            key={variant._id}
            onClick={() => handleSelectReplenishVariant(variant)}
            className="p-3 rounded-lg border text-center transition-colors bg-card border-border hover:border-green-500/50 hover:bg-green-500/5 active:bg-green-500/10"
          >
            <span className={`font-semibold ${selectedReplenishGroup.isCollapsedCategory ? 'text-sm' : 'text-lg'}`}>
              {variant.label || "—"}
            </span>
            <p className={`text-xs mt-1 ${variant.isLowStock ? "text-destructive" : "text-muted-foreground"}`}>
              {variant.currentStock} in stock
            </p>
          </button>
        ))}
      </div>
    </div>
  );

  // Quantity content for replenish
  const replenishQuantityContent = selectedReplenishVariant && (
    <div className="space-y-6 py-4">
      <div className="text-center">
        <h3 className="text-lg font-semibold">
          {selectedReplenishGroup?.isCollapsedCategory ? selectedReplenishVariant.label : selectedReplenishGroup?.name}
          {!selectedReplenishGroup?.isCollapsedCategory && selectedReplenishVariant.size && (
            <span className="text-muted-foreground ml-1">({selectedReplenishVariant.size})</span>
          )}
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          Current stock: {selectedReplenishVariant.currentStock} {unitLabel}
        </p>
      </div>

      <div className="flex items-center justify-center gap-4">
        <Button
          variant="outline"
          size="icon"
          className="h-14 w-14 rounded-full text-xl"
          onClick={() => setReplenishQuantity(Math.max(1, replenishQuantity - 1))}
          disabled={replenishQuantity <= 1}
        >
          <Minus className="h-6 w-6" />
        </Button>
        <div className="w-20 text-center">
          <span className="text-4xl font-bold">{replenishQuantity}</span>
        </div>
        <Button
          variant="outline"
          size="icon"
          className="h-14 w-14 rounded-full text-xl"
          onClick={() => setReplenishQuantity(replenishQuantity + 1)}
        >
          <Plus className="h-6 w-6" />
        </Button>
      </div>

      <div className="flex justify-center gap-2">
        {[1, 5, 10, 20].map(n => (
          <Button
            key={n}
            variant={replenishQuantity === n ? "default" : "outline"}
            size="sm"
            onClick={() => setReplenishQuantity(n)}
            className="min-w-[3rem]"
          >
            {n}
          </Button>
        ))}
      </div>

      <div className="px-4">
        <Textarea
          placeholder="Optional: Add a note (e.g., supplier, date received)"
          value={replenishNotes}
          onChange={(e) => setReplenishNotes(e.target.value)}
          rows={2}
        />
      </div>
    </div>
  );

  // Modal content combines size selection and quantity
  const replenishModalContent = selectedReplenishGroup && (
    <>
      {replenishSizeContent}
      {replenishQuantityContent}
    </>
  );

  const replenishFooter = (
    <div className="flex gap-3 p-4 pb-8 md:pb-4 border-t border-gray-200 dark:border-gray-700 bg-background">
      {selectedReplenishVariant && selectedReplenishGroup?.hasSizes && selectedReplenishGroup.variants.length > 1 ? (
        <>
          <Button variant="outline" onClick={handleReplenishBack} className="flex-1 h-12 text-base">
            Back
          </Button>
          <Button
            onClick={handleReplenish}
            disabled={isSubmitting || replenishQuantity <= 0}
            className="flex-1 h-12 text-base bg-green-600 hover:bg-green-700"
          >
            {isSubmitting ? "Adding..." : `Add ${replenishQuantity}`}
          </Button>
        </>
      ) : selectedReplenishVariant ? (
        <>
          <Button variant="outline" onClick={handleCloseReplenish} className="flex-1 h-12 text-base">
            Cancel
          </Button>
          <Button
            onClick={handleReplenish}
            disabled={isSubmitting || replenishQuantity <= 0}
            className="flex-1 h-12 text-base bg-green-600 hover:bg-green-700"
          >
            {isSubmitting ? "Adding..." : `Add ${replenishQuantity}`}
          </Button>
        </>
      ) : (
        <Button variant="outline" onClick={handleCloseReplenish} className="flex-1 h-12 text-base">
          Cancel
        </Button>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Sub-tabs for Replenish vs Items management */}
      <Tabs value={manageTab} onValueChange={(v) => setManageTab(v as "replenish" | "items")}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="replenish">Replenish Stock</TabsTrigger>
          <TabsTrigger value="items">Categories & Items</TabsTrigger>
        </TabsList>

        {/* Replenish Tab */}
        <TabsContent value="replenish" className="mt-4 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search items to replenish..."
              value={replenishSearch}
              onChange={(e) => setReplenishSearch(e.target.value)}
              className="pl-10 h-12 text-base"
            />
            {replenishSearch && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                onClick={() => setReplenishSearch("")}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          {filteredReplenishGroups.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">
                {replenishSearch ? "No items match your search" : "No items to replenish"}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredReplenishGroups.map((group) => (
                <button
                  key={group.name}
                  onClick={() => handleSelectReplenishGroup(group)}
                  className="w-full flex items-center justify-between p-4 rounded-lg border transition-colors text-left bg-card border-border hover:border-green-500/50 hover:bg-green-500/5 active:bg-green-500/10"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-foreground">{group.name}</span>
                      {group.hasSizes && (
                        <Badge variant="secondary" className="text-xs">
                          {group.variants.length} {group.isCollapsedCategory ? 'items' : 'sizes'}
                        </Badge>
                      )}
                      {group.hasLowStock && (
                        <Badge variant="destructive" className="text-xs flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          Low
                        </Badge>
                      )}
                    </div>
                    {group.categoryName && (
                      <p className="text-sm text-muted-foreground mt-0.5">{group.categoryName}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-4">
                    <div className="text-right">
                      <span className="text-lg font-semibold">{group.totalStock}</span>
                      <p className="text-xs text-muted-foreground">total</p>
                    </div>
                    {group.hasSizes ? (
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <Plus className="h-5 w-5 text-green-600" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Items Management Tab */}
        <TabsContent value="items" className="mt-4 space-y-4">
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

          {categories.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No categories yet. Create a category to get started.</p>
            </div>
          ) : (
            <Accordion type="multiple" defaultValue={categories.map((c) => c._id)} className="space-y-2">
              {[...categories].sort((a, b) => a.name.localeCompare(b.name)).map((category) => {
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
                                  title="Edit"
                                >
                                  <Pencil className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => handleOpenItemDialog(item._id, true)}
                                  title="Clone with different size"
                                >
                                  <Copy className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:text-destructive"
                                  onClick={() => handleDeleteItem(item._id)}
                                  title="Delete"
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
        </TabsContent>
      </Tabs>

      {/* Replenish Drawer (Mobile) */}
      {isMobile && selectedReplenishGroup && (
        <Drawer open onOpenChange={(open) => { if (!open) handleCloseReplenish(); }}>
          <DrawerContent className="border-gray-700">
            <DrawerHeader className="border-b border-gray-200 dark:border-gray-700 pb-4">
              <div className="flex items-center justify-between">
                <DrawerTitle className="text-xl font-bold">Replenish Stock</DrawerTitle>
                <Button variant="ghost" size="icon" onClick={handleCloseReplenish} className="h-10 w-10">
                  <X className="h-6 w-6" />
                </Button>
              </div>
            </DrawerHeader>
            <div className="px-4">
              {replenishModalContent}
            </div>
            <DrawerFooter className="p-0">
              {replenishFooter}
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      )}

      {/* Replenish Dialog (Desktop) */}
      {!isMobile && selectedReplenishGroup && (
        <Dialog open onOpenChange={(open) => { if (!open) handleCloseReplenish(); }}>
          <DialogContent className="max-w-sm p-0 dark:border-gray-700">
            <DialogHeader className="p-6 pb-0">
              <DialogTitle className="text-xl font-bold">Replenish Stock</DialogTitle>
            </DialogHeader>
            <div className="px-6">
              {replenishModalContent}
            </div>
            <div>
              {replenishFooter}
            </div>
          </DialogContent>
        </Dialog>
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
              {editingItem 
                ? "Update this equipment item."
                : "Add equipment items to track. Use Clone to quickly create size variants."}
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
