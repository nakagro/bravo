import { Button } from "@/components/ui/button";
import { Minus, Plus } from "lucide-react";

interface StepperInputProps {
  value: number | undefined;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  /** Label shown above the value */
  label?: string;
  /** Size variant */
  size?: "sm" | "md" | "lg";
}

export function StepperInput({
  value,
  onChange,
  min = 0,
  max = 999,
  step = 1,
  disabled = false,
  label,
  size = "md",
}: StepperInputProps) {
  const displayValue = value ?? 0;

  const handleDecrement = () => {
    const next = Math.max(min, displayValue - step);
    onChange(next);
  };

  const handleIncrement = () => {
    const next = Math.min(max, displayValue + step);
    onChange(next);
  };

  const btnSize = size === "lg" ? "h-12 w-12" : size === "md" ? "h-10 w-10" : "h-8 w-8";
  const textSize = size === "lg" ? "text-2xl min-w-[3rem]" : size === "md" ? "text-xl min-w-[2.5rem]" : "text-lg min-w-[2rem]";

  return (
    <div className="flex flex-col items-center gap-1">
      {label && (
        <span className="text-xs text-muted-foreground font-medium">{label}</span>
      )}
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className={`${btnSize} rounded-full border-2 flex-shrink-0 active:scale-95 transition-transform`}
          onClick={handleDecrement}
          disabled={disabled || displayValue <= min}
        >
          <Minus className="h-4 w-4" />
        </Button>
        <span className={`${textSize} font-bold text-center tabular-nums text-gray-900 dark:text-gray-100`}>
          {displayValue}
        </span>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className={`${btnSize} rounded-full border-2 flex-shrink-0 active:scale-95 transition-transform`}
          onClick={handleIncrement}
          disabled={disabled || displayValue >= max}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
