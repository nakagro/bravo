import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { getAuthUserId } from "@convex-dev/auth/server";

/**
 * Get all skills from the system
 */
export const getSkills = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("skills")
      .filter((q) => q.eq(q.field("isActive"), true))
      .order("asc")
      .collect();
  },
});

/**
 * Ensure the special "None" skill exists (code: "NONE").
 * Idempotent: returns the existing or newly created skill ID.
 */
export const ensureNoneSkill = mutation({
  args: {},
  returns: v.id("skills"),
  handler: async (ctx) => {
    const existing = await ctx.db
      .query("skills")
      .withIndex("by_code", (q) => q.eq("code", "NONE"))
      .first();
    if (existing) return existing._id;

    const now = Date.now();
    const id = await ctx.db.insert("skills", {
      name: "None",
      code: "NONE",
      description: "No operational skills yet",
      category: "System",
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
    return id;
  },
});

/**
 * Get skills for a specific user
 */
export const getUserSkills = query({
  args: {
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    // If userId is provided, use it; otherwise, get the current user's ID
    const userId = args.userId || await getAuthUserId(ctx);
    
    if (!userId) {
      return [];
    }
    
    // Get the user
    const user = await ctx.db.get(userId);
    if (!user || !user.skills || user.skills.length === 0) {
      return [];
    }
    
    // Get all skills for the user
    const skills = [];
    for (const skillId of user.skills) {
      const skill = await ctx.db.get(skillId);
      if (skill) {
        skills.push(skill);
      }
    }
    
    return skills;
  },
});

/**
 * Add a skill to the current user
 */
export const addSkillToUser = mutation({
  args: {
    skillId: v.id("skills"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("You must be signed in to update your skills");
    }
    
    // Get the user
    const user = await ctx.db.get(userId);
    if (!user) {
      throw new Error("User not found");
    }
    
    // Get the skill to ensure it exists
    const skill = await ctx.db.get(args.skillId);
    if (!skill) {
      throw new Error("Skill not found");
    }
    
    // Check if the user already has this skill
    const userSkills = user.skills || [];
    if (userSkills.some(id => id === args.skillId)) {
      // User already has this skill, no need to add it again
      return userId;
    }
    
    // Add the skill to the user
    await ctx.db.patch(userId, {
      skills: [...userSkills, args.skillId],
    });
    
    return userId;
  },
});

/**
 * Remove a skill from the current user
 */
export const removeSkillFromUser = mutation({
  args: {
    skillId: v.id("skills"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("You must be signed in to update your skills");
    }
    
    // Get the user
    const user = await ctx.db.get(userId);
    if (!user) {
      throw new Error("User not found");
    }
    
    // Check if the user has this skill
    const userSkills = user.skills || [];
    if (!userSkills.some(id => id === args.skillId)) {
      // User doesn't have this skill, nothing to remove
      return userId;
    }
    
    // Remove the skill from the user
    await ctx.db.patch(userId, {
      skills: userSkills.filter(id => id !== args.skillId),
    });
    
    return userId;
  },
});

/**
 * Create a new skill
 */
export const createSkill = mutation({
  args: {
    name: v.string(),
    code: v.string(),
    description: v.optional(v.string()),
    category: v.optional(v.string()),
  },
  returns: v.id("skills"),
  handler: async (ctx, args) => {
    const { name, code, description, category } = args;
    
    // Check if skill with the same code already exists
    const existingSkill = await ctx.db
      .query("skills")
      .withIndex("by_code", (q) => q.eq("code", code))
      .first();
      
    if (existingSkill) {
      throw new Error(`Skill with code "${code}" already exists`);
    }
    
    const skillId = await ctx.db.insert("skills", {
      name,
      code,
      description,
      category,
      isActive: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    
    return skillId;
  },
});

/**
 * Update an existing skill
 */
export const updateSkill = mutation({
  args: {
    skillId: v.id("skills"),
    name: v.optional(v.string()),
    code: v.optional(v.string()),
    description: v.optional(v.string()),
    category: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  returns: v.id("skills"),
  handler: async (ctx, args) => {
    const { skillId, ...updates } = args;
    
    // Verify the skill exists
    const skill = await ctx.db.get(skillId);
    if (!skill) {
      throw new Error(`Skill with ID ${skillId} not found`);
    }
    
    // Update the skill
    await ctx.db.patch(skillId, {
      ...updates,
      updatedAt: Date.now(),
    });
    
    return skillId;
  },
});

/**
 * Delete a skill
 */
export const deleteSkill = mutation({
  args: {
    skillId: v.id("skills"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { skillId } = args;
    
    // Verify the skill exists
    const skill = await ctx.db.get(skillId);
    if (!skill) {
      throw new Error(`Skill with ID ${skillId} not found`);
    }
    
    // Delete the skill
    await ctx.db.delete(skillId);
    
    return null;
  },
});

/**
 * Seed initial skills
 * This is a utility function to populate the database with initial skills
 */
export const seedInitialSkills = mutation({
  args: {},
  handler: async (ctx) => {
    const initialSkills = [
      // Special system skill indicating no operational skills
      { name: "None", code: "NONE" },
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
    ];
    
    // Check if skills already exist
    const existingSkills = await ctx.db.query("skills").collect();
    if (existingSkills.length > 0) {
      return { message: "Skills already seeded", count: existingSkills.length };
    }
    
    // Insert all skills
    const now = Date.now();
    for (const skill of initialSkills) {
      await ctx.db.insert("skills", {
        name: skill.name,
        code: skill.code,
        description: undefined,
        category: undefined,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
    }
    
    return { message: "Successfully seeded initial skills", count: initialSkills.length };
  },
});
