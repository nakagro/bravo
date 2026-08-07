import { useEffect, useRef, useState } from "react";
import { TriangleAlert } from "lucide-react";
import { ProgressRing } from "@/components/common/ProgressRing";
import { cn } from "@/lib/utils";
import { ringColorFor, type ChecklistProgress } from "./checklistStatus";

interface ChecklistProgressHeaderProps {
  progress: ChecklistProgress;
  /** Rendered to the left of the ring — e.g. a back button. */
  leading?: React.ReactNode;
  /** Rendered above the counts — e.g. a run title. */
  title?: React.ReactNode;
  className?: string;
}

/**
 * Tracks whether the sticky header has parked against the app header, so it
 * can stay flat while it's just part of the page and only lift once it's
 * actually floating over content.
 */
function useIsStuck() {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    // Cached so the scroll handler stays a single rect read.
    let offset = 0;
    const measure = () => {
      offset =
        parseFloat(
          getComputedStyle(document.documentElement).getPropertyValue(
            "--app-header-height",
          ),
        ) || 0;
    };

    const update = () => setStuck(sentinel.getBoundingClientRect().top <= offset);
    const onResize = () => {
      measure();
      update();
    };

    onResize();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return { sentinelRef, stuck };
}

/**
 * The sticky top chrome shared by every checklist screen: how far through you
 * are and how much needs attention.
 *
 * It parks beneath the app header rather than at the viewport top — both were
 * previously `sticky top-0 z-10`, so this bar painted straight over the
 * brigade title bar.
 *
 * There is deliberately no section quick-nav pill row. It only ever fitted on
 * a wide viewport — on a phone the later sections sat off-screen with no way
 * to reach them, so it was navigation that silently hid most of its targets.
 * The section headers themselves carry per-section progress.
 */
export function ChecklistProgressHeader({
  progress,
  leading,
  title,
  className,
}: ChecklistProgressHeaderProps) {
  const { sentinelRef, stuck } = useIsStuck();

  return (
    <>
      <div ref={sentinelRef} aria-hidden="true" className="h-0" />
      <div
        className={cn(
          // Full-bleed through the page gutter so content can't slide past
          // beside it, and parked under the app header.
          "sticky z-20 -mx-4 px-4 py-2 transition-shadow duration-200",
          "top-[var(--app-header-height,0px)]",
          stuck
            ? "bg-gray-50/90 dark:bg-gray-900/90 backdrop-blur border-b border-gray-200 dark:border-gray-700 shadow-sm"
            : "border-b border-transparent",
          className,
        )}
        data-component="ChecklistProgressHeader"
      >
        <div className="flex items-center gap-3">
          {leading}
          <ProgressRing
            percentage={progress.percentage}
            size={40}
            strokeWidth={4}
            color={ringColorFor(progress)}
            labelClass="text-[10px] font-bold"
          />
          <div className="flex-1 min-w-0">
            {title}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-gray-900 dark:text-white tabular-nums">
                {progress.answered}/{progress.total}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">done</span>
              {progress.attention > 0 && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[11px] font-medium border border-amber-400 text-amber-700 dark:text-amber-400">
                  <TriangleAlert className="h-3 w-3" aria-hidden="true" />
                  {progress.attention} need
                  {progress.attention === 1 ? "s" : ""} attention
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
