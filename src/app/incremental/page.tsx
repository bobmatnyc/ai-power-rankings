import { Suspense } from "react";

// Test 1: Can we import React?
function Test1() {
  return (
    <div style={{ border: "1px solid green", padding: "10px", margin: "10px 0" }}>
      ✅ Test 1: React import works
    </div>
  );
}

// Test 2: Can we use async components?
async function Test2() {
  // Simple async operation
  await new Promise((resolve) => setTimeout(resolve, 10));
  return (
    <div style={{ border: "1px solid green", padding: "10px", margin: "10px 0" }}>
      ✅ Test 2: Async component works
    </div>
  );
}

// Test 3: Can we load dictionaries?
async function Test3() {
  try {
    const { getDictionary } = await import("@/i18n/get-dictionary");
    const dict = await getDictionary("en");
    return (
      <div style={{ border: "1px solid green", padding: "10px", margin: "10px 0" }}>
        ✅ Test 3: Dictionary loading works (loaded {Object.keys(dict).length} keys)
      </div>
    );
  } catch (error: unknown) {
    return (
      <div style={{ border: "1px solid red", padding: "10px", margin: "10px 0" }}>
        ❌ Test 3: Dictionary failed - {(error as Error).message}
      </div>
    );
  }
}

// Test 4: Can we check auth without loading components?
async function Test4() {
  try {
    const isDev = process.env["NODE_ENV"] === "development" || process.env["NODE_ENV"] === "test";
    const hasKeys = !!process.env["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"];

    if (!isDev) {
      return (
        <div style={{ border: "1px solid orange", padding: "10px", margin: "10px 0" }}>
          ⚠️ Test 4: Auth skipped (production mode without keys)
        </div>
      );
    }

    if (!hasKeys) {
      return (
        <div style={{ border: "1px solid orange", padding: "10px", margin: "10px 0" }}>
          ⚠️ Test 4: Auth skipped (no Clerk keys configured)
        </div>
      );
    }

    // Only try to import if we're in dev mode with keys
    const { currentUser } = await import("@clerk/nextjs/server");
    const user = await currentUser();

    return (
      <div style={{ border: "1px solid green", padding: "10px", margin: "10px 0" }}>
        ✅ Test 4: Auth check works (user: {user ? "authenticated" : "anonymous"})
      </div>
    );
  } catch (error: unknown) {
    return (
      <div style={{ border: "1px solid red", padding: "10px", margin: "10px 0" }}>
        ❌ Test 4: Auth failed - {(error as Error).message}
      </div>
    );
  }
}

// Test 5: Can we import our components?
async function Test5() {
  try {
    // Just import, don't render
    // Note: Header component doesn't exist, testing a real component instead
    await import("@/components/ui/button");
    return (
      <div style={{ border: "1px solid green", padding: "10px", margin: "10px 0" }}>
        ✅ Test 5: Component imports work
      </div>
    );
  } catch (error: unknown) {
    return (
      <div style={{ border: "1px solid red", padding: "10px", margin: "10px 0" }}>
        ❌ Test 5: Component import failed - {(error as Error).message}
      </div>
    );
  }
}

// Test 6: Can we access static files?
async function Test6() {
  try {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const publicPath = path.join(process.cwd(), "public");
    await fs.access(publicPath);
    return (
      <div style={{ border: "1px solid green", padding: "10px", margin: "10px 0" }}>
        ✅ Test 6: File system access works
      </div>
    );
  } catch (error: unknown) {
    return (
      <div style={{ border: "1px solid red", padding: "10px", margin: "10px 0" }}>
        ❌ Test 6: File system failed - {(error as Error).message}
      </div>
    );
  }
}

export default function IncrementalTestPage() {
  return (
    <div style={{ fontFamily: "monospace", padding: "20px", maxWidth: "800px", margin: "0 auto" }}>
      <h1>🔬 Incremental Test Page</h1>
      <p>Testing components one by one to isolate the issue...</p>

      <div
        style={{
          background: "#f5f5f5",
          padding: "15px",
          borderRadius: "5px",
          marginBottom: "20px",
        }}
      >
        <strong>Environment:</strong>
        <br />
        Node: {process.version}
        <br />
        Env: {process.env["NODE_ENV"]}
        <br />
        Vercel: {process.env["VERCEL"] || "false"}
        <br />
        Timestamp: {new Date().toISOString()}
      </div>

      <h2>Test Results:</h2>

      <Test1 />

      <Suspense fallback={<div>Loading Test 2...</div>}>
        <Test2 />
      </Suspense>

      <Suspense fallback={<div>Loading Test 3...</div>}>
        <Test3 />
      </Suspense>

      <Suspense fallback={<div>Loading Test 4...</div>}>
        <Test4 />
      </Suspense>

      <Suspense fallback={<div>Loading Test 5...</div>}>
        <Test5 />
      </Suspense>

      <Suspense fallback={<div>Loading Test 6...</div>}>
        <Test6 />
      </Suspense>

      <div
        style={{ marginTop: "30px", padding: "15px", background: "#e3f2fd", borderRadius: "5px" }}
      >
        <h3>Other Test Pages:</h3>
        <ul>
          <li>
            <a href="/simple">Simple Page</a> - Minimal HTML only
          </li>
          <li>
            <a href="/api/debug/test-page">API Debug Page</a> - Detailed diagnostics
          </li>
          <li>
            <a href="/">Home Page</a> - Full application
          </li>
        </ul>
      </div>
    </div>
  );
}
