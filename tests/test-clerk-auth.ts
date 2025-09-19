#!/usr/bin/env tsx
/**
 * Test Script for Clerk Authentication Integration
 *
 * This script tests that:
 * 1. Admin routes are protected with Clerk authentication
 * 2. API endpoints verify Clerk session
 * 3. Old auth system is removed
 */

import { readFileSync } from 'fs';
import { glob } from 'glob';

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
  reset: '\x1b[0m'
};

interface TestResult {
  file: string;
  issues: string[];
  warnings: string[];
  passed: boolean;
}

async function checkAdminPages(): Promise<TestResult[]> {
  console.log(`${colors.blue}Checking admin pages for Clerk auth...${colors.reset}`);

  const results: TestResult[] = [];
  const adminPages = await glob('src/app/admin/**/page.tsx');

  for (const pagePath of adminPages) {
    const content = readFileSync(pagePath, 'utf-8');
    const result: TestResult = {
      file: pagePath,
      issues: [],
      warnings: [],
      passed: true
    };

    // Check for old auth imports
    if (content.includes('isAdminAuthenticated')) {
      result.issues.push('Still using old isAdminAuthenticated');
      result.passed = false;
    }

    if (content.includes('/lib/admin-auth')) {
      result.issues.push('Still importing from old admin-auth');
      result.passed = false;
    }

    // Check for Clerk auth (for server components)
    if (!content.includes('"use client"') && !content.includes('redirect("/sign-in")')) {
      if (!content.includes('@clerk/nextjs')) {
        result.warnings.push('Server component without Clerk auth check');
      }
    }

    results.push(result);
  }

  return results;
}

async function checkAPIRoutes(): Promise<TestResult[]> {
  console.log(`${colors.blue}Checking API routes for Clerk auth...${colors.reset}`);

  const results: TestResult[] = [];
  const apiRoutes = await glob('src/app/api/admin/**/route.ts');

  for (const routePath of apiRoutes) {
    const content = readFileSync(routePath, 'utf-8');
    const result: TestResult = {
      file: routePath,
      issues: [],
      warnings: [],
      passed: true
    };

    // Skip deprecated auth endpoints
    if (routePath.includes('/auth/') || routePath.includes('/login/') || routePath.includes('/logout/')) {
      result.warnings.push('Legacy auth endpoint - should return deprecated response');
      results.push(result);
      continue;
    }

    // Check for old auth imports
    if (content.includes('withAdminAuth')) {
      result.issues.push('Still using old withAdminAuth');
      result.passed = false;
    }

    if (content.includes('/lib/admin-auth') && !content.includes('clerk-auth')) {
      result.issues.push('Still importing from old admin-auth');
      result.passed = false;
    }

    // Check for Clerk auth
    if (!content.includes('withAuth') && !content.includes('deprecated')) {
      result.issues.push('No auth wrapper found');
      result.passed = false;
    }

    if (!content.includes('/lib/clerk-auth') && !content.includes('deprecated')) {
      result.warnings.push('Not using Clerk auth helper');
    }

    results.push(result);
  }

  return results;
}

async function checkForOldAuth(): Promise<TestResult[]> {
  console.log(`${colors.blue}Checking for remnants of old auth system...${colors.reset}`);

  const results: TestResult[] = [];

  // Check if old auth files still have active code
  const oldAuthFiles = [
    'src/lib/admin-auth.ts',
    'src/lib/admin-session-store.ts'
  ];

  for (const filePath of oldAuthFiles) {
    try {
      const content = readFileSync(filePath, 'utf-8');
      const result: TestResult = {
        file: filePath,
        issues: [],
        warnings: [],
        passed: true
      };

      // These files might still exist but shouldn't be used
      if (content.includes('export') && !content.includes('deprecated')) {
        result.warnings.push('Old auth file still exists with exports');
      }

      results.push(result);
    } catch (error) {
      // File doesn't exist - that's good!
      console.log(`  ✓ ${filePath} removed or doesn't exist`);
    }
  }

  return results;
}

async function runTests() {
  console.log(`\n${colors.yellow}=== Clerk Authentication Test Suite ===${colors.reset}\n`);

  const allResults: TestResult[] = [];

  // Run all checks
  allResults.push(...await checkAdminPages());
  allResults.push(...await checkAPIRoutes());
  allResults.push(...await checkForOldAuth());

  // Print results
  console.log(`\n${colors.yellow}=== Test Results ===${colors.reset}\n`);

  let totalPassed = 0;
  let totalFailed = 0;
  let totalWarnings = 0;

  for (const result of allResults) {
    if (result.passed && result.warnings.length === 0) {
      console.log(`${colors.green}✓${colors.reset} ${result.file}`);
      totalPassed++;
    } else if (!result.passed) {
      console.log(`${colors.red}✗${colors.reset} ${result.file}`);
      for (const issue of result.issues) {
        console.log(`  ${colors.red}  - ${issue}${colors.reset}`);
      }
      totalFailed++;
    } else {
      console.log(`${colors.yellow}⚠${colors.reset} ${result.file}`);
      for (const warning of result.warnings) {
        console.log(`  ${colors.yellow}  - ${warning}${colors.reset}`);
      }
      totalWarnings++;
    }
  }

  // Summary
  console.log(`\n${colors.yellow}=== Summary ===${colors.reset}`);
  console.log(`${colors.green}Passed: ${totalPassed}${colors.reset}`);
  console.log(`${colors.red}Failed: ${totalFailed}${colors.reset}`);
  console.log(`${colors.yellow}Warnings: ${totalWarnings}${colors.reset}`);

  if (totalFailed === 0) {
    console.log(`\n${colors.green}✅ All critical tests passed! Clerk authentication is properly integrated.${colors.reset}`);
  } else {
    console.log(`\n${colors.red}❌ Some tests failed. Please review the issues above.${colors.reset}`);
    process.exit(1);
  }

  // Check environment variables
  console.log(`\n${colors.yellow}=== Environment Check ===${colors.reset}`);
  const requiredEnvVars = [
    'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
    'CLERK_SECRET_KEY',
    'NEXT_PUBLIC_CLERK_SIGN_IN_URL',
    'NEXT_PUBLIC_CLERK_SIGN_UP_URL'
  ];

  for (const envVar of requiredEnvVars) {
    if (process.env[envVar]) {
      console.log(`${colors.green}✓${colors.reset} ${envVar} is set`);
    } else {
      console.log(`${colors.red}✗${colors.reset} ${envVar} is not set`);
    }
  }
}

// Run the tests
runTests().catch(console.error);