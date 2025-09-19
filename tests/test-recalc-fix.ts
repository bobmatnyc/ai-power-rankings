#!/usr/bin/env tsx
/**
 * Test script to verify recalculation returns proper diff data
 * Tests the fix for missing tools and rankings diff display
 */

import { ArticleDatabaseService } from '../src/lib/services/article-db-service';
import { ArticlesRepository } from '../src/lib/db/repositories/articles.repository';

// Styled console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
};

function log(message: string, color = colors.white) {
  console.log(`${color}${message}${colors.reset}`);
}

function logSection(title: string) {
  console.log(`\n${colors.bright}${colors.cyan}${'='.repeat(60)}${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}${title}${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}${'='.repeat(60)}${colors.reset}\n`);
}

function logSubsection(title: string) {
  console.log(`\n${colors.yellow}${'-'.repeat(40)}${colors.reset}`);
  console.log(`${colors.yellow}${title}${colors.reset}`);
  console.log(`${colors.yellow}${'-'.repeat(40)}${colors.reset}\n`);
}

async function testRecalculation() {
  try {
    logSection('Testing Recalculation Fix');

    // Initialize service and repository
    const articleService = new ArticleDatabaseService();
    const articlesRepo = new ArticlesRepository();

    // Get the most recent article to test with
    log('Fetching most recent article...', colors.blue);
    const recentArticles = await articlesRepo.getArticles({ limit: 1 });

    if (!recentArticles.length) {
      log('No articles found to test with!', colors.red);
      process.exit(1);
    }

    const testArticle = recentArticles[0];
    log(`Testing with article: "${testArticle.title}"`, colors.green);
    log(`Article ID: ${testArticle.id}`, colors.dim);

    // Perform recalculation with progress tracking
    logSubsection('Starting Recalculation');

    const result = await articleService.recalculateArticleRankingsWithProgress(
      testArticle.id,
      (percentage, message) => {
        const progressBar = '█'.repeat(Math.floor(percentage / 5)) + '░'.repeat(20 - Math.floor(percentage / 5));
        process.stdout.write(`\r${colors.cyan}[${progressBar}] ${percentage}% - ${message}${colors.reset}`);
      }
    );

    console.log('\n'); // New line after progress

    // Validate and display results
    logSubsection('Recalculation Results');

    log(`Total tools affected: ${result.summary.totalToolsAffected}`, colors.green);
    log(`Average score change: ${result.summary.averageScoreChange.toFixed(4)}`, colors.green);

    // Check for data integrity
    logSubsection('Data Integrity Check');

    let hasIssues = false;
    const validationResults: string[] = [];

    result.changes.forEach((change) => {
      const issues: string[] = [];

      // Check for NaN or undefined values
      if (isNaN(change.oldScore)) issues.push('oldScore is NaN');
      if (isNaN(change.newScore)) issues.push('newScore is NaN');
      if (isNaN(change.change)) issues.push('change is NaN');
      if (change.oldScore === undefined) issues.push('oldScore is undefined');
      if (change.newScore === undefined) issues.push('newScore is undefined');
      if (change.change === undefined) issues.push('change is undefined');

      // Verify change calculation
      const calculatedChange = change.newScore - change.oldScore;
      if (Math.abs(calculatedChange - change.change) > 0.0001) {
        issues.push(`change mismatch: calculated=${calculatedChange.toFixed(4)}, reported=${change.change.toFixed(4)}`);
      }

      if (issues.length > 0) {
        hasIssues = true;
        validationResults.push(`❌ ${change.tool}: ${issues.join(', ')}`);
      } else {
        validationResults.push(`✅ ${change.tool}: All values valid`);
      }
    });

    // Display validation results
    validationResults.forEach(result => {
      const color = result.startsWith('✅') ? colors.green : colors.red;
      log(result, color);
    });

    // Display detailed changes
    logSubsection('Detailed Changes (Top 10)');

    const sortedChanges = [...result.changes]
      .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
      .slice(0, 10);

    console.log(`${colors.bright}Tool Name                    Old Score  New Score  Change     Old Rank  New Rank${colors.reset}`);
    console.log(`${colors.dim}${'─'.repeat(80)}${colors.reset}`);

    sortedChanges.forEach(change => {
      const changeColor = change.change > 0 ? colors.green : change.change < 0 ? colors.red : colors.white;
      const changeSymbol = change.change > 0 ? '+' : '';
      const rankChangeSymbol = (change.newRank || 0) < (change.oldRank || 0) ? '↑' : (change.newRank || 0) > (change.oldRank || 0) ? '↓' : '→';

      console.log(
        `${colors.white}${change.tool.padEnd(28)}${colors.reset} ` +
        `${colors.dim}${change.oldScore.toFixed(4).padStart(9)}${colors.reset}  ` +
        `${colors.bright}${change.newScore.toFixed(4).padStart(9)}${colors.reset}  ` +
        `${changeColor}${changeSymbol}${change.change.toFixed(4).padStart(9)}${colors.reset}  ` +
        `${colors.dim}${String(change.oldRank).padStart(8)}${colors.reset}  ` +
        `${colors.bright}${String(change.newRank).padStart(8)} ${rankChangeSymbol}${colors.reset}`
      );
    });

    // Final status
    logSection('Test Result');

    if (hasIssues) {
      log('❌ TEST FAILED: Some values have issues', colors.red);
      log('The diff data structure still has problems that need fixing.', colors.red);
      process.exit(1);
    } else {
      log('✅ TEST PASSED: All values are valid!', colors.green);
      log('The recalculation is returning proper numeric values.', colors.green);
      log(`Successfully validated ${result.changes.length} tool changes.`, colors.green);

      // Log sample JSON for verification
      logSubsection('Sample JSON Output (First 3 Changes)');
      console.log(JSON.stringify(result.changes.slice(0, 3), null, 2));
    }

  } catch (error) {
    logSection('Test Error');
    log(`Error during test: ${error instanceof Error ? error.message : 'Unknown error'}`, colors.red);
    console.error(error);
    process.exit(1);
  }
}

// Run the test
testRecalculation().then(() => {
  process.exit(0);
}).catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});