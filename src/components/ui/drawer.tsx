import * as React from "react"
import { Drawer as DrawerPrimitive } from "vaul"

import { cn } from "@/lib/utils"
import { useKeyboardInset } from "@/hooks/useKeyboardInset"

// Keyboard handling lives here so every drawer gets it, not per form.
// vaul's own repositionInputs is off and can't be turned back on: it moved the
// sheet while iOS was also scrolling the focused field into view, and the two
// stacked and threw the form off screen. DrawerContent pins itself to the
// visible area instead.
// vaul's props are a union (with/without snap points); a plain Omit flattens it
type DrawerProps = React.ComponentProps<typeof DrawerPrimitive.Root> extends infer P
  ? P extends unknown
    ? Omit<P, "repositionInputs">
    : never
  : never

function Drawer({ shouldScaleBackground = true, ...props }: DrawerProps) {
  return (
    <DrawerPrimitive.Root
      shouldScaleBackground={shouldScaleBackground}
      {...props}
      repositionInputs={false}
    />
  )
}

const DrawerTrigger = DrawerPrimitive.Trigger

const DrawerPortal = DrawerPrimitive.Portal

const DrawerClose = DrawerPrimitive.Close

function DrawerOverlay({ className, ref, ...props }: React.ComponentProps<typeof DrawerPrimitive.Overlay>) {
  return (
    <DrawerPrimitive.Overlay
      ref={ref}
      className={cn("fixed inset-0 z-50 bg-black/80", className)}
      {...props}
    />
  )
}

// Gap kept above the sheet while the keyboard is up, so its top edge shows.
const KEYBOARD_TOP_GAP = 8

// Scroll the nearest scrolling ancestor (inside the sheet) just enough to show
// the field. Not element.scrollIntoView - that also scrolls the page behind.
function revealInSheet(el: HTMLElement, sheet: HTMLElement) {
  let box = el.parentElement
  while (box && box !== sheet) {
    const { overflowY } = getComputedStyle(box)
    if ((overflowY === "auto" || overflowY === "scroll") && box.scrollHeight > box.clientHeight) {
      const field = el.getBoundingClientRect()
      const view = box.getBoundingClientRect()
      if (field.bottom > view.bottom) box.scrollTop += field.bottom - view.bottom + 16
      else if (field.top < view.top) box.scrollTop -= view.top - field.top + 16
      return
    }
    box = box.parentElement
  }
}

// Mounted only while the drawer is open (it sits inside the portal), so the
// viewport listeners come and go with it.
function KeyboardAwareContent({ style, ref, ...props }: React.ComponentProps<typeof DrawerPrimitive.Content>) {
  const inset = useKeyboardInset()
  const sheetRef = React.useRef<HTMLDivElement | null>(null)

  const setRefs = React.useCallback(
    (node: HTMLDivElement | null) => {
      sheetRef.current = node
      if (typeof ref === "function") ref(node)
      else if (ref) ref.current = node
    },
    [ref]
  )

  // Once the sheet has shrunk to fit above the keyboard, bring the focused
  // field back into view inside it. Only on a size change: moving between
  // fields with the keyboard already up is left to the browser, which reveals
  // the newly focused field itself - doing it here too made a small jump.
  // Keyed on height alone, so iOS panning the viewport doesn't re-trigger it.
  const visibleHeight = inset?.height
  React.useEffect(() => {
    const sheet = sheetRef.current
    const focused = document.activeElement
    if (!visibleHeight || !sheet || !(focused instanceof HTMLElement) || !sheet.contains(focused)) return
    revealInSheet(focused, sheet)
  }, [visibleHeight])

  return (
    <DrawerPrimitive.Content
      ref={setRefs}
      style={
        inset
          ? { ...style, bottom: inset.bottom, maxHeight: inset.height - KEYBOARD_TOP_GAP }
          : style
      }
      {...props}
    />
  )
}

function DrawerContent({ className, children, ...props }: React.ComponentProps<typeof DrawerPrimitive.Content>) {
  return (
    <DrawerPortal>
      <DrawerOverlay />
      <KeyboardAwareContent
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 mt-24 flex h-auto flex-col rounded-t-[10px] border bg-background",
          className
        )}
        {...props}
      >
        <div className="mx-auto mt-4 h-2 w-[100px] rounded-full bg-muted" />
        {children}
      </KeyboardAwareContent>
    </DrawerPortal>
  )
}

function DrawerHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("grid gap-1.5 p-4 text-center sm:text-left", className)}
      {...props}
    />
  )
}

function DrawerFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("mt-auto flex flex-col gap-2 p-4", className)}
      {...props}
    />
  )
}

function DrawerTitle({ className, ref, ...props }: React.ComponentProps<typeof DrawerPrimitive.Title>) {
  return (
    <DrawerPrimitive.Title
      ref={ref}
      className={cn(
        "text-lg font-semibold leading-none tracking-tight",
        className
      )}
      {...props}
    />
  )
}

function DrawerDescription({ className, ref, ...props }: React.ComponentProps<typeof DrawerPrimitive.Description>) {
  return (
    <DrawerPrimitive.Description
      ref={ref}
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Drawer,
  DrawerPortal,
  DrawerOverlay,
  DrawerTrigger,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
}
