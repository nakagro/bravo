import { useState, type ReactNode } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

interface ResponsiveModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  /** Mobile drawer height - defaults to "h-[90vh]" */
  drawerHeight?: string;
  /** Desktop sheet max-width - defaults to "sm:max-w-md md:max-w-lg" */
  maxWidth?: string;
  /**
   * Veto a dismissal. Called for the close button, Escape, an outside click and
   * the drawer swipe; returning false leaves the modal open so the owner can
   * confirm first (e.g. discarding an unsaved draft). Callers that omit it
   * behave exactly as before.
   */
  onRequestClose?: () => boolean;
  /**
   * Let vaul lift the drawer above the on-screen keyboard (its default). iOS
   * also scrolls the focused field into view, so on a short drawer the two
   * stack and throw the form off the top of the screen - pass false there.
   */
  repositionInputs?: boolean;
}

export function ResponsiveModal({
  open,
  onClose,
  title,
  children,
  footer,
  drawerHeight = "h-[90vh]",
  maxWidth = "sm:max-w-md md:max-w-lg",
  onRequestClose,
  repositionInputs,
}: ResponsiveModalProps) {
  const isMobile = useIsMobile();
  // While a text field inside the drawer has focus the on-screen keyboard is up
  // and the sheet gets shoved around, which makes an accidental swipe or a tap
  // on dead space far too easy - and that would throw away the draft. Lock
  // dismissal until the field is blurred; the header X always closes.
  const [isTypingInside, setIsTypingInside] = useState(false);

  const handleFocusChange = (target: EventTarget | null, focused: boolean) => {
    const el = target as HTMLElement | null;
    if (!el) return;
    const input = el as HTMLInputElement;
    const isTextEntry =
      el.tagName === "TEXTAREA" ||
      el.isContentEditable === true ||
      (el.tagName === "INPUT" && input.type !== "checkbox" && input.type !== "radio");
    if (isTextEntry) setIsTypingInside(focused);
  };

  const attemptClose = () => {
    if (onRequestClose && !onRequestClose()) return;
    onClose();
  };

  if (isMobile) {
    return (
      <Drawer
        open={open}
        dismissible={!isTypingInside}
        repositionInputs={repositionInputs}
        onOpenChange={(o) => {
          if (!o) attemptClose();
        }}
      >
        <DrawerContent
          className={cn(
            "flex flex-col overscroll-contain border-border",
            drawerHeight,
          )}
        >
          <DrawerHeader className="shrink-0 border-b border-border pb-4">
            <div className="flex items-center justify-between">
              <DrawerTitle className="text-xl font-bold">{title}</DrawerTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={attemptClose}
                className="size-10 touch-manipulation"
                aria-label="Close"
              >
                <X aria-hidden="true" />
              </Button>
            </div>
          </DrawerHeader>
          {/* data-vaul-no-drag: a drag inside the form scrolls it and never
              drags the sheet away - only the handle and header can dismiss. */}
          <div
            data-vaul-no-drag
            onFocus={(e) => handleFocusChange(e.target, true)}
            onBlur={(e) => handleFocusChange(e.target, false)}
            className="flex-1 overflow-y-auto overflow-x-hidden px-4 pt-4"
          >
            {children}
          </div>
          {footer ? (
            <DrawerFooter className="shrink-0 p-0">{footer}</DrawerFooter>
          ) : null}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        if (!o) attemptClose();
      }}
    >
      <SheetContent
        side="right"
        className={cn(
          "flex w-full flex-col overscroll-contain border-l border-border p-0",
          maxWidth,
        )}
      >
        <SheetHeader className="shrink-0 border-b border-border p-6 pb-4">
          <SheetTitle className="text-xl font-bold">{title}</SheetTitle>
          <SheetDescription className="sr-only">{title}</SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-6 pt-4 pb-4">
          {children}
        </div>
        {footer ? <div className="shrink-0">{footer}</div> : null}
      </SheetContent>
    </Sheet>
  );
}
