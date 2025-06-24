/**
 * Payload CMS API Service Layer
 * This replaces direct Supabase queries with Payload API calls
 */

// Use the app's base URL for API calls
const getBaseUrl = () => {
  if (typeof window !== 'undefined') {
    // Browser should use relative path
    return ''
  }
  if (process.env["VERCEL_URL"]) {
    // Reference for vercel.com deployments
    return `https://${process.env["VERCEL_URL"]}`
  }
  if (process.env["NEXT_PUBLIC_PAYLOAD_URL"]) {
    // Use explicit Payload URL if set
    return process.env["NEXT_PUBLIC_PAYLOAD_URL"]
  }
  // Assume localhost
  return `http://localhost:${process.env["PORT"] ?? 3000}`
}

const API_BASE = `${getBaseUrl()}/api`

export interface PayloadResponse<T> {
  docs: T[]
  totalDocs: number
  limit: number
  totalPages: number
  page: number
  pagingCounter: number
  hasPrevPage: boolean
  hasNextPage: boolean
  prevPage: number | null
  nextPage: number | null
}

export interface Tool {
  id: string
  name: string
  slug: string
  display_name?: string
  company: any
  category: string
  subcategory?: string
  description?: any
  tagline?: string
  website_url?: string
  github_repo?: string
  documentation_url?: string
  founded_date?: string
  first_tracked_date?: string
  pricing_model: string
  license_type: string
  status: string
  logo_url?: string
  screenshot_url?: string
  is_featured: boolean
  current_ranking?: number
  the_real_story?: any
  competitive_analysis?: any
  key_developments?: any
  notable_events?: any
  createdAt: string
  updatedAt: string
}

export interface Company {
  id: string
  name: string
  slug: string
  website_url?: string
  headquarters?: string
  founded_year?: number
  company_size?: string
  company_type?: string
  parent_company?: any
  logo_url?: string
  description?: any
  createdAt: string
  updatedAt: string
}

export interface Ranking {
  id: string
  period: string
  tool: any
  position: number
  score: number
  market_traction_score?: number
  technical_capability_score?: number
  developer_adoption_score?: number
  development_velocity_score?: number
  platform_resilience_score?: number
  community_sentiment_score?: number
  previous_position?: number
  movement?: string
  movement_positions?: number
  algorithm_version: string
  data_completeness?: number
  createdAt: string
  updatedAt: string
}

export interface Metric {
  id: string
  tool: any
  metric_key: string
  value_integer?: number
  value_decimal?: number
  value_text?: string
  value_boolean?: boolean
  value_json?: any
  recorded_at: string
  collected_at?: string
  source?: string
  source_url?: string
  confidence_score: number
  notes?: string
  is_estimate: boolean
  createdAt: string
  updatedAt: string
}

export interface News {
  id: string
  headline: string
  slug: string
  summary?: string
  published_at: string
  source: string
  source_url?: string
  author?: string
  tags?: string[]
  category?: string
  sentiment_score?: number
  impact_level?: string
  is_featured: boolean
  image_url?: string
  related_tools?: any
  content?: any
  external_links?: any
  createdAt: string
  updatedAt: string
}

class PayloadAPI {
  private async fetchAPI<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${API_BASE}${endpoint}`
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    })

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`)
    }

    return response.json()
  }

  // Tools
  async getTools(params?: {
    limit?: number
    page?: number
    where?: any
    sort?: string
  }): Promise<PayloadResponse<Tool>> {
    const searchParams = new URLSearchParams()
    if (params?.limit) {
      searchParams.append('limit', params.limit.toString())
    }
    if (params?.page) {
      searchParams.append('page', params.page.toString())
    }
    if (params?.where) {
      searchParams.append('where', JSON.stringify(params.where))
    }
    if (params?.sort) {
      searchParams.append('sort', params.sort)
    }

    return this.fetchAPI<PayloadResponse<Tool>>(`/tools?${searchParams}`)
  }

  async getTool(idOrSlug: string): Promise<Tool> {
    // First try to get by ID
    try {
      return await this.fetchAPI<Tool>(`/tools/${idOrSlug}`)
    } catch {
      // If not found by ID, try by slug
      const response = await this.getTools({
        where: { slug: { equals: idOrSlug } },
        limit: 1
      })
      if (response.docs.length === 0) {
        throw new Error('Tool not found')
      }
      return response.docs[0]!
    }
  }

  // Rankings
  async getRankings(params?: {
    period?: string
    limit?: number
    page?: number
    sort?: string
  }): Promise<PayloadResponse<Ranking>> {
    const searchParams = new URLSearchParams()
    if (params?.period) {
      searchParams.append('where[period][equals]', params.period)
    }
    if (params?.limit) {
      searchParams.append('limit', params.limit.toString())
    }
    if (params?.page) {
      searchParams.append('page', params.page.toString())
    }
    if (params?.sort) {
      searchParams.append('sort', params.sort)
    }

    return this.fetchAPI<PayloadResponse<Ranking>>(`/rankings?${searchParams}`)
  }

  async getCurrentRankings(): Promise<Ranking[]> {
    // Get the most recent period's rankings
    const response = await this.getRankings({
      sort: '-position',
      limit: 100
    })
    return response.docs
  }

  // Companies
  async getCompanies(params?: {
    limit?: number
    page?: number
    where?: any
    sort?: string
  }): Promise<PayloadResponse<Company>> {
    const searchParams = new URLSearchParams()
    if (params?.limit) {
      searchParams.append('limit', params.limit.toString())
    }
    if (params?.page) {
      searchParams.append('page', params.page.toString())
    }
    if (params?.where) {
      searchParams.append('where', JSON.stringify(params.where))
    }
    if (params?.sort) {
      searchParams.append('sort', params.sort)
    }

    return this.fetchAPI<PayloadResponse<Company>>(`/companies?${searchParams}`)
  }

  async getCompany(idOrSlug: string): Promise<Company> {
    try {
      return await this.fetchAPI<Company>(`/companies/${idOrSlug}`)
    } catch {
      const response = await this.getCompanies({
        where: { slug: { equals: idOrSlug } },
        limit: 1
      })
      if (response.docs.length === 0) {
        throw new Error('Company not found')
      }
      return response.docs[0]!
    }
  }

  // Metrics
  async getMetrics(params?: {
    tool?: string
    metric_key?: string
    limit?: number
    page?: number
    sort?: string
  }): Promise<PayloadResponse<Metric>> {
    const searchParams = new URLSearchParams()
    if (params?.tool) {
      searchParams.append('where[tool][equals]', params.tool)
    }
    if (params?.metric_key) {
      searchParams.append('where[metric_key][equals]', params.metric_key)
    }
    if (params?.limit) {
      searchParams.append('limit', params.limit.toString())
    }
    if (params?.page) {
      searchParams.append('page', params.page.toString())
    }
    if (params?.sort) {
      searchParams.append('sort', params.sort)
    }

    return this.fetchAPI<PayloadResponse<Metric>>(`/metrics?${searchParams}`)
  }

  // News
  async getNews(params?: {
    limit?: number
    page?: number
    featured?: boolean
    sort?: string
  }): Promise<PayloadResponse<News>> {
    const searchParams = new URLSearchParams()
    if (params?.limit) {
      searchParams.append('limit', params.limit.toString())
    }
    if (params?.page) {
      searchParams.append('page', params.page.toString())
    }
    if (params?.featured !== undefined) {
      searchParams.append('where[is_featured][equals]', params.featured.toString())
    }
    if (params?.sort) {
      searchParams.append('sort', params.sort)
    }

    return this.fetchAPI<PayloadResponse<News>>(`/news?${searchParams}`)
  }

  async getNewsItem(idOrSlug: string): Promise<News> {
    try {
      return await this.fetchAPI<News>(`/news/${idOrSlug}`)
    } catch {
      // Try by slug using direct API query
      const searchParams = new URLSearchParams()
      searchParams.append('where[slug][equals]', idOrSlug)
      searchParams.append('limit', '1')
      
      const response = await this.fetchAPI<PayloadResponse<News>>(`/news?${searchParams}`)
      if (response.docs.length === 0) {
        throw new Error('News item not found')
      }
      return response.docs[0]!
    }
  }

  // Site Settings (Global)
  async getSiteSettings(): Promise<any> {
    return this.fetchAPI<any>(`/globals/site-settings`)
  }
}

// Export singleton instance
export const payloadAPI = new PayloadAPI()

// Export convenience functions that match Supabase patterns
export const payload = {
  from: (collection: string) => {
    return {
      select: () => {
        return {
          eq: (field: string, value: any) => {
            return {
              single: async () => {
                // This is a simplified implementation
                // In real usage, you'd need to map this to proper Payload API calls
                switch (collection) {
                  case 'tools':
                    return { data: await payloadAPI.getTool(value), error: null }
                  case 'companies':
                    return { data: await payloadAPI.getCompany(value), error: null }
                  default:
                    return { data: null, error: new Error('Collection not implemented') }
                }
              },
              execute: async () => {
                // Execute the query based on collection
                switch (collection) {
                  case 'tools':
                    return { data: await payloadAPI.getTools({ where: { [field]: { equals: value } } }), error: null }
                  case 'rankings':
                    return { data: await payloadAPI.getRankings({ period: value }), error: null }
                  default:
                    return { data: null, error: new Error('Collection not implemented') }
                }
              }
            }
          },
          order: (field: string, options?: { ascending?: boolean }) => {
            const sort = options?.ascending ? field : `-${field}`
            return {
              limit: (limit: number) => {
                return {
                  execute: async () => {
                    switch (collection) {
                      case 'tools':
                        return { data: (await payloadAPI.getTools({ limit, sort })).docs, error: null }
                      case 'rankings':
                        return { data: (await payloadAPI.getRankings({ limit, sort })).docs, error: null }
                      case 'news':
                        return { data: (await payloadAPI.getNews({ limit, sort })).docs, error: null }
                      default:
                        return { data: null, error: new Error('Collection not implemented') }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}