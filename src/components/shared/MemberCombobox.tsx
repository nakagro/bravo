import { Fragment, useState } from "react";
import { Combobox, Transition } from "@headlessui/react";
import { CheckIcon, ChevronUpDownIcon } from "@heroicons/react/20/solid";
import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { Id } from "../../../../convex/_generated/dataModel";

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
  emptyText = "No members found.",
  error,
  helperText,
}: MemberComboboxProps) {
  const [query, setQuery] = useState("");

  const filtered =
    query === ""
      ? options
      : options.filter((o) => o.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <div>
      <Combobox value={value} onChange={(v: Id<"users"> | null) => onChange(v)} nullable>
        <div className="relative">
          <Combobox.Label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {label}
            {required && <span className="text-red-500 ml-0.5">*</span>}
          </Combobox.Label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
            </div>
            <Combobox.Input
              className={`w-full pl-10 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500 dark:bg-gray-700 dark:text-white ${
                error
                  ? "border-red-500 dark:border-red-500"
                  : "border-gray-300 dark:border-gray-600"
              }`}
              displayValue={(_id: Id<"users"> | null) => {
                if (!_id) return "";
                const u = options.find((o) => o._id === _id);
                return u ? u.name : "";
              }}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={placeholder}
            />
            <Combobox.Button className="absolute inset-y-0 right-0 flex items-center pr-2">
              <ChevronUpDownIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
            </Combobox.Button>
          </div>
          <Transition
            as={Fragment}
            leave="transition ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
            afterLeave={() => setQuery("")}
          >
            <Combobox.Options className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white dark:bg-gray-800 py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
              {filtered.length === 0 ? (
                <div className="relative cursor-default select-none py-2 px-4 text-gray-700 dark:text-gray-300">
                  {emptyText}
                </div>
              ) : (
                filtered.map((option) => (
                  <Combobox.Option
                    key={option._id}
                    value={option._id}
                    className={({ active }) =>
                      `relative cursor-default select-none py-2 pl-10 pr-4 ${
                        active ? "bg-red-600 text-white" : "text-gray-900 dark:text-gray-200"
                      }`
                    }
                  >
                    {({ selected: isSelected, active }) => (
                      <>
                        <span
                          className={`block truncate ${isSelected ? "font-medium" : "font-normal"}`}
                        >
                          {option.name}
                          {option.rank && (
                            <span
                              className={`ml-2 text-xs ${
                                active ? "text-white/80" : "text-muted-foreground"
                              }`}
                            >
                              {option.rank}
                            </span>
                          )}
                        </span>
                        {isSelected ? (
                          <span
                            className={`absolute inset-y-0 left-0 flex items-center pl-3 ${
                              active ? "text-white" : "text-red-600"
                            }`}
                          >
                            <CheckIcon className="h-5 w-5" aria-hidden="true" />
                          </span>
                        ) : null}
                      </>
                    )}
                  </Combobox.Option>
                ))
              )}
            </Combobox.Options>
          </Transition>
        </div>
      </Combobox>
      {error ? (
        <p className="mt-1 text-sm text-destructive">{error}</p>
      ) : helperText ? (
        <p className="mt-1 text-xs text-muted-foreground">{helperText}</p>
      ) : null}
    </div>
  );
}
