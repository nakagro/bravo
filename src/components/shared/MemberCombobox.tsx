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
  /** Offer a "Clear selection" row. Defaults to !required. */
  clearable?: boolean;
  emptyText?: string;
  error?: string;
  helperText?: string;
}

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
        options={options.map((o) => ({ value: o._id, label: o.name, hint: o.rank }))}
        value={value}
        onValueChange={(v) => onChange(v as Id<"users"> | null)}
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
