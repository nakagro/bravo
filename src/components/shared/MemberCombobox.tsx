import { useId } from "react";
import { Combobox } from "@/components/ui/combobox";
import { Id } from "../../../convex/_generated/dataModel";

export interface MemberOption {
  _id: Id<"users">;
  name: string;
  rank?: string;
}

interface MemberComboboxProps {
  label: string;
  options: MemberOption[];
  value: Id<"users"> | null;
  onChange: (value: Id<"users"> | null) => void;
  placeholder?: string;
  required?: boolean;
  /** Deleting the name and leaving the field clears it. Defaults to !required. */
  clearable?: boolean;
  emptyText?: string;
  error?: string;
  helperText?: string;
  /**
   * Let the picker hold someone who isn't on BRAVO, typed in as a name. Pass
   * the current name (or "") to enable it; typing a name offers "Add ...".
   */
  externalName?: string;
  onExternalChange?: (name: string) => void;
}

// Stands in for an external name so the underlying picker can show it as chosen.
const EXTERNAL_VALUE = "__external__";

export function MemberCombobox({
  label,
  options,
  value,
  onChange,
  placeholder = "Search for a member",
  required,
  clearable = !required,
  emptyText = "No members found.",
  error,
  helperText,
  externalName,
  onExternalChange,
}: MemberComboboxProps) {
  const id = useId();

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <Combobox
        id={id}
        options={[
          ...(externalName ? [{ value: EXTERNAL_VALUE, label: externalName, hint: "Not on BRAVO" }] : []),
          ...options.map((o) => ({ value: o._id, label: o.name, hint: o.rank })),
        ]}
        value={externalName ? EXTERNAL_VALUE : value}
        onValueChange={(v) => {
          if (v === EXTERNAL_VALUE) return;
          if (externalName) onExternalChange?.("");
          onChange(v as Id<"users"> | null);
        }}
        onCreate={
          onExternalChange
            ? (name) => {
                if (value) onChange(null);
                onExternalChange(name);
              }
            : undefined
        }
        createHint={onExternalChange ? "Not listed? Type their name to add them." : undefined}
        placeholder={placeholder}
        emptyText={emptyText}
        clearable={clearable}
        aria-invalid={!!error}
      />
      {error ? (
        <p className="mt-1 text-sm text-destructive">{error}</p>
      ) : helperText ? (
        <p className="mt-1 text-xs text-muted-foreground">{helperText}</p>
      ) : null}
    </div>
  );
}
