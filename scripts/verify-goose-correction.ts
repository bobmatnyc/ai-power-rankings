#!/usr/bin/env tsx
/**
 * Verify Goose Ranking Correction
 *
 * Confirms that all corrections have been applied correctly
 * and validates the ranking data integrity.
 */

import { getDb } from '../lib/db/connection';
import { rankings } from '../lib/db/schema';
import { eq } from 'drizzle-orm';

interface ValidationResult {
  test: string;
  expected: any;
  actual: any;
  passed: boolean;
}

async function verifyGooseCorrection() {
  const db = getDb();
  if (db === null) {
    console.log('❌ No database connection');
    process.exit(1);
  }

  console.log('\n🔍 Verifying Goose Ranking Correction\n');
  console.log('━'.repeat(60));
  console.log('');

  const results: ValidationResult[] = [];

  try {
    // Get current rankings
    const currentRankings = await db
      .select()
      .from(rankings)
      .where(eq(rankings.isCurrent, true))
      .limit(1);

    if (currentRankings.length === 0) {
      console.error('❌ No current rankings found');
      process.exit(1);
    }

    const ranking = currentRankings[0];
    const rankingsData = ranking.data as any[];

    // Find Goose
    const goose = rankingsData.find((r: any) => r.tool_slug === 'goose');

    if (!goose) {
      console.log('❌ Goose not found in rankings');
      process.exit(1);
    }

    console.log('📊 Running Validation Tests...\n');

    // Test 1: Overall Score
    results.push({
      test: 'Overall Score',
      expected: 71,
      actual: goose.score,
      passed: goose.score === 71,
    });

    // Test 2: Tier Classification
    results.push({
      test: 'Tier Classification',
      expected: 'B',
      actual: goose.tier,
      passed: goose.tier === 'B',
    });

    // Test 3: Market Traction
    results.push({
      test: 'Market Traction Score',
      expected: 63.0,
      actual: goose.factor_scores?.marketTraction,
      passed: goose.factor_scores?.marketTraction === 63.0,
    });

    // Test 4: Business Sentiment
    results.push({
      test: 'Business Sentiment Score',
      expected: 71.4,
      actual: goose.factor_scores?.businessSentiment,
      passed: goose.factor_scores?.businessSentiment === 71.4,
    });

    // Test 5: Development Velocity
    results.push({
      test: 'Development Velocity Score',
      expected: 58.8,
      actual: goose.factor_scores?.developmentVelocity,
      passed: goose.factor_scores?.developmentVelocity === 58.8,
    });

    // Test 6: Innovation
    results.push({
      test: 'Innovation Score',
      expected: 78,
      actual: goose.factor_scores?.innovation,
      passed: goose.factor_scores?.innovation === 78,
    });

    // Test 7: Technical Capability
    results.push({
      test: 'Technical Capability Score',
      expected: 75,
      actual: goose.factor_scores?.technicalCapability,
      passed: goose.factor_scores?.technicalCapability === 75,
    });

    // Test 8: Usability
    results.push({
      test: 'Usability Score',
      expected: 65,
      actual: goose.factor_scores?.usability,
      passed: goose.factor_scores?.usability === 65,
    });

    // Test 9: Ecosystem
    results.push({
      test: 'Ecosystem Score',
      expected: 70,
      actual: goose.factor_scores?.ecosystem,
      passed: goose.factor_scores?.ecosystem === 70,
    });

    // Test 10: Value Proposition
    results.push({
      test: 'Value Proposition Score',
      expected: 85,
      actual: goose.factor_scores?.valueProposition,
      passed: goose.factor_scores?.valueProposition === 85,
    });

    // Test 11: Correction Metadata
    results.push({
      test: 'Correction Metadata Exists',
      expected: true,
      actual: !!goose.metadata?.corrected,
      passed: !!goose.metadata?.corrected,
    });

    // Test 12: Previous Score Recorded
    results.push({
      test: 'Previous Score Recorded',
      expected: 84,
      actual: goose.metadata?.previousScore,
      passed: goose.metadata?.previousScore === 84,
    });

    // Test 13: Score not inflated
    results.push({
      test: 'Score is Realistic (<75)',
      expected: true,
      actual: goose.score < 75,
      passed: goose.score < 75,
    });

    // Test 14: Rankings are sorted
    const isSorted = rankingsData.every((r: any, i: number) => {
      if (i === 0) return true;
      return r.score <= rankingsData[i - 1].score;
    });

    results.push({
      test: 'Rankings Sorted by Score',
      expected: true,
      actual: isSorted,
      passed: isSorted,
    });

    // Test 15: Rank positions are sequential
    const hasSequentialRanks = rankingsData.every((r: any, i: number) => r.rank === i + 1);

    results.push({
      test: 'Rank Positions Sequential',
      expected: true,
      actual: hasSequentialRanks,
      passed: hasSequentialRanks,
    });

    // Display results
    const passedTests = results.filter(r => r.passed).length;
    const totalTests = results.length;

    console.log('Test Results:');
    console.log('');

    results.forEach((result, index) => {
      const status = result.passed ? '✅' : '❌';
      const expectedStr = typeof result.expected === 'boolean' ? result.expected : JSON.stringify(result.expected);
      const actualStr = typeof result.actual === 'boolean' ? result.actual : JSON.stringify(result.actual);

      console.log(`${status} Test ${index + 1}: ${result.test}`);
      if (!result.passed) {
        console.log(`   Expected: ${expectedStr}`);
        console.log(`   Actual:   ${actualStr}`);
      }
    });

    console.log('');
    console.log('━'.repeat(60));
    console.log('');

    // Summary
    if (passedTests === totalTests) {
      console.log('✅ ALL TESTS PASSED! (' + passedTests + '/' + totalTests + ')');
      console.log('');
      console.log('🎉 Goose ranking correction verified successfully!');
      console.log('');
      console.log('📊 Current Status:');
      console.log(`   Rank: #${goose.rank} / ${rankingsData.length}`);
      console.log(`   Score: ${goose.score}/100`);
      console.log(`   Tier: ${goose.tier}`);
      console.log(`   Previous Score: ${goose.metadata?.previousScore}/100`);
      console.log(`   Correction: ${goose.score - goose.metadata?.previousScore} points`);
      console.log('');
    } else {
      console.log(`⚠️  SOME TESTS FAILED (${passedTests}/${totalTests} passed)`);
      console.log('');
      console.log('Please review the failed tests above and re-run the correction script.');
      console.log('');
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Error verifying correction:', error);
    if (error instanceof Error) {
      console.error('   Error message:', error.message);
    }
    process.exit(1);
  }
}

verifyGooseCorrection();
