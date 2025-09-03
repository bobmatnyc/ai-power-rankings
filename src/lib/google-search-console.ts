import { google } from "googleapis";

interface SearchAnalyticsQuery {
  startDate: string;
  endDate: string;
  dimensions?: string[];
  dimensionFilterGroups?: Array<Record<string, unknown>>;
  rowLimit?: number;
  startRow?: number;
}

interface SearchConsoleConfig {
  siteUrl: string;
  serviceAccountEmail?: string;
  accessToken?: string; // OAuth token from authenticated user
}

export class GoogleSearchConsole {
  // biome-ignore lint/suspicious/noExplicitAny: Google API client type
  private searchconsole: any;
  private siteUrl: string;
  private initialized: boolean = false;
  private accessToken?: string;

  constructor(config: SearchConsoleConfig) {
    this.siteUrl = config.siteUrl;
    this.accessToken = config.accessToken;
  }

  private async initialize() {
    if (this.initialized) {
      return;
    }

    const projectId = process.env["GOOGLE_CLOUD_PROJECT_ID"] || "ai-power-ranking";
    // biome-ignore lint/suspicious/noExplicitAny: Google auth types
    let auth: any;
    // biome-ignore lint/suspicious/noExplicitAny: Google auth types
    let authClient: any;

    // Option 1: Use OAuth access token from authenticated user (for production)
    if (this.accessToken) {
      const oauth2Client = new google.auth.OAuth2();
      oauth2Client.setCredentials({
        access_token: this.accessToken,
      });
      authClient = oauth2Client;
    }
    // Option 2: Use service account JSON (if provided)
    else if (process.env["GOOGLE_APPLICATION_CREDENTIALS_JSON"]) {
      const serviceAccountJson = process.env["GOOGLE_APPLICATION_CREDENTIALS_JSON"];
      try {
        const credentials = JSON.parse(serviceAccountJson);
        auth = new google.auth.GoogleAuth({
          credentials,
          scopes: ["https://www.googleapis.com/auth/webmasters"],
          projectId: projectId,
        });
        authClient = await auth.getClient();
      } catch (error) {
        console.error("Failed to parse service account JSON:", error);
        throw new Error("Invalid GOOGLE_APPLICATION_CREDENTIALS_JSON");
      }
    }
    // Option 3: Use Application Default Credentials (for local development)
    else {
      const serviceAccountEmail = process.env["GOOGLE_SERVICE_ACCOUNT_EMAIL"];

      if (serviceAccountEmail) {
        // Use service account impersonation
        auth = new google.auth.GoogleAuth({
          scopes: ["https://www.googleapis.com/auth/webmasters"],
          projectId: projectId,
          clientOptions: {
            subject: serviceAccountEmail,
          },
        });
      } else {
        // Use default credentials without impersonation
        auth = new google.auth.GoogleAuth({
          scopes: ["https://www.googleapis.com/auth/webmasters"],
          projectId: projectId,
        });
      }
      authClient = await auth.getClient();
    }

    // Initialize Search Console API
    this.searchconsole = google.searchconsole({
      version: "v1",
      // biome-ignore lint/suspicious/noExplicitAny: Google auth type casting
      auth: authClient as any,
    });

    this.initialized = true;
  }

  /**
   * Get search analytics data
   */
  async getSearchAnalytics(query: SearchAnalyticsQuery) {
    await this.initialize();

    try {
      const response = await this.searchconsole.searchanalytics.query({
        siteUrl: this.siteUrl,
        requestBody: query,
      });

      return response.data;
    } catch (error) {
      console.error("Error fetching search analytics:", error);
      throw error;
    }
  }

  /**
   * Get top queries for the last 28 days
   */
  async getTopQueries(limit = 25) {
    await this.initialize();

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 28);

    return this.getSearchAnalytics({
      startDate: startDate.toISOString().split("T")[0]!,
      endDate: endDate.toISOString().split("T")[0]!,
      dimensions: ["query"],
      rowLimit: limit,
    });
  }

  /**
   * Get top pages by clicks
   */
  async getTopPages(limit = 25) {
    await this.initialize();

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 28);

    return this.getSearchAnalytics({
      startDate: startDate.toISOString().split("T")[0]!,
      endDate: endDate.toISOString().split("T")[0]!,
      dimensions: ["page"],
      rowLimit: limit,
    });
  }

  /**
   * Get performance by date
   */
  async getPerformanceByDate(days = 28) {
    await this.initialize();

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    return this.getSearchAnalytics({
      startDate: startDate.toISOString().split("T")[0]!,
      endDate: endDate.toISOString().split("T")[0]!,
      dimensions: ["date"],
    });
  }

  /**
   * Get site performance metrics
   */
  async getSiteMetrics() {
    await this.initialize();

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 28);

    const [current, previous] = await Promise.all([
      // Current period
      this.getSearchAnalytics({
        startDate: startDate.toISOString().split("T")[0]!,
        endDate: endDate.toISOString().split("T")[0]!,
      }),
      // Previous period
      this.getSearchAnalytics({
        startDate: new Date(startDate.getTime() - 28 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0]!,
        endDate: new Date(startDate.getTime() - 1).toISOString().split("T")[0]!,
      }),
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
        position: this.calculateChange(currentMetrics.position, previousMetrics.position, true),
      },
    };
  }

  /**
   * Check if a URL is indexed
   */
  async inspectUrl(url: string) {
    await this.initialize();

    try {
      const response = await this.searchconsole.urlInspection.index.inspect({
        requestBody: {
          inspectionUrl: url,
          siteUrl: this.siteUrl,
        },
      });

      return response.data;
    } catch (error) {
      console.error("Error inspecting URL:", error);
      throw error;
    }
  }

  /**
   * Get sitemaps
   */
  async getSitemaps() {
    await this.initialize();

    try {
      const response = await this.searchconsole.sitemaps.list({
        siteUrl: this.siteUrl,
      });

      return response.data.sitemap || [];
    } catch (error) {
      console.error("Error fetching sitemaps:", error);
      throw error;
    }
  }

  /**
   * Submit a sitemap
   */
  async submitSitemap(sitemapUrl: string) {
    await this.initialize();

    try {
      const response = await this.searchconsole.sitemaps.submit({
        siteUrl: this.siteUrl,
        feedpath: sitemapUrl,
      });

      return response.data;
    } catch (error) {
      console.error("Error submitting sitemap:", error);
      throw error;
    }
  }

  // Helper methods
  private calculateMetrics(rows: any[]) {
    if (!rows || rows.length === 0) {
      return { clicks: 0, impressions: 0, ctr: 0, position: 0 };
    }

    const totals = rows.reduce(
      (acc, row) => {
        return {
          clicks: acc.clicks + (row.clicks || 0),
          impressions: acc.impressions + (row.impressions || 0),
          positionSum: acc.positionSum + (row.position || 0) * (row.impressions || 0),
          impressionSum: acc.impressionSum + (row.impressions || 0),
        };
      },
      { clicks: 0, impressions: 0, positionSum: 0, impressionSum: 0 }
    );

    return {
      clicks: totals.clicks,
      impressions: totals.impressions,
      ctr: totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0,
      position: totals.impressionSum > 0 ? totals.positionSum / totals.impressionSum : 0,
    };
  }

  private calculateChange(current: number, previous: number, inverse = false): number {
    if (previous === 0) {
      return 0;
    }
    const change = ((current - previous) / previous) * 100;
    return inverse ? -change : change; // Inverse for position (lower is better)
  }
}
