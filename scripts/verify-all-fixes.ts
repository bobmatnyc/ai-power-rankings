import { db } from '../lib/db';
import { tools } from '../lib/db/schema';
import { eq } from 'drizzle-orm';

async function verifyAllFixes() {
  console.log('🔍 Verifying all tool entry fixes...\n');

  let allPassed = true;

  // Test 1: Verify docker-compose-agents is deleted
  console.log('1️⃣  Testing docker-compose-agents deletion...');
  try {
    const dockerTool = await db.select()
      .from(tools)
      .where(eq(tools.slug, 'docker-compose-agents'))
      .limit(1);

    if (dockerTool.length === 0) {
      console.log('   ✅ docker-compose-agents successfully deleted\n');
    } else {
      console.log('   ❌ docker-compose-agents still exists\n');
      allPassed = false;
    }
  } catch (error) {
    console.log('   ❌ Error checking docker-compose-agents:', error);
    allPassed = false;
  }

  // Test 2: Verify Goose logo is set
  console.log('2️⃣  Testing Goose logo update...');
  try {
    const gooseTool = await db.select()
      .from(tools)
      .where(eq(tools.slug, 'goose'))
      .limit(1);

    if (gooseTool.length === 0) {
      console.log('   ❌ Goose tool not found\n');
      allPassed = false;
    } else {
      const data = gooseTool[0].data as any;
      const logoUrl = data.logo_url || data.metadata?.logo_url;
      const websiteUrl = data.website_url;
      const githubUrl = data.github_url;

      if (logoUrl === '/tools/goose.png') {
        console.log('   ✅ Logo URL: /tools/goose.png');
      } else {
        console.log(`   ❌ Logo URL incorrect: ${logoUrl}`);
        allPassed = false;
      }

      if (websiteUrl === 'https://block.github.io/goose/') {
        console.log('   ✅ Website URL: https://block.github.io/goose/');
      } else {
        console.log(`   ⚠️  Website URL: ${websiteUrl || 'Not set'}`);
      }

      if (githubUrl === 'https://github.com/block/goose') {
        console.log('   ✅ GitHub URL: https://github.com/block/goose\n');
      } else {
        console.log(`   ⚠️  GitHub URL: ${githubUrl || 'Not set'}\n`);
      }
    }
  } catch (error) {
    console.log('   ❌ Error checking Goose:', error);
    allPassed = false;
  }

  // Test 3: Verify Microsoft Agentic DevOps metadata
  console.log('3️⃣  Testing Microsoft Agentic DevOps update...');
  try {
    const msTool = await db.select()
      .from(tools)
      .where(eq(tools.slug, 'microsoft-agentic-devops'))
      .limit(1);

    if (msTool.length === 0) {
      console.log('   ❌ Microsoft Agentic DevOps tool not found\n');
      allPassed = false;
    } else {
      const data = msTool[0].data as any;
      const name = msTool[0].name;
      const status = msTool[0].status;
      const description = data.description;
      const features = data.features;
      const websiteUrl = data.website_url;
      const documentationUrl = data.documentation_url;

      console.log(`   Name: ${name}`);
      if (name === 'Microsoft Agent Framework') {
        console.log('   ✅ Name updated correctly');
      } else {
        console.log('   ⚠️  Name not updated');
      }

      console.log(`   Status: ${status}`);
      if (status === 'preview') {
        console.log('   ✅ Status set to preview');
      } else {
        console.log('   ⚠️  Status not set to preview');
      }

      if (description && description.length > 50) {
        console.log('   ✅ Description present');
      } else {
        console.log('   ❌ Description missing or too short');
        allPassed = false;
      }

      if (features && Array.isArray(features) && features.length >= 8) {
        console.log(`   ✅ Features array present (${features.length} features)`);
      } else {
        console.log(`   ❌ Features missing or incomplete (${features?.length || 0} features)`);
        allPassed = false;
      }

      if (websiteUrl && websiteUrl.includes('azure.microsoft.com')) {
        console.log('   ✅ Website URL present');
      } else {
        console.log('   ⚠️  Website URL missing');
      }

      if (documentationUrl && documentationUrl.includes('learn.microsoft.com')) {
        console.log('   ✅ Documentation URL present\n');
      } else {
        console.log('   ⚠️  Documentation URL missing\n');
      }
    }
  } catch (error) {
    console.log('   ❌ Error checking Microsoft Agentic DevOps:', error);
    allPassed = false;
  }

  // Test 4: Check if logo file exists
  console.log('4️⃣  Testing Goose logo file...');
  try {
    const fs = await import('fs');
    const path = '/Users/masa/Projects/aipowerranking/public/tools/goose.png';
    if (fs.existsSync(path)) {
      const stats = fs.statSync(path);
      console.log(`   ✅ Logo file exists (${Math.round(stats.size / 1024)}KB)\n`);
    } else {
      console.log('   ❌ Logo file not found at /public/tools/goose.png\n');
      allPassed = false;
    }
  } catch (error) {
    console.log('   ❌ Error checking logo file:', error);
    allPassed = false;
  }

  // Summary
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  if (allPassed) {
    console.log('✅ ALL TESTS PASSED');
  } else {
    console.log('⚠️  SOME TESTS FAILED - Review output above');
  }
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  process.exit(allPassed ? 0 : 1);
}

verifyAllFixes();
