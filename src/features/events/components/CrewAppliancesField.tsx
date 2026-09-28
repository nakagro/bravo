import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { QUICK_APPLIANCES, quickApplianceName } from "@/components/shared/crew/crewSeats";

const MAX_APPLIANCES = 6;

interface CrewAppliancesFieldProps {
  value: string[];
  onChange: (names: string[]) => void;
  /** Appliances that already have someone seated, keyed lower-case - removing one takes its crew */
  crewedNames: Set<string>;
  /** Names the event had when the form opened, so a removal can be flagged */
  savedNames: string[];
}

const key = (name: string) => name.trim().toLowerCase();

/**
 * Which appliances the event needs crewed. Just the trucks - the seats are
 * filled in on the event page, usually later, once the crew is known.
 */
export function CrewAppliancesField({ value, onChange, crewedNames, savedNames }: CrewAppliancesFieldProps) {
  const [custom, setCustom] = useState("");
  const selected = new Set(value.map(key));
  const quickNames = QUICK_APPLIANCES.map(quickApplianceName);
  const customNames = value.filter((name) => !quickNames.some((q) => key(q) === key(name)));

  const toggle = (name: string) =>
    onChange(selected.has(key(name)) ? value.filter((n) => key(n) !== key(name)) : [...value, name]);

  const addCustom = () => {
    const name = custom.trim();
    if (!name || selected.has(key(name)) || value.length >= MAX_APPLIANCES) return;
    onChange([...value, name]);
    setCustom("");
  };

  // Crews that will be lost on save: saved, seated, and no longer listed
  const losing = savedNames.filter((name) => crewedNames.has(key(name)) && !selected.has(key(name)));

  return (
    <div className="space-y-2 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
      <div className="flex flex-wrap gap-2">
        {QUICK_APPLIANCES.map((appliance) => {
          const name = quickApplianceName(appliance);
          const on = selected.has(key(name));
          return (
            <button
              key={name}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(name)}
              className={cn(
                "px-3 py-1.5 rounded-full text-sm border transition-colors min-h-[36px]",
                on
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200"
              )}
            >
              {appliance}
            </button>
          );
        })}
        {customNames.map((name) => (
          <span
            key={name}
            className="inline-flex items-center gap-1 pl-3 pr-1 py-1 rounded-full text-sm border bg-primary text-primary-foreground border-primary min-h-[36px]"
          >
            {name}
            <button
              type="button"
              onClick={() => toggle(name)}
              aria-label={`Remove ${name}`}
              className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-white/20"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addCustom();
            }
          }}
          placeholder="Another appliance, e.g. Werribee Tanker"
          maxLength={60}
          aria-label="Another appliance name"
          className="min-w-0 flex-1 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-base"
        />
        <Button
          type="button"
          variant="outline"
          className="h-11 shrink-0"
          onClick={addCustom}
          disabled={!custom.trim() || value.length >= MAX_APPLIANCES}
        >
          Add
        </Button>
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-400">
        The crew is picked on the event page once you know who&apos;s on.
      </p>
      {losing.length > 0 && (
        <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
          Saving removes {losing.join(" and ")} and the crew already on {losing.length === 1 ? "it" : "them"}.
        </p>
      )}
    </div>
  );
}
