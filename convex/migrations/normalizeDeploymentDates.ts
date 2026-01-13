/**
 * Migration script to normalize existing deployment availability dates to UTC midnight.
 * 
 * This fixes historical data where dates were stored using local timezone midnight
 * instead of UTC midnight, which caused duplicate days to appear in the UI.
 * 
 * The script handles the case where the same intended day was stored with different
 * timestamps (e.g., local midnight AEDT = Jan 17 00:00 AEDT stored as Jan 16 13:00 UTC
 * vs UTC midnight = Jan 17 00:00 UTC). These are detected as duplicates and merged.
 * 
 * Run this mutation from the Convex dashboard or via CLI to fix existing data.
 */

import { mutation, query } from "../_generated/server";
import { v } from "convex/values";

// Helper to normalize a timestamp to midnight UTC of that day
function normalizeToMidnight(timestamp: number): number {
    const date = new Date(timestamp);
    date.setUTCHours(0, 0, 0, 0);
    return date.getTime();
}

// Helper to get the "intended" local date for AEDT timezone (+11 hours)
// This converts UTC to AEDT and returns the date string
function getIntendedDateKey(timestamp: number): string {
    const date = new Date(timestamp);
    // Add 11 hours to convert UTC to AEDT
    const aedtDate = new Date(date.getTime() + (11 * 60 * 60 * 1000));
    return aedtDate.toISOString().split('T')[0]; // YYYY-MM-DD
}

// Preview what the migration will do (run this first!)
export const previewNormalization = query({
    args: {},
    returns: v.array(v.object({
        userId: v.id("users"),
        userName: v.string(),
        intendedDate: v.string(),
        intendedDateFormatted: v.string(),
        records: v.array(v.object({
            _id: v.id("deploymentAvailability"),
            date: v.number(),
            dateReadable: v.string(),
            dateFormatted: v.string(),
            updatedAt: v.number(),
            updatedAtFormatted: v.string(),
            willKeep: v.boolean(),
            willDelete: v.boolean(),
            needsDateUpdate: v.boolean(),
        })),
    })),
    handler: async (ctx) => {
        const allRecords = await ctx.db.query("deploymentAvailability").collect();

        // Fetch all users for name lookup
        const users = await ctx.db.query("users").collect();
        const usersMap = new Map(users.map(user => [user._id, user]));

        // Group records by userId and intended date (in AEDT timezone)
        const recordsByUserAndDate = new Map<string, typeof allRecords>();

        for (const record of allRecords) {
            const intendedDate = getIntendedDateKey(record.date);
            const key = `${record.userId}_${intendedDate}`;

            if (!recordsByUserAndDate.has(key)) {
                recordsByUserAndDate.set(key, []);
            }
            recordsByUserAndDate.get(key)!.push(record);
        }

        const results = [];

        for (const [key, records] of recordsByUserAndDate.entries()) {
            const [userId, intendedDate] = key.split('_');

            // Skip groups with only 1 record that doesn't need updating
            const targetDate = new Date(intendedDate + 'T00:00:00.000Z').getTime();

            // Sort by updatedAt descending - most recent first
            records.sort((a, b) => b.updatedAt - a.updatedAt);

            // Get user name
            const user = usersMap.get(userId as any);
            const userName = user
                ? (user.firstName && user.lastName
                    ? `${user.firstName} ${user.lastName}`
                    : user.name || 'Unknown')
                : 'Unknown User';

            const recordsInfo = records.map((record, index) => ({
                _id: record._id,
                date: record.date,
                dateReadable: new Date(record.date).toISOString(),
                dateFormatted: new Date(record.date).toLocaleString('en-AU', {
                    weekday: 'short',
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    timeZone: 'Australia/Sydney'
                }),
                updatedAt: record.updatedAt,
                updatedAtFormatted: new Date(record.updatedAt).toLocaleString('en-AU', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    timeZone: 'Australia/Sydney'
                }),
                willKeep: index === 0, // Keep the most recently updated
                willDelete: index > 0, // Delete older duplicates
                needsDateUpdate: index === 0 && record.date !== targetDate,
            }));

            // Only include groups that have duplicates OR need date updates
            const hasDuplicates = records.length > 1;
            const needsUpdate = recordsInfo.some(r => r.needsDateUpdate);

            if (hasDuplicates || needsUpdate) {
                // Format the intended date nicely
                const intendedDateObj = new Date(intendedDate + 'T00:00:00.000Z');
                const intendedDateFormatted = intendedDateObj.toLocaleDateString('en-AU', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    timeZone: 'UTC'
                });

                results.push({
                    userId: userId as any,
                    userName,
                    intendedDate,
                    intendedDateFormatted,
                    records: recordsInfo,
                });
            }
        }

        return results;
    },
});

// Actually run the migration
export const normalizeDeploymentDates = mutation({
    args: {},
    returns: v.object({
        totalRecords: v.number(),
        updatedRecords: v.number(),
        deletedDuplicates: v.number(),
        groupsProcessed: v.number(),
        details: v.array(v.object({
            userName: v.string(),
            intendedDate: v.string(),
            action: v.string(),
        })),
    }),
    handler: async (ctx) => {
        // Get all deployment availability records
        const allRecords = await ctx.db.query("deploymentAvailability").collect();

        // Fetch all users for name lookup
        const users = await ctx.db.query("users").collect();
        const usersMap = new Map(users.map(user => [user._id, user]));

        let updatedRecords = 0;
        let deletedDuplicates = 0;
        let groupsProcessed = 0;
        const details: { userName: string; intendedDate: string; action: string }[] = [];

        // Group records by userId and intended date (in AEDT timezone)
        const recordsByUserAndDate = new Map<string, typeof allRecords>();

        for (const record of allRecords) {
            const intendedDate = getIntendedDateKey(record.date);
            const key = `${record.userId}_${intendedDate}`;

            if (!recordsByUserAndDate.has(key)) {
                recordsByUserAndDate.set(key, []);
            }
            recordsByUserAndDate.get(key)!.push(record);
        }

        // Process each group
        for (const [key, records] of recordsByUserAndDate.entries()) {
            const [userId, intendedDate] = key.split('_');
            // Calculate the correct UTC midnight timestamp for this date
            const targetDate = new Date(intendedDate + 'T00:00:00.000Z').getTime();

            // Sort by updatedAt descending - most recent first
            records.sort((a, b) => b.updatedAt - a.updatedAt);

            const hasDuplicates = records.length > 1;
            const keepRecord = records[0];
            const needsDateUpdate = keepRecord.date !== targetDate;

            // Get user name
            const user = usersMap.get(userId as any);
            const userName = user
                ? (user.firstName && user.lastName
                    ? `${user.firstName} ${user.lastName}`
                    : user.name || 'Unknown')
                : 'Unknown User';

            // Format the intended date nicely
            const intendedDateFormatted = new Date(intendedDate + 'T00:00:00.000Z').toLocaleDateString('en-AU', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                timeZone: 'UTC'
            });

            if (hasDuplicates || needsDateUpdate) {
                groupsProcessed++;

                const actions: string[] = [];

                // Delete all but the first (most recent)
                for (let i = 1; i < records.length; i++) {
                    await ctx.db.delete(records[i]._id);
                    deletedDuplicates++;
                }

                if (hasDuplicates) {
                    actions.push(`Deleted ${records.length - 1} duplicate(s)`);
                }

                // Update the kept record's date to the normalized UTC midnight
                if (needsDateUpdate) {
                    await ctx.db.patch(keepRecord._id, { date: targetDate });
                    updatedRecords++;
                    actions.push('Normalized date to UTC midnight');
                }

                details.push({
                    userName,
                    intendedDate: intendedDateFormatted,
                    action: actions.join(', '),
                });
            }
        }

        return {
            totalRecords: allRecords.length,
            updatedRecords,
            deletedDuplicates,
            groupsProcessed,
            details,
        };
    },
});

