import React from "react";
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
  ClockIcon
} from "@heroicons/react/24/outline";

type Status = "With district for repair" | "Condemned" | "Due for testing" | "In date";

type UpcomingTestFilter = "1month" | "3months" | "6months";
type OverdueFilter = "overdue3months" | "overdue6months" | "overdue12months" | "overdue12plus";

interface HoseDashboardProps {
  onStatusCardClick?: (status: Status) => void;
  onUpcomingTestClick?: (timeframe: UpcomingTestFilter) => void;
  onOverdueClick?: (timeframe: OverdueFilter) => void;
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4"></div>
                  <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const { totalHoses, statusBreakdown, testingStatus } = dashboardData;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
        <Card>
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

        <Card
          className="cursor-pointer hover:shadow-md hover:scale-[1.02] transition-all"
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
        </Card>

        <Card
          className="cursor-pointer hover:shadow-md hover:scale-[1.02] transition-all"
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
        </Card>

        <Card
          className="cursor-pointer hover:shadow-md hover:scale-[1.02] transition-all"
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
        </Card>

        <Card
          className="cursor-pointer hover:shadow-md hover:scale-[1.02] transition-all"
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
        </Card>
      </div>

      {/* Accordion Sections for Upcoming and Overdue */}
      <Accordion type="multiple" className="w-full space-y-4">

        {/* Upcoming Test Dates Section */}
        <AccordionItem value="upcoming" className="border rounded-lg px-4 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
          <AccordionTrigger className="hover:no-underline py-4">
            <div className="flex items-center gap-3 w-full">
              <div className="flex items-center gap-2">
                <ClockIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                <span className="text-lg font-semibold text-gray-900 dark:text-gray-100">Tests Due Within</span>
              </div>
              <span className="ml-auto mr-4 text-sm font-medium px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">
                {(dashboardData?.upcomingTestDates?.sixMonths || 0) +
                  (dashboardData?.upcomingTestDates?.threeMonths || 0) +
                  (dashboardData?.upcomingTestDates?.oneMonth || 0)}
              </span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-2 pb-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card
                className="border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950 cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => onUpcomingTestClick?.("6months")}
              >
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-blue-800 dark:text-blue-300">4-6 Months</p>
                      <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{dashboardData?.upcomingTestDates?.sixMonths || 0}</p>
                    </div>
                    <ClockIcon className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                  </div>
                </CardContent>
              </Card>

              <Card
                className="border-indigo-200 bg-indigo-50 dark:border-indigo-900 dark:bg-indigo-950 cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => onUpcomingTestClick?.("3months")}
              >
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-indigo-800 dark:text-indigo-300">1-3 Months</p>
                      <p className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">{dashboardData?.upcomingTestDates?.threeMonths || 0}</p>
                    </div>
                    <ClockIcon className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
                  </div>
                </CardContent>
              </Card>

              <Card
                className="border-purple-200 bg-purple-50 dark:border-purple-900 dark:bg-purple-950 cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => onUpcomingTestClick?.("1month")}
              >
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-purple-800 dark:text-purple-300">Within 1 Month</p>
                      <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">{dashboardData?.upcomingTestDates?.oneMonth || 0}</p>
                    </div>
                    <ClockIcon className="h-8 w-8 text-purple-600 dark:text-purple-400" />
                  </div>
                </CardContent>
              </Card>
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
                {(dashboardData?.overdueBreakdown?.threeMonths || 0) +
                  (dashboardData?.overdueBreakdown?.sixMonths || 0) +
                  (dashboardData?.overdueBreakdown?.twelveMonths || 0) +
                  (dashboardData?.overdueBreakdown?.twelvePlusMonths || 0)}
              </span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-2 pb-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card
                className="border-yellow-200 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950 cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => onOverdueClick?.("overdue3months")}
              >
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-yellow-800 dark:text-yellow-300">0-3 Months Overdue</p>
                      <p className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">{dashboardData?.overdueBreakdown?.threeMonths || 0}</p>
                    </div>
                    <ExclamationTriangleIcon className="h-8 w-8 text-yellow-600 dark:text-yellow-400" />
                  </div>
                </CardContent>
              </Card>

              <Card
                className="border-orange-200 bg-orange-50 dark:border-orange-900 dark:bg-orange-950 cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => onOverdueClick?.("overdue6months")}
              >
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-orange-800 dark:text-orange-300">3-6 Months Overdue</p>
                      <p className="text-3xl font-bold text-orange-600 dark:text-orange-400">{dashboardData?.overdueBreakdown?.sixMonths || 0}</p>
                    </div>
                    <ExclamationTriangleIcon className="h-8 w-8 text-orange-600 dark:text-orange-400" />
                  </div>
                </CardContent>
              </Card>

              <Card
                className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950 cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => onOverdueClick?.("overdue12months")}
              >
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-red-800 dark:text-red-300">6-12 Months Overdue</p>
                      <p className="text-3xl font-bold text-red-600 dark:text-red-400">{dashboardData?.overdueBreakdown?.twelveMonths || 0}</p>
                    </div>
                    <ExclamationTriangleIcon className="h-8 w-8 text-red-600 dark:text-red-400" />
                  </div>
                </CardContent>
              </Card>

              <Card
                className="border-red-300 bg-red-100 dark:border-red-900 dark:bg-red-950 cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => onOverdueClick?.("overdue12plus")}
              >
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-red-900 dark:text-red-300">12+ Months Overdue</p>
                      <p className="text-3xl font-bold text-red-700 dark:text-red-400">{dashboardData?.overdueBreakdown?.twelvePlusMonths || 0}</p>
                    </div>
                    <ExclamationTriangleIcon className="h-8 w-8 text-red-700 dark:text-red-400" />
                  </div>
                </CardContent>
              </Card>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Charts Grid */}
      {/* Charts Accordion */}
      <Accordion type="multiple" className="w-full">
        <AccordionItem value="charts" className="border rounded-lg px-4 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
          <AccordionTrigger className="hover:no-underline py-4">
            <div className="flex items-center gap-2">
              <ChartBarIcon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              <span className="text-lg font-semibold text-gray-900 dark:text-gray-100">Analytics & Charts</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-2 pb-6">
            <div className="text-center text-muted-foreground py-8">
              <p>Charts will be added here later.</p>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>


    </div>
  );
}
