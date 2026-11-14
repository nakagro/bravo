import { type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  /** A lucide icon, e.g. `<Inbox />`. Size and colour are set here. */
  icon: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  secondaryDescription?: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  /** Any other action, e.g. a Link button. Shown under the text. */
  action?: ReactNode;
  /** "sm" for an empty list inside a card or panel. */
  size?: "default" | "sm";
  className?: string;
}

/**
 * The one "nothing here yet" block, on shadcn's Empty. Use it for an empty
 * list or page instead of a hand-styled icon and heading.
 */
export function EmptyState({
  icon,
  title,
  description,
  secondaryDescription,
  actionLabel,
  onAction,
  action,
  size = "default",
  className,
}: EmptyStateProps) {
  const small = size === "sm";
  return (
    <Empty className={cn(small ? "gap-3 p-4 md:p-6" : "py-12", className)}>
      <EmptyHeader>
        <EmptyMedia
          className={cn(
            "rounded-full bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400",
            small ? "p-3 [&_svg]:size-5!" : "p-5 [&_svg]:size-8!",
          )}
        >
          {icon}
        </EmptyMedia>
        <EmptyTitle className={small ? "text-base" : undefined}>{title}</EmptyTitle>
        {description && <EmptyDescription>{description}</EmptyDescription>}
        {secondaryDescription && (
          <EmptyDescription className="text-xs">{secondaryDescription}</EmptyDescription>
        )}
      </EmptyHeader>
      {(action || (actionLabel && onAction)) && (
        <EmptyContent>
          {action ?? <Button onClick={onAction}>{actionLabel}</Button>}
        </EmptyContent>
      )}
    </Empty>
  );
}
