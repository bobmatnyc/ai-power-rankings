/**
 * Analyze Articles Data Quality
 * Identifies test articles, date ranges, and provides cleanup recommendations
 */

import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool, neonConfig } from "@neondatabase/serverless";
import { sql, desc, asc, count, and, or, like, ilike } from "drizzle-orm";
import { articles } from "@/lib/db/article-schema";
import ws from "ws";

// Configure WebSocket for local development
neonConfig.webSocketConstructor = ws;

async function analyzeArticlesData() {
  console.log("🔍 Analyzing articles data quality...\n");

  const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
  const db = drizzle(pool);

  try {
    // 1. Total article count
    const totalCount = await db.select({ count: count() }).from(articles);
    console.log("📊 TOTAL ARTICLES:", totalCount[0].count);
    console.log("─".repeat(80));

    // 2. Get all articles with key fields
    const allArticles = await db
      .select({
        id: articles.id,
        slug: articles.slug,
        title: articles.title,
        ingestionType: articles.ingestionType,
        sourceUrl: articles.sourceUrl,
        sourceName: articles.sourceName,
        fileName: articles.fileName,
        author: articles.author,
        publishedDate: articles.publishedDate,
        createdAt: articles.createdAt,
        ingestedAt: articles.ingestedAt,
        status: articles.status,
        isProcessed: articles.isProcessed,
        toolMentions: articles.toolMentions,
        companyMentions: articles.companyMentions,
        importanceScore: articles.importanceScore,
      })
      .from(articles)
      .orderBy(asc(articles.createdAt));

    console.log("\n📅 DATE RANGE ANALYSIS:");
    console.log("─".repeat(80));

    if (allArticles.length > 0) {
      const dates = allArticles
        .map(a => a.createdAt)
        .filter(d => d !== null)
        .sort();

      console.log("First article:", dates[0]?.toISOString() || "N/A");
      console.log("Last article:", dates[dates.length - 1]?.toISOString() || "N/A");
    }

    // 3. Identify test articles
    console.log("\n🧪 TEST ARTICLES DETECTION:");
    console.log("─".repeat(80));

    const testPatterns = [
      "test", "cache", "sample", "demo", "example",
      "dummy", "placeholder", "mock", "debug", "temp"
    ];

    const testArticles: Array<{
      id: string;
      title: string;
      slug: string;
      reason: string;
      createdAt: Date | null;
      sourceUrl: string | null;
    }> = [];

    for (const article of allArticles) {
      const titleLower = article.title.toLowerCase();
      const slugLower = article.slug.toLowerCase();
      const sourceUrlLower = article.sourceUrl?.toLowerCase() || "";

      // Check for test patterns
      for (const pattern of testPatterns) {
        if (titleLower.includes(pattern) || slugLower.includes(pattern) || sourceUrlLower.includes(pattern)) {
          testArticles.push({
            id: article.id,
            title: article.title,
            slug: article.slug,
            reason: `Contains '${pattern}' in ${titleLower.includes(pattern) ? 'title' : slugLower.includes(pattern) ? 'slug' : 'URL'}`,
            createdAt: article.createdAt,
            sourceUrl: article.sourceUrl,
          });
          break;
        }
      }

      // Check for obviously fake/test URLs
      if (article.sourceUrl?.includes("example.com") ||
          article.sourceUrl?.includes("test.com") ||
          article.sourceUrl?.includes("localhost")) {
        testArticles.push({
          id: article.id,
          title: article.title,
          slug: article.slug,
          reason: "Test/fake URL domain",
          createdAt: article.createdAt,
          sourceUrl: article.sourceUrl,
        });
      }
    }

    // Remove duplicates (in case article matched multiple patterns)
    const uniqueTestArticles = Array.from(
      new Map(testArticles.map(a => [a.id, a])).values()
    );

    console.log(`Found ${uniqueTestArticles.length} potential test articles:\n`);

    if (uniqueTestArticles.length > 0) {
      uniqueTestArticles.forEach((article, idx) => {
        console.log(`${idx + 1}. ID: ${article.id}`);
        console.log(`   Title: "${article.title}"`);
        console.log(`   Slug: "${article.slug}"`);
        console.log(`   Reason: ${article.reason}`);
        console.log(`   Created: ${article.createdAt?.toISOString() || "N/A"}`);
        console.log(`   URL: ${article.sourceUrl || "N/A"}`);
        console.log();
      });
    }

    // 4. Analyze legitimate articles
    const legitimateArticles = allArticles.filter(
      a => !uniqueTestArticles.find(test => test.id === a.id)
    );

    console.log("\n✅ LEGITIMATE ARTICLES:");
    console.log("─".repeat(80));
    console.log(`Count: ${legitimateArticles.length}\n`);

    if (legitimateArticles.length > 0) {
      console.log("Date range:");
      const legitDates = legitimateArticles
        .map(a => a.createdAt)
        .filter(d => d !== null)
        .sort();

      console.log(`  First: ${legitDates[0]?.toISOString() || "N/A"}`);
      console.log(`  Last: ${legitDates[legitDates.length - 1]?.toISOString() || "N/A"}`);

      console.log("\nSample of legitimate articles:");
      legitimateArticles.slice(0, 5).forEach((article, idx) => {
        console.log(`\n${idx + 1}. "${article.title}"`);
        console.log(`   ID: ${article.id}`);
        console.log(`   Slug: ${article.slug}`);
        console.log(`   Created: ${article.createdAt?.toISOString() || "N/A"}`);
        console.log(`   Source: ${article.sourceName || "N/A"}`);
        console.log(`   Processed: ${article.isProcessed ? "Yes" : "No"}`);
      });
    }

    // 5. Status breakdown
    console.log("\n\n📈 STATUS BREAKDOWN:");
    console.log("─".repeat(80));

    const statusCounts = allArticles.reduce((acc, article) => {
      const status = article.status || "unknown";
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`  ${status}: ${count}`);
    });

    // 6. Processing status
    console.log("\n\n⚙️ PROCESSING STATUS:");
    console.log("─".repeat(80));
    const processed = allArticles.filter(a => a.isProcessed).length;
    const unprocessed = allArticles.filter(a => !a.isProcessed).length;
    console.log(`  Processed: ${processed}`);
    console.log(`  Unprocessed: ${unprocessed}`);

    // 7. Ingestion type breakdown
    console.log("\n\n📥 INGESTION TYPE BREAKDOWN:");
    console.log("─".repeat(80));

    const ingestionTypes = allArticles.reduce((acc, article) => {
      const type = article.ingestionType || "unknown";
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    Object.entries(ingestionTypes).forEach(([type, count]) => {
      console.log(`  ${type}: ${count}`);
    });

    // 8. Tool/Company mentions analysis
    console.log("\n\n🔧 CONTENT ANALYSIS:");
    console.log("─".repeat(80));

    const articlesWithToolMentions = allArticles.filter(
      a => a.toolMentions && Array.isArray(a.toolMentions) && a.toolMentions.length > 0
    ).length;

    const articlesWithCompanyMentions = allArticles.filter(
      a => a.companyMentions && Array.isArray(a.companyMentions) && a.companyMentions.length > 0
    ).length;

    console.log(`  Articles with tool mentions: ${articlesWithToolMentions}`);
    console.log(`  Articles with company mentions: ${articlesWithCompanyMentions}`);

    // 9. Recommendations
    console.log("\n\n💡 CLEANUP RECOMMENDATIONS:");
    console.log("─".repeat(80));

    if (uniqueTestArticles.length > 0) {
      console.log("\n🗑️  ARTICLES TO DELETE (Test/Fake Content):");
      console.log("    IDs to delete:");
      uniqueTestArticles.forEach(article => {
        console.log(`    - ${article.id}  # ${article.title}`);
      });

      console.log("\n    SQL Command:");
      console.log("    ```sql");
      console.log("    DELETE FROM articles WHERE id IN (");
      uniqueTestArticles.forEach((article, idx) => {
        const comma = idx < uniqueTestArticles.length - 1 ? "," : "";
        console.log(`      '${article.id}'${comma}`);
      });
      console.log("    );");
      console.log("    ```");
    } else {
      console.log("\n✅ No obvious test articles detected!");
    }

    if (legitimateArticles.length > 0) {
      console.log("\n\n✅ ARTICLES TO KEEP (Legitimate Content):");
      console.log(`    Total: ${legitimateArticles.length} articles`);

      const unprocessedLegit = legitimateArticles.filter(a => !a.isProcessed);
      if (unprocessedLegit.length > 0) {
        console.log(`\n    ⚠️  ${unprocessedLegit.length} legitimate articles are unprocessed`);
        console.log("    Consider processing these articles:");
        unprocessedLegit.slice(0, 3).forEach(article => {
          console.log(`    - ${article.id}: "${article.title}"`);
        });
      }
    }

    // 10. Data quality issues
    console.log("\n\n⚠️  DATA QUALITY ISSUES:");
    console.log("─".repeat(80));

    const issues: string[] = [];

    const noPublishedDate = allArticles.filter(a => !a.publishedDate).length;
    if (noPublishedDate > 0) {
      issues.push(`${noPublishedDate} articles missing published_date`);
    }

    const noAuthor = allArticles.filter(a => !a.author).length;
    if (noAuthor > 0) {
      issues.push(`${noAuthor} articles missing author`);
    }

    const noSource = allArticles.filter(a => !a.sourceUrl && !a.sourceName).length;
    if (noSource > 0) {
      issues.push(`${noSource} articles missing source information`);
    }

    if (issues.length > 0) {
      issues.forEach(issue => console.log(`  - ${issue}`));
    } else {
      console.log("  ✅ No major data quality issues detected");
    }

    console.log("\n" + "═".repeat(80));
    console.log("✅ Analysis complete!");
    console.log("═".repeat(80));

  } catch (error) {
    console.error("❌ Error analyzing articles:", error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the analysis
analyzeArticlesData().catch(console.error);
