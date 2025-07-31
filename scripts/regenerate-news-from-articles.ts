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

async function regenerateNewsFromArticles() {
  console.log("🔄 Regenerating news data from articles...");

  const articlesDir = path.join(process.cwd(), "data/json/news/articles");
  const byMonthDir = path.join(process.cwd(), "data/json/news/by-month");
  const newsJsonPath = path.join(process.cwd(), "data/json/news/news.json");

  try {
    // Create by-month directory if it doesn't exist
    await fs.mkdir(byMonthDir, { recursive: true });

    // Read all article files
    const articleFiles = await fs.readdir(articlesDir);
    const jsonFiles = articleFiles.filter((f) => f.endsWith(".json") && f !== "index.json");

    console.log(`📁 Found ${jsonFiles.length} article files`);

    const allArticles: NewsArticle[] = [];
    const articlesByMonth = new Map<string, NewsArticle[]>();

    // Process each article file
    for (const file of jsonFiles) {
      if (file.includes("backup")) continue; // Skip backup files

      const filepath = path.join(articlesDir, file);
      const content = await fs.readFile(filepath, "utf-8");
      const articles: NewsArticle[] = JSON.parse(content);

      console.log(`📖 Processing ${file}: ${articles.length} articles`);

      for (const article of articles) {
        allArticles.push(article);

        // Extract month from filename (e.g., "2025-07.json" -> "2025-07")
        const monthMatch = file.match(/(\d{4}-\d{2})\.json/);
        if (monthMatch) {
          const monthKey = monthMatch[1];
          if (!articlesByMonth.has(monthKey)) {
            articlesByMonth.set(monthKey, []);
          }
          articlesByMonth.get(monthKey)?.push(article);
        }
      }
    }

    console.log(`\n📊 Total articles collected: ${allArticles.length}`);

    // Sort months
    const sortedMonths = Array.from(articlesByMonth.keys()).sort();

    // Create index structure
    const index = {
      months: [] as Array<{
        month: string;
        articleCount: number;
        filename: string;
      }>,
      totalArticles: 0,
      lastUpdated: new Date().toISOString(),
    };

    // Write monthly files to by-month directory
    for (const month of sortedMonths) {
      const articles = articlesByMonth.get(month)!;
      const filename = `${month}.json`;
      const filepath = path.join(byMonthDir, filename);

      // Sort articles by date within each month (newest first)
      articles.sort((a, b) => {
        const dateA = new Date(a.date || a.published_date || a.created_at);
        const dateB = new Date(b.date || b.published_date || b.created_at);
        return dateB.getTime() - dateA.getTime();
      });

      // Create monthly data structure
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

    // Create combined news.json
    const newsById: Record<string, NewsArticle> = {};
    const newsBySlug: Record<string, NewsArticle> = {};

    for (const article of allArticles) {
      newsById[article.id] = article;
      newsBySlug[article.slug] = article;
    }

    // Sort all articles by date (newest first)
    allArticles.sort((a, b) => {
      const dateA = new Date(a.date || a.published_date || a.created_at);
      const dateB = new Date(b.date || b.published_date || b.created_at);
      return dateB.getTime() - dateA.getTime();
    });

    const combinedData = {
      articles: allArticles,
      newsById: newsById,
      newsBySlug: newsBySlug,
      metadata: {
        lastUpdated: new Date().toISOString(),
        totalArticles: allArticles.length,
      },
    };

    // Backup current news.json
    try {
      await fs.access(newsJsonPath);
      const backupPath = `${newsJsonPath}.backup-${new Date().toISOString().replace(/:/g, "-")}`;
      await fs.copyFile(newsJsonPath, backupPath);
      console.log("\n📦 Backed up existing news.json");
    } catch (e) {
      console.log("\n📝 No existing news.json to backup");
    }

    // Write new news.json
    await fs.writeFile(newsJsonPath, JSON.stringify(combinedData, null, 2));
    console.log(`✅ Created news.json with ${allArticles.length} articles`);

    console.log("\n📊 Summary:");
    console.log(`   Total articles: ${index.totalArticles}`);
    console.log(`   Total months: ${index.months.length}`);
    console.log(`   Date range: ${sortedMonths[0]} to ${sortedMonths[sortedMonths.length - 1]}`);

    console.log("\n✨ News regeneration completed successfully!");
  } catch (error) {
    console.error("❌ Error regenerating news:", error);
    process.exit(1);
  }
}

// Run the script
regenerateNewsFromArticles();
