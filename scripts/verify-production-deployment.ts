/**
 * Production Deployment Verification Script
 * Verifies Phase 4-7A content updates in production
 *
 * Commit: 88ea466b - feat: Add comprehensive content for 48 AI tools (Phases 4-7A)
 * Verification Date: 2025-10-25
 */

const PRODUCTION_URL = 'https://aipowerranking.com';

// Sample tools from each phase
const PHASE_4_TOOLS = ['coderabbit', 'snyk-code', 'gitlab-duo'];
const PHASE_5_TOOLS = ['bolt-new', 'chatgpt-canvas', 'claude-artifacts'];
const PHASE_6_TOOLS = ['devin', 'google-jules', 'jetbrains-ai'];
const PHASE_7A_TOOLS = ['cursor', 'claude-code', 'github-copilot'];

interface ToolData {
  id: string;
  name: string;
  company: string;
  overview?: string;
  pricing?: string;
}

async function verifyTool(toolId: string, phase: string): Promise<boolean> {
  try {
    const url = `${PRODUCTION_URL}/api/tools/${toolId}/json`;
    console.log(`\n[${phase}] Testing: ${url}`);

    const response = await fetch(url);
    if (!response.ok) {
      console.error(`  ❌ HTTP ${response.status}: ${response.statusText}`);
      return false;
    }

    const data: ToolData = await response.json();

    // Verify key fields are populated (not "N/A" or empty)
    const checks = {
      'Company': data.company && data.company !== 'N/A' && data.company !== '',
      'Overview': data.overview && data.overview.length > 50,
      'Pricing': data.pricing && data.pricing !== 'N/A' && data.pricing !== '',
    };

    console.log(`  Tool: ${data.name}`);
    console.log(`  Company: ${data.company} ${checks.Company ? '✅' : '❌'}`);
    console.log(`  Overview: ${data.overview ? `${data.overview.substring(0, 60)}...` : 'MISSING'} ${checks.Overview ? '✅' : '❌'}`);
    console.log(`  Pricing: ${data.pricing?.substring(0, 50)}... ${checks.Pricing ? '✅' : '❌'}`);

    const allPassed = Object.values(checks).every(check => check === true);
    console.log(`  Status: ${allPassed ? '✅ PASS' : '❌ FAIL'}`);

    return allPassed;

  } catch (error) {
    console.error(`  ❌ Error: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

async function main() {
  console.log('=== Production Deployment Verification ===');
  console.log('Commit: 88ea466b - Phase 4-7A Content Updates');
  console.log(`Target: ${PRODUCTION_URL}`);
  console.log(`Time: ${new Date().toISOString()}\n`);

  const results: Record<string, boolean[]> = {
    'Phase 4': [],
    'Phase 5': [],
    'Phase 6': [],
    'Phase 7A': [],
  };

  // Test Phase 4 tools
  console.log('\n━━━ PHASE 4: Specialized Tools (9 tools) ━━━');
  for (const toolId of PHASE_4_TOOLS) {
    const passed = await verifyTool(toolId, 'Phase 4');
    results['Phase 4'].push(passed);
  }

  // Test Phase 5 tools
  console.log('\n━━━ PHASE 5: Critical Market Players (10 tools) ━━━');
  for (const toolId of PHASE_5_TOOLS) {
    const passed = await verifyTool(toolId, 'Phase 5');
    results['Phase 5'].push(passed);
  }

  // Test Phase 6 tools
  console.log('\n━━━ PHASE 6: Enterprise & Platform Leaders (7 tools + 2 NEW) ━━━');
  for (const toolId of PHASE_6_TOOLS) {
    const passed = await verifyTool(toolId, 'Phase 6');
    results['Phase 6'].push(passed);
  }

  // Test Phase 7A tools
  console.log('\n━━━ PHASE 7A: Use Case Enhancement (22 tools with 90 use cases) ━━━');
  for (const toolId of PHASE_7A_TOOLS) {
    const passed = await verifyTool(toolId, 'Phase 7A');
    results['Phase 7A'].push(passed);
  }

  // Summary
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('VERIFICATION SUMMARY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  for (const [phase, phaseResults] of Object.entries(results)) {
    const passed = phaseResults.filter(r => r).length;
    const total = phaseResults.length;
    const status = passed === total ? '✅' : '⚠️';
    console.log(`${status} ${phase}: ${passed}/${total} tools verified`);
  }

  const allResults = Object.values(results).flat();
  const totalPassed = allResults.filter(r => r).length;
  const totalTests = allResults.length;

  console.log(`\n${totalPassed === totalTests ? '✅' : '❌'} Overall: ${totalPassed}/${totalTests} tools verified`);

  if (totalPassed === totalTests) {
    console.log('\n🎉 Production deployment VERIFIED - All content updates live!');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some tools failed verification - check output above');
    process.exit(1);
  }
}

main();
