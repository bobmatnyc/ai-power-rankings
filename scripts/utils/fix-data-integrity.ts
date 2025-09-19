#!/usr/bin/env node

import { copyFile, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const DATA_PATH = join(process.cwd(), "data", "json");

async function backupFile(filePath: string) {
  const timestamp = new Date().toISOString();
  const backupPath = `${filePath}.backup-${timestamp}`;
  await copyFile(filePath, backupPath);
  console.log(`✅ Backed up ${filePath} to ${backupPath}`);
  return backupPath;
}

async function fixToolDuplicateId() {
  console.log("\n🔧 Fixing duplicate tool IDs...");

  const toolsPath = join(DATA_PATH, "tools", "tools.json");
  const toolsData = JSON.parse(await readFile(toolsPath, "utf-8"));

  // Find Kiro entry (currently has duplicate ID 28)
  let kiroFound = false;
  for (let i = 0; i < toolsData.tools.length; i++) {
    const tool = toolsData.tools[i];
    if (tool.slug === "kiro" && tool.id === "28") {
      // Change Kiro's ID to 31 (next available)
      tool.id = "31";
      kiroFound = true;
      console.log(`✅ Changed Kiro's ID from 28 to 31`);
    }
  }

  if (!kiroFound) {
    console.log("⚠️  Kiro tool not found with ID 28");
  }

  // Update the index mappings
  if (toolsData.index) {
    // Update byId index
    if (toolsData.index.byId?.["28"]) {
      // Check if it's Kiro
      if (toolsData.index.byId["28"].slug === "kiro") {
        toolsData.index.byId["31"] = { ...toolsData.index.byId["28"], id: "31" };
        console.log("✅ Added Kiro to byId index with ID 31");
      }
    }

    // Update byCategory index
    if (toolsData.index.byCategory) {
      for (const [category, ids] of Object.entries(toolsData.index.byCategory)) {
        if (Array.isArray(ids)) {
          // Check if we need to update IDs in this category
          const kiroTool = toolsData.tools.find((t: any) => t.slug === "kiro");
          if (kiroTool && kiroTool.category === category) {
            const updatedIds = ids.map((id: string) => {
              // If this was Kiro's old ID, update it
              if (id === "28") {
                // Verify it's actually Kiro by checking the tools array
                const tool = toolsData.tools.find((t: any) => t.id === "31" && t.slug === "kiro");
                if (tool && tool.category === category) {
                  return "31";
                }
              }
              return id;
            });
            toolsData.index.byCategory[category] = updatedIds;
            if (updatedIds.includes("31")) {
              console.log(`✅ Updated ${category} category to include Kiro with ID 31`);
            }
          }
        }
      }
    }
  }

  // Backup and save
  await backupFile(toolsPath);
  await writeFile(toolsPath, JSON.stringify(toolsData, null, 2));
  console.log("✅ Saved updated tools.json");

  // Now update the tools-index.json
  const indexPath = join(DATA_PATH, "tools", "tools-index.json");
  const indexData = JSON.parse(await readFile(indexPath, "utf-8"));

  // Update metadata count if needed
  if (indexData.metadata) {
    indexData.metadata.last_updated = new Date().toISOString();
  }

  // Update byId index
  if (indexData.index?.byId?.["28"]) {
    // Check if it's Kiro
    if (indexData.index.byId["28"].slug === "kiro") {
      indexData.index.byId["31"] = { ...indexData.index.byId["28"], id: "31" };
      delete indexData.index.byId["28"]; // Remove the duplicate
      console.log("✅ Updated tools-index.json: moved Kiro from ID 28 to 31");
    }
  }

  // Update byCategory index
  if (indexData.index?.byCategory) {
    for (const [category, ids] of Object.entries(indexData.index.byCategory)) {
      if (Array.isArray(ids) && ids.includes("28")) {
        // Check if this category should have Kiro
        const kiroInBySlug = indexData.index.bySlug?.kiro;
        if (kiroInBySlug && kiroInBySlug.category === category) {
          const updatedIds = ids.map((id: string) =>
            id === "28" && kiroInBySlug.slug === "kiro" ? "31" : id
          );
          indexData.index.byCategory[category] = updatedIds;
          console.log(`✅ Updated ${category} category in index to use ID 31 for Kiro`);
        }
      }
    }
  }

  // Update the total count to 31 if we added a new tool
  if (indexData.metadata && indexData.metadata.total === 30) {
    indexData.metadata.total = 31;
    console.log("✅ Updated total tool count to 31");
  }

  // Backup and save index
  await backupFile(indexPath);
  await writeFile(indexPath, JSON.stringify(indexData, null, 2));
  console.log("✅ Saved updated tools-index.json");

  // Create kiro.json in individual tools directory
  const kiroPath = join(DATA_PATH, "tools", "individual", "kiro.json");
  const kiroData = toolsData.tools.find((t: any) => t.slug === "kiro");
  if (kiroData) {
    await writeFile(kiroPath, JSON.stringify(kiroData, null, 2));
    console.log("✅ Created individual/kiro.json file");
  }
}

async function fixNewsDateFields() {
  console.log("\n📰 Fixing news article date fields...");

  const newsPath = join(DATA_PATH, "news", "news.json");
  const newsData = JSON.parse(await readFile(newsPath, "utf-8"));

  let fixedCount = 0;

  // Fix each article
  for (const article of newsData.articles) {
    if (article.published_date && !article.date) {
      article.date = article.published_date;
      delete article.published_date;
      fixedCount++;
    }
  }

  console.log(`✅ Fixed date fields for ${fixedCount} articles`);

  // Backup and save
  await backupFile(newsPath);
  await writeFile(newsPath, JSON.stringify(newsData, null, 2));
  console.log("✅ Saved updated news.json");

  // Also fix individual article files
  const articlesPath = join(DATA_PATH, "news", "articles");
  const articleFiles = [
    "2018-05.json",
    "2019-12.json",
    "2020-09.json",
    "2021-04.json",
    "2021-05.json",
    "2022-10.json",
    "2023-04.json",
    "2023-05.json",
    "2023-06.json",
    "2023-07.json",
    "2023-11.json",
    "2023-12.json",
    "2024-02.json",
    "2024-03.json",
    "2024-04.json",
    "2024-06.json",
    "2024-08.json",
    "2024-09.json",
    "2024-10.json",
    "2024-11.json",
    "2024-12.json",
    "2025-01.json",
    "2025-02.json",
    "2025-03.json",
    "2025-04.json",
    "2025-05.json",
    "2025-06.json",
    "2025-07.json",
  ];

  for (const file of articleFiles) {
    try {
      const filePath = join(articlesPath, file);
      const articles = JSON.parse(await readFile(filePath, "utf-8"));

      let changed = false;
      for (const article of articles) {
        if (article.published_date && !article.date) {
          article.date = article.published_date;
          delete article.published_date;
          changed = true;
        }
      }

      if (changed) {
        await writeFile(filePath, JSON.stringify(articles, null, 2));
        console.log(`✅ Fixed date fields in ${file}`);
      }
    } catch (error) {
      console.log(`⚠️  Could not process ${file}: ${error}`);
    }
  }
}

async function rebuildCaches() {
  console.log("\n🔄 Rebuilding caches...");

  // Run cache generation using npm scripts
  const { exec } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const execAsync = promisify(exec);

  try {
    console.log("Generating tools cache...");
    await execAsync("pnpm run cache:tools");
    console.log("✅ Rebuilt tools cache");
  } catch (error) {
    console.log("⚠️  Could not rebuild tools cache:", error);
  }

  try {
    console.log("Generating news cache...");
    await execAsync("pnpm run cache:news");
    console.log("✅ Rebuilt news cache");
  } catch (error) {
    console.log("⚠️  Could not rebuild news cache:", error);
  }

  try {
    console.log("Generating rankings cache...");
    await execAsync("pnpm run cache:rankings");
    console.log("✅ Rebuilt rankings cache");
  } catch (error) {
    console.log("⚠️  Could not rebuild rankings cache:", error);
  }
}

async function validateDataIntegrity() {
  console.log("\n✅ Validating data integrity...");

  // Check tools
  const toolsPath = join(DATA_PATH, "tools", "tools.json");
  const toolsData = JSON.parse(await readFile(toolsPath, "utf-8"));

  const toolIds = new Set<string>();
  const duplicateIds = new Set<string>();

  for (const tool of toolsData.tools) {
    if (toolIds.has(tool.id)) {
      duplicateIds.add(tool.id);
    }
    toolIds.add(tool.id);
  }

  if (duplicateIds.size > 0) {
    console.log("❌ Found duplicate tool IDs:", Array.from(duplicateIds));
  } else {
    console.log("✅ No duplicate tool IDs found");
  }

  // Check news dates
  const newsPath = join(DATA_PATH, "news", "news.json");
  const newsData = JSON.parse(await readFile(newsPath, "utf-8"));

  let missingDates = 0;
  let wrongDateField = 0;

  for (const article of newsData.articles) {
    if (!article.date && !article.published_date) {
      missingDates++;
    }
    if (article.published_date) {
      wrongDateField++;
    }
  }

  if (missingDates > 0) {
    console.log(`❌ ${missingDates} articles missing date field`);
  }
  if (wrongDateField > 0) {
    console.log(`❌ ${wrongDateField} articles using published_date instead of date`);
  }
  if (missingDates === 0 && wrongDateField === 0) {
    console.log("✅ All news articles have correct date fields");
  }

  // Check cache files
  const toolsCachePath = join(process.cwd(), "src", "data", "cache", "tools.json");
  const newsCachePath = join(process.cwd(), "src", "data", "cache", "news.json");

  try {
    const toolsCache = JSON.parse(await readFile(toolsCachePath, "utf-8"));
    console.log(`✅ Tools cache exists with ${toolsCache.tools.length} tools`);

    // Check if Kiro is in the cache
    const kiroInCache = toolsCache.tools.find((t: any) => t.slug === "kiro");
    if (kiroInCache) {
      console.log(`✅ Kiro found in cache with ID ${kiroInCache.id}`);
    } else {
      console.log("❌ Kiro not found in tools cache");
    }
  } catch (error) {
    console.log("❌ Could not read tools cache:", error);
  }

  try {
    const newsCache = JSON.parse(await readFile(newsCachePath, "utf-8"));
    console.log(`✅ News cache exists with ${newsCache.articles.length} articles`);
  } catch (error) {
    console.log("❌ Could not read news cache:", error);
  }
}

async function main() {
  console.log("🚀 Starting data integrity fixes...\n");

  try {
    // Fix duplicate tool IDs
    await fixToolDuplicateId();

    // Fix news date fields
    await fixNewsDateFields();

    // Rebuild all caches
    await rebuildCaches();

    // Validate everything
    await validateDataIntegrity();

    console.log("\n✅ Data integrity fixes completed!");
  } catch (error) {
    console.error("\n❌ Error during data integrity fixes:", error);
    process.exit(1);
  }
}

main();
