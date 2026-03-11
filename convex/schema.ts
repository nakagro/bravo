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
    // Birthday flag - used for UI celebration
    isBirthday: v.optional(v.boolean()),
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

  // Vehicle Faults table for tracking appliance issues
  vehicleFaults: defineTable({
    dateReported: v.number(), // Timestamp when the fault was first reported
    dateLogged: v.optional(v.number()), // Timestamp when the fault was logged into CFA system
    vehicle: v.union(
      v.literal("Pumper"),
      v.literal("Tanker"),
      v.literal("FCV")
    ),
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
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
    updatedBy: v.id("users"),
    // For future extensibility without schema changes
    metadata: v.optional(v.any()),
  })
    .index("by_name", ["name"])
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
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_resource", ["resourceId"])
    .index("by_requestedBy", ["requestedBy"])
    .index("by_status", ["status"])
    .index("by_createdAt", ["createdAt"])
    .index("by_startDate", ["startDate"])
    .index("by_resource_startDate", ["resourceId", "startDate"]),

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

  // BA Skills Maintenance - Track BA cylinder usage for skills maintenance
  baSkillsRecords: defineTable({
    memberId: v.id("users"), // The member who wore the BA
    dateUsed: v.string(), // ISO date string (YYYY-MM-DD)
    durationMinutes: v.number(), // How many minutes the BA was worn
    usageType: v.union(
      v.literal("firecall"), // Used during a fire call
      v.literal("drill") // Used during training/drill
    ),
    location: v.string(), // Location/details of where BA was used
    verifiedBy: v.optional(v.id("users")), // Member who can verify this use
    submittedBy: v.id("users"), // User who submitted this record (may differ from memberId)
    submittedOnBehalf: v.boolean(), // True if submitted by someone else on behalf of the member
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_member", ["memberId"])
    .index("by_dateUsed", ["dateUsed"])
    .index("by_usageType", ["usageType"])
    .index("by_submittedBy", ["submittedBy"])
    .index("by_verifiedBy", ["verifiedBy"])
    .index("by_createdAt", ["createdAt"]),

  // Brigade Tasks - Task/Todo tracking for brigade management
  brigadeTasks: defineTable({
    title: v.string(), // Task title
    description: v.optional(v.string()), // Detailed description
    status: v.union(
      v.literal("active"), // Active task (default)
      v.literal("completed"), // Done
      v.literal("cancelled") // No longer needed
    ),
    dueDate: v.optional(v.string()), // ISO date string (YYYY-MM-DD)
    assignedTo: v.id("users"), // User the task is assigned to
    createdBy: v.id("users"), // User who created the task
    completedAt: v.optional(v.number()), // Timestamp when marked complete
    completedBy: v.optional(v.id("users")), // User who marked it complete
    createdAt: v.number(),
    updatedAt: v.number(),
    updatedBy: v.id("users"),
  })
    .index("by_assignedTo", ["assignedTo"])
    .index("by_createdBy", ["createdBy"])
    .index("by_status", ["status"])
    .index("by_dueDate", ["dueDate"])
    .index("by_createdAt", ["createdAt"])
    .index("by_assignedTo_status", ["assignedTo", "status"]),

  // Brigade Task Comments - Comments on tasks
  brigadeTaskComments: defineTable({
    taskId: v.id("brigadeTasks"), // The task this comment belongs to
    content: v.string(), // Comment text
    createdBy: v.id("users"), // User who wrote the comment
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  })
    .index("by_taskId", ["taskId"])
    .index("by_createdBy", ["createdBy"]),

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
};

export default defineSchema({
  ...extendedAuthTables,
  ...applicationTables,
});
