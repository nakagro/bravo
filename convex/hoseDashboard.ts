import { v } from "convex/values";
import { query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const getDashboardStats = query({
  args: {},
  returns: v.object({
    totalHoses: v.number(),
    statusBreakdown: v.array(v.object({
      status: v.string(),
      count: v.number(),
      percentage: v.number(),
    })),
    sizeBreakdown: v.array(v.object({
      size: v.string(),
      count: v.number(),
      percentage: v.number(),
    })),
    typeBreakdown: v.array(v.object({
      type: v.string(),
      count: v.number(),
      percentage: v.number(),
    })),
    lengthStats: v.object({
      average: v.number(),
      min: v.number(),
      max: v.number(),
      total: v.number(),
    }),
    lengthDistribution: v.array(v.object({
      range: v.string(),
      count: v.number(),
    })),
    testingStatus: v.object({
      inDate: v.number(),
      dueForTesting: v.number(),
      overdue: v.number(),
    }),
    upcomingTestDates: v.object({
      sixMonths: v.number(),
      threeMonths: v.number(),
      oneMonth: v.number(),
    }),
    overdueBreakdown: v.object({
      oneMonth: v.number(),
      threeMonths: v.number(),
      sixMonths: v.number(),
      twelvePlusMonths: v.number(),
    }),
  }),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const hoses = await ctx.db.query("hoses").collect();
    const totalHoses = hoses.length;

    if (totalHoses === 0) {
      return {
        totalHoses: 0,
        statusBreakdown: [],
        sizeBreakdown: [],
        typeBreakdown: [],
        lengthStats: { average: 0, min: 0, max: 0, total: 0 },
        lengthDistribution: [],
        testingStatus: { inDate: 0, dueForTesting: 0, overdue: 0 },
        upcomingTestDates: { sixMonths: 0, threeMonths: 0, oneMonth: 0 },
        overdueBreakdown: { oneMonth: 0, threeMonths: 0, sixMonths: 0, twelvePlusMonths: 0 },
      };
    }

    // Status breakdown
    const statusCounts = hoses.reduce((acc, hose) => {
      acc[hose.status] = (acc[hose.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const statusBreakdown = Object.entries(statusCounts).map(([status, count]) => ({
      status,
      count,
      percentage: Math.round((count / totalHoses) * 100),
    }));

    // Size breakdown
    const sizeCounts = hoses.reduce((acc, hose) => {
      acc[hose.size] = (acc[hose.size] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const sizeBreakdown = Object.entries(sizeCounts).map(([size, count]) => ({
      size: `${size}mm`,
      count,
      percentage: Math.round((count / totalHoses) * 100),
    }));

    // Type breakdown
    const typeCounts = hoses.reduce((acc, hose) => {
      acc[hose.type] = (acc[hose.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const typeBreakdown = Object.entries(typeCounts).map(([type, count]) => ({
      type,
      count,
      percentage: Math.round((count / totalHoses) * 100),
    }));

    // Length statistics
    const lengths = hoses.map(h => h.length);
    const totalLength = lengths.reduce((sum, length) => sum + length, 0);
    const averageLength = Math.round(totalLength / totalHoses);
    const minLength = Math.min(...lengths);
    const maxLength = Math.max(...lengths);

    const lengthStats = {
      average: averageLength,
      min: minLength,
      max: maxLength,
      total: totalLength,
    };

    // Length distribution (create ranges)
    const lengthRanges = [
      { min: 0, max: 10, label: "0-10m" },
      { min: 11, max: 20, label: "11-20m" },
      { min: 21, max: 30, label: "21-30m" },
      { min: 31, max: 50, label: "31-50m" },
      { min: 51, max: 100, label: "51-100m" },
      { min: 101, max: Infinity, label: "100m+" },
    ];

    const lengthDistribution = lengthRanges.map(range => ({
      range: range.label,
      count: hoses.filter(h => h.length >= range.min && h.length <= range.max).length,
    })).filter(item => item.count > 0);

    // Testing status (based on current date)
    const now = Date.now();
    const testingStatus = {
      inDate: statusCounts["In date"] || 0,
      dueForTesting: statusCounts["Due for testing"] || 0,
      overdue: (statusCounts["With district for repair"] || 0) + (statusCounts["Condemned"] || 0),
    };

    // Calculate upcoming test dates (hoses that will need testing in future timeframes)
    const oneYearMs = 365 * 24 * 60 * 60 * 1000; // 365 days in milliseconds
    const sixMonthsMs = 6 * 30 * 24 * 60 * 60 * 1000; // ~6 months
    const threeMonthsMs = 3 * 30 * 24 * 60 * 60 * 1000; // ~3 months
    const oneMonthMs = 30 * 24 * 60 * 60 * 1000; // ~1 month

    // Only consider "In date" hoses for upcoming test dates
    const inDateHoses = hoses.filter(h => h.status === "In date");
    
    const upcomingTestDates = {
      sixMonths: inDateHoses.filter(h => {
        const testExpiryDate = h.testDate + oneYearMs;
        const sixMonthsFromNow = now + sixMonthsMs;
        return testExpiryDate <= sixMonthsFromNow && testExpiryDate > now;
      }).length,
      threeMonths: inDateHoses.filter(h => {
        const testExpiryDate = h.testDate + oneYearMs;
        const threeMonthsFromNow = now + threeMonthsMs;
        return testExpiryDate <= threeMonthsFromNow && testExpiryDate > now;
      }).length,
      oneMonth: inDateHoses.filter(h => {
        const testExpiryDate = h.testDate + oneYearMs;
        const oneMonthFromNow = now + oneMonthMs;
        return testExpiryDate <= oneMonthFromNow && testExpiryDate > now;
      }).length,
    };

    // Calculate overdue breakdown (hoses that are already past their test date)
    const dueForTestingHoses = hoses.filter(h => h.status === "Due for testing");
    
    const overdueBreakdown = {
      oneMonth: dueForTestingHoses.filter(h => {
        const testExpiryDate = h.testDate + oneYearMs;
        const oneMonthAgo = now - oneMonthMs;
        return testExpiryDate >= oneMonthAgo && testExpiryDate < now;
      }).length,
      threeMonths: dueForTestingHoses.filter(h => {
        const testExpiryDate = h.testDate + oneYearMs;
        const threeMonthsAgo = now - threeMonthsMs;
        const oneMonthAgo = now - oneMonthMs;
        return testExpiryDate >= threeMonthsAgo && testExpiryDate < oneMonthAgo;
      }).length,
      sixMonths: dueForTestingHoses.filter(h => {
        const testExpiryDate = h.testDate + oneYearMs;
        const sixMonthsAgo = now - sixMonthsMs;
        const threeMonthsAgo = now - threeMonthsMs;
        return testExpiryDate >= sixMonthsAgo && testExpiryDate < threeMonthsAgo;
      }).length,
      twelvePlusMonths: dueForTestingHoses.filter(h => {
        const testExpiryDate = h.testDate + oneYearMs;
        const twelveMonthsAgo = now - (12 * 30 * 24 * 60 * 60 * 1000);
        return testExpiryDate < twelveMonthsAgo;
      }).length,
    };

    return {
      totalHoses,
      statusBreakdown,
      sizeBreakdown,
      typeBreakdown,
      lengthStats,
      lengthDistribution,
      testingStatus,
      upcomingTestDates,
      overdueBreakdown,
    };
  },
});
