/**
 * Direct Payload CMS API access for server-side operations
 * This avoids HTTP calls and provides direct database access
 */

import config from "@payload-config";
import { getPayload } from "payload";

let cachedPayload: any = null;

export async function getPayloadClient() {
  if (cachedPayload) {
    return cachedPayload;
  }

  cachedPayload = await getPayload({ config });
  return cachedPayload;
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
    const payload = await getPayloadClient();
    return payload.find({
      collection: 'tools',
      limit: params?.limit || 10,
      page: params?.page || 1,
      where: params?.where || {},
      sort: params?.sort,
    });
  },

  async getTool(idOrSlug: string) {
    const payload = await getPayloadClient();
    
    // Try by ID first
    try {
      const result = await payload.findByID({
        collection: 'tools',
        id: idOrSlug,
      });
      return result;
    } catch {
      // Try by slug
      const results = await payload.find({
        collection: 'tools',
        where: {
          slug: { equals: idOrSlug },
        },
        limit: 1,
      });
      
      if (results.docs.length === 0) {
        throw new Error('Tool not found');
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
      collection: 'rankings',
      limit: params?.limit || 10,
      page: params?.page || 1,
      where,
      sort: params?.sort,
    });
  },

  async getCompanies(params?: QueryParams) {
    const payload = await getPayloadClient();
    return payload.find({
      collection: 'companies',
      limit: params?.limit || 10,
      page: params?.page || 1,
      where: params?.where || {},
      sort: params?.sort,
    });
  },

  async getCompany(idOrSlug: string) {
    const payload = await getPayloadClient();
    
    try {
      const result = await payload.findByID({
        collection: 'companies',
        id: idOrSlug,
      });
      return result;
    } catch {
      const results = await payload.find({
        collection: 'companies',
        where: {
          slug: { equals: idOrSlug },
        },
        limit: 1,
      });
      
      if (results.docs.length === 0) {
        throw new Error('Company not found');
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
      collection: 'metrics',
      limit: params?.limit || 10,
      page: params?.page || 1,
      where,
      sort: params?.sort,
    });
  },

  async getNews(params?: QueryParams & { featured?: boolean }) {
    const payload = await getPayloadClient();
    const where = params?.where || {};
    
    if (params?.featured !== undefined) {
      where.is_featured = { equals: params.featured };
    }
    
    return payload.find({
      collection: 'news',
      limit: params?.limit || 10,
      page: params?.page || 1,
      where,
      sort: params?.sort,
    });
  },

  async getNewsItem(idOrSlug: string) {
    const payload = await getPayloadClient();
    
    try {
      const result = await payload.findByID({
        collection: 'news',
        id: idOrSlug,
      });
      return result;
    } catch {
      const results = await payload.find({
        collection: 'news',
        where: {
          slug: { equals: idOrSlug },
        },
        limit: 1,
      });
      
      if (results.docs.length === 0) {
        throw new Error('News item not found');
      }
      
      return results.docs[0];
    }
  },

  async getSiteSettings() {
    const payload = await getPayloadClient();
    return payload.findGlobal({
      slug: 'site-settings',
    });
  }
};