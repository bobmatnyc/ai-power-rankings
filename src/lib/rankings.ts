import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"] || "";
const supabaseAnonKey = process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"] || "";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface RankingData {
  rank: number;
  tool: {
    id: string;
    name: string;
    category: string;
    status: string;
    website_url?: string;
  };
  scores: {
    overall: number;
    agentic_capability: number;
    innovation: number;
    technical_performance: number;
    developer_adoption: number;
    market_traction: number;
    business_sentiment: number;
    development_velocity: number;
    platform_resilience: number;
  };
  metrics: {
    users?: number;
    monthly_arr?: number;
    swe_bench_score?: number;
    github_stars?: number;
  };
  modifiers?: {
    innovation_decay?: number;
    platform_risk?: number;
    revenue_quality?: number;
  };
}

export async function getRankings(category?: string): Promise<RankingData[]> {
  try {
    // Get latest rankings
    const { data: latestRanking } = await supabase
      .from("rankings")
      .select("ranking_date")
      .order("ranking_date", { ascending: false })
      .limit(1)
      .single();

    if (!latestRanking) {
      return [];
    }

    // Get all rankings for the latest date
    let query = supabase
      .from("rankings")
      .select(
        `
        rank,
        overall_score,
        agentic_capability,
        innovation,
        technical_performance,
        developer_adoption,
        market_traction,
        business_sentiment,
        development_velocity,
        platform_resilience,
        innovation_decay_modifier,
        platform_risk_modifier,
        revenue_quality_modifier,
        tools!inner (
          id,
          name,
          slug,
          category,
          status,
          website_url,
          logo_url
        ),
        metrics!inner (
          users,
          monthly_arr,
          swe_bench_score,
          github_stars
        )
      `
      )
      .eq("ranking_date", latestRanking.ranking_date)
      .order("rank", { ascending: true });

    // Apply category filter if provided
    if (category && category !== "all") {
      query = query.eq("tools.category", category);
    }

    const { data: rankings, error } = await query;

    if (error) {
      console.error("Error fetching rankings:", error);
      return [];
    }

    // Transform the data to match our interface
    return (rankings || []).map((r: any) => ({
      rank: r.rank,
      tool: {
        id: r.tools.id,
        name: r.tools.name,
        category: r.tools.category,
        status: r.tools.status,
        website_url: r.tools.website_url,
      },
      scores: {
        overall: r.overall_score || 0,
        agentic_capability: r.agentic_capability || 0,
        innovation: r.innovation || 0,
        technical_performance: r.technical_performance || 0,
        developer_adoption: r.developer_adoption || 0,
        market_traction: r.market_traction || 0,
        business_sentiment: r.business_sentiment || 0,
        development_velocity: r.development_velocity || 0,
        platform_resilience: r.platform_resilience || 0,
      },
      metrics: {
        users: r.metrics?.users,
        monthly_arr: r.metrics?.monthly_arr,
        swe_bench_score: r.metrics?.swe_bench_score,
        github_stars: r.metrics?.github_stars,
      },
      modifiers: {
        innovation_decay: r.innovation_decay_modifier,
        platform_risk: r.platform_risk_modifier,
        revenue_quality: r.revenue_quality_modifier,
      },
    }));
  } catch (error) {
    console.error("Error in getRankings:", error);
    return [];
  }
}
