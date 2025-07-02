import { payloadDirect } from "../lib/payload-direct";
import { loggers } from "../lib/logger";

async function analyzeNewsIngestion() {
  try {
    console.log("=== Analyzing News Ingestion Issue ===\n");

    // 1. Check which tools exist
    const toolSlugs = [
      "gemini",
      "github-copilot",
      "llama",
      "v0",
      "mistral",
      "chatgpt",
      "midjourney",
      "grok",
    ];

    console.log("1. Checking for existing tools:");
    const existingTools = new Map<string, { id: string; name: string; slug: string }>();

    for (const slug of toolSlugs) {
      try {
        const { docs } = await payloadDirect.getTools({
          where: { slug: { equals: slug } },
          limit: 1,
        });

        if (docs.length > 0) {
          existingTools.set(slug, docs[0]);
          console.log(`   ✓ ${slug} - EXISTS (ID: ${docs[0].id})`);
        } else {
          console.log(`   ✗ ${slug} - NOT FOUND`);
        }
      } catch (error) {
        console.log(`   ✗ ${slug} - ERROR: ${error}`);
      }
    }

    // 2. Check pending tools
    console.log("\n2. Checking pending tools:");
    const { docs: pendingTools } = await payloadDirect.getPendingTools({
      limit: 100,
      sort: "-createdAt",
    });

    console.log(`   Total pending tools: ${pendingTools.length}`);

    const pendingFromNews = pendingTools.filter((tool) => tool.created_from === "news");
    console.log(`   Pending tools from news: ${pendingFromNews.length}`);

    if (pendingFromNews.length > 0) {
      console.log("\n   Recent pending tools from news:");
      pendingFromNews.slice(0, 10).forEach((tool) => {
        console.log(`   - ${tool.name} (${tool.slug}) - Status: ${tool.status}`);
      });
    }

    // 3. Check recent news items
    console.log("\n3. Checking recent news items:");
    const { docs: newsItems } = await payloadDirect.getNews({
      limit: 10,
      sort: "-createdAt",
    });

    console.log(`   Total news items found: ${newsItems.length}`);

    if (newsItems.length > 0) {
      console.log("\n   Recent news items:");
      newsItems.forEach((news) => {
        const relatedToolsCount = news.related_tools?.length || 0;
        const primaryTool = news.primary_tool ? "Yes" : "No";
        console.log(
          `   - ${news.title?.substring(0, 50)}... | Related tools: ${relatedToolsCount} | Primary tool: ${primaryTool}`
        );
      });
    }

    // 4. Check for duplicate URLs
    console.log("\n4. Checking for duplicate news URLs:");
    const sampleUrls = [
      "https://indianexpress.com/article/technology/artificial-intelligence/google-scheduled-actions-gemini-tasks-automate-10083038/",
      "https://blockchain.news/news/github-copilot-plans-deprecate-ai-models-2025",
    ];

    for (const url of sampleUrls) {
      const { docs } = await payloadDirect.getNews({
        where: { url: { equals: url } },
        limit: 1,
      });

      if (docs.length > 0) {
        console.log(`   ✓ URL already exists: ${url.substring(0, 50)}...`);
      } else {
        console.log(`   ✗ URL not found: ${url.substring(0, 50)}...`);
      }
    }

    // 5. Analysis summary
    console.log("\n=== ANALYSIS SUMMARY ===");
    console.log("\nProbable reasons for only 1/10 news items being processed:");

    if (existingTools.size === 0) {
      console.log("1. ❗ No tools exist in the database - all tools will create pending tools");
      console.log("   - News items won't have related_tools or primary_tool relationships");
      console.log("   - This might cause validation errors if relationships are required");
    } else {
      console.log(`1. ${existingTools.size}/${toolSlugs.length} tools exist in the database`);
    }

    console.log("\n2. Check the news ingestion logs for specific errors:");
    console.log("   - Date parsing errors (published_at field)");
    console.log("   - Missing required fields");
    console.log("   - Validation errors on relationships");

    console.log("\n3. Recommendations:");
    console.log("   - Create the missing tools first, or");
    console.log("   - Make related_tools and primary_tool optional in the News collection");
    console.log("   - Check if there are validation rules preventing news creation");
  } catch (error) {
    console.error("Error analyzing news ingestion:", error);
    loggers.api.error("Script error:", error);
  }
}

// Run the analysis
analyzeNewsIngestion().catch(console.error);
