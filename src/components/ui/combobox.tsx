import * as React from "react"
import { Command as CommandPrimitive } from "cmdk"
import { Check, ChevronsUpDown, CircleX, Search } from "lucide-react"

import { cn } from "@/lib/utils"

export interface ComboboxOption {
  value: string
  label: string
  /** Secondary text after the label, e.g. a rank. Also searchable. */
  hint?: string
  /** Inline content after the label, e.g. status badges. Not searchable. */
  badges?: React.ReactNode
}

interface ComboboxProps {
  options: ComboboxOption[]
  value: string | null | undefined
  onValueChange: (value: string | null) => void
  placeholder?: string
  emptyText?: string
  /** Shows an X in the field while a value is set. */
  clearable?: boolean
  /** Open the list above the field, for pickers near the bottom of a form. */
  listPosition?: "below" | "above"
  className?: string
  disabled?: boolean
  id?: string
  "aria-invalid"?: boolean
}

// Type-in-place picker: the field itself is the search box and the matches
// drop down under it. Deliberately not a button-plus-popover, so there is one
// tap and one field on mobile. The list renders inline (not portalled) so it
// scrolls normally inside drawers and dialogs.
export function Combobox({
  options,
  value,
  onValueChange,
  placeholder = "Search...",
  emptyText = "No option found.",
  clearable = false,
  listPosition = "below",
  className,
  disabled = false,
  id,
  "aria-invalid": ariaInvalid,
}: ComboboxProps) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")

  const selectedOption = options.find((option) => option.value === value)
  const selectedLabel = selectedOption?.label ?? ""

  // Case-insensitive substring match on label + hint, in the given order.
  const needle = search.trim().toLowerCase()
  const filtered = needle
    ? options.filter(
        (o) =>
          o.label.toLowerCase().includes(needle) ||
          (o.hint?.toLowerCase().includes(needle) ?? false)
      )
    : options

  const close = () => {
    setOpen(false)
    setSearch("")
  }

  const select = (next: string | null) => {
    onValueChange(next)
    close()
    // Drop focus so the on-screen keyboard goes away once a choice is made.
    inputRef.current?.blur()
  }

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
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <CommandPrimitive.Input
          ref={inputRef}
          id={id}
          disabled={disabled}
          aria-invalid={ariaInvalid}
          // Show the chosen name at rest; while the list is open show what is typed.
          value={open ? search : selectedLabel}
          onValueChange={(v) => {
            setSearch(v)
            setOpen(true)
          }}
          // Opening clears the field for typing; the current name stays
          // visible as the placeholder until a new one is picked.
          onFocus={() => {
            setOpen(true)
            setSearch("")
          }}
          placeholder={open && selectedLabel ? selectedLabel : placeholder}
          className={cn(
            // text-base on mobile stops iOS zooming the page on focus
            "flex h-11 w-full rounded-md border border-input bg-background py-2 pl-10 pr-10 text-base shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm",
            ariaInvalid && "border-red-500 dark:border-red-500"
          )}
        />
        {clearable && selectedOption && !open ? (
          <button
            type="button"
            onClick={() => select(null)}
            disabled={disabled}
            className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground"
            aria-label="Clear selection"
          >
            <CircleX className="h-5 w-5" aria-hidden="true" />
          </button>
        ) : (
          <button
            type="button"
            tabIndex={-1}
            disabled={disabled}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              if (open) {
                close()
              } else {
                inputRef.current?.focus()
              }
            }}
            className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground"
            aria-label={open ? "Close list" : "Open list"}
          >
            <ChevronsUpDown className="h-5 w-5" aria-hidden="true" />
          </button>
        )}
      </div>
      {open && (
        <CommandPrimitive.List
          // Keep focus in the field when an option is tapped, so blur doesn't
          // close the list before the selection lands.
          onMouseDown={(e) => e.preventDefault()}
          className={cn(
            "absolute z-50 max-h-60 w-full overflow-y-auto overscroll-contain rounded-md border bg-popover p-1 text-popover-foreground shadow-lg",
            listPosition === "above" ? "bottom-full mb-1" : "top-full mt-1"
          )}
        >
          <CommandPrimitive.Empty className="px-3 py-2 text-sm text-muted-foreground">
            {emptyText}
          </CommandPrimitive.Empty>
          {filtered.map((option) => (
            <CommandPrimitive.Item
              key={option.value}
              value={option.value}
              onSelect={() => select(option.value)}
              className="relative flex min-h-11 cursor-default select-none items-center gap-2 rounded-sm px-2 text-base outline-none data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground sm:min-h-9 sm:text-sm"
            >
              <Check
                className={cn(
                  "h-4 w-4 shrink-0",
                  value === option.value ? "opacity-100" : "opacity-0"
                )}
                aria-hidden="true"
              />
              <span className="truncate">{option.label}</span>
              {option.hint && (
                <span className="shrink-0 text-xs text-muted-foreground">
                  {option.hint}
                </span>
              )}
              {option.badges}
            </CommandPrimitive.Item>
          ))}
        </CommandPrimitive.List>
      )}
    </CommandPrimitive>
  )
}
