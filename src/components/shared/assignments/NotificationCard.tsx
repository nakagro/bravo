import { cn } from "@/lib/utils";

/**
 * A push notification as a member will see it. Shared by the confirm step of
 * every targeted send and the admin template editor, so what the sender checks
 * looks like what lands on the phone.
 */
export function NotificationCard({
  title,
  body,
  className,
}: {
  title: string;
  body: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/60 p-3 shadow-sm",
        className
      )}
    >
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        <img src="/icons/favicon-96x96.png" alt="" className="h-4 w-4 rounded" onError={(e) => (e.currentTarget.style.display = "none")} />
        BRAVO
      </div>
      <div className="mt-1 text-sm font-semibold text-gray-900 dark:text-white break-words">{title}</div>
      <div className="mt-0.5 whitespace-pre-line text-sm text-gray-700 dark:text-gray-300 break-words">{body}</div>
    </div>
  );
}
