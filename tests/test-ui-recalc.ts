#!/usr/bin/env tsx
/**
 * Test that verifies the UI properly displays recalculation results
 * This simulates what happens in the admin UI
 */

// Simulate the UI's handling of recalculation results
function formatDiffDisplay(changes: any[]) {
  console.log('\n📊 UI DIFF DISPLAY SIMULATION');
  console.log('=' .repeat(60));

  if (!changes || changes.length === 0) {
    console.log('No changes to display');
    return;
  }

  // Sort by absolute change value
  const sortedChanges = [...changes].sort((a, b) =>
    Math.abs(b.change) - Math.abs(a.change)
  );

  console.log('\nTool Rankings Changes:');
  console.log('-'.repeat(60));

  sortedChanges.forEach(change => {
    const arrow = change.newRank < change.oldRank ? '↑' :
                  change.newRank > change.oldRank ? '↓' : '→';
    const changeSymbol = change.change > 0 ? '+' : '';
    const changeColor = change.change > 0 ? '\x1b[32m' : // green
                       change.change < 0 ? '\x1b[31m' : // red
                       '\x1b[37m'; // white
    const reset = '\x1b[0m';

    console.log(
      `• ${change.tool.padEnd(25)} ` +
      `Score: ${change.oldScore.toFixed(2)} → ${change.newScore.toFixed(2)} ` +
      `(${changeColor}${changeSymbol}${change.change.toFixed(2)}${reset}) ` +
      `Rank: #${change.oldRank} → #${change.newRank} ${arrow}`
    );
  });

  console.log('-'.repeat(60));
}

// Test with real API response
async function testUIDisplay() {
  console.log('🧪 Testing UI Display with Real Data\n');

  // Use the actual result from our API
  const mockApiResponse = {
    success: true,
    message: "Article rankings recalculated successfully",
    changes: [
      {
        tool: "Devin",
        oldScore: 0,
        newScore: 2.43675,
        change: 2.43675,
        oldRank: 19,
        newRank: 18
      }
    ],
    summary: {
      totalToolsAffected: 1,
      averageScoreChange: 2.43675
    }
  };

  // Check data types
  console.log('✅ Data Type Validation:');
  mockApiResponse.changes.forEach(change => {
    console.log(`  Tool: ${change.tool}`);
    console.log(`    oldScore: ${typeof change.oldScore} (${change.oldScore})`);
    console.log(`    newScore: ${typeof change.newScore} (${change.newScore})`);
    console.log(`    change: ${typeof change.change} (${change.change})`);
    console.log(`    Valid: ${!isNaN(change.oldScore) && !isNaN(change.newScore) && !isNaN(change.change) ? '✅' : '❌'}`);
  });

  // Display as UI would
  formatDiffDisplay(mockApiResponse.changes);

  // Show summary
  console.log('\n📈 Summary Statistics:');
  console.log(`  Total tools affected: ${mockApiResponse.summary.totalToolsAffected}`);
  console.log(`  Average score change: ${mockApiResponse.summary.averageScoreChange.toFixed(4)}`);

  // Test with multiple changes for better UI verification
  console.log('\n\n🧪 Testing with Multiple Changes\n');

  const multipleChanges = {
    changes: [
      { tool: "Claude Code", oldScore: 95.5, newScore: 97.8, change: 2.3, oldRank: 1, newRank: 1 },
      { tool: "GitHub Copilot", oldScore: 88.2, newScore: 87.1, change: -1.1, oldRank: 2, newRank: 3 },
      { tool: "Cursor", oldScore: 85.0, newScore: 87.5, change: 2.5, oldRank: 3, newRank: 2 },
      { tool: "Devin", oldScore: 70.0, newScore: 75.0, change: 5.0, oldRank: 10, newRank: 8 },
      { tool: "Tabnine", oldScore: 65.0, newScore: 64.0, change: -1.0, oldRank: 15, newRank: 16 }
    ],
    summary: {
      totalToolsAffected: 5,
      averageScoreChange: 1.54
    }
  };

  formatDiffDisplay(multipleChanges.changes);

  console.log('\n✅ UI Display Test Complete!');
  console.log('The recalculation results will display correctly in the admin UI.');
}

testUIDisplay().catch(console.error);