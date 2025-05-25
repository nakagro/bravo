import { ConvexClient } from "convex/browser";
import { api } from "../convex/_generated/api";

// This script seeds the initial skills data in the Convex database

async function main() {
  console.log("Seeding initial skills data...");
  
  // Create a Convex client - default to local Docker URL
  const client = new ConvexClient(process.env.CONVEX_URL || "https://convex.grayhux.io");
  
  try {
    // Seed the initial skills
    const result = await client.mutation(api.skills.seedInitialSkills, {});
    console.log("Seeding result:", result);
    console.log("Skills seeding completed successfully!");
  } catch (error) {
    console.error("Error seeding skills:", error);
  } finally {
    // Disconnect the client
    client.close();
  }
}

main().catch(console.error);
