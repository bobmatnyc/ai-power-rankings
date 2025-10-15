import { db } from '../lib/db';
import { tools } from '../lib/db/schema';
import { eq } from 'drizzle-orm';

async function checkTools() {
  console.log('='.repeat(100));
  console.log('VERIFICATION REPORT: 7 RECENTLY UPDATED AI CODING TOOLS');
  console.log('='.repeat(100));

  const toolNames = [
    { name: 'OpenAI Codex', expectedScore: 92, expectedRank: 1, expectedCategory: 'autonomous-agent' },
    { name: 'Greptile', expectedScore: 90, expectedRank: 2, expectedCategory: 'other' },
    { name: 'Google Gemini CLI', expectedScore: 88, expectedRank: 3, expectedCategory: 'open-source-framework' },
    { name: 'Graphite', expectedScore: 87, expectedRank: 4, expectedCategory: 'other' },
    { name: 'Qwen Code', expectedScore: 86, expectedRank: 5, expectedCategory: 'open-source-framework' },
    { name: 'GitLab Duo', expectedScore: 84, expectedRank: 6, expectedCategory: 'other' },
    { name: 'Anything Max', expectedScore: 80, expectedRank: 7, expectedCategory: 'autonomous-agent' }
  ];

  const results = [];

  for (const expected of toolNames) {
    const toolRecords = await db
      .select()
      .from(tools)
      .where(eq(tools.name, expected.name));

    if (toolRecords.length > 0) {
      const tool = toolRecords[0];
      const data = tool.data as any;
      const currentScore = tool.currentScore as any;
      const baselineScore = tool.baselineScore as any;

      const actualScore = currentScore?.overall || baselineScore?.overall || data?.score || null;
      const hasDescription = (data?.description?.length || 0) > 50;
      const categoryMatch = tool.category === expected.expectedCategory;

      results.push({
        name: expected.name,
        found: true,
        actualScore,
        expectedScore: expected.expectedScore,
        scoreMatch: actualScore === expected.expectedScore,
        hasScore: actualScore !== null,
        category: tool.category,
        expectedCategory: expected.expectedCategory,
        categoryMatch,
        hasDescription,
        descriptionLength: data?.description?.length || 0
      });
    } else {
      results.push({
        name: expected.name,
        found: false
      });
    }
  }

  // Print table
  console.log('\n| Tool Name           | Expected | Actual | Status | Desc | Category  |');
  console.log('|---------------------|----------|--------|--------|------|-----------|');

  for (const r of results) {
    if (!r.found) {
      console.log(`| ${r.name.padEnd(19)} | N/A      | N/A    | ❌ MISS | N/A  | N/A       |`);
    } else {
      const scoreStr = r.actualScore !== null ? r.actualScore.toString().padStart(6) : 'NULL'.padStart(6);
      const status = r.scoreMatch && r.categoryMatch && r.hasDescription ? '✅ PASS' : '❌ FAIL';
      const descStatus = r.hasDescription ? 'Yes' : 'No';
      const catStatus = r.categoryMatch ? '✅' : '❌';

      console.log(`| ${r.name.padEnd(19)} | ${r.expectedScore.toString().padStart(8)} | ${scoreStr} | ${status} | ${descStatus.padEnd(4)} | ${catStatus} ${r.category.substring(0, 7).padEnd(7)} |`);
    }
  }

  console.log('\n' + '='.repeat(100));
  console.log('ISSUES FOUND:');
  console.log('='.repeat(100));

  const issues = [];
  for (const r of results) {
    if (!r.found) {
      issues.push(`❌ ${r.name}: NOT FOUND in database`);
    } else {
      if (!r.hasScore) {
        issues.push(`❌ ${r.name}: Score is NULL (expected ${r.expectedScore})`);
      } else if (!r.scoreMatch) {
        issues.push(`❌ ${r.name}: Score mismatch (expected ${r.expectedScore}, got ${r.actualScore})`);
      }

      if (!r.hasDescription) {
        issues.push(`❌ ${r.name}: Description missing or too short (${r.descriptionLength} chars)`);
      }

      if (!r.categoryMatch) {
        issues.push(`❌ ${r.name}: Category mismatch (expected ${r.expectedCategory}, got ${r.category})`);
      }
    }
  }

  if (issues.length === 0) {
    console.log('\n✅ ALL CHECKS PASSED! All 7 tools are correctly stored with scores and descriptions.');
  } else {
    console.log('');
    issues.forEach(issue => console.log(issue));
    console.log(`\n❌ TOTAL ISSUES: ${issues.length}`);
  }

  const passCount = results.filter(r => r.found && r.scoreMatch && r.categoryMatch && r.hasDescription).length;
  console.log('\n' + '='.repeat(100));
  console.log(`SUCCESS RATE: ${passCount}/7 tools (${((passCount/7)*100).toFixed(0)}%)`);
  console.log('='.repeat(100));

  process.exit(0);
}

checkTools().catch(console.error);
