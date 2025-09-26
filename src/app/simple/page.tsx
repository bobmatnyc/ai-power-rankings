export default function SimplePage() {
  // This is the most minimal possible Next.js page
  // No imports, no components, just basic HTML

  const timestamp = new Date().toISOString();
  const nodeVersion = process.version;
  const env = process.env["NODE_ENV"];

  return (
    <html lang="en">
      <body style={{ fontFamily: "monospace", padding: "20px" }}>
        <h1>✅ Simple Test Page</h1>
        <p>If you can see this, basic SSR is working!</p>

        <h2>Server Info:</h2>
        <ul>
          <li>Timestamp: {timestamp}</li>
          <li>Node Version: {nodeVersion}</li>
          <li>Environment: {env}</li>
        </ul>

        <h2>Quick Tests:</h2>
        <div style={{ background: "#f0f0f0", padding: "10px", marginTop: "10px" }}>
          <p>1. Basic HTML rendering: ✅ Working (you can see this)</p>
          <p>2. Server-side code execution: {nodeVersion ? "✅ Working" : "❌ Failed"}</p>
          <p>3. Environment variables: {env ? "✅ Accessible" : "⚠️ Not set"}</p>
        </div>

        <h2>Next Steps:</h2>
        <ol>
          <li>
            Visit <a href="/api/debug/test-page">/api/debug/test-page</a> for detailed diagnostics
          </li>
          <li>
            Check <a href="/">Home page</a> to see if it loads
          </li>
        </ol>
      </body>
    </html>
  );
}
