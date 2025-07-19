#!/usr/bin/env node

import { exec } from "node:child_process";
import { promisify } from "node:util";
import axios from "axios";
import { config } from "dotenv";

const execAsync = promisify(exec);

// Load environment variables
config({ path: ".env.local" });

const VERCEL_TOKEN = process.env["VERCEL_TOKEN"];
const MAX_WAIT_TIME = 300000; // 5 minutes
const CHECK_INTERVAL = 10000; // 10 seconds

interface Deployment {
  uid: string;
  url: string;
  state: string;
  ready: boolean;
  created: number;
  meta?: {
    githubCommitRef?: string;
    githubCommitSha?: string;
  };
}

interface VercelProject {
  id: string;
  name: string;
  git?: {
    repo: string;
  };
}

interface VercelEvent {
  type: string;
  payload: {
    text: string;
  };
}

async function getLatestCommitSha(): Promise<string> {
  try {
    const { stdout } = await execAsync("git rev-parse HEAD");
    return stdout.trim();
  } catch (error) {
    console.error("Error getting commit SHA:", error);
    throw error;
  }
}

async function getProjectId(): Promise<string | null> {
  try {
    const response = await axios.get("https://api.vercel.com/v9/projects", {
      headers: {
        Authorization: `Bearer ${VERCEL_TOKEN}`,
      },
    });

    const project = response.data.projects.find(
      (p: VercelProject) => p.name === "ai-power-rankings" || p.git?.repo === "ai-power-rankings"
    );

    return project?.id || null;
  } catch (error) {
    console.error("Error fetching project:", error);
    return null;
  }
}

async function getDeploymentByCommit(
  projectId: string,
  commitSha: string
): Promise<Deployment | null> {
  try {
    const response = await axios.get(
      `https://api.vercel.com/v6/deployments?projectId=${projectId}&limit=10`,
      {
        headers: {
          Authorization: `Bearer ${VERCEL_TOKEN}`,
        },
      }
    );

    const deployment = response.data.deployments.find(
      (d: Deployment) => d.meta?.githubCommitSha === commitSha
    );

    return deployment || null;
  } catch (error) {
    console.error("Error fetching deployments:", error);
    return null;
  }
}

async function getDeploymentStatus(deploymentId: string): Promise<Deployment | null> {
  try {
    const response = await axios.get(`https://api.vercel.com/v13/deployments/${deploymentId}`, {
      headers: {
        Authorization: `Bearer ${VERCEL_TOKEN}`,
      },
    });

    return response.data;
  } catch (error) {
    console.error("Error fetching deployment status:", error);
    return null;
  }
}

async function getBuildLogs(deploymentId: string): Promise<string[]> {
  try {
    const response = await axios.get(
      `https://api.vercel.com/v2/deployments/${deploymentId}/events`,
      {
        headers: {
          Authorization: `Bearer ${VERCEL_TOKEN}`,
        },
      }
    );

    return response.data
      .filter((event: VercelEvent) => event.type === "stdout" || event.type === "stderr")
      .map((event: VercelEvent) => event.payload.text);
  } catch (error) {
    console.error("Error fetching build logs:", error);
    return [];
  }
}

async function waitForDeployment(deploymentId: string): Promise<boolean> {
  const startTime = Date.now();

  while (Date.now() - startTime < MAX_WAIT_TIME) {
    const deployment = await getDeploymentStatus(deploymentId);

    if (!deployment) {
      console.error("Failed to get deployment status");
      return false;
    }

    console.log(`Deployment state: ${deployment.state}`);

    if (deployment.state === "READY") {
      console.log("✅ Deployment successful!");
      console.log(`🌐 URL: https://${deployment.url}`);
      return true;
    }

    if (deployment.state === "ERROR" || deployment.state === "CANCELED") {
      console.error(`❌ Deployment failed with state: ${deployment.state}`);

      // Get build logs
      const logs = await getBuildLogs(deploymentId);
      if (logs.length > 0) {
        console.log("\n📋 Build logs:");
        logs.slice(-50).forEach((log) => console.log(log)); // Last 50 lines
      }

      return false;
    }

    // Wait before next check
    await new Promise((resolve) => setTimeout(resolve, CHECK_INTERVAL));
  }

  console.error("❌ Deployment timed out");
  return false;
}

async function checkVercelDeployment() {
  if (!VERCEL_TOKEN) {
    console.error("❌ VERCEL_TOKEN not found in environment variables");
    process.exit(1);
  }

  console.log("🚀 Checking Vercel deployment status...\n");

  try {
    // Get latest commit SHA
    const commitSha = await getLatestCommitSha();
    console.log(`📍 Latest commit: ${commitSha.substring(0, 7)}`);

    // Get project ID
    const projectId = await getProjectId();
    if (!projectId) {
      console.error("❌ Could not find project ID");
      process.exit(1);
    }

    console.log(`📦 Project ID: ${projectId}`);
    console.log("⏳ Waiting for deployment to start...");

    // Wait for deployment to appear (GitHub webhook might take a moment)
    let deployment: Deployment | null = null;
    let attempts = 0;
    const maxAttempts = 12; // 2 minutes

    while (!deployment && attempts < maxAttempts) {
      deployment = await getDeploymentByCommit(projectId, commitSha);
      if (!deployment) {
        attempts++;
        await new Promise((resolve) => setTimeout(resolve, 10000));
      }
    }

    if (!deployment) {
      console.error("❌ No deployment found for this commit");
      console.log("💡 Make sure the commit has been pushed to GitHub");
      process.exit(1);
    }

    console.log(`\n🔍 Found deployment: ${deployment.uid}`);
    console.log(`🌐 Preview URL: https://${deployment.url}`);

    // Wait for deployment to complete
    const success = await waitForDeployment(deployment.uid);

    if (success) {
      console.log("\n✨ Deployment completed successfully!");
      process.exit(0);
    } else {
      console.error("\n❌ Deployment failed!");
      console.log("\n💡 To debug:");
      console.log("   1. Visit: https://vercel.com/ai-power-rankings/deployments");
      console.log("   2. Check the failed deployment logs");
      console.log("   3. Fix any TypeScript or build errors");
      console.log("   4. Push fixes to trigger a new deployment");
      process.exit(1);
    }
  } catch (error) {
    console.error("❌ Unexpected error:", error);
    process.exit(1);
  }
}

// Run the check
checkVercelDeployment();
