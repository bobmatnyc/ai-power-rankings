#!/usr/bin/env tsx
/**
 * Test the articles API directly to debug the issue
 */

import { ArticlesRepository } from "../src/lib/db/repositories/articles.repository";

async function testAPI() {
  try {
    const articlesRepo = new ArticlesRepository();

    console.log("Testing ArticlesRepository.getArticles() with status='active':");
    const activeArticles = await articlesRepo.getArticles({
      status: "active",
      limit: 50,
      offset: 0,
    });

    console.log(`Found ${activeArticles.length} active articles`);

    if (activeArticles.length > 0) {
      console.log("\nFirst 3 articles:");
      activeArticles.slice(0, 3).forEach((a) => {
        console.log(`- ${a.title} (id: ${a.id}, status: ${a.status})`);
      });
    }

    // Also test without status filter
    console.log("\nTesting without status filter:");
    const allArticles = await articlesRepo.getArticles({
      limit: 50,
      offset: 0,
    });

    console.log(`Found ${allArticles.length} total articles (no status filter)`);
  } catch (error) {
    console.error("Error:", error);
  }

  process.exit(0);
}

testAPI();
