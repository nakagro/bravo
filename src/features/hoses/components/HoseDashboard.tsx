import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Card, CardContent } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  WrenchScrewdriverIcon,
  XCircleIcon,
  ChartBarIcon,
  ClockIcon,
} from "@heroicons/react/24/outline";
import {
  MapPin,
  Ruler,
  Layers,
  TriangleAlert,
  ArrowRight,
  Flame,
} from "lucide-react";
import { Status, UpcomingTestFilter, OverdueFilter } from "../types";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface HoseDashboardProps {
  onStatusCardClick?: (status: Status) => void;
  onUpcomingTestClick?: (timeframe: UpcomingTestFilter) => void;
  onOverdueClick?: (timeframe: OverdueFilter) => void;
}

function DashboardActionCard({
  children,
  className,
  label,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="h-full w-full touch-manipulation text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <Card className={cn("h-full transition-[box-shadow,transform] hover:shadow-md motion-reduce:transition-none", className)}>
        {children}
      </Card>
    </button>
  );
}

// Simple horizontal bar for distribution charts
function DistributionBar({
  items,
  colorMap,
}: {
  items: { label: string; count: number; percentage: number }[];
  colorMap: Record<string, string>;
}) {
  if (items.length === 0) return null;
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-3">
          <span className="text-xs text-gray-600 dark:text-gray-400 w-20 text-right flex-shrink-0 truncate">
            {item.label}
          </span>
          <div className="flex-1 h-6 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none ${colorMap[item.label] || "bg-gray-400"}`}
              style={{ width: `${Math.max(item.percentage, 2)}%` }}
            />
          </div>
          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 w-8 text-right">
            {item.count}
          </span>
        </div>
      ))}
    </div>
  );
}

export function HoseDashboard({ onStatusCardClick, onUpcomingTestClick, onOverdueClick }: HoseDashboardProps) {
  const dashboardData = useQuery(api.hoseDashboard.getDashboardStats);

  if (!dashboardData) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-2"></div>
                  <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const {
    totalHoses,
    statusBreakdown,
    sizeBreakdown,
    typeBreakdown,
    locationBreakdown,
    lengthStats,
    testingStatus,
    upcomingTestDates,
    overdueBreakdown,
  } = dashboardData;

  // Check if there are critical items that need attention
  const criticalOverdue = overdueBreakdown.twelvePlusMonths;
  const urgentExpiring = upcomingTestDates.oneMonth;
  const hasAttentionItems = criticalOverdue > 0 || urgentExpiring > 0;

  // Size color map
  const sizeColors: Record<string, string> = {
    "25mm": "bg-blue-500",
    "38mm": "bg-amber-500",
    "65mm": "bg-red-500",
  };

  // Type color map
  const typeColors: Record<string, string> = {
    "Canvas": "bg-amber-600",
    "Duraline": "bg-sky-600",
  };

  return (
    <div className="space-y-6">
      {/* Attention Banner */}
      {hasAttentionItems && (
        <div className="rounded-lg border-2 border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 p-4">
          <div className="flex items-start gap-3">
            <TriangleAlert className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-red-800 dark:text-red-300 mb-1">
                Attention Required
              </h3>
              <div className="space-y-1">
                {criticalOverdue > 0 && (
                  <button
                    type="button"
                    onClick={() => onOverdueClick?.("overdue12plus")}
                    className="group flex min-h-11 w-full touch-manipulation items-center gap-2 text-left text-sm text-red-700 hover:underline dark:text-red-400"
                  >
                    <span className="font-bold">{criticalOverdue}</span>
                    <span>
                      {criticalOverdue === 1 ? "hose" : "hoses"} overdue by 12+
                      months
                    </span>
                    <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                )}
                {urgentExpiring > 0 && (
                  <button
                    type="button"
                    onClick={() => onUpcomingTestClick?.("1month")}
                    className="group flex min-h-11 w-full touch-manipulation items-center gap-2 text-left text-sm text-amber-700 hover:underline dark:text-amber-400"
                  >
                    <span className="font-bold">{urgentExpiring}</span>
                    <span>
                      {urgentExpiring === 1 ? "hose" : "hoses"} expiring within
                      1 month
                    </span>
                    <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <Card className="col-span-2 xl:col-span-1">
          <CardContent className="p-3.5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 flex-shrink-0">
                <ChartBarIcon className="h-5 w-5 text-gray-700 dark:text-gray-300" />
              </div>
              <div className="min-w-0 flex-1 flex flex-col justify-center">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total Hoses</p>
                <p className="text-3xl font-bold leading-none mt-1">{totalHoses}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <DashboardActionCard
          className="hover:-translate-y-0.5"
          label="Show hoses that are in date"
          onClick={() => onStatusCardClick?.("In date")}
        >
          <CardContent className="p-3.5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-950 flex-shrink-0">
                <CheckCircleIcon className="h-5 w-5 text-green-700 dark:text-green-400" />
              </div>
              <div className="min-w-0 flex-1 flex flex-col justify-center">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">In Date</p>
                <p className="text-3xl font-bold text-green-600 dark:text-green-400 leading-none mt-1">{testingStatus.inDate}</p>
              </div>
            </div>
          </CardContent>
        </DashboardActionCard>

        <DashboardActionCard
          className="hover:-translate-y-0.5"
          label="Show hoses due for testing"
          onClick={() => onStatusCardClick?.("Due for testing")}
        >
          <CardContent className="p-3.5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-950 flex-shrink-0">
                <ExclamationTriangleIcon className="h-5 w-5 text-amber-700 dark:text-amber-400" />
              </div>
              <div className="min-w-0 flex-1 flex flex-col justify-center">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Due for Testing</p>
                <p className="text-3xl font-bold text-amber-600 dark:text-amber-400 leading-none mt-1">{testingStatus.dueForTesting}</p>
              </div>
            </div>
          </CardContent>
        </DashboardActionCard>

        <DashboardActionCard
          className="hover:-translate-y-0.5"
          label="Show hoses with district for repair"
          onClick={() => onStatusCardClick?.("With district for repair")}
        >
          <CardContent className="p-3.5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-100 dark:bg-red-950 flex-shrink-0">
                <WrenchScrewdriverIcon className="h-5 w-5 text-red-700 dark:text-red-400" />
              </div>
              <div className="min-w-0 flex-1 flex flex-col justify-center">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">With District</p>
                <p className="text-3xl font-bold text-red-600 dark:text-red-400 leading-none mt-1">{statusBreakdown.find(s => s.status === 'With district for repair')?.count || 0}</p>
              </div>
            </div>
          </CardContent>
        </DashboardActionCard>

        <DashboardActionCard
          className="hover:-translate-y-0.5"
          label="Show condemned hoses"
          onClick={() => onStatusCardClick?.("Condemned")}
        >
          <CardContent className="p-3.5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 flex-shrink-0">
                <XCircleIcon className="h-5 w-5 text-gray-700 dark:text-gray-400" />
              </div>
              <div className="min-w-0 flex-1 flex flex-col justify-center">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Condemned</p>
                <p className="text-3xl font-bold text-gray-600 dark:text-gray-400 leading-none mt-1">{statusBreakdown.find(s => s.status === 'Condemned')?.count || 0}</p>
              </div>
            </div>
          </CardContent>
        </DashboardActionCard>
      </div>

      {/* Accordion Sections */}
      <Accordion type="multiple" defaultValue={["upcoming", "overdue"]} className="w-full space-y-4">

        {/* Upcoming Test Dates Section */}
        <AccordionItem value="upcoming" className="border rounded-lg px-4 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
          <AccordionTrigger className="hover:no-underline py-4">
            <div className="flex items-center gap-3 w-full">
              <div className="flex items-center gap-2">
                <ClockIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                <span className="text-lg font-semibold text-gray-900 dark:text-gray-100">Tests Due Within</span>
              </div>
              <span className="ml-auto mr-4 text-sm font-medium px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">
                {(upcomingTestDates.sixMonths || 0) +
                  (upcomingTestDates.threeMonths || 0) +
                  (upcomingTestDates.oneMonth || 0)}
              </span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-2 pb-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <DashboardActionCard
                className="border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950"
                label="Show hoses due for testing in four to six months"
                onClick={() => onUpcomingTestClick?.("6months")}
              >
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-blue-800 dark:text-blue-300">4-6 Months</p>
                      <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{upcomingTestDates.sixMonths || 0}</p>
                    </div>
                    <ClockIcon className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                  </div>
                </CardContent>
              </DashboardActionCard>

              <DashboardActionCard
                className="border-indigo-200 bg-indigo-50 dark:border-indigo-900 dark:bg-indigo-950"
                label="Show hoses due for testing in one to three months"
                onClick={() => onUpcomingTestClick?.("3months")}
              >
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-indigo-800 dark:text-indigo-300">1-3 Months</p>
                      <p className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">{upcomingTestDates.threeMonths || 0}</p>
                    </div>
                    <ClockIcon className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
                  </div>
                </CardContent>
              </DashboardActionCard>

              <DashboardActionCard
                className="border-purple-200 bg-purple-50 dark:border-purple-900 dark:bg-purple-950"
                label="Show hoses due for testing within one month"
                onClick={() => onUpcomingTestClick?.("1month")}
              >
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-purple-800 dark:text-purple-300">Within 1 Month</p>
                      <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">{upcomingTestDates.oneMonth || 0}</p>
                    </div>
                    <ClockIcon className="h-8 w-8 text-purple-600 dark:text-purple-400" />
                  </div>
                </CardContent>
              </DashboardActionCard>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Overdue Breakdown Section */}
        <AccordionItem value="overdue" className="border rounded-lg px-4 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
          <AccordionTrigger className="hover:no-underline py-4">
            <div className="flex items-center gap-3 w-full">
              <div className="flex items-center gap-2">
                <ExclamationTriangleIcon className="h-5 w-5 text-red-600 dark:text-red-400" />
                <span className="text-lg font-semibold text-gray-900 dark:text-gray-100">Hoses Overdue for Testing</span>
              </div>
              <span className="ml-auto mr-4 text-sm font-medium px-2.5 py-0.5 rounded-full bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300">
                {(overdueBreakdown.threeMonths || 0) +
                  (overdueBreakdown.sixMonths || 0) +
                  (overdueBreakdown.twelveMonths || 0) +
                  (overdueBreakdown.twelvePlusMonths || 0)}
              </span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-2 pb-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <DashboardActionCard
                className="border-yellow-200 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950"
                label="Show hoses overdue by up to three months"
                onClick={() => onOverdueClick?.("overdue3months")}
              >
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-yellow-800 dark:text-yellow-300">0-3 Months</p>
                      <p className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">{overdueBreakdown.threeMonths || 0}</p>
                    </div>
                    <ExclamationTriangleIcon className="h-8 w-8 text-yellow-600 dark:text-yellow-400" />
                  </div>
                </CardContent>
              </DashboardActionCard>

              <DashboardActionCard
                className="border-orange-200 bg-orange-50 dark:border-orange-900 dark:bg-orange-950"
                label="Show hoses overdue by three to six months"
                onClick={() => onOverdueClick?.("overdue6months")}
              >
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-orange-800 dark:text-orange-300">3-6 Months</p>
                      <p className="text-3xl font-bold text-orange-600 dark:text-orange-400">{overdueBreakdown.sixMonths || 0}</p>
                    </div>
                    <ExclamationTriangleIcon className="h-8 w-8 text-orange-600 dark:text-orange-400" />
                  </div>
                </CardContent>
              </DashboardActionCard>

              <DashboardActionCard
                className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950"
                label="Show hoses overdue by six to twelve months"
                onClick={() => onOverdueClick?.("overdue12months")}
              >
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-red-800 dark:text-red-300">6-12 Months</p>
                      <p className="text-3xl font-bold text-red-600 dark:text-red-400">{overdueBreakdown.twelveMonths || 0}</p>
                    </div>
                    <ExclamationTriangleIcon className="h-8 w-8 text-red-600 dark:text-red-400" />
                  </div>
                </CardContent>
              </DashboardActionCard>

              <DashboardActionCard
                className="border-red-300 bg-red-100 dark:border-red-900 dark:bg-red-950"
                label="Show hoses overdue by more than twelve months"
                onClick={() => onOverdueClick?.("overdue12plus")}
              >
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-red-900 dark:text-red-300">12+ Months</p>
                      <p className="text-3xl font-bold text-red-700 dark:text-red-400">{overdueBreakdown.twelvePlusMonths || 0}</p>
                    </div>
                    <ExclamationTriangleIcon className="h-8 w-8 text-red-700 dark:text-red-400" />
                  </div>
                </CardContent>
              </DashboardActionCard>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Fleet Breakdown — replaces the empty Analytics placeholder */}
        <AccordionItem value="fleet" className="border rounded-lg px-4 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
          <AccordionTrigger className="hover:no-underline py-4">
            <div className="flex items-center gap-2">
              <Flame className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              <span className="text-lg font-semibold text-gray-900 dark:text-gray-100">Fleet Breakdown</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-2 pb-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* Location distribution */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <MapPin className="h-4 w-4 text-gray-500" />
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                    By Location
                  </h4>
                </div>
                {locationBreakdown.length > 0 ? (
                  <div className="space-y-2">
                    {locationBreakdown.map((loc) => (
                      <div key={loc.location} className="space-y-1">
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-gray-600 dark:text-gray-400 w-20 text-right flex-shrink-0 truncate">
                            {loc.location}
                          </span>
                          <div className="flex-1 h-6 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden flex">
                            {/* Green portion = in date */}
                            {loc.inDate > 0 && (
                              <div
                                className="h-full bg-green-500 transition-[width] duration-500 motion-reduce:transition-none"
                                style={{ width: `${(loc.inDate / totalHoses) * 100}%` }}
                                title={`${loc.inDate} in date`}
                              />
                            )}
                            {/* Amber portion = due for testing */}
                            {loc.dueForTesting > 0 && (
                              <div
                                className="h-full bg-amber-500 transition-[width] duration-500 motion-reduce:transition-none"
                                style={{ width: `${(loc.dueForTesting / totalHoses) * 100}%` }}
                                title={`${loc.dueForTesting} due for testing`}
                              />
                            )}
                            {/* Gray portion = other statuses */}
                            {loc.count - loc.inDate - loc.dueForTesting > 0 && (
                              <div
                                className="h-full bg-gray-400 transition-[width] duration-500 motion-reduce:transition-none"
                                style={{ width: `${((loc.count - loc.inDate - loc.dueForTesting) / totalHoses) * 100}%` }}
                                title={`${loc.count - loc.inDate - loc.dueForTesting} other`}
                              />
                            )}
                          </div>
                          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 w-8 text-right">
                            {loc.count}
                          </span>
                        </div>
                      </div>
                    ))}
                    {/* Legend */}
                    <div className="flex items-center gap-4 pt-2 text-xs text-gray-500 dark:text-gray-400">
                      <span className="flex items-center gap-1">
                        <span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" /> In date
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" /> Due
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-2.5 h-2.5 rounded-full bg-gray-400 inline-block" /> Other
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No location data</p>
                )}
              </div>

              {/* Size distribution */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <Ruler className="h-4 w-4 text-gray-500" />
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                    By Size
                  </h4>
                </div>
                <DistributionBar
                  items={sizeBreakdown.map((s) => ({
                    label: s.size,
                    count: s.count,
                    percentage: s.percentage,
                  }))}
                  colorMap={sizeColors}
                />
              </div>

              {/* Type distribution */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <Layers className="h-4 w-4 text-gray-500" />
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                    By Type
                  </h4>
                </div>
                <DistributionBar
                  items={typeBreakdown.map((t) => ({
                    label: t.type,
                    count: t.count,
                    percentage: t.percentage,
                  }))}
                  colorMap={typeColors}
                />
              </div>

              {/* Total hose length & stats */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <Flame className="h-4 w-4 text-gray-500" />
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                    Hose Length
                  </h4>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-3 text-center">
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {lengthStats.total}<span className="text-sm font-normal text-muted-foreground">m</span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">Total Length</p>
                  </div>
                  <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-3 text-center">
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {lengthStats.average}<span className="text-sm font-normal text-muted-foreground">m</span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">Average</p>
                  </div>
                  <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-3 text-center">
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {lengthStats.min}<span className="text-sm font-normal text-muted-foreground">m</span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">Shortest</p>
                  </div>
                  <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-3 text-center">
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {lengthStats.max}<span className="text-sm font-normal text-muted-foreground">m</span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">Longest</p>
                  </div>
                </div>
              </div>

            </div>
          </AccordionContent>
        </AccordionItem>

      </Accordion>
    </div>
  );
}
