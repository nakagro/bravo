import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ResponsiveModal } from "@/components/shared/ResponsiveModal";
import { useIsMobile } from "@/hooks/use-mobile";

interface UnableToCompleteSlot {
  label: string;
  description: string;
  value: boolean;
  onChange: (value: boolean) => void;
  /** Placeholder used while the switch is on; a reason is then required. */
  reasonPlaceholder?: string;
}

interface ChecklistNotesModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
  placeholder?: string;
  /** Read-only viewing of historical notes. */
  readOnly?: boolean;
  /**
   * Duty Crew's "Couldn't be completed" switch. This is the seam through which
   * Inventory's N/A state arrives later, with no further UI work.
   */
  unableToComplete?: UnableToCompleteSlot;
}

export function ChecklistNotesModal({
  open,
  onClose,
  title,
  value,
  onChange,
  onSave,
  placeholder = "Add notes (optional)...",
  readOnly = false,
  unableToComplete,
}: ChecklistNotesModalProps) {
  // A reason is required so history explains why the item wasn't done
  const reasonMissing = !!unableToComplete?.value && !value.trim();
  // On a phone, focusing the field while the drawer is still sliding in raises
  // the keyboard mid-animation and throws the sheet off screen. Let the member
  // tap the field once the drawer has settled.
  const isMobile = useIsMobile();

  return (
    <ResponsiveModal
      open={open}
      onClose={onClose}
      title={title}
      // Size to the content, capped by the *visible* viewport: a fixed 70vh
      // sheet plus the keyboard is taller than the screen, so it got pushed
      // up and left blank space where the form should be.
      drawerHeight="h-auto max-h-[70dvh]"
      repositionInputs={false}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {readOnly ? "Close" : "Cancel"}
          </Button>
          {!readOnly && (
            <Button onClick={onSave} disabled={reasonMissing}>
              <Check className="h-4 w-4 mr-1" aria-hidden="true" />
              Save Notes
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-4 pb-4">
        {unableToComplete && !readOnly && (
          <div className="flex items-center justify-between gap-3 p-3 rounded-lg border border-amber-200 dark:border-amber-800/60 bg-amber-50/60 dark:bg-amber-950/20">
            <div className="min-w-0">
              <Label
                htmlFor="checklist-unable-toggle"
                className="text-sm font-medium text-amber-900 dark:text-amber-200"
              >
                {unableToComplete.label}
              </Label>
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                {unableToComplete.description}
              </p>
            </div>
            <Switch
              id="checklist-unable-toggle"
              checked={unableToComplete.value}
              onCheckedChange={unableToComplete.onChange}
            />
          </div>
        )}

        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={
            unableToComplete?.value
              ? unableToComplete.reasonPlaceholder ??
                "Why couldn't this be completed? (required)"
              : placeholder
          }
          className="min-h-[120px] resize-none text-base"
          readOnly={readOnly}
          autoFocus={!readOnly && !isMobile}
        />

        {!readOnly && (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {reasonMissing
              ? "A reason is required when marking an item N/A"
              : `${value.length} characters`}
          </p>
        )}
      </div>
    </ResponsiveModal>
  );
}
