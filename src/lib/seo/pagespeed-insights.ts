import axios from "axios";

interface PageSpeedResult {
  lighthouseResult: {
    audits: {
      "largest-contentful-paint": { numericValue: number };
      "first-input-delay": { numericValue: number };
      "cumulative-layout-shift": { numericValue: number };
      "first-contentful-paint": { numericValue: number };
      "time-to-interactive": { numericValue: number };
      "speed-index": { numericValue: number };
    };
    categories: {
      performance: { score: number };
      accessibility: { score: number };
      "best-practices": { score: number };
      seo: { score: number };
    };
  };
}

export class PageSpeedInsights {
  private apiKey: string;
  private baseUrl: string = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env["GOOGLE_API_KEY"] || "";
  }

  async getCoreWebVitals(url: string, strategy: "mobile" | "desktop" = "mobile") {
    if (!this.apiKey) {
      throw new Error("Google API key not configured");
    }

    try {
      const response = await axios.get<PageSpeedResult>(this.baseUrl, {
        params: {
          url,
          key: this.apiKey,
          strategy,
          category: ["performance", "accessibility", "best-practices", "seo"],
        },
      });

      const audits = response.data.lighthouseResult.audits;
      const categories = response.data.lighthouseResult.categories;

      return {
        coreWebVitals: {
          lcp: audits["largest-contentful-paint"].numericValue / 1000, // Convert to seconds
          fid: audits["first-input-delay"]?.numericValue || 0, // FID might not be available in lab data
          cls: audits["cumulative-layout-shift"].numericValue,
          fcp: audits["first-contentful-paint"].numericValue / 1000,
          tti: audits["time-to-interactive"].numericValue / 1000,
          si: audits["speed-index"].numericValue / 1000,
        },
        scores: {
          performance: Math.round(categories.performance.score * 100),
          accessibility: Math.round(categories.accessibility.score * 100),
          bestPractices: Math.round(categories["best-practices"].score * 100),
          seo: Math.round(categories.seo.score * 100),
        },
      };
    } catch (error: any) {
      console.error("PageSpeed Insights API error:", error.response?.data || error.message);
      throw error;
    }
  }

  async getMultipleUrls(urls: string[], strategy: "mobile" | "desktop" = "mobile") {
    const results = await Promise.allSettled(
      urls.map((url) => this.getCoreWebVitals(url, strategy))
    );

    return results.map((result, index) => ({
      url: urls[index],
      status: result.status,
      data: result.status === "fulfilled" ? result.value : null,
      error: result.status === "rejected" ? result.reason.message : null,
    }));
  }
}
