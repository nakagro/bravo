import { Badge } from "../../../components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../../../components/ui/accordion";
import { InventoryCheckItem } from "./InventoryCheckItem";
import type { GroupedSection } from "../types/inventory.types";

interface InventoryCheckSectionProps {
  section: GroupedSection;
  isReadOnly: boolean;
}

export function InventoryCheckSection({ section, isReadOnly }: InventoryCheckSectionProps) {
  const sectionAnswered = section.items.filter(i => {
    if (i.expectedQuantity !== undefined) {
      return i.actualQuantity !== undefined;
    }
    return typeof i.value !== "undefined";
  }).length;
  const sectionTotal = section.items.length;
  const sectionPercentage = sectionTotal > 0 ? Math.round((sectionAnswered / sectionTotal) * 100) : 0;

  return (
    <AccordionItem value={`section-${section.order}`} className="border-none">
      <Card>
        <CardHeader className="p-4 pb-0 bg-muted/50">
          <AccordionTrigger className="hover:no-underline py-3">
            <div className="flex items-center justify-between flex-1 pr-2">
              <CardTitle className="text-base sm:text-lg">{section.sectionName}</CardTitle>
              <Badge variant="secondary" className="ml-2">
                {sectionAnswered}/{sectionTotal} ({sectionPercentage}%)
              </Badge>
            </div>
          </AccordionTrigger>
        </CardHeader>
        <AccordionContent>
          <CardContent className="p-4 pt-4 space-y-3">
            {section.items.map((item) => (
              <InventoryCheckItem
                key={item._id}
                item={item}
                isReadOnly={isReadOnly}
              />
            ))}
          </CardContent>
        </AccordionContent>
      </Card>
    </AccordionItem>
  );
}

export default InventoryCheckSection;
