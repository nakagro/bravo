import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";
import { accountTypeValidator } from "./lib/accountType";
import {
  nextStatusValidator,
  plannedStatusValidator,
} from "./lib/statusValidators";
import {
  legacyTapeColorValidator,
  tapeColorValidator,
} from "./lib/tapeColors";
import {
  kitHistoryReasonValidator,
  kitTracksValidator,
  kitValueValidator,
} from "./lib/memberKit";

// We need to keep all the original auth fields and add our custom ones
const extendedAuthTables = {
  ...authTables,
  users: defineTable({
    // Fields from the original auth tables
    tokenIdentifier: v.optional(v.string()),
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()), // Required by auth system
    // New fields (all optional for backward compatibility)
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    memberNumber: v.optional(v.string()), // CFA ID
    // Rank field - a user can have only one rank
    // "Brigade Member" is the floor rank for non-operational members (default on signup)
    rank: v.optional(v.union(
      v.literal("Brigade Member"),
      v.literal("Probationary"),
      v.literal("Firefighter"),
      v.literal("Lieutenant"),
      v.literal("Captain")
    )),
    // What kind of login this is. Absent means "member" - the brigade's people.
    // "shared" is a login that isn't a person: the Duty Officer phone, an appliance
    // tablet. Shared accounts keep a rank (module access is still gated on it) but
    // are excluded from member lists, member counts and member reminders.
    accountType: v.optional(accountTypeValidator),
    // Roles field - a user can have multiple roles
    roles: v.optional(v.array(v.string())),
    // Skills field - array of skill IDs that the user has
    skills: v.optional(v.array(v.id("skills"))),
    // Admin flag - determines if the user has administrative privileges
    isAdmin: v.optional(v.boolean()),
    // Birthday flag - used for UI celebration
    isBirthday: v.optional(v.boolean()),
    // Status fields
    currentStatus: v.optional(v.union(
      v.literal("available - station"),
      v.literal("available - at station"),
      v.literal("available - satellite"),
      v.literal("not available"),
      v.literal("delayed response"),
      v.literal("WFH"),
      v.literal("WFH - at station")
    )),
    statusUpdatedAt: v.optional(v.number()),
    // Duration-based status fields
    statusExpiresAt: v.optional(v.number()), // Timestamp when status expires (null = no expiration)
    statusDurationHours: v.optional(v.number()), // Original duration in hours for display
    // Auto-transition fields
    // Status to transition to after duration expires; "reset" means clear it
    nextStatus: v.optional(nextStatusValidator),
    nextStatusAt: v.optional(v.number()), // Timestamp when to transition to next status
    isDutyOfficer: v.optional(v.boolean()),
    // Which Lieutenant this is - 1st to 5th, by seniority. Only meaningful while
    // rank is "Lieutenant" (changing rank clears it), and each number is held by
    // at most one account. Absent means an unnumbered Lieutenant.
    lieutenantNumber: v.optional(v.number()),
    // Disabled accounts are people who have left the brigade. The row stays so
    // every historical reference to them (checklists, BA records, kit history)
    // still resolves, but they can't sign in, hold module access, or appear in
    // any member-facing list. Absent means "active" - no backfill needed.
    isDisabled: v.optional(v.boolean()),
    disabledAt: v.optional(v.number()),
    disabledBy: v.optional(v.id("users")),
    // Push categories the member has switched off (see lib/notificationPrefs.ts).
    // Absent, or a key absent, means on.
    notificationPrefs: v.optional(
      v.object({
        availabilityReminders: v.optional(v.boolean()),
        statusChanges: v.optional(v.boolean()),
        events: v.optional(v.boolean()),
        dutyCrew: v.optional(v.boolean()),
      })
    ),
  })
    .index("email", ["email"])
    .index("by_memberNumber", ["memberNumber"])
    .index("by_isAdmin", ["isAdmin"])
    .index("by_isDutyOfficer", ["isDutyOfficer"])
    .index("by_lieutenantNumber", ["lieutenantNumber"])
};

// A deployment crew seat: a BRAVO member, or a name for crew from another brigade.
const crewSeat = v.union(
  v.object({ userId: v.id("users") }),
  v.object({ name: v.string() }),
);

const applicationTables = {
  // Skills table to store available skills in the system
  skills: defineTable({
    name: v.string(), // Skill name (e.g., "BA Internal (BAi)", "Driver (DR)")
    code: v.string(), // Short code for the skill (e.g., "BAi", "DR")
    description: v.optional(v.string()), // Optional description of the skill
    category: v.optional(v.string()), // Optional category for grouping skills
    isActive: v.boolean(), // Whether this skill is currently active in the system
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_name", ["name"])
    .index("by_code", ["code"])
    .index("by_isActive", ["isActive"]),

  // Deployment availability table
  deploymentAvailability: defineTable({
    userId: v.id("users"),
    date: v.number(), // Timestamp for the date (midnight of the day)
    availability: v.object({
      notAvailable: v.boolean(),
      local: v.boolean(),
      shortHaul: v.boolean(),
      longHaul: v.boolean(),
    }),
    message: v.optional(v.string()), // Optional message for this date's availability
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_date", ["date"])
    .index("by_user_date", ["userId", "date"]),

  // A truck crewed ahead of time on the Deployment tab. One row per appliance
  // per day; seats may be left empty while the crew is still being worked out.
  deploymentCrews: defineTable({
    date: v.number(), // UTC midnight, matching deploymentAvailability.date
    applianceName: v.string(),
    // A seat is a BRAVO member, or just a name for crew from another brigade.
    driver: v.optional(crewSeat),
    crewLeader: v.optional(crewSeat),
    crewMembers: v.array(crewSeat), // up to 3
    notes: v.optional(v.string()),
    createdBy: v.id("users"),
    updatedBy: v.id("users"),
    updatedAt: v.number(),
  }).index("by_date", ["date"]),

  // Module settings table
  moduleSettings: defineTable({
    // Module identifier
    moduleId: v.string(),
    // Module display name
    moduleName: v.string(),
    // Whether the module is enabled globally
    isEnabled: v.boolean(),
    // Whether this module is restricted to admin users only
    adminOnly: v.optional(v.boolean()),
    // Required roles to access this module (empty array means no role requirements)
    requiredRoles: v.optional(v.array(v.string())),
    // Required minimum rank to access this module (null means no rank requirement)
    minimumRank: v.optional(v.union(
      v.literal("Brigade Member"),
      v.literal("Probationary"),
      v.literal("Firefighter"),
      v.literal("Lieutenant"),
      v.literal("Captain")
    )),
    // How the role and rank requirements combine when both are set.
    // "all" (default, and what every existing row means) = must meet both.
    // "any" = meeting either one is enough, e.g. Lieutenant+ OR Social Admin.
    // Ignored unless both a role list and a minimum rank are set.
    requirementMode: v.optional(v.union(v.literal("all"), v.literal("any"))),
    // Optional module-specific configuration
    config: v.optional(v.any()),
    // Last updated timestamp
    updatedAt: v.number(),
    // User who last updated the settings
    updatedBy: v.optional(v.id("users")),
  }).index("by_moduleId", ["moduleId"]),

  // Roles table to store available roles in the system
  roles: defineTable({
    name: v.string(), // Role name (e.g., "Communications Officer", "Secretary")
    description: v.optional(v.string()), // Optional description of the role
    isActive: v.boolean(), // Whether this role is currently active in the system
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_name", ["name"])
    .index("by_isActive", ["isActive"]),

  // Member status history table
  memberStatusHistory: defineTable({
    userId: v.id("users"),
    status: v.union(
      v.literal("available - station"),
      v.literal("available - at station"),
      v.literal("available - satellite"),
      v.literal("not available"),
      v.literal("delayed response"),
      v.literal("WFH"),
      v.literal("WFH - at station")
    ),
    timestamp: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_timestamp", ["timestamp"])
    // Ordering by insertion time is only a proxy for `timestamp` - a backfill or
    // the simulator writes rows out of order - so read a member's history here.
    .index("by_user_and_timestamp", ["userId", "timestamp"]),

  // Duty officer history table
  dutyOfficerHistory: defineTable({
    userId: v.id("users"),
    startTimestamp: v.number(),
    endTimestamp: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_startTimestamp", ["startTimestamp"]),

  // Availability messages table
  availabilityMessages: defineTable({
    userId: v.id("users"),
    message: v.string(),
    timestamp: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_timestamp", ["timestamp"]),


  hoses: defineTable({
    hoseId: v.string(),
    length: v.number(),
    size: v.union(v.literal("25"), v.literal("38"), v.literal("65")),
    type: v.union(v.literal("Canvas"), v.literal("Duraline")),
    location: v.optional(
      v.union(
        v.literal("Station"),
        v.literal("Pumper"),
        v.literal("Tanker"),
        v.literal("FCV"),
        v.literal("Other")
      )
    ),
    testDate: v.number(),
    status: v.union(
      v.literal("With district for repair"),
      v.literal("Condemned"),
      v.literal("Due for testing"),
      v.literal("In date")
    ),
    createdBy: v.id("users"),
    updatedAt: v.number(),
    replacedAt: v.optional(v.number()),
  })
    .index("by_status", ["status"])
    .index("by_hoseId", ["hoseId"])
    .index("by_size", ["size"])
    .index("by_type", ["type"]),

  hoseHistory: defineTable({
    hoseId: v.id("hoses"),
    timestamp: v.number(),
    userId: v.id("users"),
    changeType: v.string(), // e.g., "status_change", "size_change", "hose_replacement", etc.
    field: v.string(), // The field that was changed
    oldValue: v.any(), // The previous value
    newValue: v.any(), // The new value
    notes: v.optional(v.string()), // Optional notes, especially for replacements
  })
    .index("by_hose", ["hoseId"])
    .index("by_timestamp", ["timestamp"]),

  hoseComments: defineTable({
    hoseId: v.id("hoses"),
    userId: v.id("users"),
    timestamp: v.number(),
    text: v.string(),
  })
    .index("by_hose", ["hoseId"])
    .index("by_timestamp", ["timestamp"]),

  // Maps a test year to the electrical tape colour used on hose couplings that year
  hoseTapeColors: defineTable({
    year: v.number(),
    // Deprecated after the custom palette migration; retained while existing
    // named-colour records are converted.
    color: v.optional(legacyTapeColorValidator),
    tapeColor: v.optional(tapeColorValidator),
    updatedBy: v.id("users"),
    updatedAt: v.number(),
  }).index("by_year", ["year"]),

  // Keys table for managing protected premises keys
  keys: defineTable({
    pegNumber: v.string(), // Unique identifier for the peg
    siteName: v.string(), // Company/business name
    address: v.string(), // Address of the premises
    contactName: v.optional(v.string()), // Contact person's name
    contactEmail: v.optional(v.string()), // Contact email
    contactPhone: v.optional(v.string()), // Contact phone number
    notes: v.optional(v.string()), // General notes about the key
    createdBy: v.id("users"),
    updatedAt: v.number(),
  })
    .index("by_pegNumber", ["pegNumber"]),

  // Key items table for individual keys/fobs/swipes/codes on a peg
  keyItems: defineTable({
    keyId: v.id("keys"), // Reference to the parent key (peg)
    type: v.union(
      v.literal("Key"),
      v.literal("Fob"),
      v.literal("Swipe"),
      v.literal("Code")
    ),
    description: v.string(), // Description of the specific key/fob/swipe/code
    createdBy: v.id("users"),
    updatedAt: v.number(),
  })
    .index("by_keyId", ["keyId"]),

  // Key comments for discussion about specific keys
  keyComments: defineTable({
    keyId: v.id("keys"),
    userId: v.id("users"),
    timestamp: v.number(),
    text: v.string(),
  })
    .index("by_key", ["keyId"])
    .index("by_timestamp", ["timestamp"]),

  // Key history for audit trail of changes to keys
  keyHistory: defineTable({
    keyId: v.id("keys"),
    timestamp: v.number(),
    userId: v.id("users"),
    changeType: v.string(), // e.g., "field_change", "key_deleted", etc.
    field: v.string(), // The field that was changed
    oldValue: v.any(), // The previous value
    newValue: v.any(), // The new value
    notes: v.optional(v.string()), // Optional notes
  })
    .index("by_key", ["keyId"])
    .index("by_timestamp", ["timestamp"]),

  // Duty Crew table for tracking duty crew assignments
  dutyCrew: defineTable({
    name: v.string(), // Name of the duty crew (e.g., "Duty Crew 1")
    number: v.number(), // Number of the duty crew (1-4)
    members: v.array(v.id("users")), // Array of user IDs who are part of this duty crew
    leader: v.optional(v.id("users")), // Optional user ID of the duty crew leader
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_number", ["number"]),

  // Duty Crew Schedule table for tracking which duty crew is assigned to which Sunday
  dutyCrewSchedule: defineTable({
    date: v.number(), // Timestamp for the Sunday date (midnight of the day)
    dutyCrewId: v.id("dutyCrew"), // Reference to the duty crew assigned for this date
    isSpecial: v.boolean(), // Whether this is a special assignment (e.g., 5th Sunday working bee)
    notes: v.optional(v.string()), // Optional notes for this duty crew assignment
    createdBy: v.id("users"),
    updatedAt: v.number(),
  })
    .index("by_date", ["date"])
    .index("by_dutyCrew", ["dutyCrewId"]),

  // Station Checks table to store checklist items
  stationChecks: defineTable({
    name: v.string(), // Name of the check item (e.g., "Clean multipurpose room")
    description: v.optional(v.string()), // Optional detailed description of the check
    area: v.optional(v.string()), // Optional area/room grouping (e.g., "Kitchen", "Toilets")
    isPriority: v.optional(v.boolean()), // Priority check, emphasised and sorted first in the weekly list
    isActive: v.boolean(), // Whether this check is currently active
    order: v.number(), // Order in which the check should appear in the list
    // When set, this check is satisfied by completing the linked inventory
    // template's run for the week rather than by ticking it. A document id, not
    // a name: the check is called "Pumper" while the template is called
    // "Pumper - MDA848", and either can be renamed without breaking the link.
    // The row is then locked (state derived server-side) and hides entirely
    // while the template is not active. Set from Duty Crew - Admin - Check
    // templates, where the check itself is edited.
    linkedApplianceTemplateId: v.optional(v.id("applianceTemplates")),
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    // No index on the link: there are a few dozen checks, and every read that
    // needs it is already scanning the active ones.
    .index("by_isActive", ["isActive"])
    .index("by_order", ["order"]),

  // Required steps attached to a station check template. These are separate
  // documents so a template can be edited without growing the parent record.
  stationCheckSubitems: defineTable({
    stationCheckId: v.id("stationChecks"),
    name: v.string(),
    order: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_stationCheckId_and_order", ["stationCheckId", "order"]),

  // Optional, week-specific planning by a duty crew leader. Area allocations
  // provide a default; individual check or subitem allocations override them.
  stationCheckAllocations: defineTable({
    weekStart: v.number(),
    dutyCrewId: v.id("dutyCrew"),
    targetKind: v.union(
      v.literal("area"),
      v.literal("check"),
      v.literal("subitem")
    ),
    targetKey: v.string(),
    area: v.optional(v.string()),
    checkId: v.optional(v.id("stationChecks")),
    subItemId: v.optional(v.id("stationCheckSubitems")),
    assignedTo: v.id("users"),
    assignedBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_weekStart_and_dutyCrewId_and_targetKey", [
    "weekStart",
    "dutyCrewId",
    "targetKey",
  ]),

  // Station Check Submissions table to record completed checklists
  stationCheckSubmissions: defineTable({
    date: v.number(), // Timestamp for the date of submission (usually a Sunday)
    dutyCrewId: v.id("dutyCrew"), // Reference to the duty crew that completed the checks
    // Whoever started the week's record (or pressed the old Complete button).
    // Absent on a week the close-out created because nobody touched it.
    completedBy: v.optional(v.id("users")),
    completedAt: v.number(), // When the record was created or finalised
    status: v.union(
      v.literal("draft"), // The week is still running
      v.literal("completed") // The week has closed - see closedAt
    ),
    // Set when closeElapsedWeeks finalised the week at the Monday boundary.
    // Absent on weeks finalised by the old manual Complete button. A closed
    // week stays editable - ticks land late - but its summary email has gone.
    closedAt: v.optional(v.number()),
    lastUpdatedBy: v.optional(v.id("users")), // User who last updated the checklist
    lastUpdatedAt: v.optional(v.number()), // Timestamp of the last update
    checkItems: v.array(
      v.object({
        checkId: v.optional(v.id("stationChecks")), // Reference to the check item (optional for ad-hoc items)
        subItemId: v.optional(v.id("stationCheckSubitems")), // Reference to a required child step
        parentCheckId: v.optional(v.id("stationChecks")), // Parent template for a child step
        name: v.string(), // Name of the check at the time of submission (in case it changes later)
        area: v.optional(v.string()), // Area snapshot at time of submission (like name)
        isPriority: v.optional(v.boolean()), // Priority snapshot at time of submission (like name)
        isCompleted: v.boolean(), // Whether this specific check was completed
        isNotApplicable: v.optional(v.boolean()), // Marked as unable to be completed (mutually exclusive with isCompleted)
        notes: v.optional(v.string()), // Optional notes for this specific check
        completedBy: v.optional(v.id("users")), // User who completed this specific check
        completedAt: v.optional(v.number()), // Timestamp when this specific check was completed
        isAdHoc: v.optional(v.boolean()), // Whether this is an ad-hoc item added by a crew leader
        addedBy: v.optional(v.id("users")), // User who added this ad-hoc item
        // Set on items satisfied by an inventory run rather than a tick. The
        // audit trail for a derived row: which appliance template it was, and
        // which run resolved it. Stored so a submitted week renders from the
        // record instead of re-deriving - a past week must not change because
        // someone completed an inventory later.
        linkedApplianceTemplateId: v.optional(v.id("applianceTemplates")),
        linkedRunId: v.optional(v.id("applianceCheckRuns")),
      })
    ),
    notes: v.optional(v.string()), // Optional general notes for the entire submission
    // Who was on the crew when this week was worked. The dutyCrew doc only
    // holds today's roster, so without this snapshot past weeks silently
    // rewrite themselves as members move between crews. Absent on
    // submissions created before the snapshot existed.
    crewSnapshot: v.optional(
      v.object({
        name: v.string(), // Crew name at the time
        number: v.number(),
        capturedAt: v.number(),
        members: v.array(
          v.object({
            userId: v.id("users"),
            name: v.optional(v.string()),
            firstName: v.optional(v.string()),
            lastName: v.optional(v.string()),
            isLeader: v.boolean(),
          })
        ),
      })
    ),
  })
    .index("by_date", ["date"])
    .index("by_dutyCrew", ["dutyCrewId"])
    .index("by_completedBy", ["completedBy"])
    .index("by_status", ["status"])
    .index("by_date_and_dutyCrew", ["date", "dutyCrewId"])
    .index("by_dutyCrew_and_status", ["dutyCrewId", "status"])
    .index("by_status_and_date", ["status", "date"])
    .index("by_dutyCrew_and_status_and_date", ["dutyCrewId", "status", "date"]),

  // Push subscriptions for web push notifications
  pushSubscriptions: defineTable({
    userId: v.id("users"),
    subscription: v.any(), // Raw PushSubscription JSON object
    // Device information
    deviceType: v.optional(v.union(v.literal("mobile"), v.literal("tablet"), v.literal("desktop"))),
    platform: v.optional(v.string()), // iOS, Android, Windows, macOS, Linux
    browser: v.optional(v.string()), // Chrome, Firefox, Safari, Edge
    userAgent: v.optional(v.string()), // Full user agent string
    createdAt: v.number(),
  })
    .index("by_user", ["userId"]),

  // Notification audit log table to record delivery attempts
  notificationAudit: defineTable({
    userId: v.optional(v.id("users")),
    subscriptionId: v.optional(v.id("pushSubscriptions")),
    endpoint: v.optional(v.string()),
    notificationType: v.optional(v.string()),
    source: v.optional(v.string()),
    title: v.string(),
    body: v.string(),
    success: v.boolean(),
    error: v.optional(v.string()),
    sentAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_type_time", ["notificationType", "sentAt"])
    .index("by_sentAt", ["sentAt"]),

  // Notification history table to store notifications for 24 hours for user retrieval
  notificationHistory: defineTable({
    title: v.string(),
    body: v.string(),
    url: v.optional(v.string()), // Optional URL for deep-linking
    notificationType: v.optional(v.string()),
    source: v.optional(v.string()),
    sentAt: v.number(),
    expiresAt: v.number(), // Timestamp when this notification should be deleted (sentAt + 24 hours)
    // Store which users received this notification (for targeted notifications)
    // If undefined/empty, it was a broadcast to all users
    recipientUserIds: v.optional(v.array(v.id("users"))),
  })
    .index("by_sentAt", ["sentAt"])
    .index("by_expiresAt", ["expiresAt"]),

  // Fire Reports - Comprehensive incident reporting system
  // Appliance locations table to track where each appliance is stationed
  applianceLocations: defineTable({
    applianceName: v.union(
      v.literal("Pumper"),
      v.literal("Tanker"),
      v.literal("FCV")
    ),
    stationLocation: v.string(), // Can be "Main Station", "Satellite Station", or custom location
    updatedBy: v.optional(v.id("users")),
    updatedByServiceAccount: v.optional(v.id("serviceAccounts")),
    updatedBySource: v.optional(
      v.union(v.literal("user"), v.literal("serviceAccount"))
    ),
    updatedAt: v.number(),
  }).index("by_applianceName", ["applianceName"]),

  fireReports: defineTable({
    // Meta information
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
    status: v.union(
      v.literal("draft"),
      v.literal("submitted"),
      v.literal("approved"),
      v.literal("archived")
    ),

    // Core Fire Call Details (required fields)
    incidentNumber: v.string(),
    brigadeAdvisedDate: v.string(), // ISO date string
    brigadeAdvisedTime: v.string(), // HH:MM format
    attendingCapacity: v.union(v.literal("primary"), v.literal("support")),
    typeOfAttendance: v.union(
      v.literal("grassScrub"),
      v.literal("incident"),
      v.literal("structure"),
      v.literal("nonStructure"),
      v.literal("falseAlarm")
    ),
    incidentController: v.string(),
    propertyAddress: v.string(),

    // Optional Fire Call Details
    brigadeCaller: v.optional(v.string()),
    firecomCaller: v.optional(v.string()),
    jobDetail: v.optional(v.string()),
    brigadeOIC: v.optional(v.string()),
    propertyCoordinates: v.optional(v.string()),
    keysUsed: v.optional(v.boolean()),
    chargeRecommended: v.optional(v.boolean()),

    // Property Information
    propertyInfo: v.optional(v.object({
      occupier: v.optional(v.object({
        name: v.optional(v.string()),
        phone: v.optional(v.string()),
        type: v.optional(v.union(v.literal("private"), v.literal("government")))
      })),
      owner: v.optional(v.object({
        name: v.optional(v.string()),
        address: v.optional(v.string()),
        phone: v.optional(v.string()),
        type: v.optional(v.union(v.literal("private"), v.literal("government")))
      }))
    })),

    // Actions Taken (checkboxes)
    actionsTaken: v.optional(v.array(v.union(
      v.literal("calledOff"),
      v.literal("stepUp"),
      v.literal("investigateOnly"),
      v.literal("fireOutOnArrival"),
      v.literal("washaway"),
      v.literal("removeHazard"),
      v.literal("rescue"),
      v.literal("isolate"),
      v.literal("standby"),
      v.literal("extinguish"),
      v.literal("service"),
      v.literal("other")
    ))),

    // Fire Details
    fireDetails: v.optional(v.object({
      materialsFirstIgnited: v.optional(v.string()),
      causeOfIgnition: v.optional(v.string()),
      usedForExtinguishment: v.optional(v.string()),
      numberOfHoseLinesUsed: v.optional(v.number()),
      problems: v.optional(v.string()),
      supply: v.optional(v.string()),
      estimatedLoss: v.optional(v.number()),
      insurance: v.optional(v.boolean()),
      fireInvestigation: v.optional(v.boolean())
    })),

    // Other Services
    otherServices: v.optional(v.object({
      electricity: v.optional(v.object({
        notified: v.optional(v.boolean()),
        attended: v.optional(v.boolean())
      })),
      gas: v.optional(v.object({
        notified: v.optional(v.boolean()),
        attended: v.optional(v.boolean())
      })),
      ambulance: v.optional(v.object({
        notified: v.optional(v.boolean()),
        attended: v.optional(v.boolean())
      })),
      police: v.optional(v.object({
        notified: v.optional(v.boolean()),
        attended: v.optional(v.boolean()),
        details: v.optional(v.string()) // Name/Number/Station
      })),
      other: v.optional(v.string()),
      firstOnScene: v.optional(v.string())
    })),

    // Casualties (can have multiple)
    casualties: v.optional(v.array(v.object({
      name: v.optional(v.string()),
      injuries: v.optional(v.union(v.literal("minor"), v.literal("major"), v.literal("fatal"))),
      sex: v.optional(v.union(v.literal("male"), v.literal("female"))),
      details: v.optional(v.string()),
      transportedByAV: v.optional(v.boolean())
    }))),

    // Mobile Property
    mobileProperty: v.optional(v.object({
      registration: v.optional(v.string()),
      state: v.optional(v.string()),
      make: v.optional(v.string()),
      model: v.optional(v.string()),
      year: v.optional(v.number()),
      details: v.optional(v.string())
    })),

    // Photos/Attachments (store file storage IDs)
    attachments: v.optional(v.array(v.object({
      fileId: v.id("_storage"),
      fileName: v.string(),
      fileType: v.string(),
      uploadedAt: v.number()
    }))),

    // Future extensibility - store any additional data that doesn't fit the current schema
    additionalData: v.optional(v.any()),

    // Comments/Notes for internal use
    notes: v.optional(v.string())
  })
    .index("by_createdBy", ["createdBy"])
    .index("by_status", ["status"])
    .index("by_incidentNumber", ["incidentNumber"])
    .index("by_createdAt", ["createdAt"])
    .index("by_brigadeAdvisedDate", ["brigadeAdvisedDate"]),

  // Notification settings for scheduled notifications
  notificationSettings: defineTable({
    notificationType: v.union(
      v.literal("nightlyReset"),
      v.literal("morningReminder")
    ),
    enabled: v.boolean(),
    description: v.string(),
    updatedBy: v.id("users"),
    updatedAt: v.number()
  })
    .index("by_notificationType", ["notificationType"]),

  // Email settings for automated emails
  emailSettings: defineTable({
    emailType: v.union(
      v.literal("newUserSignup"),
      v.literal("feedbackSubmission")
    ),
    enabled: v.boolean(),
    description: v.string(),
    updatedBy: v.id("users"),
    updatedAt: v.number()
  })
    .index("by_emailType", ["emailType"]),

  // Feedback submissions from users
  feedback: defineTable({
    subject: v.string(), // Subject/title of the feedback
    message: v.string(), // Feedback message content
    category: v.union(
      v.literal("bug"),
      v.literal("feature"),
      v.literal("improvement"),
      v.literal("general")
    ),
    isAnonymous: v.boolean(), // Whether the feedback is submitted anonymously
    submittedBy: v.optional(v.id("users")), // User ID if not anonymous
    submitterName: v.optional(v.string()), // User's name if not anonymous
    appVersion: v.string(), // Version of the app when feedback was submitted
    createdAt: v.number(), // Timestamp when feedback was created
    // Admin response fields
    status: v.optional(v.union(
      v.literal("pending"), // Default state - not yet reviewed
      v.literal("implemented"), // Feedback has been implemented
      v.literal("wont_implement"), // Decided not to implement
      v.literal("under_review") // Currently being considered
    )),
    adminResponse: v.optional(v.string()), // Admin's comments/notes about the feedback
    respondedBy: v.optional(v.id("users")), // Admin who responded
    respondedAt: v.optional(v.number()), // When the response was made
  })
    .index("by_createdAt", ["createdAt"])
    .index("by_submittedBy", ["submittedBy"])
    .index("by_category", ["category"])
    .index("by_status", ["status"]),

  // Links table for configurable quick links page
  links: defineTable({
    title: v.string(),
    url: v.string(),
    category: v.optional(v.string()),
    icon: v.optional(v.string()),
    order: v.number(),
    isActive: v.boolean(),
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_isActive", ["isActive"])
    .index("by_order", ["order"]),

  linkCategories: defineTable({
    name: v.string(),
    order: v.number(),
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_name", ["name"])
    .index("by_order", ["order"]),

  // Vehicle Fault Vehicle Types - admin-configurable vehicle types
  vehicleFaultVehicleTypes: defineTable({
    name: v.string(),
    isActive: v.boolean(),
    order: v.number(),
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_order", ["order"])
    .index("by_active", ["isActive", "order"]),

  // Vehicle Fault Attachments - photos/files attached to faults
  vehicleFaultAttachments: defineTable({
    faultId: v.id("vehicleFaults"),
    storageId: v.id("_storage"),
    fileName: v.string(),
    fileType: v.string(),
    uploadedBy: v.id("users"),
    uploadedAt: v.number(),
  })
    .index("by_fault", ["faultId"]),

  // Vehicle Faults table for tracking appliance issues
  vehicleFaults: defineTable({
    dateReported: v.number(), // Timestamp when the fault was first reported
    dateLogged: v.optional(v.number()), // Timestamp when the fault was logged into CFA system
    vehicle: v.string(), // Vehicle name (admin-configurable via vehicleFaultVehicleTypes)
    shortDescription: v.string(), // Brief description of the issue (e.g., "Air leak", "Electrical issue")
    longDescription: v.string(), // Detailed description of the issue
    eamRequestNumber: v.optional(v.string()), // EAM Request Number from CFA system
    priority: v.union(
      v.literal("low"),
      v.literal("medium"),
      v.literal("high")
    ),
    status: v.union(
      v.literal("pending_dmo"),
      v.literal("pending_wydv"),
      v.literal("resolved")
    ),
    reportedBy: v.id("users"), // User who reported the fault
    createdAt: v.number(), // Timestamp when the record was created
    updatedAt: v.number(), // Timestamp when the record was last updated
    updatedBy: v.id("users"), // User who last updated the record
    notes: v.optional(v.string()), // Additional notes or updates about the fault
  })
    .index("by_vehicle", ["vehicle"])
    .index("by_status", ["status"])
    .index("by_dateReported", ["dateReported"])
    .index("by_reportedBy", ["reportedBy"])
    .index("by_createdAt", ["createdAt"]),

  // Vehicle Fault Comments for discussion about specific faults
  vehicleFaultComments: defineTable({
    faultId: v.id("vehicleFaults"),
    userId: v.id("users"),
    timestamp: v.number(),
    text: v.string(),
  })
    .index("by_fault", ["faultId", "timestamp"])
    .index("by_timestamp", ["timestamp"]),

  // Vehicle Fault History for audit trail of changes to vehicle faults
  vehicleFaultHistory: defineTable({
    faultId: v.id("vehicleFaults"),
    timestamp: v.number(),
    userId: v.id("users"),
    changeType: v.string(), // e.g., "field_change", "fault_created", "fault_deleted"
    field: v.string(), // The field that was changed
    oldValue: v.any(), // The previous value
    newValue: v.any(), // The new value
    notes: v.optional(v.string()), // Optional notes
  })
    .index("by_fault", ["faultId"])
    .index("by_timestamp", ["timestamp"]),

  // Appliance Checks - Template-driven structure (Appliance -> Sections -> Items)
  // Templates represent a specific appliance's checklist definition (e.g., Pumper v1)
  applianceTemplates: defineTable({
    name: v.string(), // Appliance name or template name (e.g., "Pumper")
    description: v.optional(v.string()),
    version: v.number(), // Increment on significant structural changes
    hasUnpublishedChanges: v.optional(v.boolean()),
    // Lifecycle. One field rather than isActive + isArchived booleans, which
    // can contradict each other (active && archived means nothing) and force
    // every read to check both. Mirrors the status union on fire calls.
    //
    // Missing means "active": existing rows predate this field, and Convex
    // rejects a required field that isn't there, so optional is what makes
    // this ship without a migration. Treat undefined as active everywhere.
    status: v.optional(
      v.union(
        v.literal("active"), // in service, members can run it
        v.literal("inactive"), // off the run (spare swapped in); admin-only, still editable
        v.literal("archived") // soft-deleted; hidden except in the Archived view
      )
    ),
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
    updatedBy: v.id("users"),
    // For future extensibility without schema changes
    metadata: v.optional(v.any()),
  })
    .index("by_name", ["name"])
    .index("by_status", ["status"])
    .index("by_updatedAt", ["updatedAt"]),

  // Sections are logical areas within an appliance (e.g., Cabin, Locker 1)
  applianceSections: defineTable({
    templateId: v.id("applianceTemplates"),
    name: v.string(),
    order: v.number(), // for display ordering
    description: v.optional(v.string()), // Help text for users about this section
    imageStorageId: v.optional(v.id("_storage")), // Reference image for the section (e.g., photo of locker)
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
    updatedBy: v.id("users"),
    metadata: v.optional(v.any()), // flexible per-section config
  })
    .index("by_template", ["templateId"])
    .index("by_template_order", ["templateId", "order"]),

  // Items are checkable elements within a section
  applianceItems: defineTable({
    templateId: v.id("applianceTemplates"), // denormalized for efficient queries
    sectionId: v.id("applianceSections"),
    name: v.string(),
    order: v.number(),
    // The interaction type for this item; default is boolean with optional notes
    itemType: v.union(
      v.literal("boolean_with_notes"),
      v.literal("boolean"),
      v.literal("text")
    ),
    isRequired: v.optional(v.boolean()),
    defaultNotes: v.optional(v.string()),
    description: v.optional(v.string()), // Help text for users
    imageStorageId: v.optional(v.id("_storage")), // Reference image for the item
    expectedQuantity: v.optional(v.number()), // If set, this item requires quantity counting instead of yes/no
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
    updatedBy: v.id("users"),
    metadata: v.optional(v.any()), // flexible per-item options in future
  })
    .index("by_section", ["sectionId"])
    .index("by_section_order", ["sectionId", "order"])
    .index("by_template", ["templateId"]),

  // Runs: Instances of weekly checks based on a template
  applianceCheckRuns: defineTable({
    templateId: v.id("applianceTemplates"),
    templateVersion: v.number(),
    templateName: v.string(),
    status: v.union(
      v.literal("in_progress"),
      v.literal("completed"),
      v.literal("cancelled")
    ),
    scheduledDate: v.optional(v.number()), // optional date anchor for the week
    startedBy: v.id("users"),
    startedAt: v.number(),
    completedBy: v.optional(v.id("users")),
    completedAt: v.optional(v.number()),
    notes: v.optional(v.string()),
    metadata: v.optional(v.any()),
  })
    .index("by_status", ["status"])
    .index("by_startedAt", ["startedAt"])
    .index("by_template", ["templateId"])
    .index("by_scheduledDate", ["scheduledDate"]),

  // One document per item response in a run for efficient updates
  applianceCheckRunItems: defineTable({
    runId: v.id("applianceCheckRuns"),
    // Reference back to the template entities (may be used for reporting)
    templateId: v.id("applianceTemplates"),
    sectionId: v.optional(v.id("applianceSections")),
    itemId: v.optional(v.id("applianceItems")),
    // Snapshot fields to be resilient to template changes
    sectionName: v.string(),
    sectionOrder: v.number(),
    sectionDescription: v.optional(v.string()), // Snapshot of section description
    sectionImageStorageId: v.optional(v.id("_storage")), // Snapshot of section image
    itemName: v.string(),
    itemOrder: v.number(),
    itemType: v.union(
      v.literal("boolean_with_notes"),
      v.literal("boolean"),
      v.literal("text")
    ),
    description: v.optional(v.string()), // Snapshot of item description
    imageStorageId: v.optional(v.id("_storage")), // Snapshot of item image
    // Quantity fields (for items with expectedQuantity set)
    expectedQuantity: v.optional(v.number()), // Snapshot from template
    actualQuantity: v.optional(v.number()), // User's counted quantity
    // User responses (for boolean items)
    value: v.optional(v.union(v.literal("yes"), v.literal("no"))),
    notes: v.optional(v.string()),
    updatedBy: v.optional(v.id("users")),
    updatedAt: v.optional(v.number()),
  })
    .index("by_run", ["runId"])
    .index("by_run_sectionOrder", ["runId", "sectionOrder"])
    .index("by_run_itemOrder", ["runId", "itemOrder"]),

  // Member Records - a kit register. An officer records what gear each member
  // holds so ordering doesn't mean chasing a spreadsheet. The domain has three
  // nouns: a kit *set* (Structural PPC), the *items* in it (jacket, boots), and
  // the *size chart* a sized item is ordered against. Some things the brigade
  // tracks aren't sets at all (a pager is one serial, station workwear is one
  // yes/no), so an item may stand alone with no set.
  memberKitSets: defineTable({
    name: v.string(), // "Structural PPC", "Wildfire PPC", "Comms"
    description: v.optional(v.string()),
    order: v.number(),
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedBy: v.id("users"),
    updatedAt: v.number(),
    metadata: v.optional(v.any()),
  }).index("by_order", ["order"]),

  memberKitItems: defineTable({
    // Absent means standalone. Standalone items are read from the same index
    // with q.eq("setId", undefined), and `order` sequences them among
    // themselves, so no second index is needed.
    setId: v.optional(v.id("memberKitSets")),
    name: v.string(), // "Jacket", "Boots", "Pager"
    description: v.optional(v.string()), // helper text shown under the control
    order: v.number(),
    tracks: kitTracksValidator,
    options: v.optional(v.array(v.string())), // "choice" only
    isArchived: v.optional(v.boolean()), // hidden from profiles, entries retained
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedBy: v.id("users"),
    updatedAt: v.number(),
    metadata: v.optional(v.any()),
  })
    .index("by_set", ["setId"])
    .index("by_set_order", ["setId", "order"]),

  // A size list belonging to a "size" item. Suppliers do not share a sizing
  // scale, so gloves stocked from three of them need three charts and the sizes
  // have to follow the chosen one. `name` is optional because plenty of gear
  // (braces, for one) only ever comes in a single make: that item gets one
  // unnamed chart and the officer is never asked to invent a brand.
  memberKitSizeCharts: defineTable({
    itemId: v.id("memberKitItems"),
    name: v.optional(v.string()), // the supplier's brand or model, when it matters
    order: v.number(),
    sizes: v.array(v.string()), // e.g. ["82","87","92"] or ["S","M","L"]
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedBy: v.id("users"),
    updatedAt: v.number(),
  })
    .index("by_item", ["itemId"])
    .index("by_item_order", ["itemId", "order"]),

  // One row per (member, item) that has a recorded value. A missing row means
  // "not recorded", which stays distinct from a recorded `false`, so clearing a value
  // deletes the row rather than storing an empty one.
  memberKitEntries: defineTable({
    userId: v.id("users"),
    itemId: v.id("memberKitItems"),
    value: kitValueValidator,
    updatedBy: v.id("users"),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_item", ["itemId"])
    .index("by_user_item", ["userId", "itemId"]),

  // Immutable audit of every material entry change. Deliberately snapshot-based
  // (the Inventory pattern): the formatted values, item name, set name and actor
  // name are captured when the event is written, so renaming or deleting a
  // chart, item, set or user never rewrites how an existing row reads.
  memberKitEntryHistory: defineTable({
    userId: v.id("users"),
    itemId: v.id("memberKitItems"),
    previousValue: v.optional(kitValueValidator),
    newValue: v.optional(kitValueValidator), // absent means the value was cleared
    previousDisplaySnapshot: v.optional(v.string()),
    newDisplaySnapshot: v.optional(v.string()),
    reason: kitHistoryReasonValidator,
    itemNameSnapshot: v.string(),
    setNameSnapshot: v.optional(v.string()), // absent means the item was standalone then
    changedByNameSnapshot: v.string(),
    changedBy: v.id("users"),
    changedAt: v.number(),
  })
    .index("by_user_changedAt", ["userId", "changedAt"])
    .index("by_item_changedAt", ["itemId", "changedAt"]),

  // Bookings - Resource booking system
  // Resources that can be booked (appliances, meeting room, etc.)
  bookingResources: defineTable({
    name: v.string(), // Resource name (e.g., "Pumper", "Meeting Room")
    description: v.optional(v.string()), // Optional description
    isActive: v.boolean(), // Whether this resource can be booked
    approvers: v.array(v.id("users")), // Users who can approve bookings for this resource
    approverOnly: v.optional(v.boolean()), // If true, only approvers can create bookings (no approval needed)
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
    updatedBy: v.id("users"),
  })
    .index("by_isActive", ["isActive"]),

  // Training roll - who was at training nights and brigade meetings.
  //
  // The roll keeps its own member list rather than using `users`, because it
  // has to call members who have no BRAVO account. A roll member is linked to
  // an account when there is one (and then takes its name and rank from it);
  // until then it carries its own. Member accounts with no roll member row yet
  // are put on the roll automatically, and get a row the first time they're
  // marked - so nobody has to keep the two lists in step.
  rollMembers: defineTable({
    userId: v.optional(v.id("users")),
    firstName: v.string(),
    lastName: v.string(),
    memberNumber: v.optional(v.string()), // CFA ID - how an account is matched later
    // Only used while there's no linked account
    rank: v.optional(
      v.union(
        v.literal("Brigade Member"),
        v.literal("Probationary"),
        v.literal("Firefighter"),
        v.literal("Lieutenant"),
        v.literal("Captain")
      )
    ),
    lieutenantNumber: v.optional(v.number()),
    // Left the brigade: off future rolls, history kept
    isActive: v.boolean(),
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_memberNumber", ["memberNumber"]),

  // A roll night that has been touched. Tuesdays exist without a row (every
  // Tuesday is training, the 2nd is the brigade meeting); a row appears once an
  // apology or mark is recorded, the night is cancelled, or a one-off is added.
  rollNights: defineTable({
    date: v.string(), // YYYY-MM-DD
    kind: v.union(v.literal("training"), v.literal("meeting"), v.literal("other")),
    title: v.optional(v.string()), // One-off nights, e.g. "Joint exercise"
    status: v.union(v.literal("open"), v.literal("closed"), v.literal("cancelled")),
    closedBy: v.optional(v.id("users")),
    closedAt: v.optional(v.number()),
    createdBy: v.id("users"),
    createdAt: v.number(),
  }).index("by_date", ["date"]),

  // One member's mark for one night. No row = not marked yet; closing the roll
  // writes "absent" for everyone still unmarked.
  rollMarks: defineTable({
    nightId: v.id("rollNights"),
    rollMemberId: v.id("rollMembers"),
    status: v.union(v.literal("present"), v.literal("apology"), v.literal("absent")),
    recordedBy: v.id("users"), // For an apology, the officer who took it
    recordedAt: v.number(),
    note: v.optional(v.string()), // e.g. "Arrived 20:30" - goes with the mark
  })
    .index("by_nightId", ["nightId"])
    .index("by_nightId_and_rollMemberId", ["nightId", "rollMemberId"])
    .index("by_rollMemberId", ["rollMemberId"]),

  // Every change to a mark after it was first made, so an amended roll (an
  // Absent turned into a late Apology) shows who changed what.
  rollMarkHistory: defineTable({
    nightId: v.id("rollNights"),
    rollMemberId: v.id("rollMembers"),
    oldStatus: v.optional(v.string()),
    newStatus: v.optional(v.string()), // Absent when the mark was cleared
    changedBy: v.id("users"),
    changedAt: v.number(),
  }).index("by_nightId", ["nightId"]),

  // A repeating booking: the rule its dates were generated from. Kept so the
  // dates can be described ("Every Tuesday") and acted on together; the dates
  // themselves are ordinary rows in `bookings`.
  bookingSeries: defineTable({
    resourceId: v.id("bookingResources"),
    frequency: v.union(v.literal("weekly"), v.literal("fortnightly"), v.literal("monthly")),
    startDate: v.string(), // First date (YYYY-MM-DD), which also fixes the weekday
    untilDate: v.string(), // Last date the rule may produce (YYYY-MM-DD)
    createdBy: v.id("users"),
    createdAt: v.number(),
  }),

  // Booking requests
  bookings: defineTable({
    resourceId: v.id("bookingResources"), // The resource being booked
    requestedBy: v.optional(v.id("users")), // User requesting the booking (null for blocked/unavailable)
    isBlocked: v.optional(v.boolean()), // True if resource is blocked without a user (e.g., strike team)
    status: v.union(
      v.literal("pending"), // Awaiting approval
      v.literal("approved"), // Approved by an approver
      v.literal("rejected"), // Rejected by an approver
      v.literal("cancelled") // Cancelled by the requester
    ),
    // Date/time fields for the booking
    startDate: v.string(), // ISO date string (YYYY-MM-DD)
    endDate: v.optional(v.string()), // ISO date string, optional for single-day bookings
    startTime: v.optional(v.string()), // Time string (HH:MM), optional for all-day bookings
    endTime: v.optional(v.string()), // Time string (HH:MM), optional for all-day bookings
    isAllDay: v.boolean(), // Whether this is an all-day booking
    notes: v.optional(v.string()), // Optional notes from the requester
    reviewedBy: v.optional(v.id("users")), // User who approved/rejected
    reviewedAt: v.optional(v.number()), // When the booking was reviewed
    reviewNotes: v.optional(v.string()), // Notes from the reviewer
    // Set when this booking is one date of a repeating booking. Each date is
    // still a full booking in its own right - approved, cancelled and edited on
    // its own - so the schedule and the clash check never need to know about
    // repeats.
    seriesId: v.optional(v.id("bookingSeries")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_seriesId", ["seriesId"])
    .index("by_resource", ["resourceId"])
    .index("by_requestedBy", ["requestedBy"])
    .index("by_status", ["status"])
    .index("by_createdAt", ["createdAt"])
    .index("by_startDate", ["startDate"])
    .index("by_resource_startDate", ["resourceId", "startDate"]),

  // Admin-configurable event categories with a colour, surfaced as a dropdown
  // in the event form (replaces the old free-text eventType string).
  eventTypes: defineTable({
    name: v.string(),
    color: v.string(), // Palette key - see eventTypeColors in src/features/events/types.ts
    isActive: v.boolean(),
    order: v.number(),
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_active", ["isActive"])
    .index("by_order", ["order"]),

  // Events - Brigade events (sausage sizzles, school visits, training sessions, etc.)
  events: defineTable({
    title: v.string(),
    description: v.optional(v.string()),
    eventType: v.optional(v.string()), // Legacy free-text category (pre-eventTypes); read-only fallback
    eventTypeId: v.optional(v.id("eventTypes")), // Structured category (preferred)
    location: v.optional(v.string()), // Venue/place name (e.g. "Main Station")
    address: v.optional(v.string()), // Street address, independent of location
    status: v.union(v.literal("active"), v.literal("cancelled")),
    startDate: v.string(), // ISO date string (YYYY-MM-DD)
    endDate: v.optional(v.string()), // ISO date string, optional for single-day events
    startTime: v.optional(v.string()), // Time string (HH:MM), optional for all-day events
    endTime: v.optional(v.string()), // Time string (HH:MM), optional for all-day events
    respondBy: v.optional(v.string()), // ISO date string - optional RSVP-by date
    hasShifts: v.optional(v.boolean()), // Opt-in: event collects per-slot interest (eventSlots)
    // Whether members may still opt *in* (RSVP yes/maybe, or pick a shift).
    // Absent = "open". "closed" means the organiser already knows who's going and
    // sets the roster themselves via eventSlotAllocations - it never deletes
    // existing responses, so flipping back to "open" restores them untouched.
    // Declining ("can't make it") is always allowed, in either mode.
    memberResponses: v.optional(v.union(v.literal("open"), v.literal("closed"))),
    // Social events (the annual dinner) let members bring partners, and the
    // organiser needs the headcount for catering. Absent = off, so every event
    // that predates the field keeps behaving exactly as before. Never offered
    // on a shift event - a roster is operational, and a shift pick has no party
    // attached to it.
    allowsGuests: v.optional(v.boolean()),
    // A cap on how many guests one member may bring, where the venue forces
    // one. Absent = no limit, which is the default. It bounds *new* answers
    // only: lowering it never truncates an answer a member already gave.
    maxGuestsPerMember: v.optional(v.number()),
    // Whether the RSVP also asks for dietary requirements. Separate toggle from
    // allowsGuests: a sit-down dinner for members only still needs the notes.
    collectsDietary: v.optional(v.boolean()),
    isAllDay: v.boolean(),
    cancelledBy: v.optional(v.id("users")),
    cancelledAt: v.optional(v.number()),
    cancellationReason: v.optional(v.string()),
    createdBy: v.id("users"),
    // Members trusted to run *this* event: they get the organiser's toolkit
    // (edit, roster, responses, notify, cancel) scoped to this one event,
    // without the brigade-wide eventsAdmin access an officer or Social Admin
    // role carries. Absent/empty means nobody beyond the organiser.
    teamLeaderIds: v.optional(v.array(v.id("users"))),
    // Set when someone confirms who actually turned up (see eventAttendance).
    // Absent means "nobody has confirmed this yet" - which is a real state worth
    // showing on a past event, not just a missing value.
    attendanceConfirmedAt: v.optional(v.number()),
    attendanceConfirmedBy: v.optional(v.id("users")),
    // This event needs no attendance record - set on the event form or from
    // the event page afterwards. Never set together with attendanceConfirmedAt.
    attendanceNotNeeded: v.optional(v.boolean()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_startDate", ["startDate"])
    .index("by_status", ["status"])
    .index("by_status_startDate", ["status", "startDate"])
    .index("by_createdBy", ["createdBy"])
    .index("by_eventTypeId", ["eventTypeId"])
    // Title search for the admin past-events archive (recollection / audit)
    .searchIndex("search_title", { searchField: "title" }),

  // Event RSVPs - one row per user per event (uniqueness enforced by upsert)
  eventRsvps: defineTable({
    eventId: v.id("events"),
    userId: v.id("users"),
    status: v.union(
      v.literal("attending"),
      v.literal("notAttending"),
      v.literal("maybe")
    ),
    // How many extra people this member is bringing (events.allowsGuests).
    // Absent or 0 = just them. Cleared whenever the answer stops being
    // "attending" - a "no" carries no party.
    guestCount: v.optional(v.number()),
    // Dietary requirements for this member's whole party, free text
    // (events.collectsDietary). Health information: only event managers read it.
    dietaryNotes: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_event", ["eventId"])
    .index("by_user", ["userId"])
    .index("by_event_user", ["eventId", "userId"]),

  // Optional per-event shifts/sessions (only present when events.hasShifts).
  // A sausage-sizzle split into shifts, or a multi-day course's sessions.
  eventSlots: defineTable({
    eventId: v.id("events"),
    label: v.string(),
    startTime: v.optional(v.string()), // HH:MM
    endTime: v.optional(v.string()), // HH:MM
    date: v.optional(v.string()), // YYYY-MM-DD (multi-day sessions)
    targetCount: v.optional(v.number()), // Soft target headcount - never enforced
    order: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_event", ["eventId"]),

  // A member's interest in a single slot (member-expressed)
  eventSlotResponses: defineTable({
    eventId: v.id("events"),
    slotId: v.id("eventSlots"),
    userId: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_slot", ["slotId"])
    .index("by_event", ["eventId"])
    .index("by_event_user", ["eventId", "userId"])
    .index("by_slot_user", ["slotId", "userId"]),

  // Admin-controlled allocation of a member to an event (the official roster).
  // Distinct from interest - an admin can place anyone, interest is just a hint.
  // The roster exists for every event, not just shift events: an absent slotId
  // is an event-level placement ("you're on for the whole thing"), which is how
  // a shiftless event with known attendees is rostered.
  eventSlotAllocations: defineTable({
    eventId: v.id("events"),
    slotId: v.optional(v.id("eventSlots")),
    userId: v.id("users"),
    assignedBy: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_slot", ["slotId"])
    .index("by_event", ["eventId"])
    .index("by_event_user", ["eventId", "userId"])
    .index("by_slot_user", ["slotId", "userId"]),

  // Appliances crewed for an event - a truck at a school visit or community
  // day. Same seats as deploymentCrews, one crew per appliance for the whole
  // event (never per shift). Deliberately independent of the roster: being in
  // a seat doesn't put a member on eventSlotAllocations, and neither excludes
  // the other.
  eventCrews: defineTable({
    eventId: v.id("events"),
    applianceName: v.string(),
    crewLeader: v.optional(crewSeat),
    driver: v.optional(crewSeat),
    crewMembers: v.array(crewSeat), // up to 3
    notes: v.optional(v.string()),
    createdBy: v.id("users"),
    updatedBy: v.id("users"),
    updatedAt: v.number(),
  }).index("by_event", ["eventId"]),

  // Who actually turned up. Deliberately a separate layer from both the RSVPs
  // (what members said beforehand) and eventSlotAllocations (who was rostered):
  // the whole point is that real attendance deviates from both, and the
  // deviation is what gets reported to the public-facing systems and audited
  // later. One row per confirmed attendee; the set is rewritten wholesale by
  // events.setEventAttendance.
  eventAttendance: defineTable({
    eventId: v.id("events"),
    userId: v.id("users"),
    recordedBy: v.id("users"),
    recordedAt: v.number(),
  })
    .index("by_event", ["eventId"])
    .index("by_event_user", ["eventId", "userId"])
    // "Which events was this member at?" - the per-member attendance record
    .index("by_user", ["userId"]),

  // Event history for audit trail of changes to events
  eventHistory: defineTable({
    eventId: v.id("events"),
    timestamp: v.number(),
    userId: v.id("users"),
    changeType: v.string(), // event_created | field_change | event_cancelled | event_restored | notification_sent
    field: v.string(),
    oldValue: v.any(),
    newValue: v.any(),
    notes: v.optional(v.string()),
  })
    .index("by_event", ["eventId"])
    .index("by_timestamp", ["timestamp"]),

  // Password reset tokens table
  passwordResetTokens: defineTable({
    email: v.string(), // Email address requesting the reset
    token: v.string(), // Unique token for verification
    expiresAt: v.number(), // Timestamp when token expires (30 minutes)
    used: v.boolean(), // Whether this token has been used
    createdAt: v.number(),
  })
    .index("by_email", ["email"])
    .index("by_token", ["token"])
    .index("by_expiresAt", ["expiresAt"]),

  // Equipment Management - Categories for organizing equipment items
  equipmentCategories: defineTable({
    name: v.string(), // Category name (e.g., "PPE", "Batteries", "Tools")
    description: v.optional(v.string()),
    order: v.number(), // Display order
    isActive: v.boolean(),
    // When true, all items in this category collapse into a single row in Take/Replenish views
    // (grouped by category name instead of item name). Useful for misc categories with diverse items.
    collapseItems: v.optional(v.boolean()),
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_isActive", ["isActive"])
    .index("by_order", ["order"]),

  // Equipment items - Individual items that can be tracked
  equipmentItems: defineTable({
    name: v.string(), // Item name (e.g., "XL Gloves", "AA Batteries")
    categoryId: v.id("equipmentCategories"),
    description: v.optional(v.string()),
    // Size variant if applicable (e.g., XS, S, M, L, XL, XXL)
    size: v.optional(v.string()),
    // Current stock level
    currentStock: v.number(),
    // Minimum stock level before warning
    minimumStock: v.optional(v.number()),
    // Unit of measurement (e.g., "pairs", "units", "boxes")
    unit: v.optional(v.string()),
    isActive: v.boolean(),
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
    updatedBy: v.id("users"),
  })
    .index("by_category", ["categoryId"])
    .index("by_isActive", ["isActive"])
    .index("by_name", ["name"]),

  // Equipment transactions - Track all stock movements
  equipmentTransactions: defineTable({
    itemId: v.id("equipmentItems"),
    type: v.union(
      v.literal("take"), // User took item from stock
      v.literal("replenish"), // Stock was replenished
      v.literal("adjustment"), // Manual stock adjustment
      v.literal("initial") // Initial stock entry
    ),
    quantity: v.number(), // Positive for additions, negative for removals
    previousStock: v.number(), // Stock level before transaction
    newStock: v.number(), // Stock level after transaction
    notes: v.optional(v.string()),
    userId: v.id("users"), // User who performed the transaction
    createdAt: v.number(),
  })
    .index("by_item", ["itemId"])
    .index("by_user", ["userId"])
    .index("by_createdAt", ["createdAt"])
    .index("by_type", ["type"]),

  // BA Skills Maintenance - Track BA cylinder usage for skills currency
  baRecords: defineTable({
    memberId: v.id("users"), // The member who wore the BA
    dateUsed: v.string(), // ISO date string (YYYY-MM-DD)
    durationMinutes: v.number(), // How many minutes the BA was worn (1..480)
    usageType: v.union(
      v.literal("firecall"), // Used during an actual fire call
      v.literal("drill") // Used during training / drill
    ),
    notes: v.string(), // REQUIRED: free-form context (location, incident detail, etc.)
    verifiedBy: v.id("users"), // REQUIRED: member who verifies this use (must differ from memberId)
    submittedBy: v.id("users"), // User who submitted this record (may differ from memberId)
    submittedByServiceAccount: v.optional(v.id("serviceAccounts")), // Service account that submitted it, when applicable
    submittedOnBehalf: v.boolean(), // True if submitted by someone else on behalf of the member
    lmsEnteredAt: v.optional(v.number()), // Timestamp when the record was entered into CFA LMS
    lmsEnteredBy: v.optional(v.id("users")), // Training officer who marked the LMS entry complete
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_member_date", ["memberId", "dateUsed"])
    .index("by_dateUsed", ["dateUsed"])
    .index("by_verifiedBy", ["verifiedBy"])
    .index("by_createdAt", ["createdAt"]),

  // Shortcut tokens table for automating status changes via tools like Apple Shortcuts
  shortcutTokens: defineTable({
    userId: v.id("users"),
    token: v.string(), // Unique secret token
    createdAt: v.number(),
    lastUsedAt: v.optional(v.number()),
  })
    .index("by_token", ["token"])
    .index("by_user", ["userId"]),

  // Message presets - User-defined quick messages for availability messaging
  messagePresets: defineTable({
    userId: v.id("users"),
    message: v.string(), // The preset message text
    order: v.number(), // Display order (0-4)
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_order", ["userId", "order"]),

  // User message preferences - Stores per-user message viewing state
  userMessagePreferences: defineTable({
    userId: v.id("users"),
    lastViewedMessagesAt: v.number(), // Timestamp when user last viewed messages tab
  })
    .index("by_user", ["userId"]),

  // QR Codes - User-generated QR codes for URLs
  qrCodes: defineTable({
    name: v.optional(v.string()), // User-friendly name for the QR code
    url: v.string(), // The URL encoded in the QR code
    svgData: v.string(), // The SVG string for the QR code (vector, scalable)
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_createdBy", ["createdBy"])
    .index("by_createdAt", ["createdAt"]),

  // Service Accounts - Headless accounts for kiosks, displays, integrations, etc.
  serviceAccounts: defineTable({
    name: v.string(), // Display name (e.g., "Station Kiosk", "Display Board")
    description: v.optional(v.string()), // Optional purpose description
    pinHash: v.string(), // SHA-256 hash of the PIN
    isActive: v.boolean(), // Can be deactivated without deletion
    allowedModules: v.array(v.string()), // Array of moduleIds this account can access
    lastLoginAt: v.optional(v.number()), // Timestamp of last successful login
    createdBy: v.id("users"), // Admin who created it
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_isActive", ["isActive"])
    .index("by_pinHash", ["pinHash"]),

  // Service Account Sessions - Session tokens for authenticated service accounts
  serviceAccountSessions: defineTable({
    serviceAccountId: v.id("serviceAccounts"), // Which service account
    tokenHash: v.string(), // SHA-256 hash of the session token
    expiresAt: v.number(), // Session expiry timestamp
    createdAt: v.number(),
  })
    .index("by_tokenHash", ["tokenHash"])
    .index("by_serviceAccountId", ["serviceAccountId"])
    .index("by_expiresAt", ["expiresAt"]),

  // Service Account Login Attempts - Rate limiting for PIN brute-force protection
  serviceAccountLoginAttempts: defineTable({
    ipIdentifier: v.string(), // Hashed identifier (e.g. from header or "unknown")
    attemptedAt: v.number(),
    success: v.boolean(),
  })
    .index("by_ipIdentifier_attemptedAt", ["ipIdentifier", "attemptedAt"])
    .index("by_attemptedAt", ["attemptedAt"]),

  // Maps a brigade-wide condition to accountable people. Read by Role-policy
  // providers and by notifyEvent() when a module reports something happened.
  actionAccountability: defineTable({
    conditionKey: v.string(),
    roles: v.array(v.string()),
    userIds: v.array(v.id("users")),
    minimumRank: v.optional(v.union(
      v.literal("Brigade Member"), v.literal("Probationary"), v.literal("Firefighter"),
      v.literal("Lieutenant"), v.literal("Captain")
    )),
    isEnabled: v.boolean(),
    // Delivery channels for event notices raised against this key. Absent means
    // in-app only, which is what the Role providers reading this table assume.
    notifyInApp: v.optional(v.boolean()),
    notifyEmail: v.optional(v.boolean()),
    updatedAt: v.optional(v.number()),
    updatedBy: v.optional(v.id("users")),
  }).index("by_conditionKey", ["conditionKey"]),

  // Action Centre - "this happened" notices raised by a module via notifyEvent().
  // Unlike derived actions these are stored, because the event they report is a
  // moment in time that nothing can recompute later.
  actionNotices: defineTable({
    moduleId: v.string(),
    conditionKey: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    url: v.string(),
    priority: v.union(v.literal("low"), v.literal("medium"), v.literal("high")),
    recipientUserIds: v.array(v.id("users")),
    // Identifies the thing the notice is about, so a repeat event (a reopened
    // and resubmitted station check) updates the notice instead of stacking.
    sourceEntityId: v.optional(v.string()),
    createdAt: v.number(),
    createdBy: v.optional(v.id("users")),
  })
    .index("by_createdAt", ["createdAt"])
    .index("by_source", ["conditionKey", "sourceEntityId"]),

  // Per-user "I've seen this, stop showing me" record, keyed by the action's
  // stable id string. Works for stored notices and derived actions alike.
  actionDismissals: defineTable({
    userId: v.id("users"),
    actionId: v.string(),
    dismissedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_action", ["userId", "actionId"])
    .index("by_action", ["actionId"]),

  // One row per (member, browser profile): how BRAVO is being opened there.
  // Answers "is this member on the installed app, or still in a phone browser
  // tab and missing notifications?" for the Member Activity admin view. A
  // rolling summary, not an event log: the row is upserted, never appended.
  userLaunches: defineTable({
    userId: v.id("users"),
    // Client-generated id in localStorage; separate per browser profile, and
    // on iOS separate again for the installed app, which is the point.
    deviceId: v.string(),
    // The install-platform detected client-side, e.g. "ios-safari".
    platform: v.string(),
    displayMode: v.union(v.literal("installed"), v.literal("browser")),
    deviceClass: v.union(v.literal("phone"), v.literal("desktop")),
    launchCount: v.number(),
    firstLaunchAt: v.number(),
    lastLaunchAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_device", ["userId", "deviceId"]),

  // A member's reusable shift definition, e.g. "Night 21:00-07:30". Times are
  // Melbourne wall clock "HH:mm"; an end earlier than the start runs overnight.
  // Private to the member: nobody else reads their roster.
  shiftTypes: defineTable({
    userId: v.id("users"),
    name: v.string(),
    startTime: v.string(),
    endTime: v.string(),
    status: plannedStatusValidator,
    // What to switch to when the shift ends; "reset" clears the status.
    afterStatus: nextStatusValidator,
    colour: v.number(), // palette index 0-5
  }).index("by_userId", ["userId"]),

  // One shift stamped on a date. Times and statuses are copied from the type
  // when stamped. Editing the type re-stamps only shifts still pending; applied
  // ones keep what they did. Each pending shift has an applyShift job scheduled
  // at startAt, which does nothing if the row has gone or moved.
  plannedShifts: defineTable({
    userId: v.id("users"),
    // Absent for a one-off shift entered by its times in the week view. May
    // point at a deleted type, so name and colour are copied here.
    shiftTypeId: v.optional(v.id("shiftTypes")),
    name: v.string(),
    colour: v.number(), // palette index 0-5, or -1 for a one-off shift
    status: plannedStatusValidator,
    afterStatus: nextStatusValidator,
    date: v.string(), // "YYYY-MM-DD", the Melbourne date the shift starts on
    startAt: v.number(),
    endAt: v.number(),
    state: v.union(v.literal("pending"), v.literal("applied"), v.literal("skipped")),
  })
    .index("by_userId_and_date", ["userId", "date"])
    .index("by_shiftTypeId_and_state", ["shiftTypeId", "state"])
    .index("by_endAt", ["endAt"]),
};

export default defineSchema({
  ...extendedAuthTables,
  ...applicationTables,
});
