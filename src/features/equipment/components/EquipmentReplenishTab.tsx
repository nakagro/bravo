import { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { ResponsiveModal } from "@/components/shared/ResponsiveModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Plus, Minus, X, Search, TriangleAlert, Package, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { Spinner } from "@/components/ui/spinner";

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

export function EquipmentReplenishTab() {
  const items = useQuery(api.equipment.getItems);
  const replenishItem = useMutation(api.equipment.replenishItem);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGroup, setSelectedGroup] = useState<ReplenishGroup | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<ReplenishVariant | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Group items by name (or by category for collapsed categories)
  const groupedItems = useMemo(() => {
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

  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return groupedItems;
    const query = searchQuery.toLowerCase();
    return groupedItems.filter(group =>
      group.name.toLowerCase().includes(query) ||
      (group.categoryName && group.categoryName.toLowerCase().includes(query)) ||
      group.variants.some(v => v.label.toLowerCase().includes(query))
    );
  }, [groupedItems, searchQuery]);

  const handleSelectGroup = (group: ReplenishGroup) => {
    setSelectedGroup(group);
    if (!group.hasSizes || group.variants.length === 1) {
      setSelectedVariant(group.variants[0]);
    } else {
      setSelectedVariant(null);
    }
    setQuantity(1);
    setNotes("");
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

  const handleReplenish = async () => {
    if (!selectedVariant || quantity <= 0) return;
    setIsSubmitting(true);
    try {
      await replenishItem({
        itemId: selectedVariant._id,
        quantity,
        notes: notes.trim() || undefined,
      });
      const label = selectedGroup?.isCollapsedCategory
        ? selectedVariant.label
        : (selectedGroup?.name || "Item");
      toast.success(`Added ${quantity} ${selectedVariant.unit || "units"} of ${label}`);
      handleClose();
    } catch (error: any) {
      toast.error(error?.message || "Failed to replenish item");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!items) {
    return (
      <div className="flex items-center justify-center py-8">
        <Spinner className="size-8 text-muted-foreground" />
      </div>
    );
  }

  const unitLabel = selectedVariant?.unit || "units";

  // Size/item selection content
  const sizeContent = selectedGroup && !selectedVariant && selectedGroup.hasSizes && (
    <div className="space-y-4 py-4">
      <div className="text-center mb-4">
        <h3 className="text-lg font-semibold">{selectedGroup.name}</h3>
        <p className="text-sm text-muted-foreground">
          {selectedGroup.isCollapsedCategory ? "Select an item to replenish" : "Select a size to replenish"}
        </p>
      </div>

      <div className={`grid gap-2 px-4 ${selectedGroup.isCollapsedCategory ? 'grid-cols-2' : 'grid-cols-3'}`}>
        {selectedGroup.variants.map((variant) => (
          <button
            key={variant._id}
            onClick={() => { setSelectedVariant(variant); setQuantity(1); }}
            className="p-3 rounded-lg border text-center transition-colors bg-card border-border hover:border-green-500/50 hover:bg-green-500/5 active:bg-green-500/10"
          >
            <span className={`font-semibold ${selectedGroup.isCollapsedCategory ? 'text-sm' : 'text-lg'}`}>
              {variant.label || "-"}
            </span>
            <p className={`text-xs mt-1 ${variant.isLowStock ? "text-destructive" : "text-muted-foreground"}`}>
              {variant.currentStock} in stock
            </p>
          </button>
        ))}
      </div>
    </div>
  );

  // Quantity content
  const quantityContent = selectedVariant && (
    <div className="space-y-6 py-4">
      <div className="text-center">
        <h3 className="text-lg font-semibold">
          {selectedGroup?.isCollapsedCategory ? selectedVariant.label : selectedGroup?.name}
          {!selectedGroup?.isCollapsedCategory && selectedVariant.size && (
            <span className="text-muted-foreground ml-1">({selectedVariant.size})</span>
          )}
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          Current stock: {selectedVariant.currentStock} {unitLabel}
        </p>
      </div>

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
          onClick={() => setQuantity(quantity + 1)}
        >
          <Plus className="h-6 w-6" />
        </Button>
      </div>

      <div className="flex justify-center gap-2">
        {[1, 5, 10, 20].map(n => (
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

      <div className="px-4">
        <Textarea
          placeholder="Optional: Add a note (e.g., supplier, date received)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
        />
      </div>
    </div>
  );

  const modalContent = (
    <>
      {sizeContent}
      {quantityContent}
    </>
  );

  const footer = (
    <>
      {selectedVariant && selectedGroup?.hasSizes && selectedGroup.variants.length > 1 ? (
        <>
          <Button variant="outline" onClick={handleBack}>
            Back
          </Button>
          <Button
            onClick={handleReplenish}
            disabled={isSubmitting || quantity <= 0}
            className="bg-green-600 hover:bg-green-700"
          >
            {isSubmitting ? "Adding..." : `Add ${quantity}`}
          </Button>
        </>
      ) : selectedVariant ? (
        <>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleReplenish}
            disabled={isSubmitting || quantity <= 0}
            className="bg-green-600 hover:bg-green-700"
          >
            {isSubmitting ? "Adding..." : `Add ${quantity}`}
          </Button>
        </>
      ) : (
        <Button variant="outline" onClick={handleClose}>
          Cancel
        </Button>
      )}
    </>
  );

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search items to replenish..."
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

      {/* Item list */}
      {filteredGroups.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium">
            {searchQuery ? "No items match your search" : "No items to replenish"}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredGroups.map((group) => (
            <button
              key={group.name}
              onClick={() => handleSelectGroup(group)}
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

      {selectedGroup && (
        <ResponsiveModal
          open
          onClose={handleClose}
          title="Replenish Stock"
          drawerHeight="max-h-[85vh]"
          maxWidth="sm:max-w-sm"
          footer={footer}
        >
          {modalContent}
        </ResponsiveModal>
      )}
    </div>
  );
}
