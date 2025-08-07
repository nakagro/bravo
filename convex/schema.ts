import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

// We need to keep all the original auth fields and add our custom ones
const extendedAuthTables = {
  ...authTables,
  users: defineTable({
    // Fields from the original auth tables
    tokenIdentifier: v.optional(v.string()),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    isAnonymous: v.optional(v.boolean()), // Required by auth system
    // New fields (all optional for backward compatibility)
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    memberNumber: v.optional(v.string()), // CFA ID
    // Rank field - a user can have only one rank
    rank: v.optional(v.union(
      v.literal("Probationary"),
      v.literal("Firefighter"),
      v.literal("Lieutenant"),
      v.literal("Captain")
    )),
    // Roles field - a user can have multiple roles
    roles: v.optional(v.array(v.string())),
    // Skills field - array of skill IDs that the user has
    skills: v.optional(v.array(v.id("skills"))),
    // Admin flag - determines if the user has administrative privileges
    isAdmin: v.optional(v.boolean()),
    // Status fields
    currentStatus: v.optional(v.union(
      v.literal("available - station"),
      v.literal("available - satellite"),
      v.literal("not available"),
      v.literal("delayed response"),
      v.literal("WFH")
    )),
    statusUpdatedAt: v.optional(v.number()),
    // Duration-based status fields
    statusExpiresAt: v.optional(v.number()), // Timestamp when status expires (null = no expiration)
    statusDurationHours: v.optional(v.number()), // Original duration in hours for display
    // Auto-transition fields
    nextStatus: v.optional(v.union(
      v.literal("available - station"),
      v.literal("available - satellite"),
      v.literal("not available"),
      v.literal("delayed response"),
      v.literal("WFH"),
      v.literal("reset") // Special value meaning "clear status" (daily reset behavior)
    )), // Status to transition to after duration expires
    nextStatusAt: v.optional(v.number()), // Timestamp when to transition to next status
    isDutyOfficer: v.optional(v.boolean()),
  })
};

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
      v.literal("Probationary"),
      v.literal("Firefighter"),
      v.literal("Lieutenant"),
      v.literal("Captain")
    )),
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
      v.literal("available - satellite"),
      v.literal("not available"),
      v.literal("delayed response"),
      v.literal("WFH")
    ),
    timestamp: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_timestamp", ["timestamp"]),
    
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
    isActive: v.boolean(), // Whether this check is currently active
    order: v.number(), // Order in which the check should appear in the list
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_isActive", ["isActive"])
    .index("by_order", ["order"]),
    
  // Station Check Submissions table to record completed checklists
  stationCheckSubmissions: defineTable({
    date: v.number(), // Timestamp for the date of submission (usually a Sunday)
    dutyCrewId: v.id("dutyCrew"), // Reference to the duty crew that completed the checks
    completedBy: v.id("users"), // User who submitted the completed checklist
    completedAt: v.number(), // Timestamp when the checklist was submitted
    status: v.union(
      v.literal("draft"), // Draft/in-progress submission
      v.literal("completed") // Finalized submission
    ),
    lastUpdatedBy: v.optional(v.id("users")), // User who last updated the checklist
    lastUpdatedAt: v.optional(v.number()), // Timestamp of the last update
    checkItems: v.array(
      v.object({
        checkId: v.id("stationChecks"), // Reference to the check item
        name: v.string(), // Name of the check at the time of submission (in case it changes later)
        isCompleted: v.boolean(), // Whether this specific check was completed
        notes: v.optional(v.string()), // Optional notes for this specific check
        completedBy: v.optional(v.id("users")), // User who completed this specific check
        completedAt: v.optional(v.number()), // Timestamp when this specific check was completed
      })
    ),
    notes: v.optional(v.string()), // Optional general notes for the entire submission
  })
    .index("by_date", ["date"])
    .index("by_dutyCrew", ["dutyCrewId"])
    .index("by_completedBy", ["completedBy"])
    .index("by_status", ["status"]),
  
  // Push subscriptions for web push notifications
  pushSubscriptions: defineTable({
    userId: v.id("users"),
    subscription: v.any(), // Raw PushSubscription JSON object
    createdAt: v.number(),
  })
    .index("by_user", ["userId"]),

  // Fire Reports - Comprehensive incident reporting system
  // Appliance locations table to track where each appliance is stationed
  applianceLocations: defineTable({
    applianceName: v.union(
      v.literal("Pumper"),
      v.literal("Tanker"),
      v.literal("FCV")
    ),
    stationLocation: v.union(
      v.literal("Main Station"),
      v.literal("Satellite Station")
    ),
    updatedBy: v.id("users"),
    updatedAt: v.number(),
  }),

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
};

export default defineSchema({
  ...extendedAuthTables,
  ...applicationTables,
});
