import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Bell,
  CalendarCheck,
  CalendarDays,
  Calendar,
  ClipboardList,
  Cog,
  Check,
  ChevronRight,
} from "lucide-react";
import {
  CheckIcon,
  QuestionMarkCircleIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

/**
 * STATIC PREVIEW — Action Center mockup (docs/ACTION_CENTER_PLAN.md).
 * No backend: hardcoded actions in the plan's envelope shape. Fully
 * interactive so the self-clearing "drain the list" behaviour can be felt:
 * handle an action and it animates out; clear everything for inbox zero.
 * Delete or replace when the real module is built.
 */

type Priority = "low" | "medium" | "high";

interface PreviewAction {
  id: string;
  moduleId: string;
  kind: string;
  title: string;
  description?: string;
  url: string;
  actionLabel?: string;
  priority: Priority;
  count?: number;
  createdAt: number;
  meta?: Record<string, unknown>;
}

const now = Date.now();
const HOUR = 60 * 60 * 1000;

const initialActions: PreviewAction[] = [
  {
    id: "availability:setAvailability",
    moduleId: "availability",
    kind: "setAvailability",
    title: "Set your availability for today",
    description: "Your status was reset at 4:00 AM and hasn't been set since.",
    url: "/availability",
    actionLabel: "Update availability",
    priority: "high",
    createdAt: now - 6 * HOUR,
  },
  {
    id: "bookings:bookingApprovals",
    moduleId: "bookings",
    kind: "bookingApprovals",
    title: "Bookings awaiting your approval",
    description: "Pumper (Sat 20 Jun), Meeting Room (Mon 22 Jun), Tanker (Wed 24 Jun).",
    url: "/bookings",
    actionLabel: "Review bookings",
    priority: "high",
    count: 3,
    createdAt: now - 26 * HOUR,
  },
  {
    id: "events:rsvp:demo1",
    moduleId: "events",
    kind: "rsvp",
    title: "RSVP: Sausage Sizzle at Bunnings",
    description: "Sat 20 Jun · 9:00 AM – 2:00 PM · Bunnings Warehouse",
    url: "/events",
    priority: "medium",
    createdAt: now - 48 * HOUR,
    meta: { startDate: "2026-06-20" },
  },
  {
    id: "actions:task:demo1",
    moduleId: "actions",
    kind: "task",
    title: "Replace battery in Tanker thermal camera",
    description: "Assigned to you by Cpt. M. Harris · Due Fri 19 Jun",
    url: "/actions?task=demo1",
    actionLabel: "Mark complete",
    priority: "medium",
    createdAt: now - 3 * 24 * HOUR,
    meta: { dueDate: "2026-06-19" },
  },
  {
    id: "settings:updateSkills",
    moduleId: "settings",
    kind: "updateSkills",
    title: "Your skills list is empty",
    description: "Add your qualifications (BA, Driver, …) so crew planning is accurate.",
    url: "/settings",
    actionLabel: "Update skills",
    priority: "low",
    createdAt: now - 14 * 24 * HOUR,
  },
];

const moduleIcons: Record<string, typeof Bell> = {
  availability: CalendarDays,
  bookings: Calendar,
  events: CalendarCheck,
  actions: ClipboardList,
  settings: Cog,
};

const moduleLabels: Record<string, string> = {
  availability: "Availability",
  bookings: "Bookings",
  events: "Events",
  actions: "Task",
  settings: "Settings",
};

const priorityAccent: Record<Priority, string> = {
  high: "border-red-600",
  medium: "border-amber-500",
  low: "border-gray-300 dark:border-gray-600",
};

function relativeAge(createdAt: number): string {
  const hours = Math.round((now - createdAt) / HOUR);
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

/** Inline RSVP — answer without leaving the Action Center */
function InlineRsvpButtons({ onAnswered }: { onAnswered: () => void }) {
  const [choice, setChoice] = useState<string | null>(null);

  const options = [
    { value: "attending", label: "Yes", icon: CheckIcon, active: "bg-green-600 text-white border-green-600" },
    { value: "maybe", label: "Maybe", icon: QuestionMarkCircleIcon, active: "bg-yellow-500 text-white border-yellow-500" },
    { value: "notAttending", label: "No", icon: XMarkIcon, active: "bg-red-600 text-white border-red-600" },
  ];

  return (
    <div className="flex gap-2">
      {options.map(({ value, label, icon: Icon, active }) => (
        <button
          key={value}
          disabled={choice !== null}
          onClick={() => {
            setChoice(value);
            // Brief beat so the selection registers before the card clears
            setTimeout(onAnswered, 450);
          }}
          className={`flex-1 px-3 py-2 min-h-[44px] text-sm font-semibold rounded-lg border transition-all flex items-center justify-center gap-1.5 ${
            choice === value
              ? `${active} scale-[1.03] shadow-md`
              : "border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 active:scale-95"
          } ${choice !== null && choice !== value ? "opacity-40" : ""}`}
        >
          <Icon className="h-4 w-4" />
          {label}
        </button>
      ))}
    </div>
  );
}

function ActionCard({
  action,
  leaving,
  index,
  onHandle,
}: {
  action: PreviewAction;
  leaving: boolean;
  index: number;
  onHandle: (action: PreviewAction, message: string) => void;
}) {
  const Icon = moduleIcons[action.moduleId] ?? Bell;

  return (
    // Height-collapse wrapper (grid-rows trick) so siblings glide up smoothly
    <div
      className={`grid transition-all duration-300 ease-in-out ${
        leaving ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] opacity-100"
      }`}
    >
      <div className="overflow-hidden min-h-0">
        <div
          className={`bg-white dark:bg-gray-800 shadow-sm rounded overflow-hidden border-l-4 ${priorityAccent[action.priority]} p-4 mb-3 transition-transform duration-300 ${
            leaving ? "-translate-x-6" : ""
          } animate-in fade-in slide-in-from-bottom-2 fill-mode-backwards`}
          style={{ animationDelay: `${index * 60}ms`, animationDuration: "350ms" }}
        >
          <div className="flex items-start gap-3">
            <div className="hidden sm:flex flex-shrink-0 h-10 w-10 rounded-lg bg-gray-100 dark:bg-gray-700 items-center justify-center">
              <Icon className="h-5 w-5 text-gray-600 dark:text-gray-300" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <Icon className="sm:hidden h-4 w-4 text-gray-400 flex-shrink-0" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                  {moduleLabels[action.moduleId] ?? action.moduleId}
                </span>
                <span className="text-[11px] text-gray-400 dark:text-gray-500 ml-auto flex-shrink-0">
                  {relativeAge(action.createdAt)} ago
                </span>
              </div>

              <h3 className="font-semibold text-gray-900 dark:text-white mt-1 flex items-center gap-2">
                {action.title}
                {action.count !== undefined && (
                  <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-red-600 text-white">
                    {action.count}
                  </span>
                )}
              </h3>

              {action.description && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5 leading-snug">
                  {action.description}
                </p>
              )}

              {/* kind-specific rich rendering vs. the generic CTA */}
              <div className="mt-3">
                {action.kind === "rsvp" ? (
                  <InlineRsvpButtons
                    onAnswered={() => onHandle(action, "RSVP saved")}
                  />
                ) : action.kind === "task" ? (
                  <button
                    onClick={() => onHandle(action, "Task completed")}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 min-h-[44px] text-sm font-semibold rounded-lg border border-green-600 text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 active:scale-95 transition-all"
                  >
                    <Check className="h-4 w-4" />
                    {action.actionLabel ?? "Mark complete"}
                  </button>
                ) : (
                  <button
                    onClick={() => onHandle(action, "Done — in the real app this deep-links first")}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 min-h-[44px] text-sm font-semibold rounded-lg bg-red-600 hover:bg-red-700 active:scale-95 text-white transition-all"
                  >
                    {action.actionLabel ?? "View"}
                    <ChevronRight className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ActionsPreviewPage() {
  const [actions, setActions] = useState<PreviewAction[]>(initialActions);
  const [leavingIds, setLeavingIds] = useState<Set<string>>(new Set());

  const remaining = actions.filter((a) => !leavingIds.has(a.id));
  const handledCount = initialActions.length - remaining.length;
  const allDone = remaining.length === 0;

  const { urgent, rest } = useMemo(
    () => ({
      urgent: actions.filter((a) => a.priority === "high"),
      rest: actions.filter((a) => a.priority !== "high"),
    }),
    [actions]
  );

  const handleAction = (action: PreviewAction, message: string) => {
    setLeavingIds((prev) => new Set(prev).add(action.id));
    // Remove after the collapse animation finishes
    setTimeout(() => {
      setActions((prev) => prev.filter((a) => a.id !== action.id));
      setLeavingIds((prev) => {
        const next = new Set(prev);
        next.delete(action.id);
        return next;
      });
    }, 320);

    toast.success(message, {
      description: "The action cleared itself — no mark-as-read needed.",
      action: {
        label: "Undo",
        onClick: () => {
          setActions((prev) => {
            if (prev.some((a) => a.id === action.id)) return prev;
            // Restore at its original position
            const restored = [...prev, action];
            restored.sort(
              (a, b) =>
                initialActions.findIndex((x) => x.id === a.id) -
                initialActions.findIndex((x) => x.id === b.id)
            );
            return restored;
          });
        },
      },
    });
  };

  const renderSection = (label: string, items: PreviewAction[], offset: number) =>
    items.length > 0 && (
      <div>
        <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-gray-400 dark:text-gray-500 mb-2 pl-1">
          {label}
        </h2>
        {items.map((action, i) => (
          <ActionCard
            key={action.id}
            action={action}
            leaving={leavingIds.has(action.id)}
            index={offset + i}
            onHandle={handleAction}
          />
        ))}
      </div>
    );

  return (
    <div className="space-y-4 max-w-3xl pb-8" data-component="ActionsPreviewPage">
      {/* Preview banner */}
      <div className="rounded border border-dashed border-amber-400 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/20 px-4 py-2.5 text-sm text-amber-800 dark:text-amber-200">
        <strong>Interactive preview</strong>
      </div>

      {/* Header with live bell + session progress */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2.5">
          <span className="relative">
            <Bell
              className={`h-6 w-6 transition-colors ${allDone ? "text-green-600 dark:text-green-500" : "text-red-600 dark:text-red-500"}`}
            />
            {!allDone && (
              <span className="absolute -top-1.5 -right-1.5 h-4 min-w-4 px-1 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center transition-all">
                {remaining.length}
              </span>
            )}
          </span>
          Action Center
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {allDone
            ? "Nothing needs your attention."
            : `${remaining.length} item${remaining.length === 1 ? "" : "s"} need${remaining.length === 1 ? "s" : ""} your attention`}
        </p>

        {/* Session progress — fills as you clear the list */}
        {handledCount > 0 && !allDone && (
          <div className="mt-3 flex items-center gap-3">
            <div className="flex-1 h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${(handledCount / initialActions.length) * 100}%` }}
              />
            </div>
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">
              {handledCount} of {initialActions.length} done
            </span>
          </div>
        )}
      </div>

      {allDone ? (
        /* Inbox zero — the state everyone wants to reach */
        <div className="bg-white dark:bg-gray-800 shadow-sm rounded px-6 py-12 text-center animate-in fade-in zoom-in-95 duration-500">
          <div className="mx-auto h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center animate-in zoom-in duration-500 delay-150 fill-mode-backwards">
            <Check className="h-8 w-8 text-green-600 dark:text-green-400" />
          </div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mt-4">
            You&apos;re all caught up
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-xs mx-auto">
            New actions appear here the moment something needs you — and clear themselves
            the moment it&apos;s done.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {renderSection("Needs attention now", urgent, 0)}
          {renderSection("When you get a chance", rest, urgent.length)}
        </div>
      )}
    </div>
  );
}
