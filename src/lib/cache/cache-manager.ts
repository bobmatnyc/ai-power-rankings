import fs from "fs/promises";
import path from "path";
import { CacheBlobStorage } from "./blob-storage";
import type { CacheType } from "./blob-storage";
import { loggers } from "@/lib/logger";

// Re-export CacheType
export type { CacheType } from "./blob-storage";

export interface CacheInfo {
  source: "filesystem" | "blob" | "none";
  exists: boolean;
  size?: number;
  lastModified?: string;
  blobMetadata?: {
    generatedAt: string;
    size: number;
  };
}

/**
 * Unified cache manager that handles both filesystem (dev) and blob storage (prod)
 * 
 * Priority order:
 * 1. Blob storage (if available in production)
 * 2. Filesystem (src/data/cache/)
 */
export class CacheManager {
  private blobStorage = new CacheBlobStorage();
  private cacheDir = path.join(process.cwd(), "src/data/cache");

  /**
   * Get cache data with fallback logic
   * 1. Try blob storage first (if in production)
   * 2. Fall back to filesystem
   */
  async get(type: CacheType): Promise<any | null> {
    // Try blob storage first in production
    if (CacheBlobStorage.shouldUseBlob()) {
      const blobData = await this.blobStorage.get(type);
      if (blobData) {
        loggers.api.info(`Using cache from blob storage: ${type}`);
        return blobData;
      }
    }

    // Fall back to filesystem
    try {
      const filePath = this.getFilePath(type);
      const fileContent = await fs.readFile(filePath, "utf-8");
      const data = JSON.parse(fileContent);
      
      loggers.api.info(`Using cache from filesystem: ${type}`);
      return data;
    } catch (error) {
      loggers.api.error(`Failed to read cache from filesystem: ${type}`, { error });
      return null;
    }
  }

  /**
   * Store cache data
   * - In production: Store in blob storage only
   * - In development: Store in filesystem only
   */
  async put(type: CacheType, data: any): Promise<void> {
    if (CacheBlobStorage.shouldUseBlob()) {
      // Production: Use blob storage
      await this.blobStorage.put(type, data);
    } else {
      // Development: Use filesystem
      const filePath = this.getFilePath(type);
      const jsonData = JSON.stringify(data, null, 2);
      
      // Ensure directory exists
      await fs.mkdir(this.cacheDir, { recursive: true });
      
      await fs.writeFile(filePath, jsonData, "utf-8");
      loggers.api.info(`Stored cache in filesystem: ${type}`, {
        size: jsonData.length,
        path: filePath,
      });
    }
  }

  /**
   * Get cache information (for status display)
   */
  async getInfo(type: CacheType): Promise<CacheInfo> {
    const info: CacheInfo = {
      source: "none",
      exists: false,
    };

    // Check blob storage first
    if (CacheBlobStorage.shouldUseBlob()) {
      const blobMetadata = await this.blobStorage.getMetadata(type);
      if (blobMetadata) {
        return {
          source: "blob",
          exists: true,
          size: blobMetadata.size,
          lastModified: blobMetadata.generatedAt,
          blobMetadata: {
            generatedAt: blobMetadata.generatedAt,
            size: blobMetadata.size,
          },
        };
      }
    }

    // Check filesystem
    try {
      const filePath = this.getFilePath(type);
      const stats = await fs.stat(filePath);
      
      return {
        source: "filesystem",
        exists: true,
        size: stats.size,
        lastModified: stats.mtime.toISOString(),
      };
    } catch {
      // File doesn't exist
    }

    return info;
  }

  /**
   * Delete cache
   */
  async delete(type: CacheType): Promise<void> {
    if (CacheBlobStorage.shouldUseBlob()) {
      await this.blobStorage.delete(type);
    } else {
      try {
        const filePath = this.getFilePath(type);
        await fs.unlink(filePath);
        loggers.api.info(`Deleted cache from filesystem: ${type}`);
      } catch (error) {
        loggers.api.error(`Failed to delete cache: ${type}`, { error });
      }
    }
  }

  /**
   * Get all cache info
   */
  async getAllInfo(): Promise<Record<CacheType, CacheInfo>> {
    const types: CacheType[] = ["rankings", "tools", "news"];
    const result: Record<string, CacheInfo> = {};

    for (const type of types) {
      result[type] = await this.getInfo(type);
    }

    return result as Record<CacheType, CacheInfo>;
  }

  /**
   * Get the filesystem path for a cache type
   */
  private getFilePath(type: CacheType): string {
    return path.join(this.cacheDir, `${type}.json`);
  }

  /**
   * Check if blob storage is available
   */
  static isBlobAvailable(): boolean {
    return CacheBlobStorage.shouldUseBlob();
  }
}