#!/usr/bin/env npx tsx

// Test script to simulate browser fetch

async function testBrowserFetch() {
  console.log("Testing browser-like fetch to admin articles API...\n");

  try {
    const response = await fetch("http://localhost:3001/api/admin/articles?includeStats=true", {
      method: "GET",
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    });

    console.log("Response status:", response.status);
    console.log("Response ok:", response.ok);

    if (response.ok) {
      const data = await response.json();
      console.log("\n✅ SUCCESS - API Response:");
      console.log("- Articles received:", data.articles?.length || 0);
      console.log("- Total articles (stats):", data.stats?.totalArticles || 0);
      console.log("- First article:", data.articles?.[0]?.title || "N/A");

      if (data.articles?.length > 0) {
        console.log("\n✅ Articles are loading correctly from the API");
        console.log("The issue must be in the React component state management or rendering");
      }
    } else {
      const errorText = await response.text();
      console.log("\n❌ ERROR Response:", errorText);
    }
  } catch (error) {
    console.error("\n❌ Fetch error:", error);
  }
}

testBrowserFetch().catch(console.error);
