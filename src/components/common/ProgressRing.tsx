interface ProgressRingProps {
  /** 0-100 */
  percentage: number;
  /** Diameter in px */
  size?: number;
  /** Ring thickness in px */
  strokeWidth?: number;
  /** Color of filled portion (Tailwind class or CSS color) */
  color?: string;
  /** Color of unfilled track */
  trackColor?: string;
  /** Show percentage text in center */
  showLabel?: boolean;
  /** Optional label override (e.g., "5/10") */
  label?: string;
  /** Font size class for the label */
  labelClass?: string;
}

export function ProgressRing({
  percentage,
  size = 56,
  strokeWidth = 5,
  color = "stroke-red-600 dark:stroke-red-500",
  trackColor = "stroke-gray-200 dark:stroke-gray-700",
  showLabel = true,
  label,
  labelClass = "text-xs font-semibold",
}: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(percentage, 100) / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className={trackColor}
        />
        {/* Fill */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={`${color} transition-all duration-500 ease-out`}
        />
      </svg>
      {showLabel && (
        <span className={`absolute ${labelClass} text-gray-900 dark:text-gray-100`}>
          {label ?? `${Math.round(percentage)}%`}
        </span>
      )}
    </div>
  );
}
