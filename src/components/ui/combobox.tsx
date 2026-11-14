import * as React from "react"
import { Command as CommandPrimitive } from "cmdk"
import { Check, ChevronsUpDown, CircleX, Plus, Search } from "lucide-react"

import { cn } from "@/lib/utils"

export interface ComboboxOption {
  value: string
  label: string
  /** Secondary text after the label, e.g. a rank. Also searchable. */
  hint?: string
  /**
   * Inline content after the label, e.g. status badges. Not searchable. The
   * row carries `group`, so badges can restyle on the highlighted row with
   * `group-data-[selected=true]:`.
   */
  badges?: React.ReactNode
}

interface ComboboxProps {
  options: ComboboxOption[]
  value: string | null | undefined
  onValueChange: (value: string | null) => void
  placeholder?: string
  emptyText?: string
  /** Deleting the text and leaving the field clears the value. */
  clearable?: boolean
  /** While a value is set, swap the chevron for an X that clears it. */
  showClearButton?: boolean
  /**
   * Which side the list prefers. It still flips to the other side when that
   * has more room, e.g. with the phone keyboard up.
   */
  listPosition?: "below" | "above"
  className?: string
  disabled?: boolean
  id?: string
  "aria-invalid"?: boolean
  /**
   * Offer the typed text as a new entry at the foot of the list. The caller
   * decides what adding means; the field then shows the text as typed.
   */
  onCreate?: (text: string) => void
  /** Non-selectable tip atop the full list, e.g. that a new name can be typed. */
  createHint?: string
}

const LIST_MAX_HEIGHT = 240
const LIST_GAP = 4
// Below this, the preferred side is too cramped and the other side wins
const LIST_COMFORTABLE = 160

// The part of the screen the list can show in: the nearest scrolling box
// (e.g. a drawer's form), cut down to what's above the phone keyboard.
function visibleBounds(from: HTMLElement) {
  const vv = window.visualViewport
  let top = vv ? vv.offsetTop : 0
  let bottom = vv ? vv.offsetTop + vv.height : window.innerHeight
  let box = from.parentElement
  while (box) {
    const { overflowY } = getComputedStyle(box)
    if (overflowY === "auto" || overflowY === "scroll") {
      const rect = box.getBoundingClientRect()
      top = Math.max(top, rect.top)
      bottom = Math.min(bottom, rect.bottom)
      break
    }
    box = box.parentElement
  }
  return { top, bottom }
}

// cmdk keeps the highlighted row visible with element.scrollIntoView, which
// scrolls every box around it too - the drawer and the page jumped on each
// pick. Scroll the list alone instead.
function scrollWithinList(item: HTMLElement | null) {
  if (!item) return
  item.scrollIntoView = () => {
    const list = item.closest<HTMLElement>("[cmdk-list]")
    if (!list) return
    const top = item.offsetTop
    const bottom = top + item.offsetHeight
    if (top < list.scrollTop) list.scrollTop = top
    else if (bottom > list.scrollTop + list.clientHeight) list.scrollTop = bottom - list.clientHeight
  }
}

// Focusing from code (the chevron) let iOS scroll the page to the field,
// throwing a drawer off screen. Same trick a tapped field gets in drawer.tsx:
// park the field off screen as focus lands so iOS finds nothing to scroll to.
function focusWithoutPageScroll(input: HTMLInputElement | null) {
  if (!input || document.activeElement === input) return
  input.style.transform = "translateY(-2000px)"
  input.focus({ preventScroll: true })
  requestAnimationFrame(() => {
    input.style.transform = ""
  })
}

// Type-in-place picker, deliberately (it replaces a Headless UI Combobox and
// keeps its behaviour):
// - the field is the search box; focusing it only gives you a cursor
// - typing opens the list and filters it as you go
// - the chevron opens the full list
// The list renders inline (not portalled) so it scrolls inside drawers. It
// opens into whichever side of the field has room and is sized to fit there,
// so opening it, picking and closing it never scroll anything.
export function Combobox({
  options,
  value,
  onValueChange,
  placeholder = "Search...",
  emptyText = "No option found.",
  clearable = false,
  showClearButton = false,
  listPosition = "below",
  className,
  disabled = false,
  id,
  "aria-invalid": ariaInvalid,
  onCreate,
  createHint,
}: ComboboxProps) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const fieldRef = React.useRef<HTMLDivElement>(null)
  const [open, setOpen] = React.useState(false)
  const [placement, setPlacement] = React.useState<{
    side: "below" | "above"
    maxHeight: number
  }>({ side: listPosition, maxHeight: LIST_MAX_HEIGHT })

  // Measure before paint, and again as the keyboard finishes rising.
  React.useLayoutEffect(() => {
    if (!open) return
    const place = () => {
      const field = fieldRef.current
      if (!field) return
      const rect = field.getBoundingClientRect()
      const bounds = visibleBounds(field)
      const room = {
        below: bounds.bottom - rect.bottom - LIST_GAP * 2,
        above: rect.top - bounds.top - LIST_GAP * 2,
      }
      const other = listPosition === "below" ? "above" : "below"
      const side =
        room[listPosition] >= LIST_COMFORTABLE || room[listPosition] >= room[other]
          ? listPosition
          : other
      const maxHeight = Math.max(96, Math.min(LIST_MAX_HEIGHT, room[side]))
      setPlacement((prev) =>
        prev.side === side && prev.maxHeight === maxHeight ? prev : { side, maxHeight }
      )
    }
    place()
    const vv = window.visualViewport
    vv?.addEventListener("resize", place)
    return () => vv?.removeEventListener("resize", place)
  }, [open, listPosition])
  const [query, setQuery] = React.useState("")

  const selectedOption = options.find((option) => option.value === value)
  const selectedLabel = selectedOption?.label ?? ""
  const [text, setText] = React.useState(selectedLabel)

  // At rest the field shows the chosen name, including when the parent changes
  // the value or the options load after mount.
  React.useEffect(() => {
    if (!open) setText(selectedLabel)
  }, [selectedLabel, open])

  // Case-insensitive substring match on label + hint, in the given order.
  const needle = query.trim().toLowerCase()
  const filtered = needle
    ? options.filter(
        (o) =>
          o.label.toLowerCase().includes(needle) ||
          (o.hint?.toLowerCase().includes(needle) ?? false)
      )
    : options

  const close = () => {
    setOpen(false)
    setQuery("")
    if (clearable && value && text.trim() === "") {
      onValueChange(null)
    } else {
      setText(selectedLabel)
    }
  }

  const select = (next: string) => {
    onValueChange(next)
    setOpen(false)
    setQuery("")
    setText(options.find((o) => o.value === next)?.label ?? "")
  }

  const create = () => {
    const created = query.trim()
    onCreate?.(created)
    setOpen(false)
    setQuery("")
    setText(created)
  }

  // Offer to add the typed text unless it exactly matches an existing option.
  const canCreate =
    !!onCreate && needle !== "" && !options.some((o) => o.label.toLowerCase() === needle)

  return (
    <CommandPrimitive
      shouldFilter={false}
      className={cn("relative", className)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) close()
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) {
          e.preventDefault()
          close()
        }
      }}
    >
      <div ref={fieldRef} className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
          <Search className="h-5 w-5 text-gray-400" aria-hidden="true" />
        </div>
        <CommandPrimitive.Input
          ref={inputRef}
          id={id}
          disabled={disabled}
          aria-invalid={ariaInvalid}
          value={text}
          // A filled field selects its name on tap, so typing replaces it
          // instead of needing every letter backspaced first. Deferred so
          // mobile Safari doesn't drop the selection when it places the caret.
          onFocus={(e) => {
            const input = e.currentTarget
            if (selectedOption) setTimeout(() => input.select(), 0)
          }}
          onValueChange={(v) => {
            setText(v)
            setQuery(v)
            setOpen(true)
          }}
          placeholder={placeholder}
          className={cn(
            "w-full rounded-md border border-gray-300 bg-white py-2 pl-10 text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-white",
            showClearButton && selectedOption ? "pr-20" : "pr-10",
            ariaInvalid && "border-red-500 dark:border-red-500"
          )}
        />
        <div className="absolute inset-y-0 right-0 flex">
          {showClearButton && selectedOption && (
            // Full-height, thumb-sized: this is how a name is removed on a phone.
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onValueChange(null)
                setOpen(false)
                setQuery("")
                setText("")
              }}
              disabled={disabled}
              className="flex w-10 items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              aria-label="Clear selection"
            >
              <CircleX className="h-5 w-5" aria-hidden="true" />
            </button>
          )}
          <button
            type="button"
            tabIndex={-1}
            disabled={disabled}
            // Keep focus in the field so the toggle doesn't trigger a blur-close.
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              if (open) {
                close()
              } else {
                setQuery("")
                setOpen(true)
                focusWithoutPageScroll(inputRef.current)
              }
            }}
            className="flex w-10 items-center justify-center"
            aria-label={open ? "Close list" : "Show all"}
          >
            <ChevronsUpDown className="h-5 w-5 text-gray-400" aria-hidden="true" />
          </button>
        </div>
      </div>
      {open && (
        <CommandPrimitive.List
          // Keep focus in the field when an option is tapped, so blur doesn't
          // close the list before the selection lands.
          onMouseDown={(e) => e.preventDefault()}
          className={cn(
            "absolute z-50 w-full overflow-auto overscroll-contain rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black/5 focus:outline-none dark:bg-gray-800 sm:text-sm",
            placement.side === "above" ? "bottom-full mb-1" : "top-full mt-1"
          )}
          style={{ maxHeight: placement.maxHeight }}
        >
          {onCreate && createHint && needle === "" && (
            <div className="px-4 py-2 text-xs text-muted-foreground border-b border-gray-100 dark:border-gray-700">
              {createHint}
            </div>
          )}
          <CommandPrimitive.Empty className="relative cursor-default select-none px-4 py-2 text-gray-700 dark:text-gray-300">
            {emptyText}
          </CommandPrimitive.Empty>
          {filtered.map((option) => {
            const isSelected = value === option.value
            return (
              <CommandPrimitive.Item
                key={option.value}
                ref={scrollWithinList}
                value={option.value}
                onSelect={() => select(option.value)}
                className="group relative flex cursor-default select-none items-center gap-2 py-2 pl-10 pr-4 text-gray-900 outline-none data-[selected=true]:bg-primary data-[selected=true]:text-primary-foreground dark:text-gray-200"
              >
                <span className={cn("truncate", isSelected ? "font-medium" : "font-normal")}>
                  {option.label}
                </span>
                {option.hint && (
                  <span className="shrink-0 text-xs text-muted-foreground group-data-[selected=true]:text-primary-foreground/80">
                    {option.hint}
                  </span>
                )}
                {option.badges}
                {isSelected && (
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-primary group-data-[selected=true]:text-primary-foreground">
                    <Check className="h-5 w-5" aria-hidden="true" />
                  </span>
                )}
              </CommandPrimitive.Item>
            )
          })}
          {canCreate && (
            <CommandPrimitive.Item
              ref={scrollWithinList}
              value="__create__"
              onSelect={create}
              className="group relative flex cursor-default select-none items-center gap-2 border-t border-gray-100 py-2 pl-10 pr-4 text-gray-900 outline-none data-[selected=true]:bg-primary data-[selected=true]:text-primary-foreground dark:border-gray-700 dark:text-gray-200"
            >
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-primary group-data-[selected=true]:text-primary-foreground">
                <Plus className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="truncate">
                Add <span className="font-medium">&ldquo;{query.trim()}&rdquo;</span>
              </span>
            </CommandPrimitive.Item>
          )}
        </CommandPrimitive.List>
      )}
    </CommandPrimitive>
  )
}
