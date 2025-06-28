import { NextRequest, NextResponse } from "next/server";
import { loggers } from "@/lib/logger";
import { getToolsRepo, getRankingsRepo } from "@/lib/json-db";

interface RankingComparison {
  tool_id: string;
  tool_name: string;
  current_position?: number;
  new_position: number;
  current_score?: number;
  new_score: number;
  position_change: number;
  score_change: number;
  movement: 'up' | 'down' | 'same' | 'new' | 'dropped';
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { 
      period, 
      algorithm_version = "v6.0", 
      preview_date,
      compare_with 
    } = body;
    
    loggers.api.info("Preview rankings JSON request received", { body });
    
    if (!period) {
      return NextResponse.json(
        { error: "Period parameter is required" },
        { status: 400 }
      );
    }

    // For now, return a simplified preview using existing data
    const toolsRepo = getToolsRepo();
    const rankingsRepo = getRankingsRepo();
    
    // Get comparison period
    let comparisonPeriod = compare_with;
    let currentRankings: any[] = [];
    
    if (compare_with === "auto" || !compare_with) {
      const availablePeriods = await rankingsRepo.getPeriods();
      for (const p of availablePeriods) {
        if (p < period) {
          comparisonPeriod = p;
          break;
        }
      }
    }

    // Get current rankings if available
    if (comparisonPeriod && comparisonPeriod !== "none") {
      const periodData = await rankingsRepo.getRankingsForPeriod(comparisonPeriod);
      if (periodData) {
        currentRankings = periodData.rankings;
      }
    }

    // Get all active tools
    const tools = await toolsRepo.getByStatus('active');
    
    // For preview, we'll simulate rankings with random scores
    const comparisons: RankingComparison[] = [];
    const currentRankingsMap = new Map(currentRankings.map(r => [r.tool_id, r]));
    
    // Generate preview rankings
    const newRankings = tools.map((tool, index) => {
      const currentRanking = currentRankingsMap.get(tool.id);
      const newPosition = index + 1;
      const currentPosition = currentRanking?.position;
      
      // Simulate a score (in real implementation, this would come from ranking algorithm)
      const newScore = 100 - (index * 2) + Math.random() * 5;
      const currentScore = currentRanking?.score;
      
      let positionChange = 0;
      let movement: RankingComparison['movement'] = 'new';
      
      if (currentPosition) {
        positionChange = currentPosition - newPosition;
        if (positionChange > 0) {
          movement = 'up';
        } else if (positionChange < 0) {
          movement = 'down';
        } else {
          movement = 'same';
        }
      }
      
      const scoreChange = currentScore ? newScore - currentScore : newScore;
      
      comparisons.push({
        tool_id: tool.id,
        tool_name: tool.name,
        current_position: currentPosition,
        new_position: newPosition,
        current_score: currentScore,
        new_score: newScore,
        position_change: positionChange,
        score_change: scoreChange,
        movement,
      });
      
      return {
        tool_id: tool.id,
        tool_name: tool.name,
        position: newPosition,
        score: newScore,
      };
    });

    // Generate summary
    const summary = {
      tools_moved_up: comparisons.filter(c => c.movement === 'up').length,
      tools_moved_down: comparisons.filter(c => c.movement === 'down').length,
      tools_stayed_same: comparisons.filter(c => c.movement === 'same').length,
      average_score_change: comparisons.reduce((sum, c) => sum + c.score_change, 0) / comparisons.length,
      highest_score: Math.max(...comparisons.map(c => c.new_score)),
      lowest_score: Math.min(...comparisons.map(c => c.new_score)),
    };

    const result = {
      period,
      algorithm_version,
      total_tools: tools.length,
      new_entries: comparisons.filter(c => c.movement === 'new').length,
      dropped_entries: 0,
      rankings_comparison: comparisons,
      top_10_changes: comparisons.slice(0, 10),
      biggest_movers: {
        up: comparisons.filter(c => c.movement === 'up').sort((a, b) => b.position_change - a.position_change).slice(0, 5),
        down: comparisons.filter(c => c.movement === 'down').sort((a, b) => a.position_change - b.position_change).slice(0, 5),
      },
      summary,
      comparison_period: comparisonPeriod,
      is_initial_ranking: !comparisonPeriod || currentRankings.length === 0,
    };

    loggers.api.info("Preview rankings generated", { 
      period, 
      total_tools: result.total_tools 
    });

    return NextResponse.json({
      success: true,
      preview: result,
    });

  } catch (error) {
    loggers.api.error("Failed to generate preview rankings", { error });
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}