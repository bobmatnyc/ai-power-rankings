#!/usr/bin/env tsx
/**
 * Test the recalculation API endpoint to ensure it returns proper diff data
 */

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

function log(message: string, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

async function testRecalcAPI() {
  try {
    // First get the most recent article
    log('\nFetching articles list...', colors.cyan);
    const listResponse = await fetch('http://localhost:3001/api/admin/articles?limit=1', {
      headers: {
        'Cookie': 'admin_auth=true'  // Assuming auth is set
      }
    });

    if (!listResponse.ok) {
      throw new Error(`Failed to fetch articles: ${listResponse.status}`);
    }

    const response = await listResponse.json();
    if (!response.articles || response.articles.length === 0) {
      log('No articles found!', colors.red);
      process.exit(1);
    }

    const articleId = response.articles[0].id;
    log(`Testing with article ID: ${articleId}`, colors.green);

    // Call the recalculate endpoint
    log('\nCalling recalculation endpoint...', colors.cyan);
    const recalcResponse = await fetch(
      `http://localhost:3001/api/admin/articles/${articleId}/recalculate`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': 'admin_auth=true'
        }
      }
    );

    if (!recalcResponse.ok) {
      const errorText = await recalcResponse.text();
      throw new Error(`Recalculation failed: ${recalcResponse.status} - ${errorText}`);
    }

    // Read the SSE stream
    const reader = recalcResponse.body?.getReader();
    const decoder = new TextDecoder();
    let result: any = null;

    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              if (parsed.type === 'progress') {
                process.stdout.write(`\r${colors.cyan}Progress: ${parsed.percentage}% - ${parsed.message}${colors.reset}`);
              } else if (parsed.type === 'complete') {
                result = parsed.result;
                console.log('\n');
              }
            } catch (e) {
              // Ignore parsing errors for non-JSON lines
            }
          }
        }
      }
    }

    if (!result) {
      throw new Error('No result received from recalculation');
    }

    // Validate the result
    log('\n' + '='.repeat(60), colors.bright + colors.cyan);
    log('RECALCULATION RESULT', colors.bright + colors.cyan);
    log('='.repeat(60), colors.bright + colors.cyan);

    log(`\nTotal tools affected: ${result.summary.totalToolsAffected}`, colors.green);
    log(`Average score change: ${result.summary.averageScoreChange.toFixed(4)}`, colors.green);

    // Check data integrity
    log('\nData Integrity Check:', colors.yellow);
    let hasIssues = false;

    for (const change of result.changes) {
      const issues: string[] = [];

      if (typeof change.oldScore !== 'number' || isNaN(change.oldScore)) {
        issues.push('oldScore is not a valid number');
      }
      if (typeof change.newScore !== 'number' || isNaN(change.newScore)) {
        issues.push('newScore is not a valid number');
      }
      if (typeof change.change !== 'number' || isNaN(change.change)) {
        issues.push('change is not a valid number');
      }

      if (issues.length > 0) {
        hasIssues = true;
        log(`  ❌ ${change.tool}: ${issues.join(', ')}`, colors.red);
      } else {
        log(`  ✅ ${change.tool}: Valid`, colors.green);
      }
    }

    // Show sample changes
    if (result.changes.length > 0) {
      log('\nSample Changes:', colors.yellow);
      const sampleChanges = result.changes.slice(0, 3);
      for (const change of sampleChanges) {
        const symbol = change.change > 0 ? '+' : '';
        const color = change.change > 0 ? colors.green : change.change < 0 ? colors.red : colors.reset;
        log(`  ${change.tool}: ${change.oldScore.toFixed(2)} → ${change.newScore.toFixed(2)} (${color}${symbol}${change.change.toFixed(2)}${colors.reset})`);
      }
    }

    // Final verdict
    log('\n' + '='.repeat(60), colors.bright);
    if (hasIssues) {
      log('❌ API TEST FAILED: Data integrity issues detected', colors.red);
      process.exit(1);
    } else {
      log('✅ API TEST PASSED: All data is valid!', colors.green);
      log('The API is returning proper numeric values in the diff.', colors.green);
    }

  } catch (error) {
    log(`\n❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`, colors.red);
    console.error(error);
    process.exit(1);
  }
}

// Check if server is running
log('Testing Recalculation API Endpoint', colors.bright + colors.cyan);
log('Make sure the dev server is running on port 3001', colors.yellow);

testRecalcAPI();