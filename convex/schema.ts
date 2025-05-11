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
  })
};

const applicationTables = {
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
};

export default defineSchema({
  ...extendedAuthTables,
  ...applicationTables,
});
