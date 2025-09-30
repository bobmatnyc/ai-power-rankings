import { loggers } from "@/lib/logger";
import type { CacheType } from "./blob-storage";
import { CacheBlobStorage } from "./blob-storage";

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
 * Cache manager that handles blob storage in production
 */
export class CacheManager {
  private blobStorage = new CacheBlobStorage();

  /**
   * Get cache data from blob storage
   */
  async get(type: CacheType): Promise<unknown | null> {
    // Try blob storage in production
    if (CacheBlobStorage.shouldUseBlob()) {
      const blobData = await this.blobStorage.get(type);
      if (blobData) {
        loggers.api.debug(`Using cache from blob storage: ${type}`);
        return blobData;
      }
    }
    return null;
  }

  /**
   * Store cache data in blob storage
   */
  async put(type: CacheType, data: unknown): Promise<void> {
    if (CacheBlobStorage.shouldUseBlob()) {
      await this.blobStorage.put(type, data);
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

    // Check blob storage
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

    return info;
  }

  /**
   * Delete cache
   */
  async delete(type: CacheType): Promise<void> {
    if (CacheBlobStorage.shouldUseBlob()) {
      await this.blobStorage.delete(type);
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
   * Check if blob storage is available
   */
  static isBlobAvailable(): boolean {
    return CacheBlobStorage.shouldUseBlob();
  }
}
