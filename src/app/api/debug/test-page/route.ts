import { type NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const steps: string[] = [];
  // biome-ignore lint/suspicious/noExplicitAny: debug error collection
  let errorDetails: any = null;

  try {
    // Step 1: Basic environment check
    steps.push("Step 1: Environment check started");
    const nodeVersion = process.version;
    const env = process.env.NODE_ENV;
    steps.push(`Step 1: Node ${nodeVersion}, ENV: ${env}`);

    // Step 2: Test dictionary loading
    steps.push("Step 2: Testing dictionary loading");
    try {
      const { getDictionary } = await import("@/i18n/get-dictionary");
      const dict = await getDictionary("en");
      steps.push(`Step 2: Dictionary loaded, has ${Object.keys(dict).length} keys`);
    } catch (dictError: unknown) {
      const err = dictError as Error;
      steps.push(`Step 2 ERROR: Dictionary failed - ${err.message}`);
      errorDetails = { dictError: err.stack };
    }

    // Step 3: Test auth environment variables
    steps.push("Step 3: Testing auth environment");
    const hasClerkPublishable = !!process.env["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"];
    const hasClerkSecret = !!process.env["CLERK_SECRET_KEY"];
    const nodeEnv = process.env["NODE_ENV"];
    steps.push(
      `Step 3: CLERK_PUBLISHABLE=${hasClerkPublishable}, CLERK_SECRET=${hasClerkSecret}, NODE_ENV=${nodeEnv}`
    );

    // Step 4: Test basic imports
    steps.push("Step 4: Testing component imports");
    try {
      // Test if we can import React components
      await import("react");
      steps.push("Step 4a: React imported successfully");

      // Test if we can import Next.js components
      await import("next/link");
      steps.push("Step 4b: Next/Link imported successfully");

      // Test if we can import our components (without rendering)
      // Note: Header component doesn't exist, testing a real component instead
      await import("@/components/ui/button");
      steps.push("Step 4c: UI component imported successfully");
    } catch (importError: unknown) {
      const err = importError as Error;
      steps.push(`Step 4 ERROR: Import failed - ${err.message}`);
      errorDetails = { ...errorDetails, importError: err.stack };
    }

    // Step 5: Test database connection (without actually connecting)
    steps.push("Step 5: Checking database config");
    const hasDbUrl = !!process.env["DATABASE_URL"];
    steps.push(`Step 5: DATABASE_URL configured: ${hasDbUrl}`);

    // Step 6: Test Next.js config access
    steps.push("Step 6: Testing Next.js internals");
    try {
      const headers = request.headers;
      const host = headers.get("host");
      const userAgent = headers.get("user-agent");
      steps.push(`Step 6: Host=${host}, UA=${userAgent?.substring(0, 50)}...`);
    } catch (nextError: unknown) {
      const err = nextError as Error;
      steps.push(`Step 6 ERROR: Next.js internals - ${err.message}`);
    }

    // Step 7: Test auth component loading (conditional)
    steps.push("Step 7: Testing auth components");
    if (nodeEnv === "development" || nodeEnv === "test") {
      try {
        const { currentUser } = await import("@clerk/nextjs/server");
        steps.push("Step 7: Clerk server components loaded");

        // Try to get current user (might be null)
        const user = await currentUser();
        steps.push(`Step 7: Current user check: ${user ? "authenticated" : "anonymous"}`);
      } catch (authError: unknown) {
        const err = authError as Error;
        steps.push(`Step 7 ERROR: Auth components - ${err.message}`);
        errorDetails = { ...errorDetails, authError: err.stack };
      }
    } else {
      steps.push("Step 7: Skipped (production mode without auth)");
    }

    // Step 8: Test static file access
    steps.push("Step 8: Testing static file access");
    try {
      const fs = await import("node:fs/promises");
      const path = await import("node:path");
      const publicPath = path.join(process.cwd(), "public");
      const exists = await fs
        .access(publicPath)
        .then(() => true)
        .catch(() => false);
      steps.push(`Step 8: Public directory accessible: ${exists}`);
    } catch (fsError: unknown) {
      const err = fsError as Error;
      steps.push(`Step 8 ERROR: File system - ${err.message}`);
    }
  } catch (error: unknown) {
    const err = error as Error;
    steps.push(`FATAL ERROR: ${err.message}`);
    errorDetails = { ...errorDetails, fatalError: err.stack };
  }

  // Generate HTML response
  const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Debug Test Page</title>
  <style>
    body {
      font-family: monospace;
      padding: 20px;
      max-width: 1200px;
      margin: 0 auto;
      background: #f5f5f5;
    }
    h1 { color: #333; }
    .step {
      background: white;
      padding: 10px;
      margin: 5px 0;
      border-left: 3px solid #4CAF50;
    }
    .error {
      border-left-color: #f44336;
      background: #ffebee;
    }
    .warning {
      border-left-color: #ff9800;
      background: #fff3e0;
    }
    pre {
      background: #f0f0f0;
      padding: 10px;
      overflow-x: auto;
    }
    .timestamp {
      color: #666;
      font-size: 0.9em;
    }
  </style>
</head>
<body>
  <h1>🔍 Vercel Debug Test Page</h1>
  <div class="timestamp">Generated at: ${new Date().toISOString()}</div>

  <h2>Execution Steps:</h2>
  ${steps
    .map((step) => {
      const isError = step.includes("ERROR");
      const isWarning = step.includes("Skipped") || step.includes("false");
      const className = isError ? "step error" : isWarning ? "step warning" : "step";
      return `<div class="${className}">${step}</div>`;
    })
    .join("\n")}

  ${
    errorDetails
      ? `
    <h2>Error Details:</h2>
    <pre>${JSON.stringify(errorDetails, null, 2)}</pre>
  `
      : ""
  }

  <h2>Environment Summary:</h2>
  <pre>
Node Version: ${process.version}
Platform: ${process.platform}
Architecture: ${process.arch}
Environment: ${process.env["NODE_ENV"] || "not set"}
Vercel: ${process.env["VERCEL"] || "false"}
Vercel ENV: ${process.env["VERCEL_ENV"] || "not set"}
Region: ${process.env["VERCEL_REGION"] || "not set"}
  </pre>
</body>
</html>
  `;

  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
}
