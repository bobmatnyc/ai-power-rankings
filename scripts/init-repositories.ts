import { initializeRepositories } from "../src/lib/json-db";

async function main() {
  console.log("🚀 Initializing repositories...");
  try {
    await initializeRepositories();
    console.log("✅ All repositories initialized successfully!");
  } catch (error) {
    console.error("❌ Failed to initialize repositories:", error);
    process.exit(1);
  }
}

main();