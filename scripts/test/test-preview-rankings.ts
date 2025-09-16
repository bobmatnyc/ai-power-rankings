#!/usr/bin/env tsx

import fetch from "node-fetch";

async function testPreviewRankings() {
  console.log("Testing preview rankings API...\n");

  const body = {
    period: "2025-07",
    algorithm_version: "v6.0",
    preview_date: "2025-07-01",
    compare_with: "auto",
  };

  try {
    const response = await fetch("http://localhost:3000/api/admin/preview-rankings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      console.error(`Error: ${response.status} ${response.statusText}`);
      const error = await response.text();
      console.error(error);
      return;
    }

    const data = await response.json();

    console.log("Preview Response:");
    console.log("- Success:", data.success);
    console.log("- Period:", data.preview?.period);
    console.log("- Total tools:", data.preview?.total_tools);
    console.log("- New entries:", data.preview?.new_entries);
    console.log("- Comparison period:", data.preview?.comparison_period);
    console.log("- Is initial ranking:", data.preview?.is_initial_ranking);

    if (data.preview?.summary) {
      console.log("\nSummary:");
      console.log("- Tools moved up:", data.preview.summary.tools_moved_up);
      console.log("- Tools moved down:", data.preview.summary.tools_moved_down);
      console.log("- Tools stayed same:", data.preview.summary.tools_stayed_same);
      console.log("- Average score change:", data.preview.summary.average_score_change?.toFixed(2));
    }

    if (data.preview?.rankings_comparison && data.preview.rankings_comparison.length > 0) {
      console.log("\nTop 5 Rankings:");
      data.preview.rankings_comparison
        .slice(0, 5)
        .forEach(
          (r: { new_position: number; tool_name: string; new_score: number; movement: string }) => {
            console.log(
              `${r.new_position}. ${r.tool_name} - Score: ${r.new_score.toFixed(2)} (${r.movement})`
            );
          }
        );
    }
  } catch (error) {
    console.error("Failed to test preview rankings:", error);
  }
}

testPreviewRankings();
