#!/usr/bin/env node

import axios from "axios";
import { config } from "dotenv";

// Load environment variables
config({ path: ".env.local" });

const VERCEL_TOKEN = process.env["VERCEL_TOKEN"];

if (!VERCEL_TOKEN) {
  console.error("❌ VERCEL_TOKEN not found in environment variables");
  process.exit(1);
}

// Function to get project ID
async function getProjectId() {
  try {
    const response = await axios.get("https://api.vercel.com/v9/projects", {
      headers: {
        Authorization: `Bearer ${VERCEL_TOKEN}`,
      },
    });

    const project = response.data.projects.find(
      (p) => p.name === "ai-power-rankings" || p.git?.repo === "ai-power-rankings"
    );

    if (!project) {
      console.error("❌ Project 'ai-power-rankings' not found");
      return null;
    }

    return project.id;
  } catch (error) {
    console.error(
      "❌ Error fetching projects:",
      (error as { response?: { data?: unknown } }).response?.data || (error as Error).message
    );
    return null;
  }
}

// Function to get environment variables
async function getEnvironmentVariables(projectId: string) {
  try {
    const response = await axios.get(`https://api.vercel.com/v9/projects/${projectId}/env`, {
      headers: {
        Authorization: `Bearer ${VERCEL_TOKEN}`,
      },
    });

    return response.data.envs;
  } catch (error) {
    console.error(
      "❌ Error fetching environment variables:",
      (error as { response?: { data?: unknown } }).response?.data || (error as Error).message
    );
    return [];
  }
}

// Main function
async function verifyVercelEnvironment() {
  console.log("🔍 Checking Vercel environment variables...\n");

  // Get project ID
  const projectId = await getProjectId();
  if (!projectId) {
    return;
  }

  console.log(`✅ Found project ID: ${projectId}\n`);

  // Get environment variables
  const envVars = await getEnvironmentVariables(projectId);

  // Check for SEO-related variables
  const seoVariables = [
    "GOOGLE_SEARCH_CONSOLE_SITE_URL",
    "GOOGLE_API_KEY",
    "GOOGLE_OAUTH_CLIENT_ID",
    "GOOGLE_OAUTH_CLIENT_SECRET",
    "NEXT_PUBLIC_GA_ID",
  ];

  console.log("📋 SEO-related environment variables:\n");

  for (const varName of seoVariables) {
    const envVar = envVars.find((v) => v.key === varName);
    if (envVar) {
      const value = envVar.value || envVar.encryptedValue;
      const preview = value ? (value.length > 20 ? `${value.substring(0, 20)}...` : value) : "N/A";
      console.log(`✅ ${varName}: ${envVar.type === "encrypted" ? "[ENCRYPTED]" : preview}`);
      console.log(`   Targets: ${envVar.target.join(", ")}`);
    } else {
      console.log(`❌ ${varName}: NOT SET`);
    }
  }

  // Check other important variables
  console.log("\n📋 Other important environment variables:\n");

  const otherVariables = ["AUTH_SECRET", "NEXTAUTH_SECRET", "NEXTAUTH_URL", "NEXT_PUBLIC_BASE_URL"];

  for (const varName of otherVariables) {
    const envVar = envVars.find((v) => v.key === varName);
    if (envVar) {
      const value = envVar.value || envVar.encryptedValue;
      const preview = value ? (value.length > 20 ? `${value.substring(0, 20)}...` : value) : "N/A";
      console.log(`✅ ${varName}: ${envVar.type === "encrypted" ? "[ENCRYPTED]" : preview}`);
    } else {
      console.log(`❌ ${varName}: NOT SET`);
    }
  }

  console.log("\n📊 Total environment variables: " + envVars.length);
}

// Run the verification
verifyVercelEnvironment();
