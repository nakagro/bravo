import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { AlertTriangle, Package } from "lucide-react";

export function EquipmentStockTab() {
  const itemsByCategory = useQuery(api.equipment.getItemsByCategory);

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
    <div className="space-y-2">
      {[...itemsByCategory].sort((a, b) => a.category.name.localeCompare(b.category.name)).map((group) => {
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
                {group.items.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4 px-2">
                    No items in this category
                  </p>
                ) : (
                  <div className="space-y-1">
                    {group.items.map((item) => (
                      <div
                        key={item._id}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/30"
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
                                <AlertTriangle className="h-3 w-3" />
                                Low
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="text-right shrink-0 ml-3">
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
                      </div>
                    ))}
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        );
      })}
    </div>
  );
}
