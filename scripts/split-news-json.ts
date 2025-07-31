#!/usr/bin/env tsx
import fs from "node:fs/promises";
import path from "node:path";

interface NewsArticle {
  id: string;
  slug: string;
  title: string;
  content?: string;
  summary?: string;
  source: string;
  source_url: string;
  author?: string;
  tags?: string[];
  tool_mentions?: string[];
  created_at: string;
  updated_at: string;
  date: string;
  published_date?: string;
  metadata?: any;
  impact_assessment?: any;
}

interface NewsData {
  articles: NewsArticle[];
  metadata?: any;
  newsById?: Record<string, NewsArticle>;
  newsBySlug?: Record<string, NewsArticle>;
}

interface MonthlyIndex {
  months: Array<{
    month: string;
    articleCount: number;
    filename: string;
  }>;
  totalArticles: number;
  lastUpdated: string;
}

async function splitNewsJson() {
  console.log("📰 Starting news.json split process...");

  const newsJsonPath = path.join(process.cwd(), "data/json/news/news.json");
  const byMonthDir = path.join(process.cwd(), "data/json/news/by-month");

  try {
    // Create by-month directory if it doesn't exist
    await fs.mkdir(byMonthDir, { recursive: true });
    console.log("✅ Created by-month directory");

    // Read the large news.json file
    console.log("📖 Reading news.json file...");
    const newsContent = await fs.readFile(newsJsonPath, "utf-8");
    const newsData: NewsData = JSON.parse(newsContent);

    // Group articles by month
    const articlesByMonth = new Map<string, NewsArticle[]>();
    const newsById = new Map<string, NewsArticle>();
    const newsBySlug = new Map<string, NewsArticle>();

    // Process articles array if it exists
    if (newsData.articles && Array.isArray(newsData.articles)) {
      console.log(`📊 Processing ${newsData.articles.length} articles from articles array...`);

      for (const article of newsData.articles) {
        const date = new Date(article.date || article.published_date || article.created_at);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

        if (!articlesByMonth.has(monthKey)) {
          articlesByMonth.set(monthKey, []);
        }
        articlesByMonth.get(monthKey)?.push(article);

        newsById.set(article.id, article);
        newsBySlug.set(article.slug, article);
      }
    }

    // Process newsById object if it exists
    if (newsData.newsById && typeof newsData.newsById === "object") {
      console.log("📊 Processing articles from newsById object...");

      for (const [id, article] of Object.entries(newsData.newsById)) {
        // Skip if we already processed this article from the array
        if (newsById.has(id)) continue;

        const date = new Date(article.date || article.published_date || article.created_at);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

        if (!articlesByMonth.has(monthKey)) {
          articlesByMonth.set(monthKey, []);
        }
        articlesByMonth.get(monthKey)?.push(article);

        newsById.set(article.id, article);
        newsBySlug.set(article.slug, article);
      }
    }

    // Process newsBySlug object if it exists
    if (newsData.newsBySlug && typeof newsData.newsBySlug === "object") {
      console.log("📊 Processing articles from newsBySlug object...");

      for (const [slug, article] of Object.entries(newsData.newsBySlug)) {
        // Skip if we already processed this article
        if (newsById.has(article.id)) continue;

        const date = new Date(article.date || article.published_date || article.created_at);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

        if (!articlesByMonth.has(monthKey)) {
          articlesByMonth.set(monthKey, []);
        }
        articlesByMonth.get(monthKey)?.push(article);

        newsById.set(article.id, article);
        newsBySlug.set(article.slug, article);
      }
    }

    // Sort months
    const sortedMonths = Array.from(articlesByMonth.keys()).sort();
    console.log(`📅 Found ${sortedMonths.length} months of data`);

    // Create index structure
    const index: MonthlyIndex = {
      months: [],
      totalArticles: 0,
      lastUpdated: new Date().toISOString(),
    };

    // Write monthly files
    for (const month of sortedMonths) {
      const articles = articlesByMonth.get(month)!;
      const filename = `${month}.json`;
      const filepath = path.join(byMonthDir, filename);

      // Sort articles by date within each month
      articles.sort((a, b) => {
        const dateA = new Date(a.date || a.published_date || a.created_at);
        const dateB = new Date(b.date || b.published_date || b.created_at);
        return dateB.getTime() - dateA.getTime(); // Newest first
      });

      // Create monthly data structure with both formats for compatibility
      const monthlyData = {
        articles: articles,
        newsById: Object.fromEntries(articles.map((article) => [article.id, article])),
        newsBySlug: Object.fromEntries(articles.map((article) => [article.slug, article])),
        metadata: {
          month: month,
          articleCount: articles.length,
          generatedAt: new Date().toISOString(),
        },
      };

      await fs.writeFile(filepath, JSON.stringify(monthlyData, null, 2));
      console.log(`✅ Created ${filename} with ${articles.length} articles`);

      // Add to index
      index.months.push({
        month: month,
        articleCount: articles.length,
        filename: filename,
      });
      index.totalArticles += articles.length;
    }

    // Sort index months in descending order (newest first)
    index.months.sort((a, b) => b.month.localeCompare(a.month));

    // Write index file
    const indexPath = path.join(byMonthDir, "index.json");
    await fs.writeFile(indexPath, JSON.stringify(index, null, 2));
    console.log("✅ Created index.json");

    console.log("\n📊 Summary:");
    console.log(`   Total articles: ${index.totalArticles}`);
    console.log(`   Total months: ${index.months.length}`);
    console.log(`   Date range: ${sortedMonths[0]} to ${sortedMonths[sortedMonths.length - 1]}`);

    // Create a combined file that matches the structure of the original news.json
    const combinedData = {
      articles: Array.from(newsById.values()).sort((a, b) => {
        const dateA = new Date(a.date || a.published_date || a.created_at);
        const dateB = new Date(b.date || b.published_date || b.created_at);
        return dateB.getTime() - dateA.getTime();
      }),
      newsById: Object.fromEntries(newsById),
      newsBySlug: Object.fromEntries(newsBySlug),
      metadata: newsData.metadata || {
        lastUpdated: new Date().toISOString(),
        totalArticles: index.totalArticles,
      },
    };

    // Backup original news.json
    const backupPath = `${newsJsonPath}.backup-${new Date().toISOString().replace(/:/g, "-")}`;
    await fs.copyFile(newsJsonPath, backupPath);
    console.log(`\n📦 Backed up original to: ${path.basename(backupPath)}`);

    // Write updated news.json (without duplicates and with fixed URLs)
    await fs.writeFile(newsJsonPath, JSON.stringify(combinedData, null, 2));
    console.log("✅ Updated news.json with cleaned data");

    console.log("\n✨ News split completed successfully!");
  } catch (error) {
    console.error("❌ Error splitting news.json:", error);
    process.exit(1);
  }
}

// Run the script
splitNewsJson();
