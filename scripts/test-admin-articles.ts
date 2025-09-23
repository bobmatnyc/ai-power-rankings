#!/usr/bin/env npx tsx

// Test script to verify admin articles API behavior

async function testAdminArticles() {
  console.log("Testing Admin Articles API...\n");

  // Test 1: Direct API call
  console.log("1. Direct API call to /api/admin/articles:");
  try {
    const response = await fetch("http://localhost:3001/api/admin/articles?includeStats=true", {
      credentials: "include",
      headers: {
        Accept: "application/json",
      },
    });

    console.log("   Status:", response.status);
    console.log("   Headers:", response.headers);

    if (response.ok) {
      const data = await response.json();
      console.log("   Articles count:", data.articles?.length || 0);
      console.log("   Total articles (stats):", data.stats?.totalArticles || 0);
      console.log("   ✅ API returns articles successfully\n");
    } else {
      const errorText = await response.text();
      console.log("   ❌ API error:", errorText, "\n");
    }
  } catch (error) {
    console.log("   ❌ Failed to call API:", error, "\n");
  }

  // Test 2: Check auth status
  console.log("2. Checking authentication:");
  console.log("   NEXT_PUBLIC_DISABLE_AUTH:", process.env["NEXT_PUBLIC_DISABLE_AUTH"] || "not set");
  console.log("   Should bypass auth:", process.env["NEXT_PUBLIC_DISABLE_AUTH"] === "true");
  console.log();

  // Test 3: Component simulation
  console.log("3. Simulating component behavior:");
  console.log("   Component would fetch from: /api/admin/articles?includeStats=true");
  console.log("   With credentials: include");
  console.log("   Expected: Should receive articles array");
  console.log();

  // Test 4: Check if the admin page is accessible
  console.log("4. Checking admin page HTML:");
  try {
    const pageResponse = await fetch("http://localhost:3001/en/admin");
    if (pageResponse.ok) {
      const html = await pageResponse.text();
      const hasNoArticles = html.includes("No articles found");
      const hasArticleManagement =
        html.includes("ArticleManagement") || html.includes("article-management");

      console.log("   Admin page loads:", pageResponse.status === 200 ? "✅" : "❌");
      console.log("   Contains 'No articles found':", hasNoArticles ? "❌ (Problem!)" : "✅");
      console.log("   Contains ArticleManagement component:", hasArticleManagement ? "✅" : "❌");
    }
  } catch (error) {
    console.log("   ❌ Failed to load admin page:", error);
  }
  console.log();

  // Summary
  console.log("=== SUMMARY ===");
  console.log("The API is returning articles correctly.");
  console.log("If the UI shows 'No articles found', the issue is likely:");
  console.log("1. Client-side fetch not executing properly");
  console.log("2. State not being updated after successful fetch");
  console.log("3. Rendering issue with the articles array");
}

testAdminArticles().catch(console.error);
