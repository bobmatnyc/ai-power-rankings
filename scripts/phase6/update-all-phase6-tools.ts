import { execSync } from 'child_process';

/**
 * Phase 6: Batch Update Script
 * Updates all 7 Phase 6 enterprise & platform leader tools
 *
 * Tools:
 * 1. Devin (autonomous-agent) - $10.2B valuation, 96% price reduction
 * 2. Google Jules (autonomous-agent) - Gemini 2.5 Pro, 140K commits
 * 3. JetBrains AI Assistant (ide-assistant) - Gartner Magic Quadrant, 25M+ users
 * 4. Microsoft IntelliCode (ide-assistant) - 100% free, 10M+ users, pioneering
 * 5. CodeRabbit (code-review) - #1 GitHub AI app, $60M Series B
 * 6. Snyk Code (security) - 84% MTTR reduction, Evo agentic
 * 7. Zed (code-editor) - Atom creators, Rust+GPU, 58ms response
 *
 * Note: Warp already updated in Phase 5
 */

const tools = [
  {
    script: 'update-devin.ts',
    name: 'Devin',
    highlights: '$10.2B valuation, 96% price reduction ($500→$20)'
  },
  {
    script: 'update-google-jules.ts',
    name: 'Google Jules',
    highlights: 'Gemini 2.5 Pro, 140K+ commits, Oct 2025 CLI'
  },
  {
    script: 'update-jetbrains-ai.ts',
    name: 'JetBrains AI Assistant',
    highlights: '2025 Gartner Magic Quadrant, 25M+ users, free tier'
  },
  {
    script: 'update-microsoft-intellicode.ts',
    name: 'Microsoft IntelliCode',
    highlights: '100% free, 10M+ users, pioneered AI coding 2017'
  },
  {
    script: 'update-coderabbit.ts',
    name: 'CodeRabbit',
    highlights: '#1 GitHub AI app, $60M Series B, 30-40% monthly growth'
  },
  {
    script: 'update-snyk-code.ts',
    name: 'Snyk Code',
    highlights: '84% MTTR reduction, Evo agentic security (Oct 2025)'
  },
  {
    script: 'update-zed.ts',
    name: 'Zed',
    highlights: 'Atom creators, Rust+GPU, 58ms response, $42M funding'
  }
];

console.log('🚀 Phase 6: Enterprise & Platform Leaders Batch Update');
console.log('====================================================\n');
console.log('📊 Updating 7 tools with comprehensive 2025 content\n');
console.log('Priority breakdown:');
console.log('  🔴 CRITICAL (4): Devin, Google Jules, JetBrains AI, Microsoft IntelliCode');
console.log('  🟡 HIGH (3): CodeRabbit, Snyk Code, Zed\n');
console.log('Note: Warp already completed in Phase 5\n');

let successCount = 0;
let failureCount = 0;
const failures: string[] = [];

for (let i = 0; i < tools.length; i++) {
  const tool = tools[i];
  console.log(`\n[${i + 1}/${tools.length}] Updating ${tool.name}...`);
  console.log(`    ${tool.highlights}`);

  try {
    execSync(`npx tsx scripts/phase6/${tool.script}`, {
      stdio: 'inherit',
      cwd: process.cwd()
    });
    successCount++;
    console.log(`✅ ${tool.name} updated successfully`);
  } catch (error) {
    failureCount++;
    failures.push(tool.name);
    console.error(`❌ Failed to update ${tool.name}`);
  }
}

console.log('\n\n====================================================');
console.log('📊 Phase 6 Batch Update Complete');
console.log('====================================================\n');
console.log(`✅ Successfully updated: ${successCount}/${tools.length} tools`);
if (failureCount > 0) {
  console.log(`❌ Failed updates: ${failureCount}`);
  console.log(`   Failed tools: ${failures.join(', ')}`);
}

console.log('\n📈 Phase 6 Statistics:');
console.log('   - Total tools updated: 7');
console.log('   - Autonomous agents: 2 (Devin, Google Jules)');
console.log('   - IDE assistants: 2 (JetBrains AI, Microsoft IntelliCode)');
console.log('   - Code review: 1 (CodeRabbit)');
console.log('   - Security: 1 (Snyk Code)');
console.log('   - Code editor: 1 (Zed)');
console.log('   - Warp (terminal): Already completed in Phase 5');

console.log('\n💡 Next Steps:');
console.log('   1. Run verification: npx tsx scripts/phase6/verify-phase6-updates.ts');
console.log('   2. Review research summary: docs/content/PHASE6-RESEARCH-SUMMARY.md');
console.log('   3. Check Phase 6 highlights: scripts/phase6/README.md');

console.log('\n🎯 Phase 6 Highlights:');
console.log('   - $10.2B Devin valuation (5x increase in 18 months)');
console.log('   - Google Jules: 140K+ commits, Gemini 2.5 Pro');
console.log('   - JetBrains: Gartner Magic Quadrant recognition');
console.log('   - IntelliCode: 100% free, pioneered AI coding (2017)');
console.log('   - CodeRabbit: $60M Series B, #1 GitHub AI app');
console.log('   - Snyk: 84% MTTR reduction, Evo agentic (Oct 2025)');
console.log('   - Zed: 58ms response, 2x faster AI, Atom creators');

if (successCount === tools.length) {
  console.log('\n🎉 All Phase 6 tools updated successfully!');
  process.exit(0);
} else {
  console.log('\n⚠️  Some updates failed. Please review errors above.');
  process.exit(1);
}
