import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { ResponsiveModal } from "@/components/shared/ResponsiveModal";
import { statusToneClasses } from "@/lib/statusTone";
import { cn } from "@/lib/utils";

export interface SheetAction {
  label: string;
  icon?: ReactNode;
  variant?: "default" | "outline" | "destructive";
  onSelect: () => void;
}

interface ActionSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children?: ReactNode;
  actions: SheetAction[];
}

/**
 * The confirmation for an access command: a bottom sheet on phones, so the
 * buttons sit under the thumb. One action pairs with Cancel in the footer;
 * two or more stack full width above it, first one primary.
 */
export function ActionSheet({ open, onClose, title, children, actions }: ActionSheetProps) {
  const choose = (action: SheetAction) => {
    onClose();
    action.onSelect();
  };
  const single = actions.length === 1 ? actions[0] : null;

  return (
    <ResponsiveModal
      open={open}
      onClose={onClose}
      title={title}
      drawerHeight="h-auto max-h-[90vh]"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          {single && (
            <Button variant={single.variant ?? "default"} onClick={() => choose(single)}>
              {single.icon}
              {single.label}
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-4 text-sm text-muted-foreground">
        {children}
        {!single && (
          <div className="flex flex-col gap-2 pt-1">
            {actions.map((action, i) => (
              <Button
                key={action.label}
                variant={action.variant ?? (i === 0 ? "default" : "outline")}
                className="h-12 w-full touch-manipulation text-base"
                onClick={() => choose(action)}
              >
                {action.icon}
                {action.label}
              </Button>
            ))}
          </div>
        )}
      </div>
    </ResponsiveModal>
  );
}

/** A short warning line inside a sheet. */
export function SheetWarning({ children }: { children: ReactNode }) {
  return (
    <p className={cn("rounded-lg px-3 py-2", statusToneClasses.warning)}>
      {children}
    </p>
  );
}
