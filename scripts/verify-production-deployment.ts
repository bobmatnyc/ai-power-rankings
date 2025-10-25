/**
 * Production Deployment Verification Script
 * Verifies Phase 1-3 content updates in production
 */

const PRODUCTION_URL = 'https://aipowerranking.com';

// Sample tools from each phase
const PHASE_1_TOOLS = ['github-copilot', 'cursor', 'windsurf'];
const PHASE_2_TOOLS = ['amazon-q-developer', 'jetbrains-ai-assistant', 'google-gemini-code-assist'];
const PHASE_3_TOOLS = ['aider', 'continue', 'open-interpreter'];

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
  console.log(`Target: ${PRODUCTION_URL}`);
  console.log(`Time: ${new Date().toISOString()}\n`);

  const results: Record<string, boolean[]> = {
    'Phase 1': [],
    'Phase 2': [],
    'Phase 3': [],
  };

  // Test Phase 1 tools
  console.log('\n━━━ PHASE 1: Popular Developer Tools ━━━');
  for (const toolId of PHASE_1_TOOLS) {
    const passed = await verifyTool(toolId, 'Phase 1');
    results['Phase 1'].push(passed);
  }

  // Test Phase 2 tools
  console.log('\n━━━ PHASE 2: Enterprise AI Tools ━━━');
  for (const toolId of PHASE_2_TOOLS) {
    const passed = await verifyTool(toolId, 'Phase 2');
    results['Phase 2'].push(passed);
  }

  // Test Phase 3 tools
  console.log('\n━━━ PHASE 3: Open Source Tools ━━━');
  for (const toolId of PHASE_3_TOOLS) {
    const passed = await verifyTool(toolId, 'Phase 3');
    results['Phase 3'].push(passed);
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
