/**
 * Template Literal Types for Paths and Routes
 * Provides compile-time validation for URLs and paths
 */

// ==================== Locale Types ====================

export type Locale = "en" | "de" | "ja" | "fr" | "es" | "zh";

export type LocaleSlug = `/${Locale}`;

// ==================== API Path Types ====================

export type APIPath = `/api/${string}`;

export type APIVersion = "v1" | "v2";

export type VersionedAPIPath<V extends APIVersion = APIVersion> = `/api/${V}/${string}`;

// ==================== Localized Path Types ====================

export type LocalizedPath = `/${Locale}/${string}`;

export type LocalizedRootPath = LocaleSlug;

export type LocalizedPagePath<T extends string = string> = `/${Locale}/${T}`;

// ==================== App Route Types ====================

export type AppRoute = "/" | "/tools" | "/rankings" | "/news" | "/about" | "/admin" | "/api-docs";

export type DynamicRoute<T extends string = string> = `${AppRoute}/${T}`;

export type LocalizedAppRoute = LocalizedPagePath<AppRoute extends `/${infer R}` ? R : never>;

// ==================== Tool and Company Routes ====================

export type ToolSlug = string;
export type CompanySlug = string;

export type ToolRoute = `/tools/${ToolSlug}`;
export type CompanyRoute = `/companies/${CompanySlug}`;

export type LocalizedToolRoute = `/${Locale}/tools/${ToolSlug}`;
export type LocalizedCompanyRoute = `/${Locale}/companies/${CompanySlug}`;

// ==================== News and Article Routes ====================

export type ArticleSlug = string;
export type NewsCategory = "ai-tools" | "releases" | "industry" | "reviews" | "tutorials";

export type NewsRoute = `/news/${ArticleSlug}`;
export type NewsCategoryRoute = `/news/category/${NewsCategory}`;

export type LocalizedNewsRoute = `/${Locale}/news/${ArticleSlug}`;
export type LocalizedNewsCategoryRoute = `/${Locale}/news/category/${NewsCategory}`;

// ==================== Admin Routes ====================

export type AdminSection = "dashboard" | "tools" | "articles" | "rankings" | "users" | "settings";

export type AdminRoute = `/admin/${AdminSection}`;
export type AdminSubRoute<T extends string = string> = `/admin/${AdminSection}/${T}`;

// ==================== API Endpoint Types ====================

export type ToolAPIEndpoint = `/api/tools/${ToolSlug}`;
export type CompanyAPIEndpoint = `/api/companies/${CompanySlug}`;
export type ArticleAPIEndpoint = `/api/articles/${ArticleSlug}`;

export type RankingsAPIEndpoint =
  | "/api/rankings"
  | "/api/rankings/current"
  | "/api/rankings/history";

export type NewsAPIEndpoint = "/api/news" | "/api/news/recent" | `/api/news/${ArticleSlug}`;

// ==================== Asset Path Types ====================

export type AssetPath = `/assets/${string}`;
export type ImagePath = `/images/${string}`;
export type IconPath = `/icons/${string}`;

export type StaticAsset = AssetPath | ImagePath | IconPath;

// ==================== SEO and Sitemap Types ====================

export type SitemapPath = "/sitemap.xml" | `/sitemap-${Locale}.xml`;
export type RobotsTxtPath = "/robots.txt";
export type ManifestPath = "/manifest.json";

// ==================== URL Construction Helpers ====================

/**
 * Construct a localized path
 */
export function localizedPath<T extends string>(locale: Locale, path: T): `/${Locale}/${T}` {
  return `/${locale}/${path}` as const;
}

/**
 * Construct a tool route
 */
export function toolPath(slug: ToolSlug): ToolRoute {
  return `/tools/${slug}` as const;
}

/**
 * Construct a localized tool route
 */
export function localizedToolPath(locale: Locale, slug: ToolSlug): LocalizedToolRoute {
  return `/${locale}/tools/${slug}` as const;
}

/**
 * Construct a company route
 */
export function companyPath(slug: CompanySlug): CompanyRoute {
  return `/companies/${slug}` as const;
}

/**
 * Construct a localized company route
 */
export function localizedCompanyPath(locale: Locale, slug: CompanySlug): LocalizedCompanyRoute {
  return `/${locale}/companies/${slug}` as const;
}

/**
 * Construct a news route
 */
export function newsPath(slug: ArticleSlug): NewsRoute {
  return `/news/${slug}` as const;
}

/**
 * Construct a localized news route
 */
export function localizedNewsPath(locale: Locale, slug: ArticleSlug): LocalizedNewsRoute {
  return `/${locale}/news/${slug}` as const;
}

/**
 * Construct an admin route
 */
export function adminPath(section: AdminSection): AdminRoute {
  return `/admin/${section}` as const;
}

/**
 * Construct an API endpoint
 */
export function apiPath(endpoint: string): APIPath {
  return `/api/${endpoint}` as const;
}

/**
 * Construct a versioned API endpoint
 */
export function versionedApiPath<V extends APIVersion>(
  version: V,
  endpoint: string
): VersionedAPIPath<V> {
  return `/api/${version}/${endpoint}` as const;
}

// ==================== Path Validation ====================

/**
 * Type guard for API paths
 */
export function isAPIPath(path: string): path is APIPath {
  return path.startsWith("/api/");
}

/**
 * Type guard for localized paths
 */
export function isLocalizedPath(path: string): path is LocalizedPath {
  const locales: readonly Locale[] = ["en", "de", "ja", "fr", "es", "zh"];
  const segments = path.split("/");
  return segments.length >= 2 && locales.includes(segments[1] as Locale);
}

/**
 * Extract locale from localized path
 */
export function extractLocale(path: LocalizedPath): Locale {
  const segments = path.split("/");
  return segments[1] as Locale;
}

/**
 * Extract path without locale
 */
export function stripLocale(path: LocalizedPath): string {
  const segments = path.split("/");
  return "/" + segments.slice(2).join("/");
}

// ==================== Route Parameters ====================

export interface RouteParams {
  locale?: Locale;
  slug?: string;
  category?: NewsCategory;
  section?: AdminSection;
}

export interface ToolRouteParams extends RouteParams {
  slug: ToolSlug;
}

export interface CompanyRouteParams extends RouteParams {
  slug: CompanySlug;
}

export interface NewsRouteParams extends RouteParams {
  slug: ArticleSlug;
}

export interface NewsCategoryRouteParams extends RouteParams {
  category: NewsCategory;
}

export interface AdminRouteParams extends RouteParams {
  section: AdminSection;
}

// ==================== Next.js Specific Types ====================

/**
 * Next.js dynamic route segment
 */
export type DynamicSegment<T extends string = string> = `[${T}]`;

/**
 * Next.js catch-all route segment
 */
export type CatchAllSegment<T extends string = string> = `[...${T}]`;

/**
 * Next.js optional catch-all route segment
 */
export type OptionalCatchAllSegment<T extends string = string> = `[[...${T}]]`;

// ==================== URL Search Params ====================

export type SearchParam = string | string[] | undefined;

export interface SearchParams {
  readonly [key: string]: SearchParam;
}

export interface ToolSearchParams extends SearchParams {
  readonly category?: string;
  readonly search?: string;
  readonly sort?: "name" | "rank" | "score";
  readonly order?: "asc" | "desc";
  readonly page?: string;
}

export interface NewsSearchParams extends SearchParams {
  readonly category?: NewsCategory;
  readonly search?: string;
  readonly author?: string;
  readonly date?: string;
  readonly page?: string;
}

// All types are already exported above, no need to re-export
