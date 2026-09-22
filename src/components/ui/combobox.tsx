import * as React from "react"
import { Check, ChevronsUpDown, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

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
  searchPlaceholder?: string
  emptyText?: string
  /** Adds a "Clear selection" row while a value is set. */
  clearable?: boolean
  className?: string
  disabled?: boolean
  id?: string
  "aria-invalid"?: boolean
}

// Plain case-insensitive substring match on label + hint. cmdk's default
// fuzzy scorer would also match against the option value (a Convex id) and
// reorder results.
function filterByKeywords(_value: string, search: string, keywords?: string[]) {
  const needle = search.trim().toLowerCase()
  if (!needle) return 1
  return (keywords ?? []).some((k) => k.toLowerCase().includes(needle)) ? 1 : 0
}

export function Combobox({
  options,
  value,
  onValueChange,
  placeholder = "Select option...",
  searchPlaceholder = "Search...",
  emptyText = "No option found.",
  clearable = false,
  className,
  disabled = false,
  id,
  "aria-invalid": ariaInvalid,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false)

  const selectedOption = options.find((option) => option.value === value)

  const select = (next: string | null) => {
    onValueChange(next)
    setOpen(false)
  }

  return (
    // modal: gives the list its own scroll lock, so it still scrolls on touch
    // when the combobox sits inside a Dialog/Drawer (which lock body scroll).
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-invalid={ariaInvalid}
          className={cn(
            "h-11 w-full justify-between px-3 font-normal",
            !selectedOption && "text-muted-foreground",
            ariaInvalid && "border-red-500 dark:border-red-500",
            className
          )}
          disabled={disabled}
        >
          <span className="truncate">
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] min-w-[16rem] p-0"
        align="start"
      >
        <Command filter={filterByKeywords}>
          {/* text-base on mobile stops iOS zooming the page on focus */}
          <CommandInput placeholder={searchPlaceholder} className="text-base sm:text-sm" />
          <CommandList className="max-h-[min(300px,50dvh)]">
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {clearable && selectedOption && (
                <CommandItem
                  value="__clear__"
                  onSelect={() => select(null)}
                  className="min-h-11 text-muted-foreground sm:min-h-9"
                >
                  <X className="h-4 w-4" />
                  Clear selection
                </CommandItem>
              )}
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  keywords={option.hint ? [option.label, option.hint] : [option.label]}
                  onSelect={() => select(option.value)}
                  className="min-h-11 sm:min-h-9"
                >
                  <Check
                    className={cn(
                      "h-4 w-4",
                      value === option.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="truncate">{option.label}</span>
                  {option.hint && (
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {option.hint}
                    </span>
                  )}
                  {option.badges}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
