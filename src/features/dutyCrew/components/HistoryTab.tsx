import { useState } from "react";
import { useQuery, usePaginatedQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  CircleCheck,
  CircleSlash,
  CircleX,
  ChevronRight,
  ClipboardCheck,
  LoaderCircle,
} from "lucide-react";
import { Accordion } from "@/components/ui/accordion";
import {
  ChecklistRow,
  ChecklistSection,
  summariseChecklist,
} from "@/components/shared/checklist";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  formatDate,
  formatDateShort,
  formatMonthYear,
  formatTime,
  getUserFullName,
  isItemResolved,
  checkItemStatus,
} from "../types";

const PAGE_SIZE = 12;

interface HistorySubmission {
  _id: Id<"stationCheckSubmissions">;
  date: number;
  completedAt: number;
  dutyCrew: { _id: Id<"dutyCrew">; name: string } | null;
  completedBy: {
    _id: Id<"users">;
    name: string;
    firstName?: string;
    lastName?: string;
  };
  checkItems: Array<{
    checkId?: Id<"stationChecks">;
    subItemId?: Id<"stationCheckSubitems">;
    parentCheckId?: Id<"stationChecks">;
    name: string;
    area?: string;
    isPriority?: boolean;
    isCompleted: boolean;
    isNotApplicable?: boolean;
    notes?: string;
    isAdHoc?: boolean;
  }>;
  notes?: string;
}

function completionBadgeClass(completed: number, total: number) {
  if (total === 0) return "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400";
  const pct = completed / total;
  if (pct === 1) return "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400";
  if (pct >= 0.7) return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400";
  return "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400";
}

function ItemStatusIcon({
  item,
}: {
  item: { isCompleted: boolean; isNotApplicable?: boolean };
}) {
  if (item.isCompleted) {
    return <CircleCheck className="h-4 w-4 text-green-500 dark:text-green-400 flex-shrink-0 mt-0.5" />;
  }
  if (item.isNotApplicable) {
    return <CircleSlash className="h-4 w-4 text-amber-500 dark:text-amber-400 flex-shrink-0 mt-0.5" />;
  }
  return <CircleX className="h-4 w-4 text-red-500 dark:text-red-400 flex-shrink-0 mt-0.5" />;
}

function SubmissionDetail({ submission }: { submission: HistorySubmission }) {
  const templateItems = submission.checkItems.filter((i) => !i.isAdHoc);
  const adHocItems = submission.checkItems.filter((i) => i.isAdHoc);

  // Group template items by snapshotted area; unlabelled items last
  const areaGroups: { key: string; name: string; items: typeof templateItems }[] = [];
  const generalItems: typeof templateItems = [];
  for (const item of templateItems) {
    if (item.area) {
      const group = areaGroups.find((g) => g.name === item.area);
      if (group) group.items.push(item);
      else areaGroups.push({ key: `section-${item.area}`, name: item.area, items: [item] });
    } else {
      generalItems.push(item);
    }
  }
  if (generalItems.length > 0) {
    areaGroups.push({ key: "section-general", name: "General", items: generalItems });
  }
  if (adHocItems.length > 0) {
    areaGroups.push({ key: "section-adhoc", name: "Additional Items", items: adHocItems });
  }

  const sections = areaGroups.map((g) => ({
    ...g,
    progress: summariseChecklist(g.items.map(checkItemStatus)),
  }));

  return (
    <div className="space-y-3 p-4 overflow-y-auto">
      <p className="text-xs text-gray-500 dark:text-gray-400">
        {submission.dutyCrew?.name ?? "Unknown crew"} &middot;{" "}
        {getUserFullName(submission.completedBy)} &middot;{" "}
        {formatTime(submission.completedAt)}
      </p>

      <Accordion
        type="multiple"
        defaultValue={sections.map((s) => s.key)}
        className="space-y-3"
      >
        {sections.map((section) => (
          <ChecklistSection
            key={section.key}
            value={section.key}
            name={section.name}
            progress={section.progress}
          >
            {section.items.map((item, idx) => {
              const status = checkItemStatus(item);
              return (
                <div
                  key={`${item.subItemId ?? item.checkId ?? idx}-${item.name}`}
                  className={
                    item.parentCheckId
                      ? "ml-5 border-l-2 border-muted pl-3 sm:ml-8"
                      : undefined
                  }
                >
                  <ChecklistRow
                    status={status}
                    name={item.name}
                    notes={item.notes}
                    leading={<ItemStatusIcon item={item} />}
                    badges={
                      <>
                        {status === "attention" && (
                          <span className="px-1.5 py-0.5 text-[10px] font-medium bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 rounded">
                            N/A
                          </span>
                        )}
                        {item.isAdHoc && (
                          <span className="px-1.5 py-0.5 text-[10px] font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded">
                            Ad-hoc
                          </span>
                        )}
                      </>
                    }
                  />
                </div>
              );
            })}
          </ChecklistSection>
        ))}
      </Accordion>

      {/* General notes */}
      {submission.notes && submission.notes.trim() && (
        <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            General notes
          </p>
          <p className="text-xs text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800/60 rounded p-2">
            {submission.notes}
          </p>
        </div>
      )}
    </div>
  );
}

export function HistoryTab() {
  const isMobile = useIsMobile();
  const dutyCrews = useQuery(api.dutyCrew.getAllDutyCrews, {});
  const [crewFilter, setCrewFilter] = useState<Id<"dutyCrew"> | "all">("all");
  const [viewing, setViewing] = useState<HistorySubmission | null>(null);

  const { results, status, loadMore } = usePaginatedQuery(
    api.stationChecks.getStationCheckHistoryPage,
    { dutyCrewId: crewFilter === "all" ? undefined : crewFilter },
    { initialNumItems: PAGE_SIZE }
  );

  // Group loaded submissions by calendar month (results arrive newest first)
  const monthGroups: { label: string; items: HistorySubmission[] }[] = [];
  for (const submission of results) {
    const label = formatMonthYear(submission.date);
    const group = monthGroups[monthGroups.length - 1];
    if (group && group.label === label) {
      group.items.push(submission);
    } else {
      monthGroups.push({ label, items: [submission] });
    }
  }

  const showAllCrews = crewFilter === "all";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">
          Check History
        </h2>
        <Select
          value={crewFilter}
          onValueChange={(value) =>
            setCrewFilter(value as Id<"dutyCrew"> | "all")
          }
        >
          <SelectTrigger
            className="w-40 min-h-[40px]"
            aria-label="Filter by duty crew"
          >
            <SelectValue placeholder="All crews" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All crews</SelectItem>
            {(dutyCrews ?? []).map((crew) => (
              <SelectItem key={crew._id} value={crew._id}>
                {crew.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {status === "LoadingFirstPage" ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-14 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"
            />
          ))}
        </div>
      ) : results.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-gray-400 dark:text-gray-600 gap-2 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <ClipboardCheck className="h-8 w-8" />
          <p className="text-sm">No completed check submissions yet</p>
        </div>
      ) : (
        <>
          {monthGroups.map((group) => (
            <div key={group.label} className="space-y-2">
              <div className="pt-1 flex items-center gap-2">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {group.label}
                </span>
                <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
              </div>

              <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700 overflow-hidden">
                {group.items.map((submission) => {
                  const completed = submission.checkItems.filter(isItemResolved).length;
                  const total = submission.checkItems.length;
                  return (
                    <button
                      key={submission._id}
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors text-left"
                      onClick={() => setViewing(submission)}
                    >
                      <span
                        className={cn(
                          "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold tabular-nums flex-shrink-0",
                          completionBadgeClass(completed, total)
                        )}
                      >
                        {completed}/{total}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {formatDateShort(submission.date)}
                          {showAllCrews && submission.dutyCrew && (
                            <span className="font-normal text-gray-500 dark:text-gray-400">
                              {" "}
                              &middot; {submission.dutyCrew.name}
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {getUserFullName(submission.completedBy)} &middot;{" "}
                          {formatTime(submission.completedAt)}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {status !== "Exhausted" && (
            <Button
              variant="outline"
              className="w-full min-h-[44px]"
              disabled={status === "LoadingMore"}
              onClick={() => loadMore(PAGE_SIZE)}
            >
              {status === "LoadingMore" ? (
                <span className="flex items-center gap-2">
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  Loading...
                </span>
              ) : (
                "Show earlier"
              )}
            </Button>
          )}
        </>
      )}

      {/* Submission detail Drawer/Sheet */}
      {isMobile ? (
        <Drawer
          open={!!viewing}
          onOpenChange={(open) => !open && setViewing(null)}
        >
          <DrawerContent className="max-h-[85vh]">
            <DrawerHeader>
              <DrawerTitle>
                {viewing ? formatDate(viewing.date) : "Submission"}
              </DrawerTitle>
            </DrawerHeader>
            {viewing && <SubmissionDetail submission={viewing} />}
          </DrawerContent>
        </Drawer>
      ) : (
        <Sheet
          open={!!viewing}
          onOpenChange={(open) => !open && setViewing(null)}
        >
          <SheetContent className="overflow-y-auto">
            <SheetHeader>
              <SheetTitle>
                {viewing ? formatDate(viewing.date) : "Submission"}
              </SheetTitle>
            </SheetHeader>
            {viewing && <SubmissionDetail submission={viewing} />}
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}
