import { Id } from "../../../../convex/_generated/dataModel";
import { EquipmentItemCard } from "./EquipmentItemCard";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";

interface EquipmentCategorySectionProps {
  category: {
    _id: Id<"equipmentCategories">;
    name: string;
    description?: string;
    order: number;
  };
  items: Array<{
    _id: Id<"equipmentItems">;
    name: string;
    description?: string;
    size?: string;
    currentStock: number;
    minimumStock?: number;
    unit?: string;
    isLowStock: boolean;
  }>;
  canManage?: boolean;
  defaultOpen?: boolean;
}

export function EquipmentCategorySection({
  category,
  items,
  canManage = false,
  defaultOpen = true,
}: EquipmentCategorySectionProps) {
  const lowStockCount = items.filter((item) => item.isLowStock).length;

  return (
    <Accordion type="single" collapsible defaultValue={defaultOpen ? category._id : undefined}>
      <AccordionItem value={category._id} className="border-none">
        <AccordionTrigger className="hover:no-underline py-3 px-4 bg-muted/50 rounded-lg mb-2">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-foreground">{category.name}</span>
            <Badge variant="secondary" className="text-xs">
              {items.length} items
            </Badge>
            {lowStockCount > 0 && (
              <Badge variant="destructive" className="text-xs">
                {lowStockCount} low
              </Badge>
            )}
          </div>
        </AccordionTrigger>
        <AccordionContent className="pt-0 pb-4">
          <div className="space-y-2">
            {items.map((item) => (
              <EquipmentItemCard
                key={item._id}
                item={item}
                canManage={canManage}
              />
            ))}
            {items.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No items in this category
              </p>
            )}
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
