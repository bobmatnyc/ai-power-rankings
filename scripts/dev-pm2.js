#!/usr/bin/env node

const { execSync, spawn } = require("node:child_process");
const path = require("node:path");

// Check if PM2 is installed
try {
  execSync("pm2 --version", { stdio: "ignore" });
} catch (error) {
  console.log("⚠️  PM2 not found. Installing PM2 globally...");
  try {
    execSync("npm install -g pm2", { stdio: "inherit" });
    console.log("✅ PM2 installed successfully!");
  } catch (installError) {
    console.error("❌ Failed to install PM2. Please install it manually: npm install -g pm2");
    process.exit(1);
  }
}

const projectRoot = path.join(__dirname, "..");
const command = process.argv[2];

// Default port for development server
// Port 3001 is the designated port for AI Power Rankings development
const PORT = process.env.PORT || 3001;

switch (command) {
  case "start":
    console.log(`🚀 Starting dev server with PM2 on port ${PORT}...`);
    execSync(`pm2 start pnpm --name "ai-power-rankings-dev" -- dev`, {
      cwd: projectRoot,
      stdio: "inherit",
      env: {
        ...process.env,
        PORT: PORT.toString(),
      },
    });
    console.log(`\n✅ Dev server started on port ${PORT}!`);
    console.log(`🌐 Access at: http://localhost:${PORT}`);
    console.log("📝 View logs: pm2 logs ai-power-rankings-dev");
    console.log("📊 Monitor: pm2 monit");
    console.log("🛑 Stop: npm run dev:pm2 stop");
    break;

  case "stop":
    console.log("🛑 Stopping dev server...");
    execSync("pm2 stop ai-power-rankings-dev", { stdio: "inherit" });
    break;

  case "restart":
    console.log("🔄 Restarting dev server...");
    execSync("pm2 restart ai-power-rankings-dev", { stdio: "inherit" });
    break;

  case "logs":
    console.log("📝 Showing dev server logs...");
    execSync("pm2 logs ai-power-rankings-dev", { stdio: "inherit" });
    break;

  case "status":
    execSync("pm2 list", { stdio: "inherit" });
    break;

  default:
    console.log(`
AI Power Rankings Dev Server Manager (PM2)

Usage:
  npm run dev:pm2 start    - Start the dev server on port 3001
  npm run dev:pm2 stop     - Stop the dev server
  npm run dev:pm2 restart  - Restart the dev server
  npm run dev:pm2 logs     - View server logs
  npm run dev:pm2 status   - Check server status

The dev server will:
- Run on port 3001 by default (designated development port)
- Keep running even if you close your terminal
- Automatically restart if it crashes
- Save logs for debugging

Access the development site at: http://localhost:3001
    `);
}
