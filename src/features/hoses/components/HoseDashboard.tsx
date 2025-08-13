import React from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, ResponsiveContainer } from "recharts";
import { 
  CheckCircleIcon, 
  ExclamationTriangleIcon, 
  WrenchScrewdriverIcon,
  XCircleIcon,
  ScaleIcon,
  TagIcon,
  BeakerIcon,
  ChartBarIcon,
  ClockIcon
} from "@heroicons/react/24/outline";

const statusColors = {
  "In date": "#10b981", // green
  "Due for testing": "#f59e0b", // amber
  "With district for repair": "#ef4444", // red
  "Condemned": "#6b7280", // gray
};

const statusIcons = {
  "In date": CheckCircleIcon,
  "Due for testing": ExclamationTriangleIcon,
  "With district for repair": WrenchScrewdriverIcon,
  "Condemned": XCircleIcon,
};

const chartConfig = {
  count: {
    label: "Count",
  },
};

type Status = "With district for repair" | "Condemned" | "Due for testing" | "In date";

type UpcomingTestFilter = "1month" | "3months" | "6months";

interface HoseDashboardProps {
  onStatusCardClick?: (status: Status) => void;
  onUpcomingTestClick?: (timeframe: UpcomingTestFilter) => void;
}

export function HoseDashboard({ onStatusCardClick, onUpcomingTestClick }: HoseDashboardProps) {
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

  const { totalHoses, statusBreakdown, sizeBreakdown, typeBreakdown, lengthStats, lengthDistribution, testingStatus } = dashboardData;

  // Prepare pie chart data with colors
  const pieData = statusBreakdown.map(item => ({
    ...item,
    fill: statusColors[item.status as keyof typeof statusColors] || "#6b7280",
  }));

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Hoses</p>
                <p className="text-3xl font-bold">{totalHoses}</p>
              </div>
              <ChartBarIcon className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card 
          className="cursor-pointer hover:shadow-md transition-shadow" 
          onClick={() => onStatusCardClick?.("In date")}
        >
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">In Date</p>
                <p className="text-3xl font-bold text-green-600 dark:text-green-400">{testingStatus.inDate}</p>
              </div>
              <CheckCircleIcon className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
          </CardContent>
        </Card>

        <Card 
          className="cursor-pointer hover:shadow-md transition-shadow" 
          onClick={() => onStatusCardClick?.("Due for testing")}
        >
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Due for Testing</p>
                <p className="text-3xl font-bold text-amber-600 dark:text-amber-400">{testingStatus.dueForTesting}</p>
              </div>
              <ExclamationTriangleIcon className="h-8 w-8 text-amber-600 dark:text-amber-400" />
            </div>
          </CardContent>
        </Card>

        <Card 
          className="cursor-pointer hover:shadow-md transition-shadow" 
          onClick={() => onStatusCardClick?.("With district for repair")}
        >
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">With District for Repair</p>
                <p className="text-3xl font-bold text-red-600 dark:text-red-400">{statusBreakdown.find(s => s.status === 'With district for repair')?.count || 0}</p>
              </div>
              <WrenchScrewdriverIcon className="h-8 w-8 text-red-600 dark:text-red-400" />
            </div>
          </CardContent>
        </Card>

        <Card 
          className="cursor-pointer hover:shadow-md transition-shadow" 
          onClick={() => onStatusCardClick?.("Condemned")}
        >
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Condemned</p>
                <p className="text-3xl font-bold text-gray-600 dark:text-gray-400">{statusBreakdown.find(s => s.status === 'Condemned')?.count || 0}</p>
              </div>
              <XCircleIcon className="h-8 w-8 text-gray-600 dark:text-gray-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Test Dates Section */}
      <div className="mt-8">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
          <ClockIcon className="h-5 w-5" />
          Hoses Due for Testing In:
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card 
            className="border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950 cursor-pointer hover:shadow-md transition-shadow" 
            onClick={() => onUpcomingTestClick?.("6months")}
          >
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-800 dark:text-blue-300">6 Months</p>
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
                  <p className="text-sm font-medium text-indigo-800 dark:text-indigo-300">3 Months</p>
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
                  <p className="text-sm font-medium text-purple-800 dark:text-purple-300">1 Month</p>
                  <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">{dashboardData?.upcomingTestDates?.oneMonth || 0}</p>
                </div>
                <ClockIcon className="h-8 w-8 text-purple-600 dark:text-purple-400" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Overdue Breakdown Section */}
      <div className="mt-8">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
          <ExclamationTriangleIcon className="h-5 w-5" />
          Hoses Overdue for Testing:
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="border-yellow-200 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950 cursor-pointer hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-yellow-800 dark:text-yellow-300">1 Month</p>
                  <p className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">{dashboardData?.overdueBreakdown?.oneMonth || 0}</p>
                </div>
                <ExclamationTriangleIcon className="h-8 w-8 text-yellow-600 dark:text-yellow-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-orange-200 bg-orange-50 dark:border-orange-900 dark:bg-orange-950 cursor-pointer hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-orange-800 dark:text-orange-300">3 Months</p>
                  <p className="text-3xl font-bold text-orange-600 dark:text-orange-400">{dashboardData?.overdueBreakdown?.threeMonths || 0}</p>
                </div>
                <ExclamationTriangleIcon className="h-8 w-8 text-orange-600 dark:text-orange-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950 cursor-pointer hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-red-800 dark:text-red-300">6 Months</p>
                  <p className="text-3xl font-bold text-red-600 dark:text-red-400">{dashboardData?.overdueBreakdown?.sixMonths || 0}</p>
                </div>
                <ExclamationTriangleIcon className="h-8 w-8 text-red-600 dark:text-red-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-red-300 bg-red-100 dark:border-red-900 dark:bg-red-950 cursor-pointer hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-red-900 dark:text-red-300">12+ Months</p>
                  <p className="text-3xl font-bold text-red-700 dark:text-red-400">{dashboardData?.overdueBreakdown?.twelvePlusMonths || 0}</p>
                </div>
                <ExclamationTriangleIcon className="h-8 w-8 text-red-700 dark:text-red-400" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Breakdown Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TagIcon className="h-5 w-5" />
              Hose Status Distribution
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <ChartContainer config={chartConfig} className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    outerRadius="60%"
                    innerRadius="20%"
                    dataKey="count"
                    label={false}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <ChartTooltip 
                    content={<ChartTooltipContent />}
                    formatter={(value, name) => [`${value} hoses`, name]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </ChartContainer>
            
            {/* Status Legend */}
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
              {statusBreakdown.map((item) => {
                const IconComponent = statusIcons[item.status as keyof typeof statusIcons];
                return (
                  <div key={item.status} className="flex items-center gap-2 text-sm truncate">
                    <IconComponent 
                      className="h-4 w-4 flex-shrink-0" 
                      style={{ color: statusColors[item.status as keyof typeof statusColors] }}
                    />
                    <span className="truncate">{item.status}: {item.count}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Size Distribution Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ScaleIcon className="h-5 w-5" />
              Hose Size Distribution
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <ChartContainer config={chartConfig} className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart 
                  data={sizeBreakdown}
                  margin={{ top: 20, right: 20, left: 20, bottom: 20 }}
                >
                  <XAxis 
                    dataKey="size" 
                    tick={{ fontSize: 12 }}
                    interval={0}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <ChartTooltip 
                    content={<ChartTooltipContent />}
                    formatter={(value) => [`${value} hoses`, "Count"]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Type Distribution Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TagIcon className="h-5 w-5" />
              Hose Type Distribution
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <ChartContainer config={chartConfig} className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart 
                  data={typeBreakdown}
                  margin={{ top: 20, right: 20, left: 20, bottom: 20 }}
                >
                  <XAxis 
                    dataKey="type" 
                    tick={{ fontSize: 12 }}
                    interval={0}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <ChartTooltip 
                    content={<ChartTooltipContent />}
                    formatter={(value) => [`${value} hoses`, "Count"]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

      </div>


    </div>
  );
}
