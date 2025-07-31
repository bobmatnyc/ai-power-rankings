#!/usr/bin/env node

const { spawn } = require("node:child_process");
const path = require("node:path");

console.log("🚀 Starting AI Power Rankings development server...");
console.log("📝 Logs will be saved to: dev-server.log");
console.log("🛑 Press Ctrl+C to stop the server\n");

// Change to project root directory
process.chdir(path.join(__dirname, ".."));

// Start the dev server
const devServer = spawn("pnpm", ["dev"], {
  stdio: ["ignore", "pipe", "pipe"],
  shell: true,
  detached: false,
});

// Write output to both console and log file
const fs = require("node:fs");
const logStream = fs.createWriteStream("dev-server.log", { flags: "a" });

devServer.stdout.on("data", (data) => {
  const output = data.toString();
  process.stdout.write(output);
  logStream.write(output);
});

devServer.stderr.on("data", (data) => {
  const output = data.toString();
  process.stderr.write(output);
  logStream.write(output);
});

// Handle process termination
devServer.on("close", (code) => {
  console.log(`\n🛑 Dev server stopped with code ${code}`);
  logStream.end();
  process.exit(code);
});

// Handle Ctrl+C gracefully
process.on("SIGINT", () => {
  console.log("\n🛑 Stopping dev server...");
  devServer.kill("SIGTERM");
});

// Handle errors
devServer.on("error", (err) => {
  console.error("❌ Failed to start dev server:", err);
  logStream.end();
  process.exit(1);
});

// Keep the process alive
process.stdin.resume();
