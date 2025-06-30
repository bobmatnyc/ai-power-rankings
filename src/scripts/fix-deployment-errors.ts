#!/usr/bin/env node

import { exec } from "child_process";
import { promisify } from "util";
// Removed unused imports - fs and path not currently used

const execAsync = promisify(exec);

interface ErrorPattern {
  pattern: RegExp;
  fix: () => Promise<void>;
  description: string;
}

const errorPatterns: ErrorPattern[] = [
  {
    pattern: /Type error:|TS\d+:/,
    description: "TypeScript errors detected",
    fix: async () => {
      console.log("🔧 Fixing TypeScript errors...");
      try {
        const { stdout } = await execAsync("npm run type-check");
        console.log(stdout);
      } catch (error: unknown) {
        console.log("\n❌ TypeScript errors found:");
        console.log((error as { stdout?: string }).stdout);
        console.log("\n💡 Please fix the TypeScript errors manually");
        process.exit(1);
      }
    },
  },
  {
    pattern: /ESLint|Parsing error:|Unexpected token/,
    description: "ESLint errors detected",
    fix: async () => {
      console.log("🔧 Running ESLint with auto-fix...");
      try {
        const { stdout } = await execAsync("npm run lint:fix");
        console.log(stdout);
        console.log("✅ ESLint errors fixed");
      } catch {
        console.log("❌ Some ESLint errors couldn't be auto-fixed");
        console.log("💡 Run 'npm run lint' to see remaining issues");
      }
    },
  },
  {
    pattern: /Module not found:|Cannot find module/,
    description: "Missing dependencies detected",
    fix: async () => {
      console.log("🔧 Installing missing dependencies...");
      try {
        await execAsync("npm install");
        console.log("✅ Dependencies installed");
      } catch {
        console.log("❌ Failed to install dependencies");
      }
    },
  },
  {
    pattern: /Environment variable .* is not defined/,
    description: "Missing environment variables",
    fix: async () => {
      console.log("⚠️  Missing environment variables detected");
      console.log("💡 Please add the missing variables to Vercel:");
      console.log(
        "   1. Go to https://vercel.com/ai-power-rankings/settings/environment-variables"
      );
      console.log("   2. Add the missing variables");
      console.log("   3. Redeploy from Vercel dashboard");
    },
  },
  {
    pattern: /Prettier|Code style issues/,
    description: "Code formatting issues",
    fix: async () => {
      console.log("🔧 Running Prettier to fix formatting...");
      try {
        await execAsync("npm run format");
        console.log("✅ Code formatting fixed");
      } catch {
        console.log("❌ Failed to fix formatting");
      }
    },
  },
];

async function analyzeError(errorLog: string): Promise<ErrorPattern | null> {
  for (const pattern of errorPatterns) {
    if (pattern.pattern.test(errorLog)) {
      return pattern;
    }
  }
  return null;
}

async function fixDeploymentErrors(errorLog?: string) {
  console.log("🔍 Analyzing deployment errors...\n");

  // If no error log provided, run pre-deploy check to find issues
  if (!errorLog) {
    console.log("📋 Running pre-deployment checks...");
    try {
      await execAsync("npm run pre-deploy");
      console.log("✅ All checks passed! No errors to fix.");
      return;
    } catch (error: unknown) {
      errorLog =
        ((error as { stdout?: string; stderr?: string }).stdout || "") +
        ((error as { stdout?: string; stderr?: string }).stderr || "");
    }
  }

  // Analyze the error
  const errorPattern = await analyzeError(errorLog);

  if (!errorPattern) {
    console.log("❓ Unknown error type. Please check the error log manually.");
    console.log("\nError log:");
    console.log(errorLog);
    return;
  }

  console.log(`📍 Detected: ${errorPattern.description}`);
  console.log("🔧 Attempting automatic fix...\n");

  // Apply the fix
  await errorPattern.fix();

  // Run pre-deploy check again
  console.log("\n📋 Running verification...");
  try {
    await execAsync("npm run pre-deploy");
    console.log("\n✅ All errors fixed! You can now commit and push.");
    console.log("\n📝 Next steps:");
    console.log("   1. git add .");
    console.log('   2. git commit -m "fix: deployment errors"');
    console.log("   3. git push");
    console.log("   4. npm run check-deployment");
  } catch {
    console.log("\n⚠️  Some issues remain. Please fix them manually.");
    console.log("💡 Run 'npm run pre-deploy' to see remaining issues");
  }
}

// Check if error log was passed as argument
const errorLog = process.argv[2];

// Run the fixer
fixDeploymentErrors(errorLog).catch(console.error);
