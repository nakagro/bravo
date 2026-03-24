import { type ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description?: string;
  secondaryDescription?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  icon,
  title,
  description,
  secondaryDescription,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <div className="rounded-full bg-red-50 dark:bg-red-950/30 p-5 mb-5">
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{title}</h3>
      {description && (
        <p className="text-gray-500 dark:text-gray-400 text-center mb-2 max-w-md">
          {description}
        </p>
      )}
      {secondaryDescription && (
        <p className="text-gray-400 dark:text-gray-500 text-center mb-6 max-w-md text-sm">
          {secondaryDescription}
        </p>
      )}
      {actionLabel && onAction && (
        <Button
          onClick={onAction}
          className="bg-red-700 hover:bg-red-800 dark:bg-red-600 dark:hover:bg-red-700 text-white"
        >
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
