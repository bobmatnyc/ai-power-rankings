#!/usr/bin/env node

/**
 * Clerk Configuration Verification Script
 *
 * This script verifies that Clerk authentication is properly configured
 * for both development and production environments.
 *
 * Usage:
 *   node scripts/verify-clerk-config.js
 */

const fs = require('fs');
const path = require('path');

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const env = {};

  content.split('\n').forEach(line => {
    // Skip comments and empty lines
    if (line.trim().startsWith('#') || !line.trim()) {
      return;
    }

    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      let value = match[2].trim();

      // Remove quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }

      env[key] = value;
    }
  });

  return env;
}

function checkClerkConfig(envVars, envName) {
  log(`\n${envName} Configuration:`, 'bright');
  log('─'.repeat(60), 'cyan');

  const required = [
    'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
    'CLERK_SECRET_KEY',
    'NEXT_PUBLIC_CLERK_SIGN_IN_URL',
    'NEXT_PUBLIC_CLERK_SIGN_UP_URL',
  ];

  const recommended = [
    'NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL',
    'NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL',
  ];

  const deprecated = [
    'NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL',
    'NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL',
  ];

  let hasIssues = false;

  // Check required variables
  log('\nRequired Variables:', 'blue');
  required.forEach(key => {
    const value = envVars[key];
    if (!value) {
      log(`  ✗ ${key}: MISSING`, 'red');
      hasIssues = true;
    } else if (value.includes('your_') || value.includes('test_') && envName.includes('Production')) {
      log(`  ⚠ ${key}: PLACEHOLDER VALUE`, 'yellow');
      hasIssues = true;
    } else {
      const maskedValue = value.length > 20
        ? `${value.substring(0, 10)}...${value.substring(value.length - 5)}`
        : value;
      log(`  ✓ ${key}: ${maskedValue}`, 'green');
    }
  });

  // Check recommended variables
  log('\nRecommended Variables (Clerk Core 2):', 'blue');
  recommended.forEach(key => {
    const value = envVars[key];
    if (!value) {
      log(`  ⚠ ${key}: NOT SET (will use default)`, 'yellow');
    } else {
      log(`  ✓ ${key}: ${value}`, 'green');
    }
  });

  // Check deprecated variables
  log('\nDeprecated Variables:', 'blue');
  let hasDeprecated = false;
  deprecated.forEach(key => {
    const value = envVars[key];
    if (value) {
      log(`  ⚠ ${key}: ${value} (DEPRECATED - use FALLBACK_REDIRECT_URL instead)`, 'yellow');
      hasDeprecated = true;
    }
  });

  if (!hasDeprecated) {
    log('  ✓ No deprecated variables found', 'green');
  } else {
    log('\n  Migration Note:', 'cyan');
    log('  AFTER_SIGN_X_URL variables are deprecated in Clerk Core 2.', 'cyan');
    log('  Update to use SIGN_X_FALLBACK_REDIRECT_URL instead.', 'cyan');
  }

  return hasIssues;
}

function verifyClerkProviderConfig() {
  log('\n\nClerkProvider Configuration Check:', 'bright');
  log('─'.repeat(60), 'cyan');

  const providerPath = path.join(__dirname, '..', 'components', 'auth', 'clerk-provider-client.tsx');

  if (!fs.existsSync(providerPath)) {
    log('  ✗ ClerkProvider file not found', 'red');
    return false;
  }

  const content = fs.readFileSync(providerPath, 'utf-8');

  const checks = [
    {
      name: 'Has backward compatibility for AFTER_SIGN_X_URL',
      pattern: /NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL/,
      required: true,
    },
    {
      name: 'Uses Core 2 FALLBACK_REDIRECT_URL',
      pattern: /signInFallbackRedirectUrl/,
      required: true,
    },
    {
      name: 'Has fallback defaults',
      pattern: /"\/(en\/)?admin"/,
      required: true,
    },
  ];

  let hasIssues = false;

  checks.forEach(check => {
    const found = check.pattern.test(content);
    if (check.required && !found) {
      log(`  ✗ ${check.name}`, 'red');
      hasIssues = true;
    } else if (found) {
      log(`  ✓ ${check.name}`, 'green');
    } else {
      log(`  ⚠ ${check.name}`, 'yellow');
    }
  });

  return hasIssues;
}

function main() {
  log('\n╔════════════════════════════════════════════════════════════╗', 'bright');
  log('║          Clerk Authentication Configuration Checker        ║', 'bright');
  log('╚════════════════════════════════════════════════════════════╝', 'bright');

  const rootDir = path.join(__dirname, '..');

  // Check .env.local
  const envLocal = parseEnvFile(path.join(rootDir, '.env.local'));
  let hasLocalIssues = false;
  if (envLocal) {
    hasLocalIssues = checkClerkConfig(envLocal, 'Development (.env.local)');
  } else {
    log('\nDevelopment (.env.local): NOT FOUND', 'yellow');
    log('This is normal if you are running in CI/CD or production.', 'cyan');
  }

  // Check .env.production
  const envProd = parseEnvFile(path.join(rootDir, '.env.production'));
  let hasProdIssues = false;
  if (envProd) {
    hasProdIssues = checkClerkConfig(envProd, 'Production (.env.production)');
  } else {
    log('\nProduction (.env.production): NOT FOUND', 'yellow');
  }

  // Verify ClerkProvider
  const hasProviderIssues = verifyClerkProviderConfig();

  // Summary
  log('\n\n╔════════════════════════════════════════════════════════════╗', 'bright');
  log('║                        Summary                              ║', 'bright');
  log('╚════════════════════════════════════════════════════════════╝', 'bright');

  if (!hasLocalIssues && !hasProdIssues && !hasProviderIssues) {
    log('\n  ✓ All Clerk configurations are correct!', 'green');
    log('  Your authentication setup is ready to use.', 'green');
    process.exit(0);
  } else {
    log('\n  ⚠ Some issues were found:', 'yellow');
    if (hasLocalIssues) log('    - Development configuration needs attention', 'yellow');
    if (hasProdIssues) log('    - Production configuration needs attention', 'yellow');
    if (hasProviderIssues) log('    - ClerkProvider configuration needs attention', 'yellow');
    log('\n  Please review the issues above and update accordingly.', 'cyan');
    process.exit(1);
  }
}

main();
