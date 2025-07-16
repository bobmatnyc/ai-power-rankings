import { getNewsRepo } from "@/lib/json-db";
import type { NewsArticle } from "@/lib/json-db/schemas";

export interface RSSChannel {
  title: string;
  description: string;
  link: string;
  language: string;
  lastBuildDate: string;
  items: RSSItem[];
}

export interface RSSItem {
  title: string;
  description: string;
  link: string;
  guid: string;
  pubDate: string;
  author?: string;
  category?: string[];
}

export class RSSGenerator {
  private newsRepo = getNewsRepo();

  async generateNewsFeed(lang: string = "en"): Promise<string> {
    const articles = await this.newsRepo.getAll();

    // Sort by date, newest first
    const sortedArticles = articles.sort(
      (a, b) => new Date(b.published_date).getTime() - new Date(a.published_date).getTime()
    );

    // Take latest 50 articles
    const recentArticles = sortedArticles.slice(0, 50);

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://aipowerranking.com";

    const channel: RSSChannel = {
      title: "AI Power Rankings - News & Updates",
      description:
        "Latest news and updates about AI coding tools, rankings changes, and industry developments",
      link: `${baseUrl}/${lang}/news`,
      language: lang,
      lastBuildDate: new Date().toUTCString(),
      items: recentArticles.map((article) => this.articleToRSSItem(article, baseUrl, lang)),
    };

    return this.generateXML(channel);
  }

  private articleToRSSItem(article: NewsArticle, baseUrl: string, lang: string): RSSItem {
    const categories = article.tags || [];

    return {
      title: article.title,
      description: article.summary || `${article.content.substring(0, 200)}...`,
      link: `${baseUrl}/${lang}/news/${article.slug}`,
      guid: `${baseUrl}/${lang}/news/${article.slug}`,
      pubDate: new Date(article.published_date).toUTCString(),
      author: article.author,
      category: categories,
    };
  }

  private generateXML(channel: RSSChannel): string {
    const items = channel.items
      .map(
        (item) => `
    <item>
      <title><![CDATA[${this.escapeXML(item.title)}]]></title>
      <description><![CDATA[${this.escapeXML(item.description)}]]></description>
      <link>${item.link}</link>
      <guid isPermaLink="true">${item.guid}</guid>
      <pubDate>${item.pubDate}</pubDate>
      ${item.author ? `<author><![CDATA[${this.escapeXML(item.author)}]]></author>` : ""}
      ${item.category?.map((cat) => `<category><![CDATA[${this.escapeXML(cat)}]]></category>`).join("\n      ") || ""}
    </item>`
      )
      .join("\n");

    return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title><![CDATA[${this.escapeXML(channel.title)}]]></title>
    <description><![CDATA[${this.escapeXML(channel.description)}]]></description>
    <link>${channel.link}</link>
    <language>${channel.language}</language>
    <lastBuildDate>${channel.lastBuildDate}</lastBuildDate>
    <atom:link href="${channel.link}/rss.xml" rel="self" type="application/rss+xml" />
    ${items}
  </channel>
</rss>`;
  }

  private escapeXML(str: string): string {
    if (!str) {
      return "";
    }
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }
}
