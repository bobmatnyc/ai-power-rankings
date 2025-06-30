#!/usr/bin/env tsx
/**
 * Optimize JSON Performance Script
 * Optimizes JSON files for production use
 */

import fs from "fs/promises";
import path from "path";
import zlib from "zlib";
import { promisify } from "util";
import { loggers } from "../lib/logger";

const gzip = promisify(zlib.gzip);
const brotliCompress = promisify(zlib.brotliCompress);

const JSON_DATA_DIR = path.join(process.cwd(), "data", "json");
const CACHE_DIR = path.join(process.cwd(), "src", "data", "cache");

interface OptimizationResult {
  file: string;
  originalSize: number;
  optimizedSize: number;
  compressionRatio: number;
  minified: boolean;
  indexed: boolean;
}

interface OptimizationSummary {
  totalFiles: number;
  totalOriginalSize: number;
  totalOptimizedSize: number;
  averageCompression: number;
  results: OptimizationResult[];
}

/**
 * Minify JSON by removing whitespace
 */
async function minifyJSON(data: any): Promise<string> {
  return JSON.stringify(data);
}

/**
 * Create indexed version of arrays for faster lookups
 */
function createIndexedData(data: any[], indexField: string = "id"): any {
  const indexed: any = {
    _indexed: true,
    _indexField: indexField,
    data: data,
    index: {},
  };

  // Create index
  data.forEach((item, idx) => {
    if (item[indexField]) {
      indexed.index[item[indexField]] = idx;
    }
  });

  return indexed;
}

/**
 * Optimize a single JSON file
 */
async function optimizeFile(filePath: string): Promise<OptimizationResult> {
  const relativePath = path.relative(JSON_DATA_DIR, filePath);
  const stats = await fs.stat(filePath);
  const originalSize = stats.size;

  // Read and parse JSON
  const content = await fs.readFile(filePath, "utf-8");
  const data = JSON.parse(content);

  let optimizedData = data;
  let indexed = false;

  // Index arrays for faster lookups
  if (Array.isArray(data) && data.length > 100) {
    if (data[0]?.id) {
      optimizedData = createIndexedData(data, "id");
      indexed = true;
    } else if (data[0]?.slug) {
      optimizedData = createIndexedData(data, "slug");
      indexed = true;
    }
  }

  // Minify JSON
  const minified = await minifyJSON(optimizedData);
  const optimizedSize = Buffer.byteLength(minified);

  // Write optimized version
  await fs.writeFile(filePath, minified);

  return {
    file: relativePath,
    originalSize,
    optimizedSize,
    compressionRatio: (originalSize - optimizedSize) / originalSize,
    minified: true,
    indexed,
  };
}

/**
 * Create compressed versions for web serving
 */
async function createCompressedVersions(filePath: string): Promise<void> {
  const content = await fs.readFile(filePath);

  // Create gzip version
  const gzipped = await gzip(content);
  await fs.writeFile(`${filePath}.gz`, gzipped);

  // Create brotli version
  const brotliCompressed = await brotliCompress(content, {
    params: {
      [zlib.constants.BROTLI_PARAM_QUALITY]: zlib.constants.BROTLI_MAX_QUALITY,
    },
  });
  await fs.writeFile(`${filePath}.br`, brotliCompressed);
}

/**
 * Split large files into chunks
 */
async function splitLargeFile(filePath: string, maxSizeKB: number = 500): Promise<void> {
  const stats = await fs.stat(filePath);
  const sizeKB = stats.size / 1024;

  if (sizeKB <= maxSizeKB) {
    return; // File is small enough
  }

  const content = await fs.readFile(filePath, "utf-8");
  const data = JSON.parse(content);

  if (!Array.isArray(data)) {
    return; // Can only split arrays
  }

  const chunkSize = Math.ceil((data.length * maxSizeKB) / sizeKB);
  const chunks = [];

  for (let i = 0; i < data.length; i += chunkSize) {
    chunks.push(data.slice(i, i + chunkSize));
  }

  // Write chunks
  const baseDir = path.dirname(filePath);
  const baseName = path.basename(filePath, ".json");

  for (let i = 0; i < chunks.length; i++) {
    const chunkPath = path.join(baseDir, `${baseName}-chunk-${i}.json`);
    await fs.writeFile(chunkPath, JSON.stringify(chunks[i]));
  }

  // Write manifest
  const manifest = {
    chunks: chunks.length,
    totalItems: data.length,
    chunkSize,
    files: chunks.map((_, i) => `${baseName}-chunk-${i}.json`),
  };

  await fs.writeFile(
    path.join(baseDir, `${baseName}-manifest.json`),
    JSON.stringify(manifest, null, 2)
  );

  loggers.performance.info(`Split ${baseName}.json into ${chunks.length} chunks`);
}

/**
 * Generate cache warming list
 */
async function generateCacheWarmingList(): Promise<void> {
  const cacheFiles: string[] = [];

  async function scanDirectory(dir: string) {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await scanDirectory(fullPath);
      } else if (entry.name.endsWith(".json")) {
        const relativePath = path.relative(CACHE_DIR, fullPath);
        cacheFiles.push(`/data/cache/${relativePath}`);
      }
    }
  }

  await scanDirectory(CACHE_DIR);

  // Write cache warming list
  const warmingList = {
    files: cacheFiles,
    priority: [
      "/data/cache/rankings-cache.json",
      "/data/cache/tools-cache.json",
      "/data/cache/news-cache.json",
    ],
    generated: new Date().toISOString(),
  };

  await fs.writeFile(
    path.join(CACHE_DIR, "cache-warming.json"),
    JSON.stringify(warmingList, null, 2)
  );
}

/**
 * Optimize all JSON files
 */
async function optimizeAllFiles(): Promise<OptimizationSummary> {
  loggers.performance.info("Starting JSON performance optimization...");

  const results: OptimizationResult[] = [];

  // Optimize tools.json
  const toolsFile = path.join(JSON_DATA_DIR, "tools.json");
  if (await fileExists(toolsFile)) {
    results.push(await optimizeFile(toolsFile));
    await createCompressedVersions(toolsFile);
  }

  // Optimize companies.json
  const companiesFile = path.join(JSON_DATA_DIR, "companies.json");
  if (await fileExists(companiesFile)) {
    results.push(await optimizeFile(companiesFile));
    await createCompressedVersions(companiesFile);
  }

  // Optimize news articles
  const newsFile = path.join(JSON_DATA_DIR, "news", "articles.json");
  if (await fileExists(newsFile)) {
    const stats = await fs.stat(newsFile);
    if (stats.size > 500 * 1024) {
      // If larger than 500KB
      await splitLargeFile(newsFile);
    }
    results.push(await optimizeFile(newsFile));
    await createCompressedVersions(newsFile);
  }

  // Optimize rankings
  const rankingsDir = path.join(JSON_DATA_DIR, "rankings");
  const rankingFiles = await fs.readdir(rankingsDir);

  for (const file of rankingFiles) {
    if (file.endsWith(".json")) {
      const filePath = path.join(rankingsDir, file);
      results.push(await optimizeFile(filePath));
    }
  }

  // Generate cache warming list
  await generateCacheWarmingList();

  // Calculate summary
  const summary: OptimizationSummary = {
    totalFiles: results.length,
    totalOriginalSize: results.reduce((sum, r) => sum + r.originalSize, 0),
    totalOptimizedSize: results.reduce((sum, r) => sum + r.optimizedSize, 0),
    averageCompression: results.reduce((sum, r) => sum + r.compressionRatio, 0) / results.length,
    results,
  };

  loggers.performance.info("Optimization completed", summary);

  return summary;
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Create performance configuration
 */
async function createPerformanceConfig(): Promise<void> {
  const config = {
    cache: {
      maxAge: 3600, // 1 hour
      staleWhileRevalidate: 1800, // 30 minutes
      public: true,
    },
    compression: {
      preferBrotli: true,
      gzipFallback: true,
    },
    chunking: {
      maxFileSizeKB: 500,
      enableForNews: true,
      enableForRankings: false,
    },
    indexing: {
      minItemsForIndex: 100,
      indexFields: ["id", "slug"],
    },
  };

  await fs.writeFile(
    path.join(process.cwd(), "performance.config.json"),
    JSON.stringify(config, null, 2)
  );
}

// Run if called directly
if (require.main === module) {
  optimizeAllFiles()
    .then(async (summary) => {
      console.log("\n📊 Optimization Summary:");
      console.log(`   Files optimized: ${summary.totalFiles}`);
      console.log(`   Original size: ${(summary.totalOriginalSize / 1024 / 1024).toFixed(2)} MB`);
      console.log(`   Optimized size: ${(summary.totalOptimizedSize / 1024 / 1024).toFixed(2)} MB`);
      console.log(`   Average compression: ${(summary.averageCompression * 100).toFixed(1)}%`);

      console.log("\n✅ Performance optimizations applied:");
      console.log("   - JSON minification");
      console.log("   - Array indexing for large datasets");
      console.log("   - Gzip and Brotli compression");
      console.log("   - Large file chunking");
      console.log("   - Cache warming list generated");

      await createPerformanceConfig();
      console.log("\n📝 Performance configuration created");

      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Optimization failed:", error);
      process.exit(1);
    });
}

export { optimizeAllFiles, createCompressedVersions };
