#!/usr/bin/env node
import https from "https";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

const URLS_TO_CHECK = [
  "https://aipowerrankings.com",
  "https://www.aipowerrankings.com",
  "https://aipowerrankings.com/sitemap.xml",
  "https://ai-power-rankings-g6lb1iphe-1-m.vercel.app",
  "https://ai-power-rankings-g6lb1iphe-1-m.vercel.app/sitemap.xml",
];

async function checkUrl(url: string): Promise<void> {
  return new Promise((resolve) => {
    console.log(`\n🔍 Checking: ${url}`);
    
    const startTime = Date.now();
    
    https.get(url, { timeout: 10000 }, (res) => {
      const endTime = Date.now();
      console.log(`  ✓ Status: ${res.statusCode} (${endTime - startTime}ms)`);
      console.log(`  ✓ Headers:`, {
        location: res.headers.location,
        "content-type": res.headers["content-type"],
        server: res.headers.server,
      });
      resolve();
    }).on("error", (err) => {
      const endTime = Date.now();
      console.log(`  ✗ Error: ${err.message} (${endTime - startTime}ms)`);
      resolve();
    });
  });
}

async function checkDNS() {
  console.log("\n📡 DNS Information:");
  
  try {
    const { stdout: aRecord } = await execAsync("dig aipowerrankings.com A +short");
    console.log(`  A Record: ${aRecord.trim() || "Not found"}`);
  } catch (_error) {
    console.log("  A Record: Error checking");
  }
  
  try {
    const { stdout: cnameRecord } = await execAsync("dig aipowerrankings.com CNAME +short");
    console.log(`  CNAME: ${cnameRecord.trim() || "Not found"}`);
  } catch (_error) {
    console.log("  CNAME: Error checking");
  }
  
  try {
    const { stdout: nsLookup } = await execAsync("nslookup aipowerrankings.com");
    const lines = nsLookup.split("\n");
    const addressLine = lines.find(line => line.includes("Address:") && !line.includes("#"));
    if (addressLine) {
      console.log(`  nslookup: ${addressLine.trim()}`);
    }
  } catch (_error) {
    console.log("  nslookup: Error");
  }
}

async function checkVercelDomains() {
  console.log("\n🔧 Checking Vercel domain configuration...");
  
  try {
    const { stdout } = await execAsync("vercel domains ls 2>&1");
    console.log("Vercel Domains:");
    const lines = stdout.split("\n").slice(0, 20);
    lines.forEach(line => {
      if (line.includes("aipowerrankings") || line.includes("Domain")) {
        console.log(`  ${line}`);
      }
    });
  } catch (_error) {
    console.log("  Error checking Vercel domains");
  }
}

async function checkLocalSitemap() {
  console.log("\n📄 Checking local sitemap generation...");
  
  try {
    // Check if sitemap.ts exists
    const { stdout: fileCheck } = await execAsync("ls -la src/app/sitemap.ts 2>&1");
    console.log(`  Sitemap file: ${fileCheck.trim()}`);
    
    // Check local dev server
    const localUrl = "http://localhost:3000/sitemap.xml";
    await checkUrl(localUrl);
  } catch (_error) {
    console.log("  Error checking local sitemap");
  }
}

async function main() {
  console.log("🚀 Sitemap Connectivity Debugger");
  console.log("================================");
  
  // Check DNS
  await checkDNS();
  
  // Check URLs
  console.log("\n🌐 URL Connectivity:");
  for (const url of URLS_TO_CHECK) {
    await checkUrl(url);
  }
  
  // Check Vercel domains
  await checkVercelDomains();
  
  // Check local sitemap
  await checkLocalSitemap();
  
  console.log("\n📊 Summary:");
  console.log("  - If production URLs timeout, there may be DNS or CDN issues");
  console.log("  - If Vercel URLs work but custom domain doesn't, check domain configuration");
  console.log("  - If local sitemap works, the issue is with deployment or domain");
}

main().catch((error) => {
  console.error("❌ Unhandled error:", error);
  process.exit(1);
});