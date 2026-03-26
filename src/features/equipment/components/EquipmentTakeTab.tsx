import { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
} from "@/components/ui/drawer";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Search, Minus, Plus, X, TriangleAlert, Package, ChevronRight, Clock } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

interface ItemVariant {
  _id: Id<"equipmentItems">;
  size?: string;
  label: string; // Display label: size for normal items, item name (+size) for collapsed categories
  currentStock: number;
  unit?: string;
  isLowStock: boolean;
}

interface GroupedItem {
  name: string;
  categoryName?: string;
  variants: ItemVariant[];
  totalStock: number;
  hasLowStock: boolean;
  hasSizes: boolean; // true if variants have meaningful labels to pick from
  isCollapsedCategory: boolean; // true if grouped by category (collapseItems)
}

export function EquipmentTakeTab() {
  const isMobile = useIsMobile();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGroup, setSelectedGroup] = useState<GroupedItem | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<ItemVariant | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const items = useQuery(api.equipment.getItems);
  const takeItem = useMutation(api.equipment.takeItem);
  const myRecentTakes = useQuery(api.equipment.getMyRecentTakes, { limit: 5 });

  // Group items by name (or by category for collapsed categories)
  const groupedItems = useMemo(() => {
    if (!items) return [];
    
    const groups = new Map<string, GroupedItem>();
    
    for (const item of items) {
      // For collapsed categories, group by categoryId; otherwise group by item name
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
      // For collapsed categories, label = item name (+ size); for normal, label = size
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
      // For collapsed categories, always show picker if >1 variant
      // For normal items, show picker if any variant has a size
      if (isCollapsed) {
        if (group.variants.length > 1) group.hasSizes = true;
      } else {
        if (item.size) group.hasSizes = true;
      }
    }
    
    // Sort variants
    for (const group of groups.values()) {
      if (group.isCollapsedCategory) {
        // For collapsed categories, sort alphabetically by label
        group.variants.sort((a, b) => a.label.localeCompare(b.label));
      } else {
        // For normal groups, sort by size
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
      // After all variants are added, recalculate hasSizes for collapsed categories
      if (group.isCollapsedCategory) {
        group.hasSizes = group.variants.length > 1;
      }
    }
    
    return Array.from(groups.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [items]);

  // Filter groups based on search
  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return groupedItems;
    
    const query = searchQuery.toLowerCase();
    return groupedItems.filter(group => 
      group.name.toLowerCase().includes(query) ||
      (group.categoryName && group.categoryName.toLowerCase().includes(query)) ||
      group.variants.some(v => v.label.toLowerCase().includes(query))
    );
  }, [groupedItems, searchQuery]);

  const handleSelectGroup = (group: GroupedItem) => {
    if (group.totalStock === 0) return;
    
    setSelectedGroup(group);
    
    // If only one variant (no sizes), auto-select it
    if (!group.hasSizes || group.variants.length === 1) {
      const variant = group.variants.find(v => v.currentStock > 0) || group.variants[0];
      setSelectedVariant(variant);
    } else {
      setSelectedVariant(null);
    }
    setQuantity(1);
  };

  const handleSelectVariant = (variant: ItemVariant) => {
    if (variant.currentStock === 0) return;
    setSelectedVariant(variant);
    setQuantity(1);
  };

  const handleClose = () => {
    setSelectedGroup(null);
    setSelectedVariant(null);
    setQuantity(1);
    setNotes("");
  };

  const handleBack = () => {
    setSelectedVariant(null);
    setQuantity(1);
    setNotes("");
  };

  const handleTake = async () => {
    if (!selectedVariant || quantity <= 0 || quantity > selectedVariant.currentStock) return;
    
    setIsSubmitting(true);
    try {
      await takeItem({
        itemId: selectedVariant._id,
        quantity,
        notes: notes.trim() || undefined,
      });
      const label = selectedGroup?.isCollapsedCategory ? selectedVariant.label : (selectedGroup?.name || "Item");
      toast.success(`Took ${quantity} ${selectedVariant.unit || "units"} of ${label}`);
      handleClose();
    } catch (error: any) {
      toast.error(error?.message || "Failed to take item");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!items) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const unitLabel = selectedVariant?.unit || "units";

  // Size/item selection content
  const sizeSelectionContent = selectedGroup && !selectedVariant && selectedGroup.hasSizes && (
    <div className="space-y-4 py-4">
      <div className="text-center mb-4">
        <h3 className="text-lg font-semibold">{selectedGroup.name}</h3>
        <p className="text-sm text-muted-foreground">
          {selectedGroup.isCollapsedCategory ? "Select an item" : "Select a size"}
        </p>
      </div>
      
      <div className={`grid gap-2 px-4 ${selectedGroup.isCollapsedCategory ? 'grid-cols-2' : 'grid-cols-3'}`}>
        {selectedGroup.variants.map((variant) => (
          <button
            key={variant._id}
            onClick={() => handleSelectVariant(variant)}
            disabled={variant.currentStock === 0}
            className={`p-3 rounded-lg border text-center transition-colors ${
              variant.currentStock === 0
                ? "bg-muted/30 border-border opacity-50 cursor-not-allowed"
                : "bg-card border-border hover:border-red-500/50 hover:bg-red-500/5 active:bg-red-500/10"
            }`}
          >
            <span className={`font-semibold ${selectedGroup.isCollapsedCategory ? 'text-sm' : 'text-lg'}`}>
              {variant.label || "—"}
            </span>
            <p className={`text-xs mt-1 ${variant.isLowStock ? "text-destructive" : "text-muted-foreground"}`}>
              {variant.currentStock} left
            </p>
          </button>
        ))}
      </div>
    </div>
  );

  // Quantity selector content
  const quantityContent = selectedVariant && (
    <div className="space-y-6 py-4">
      {/* Item info */}
      <div className="text-center">
        <h3 className="text-lg font-semibold">
          {selectedGroup?.isCollapsedCategory ? selectedVariant.label : selectedGroup?.name}
          {!selectedGroup?.isCollapsedCategory && selectedVariant.size && (
            <span className="text-muted-foreground ml-1">({selectedVariant.size})</span>
          )}
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          {selectedVariant.currentStock} {unitLabel} available
        </p>
      </div>

      {/* Quantity stepper */}
      <div className="flex items-center justify-center gap-4">
        <Button
          variant="outline"
          size="icon"
          className="h-14 w-14 rounded-full text-xl"
          onClick={() => setQuantity(Math.max(1, quantity - 1))}
          disabled={quantity <= 1}
        >
          <Minus className="h-6 w-6" />
        </Button>
        <div className="w-20 text-center">
          <span className="text-4xl font-bold">{quantity}</span>
        </div>
        <Button
          variant="outline"
          size="icon"
          className="h-14 w-14 rounded-full text-xl"
          onClick={() => setQuantity(Math.min(selectedVariant.currentStock, quantity + 1))}
          disabled={quantity >= selectedVariant.currentStock}
        >
          <Plus className="h-6 w-6" />
        </Button>
      </div>

      {/* Quick quantity buttons */}
      {selectedVariant.currentStock > 1 && (
        <div className="flex justify-center gap-2">
          {[1, 2, 5, 10].filter(n => n <= selectedVariant.currentStock).map(n => (
            <Button
              key={n}
              variant={quantity === n ? "default" : "outline"}
              size="sm"
              onClick={() => setQuantity(n)}
              className="min-w-[3rem]"
            >
              {n}
            </Button>
          ))}
        </div>
      )}

      {/* Optional notes */}
      <div className="px-4">
        <Textarea
          placeholder="Optional: Why are you taking this? (e.g., training, incident)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="text-base"
        />
      </div>
    </div>
  );

  // Footer with take button or back button
  const drawerFooter = (
    <div className="flex gap-3 p-4 pb-8 md:pb-4 border-t border-gray-200 dark:border-gray-700 bg-background">
      {selectedVariant && selectedGroup?.hasSizes && selectedGroup.variants.length > 1 ? (
        <>
          <Button 
            variant="outline" 
            onClick={handleBack} 
            className="flex-1 h-12 text-base"
          >
            Back
          </Button>
          <Button
            onClick={handleTake}
            disabled={isSubmitting || quantity <= 0 || quantity > selectedVariant.currentStock}
            className="flex-1 h-12 text-base bg-red-700 hover:bg-red-800"
          >
            {isSubmitting ? "Taking..." : `Take ${quantity}`}
          </Button>
        </>
      ) : selectedVariant ? (
        <>
          <Button 
            variant="outline" 
            onClick={handleClose} 
            className="flex-1 h-12 text-base"
          >
            Cancel
          </Button>
          <Button
            onClick={handleTake}
            disabled={isSubmitting || quantity <= 0 || quantity > selectedVariant.currentStock}
            className="flex-1 h-12 text-base bg-red-700 hover:bg-red-800"
          >
            {isSubmitting ? "Taking..." : `Take ${quantity}`}
          </Button>
        </>
      ) : (
        <Button 
          variant="outline" 
          onClick={handleClose} 
          className="flex-1 h-12 text-base"
        >
          Cancel
        </Button>
      )}
    </div>
  );

  // Drawer/Dialog content
  const modalContent = selectedGroup && (
    <>
      {sizeSelectionContent}
      {quantityContent}
    </>
  );

  return (
    <div className="space-y-4">
      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search items..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 h-12 text-base"
        />
        {searchQuery && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
            onClick={() => setSearchQuery("")}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Recent takes */}
      {!searchQuery && myRecentTakes && myRecentTakes.length > 0 && (
        <div className="space-y-1.5">
          <h3 className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 px-1">
            <Clock className="h-3 w-3" />
            Your Recent Takes
          </h3>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {myRecentTakes.map((take) => (
              <div
                key={take._id}
                className="flex-shrink-0 px-3 py-1.5 rounded-full bg-muted text-xs text-muted-foreground border"
              >
                <span className="font-medium text-foreground">{take.quantity}</span>
                {" "}{take.itemName}
                {take.itemSize && <span className="opacity-60"> ({take.itemSize})</span>}
                <span className="ml-1.5 opacity-50">{formatDistanceToNow(take.createdAt, { addSuffix: true })}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Grouped items list */}
      {filteredGroups.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium">
            {searchQuery ? "No items match your search" : "No equipment items yet"}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredGroups.map((group) => (
            <button
              key={group.name}
              onClick={() => handleSelectGroup(group)}
              disabled={group.totalStock === 0}
              className={`w-full flex items-center justify-between p-4 rounded-lg border transition-colors text-left ${
                group.totalStock === 0
                  ? "bg-muted/30 border-border opacity-50 cursor-not-allowed"
                  : "bg-card border-border hover:border-red-500/50 hover:bg-red-500/5 active:bg-red-500/10"
              }`}
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
                      <TriangleAlert className="h-3 w-3" />
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
                  <span className={`text-lg font-semibold ${group.totalStock === 0 ? "text-muted-foreground" : "text-foreground"}`}>
                    {group.totalStock}
                  </span>
                  <p className="text-xs text-muted-foreground">total</p>
                </div>
                {group.hasSizes && group.totalStock > 0 && (
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Mobile: Drawer */}
      {isMobile && selectedGroup && (
        <Drawer open onOpenChange={(open) => { if (!open) handleClose(); }}>
          <DrawerContent className="border-gray-700">
            <DrawerHeader className="border-b border-gray-200 dark:border-gray-700 pb-4">
              <div className="flex items-center justify-between">
                <DrawerTitle className="text-xl font-bold">Take Item</DrawerTitle>
                <Button variant="ghost" size="icon" onClick={handleClose} className="h-10 w-10">
                  <X className="h-6 w-6" />
                </Button>
              </div>
            </DrawerHeader>
            <div className="px-4">
              {modalContent}
            </div>
            <DrawerFooter className="p-0">
              {drawerFooter}
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      )}

      {/* Desktop: Dialog */}
      {!isMobile && selectedGroup && (
        <Dialog open onOpenChange={(open) => { if (!open) handleClose(); }}>
          <DialogContent className="max-w-sm p-0 dark:border-gray-700">
            <DialogHeader className="p-6 pb-0">
              <DialogTitle className="text-xl font-bold">Take Item</DialogTitle>
            </DialogHeader>
            <div className="px-6">
              {modalContent}
            </div>
            <div>
              {drawerFooter}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
