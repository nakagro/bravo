import { cn } from "@/lib/utils";
import { QUICK_APPLIANCES, quickApplianceName } from "./crewSeats";

interface ApplianceNameFieldProps {
  id: string;
  value: string;
  onChange: (name: string) => void;
  error?: string;
}

/** Pumper / Tanker / FCV chips, or a typed name for another brigade's truck. */
export function ApplianceNameField({ id, value, onChange, error }: ApplianceNameFieldProps) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        Appliance<span className="text-red-500 ml-0.5">*</span>
      </label>
      <div className="flex flex-wrap gap-2 mb-2">
        {QUICK_APPLIANCES.map((appliance) => {
          const name = quickApplianceName(appliance);
          return (
            <button
              key={name}
              type="button"
              onClick={() => onChange(name)}
              className={cn(
                "px-3 py-1.5 rounded-full text-sm border transition-colors min-h-[36px]",
                value === name
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200"
              )}
            >
              {appliance}
            </button>
          );
        })}
      </div>
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Or type a name, e.g. Werribee Tanker"
        maxLength={60}
        aria-invalid={!!error}
        className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-base"
      />
      {error && <p className="mt-1 text-sm text-destructive">{error}</p>}
    </div>
  );
}
