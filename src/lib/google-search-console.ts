import { google } from 'googleapis';

interface SearchAnalyticsQuery {
  startDate: string;
  endDate: string;
  dimensions?: string[];
  dimensionFilterGroups?: any[];
  rowLimit?: number;
  startRow?: number;
}

interface SearchConsoleConfig {
  siteUrl: string;
  serviceAccountEmail: string;
  serviceAccountKey: string | object;
}

export class GoogleSearchConsole {
  private auth: any;
  private searchconsole: any;
  private siteUrl: string;

  constructor(config: SearchConsoleConfig) {
    this.siteUrl = config.siteUrl;
    
    // Parse service account key if it's a string
    const key = typeof config.serviceAccountKey === 'string' 
      ? JSON.parse(config.serviceAccountKey) 
      : config.serviceAccountKey;

    // Create JWT auth
    this.auth = new google.auth.JWT(
      key.client_email,
      undefined,
      key.private_key,
      ['https://www.googleapis.com/auth/webmasters.readonly'],
      undefined
    );

    // Initialize Search Console API
    this.searchconsole = google.searchconsole({
      version: 'v1',
      auth: this.auth
    });
  }

  /**
   * Get search analytics data
   */
  async getSearchAnalytics(query: SearchAnalyticsQuery) {
    try {
      const response = await this.searchconsole.searchanalytics.query({
        siteUrl: this.siteUrl,
        requestBody: query
      });

      return response.data;
    } catch (error) {
      console.error('Error fetching search analytics:', error);
      throw error;
    }
  }

  /**
   * Get top queries for the last 28 days
   */
  async getTopQueries(limit = 25) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 28);

    return this.getSearchAnalytics({
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      dimensions: ['query'],
      rowLimit: limit
    });
  }

  /**
   * Get top pages by clicks
   */
  async getTopPages(limit = 25) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 28);

    return this.getSearchAnalytics({
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      dimensions: ['page'],
      rowLimit: limit
    });
  }

  /**
   * Get performance by date
   */
  async getPerformanceByDate(days = 28) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    return this.getSearchAnalytics({
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      dimensions: ['date']
    });
  }

  /**
   * Get site performance metrics
   */
  async getSiteMetrics() {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 28);

    const [current, previous] = await Promise.all([
      // Current period
      this.getSearchAnalytics({
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0]
      }),
      // Previous period
      this.getSearchAnalytics({
        startDate: new Date(startDate.getTime() - 28 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        endDate: new Date(startDate.getTime() - 1).toISOString().split('T')[0]
      })
    ]);

    const currentMetrics = this.calculateMetrics(current.rows || []);
    const previousMetrics = this.calculateMetrics(previous.rows || []);

    return {
      current: currentMetrics,
      previous: previousMetrics,
      changes: {
        clicks: this.calculateChange(currentMetrics.clicks, previousMetrics.clicks),
        impressions: this.calculateChange(currentMetrics.impressions, previousMetrics.impressions),
        ctr: this.calculateChange(currentMetrics.ctr, previousMetrics.ctr),
        position: this.calculateChange(currentMetrics.position, previousMetrics.position, true)
      }
    };
  }

  /**
   * Check if a URL is indexed
   */
  async inspectUrl(url: string) {
    try {
      const response = await this.searchconsole.urlInspection.index.inspect({
        requestBody: {
          inspectionUrl: url,
          siteUrl: this.siteUrl
        }
      });

      return response.data;
    } catch (error) {
      console.error('Error inspecting URL:', error);
      throw error;
    }
  }

  /**
   * Get sitemaps
   */
  async getSitemaps() {
    try {
      const response = await this.searchconsole.sitemaps.list({
        siteUrl: this.siteUrl
      });

      return response.data.sitemap || [];
    } catch (error) {
      console.error('Error fetching sitemaps:', error);
      throw error;
    }
  }

  /**
   * Submit a sitemap
   */
  async submitSitemap(sitemapUrl: string) {
    try {
      const response = await this.searchconsole.sitemaps.submit({
        siteUrl: this.siteUrl,
        feedpath: sitemapUrl
      });

      return response.data;
    } catch (error) {
      console.error('Error submitting sitemap:', error);
      throw error;
    }
  }

  // Helper methods
  private calculateMetrics(rows: any[]) {
    if (!rows || rows.length === 0) {
      return { clicks: 0, impressions: 0, ctr: 0, position: 0 };
    }

    const totals = rows.reduce((acc, row) => {
      return {
        clicks: acc.clicks + (row.clicks || 0),
        impressions: acc.impressions + (row.impressions || 0),
        positionSum: acc.positionSum + ((row.position || 0) * (row.impressions || 0)),
        impressionSum: acc.impressionSum + (row.impressions || 0)
      };
    }, { clicks: 0, impressions: 0, positionSum: 0, impressionSum: 0 });

    return {
      clicks: totals.clicks,
      impressions: totals.impressions,
      ctr: totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0,
      position: totals.impressionSum > 0 ? totals.positionSum / totals.impressionSum : 0
    };
  }

  private calculateChange(current: number, previous: number, inverse = false): number {
    if (previous === 0) return 0;
    const change = ((current - previous) / previous) * 100;
    return inverse ? -change : change; // Inverse for position (lower is better)
  }
}