import { forwardRef, type ReactNode } from "react";
import { MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { statusTint, type ChecklistItemStatus } from "./checklistStatus";

interface ChecklistRowProps {
  status: ChecklistItemStatus;
  name: ReactNode;
  /** Pills rendered inline after the name. */
  badges?: ReactNode;
  /** Existing note; rendered as a one-line preview under the name. */
  notes?: string;
  /** Attribution, expected-quantity hints, etc. - under the notes preview. */
  meta?: ReactNode;
  /** Rendered before the name, e.g. Duty Crew's tri-state circle. */
  leading?: ReactNode;
  /** Owns interaction when the row body isn't the tap target (Inventory). */
  control?: ReactNode;
  /** Rendered below the main row, full width (e.g. a quantity stepper). */
  footer?: ReactNode;
  /** Extra icon buttons before the notes button (e.g. delete). */
  trailing?: ReactNode;
  onOpenNotes?: () => void;
  notesLabel?: string;
  /**
   * When supplied, the row body becomes the tap target (Duty Crew). When
   * omitted the row is inert and `control` owns interaction (Inventory).
   */
  onActivate?: () => void;
  /** Red left edge while unanswered - Duty Crew's Priority items. */
  emphasis?: "priority";
  /** 300ms tap acknowledgement. */
  flash?: "resolved" | "attention" | null;
}

const flashClasses = {
  resolved: "ring-2 ring-green-400 bg-green-50/50 dark:bg-green-950/20",
  attention: "ring-2 ring-red-400 bg-red-50/50 dark:bg-red-950/20",
} as const;

const nameToneFor = (status: ChecklistItemStatus) =>
  status === "resolved"
    ? "text-green-800 dark:text-green-200"
    : status === "attention"
      ? "text-amber-800 dark:text-amber-200"
      : "text-gray-900 dark:text-white";

/**
 * The shared checklist row anatomy. The *control* differs by module on purpose
 * - "did you sweep the floor?" wants a row-tap checkbox, "is it on the truck?"
 * needs an explicit No - but everything around it is identical.
 */
export const ChecklistRow = forwardRef<HTMLDivElement, ChecklistRowProps>(
  function ChecklistRow(
    {
      status,
      name,
      badges,
      notes,
      meta,
      leading,
      control,
      footer,
      trailing,
      onOpenNotes,
      notesLabel,
      onActivate,
      emphasis,
      flash = null,
    },
    ref,
  ) {
    const interactive = !!onActivate;

    return (
      <div
        ref={ref}
        className={cn(
          "group relative overflow-hidden rounded-lg border transition-all duration-200",
          statusTint(status),
          emphasis === "priority" &&
            status === "unanswered" &&
            "border-l-4 border-l-red-500 dark:border-l-red-500",
          flash && flashClasses[flash],
        )}
      >
        <div
          className={cn(
            "flex items-center gap-3 py-2 pl-3 pr-1 transition-transform duration-100",
            interactive && "cursor-pointer select-none active:scale-[0.98]",
          )}
          onClick={interactive ? onActivate : undefined}
          role={interactive ? "checkbox" : undefined}
          aria-checked={
            interactive
              ? status === "resolved"
                ? true
                : status === "attention"
                  ? "mixed"
                  : false
              : undefined
          }
          tabIndex={interactive ? 0 : undefined}
          onKeyDown={
            interactive
              ? (e) => {
                  if (
                    (e.key === "Enter" || e.key === " ") &&
                    e.target === e.currentTarget
                  ) {
                    e.preventDefault();
                    onActivate!();
                  }
                }
              : undefined
          }
        >
          {leading && <div className="flex-shrink-0">{leading}</div>}

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span
                className={cn(
                  "text-sm sm:text-base font-medium transition-colors duration-200",
                  nameToneFor(status),
                )}
              >
                {name}
              </span>
              {badges}
            </div>

            {notes && (
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400 line-clamp-1">
                {notes}
              </p>
            )}

            {meta && <div className="mt-0.5">{meta}</div>}
          </div>

          {/* pl-2 keeps a dead zone between the row's tap area and the icon
              cluster so a near-miss doesn't toggle the item */}
          <div
            className="flex items-center flex-shrink-0 gap-1.5 pl-2"
            onClick={(e) => e.stopPropagation()}
          >
            {control}
            {trailing}
            {onOpenNotes && (
              <button
                aria-label={notesLabel ?? (notes ? "Edit notes" : "Add notes")}
                title={notesLabel ?? (notes ? "Edit notes" : "Add notes")}
                className={cn(
                  "flex items-center justify-center h-11 w-11 rounded-full transition-colors active:scale-95",
                  notes
                    ? "text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                    : "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-black/5 dark:hover:bg-white/10",
                )}
                onClick={onOpenNotes}
              >
                <MessageSquare className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>

        {footer && <div className="px-3 pb-3">{footer}</div>}
      </div>
    );
  },
);
