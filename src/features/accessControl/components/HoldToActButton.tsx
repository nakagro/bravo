import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface HoldToActButtonProps {
  /** e.g. "Hold to unlock". */
  label: string;
  icon?: ReactNode;
  onComplete: () => void;
  /**
   * For a tap that can't be a hold (a screen reader's double tap): open a
   * normal confirmation instead of acting.
   */
  onTapFallback: () => void;
  disabled?: boolean;
  durationMs?: number;
  className?: string;
}

/**
 * A button that acts only after a press and hold, so a door can't open from a
 * pocket or a stray tap but needs no second screen either. The fill shows how
 * long is left. Letting go early cancels; so does scrolling, which the browser
 * reports as pointercancel. Space or Enter held down does the same from a
 * keyboard.
 */
export function HoldToActButton({
  label,
  icon,
  onComplete,
  onTapFallback,
  disabled,
  durationMs = 700,
  className,
}: HoldToActButtonProps) {
  const [fill, setFill] = useState(0);
  const [hint, setHint] = useState(false);
  const start = useRef<number | null>(null);
  const frame = useRef<number | null>(null);
  const holding = useRef(false);
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopFrame = () => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
  };

  useEffect(
    () => () => {
      stopFrame();
      if (hintTimer.current) clearTimeout(hintTimer.current);
    },
    [],
  );

  const begin = () => {
    if (disabled || holding.current) return;
    holding.current = true;
    setHint(false);
    start.current = performance.now();
    const tick = (t: number) => {
      if (!holding.current || start.current === null) return;
      const p = Math.min(1, (t - start.current) / durationMs);
      setFill(p);
      if (p >= 1) {
        holding.current = false;
        stopFrame();
        try {
          navigator.vibrate?.(15);
        } catch {
          // iOS has no vibration API.
        }
        onComplete();
        setTimeout(() => setFill(0), 150);
        return;
      }
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
  };

  const cancel = () => {
    if (!holding.current) return;
    holding.current = false;
    stopFrame();
    setFill(0);
    setHint(true);
    if (hintTimer.current) clearTimeout(hintTimer.current);
    hintTimer.current = setTimeout(() => setHint(false), 1800);
  };

  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={`${label}, press and hold`}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        begin();
      }}
      onPointerUp={cancel}
      onPointerCancel={cancel}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={(e) => {
        if (e.key !== " " && e.key !== "Enter") return;
        e.preventDefault();
        if (!e.repeat) begin();
      }}
      onKeyUp={(e) => {
        if (e.key !== " " && e.key !== "Enter") return;
        e.preventDefault();
        cancel();
      }}
      onClick={(e) => {
        // detail 0: activated without a pointer or our key handling (assistive tech).
        if (e.detail === 0 && !holding.current) onTapFallback();
      }}
      className={cn(
        "relative flex h-11 w-full touch-manipulation select-none items-center justify-center gap-2 overflow-hidden rounded-lg",
        "border border-input bg-background text-sm font-medium text-foreground shadow-sm transition-colors",
        "[-webkit-touch-callout:none] [-webkit-user-select:none]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-0 bg-primary/20"
        style={{ width: `${fill * 100}%` }}
      />
      <span className="relative flex items-center gap-2 [&_svg]:size-4">
        {icon}
        {hint ? "Keep holding" : label}
      </span>
    </button>
  );
}
