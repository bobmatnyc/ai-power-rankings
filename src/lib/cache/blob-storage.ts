import { loggers } from "@/lib/logger";

export type CacheType = "rankings" | "tools" | "news";

interface CacheMetadata {
  type: CacheType;
  generatedAt: string;
  size: number;
}

// Dynamic imports for @vercel/blob to avoid build errors in non-Vercel environments
let blobAPI: {
  put: typeof import("@vercel/blob").put;
  head: typeof import("@vercel/blob").head;
  del: typeof import("@vercel/blob").del;
  list: typeof import("@vercel/blob").list;
} | null = null;

// Only import @vercel/blob if we're in a Vercel environment
async function getBlobAPI() {
  if (blobAPI) {
    return blobAPI;
  }

  if (process.env["BLOB_READ_WRITE_TOKEN"]) {
    try {
      const blob = await import("@vercel/blob");
      blobAPI = {
        put: blob.put,
        head: blob.head,
        del: blob.del,
        list: blob.list,
      };
      return blobAPI;
    } catch (error) {
      loggers.api.warn("@vercel/blob not available - blob storage disabled");
      return null;
    }
  }

  return null;
}

/**
 * Blob storage utilities for cache management
 * Only used in production - local dev uses filesystem
 */
export class CacheBlobStorage {
  private prefix = "cache";

  /**
   * Check if we should use blob storage (only in production)
   */
  static shouldUseBlob(): boolean {
    return process.env["NODE_ENV"] === "production" && !!process.env["BLOB_READ_WRITE_TOKEN"];
  }

  /**
   * Get the blob key for a cache type
   */
  private getCacheKey(type: CacheType): string {
    return `${this.prefix}/${type}.json`;
  }

  /**
   * Store cache data in blob storage
   */
  async put(type: CacheType, data: any): Promise<void> {
    if (!CacheBlobStorage.shouldUseBlob()) {
      throw new Error("Blob storage is only available in production");
    }

    const api = await getBlobAPI();
    if (!api) {
      throw new Error("Blob API not available");
    }

    const key = this.getCacheKey(type);
    const jsonData = JSON.stringify(data, null, 2);

    try {
      await api.put(key, jsonData, {
        access: "public",
        contentType: "application/json",
        addRandomSuffix: false,
        cacheControlMaxAge: 60, // 1 minute cache
      });

      loggers.api.info(`Stored cache in blob: ${key}`, {
        size: jsonData.length,
        type,
      });
    } catch (error) {
      loggers.api.error(`Failed to store cache in blob: ${key}`, { error });
      throw error;
    }
  }

  /**
   * Get cache data from blob storage
   */
  async get(type: CacheType): Promise<any | null> {
    if (!CacheBlobStorage.shouldUseBlob()) {
      return null;
    }

    const api = await getBlobAPI();
    if (!api) {
      return null;
    }

    const key = this.getCacheKey(type);

    try {
      // Check if blob exists
      const metadata = await api.head(key);
      if (!metadata) {
        return null;
      }

      // Fetch the blob data
      const response = await fetch(metadata.url);
      if (!response.ok) {
        throw new Error(`Failed to fetch blob: ${response.statusText}`);
      }

      const data = await response.json();

      loggers.api.info(`Retrieved cache from blob: ${key}`, {
        size: metadata.size,
        uploadedAt: metadata.uploadedAt,
      });

      return data;
    } catch (error) {
      loggers.api.error(`Failed to get cache from blob: ${key}`, { error });
      return null;
    }
  }

  /**
   * Check if cache exists in blob storage
   */
  async exists(type: CacheType): Promise<boolean> {
    if (!CacheBlobStorage.shouldUseBlob()) {
      return false;
    }

    const api = await getBlobAPI();
    if (!api) {
      return false;
    }

    const key = this.getCacheKey(type);

    try {
      const metadata = await api.head(key);
      return !!metadata;
    } catch {
      return false;
    }
  }

  /**
   * Get metadata for a cache blob
   */
  async getMetadata(type: CacheType): Promise<CacheMetadata | null> {
    if (!CacheBlobStorage.shouldUseBlob()) {
      return null;
    }

    const api = await getBlobAPI();
    if (!api) {
      return null;
    }

    const key = this.getCacheKey(type);

    try {
      const metadata = await api.head(key);
      if (!metadata) {
        return null;
      }

      return {
        type,
        generatedAt: metadata.uploadedAt.toISOString(),
        size: metadata.size,
      };
    } catch {
      return null;
    }
  }

  /**
   * Delete cache from blob storage
   */
  async delete(type: CacheType): Promise<void> {
    if (!CacheBlobStorage.shouldUseBlob()) {
      return;
    }

    const api = await getBlobAPI();
    if (!api) {
      throw new Error("Blob API not available");
    }

    const key = this.getCacheKey(type);

    try {
      await api.del(key);
      loggers.api.info(`Deleted cache from blob: ${key}`);
    } catch (error) {
      loggers.api.error(`Failed to delete cache from blob: ${key}`, { error });
      throw error;
    }
  }

  /**
   * List all cache blobs
   */
  async listAll(): Promise<CacheMetadata[]> {
    if (!CacheBlobStorage.shouldUseBlob()) {
      return [];
    }

    const api = await getBlobAPI();
    if (!api) {
      return [];
    }

    try {
      const { blobs } = await api.list({
        prefix: this.prefix,
      });

      return blobs
        .filter((blob) => blob.pathname.endsWith(".json"))
        .map((blob) => {
          const type = blob.pathname.split("/").pop()?.replace(".json", "") as CacheType;
          return {
            type,
            generatedAt: blob.uploadedAt,
            size: blob.size,
          };
        });
    } catch (error) {
      loggers.api.error("Failed to list cache blobs", { error });
      return [];
    }
  }
}
