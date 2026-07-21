import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { AccordionContent, AccordionItem, AccordionTrigger } from "../../../components/ui/accordion";
import { InventoryCheckItem } from "./InventoryCheckItem";
import { ProgressRing } from "../../../components/common/ProgressRing";
import { CheckCheck } from "lucide-react";
import { toast } from "sonner";
import type { GroupedSection } from "../types/inventory.types";

interface InventoryCheckSectionProps {
  section: GroupedSection;
  isReadOnly: boolean;
}

export function InventoryCheckSection({ section, isReadOnly }: InventoryCheckSectionProps) {
  const updateItem = useMutation(api.inventoryCheckRuns.updateRunItem);

  const sectionAnswered = section.items.filter(i => {
    if (i.expectedQuantity !== undefined) {
      return i.actualQuantity !== undefined;
    }
    return typeof i.value !== "undefined";
  }).length;
  const sectionTotal = section.items.length;
  const sectionPercentage = sectionTotal > 0 ? Math.round((sectionAnswered / sectionTotal) * 100) : 0;
  const allAnswered = sectionAnswered === sectionTotal;

  // Count items that have issues (No answers or quantity mismatches)
  const issueCount = section.items.filter(i => {
    if (i.expectedQuantity !== undefined) {
      return i.actualQuantity !== undefined && i.actualQuantity !== i.expectedQuantity;
    }
    return i.value === "no";
  }).length;

  const handleAllOk = async () => {
    // Only mark unanswered items as OK
    const unanswered = section.items.filter(i => {
      if (i.expectedQuantity !== undefined) {
        return i.actualQuantity === undefined;
      }
      return typeof i.value === "undefined";
    });

    if (unanswered.length === 0) {
      toast.info("All items already answered");
      return;
    }

    try {
      await Promise.all(
        unanswered.map(i => {
          if (i.expectedQuantity !== undefined) {
            return updateItem({ runItemId: i._id, actualQuantity: i.expectedQuantity });
          }
          return updateItem({ runItemId: i._id, value: "yes" });
        })
      );
      toast.success(`${unanswered.length} items marked OK`);
    } catch  {
      toast.error("Failed to mark items");
    }
  };

  // Ring color based on completion
  const ringColor = allAnswered
    ? (issueCount > 0 ? "stroke-amber-500 dark:stroke-amber-400" : "stroke-green-500 dark:stroke-green-400")
    : "stroke-red-600 dark:stroke-red-500";

  return (
    <AccordionItem value={`section-${section.order}`} className="border-none">
      <Card>
        <CardHeader className="p-3 sm:p-4 pb-0 bg-muted/50">
          <AccordionTrigger className="hover:no-underline py-2">
            <div className="flex items-center gap-3 flex-1 pr-2">
              {/* Mini progress ring */}
              <ProgressRing
                percentage={sectionPercentage}
                size={36}
                strokeWidth={3}
                color={ringColor}
                showLabel={false}
              />
              <div className="flex-1 min-w-0 text-left">
                <CardTitle className="text-base sm:text-lg leading-tight">{section.sectionName}</CardTitle>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-muted-foreground">
                    {sectionAnswered}/{sectionTotal}
                  </span>
                  {issueCount > 0 && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-red-400 text-red-600 dark:text-red-400">
                      {issueCount} issue{issueCount !== 1 ? "s" : ""}
                    </Badge>
                  )}
                  {allAnswered && issueCount === 0 && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-green-400 text-green-600 dark:text-green-400">
                      All OK
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </AccordionTrigger>
        </CardHeader>
        <AccordionContent>
          <CardContent className="p-3 sm:p-4 pt-3 space-y-2">
            {/* All OK button */}
            {!isReadOnly && !allAnswered && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  handleAllOk();
                }}
                className="w-full h-11 border-green-300 dark:border-green-800 text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-950/30 hover:border-green-400 font-medium mb-1"
              >
                <CheckCheck className="w-4 h-4 mr-2" />
                All OK, mark {sectionTotal - sectionAnswered} remaining as Yes
              </Button>
            )}

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
