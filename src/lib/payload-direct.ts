/**
 * Direct Payload CMS API access for server-side operations
 * This avoids HTTP calls and provides direct database access
 */

import config from "@payload-config";
import { getPayload } from "payload";
import { loggers } from "@/lib/logger";
import { withConnectionRetry, trackConnection, releaseConnection } from "@/lib/db-connection";

let cachedPayload: any = null;
let lastConnectionError: Date | null = null;
const CONNECTION_ERROR_TIMEOUT = 5000; // 5 seconds

export async function getPayloadClient() {
  // If we had a recent connection error, clear the cache
  if (
    lastConnectionError &&
    Date.now() - lastConnectionError.getTime() < CONNECTION_ERROR_TIMEOUT
  ) {
    loggers.db.warn("Recent connection error detected, clearing cached payload");
    cachedPayload = null;
    lastConnectionError = null;
  }

  if (cachedPayload) {
    try {
      // Test if the connection is still alive with retry
      await withConnectionRetry(
        async () => {
          await cachedPayload.find({
            collection: "users",
            limit: 1,
            where: { id: { exists: false } }, // Query that returns no results
          });
        },
        { maxRetries: 1 }
      );

      return cachedPayload;
    } catch (error) {
      loggers.db.error("Cached payload connection failed, creating new connection", { error });
      cachedPayload = null;
      releaseConnection();
    }
  }

  try {
    cachedPayload = await withConnectionRetry(async () => {
      const payload = await getPayload({ config });
      trackConnection(true);
      return payload;
    });

    return cachedPayload;
  } catch (error) {
    lastConnectionError = new Date();
    trackConnection(false);
    loggers.db.error("Failed to create payload connection after retries", { error });
    throw error;
  }
}

export interface PayloadResponse<T> {
  docs: T[];
  totalDocs: number;
  limit: number;
  totalPages: number;
  page: number;
  pagingCounter: number;
  hasPrevPage: boolean;
  hasNextPage: boolean;
  prevPage: number | null;
  nextPage: number | null;
}

export interface QueryParams {
  limit?: number;
  page?: number;
  where?: any;
  sort?: string;
}

// Direct Payload API methods
export const payloadDirect = {
  async getTools(params?: QueryParams) {
    try {
      const payload = await getPayloadClient();
      const result = await payload.find({
        collection: "tools",
        limit: params?.limit || 10,
        page: params?.page || 1,
        where: params?.where || {},
        sort: params?.sort,
      });
      return (
        result || {
          docs: [],
          totalDocs: 0,
          limit: params?.limit || 10,
          totalPages: 0,
          page: params?.page || 1,
          pagingCounter: 0,
          hasPrevPage: false,
          hasNextPage: false,
          prevPage: null,
          nextPage: null,
        }
      );
    } catch (error) {
      loggers.db.error("Failed to fetch tools", { error, params });
      return {
        docs: [],
        totalDocs: 0,
        limit: params?.limit || 10,
        totalPages: 0,
        page: params?.page || 1,
        pagingCounter: 0,
        hasPrevPage: false,
        hasNextPage: false,
        prevPage: null,
        nextPage: null,
      };
    }
  },

  async getTool(idOrSlug: string) {
    const payload = await getPayloadClient();

    // Try by ID first
    try {
      const result = await payload.findByID({
        collection: "tools",
        id: idOrSlug,
      });
      return result;
    } catch {
      // Try by slug
      const results = await payload.find({
        collection: "tools",
        where: {
          slug: { equals: idOrSlug },
        },
        limit: 1,
      });

      if (results.docs.length === 0) {
        throw new Error("Tool not found");
      }

      return results.docs[0];
    }
  },

  async getRankings(params?: QueryParams & { period?: string }) {
    const payload = await getPayloadClient();
    const where = params?.where || {};

    if (params?.period) {
      where.period = { equals: params.period };
    }

    return payload.find({
      collection: "rankings",
      limit: params?.limit || 10,
      page: params?.page || 1,
      where,
      sort: params?.sort,
    });
  },

  async getCompanies(params?: QueryParams) {
    const payload = await getPayloadClient();
    return payload.find({
      collection: "companies",
      limit: params?.limit || 10,
      page: params?.page || 1,
      where: params?.where || {},
      sort: params?.sort,
    });
  },

  async getPendingTools(params?: QueryParams) {
    const payload = await getPayloadClient();
    return payload.find({
      collection: "pending-tools",
      limit: params?.limit || 10,
      page: params?.page || 1,
      where: params?.where || {},
      sort: params?.sort,
    });
  },

  async getPendingToolById(id: string) {
    const payload = await getPayloadClient();
    return payload.findByID({
      collection: "pending-tools",
      id,
    });
  },

  async createTool(data: any) {
    const payload = await getPayloadClient();
    return payload.create({
      collection: "tools",
      data,
    });
  },

  async updatePendingTool(id: string, data: any) {
    const payload = await getPayloadClient();
    return payload.update({
      collection: "pending-tools",
      id,
      data,
    });
  },

  async getCompany(idOrSlug: string) {
    const payload = await getPayloadClient();

    try {
      const result = await payload.findByID({
        collection: "companies",
        id: idOrSlug,
      });
      return result;
    } catch {
      const results = await payload.find({
        collection: "companies",
        where: {
          slug: { equals: idOrSlug },
        },
        limit: 1,
      });

      if (results.docs.length === 0) {
        throw new Error("Company not found");
      }

      return results.docs[0];
    }
  },

  async getMetrics(params?: QueryParams & { tool?: string; metric_key?: string }) {
    const payload = await getPayloadClient();
    const where = params?.where || {};

    if (params?.tool) {
      where.tool = { equals: params.tool };
    }
    if (params?.metric_key) {
      where.metric_key = { equals: params.metric_key };
    }

    return payload.find({
      collection: "metrics",
      limit: params?.limit || 10,
      page: params?.page || 1,
      where,
      sort: params?.sort,
    });
  },

  async getNews(params?: QueryParams & { featured?: boolean }) {
    try {
      const payload = await getPayloadClient();
      const where = params?.where || {};

      if (params?.featured !== undefined) {
        where.is_featured = { equals: params.featured };
      }

      const result = await payload.find({
        collection: "news",
        limit: params?.limit || 10,
        page: params?.page || 1,
        where,
        sort: params?.sort,
        depth: 2, // Populate related_tools
      });
      return (
        result || {
          docs: [],
          totalDocs: 0,
          limit: params?.limit || 10,
          totalPages: 0,
          page: params?.page || 1,
          pagingCounter: 0,
          hasPrevPage: false,
          hasNextPage: false,
          prevPage: null,
          nextPage: null,
        }
      );
    } catch (error) {
      loggers.db.error("Failed to fetch news", { error, params });
      return {
        docs: [],
        totalDocs: 0,
        limit: params?.limit || 10,
        totalPages: 0,
        page: params?.page || 1,
        pagingCounter: 0,
        hasPrevPage: false,
        hasNextPage: false,
        prevPage: null,
        nextPage: null,
      };
    }
  },

  async getNewsItem(idOrSlug: string) {
    const payload = await getPayloadClient();

    try {
      const result = await payload.findByID({
        collection: "news",
        id: idOrSlug,
      });
      return result;
    } catch {
      const results = await payload.find({
        collection: "news",
        where: {
          slug: { equals: idOrSlug },
        },
        limit: 1,
      });

      if (results.docs.length === 0) {
        throw new Error("News item not found");
      }

      return results.docs[0];
    }
  },

  async getSiteSettings() {
    const payload = await getPayloadClient();
    return payload.findGlobal({
      slug: "site-settings",
    });
  },
};
