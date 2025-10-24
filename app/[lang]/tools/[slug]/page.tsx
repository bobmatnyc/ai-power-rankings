import type { Metadata } from "next";
import { generateToolMetadata } from "./metadata";
import type { Locale } from "@/i18n/config";
import { locales } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { ToolDetailClient } from "./tool-detail-client";
import { ToolsRepository } from "@/lib/db/repositories/tools.repository";
import {
  generateToolSchema,
  generateToolReviewSchema,
  generateBreadcrumbSchema,
  createJsonLdScript,
  type ToolSchemaData,
} from "@/lib/schema";

// Force dynamic rendering to prevent build timeout
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ lang: Locale; slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;

  // Get the base metadata from the existing function
  const baseMetadata = await generateToolMetadata(slug);

  // Get the base URL
  const baseUrl = process.env["NEXT_PUBLIC_BASE_URL"] || "https://aipowerranking.com";

  // Build hreflang alternates for all supported languages
  const languages: Record<string, string> = {};
  locales.forEach((locale) => {
    languages[locale] = `${baseUrl}/${locale}/tools/${slug}`;
  });

  // Override the alternates section to fix SEO duplicate content issue
  return {
    ...baseMetadata,
    alternates: {
      // Always set canonical to the English version
      canonical: `${baseUrl}/en/tools/${slug}`,
      // Include hreflang tags for all 10 supported languages
      languages,
    },
  };
}

export default async function ToolDetailPage({ params }: PageProps): Promise<React.JSX.Element> {
  const { lang, slug } = await params;
  const dict = await getDictionary(lang as Locale);

  // Fetch tool data for schema markup
  let toolSchemaData: ToolSchemaData | null = null;
  let toolReviewSchema = null;
  let breadcrumbSchema = null;

  try {
    const toolsRepo = new ToolsRepository();
    const tool = await toolsRepo.findBySlug(slug);

    if (tool) {
      const baseUrl = process.env["NEXT_PUBLIC_BASE_URL"] || "https://aipowerranking.com";

      // Parse JSON info if available
      const jsonInfo = tool.json_info ? (typeof tool.json_info === 'string' ? JSON.parse(tool.json_info) : tool.json_info) : {};

      // Prepare tool schema data
      toolSchemaData = {
        name: tool.name,
        description: jsonInfo?.product?.tagline || jsonInfo?.product?.description || `${tool.name} - AI-powered coding tool`,
        category: tool.category || "Developer Tools",
        company: typeof jsonInfo?.company?.name === 'string' ? jsonInfo.company.name : undefined,
        website: typeof jsonInfo?.links?.website === 'string' ? jsonInfo.links.website : (typeof jsonInfo?.website === 'string' ? jsonInfo.website : undefined),
        pricing: typeof jsonInfo?.business?.pricing_model === 'string' ? jsonInfo.business.pricing_model : undefined,
        logo: typeof tool.logo_url === 'string' ? tool.logo_url : undefined,
        github: typeof jsonInfo?.links?.github === 'string' ? jsonInfo.links.github : undefined,
        rank: typeof tool.current_rank === 'number' ? tool.current_rank : undefined,
        score: typeof tool.current_score === 'number' ? tool.current_score : undefined,
        ratingCount: 100, // Default rating count for schema
      };

      // Generate schemas only if toolSchemaData is valid
      if (toolSchemaData) {
        toolReviewSchema = generateToolReviewSchema(toolSchemaData, baseUrl);
      }

      breadcrumbSchema = generateBreadcrumbSchema(
        [
          { name: "Home", url: "/" },
          { name: "Tools", url: `/${lang}/tools` },
          { name: tool.name, url: `/${lang}/tools/${slug}` },
        ],
        baseUrl
      );

      // Add tool schema to head via script tag
      if (typeof document !== 'undefined') {
        // This runs on client-side only, but we want server-side for SEO
        // So we'll return the scripts in the JSX below
      }
    }
  } catch (error) {
    console.error("Error generating tool schema:", error);
  }

  return (
    <>
      {toolSchemaData && (
        <>
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: createJsonLdScript(generateToolSchema(toolSchemaData)),
            }}
          />
          {toolReviewSchema && (
            <script
              type="application/ld+json"
              dangerouslySetInnerHTML={{
                __html: createJsonLdScript(toolReviewSchema),
              }}
            />
          )}
          {breadcrumbSchema && (
            <script
              type="application/ld+json"
              dangerouslySetInnerHTML={{
                __html: createJsonLdScript(breadcrumbSchema),
              }}
            />
          )}
        </>
      )}
      <ToolDetailClient slug={slug} lang={lang as Locale} dict={dict} />
    </>
  );
}
