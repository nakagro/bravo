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

// iOS scrolls the page behind on every focus, even when the field is already
// in view, and the sheet visibly dipped and came back as each field took
// focus. The fix (the one React Aria and vaul use): move the field far off
// screen for one frame as it takes focus, so iOS finds nothing it can scroll
// to, then reveal it inside the sheet ourselves.
const isIOS =
  typeof navigator !== "undefined" &&
  (/iP(hone|ad|od)/.test(navigator.platform) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1))

const NON_TEXT_INPUTS = new Set([
  "checkbox", "radio", "range", "color", "file", "image", "button", "submit", "reset",
])

function isTextEntry(el: EventTarget | null): el is HTMLElement {
  if (!(el instanceof HTMLElement)) return false
  if (el instanceof HTMLInputElement) return !NON_TEXT_INPUTS.has(el.type)
  return el instanceof HTMLTextAreaElement || el.isContentEditable
}

function hideFromIOSScroll(el: HTMLElement, then: () => void) {
  el.style.transform = "translateY(-2000px)"
  requestAnimationFrame(() => {
    el.style.transform = ""
    requestAnimationFrame(then)
  })
}

// Mounted only while the drawer is open (it sits inside the portal), so the
// viewport listeners come and go with it.
// While any drawer is open the page behind is pinned in place. iOS scrolls the
// page to the top on a tap of the status bar, which is right where the drawer's
// handle is, and nothing can turn that off; with the page pinned there's nothing
// for it to scroll, and the reader's place is put back exactly on close.
let pageLocks = 0
let pageLockScrollY = 0
const PINNED = { position: "fixed", top: "", left: "0", right: "0", width: "100%" } as const

// vaul pins the page itself in Safari, except when installed to the home
// screen (standalone), which is how members mostly use BRAVO. Pin only where
// vaul doesn't, so the two never fight over body styles.
const vaulPinsPage = () =>
  /^((?!chrome|android).)*safari/i.test(navigator.userAgent) &&
  !window.matchMedia("(display-mode: standalone)").matches

function usePagePinnedWhileOpen() {
  React.useLayoutEffect(() => {
    if (vaulPinsPage()) return
    const body = document.body
    if (pageLocks++ === 0) {
      pageLockScrollY = window.scrollY
      Object.assign(body.style, PINNED, { top: `-${pageLockScrollY}px` })
    }
    return () => {
      if (--pageLocks > 0) return
      // Only undo what this set; Radix and vaul manage their own body styles.
      for (const prop of Object.keys(PINNED)) body.style.removeProperty(prop)
      window.scrollTo({ top: pageLockScrollY, behavior: "instant" })
    }
  }, [])
}

// How long after a field loses focus a tap "outside" is still ignored. The
// keyboard takes about this long to drop and the sheet to settle.
const BLUR_GRACE_MS = 700

function KeyboardAwareContent({
  style,
  ref,
  onTouchEnd,
  onFocusCapture,
  onBlurCapture,
  onPointerDownOutside,
  onFocusOutside,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Content>) {
  const inset = useKeyboardInset()
  const sheetRef = React.useRef<HTMLDivElement | null>(null)
  const keyboardUp = React.useRef(false)
  keyboardUp.current = inset !== null
  const lastFieldBlur = React.useRef(0)
  usePagePinnedWhileOpen()

  // A field that grabs focus as the drawer opens (autoFocus) would raise the
  // keyboard before the member has touched anything, and the sheet jumps as
  // it opens. On touch screens drop that focus; the keyboard comes up when
  // they tap a field. Runs once, before paint, after children have focused.
  // Fields focused later (e.g. tapping Edit) are left alone.
  React.useLayoutEffect(() => {
    const sheet = sheetRef.current
    const focused = document.activeElement
    if (
      window.matchMedia("(pointer: coarse)").matches &&
      sheet?.contains(focused) &&
      isTextEntry(focused)
    ) {
      focused.blur()
    }
  }, [])

  // A tap that blurs a field and then removes what it hit (a clear button, a
  // picker row), or lands after the sheet moves as the keyboard drops, reaches
  // Radix as a tap outside, and the drawer closed mid-edit. While typing, or
  // just after, only deliberate actions (X, Cancel, the handle) close it.
  const guardOutside = (e: Event) => {
    const typing =
      keyboardUp.current ||
      isTextEntry(document.activeElement) ||
      performance.now() - lastFieldBlur.current < BLUR_GRACE_MS
    if (typing) e.preventDefault()
  }

  const setRefs = React.useCallback(
    (node: HTMLDivElement | null) => {
      sheetRef.current = node
      if (typeof ref === "function") ref(node)
      else if (ref) ref.current = node
    },
    [ref]
  )

  // Once the sheet has shrunk to fit above the keyboard, bring the focused
  // field back into view inside it. Keyed on height alone, so a pan of the
  // viewport doesn't re-trigger it.
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
      // A tap: the transform has to be on before focus lands, so focus it here
      onTouchEnd={(e) => {
        onTouchEnd?.(e)
        const field = e.target
        if (!isIOS || !isTextEntry(field) || field === document.activeElement) return
        e.preventDefault()
        field.style.transform = "translateY(-2000px)"
        field.focus({ preventScroll: true })
      }}
      onBlurCapture={(e) => {
        onBlurCapture?.(e)
        if (isTextEntry(e.target)) lastFieldBlur.current = performance.now()
      }}
      onPointerDownOutside={(e) => {
        onPointerDownOutside?.(e)
        guardOutside(e)
      }}
      onFocusOutside={(e) => {
        onFocusOutside?.(e)
        guardOutside(e)
      }}
      // Any focus, including the keyboard's up/down arrows
      onFocusCapture={(e) => {
        onFocusCapture?.(e)
        const field = e.target
        if (!isIOS || !isTextEntry(field)) return
        hideFromIOSScroll(field, () => {
          // With the keyboard still rising, the height effect above reveals it
          if (keyboardUp.current && sheetRef.current) revealInSheet(field, sheetRef.current)
        })
      }}
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
