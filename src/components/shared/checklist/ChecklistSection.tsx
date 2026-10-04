import { forwardRef, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ProgressRing } from "@/components/common/ProgressRing";
import { ringColorFor, type ChecklistProgress } from "./checklistStatus";

interface ChecklistSectionProps {
  /** Accordion value - must match the key used for navigation. */
  value: string;
  name: string;
  progress: ChecklistProgress;
  /** Slot in the section body above the rows, e.g. a bulk "All OK" button. */
  headerAction?: ReactNode;
  /**
   * Slot in the collapsed header itself, under the counts - for anything the
   * user needs to see without expanding the section (e.g. who's allocated).
   */
  headerMeta?: ReactNode;
  /**
   * How to name rows in the attention state - "2 issues" by default. A module
   * where amber isn't a problem (the training roll's apologies) names its own.
   */
  attentionLabel?: (count: number) => string;
  children: ReactNode;
}

/**
 * A collapsible checklist section. Both modules open every section by default,
 * so collapsing is an escape hatch for long lists rather than the norm.
 */
export const ChecklistSection = forwardRef<HTMLDivElement, ChecklistSectionProps>(
  function ChecklistSection(
    { value, name, progress, headerAction, headerMeta, attentionLabel, children },
    ref,
  ) {
    const allAnswered = progress.total > 0 && progress.answered === progress.total;

    return (
      <div ref={ref}>
        <AccordionItem value={value} className="border-none">
          <Card>
            {/* Dark mode lifts the card with a white overlay rather than
                `bg-muted`: dark `--muted` is a desaturated neutral grey while
                `--card` is a saturated blue-grey, so muted reads as a
                foreign grey slab rather than a tint of the card it sits on. */}
            <CardHeader className="p-3 sm:p-4 pb-0 bg-muted/50 dark:bg-white/[0.04]">
              <AccordionTrigger className="hover:no-underline py-2">
                <div className="flex items-center gap-3 flex-1 pr-2">
                  <ProgressRing
                    percentage={progress.percentage}
                    size={36}
                    strokeWidth={3}
                    color={ringColorFor(progress)}
                    showLabel={false}
                  />
                  <div className="flex-1 min-w-0 text-left">
                    <CardTitle className="text-base sm:text-lg leading-tight">
                      {name}
                    </CardTitle>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {progress.answered}/{progress.total}
                      </span>
                      {progress.attention > 0 && (
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1.5 py-0 border-amber-400 text-amber-600 dark:text-amber-400"
                        >
                          {attentionLabel
                            ? attentionLabel(progress.attention)
                            : `${progress.attention} issue${progress.attention !== 1 ? "s" : ""}`}
                        </Badge>
                      )}
                      {allAnswered && progress.attention === 0 && (
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1.5 py-0 border-green-400 text-green-600 dark:text-green-400"
                        >
                          All OK
                        </Badge>
                      )}
                    </div>
                    {headerMeta}
                  </div>
                </div>
              </AccordionTrigger>
            </CardHeader>
            <AccordionContent>
              <CardContent className="p-3 sm:p-4 pt-3 space-y-2">
                {headerAction}
                {children}
              </CardContent>
            </AccordionContent>
          </Card>
        </AccordionItem>
      </div>
    );
  },
);
