import { mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Seed a fresh Convex database with all reference/config data from production.
 *
 * Usage:
 *   npx convex run seed:seedDevDatabase --env-file .env.cloud
 *
 * This mutation is idempotent - it checks for existing skills before inserting
 * and will skip seeding if data already exists.
 */
export const seedDevDatabase = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    const now = Date.now();
    const summary: Record<string, number> = {};

    // ── Idempotency check ──────────────────────────────────────────────
    const existingSkills = await ctx.db.query("skills").first();
    if (existingSkills) {
      return "Database already seeded - skipping. Delete all data first if you want to re-seed.";
    }

    // ── 1. Bootstrap admin user ────────────────────────────────────────
    const adminUserId = await ctx.db.insert("users", {
      name: "Dev Admin",
      email: "admin@dev.local",
      firstName: "Dev",
      lastName: "Admin",
      rank: "Captain",
      isAdmin: true,
      roles: [],
      skills: [],
    });
    summary["users"] = 1;

    // ── 2. Skills (16 entries from prod) ───────────────────────────────
    const skills = [
      { name: "BA External only", code: "BAe" },
      { name: "BA Internal", code: "BAi" },
      { name: "Chain Saw Operator", code: "SAW" },
      { name: "Crew Leader", code: "CL" },
      { name: "Driver", code: "DR" },
      { name: "Driver (code 3)", code: "DR3" },
      { name: "Gas Suit", code: "PE2" },
      { name: "HAZMAT Technician", code: "HAZ" },
      { name: "Officer", code: "OF" },
      { name: "Probationary Member", code: "PROB" },
      { name: "Pumper Code 1", code: "PC1" },
      { name: "Rescue Operator", code: "RO" },
      { name: "Strike Team Leader", code: "STL" },
      { name: "Tanker Code 1", code: "TC1" },
      { name: "Tanker Code 3", code: "TC3" },
      { name: "None", code: "NONE", category: "System", description: "No operational skills yet" },
    ];

    for (const skill of skills) {
      await ctx.db.insert("skills", {
        name: skill.name,
        code: skill.code,
        description: skill.description,
        category: skill.category,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
    }
    summary["skills"] = skills.length;

    // ── 3. Roles (8 entries from prod) ─────────────────────────────────
    const roles = [
      { name: "Comms Officer", isActive: true },
      { name: "Safety Officer", isActive: true },
      { name: "Community Engagement", isActive: true },
      { name: "Training Officer", isActive: true },
      { name: "PPE PPC", isActive: false },
      { name: "Keys", isActive: true },
      { name: "Equipment", isActive: true },
      { name: "BASkills", isActive: true },
    ];

    for (const role of roles) {
      await ctx.db.insert("roles", {
        name: role.name,
        isActive: role.isActive,
        createdAt: now,
        updatedAt: now,
      });
    }
    summary["roles"] = roles.length;

    // ── 4. Module Settings (23 entries from prod) ──────────────────────
    const moduleSettings: Array<{
      moduleId: string;
      moduleName: string;
      isEnabled: boolean;
      adminOnly?: boolean;
      requiredRoles?: string[];
      minimumRank?: "Probationary" | "Firefighter" | "Lieutenant" | "Captain";
      config?: Record<string, unknown>;
    }> = [
      {
        moduleId: "hoses",
        moduleName: "Hose Inventory",
        isEnabled: true,
        adminOnly: false,
        requiredRoles: [],
        minimumRank: "Lieutenant",
      },
      {
        moduleId: "keys",
        moduleName: "Key Management",
        isEnabled: true,
        adminOnly: false,
        requiredRoles: ["Keys"],
      },
      {
        moduleId: "availability",
        moduleName: "Availability",
        isEnabled: true,
        adminOnly: false,
        requiredRoles: [],
        minimumRank: "Probationary",
        config: {
          applianceLocationEditSkills: ["DR", "DR3", "OF", "TC3", "TC1", "PC1"],
        },
      },
      {
        moduleId: "settings",
        moduleName: "User Settings",
        isEnabled: true,
        adminOnly: false,
        requiredRoles: [],
      },
      {
        moduleId: "admin",
        moduleName: "Admin Settings",
        isEnabled: true,
        adminOnly: true,
        requiredRoles: [],
        minimumRank: "Lieutenant",
      },
      {
        moduleId: "dashboard",
        moduleName: "Dashboard",
        isEnabled: true,
        adminOnly: false,
        requiredRoles: [],
      },
      {
        moduleId: "dutyCrew",
        moduleName: "Duty Crew",
        isEnabled: false,
        adminOnly: false,
        requiredRoles: [],
      },
      {
        moduleId: "fireReports",
        moduleName: "Fire Reports",
        isEnabled: false,
        adminOnly: true,
        requiredRoles: [],
        minimumRank: "Firefighter",
      },
      {
        moduleId: "applianceChecks",
        moduleName: "Appliance Checks",
        isEnabled: true,
        adminOnly: true,
        requiredRoles: [],
        minimumRank: "Firefighter",
      },
      {
        moduleId: "availabilityAdmin",
        moduleName: "Availability Admin Tab",
        isEnabled: true,
        adminOnly: false,
        requiredRoles: [],
        minimumRank: "Lieutenant",
      },
      {
        moduleId: "feedback",
        moduleName: "Feedback",
        isEnabled: true,
        adminOnly: false,
        requiredRoles: [],
      },
      {
        moduleId: "vehicleFaults",
        moduleName: "Vehicle Faults",
        isEnabled: true,
        adminOnly: false,
        requiredRoles: [],
        minimumRank: "Lieutenant",
      },
      {
        moduleId: "links",
        moduleName: "Links",
        isEnabled: true,
        adminOnly: false,
        requiredRoles: [],
        minimumRank: "Firefighter",
      },
      {
        moduleId: "applianceChecksAdmin",
        moduleName: "Appliance Checks - Templates",
        isEnabled: true,
        adminOnly: true,
        requiredRoles: [],
        minimumRank: "Lieutenant",
      },
      {
        moduleId: "bookings",
        moduleName: "Bookings",
        isEnabled: true,
        adminOnly: false,
        requiredRoles: [],
        minimumRank: "Lieutenant",
      },
      {
        moduleId: "inventory",
        moduleName: "Inventory",
        isEnabled: true,
        adminOnly: false,
        requiredRoles: [],
      },
      {
        moduleId: "inventoryAdmin",
        moduleName: "Inventory - Templates",
        isEnabled: true,
        adminOnly: false,
        requiredRoles: [],
        minimumRank: "Lieutenant",
      },
      {
        moduleId: "memberRecords",
        moduleName: "Member Records",
        isEnabled: true,
        adminOnly: false,
        requiredRoles: [],
        minimumRank: "Lieutenant",
      },
      {
        moduleId: "memberRecordsAdmin",
        moduleName: "Member Records - Kit",
        isEnabled: true,
        adminOnly: false,
        requiredRoles: [],
        minimumRank: "Lieutenant",
      },
      {
        moduleId: "equipment",
        moduleName: "Equipment",
        isEnabled: true,
        adminOnly: false,
        requiredRoles: ["Equipment"],
        minimumRank: "Firefighter",
      },
      {
        moduleId: "equipmentAdmin",
        moduleName: "Equipment Admin",
        isEnabled: true,
        adminOnly: false,
        requiredRoles: ["Equipment"],
        minimumRank: "Firefighter",
      },
      {
        moduleId: "baSkills",
        moduleName: "BA Skills Maintenance",
        isEnabled: true,
        adminOnly: false,
        requiredRoles: [],
        minimumRank: "Firefighter",
      },
      {
        moduleId: "baSkillsAdmin",
        moduleName: "BA Skills Admin",
        isEnabled: true,
        adminOnly: false,
        requiredRoles: ["BASkills"],
        minimumRank: "Firefighter",
      },
      {
        moduleId: "todos",
        moduleName: "My Tasks",
        isEnabled: true,
        adminOnly: false,
        requiredRoles: [],
      },
      {
        moduleId: "events",
        moduleName: "Events",
        isEnabled: true,
        adminOnly: false,
        requiredRoles: [],
      },
      {
        moduleId: "eventsAdmin",
        moduleName: "Events Admin",
        isEnabled: true,
        adminOnly: false,
        requiredRoles: [],
        minimumRank: "Lieutenant",
      },
      {
        moduleId: "brigadeTasks",
        moduleName: "Brigade Tasks",
        isEnabled: true,
        adminOnly: true,
        requiredRoles: [],
        minimumRank: "Probationary",
      },
      {
        moduleId: "actions",
        moduleName: "Action Centre",
        isEnabled: true,
        adminOnly: false,
        requiredRoles: [],
      },
      {
        moduleId: "actionsAdmin",
        moduleName: "Action Centre Admin",
        isEnabled: true,
        adminOnly: false,
        requiredRoles: [],
        minimumRank: "Lieutenant" as const,
      },
    ];

    for (const mod of moduleSettings) {
      await ctx.db.insert("moduleSettings", {
        moduleId: mod.moduleId,
        moduleName: mod.moduleName,
        isEnabled: mod.isEnabled,
        adminOnly: mod.adminOnly,
        requiredRoles: mod.requiredRoles,
        minimumRank: mod.minimumRank,
        config: mod.config,
        updatedAt: now,
        updatedBy: adminUserId,
      });
    }
    summary["moduleSettings"] = moduleSettings.length;

    // ── 5. Appliance Locations (3 entries from prod) ───────────────────
    const applianceLocations: Array<{
      applianceName: "Pumper" | "Tanker" | "FCV";
      stationLocation: string;
    }> = [
      { applianceName: "Pumper", stationLocation: "Main Station" },
      { applianceName: "Tanker", stationLocation: "Satellite Station" },
      { applianceName: "FCV", stationLocation: "Main Station" },
    ];

    for (const loc of applianceLocations) {
      await ctx.db.insert("applianceLocations", {
        applianceName: loc.applianceName,
        stationLocation: loc.stationLocation,
        updatedBy: adminUserId,
        updatedAt: now,
      });
    }
    summary["applianceLocations"] = applianceLocations.length;

    // ── 6. Duty Crews (4 entries, empty members for dev) ───────────────
    const dutyCrews = [
      { name: "Duty Crew 1", number: 1 },
      { name: "Duty Crew 2", number: 2 },
      { name: "Duty Crew 3", number: 3 },
      { name: "Duty Crew 4", number: 4 },
    ];

    for (const crew of dutyCrews) {
      await ctx.db.insert("dutyCrew", {
        name: crew.name,
        number: crew.number,
        members: [],
        createdAt: now,
        updatedAt: now,
      });
    }
    summary["dutyCrew"] = dutyCrews.length;

    // ── 7. Notification Settings (2 entries from prod) ─────────────────
    const notificationSettings: Array<{
      notificationType: "nightlyReset" | "morningReminder";
      enabled: boolean;
      description: string;
    }> = [
      {
        notificationType: "nightlyReset",
        enabled: true,
        description: "Daily status reset notifications sent at 4:00 AM",
      },
      {
        notificationType: "morningReminder",
        enabled: true,
        description: "Morning reminder notifications for members who haven't set their status",
      },
    ];

    for (const setting of notificationSettings) {
      await ctx.db.insert("notificationSettings", {
        notificationType: setting.notificationType,
        enabled: setting.enabled,
        description: setting.description,
        updatedBy: adminUserId,
        updatedAt: now,
      });
    }
    summary["notificationSettings"] = notificationSettings.length;

    // ── 8. Email Settings (2 entries from prod) ────────────────────────
    const emailSettings: Array<{
      emailType: "newUserSignup" | "feedbackSubmission";
      enabled: boolean;
      description: string;
    }> = [
      {
        emailType: "newUserSignup",
        enabled: true,
        description: "Send email notification to admins when a new user signs up",
      },
      {
        emailType: "feedbackSubmission",
        enabled: true,
        description: "Send email notification to admins when feedback is submitted",
      },
    ];

    for (const setting of emailSettings) {
      await ctx.db.insert("emailSettings", {
        emailType: setting.emailType,
        enabled: setting.enabled,
        description: setting.description,
        updatedBy: adminUserId,
        updatedAt: now,
      });
    }
    summary["emailSettings"] = emailSettings.length;

    // ── 9. Equipment Categories (6 entries from prod) ──────────────────
    const equipmentCategories = [
      { name: "Structure Gloves", order: 1 },
      { name: "Batteries", order: 2 },
      { name: "Structure PPC/PPE", order: 3, description: "All other Structure PPC/PPE that are not gloves" },
      { name: "Wildfire Gloves", order: 4 },
      { name: "Wildfire Pants", order: 5 },
      { name: "Wildfire Jacket", order: 6 },
    ];

    for (const cat of equipmentCategories) {
      await ctx.db.insert("equipmentCategories", {
        name: cat.name,
        description: cat.description,
        order: cat.order,
        isActive: true,
        createdBy: adminUserId,
        createdAt: now,
        updatedAt: now,
      });
    }
    summary["equipmentCategories"] = equipmentCategories.length;

    // ── 10. Links (9 entries from prod) ────────────────────────────────
    const links = [
      {
        title: "Hydrant Map",
        url: "https://hydrant.grayhux.io/hydrant/",
        category: "Maps",
        icon: "💧",
        order: 0,
      },
      {
        title: "Emergency Vehicles App",
        url: "https://emergencyvehiclesapp.com/",
        category: "Misc",
        order: 0,
      },
      {
        title: "BA Set Skills Maintenance (Google Form)",
        url: "https://docs.google.com/forms/d/e/1FAIpQLSc0PO7UoERDx02gcahzUVu0bJzNNc-OTdj-_ow8CCxbnDuRWQ/viewform",
        category: "CFA",
        order: 1,
      },
      {
        title: "CFA Members Online",
        url: "https://www.members.cfa.vic.gov.au/",
        category: "CFA",
        order: 2,
      },
      {
        title: "WYDV Status Page",
        url: "https://uptime.grayhux.io/status/wydv",
        category: "General",
        icon: "📖",
        order: 3,
      },
      {
        title: "FIRS",
        url: "https://applications.cfa.vic.gov.au/firs/",
        category: "CFA",
        order: 3,
      },
      {
        title: "CFA Learning Hub (LMS)",
        url: "https://learninghub.cfa.vic.gov.au/idm/saml/login?lms_clientId=1",
        category: "CFA",
        order: 4,
      },
      {
        title: "SAS",
        url: "https://sas.em.vic.gov.au/",
        category: "CFA",
        order: 5,
      },
      {
        title: "CFA Safe",
        url: "https://riskware.riskcloud.net/?companycode=cfa",
        category: "CFA",
        order: 6,
      },
    ];

    for (const link of links) {
      await ctx.db.insert("links", {
        title: link.title,
        url: link.url,
        category: link.category,
        icon: link.icon,
        order: link.order,
        isActive: true,
        createdBy: adminUserId,
        createdAt: now,
        updatedAt: now,
      });
    }
    summary["links"] = links.length;

    // ── 11. Booking Resources (2 entries from prod) ────────────────────
    const bookingResources = [
      { name: "FCV", approverOnly: false },
      { name: "Tanker", approverOnly: false },
    ];

    for (const resource of bookingResources) {
      await ctx.db.insert("bookingResources", {
        name: resource.name,
        isActive: true,
        approvers: [adminUserId],
        approverOnly: resource.approverOnly,
        createdBy: adminUserId,
        createdAt: now,
        updatedAt: now,
        updatedBy: adminUserId,
      });
    }
    summary["bookingResources"] = bookingResources.length;

    // ── 12. Station Checks (2 entries from prod) ───────────────────────
    const stationChecks = [
      { name: "test2323", order: 20 },
      { name: "test2", order: 10 },
    ];

    for (const check of stationChecks) {
      await ctx.db.insert("stationChecks", {
        name: check.name,
        isActive: true,
        order: check.order,
        createdBy: adminUserId,
        createdAt: now,
        updatedAt: now,
      });
    }
    summary["stationChecks"] = stationChecks.length;

    // ── Summary ────────────────────────────────────────────────────────
    const totalRecords = Object.values(summary).reduce((a, b) => a + b, 0);
    const lines = Object.entries(summary)
      .map(([table, count]) => `  ${table}: ${count}`)
      .join("\n");

    return `✅ Database seeded successfully!\n\nRecords created (${totalRecords} total):\n${lines}\n\nBootstrap admin: admin@dev.local (Dev Admin)\nNote: Sign up via the UI to set a password for authentication.`;
  },
});
