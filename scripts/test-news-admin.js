#!/usr/bin/env node

/**
 * Test script for admin news analysis functionality
 */

async function testNewsAnalysis() {
  const baseUrl = "http://localhost:3000";

  console.log("🧪 Testing News Analysis API...\n");

  try {
    // Test with text input
    console.log("📝 Testing with text input...");
    const textResponse = await fetch(`${baseUrl}/api/admin/news/analyze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: `OpenAI announces GPT-5, their most advanced AI model yet. 
                The new model shows significant improvements in reasoning and multimodal capabilities.
                Industry experts predict this will revolutionize AI applications across various sectors.`,
        type: "text",
      }),
    });

    console.log("Response status:", textResponse.status);
    const textResult = await textResponse.json();

    if (textResponse.ok) {
      console.log("✅ Text analysis successful!");
      console.log("Analysis details:");
      console.log("- Title:", textResult.analysis?.title);
      console.log("- Tool mentions:", textResult.analysis?.tool_mentions?.length || 0);
      console.log("- Overall sentiment:", textResult.analysis?.overall_sentiment);
      console.log("- Importance score:", textResult.analysis?.importance_score);
      console.log("- Using fallback?", textResult.warning ? "Yes" : "No");

      if (textResult.warning) {
        console.log("⚠️ Warning:", textResult.warning);
      }
    } else {
      console.log("❌ Text analysis failed!");
      console.log("Error:", textResult.error);
      if (textResult.type) {
        console.log("Error type:", textResult.type);
      }
      if (textResult.solution) {
        console.log("Solution:", textResult.solution);
      }
    }

    console.log(`\n${"=".repeat(60)}\n`);

    // Test OpenRouter availability
    console.log("🔑 Checking OpenRouter configuration...");
    const hasOpenRouterKey = process.env.OPENROUTER_API_KEY ? "Yes" : "No (checking server-side)";
    console.log("- OPENROUTER_API_KEY configured:", hasOpenRouterKey);

    // Try a simpler test
    console.log("\n📊 Testing with minimal input...");
    const minimalResponse = await fetch(`${baseUrl}/api/admin/news/analyze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: "AI news",
        type: "text",
      }),
    });

    const minimalResult = await minimalResponse.json();
    console.log("Minimal test status:", minimalResponse.status);

    if (minimalResponse.ok) {
      console.log("✅ Minimal analysis successful");
      console.log("- Fallback used?", minimalResult.warning ? "Yes" : "No");
    } else {
      console.log("❌ Minimal analysis failed");
      console.log("- Error:", minimalResult.error);
    }
  } catch (error) {
    console.error("❌ Test failed with error:", error.message);
    console.error("Stack:", error.stack);
  }
}

// Run the test
testNewsAnalysis()
  .then(() => {
    console.log("\n✅ Test completed");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Test failed:", error);
    process.exit(1);
  });
