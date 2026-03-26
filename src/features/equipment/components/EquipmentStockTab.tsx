import { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { useIsMobile } from "@/hooks/use-mobile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { TriangleAlert, Package, Search, X, ChevronRight, Plus, Minus } from "lucide-react";
import { EquipmentItemHistory } from "./EquipmentItemHistory";
import { StepperInput } from "@/components/common/StepperInput";

interface SelectedItem {
  _id: Id<"equipmentItems">;
  name: string;
  size?: string;
  currentStock: number;
  minimumStock?: number;
  unit?: string;
  isLowStock: boolean;
}

export function EquipmentStockTab() {
  const isMobile = useIsMobile();
  const itemsByCategory = useQuery(api.equipment.getItemsByCategory);
  const replenishItem = useMutation(api.equipment.replenishItem);
  const [search, setSearch] = useState("");
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  const [selectedItem, setSelectedItem] = useState<SelectedItem | null>(null);
  const [restockQty, setRestockQty] = useState(1);
  const [isRestocking, setIsRestocking] = useState(false);

  const handleQuickRestock = async () => {
    if (!selectedItem || restockQty <= 0) return;
    setIsRestocking(true);
    try {
      await replenishItem({ itemId: selectedItem._id, quantity: restockQty });
      const label = selectedItem.size ? `${selectedItem.name} (${selectedItem.size})` : selectedItem.name;
      toast.success(`Added ${restockQty} ${selectedItem.unit || "units"} of ${label}`);
      setRestockQty(1);
    } catch (error: any) {
      toast.error(error?.message || "Failed to restock");
    } finally {
      setIsRestocking(false);
    }
  };

  const totalLowStock = useMemo(() => {
    if (!itemsByCategory) return 0;
    return itemsByCategory.reduce(
      (sum, group) => sum + group.items.filter(i => i.isLowStock).length,
      0
    );
  }, [itemsByCategory]);

  const filteredCategories = useMemo(() => {
    if (!itemsByCategory) return [];
    const query = search.toLowerCase().trim();

    return [...itemsByCategory]
      .sort((a, b) => a.category.name.localeCompare(b.category.name))
      .map((group) => {
        let filtered = group.items;
        if (showLowStockOnly) {
          filtered = filtered.filter(i => i.isLowStock);
        }
        if (query) {
          filtered = filtered.filter(i =>
            i.name.toLowerCase().includes(query) ||
            (i.size && i.size.toLowerCase().includes(query)) ||
            group.category.name.toLowerCase().includes(query)
          );
        }
        return { ...group, items: filtered };
      })
      .filter(group => group.items.length > 0);
  }, [itemsByCategory, search, showLowStockOnly]);

  if (!itemsByCategory) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (itemsByCategory.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p className="text-lg font-medium">No equipment items yet</p>
        <p className="text-sm mt-1">Equipment items will appear here once added.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Search + Low Stock filter */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search stock..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-10"
          />
          {search && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
              onClick={() => setSearch("")}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        {totalLowStock > 0 && (
          <Button
            variant={showLowStockOnly ? "destructive" : "outline"}
            size="sm"
            onClick={() => setShowLowStockOnly(!showLowStockOnly)}
            className="h-10 gap-1.5 shrink-0"
          >
            <TriangleAlert className="h-4 w-4" />
            <span>{totalLowStock} Low</span>
          </Button>
        )}
      </div>

      {filteredCategories.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Package className="h-10 w-10 mx-auto mb-3 opacity-50" />
          <p className="font-medium">
            {showLowStockOnly ? "No low stock items" : "No items match your search"}
          </p>
        </div>
      ) : (
        filteredCategories.map((group) => {
          const lowStockCount = group.items.filter(item => item.isLowStock).length;

          return (
            <Accordion
              key={group.category._id}
              type="single"
              collapsible
              defaultValue={group.category._id}
            >
              <AccordionItem value={group.category._id} className="border rounded-lg overflow-hidden">
                <AccordionTrigger className="hover:no-underline py-3 px-4 hover:bg-muted/50">
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-foreground">{group.category.name}</span>
                    <Badge variant="secondary" className="text-xs">
                      {group.items.length} items
                    </Badge>
                    {lowStockCount > 0 && (
                      <Badge variant="destructive" className="text-xs">
                        {lowStockCount} low
                      </Badge>
                    )}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pt-0 pb-2 px-2">
                  <div className="space-y-1">
                    {group.items.map((item) => (
                      <button
                        key={item._id}
                        onClick={() => setSelectedItem(item)}
                        className="w-full flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/60 transition-colors text-left"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">
                              {item.name}
                              {item.size && (
                                <span className="text-muted-foreground ml-1">({item.size})</span>
                              )}
                            </span>
                            {item.isLowStock && (
                              <Badge variant="destructive" className="text-xs flex items-center gap-1">
                                <TriangleAlert className="h-3 w-3" />
                                Low
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-3">
                          <div className="text-right">
                            <span className={`font-semibold ${item.isLowStock ? "text-destructive" : "text-foreground"}`}>
                              {item.currentStock}
                            </span>
                            {item.minimumStock !== undefined && (
                              <span className="text-muted-foreground text-xs ml-1">
                                / {item.minimumStock}
                              </span>
                            )}
                            <p className="text-xs text-muted-foreground">{item.unit || "units"}</p>
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </button>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          );
        })
      )}
      {/* Item History Panel */}
      {selectedItem && (() => {
        const panelHeader = (
          <>
            <div className="text-lg font-semibold">
              {selectedItem.name}
              {selectedItem.size && <span className="text-muted-foreground ml-1">({selectedItem.size})</span>}
            </div>
            <p className="text-sm text-muted-foreground">
              Stock: {selectedItem.currentStock}{selectedItem.minimumStock !== undefined && ` / ${selectedItem.minimumStock}`} {selectedItem.unit || "units"}
            </p>
          </>
        );

        const panelContent = (
          <>
            {/* Quick restock */}
            <div className="p-3 rounded-lg border border-dashed border-green-300 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20">
              <p className="text-xs font-medium text-green-700 dark:text-green-400 mb-2">Quick Restock</p>
              <div className="flex items-center gap-3">
                <StepperInput
                  value={restockQty}
                  onChange={setRestockQty}
                  min={1}
                  max={999}
                  size="sm"
                />
                <Button
                  size="sm"
                  onClick={handleQuickRestock}
                  disabled={isRestocking || restockQty <= 0}
                  className="bg-green-600 hover:bg-green-700 h-9 px-4"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  {isRestocking ? "Adding..." : `Add ${restockQty}`}
                </Button>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium mb-2 text-muted-foreground">Transaction History</h4>
              <EquipmentItemHistory itemId={selectedItem._id} />
            </div>
          </>
        );

        return isMobile ? (
          <Drawer open onOpenChange={(open) => { if (!open) { setSelectedItem(null); setRestockQty(1); } }}>
            <DrawerContent className="max-h-[85vh]">
              <DrawerHeader className="border-b pb-3">
                {panelHeader}
              </DrawerHeader>
              <div className="overflow-y-auto p-4 space-y-4">
                {panelContent}
              </div>
            </DrawerContent>
          </Drawer>
        ) : (
          <Sheet open onOpenChange={(open) => { if (!open) { setSelectedItem(null); setRestockQty(1); } }}>
            <SheetContent className="overflow-y-auto sm:max-w-md">
              <SheetHeader>
                {panelHeader}
              </SheetHeader>
              <div className="mt-4 space-y-4">
                {panelContent}
              </div>
            </SheetContent>
          </Sheet>
        );
      })()}
    </div>
  );
}
