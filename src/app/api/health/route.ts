import { NextResponse } from "next/server";
import { getToolsRepo, getCompaniesRepo, getRankingsRepo, getNewsRepo } from "@/lib/json-db";
import fs from "fs/promises";
import path from "path";

interface HealthCheck {
  status: "healthy" | "degraded" | "unhealthy";
  message: string;
  details?: any;
}

interface HealthReport {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  checks: {
    dataFiles: HealthCheck;
    repositories: HealthCheck;
    memory: HealthCheck;
    cache: HealthCheck;
  };
  system: {
    uptime: number;
    memory: NodeJS.MemoryUsage;
    version: string;
  };
}

async function checkDataFiles(): Promise<HealthCheck> {
  try {
    const jsonDataDir = path.join(process.cwd(), "data", "json");
    const requiredFiles = [
      "tools.json",
      "companies.json",
      "rankings/current.json",
      "news/articles.json",
    ];

    const missingFiles: string[] = [];

    for (const file of requiredFiles) {
      try {
        await fs.access(path.join(jsonDataDir, file));
      } catch {
        missingFiles.push(file);
      }
    }

    if (missingFiles.length > 0) {
      return {
        status: "unhealthy",
        message: "Missing required data files",
        details: { missingFiles },
      };
    }

    return {
      status: "healthy",
      message: "All data files present",
    };
  } catch (error) {
    return {
      status: "unhealthy",
      message: "Failed to check data files",
      details: { error: String(error) },
    };
  }
}

async function checkRepositories(): Promise<HealthCheck> {
  try {
    // Test each repository
    const toolsRepo = getToolsRepo();
    const companiesRepo = getCompaniesRepo();
    const rankingsRepo = getRankingsRepo();
    const newsRepo = getNewsRepo();

    const [tools, companies, currentPeriod, news] = await Promise.all([
      toolsRepo.getAll(),
      companiesRepo.getAll(),
      rankingsRepo.getCurrentPeriod(),
      newsRepo.getAll(),
    ]);

    const details = {
      toolsCount: tools.length,
      companiesCount: companies.length,
      currentRankingPeriod: currentPeriod,
      newsCount: news.length,
    };

    if (tools.length === 0 || companies.length === 0) {
      return {
        status: "degraded",
        message: "Some repositories have no data",
        details,
      };
    }

    return {
      status: "healthy",
      message: "All repositories functioning",
      details,
    };
  } catch (error) {
    return {
      status: "unhealthy",
      message: "Repository check failed",
      details: { error: String(error) },
    };
  }
}

function checkMemory(): HealthCheck {
  const usage = process.memoryUsage();
  const heapUsedMB = usage.heapUsed / 1024 / 1024;
  const heapTotalMB = usage.heapTotal / 1024 / 1024;
  const usagePercent = (usage.heapUsed / usage.heapTotal) * 100;

  const details = {
    heapUsedMB: heapUsedMB.toFixed(2),
    heapTotalMB: heapTotalMB.toFixed(2),
    usagePercent: usagePercent.toFixed(2) + "%",
  };

  if (usagePercent > 90) {
    return {
      status: "unhealthy",
      message: "Memory usage critical",
      details,
    };
  } else if (usagePercent > 70) {
    return {
      status: "degraded",
      message: "Memory usage high",
      details,
    };
  }

  return {
    status: "healthy",
    message: "Memory usage normal",
    details,
  };
}

async function checkCache(): Promise<HealthCheck> {
  try {
    const cacheDir = path.join(process.cwd(), "src", "data", "cache");
    const cacheFiles = ["rankings-cache.json", "tools-cache.json", "news-cache.json"];

    const cacheStats: any = {};

    for (const file of cacheFiles) {
      try {
        const stats = await fs.stat(path.join(cacheDir, file));
        const ageHours = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60);
        cacheStats[file] = {
          size: (stats.size / 1024).toFixed(2) + "KB",
          ageHours: ageHours.toFixed(2),
        };
      } catch {
        cacheStats[file] = { status: "missing" };
      }
    }

    const allPresent = Object.values(cacheStats).every((stat: any) => stat.status !== "missing");

    if (!allPresent) {
      return {
        status: "degraded",
        message: "Some cache files missing",
        details: cacheStats,
      };
    }

    return {
      status: "healthy",
      message: "Cache files present",
      details: cacheStats,
    };
  } catch (error) {
    return {
      status: "degraded",
      message: "Cache check failed",
      details: { error: String(error) },
    };
  }
}

export async function GET(): Promise<NextResponse> {
  try {
    const [dataFiles, repositories, memory, cache] = await Promise.all([
      checkDataFiles(),
      checkRepositories(),
      checkMemory(),
      checkCache(),
    ]);

    const checks = { dataFiles, repositories, memory, cache };

    // Determine overall status
    const statuses = Object.values(checks).map((check) => check.status);
    let overallStatus: "healthy" | "degraded" | "unhealthy" = "healthy";

    if (statuses.includes("unhealthy")) {
      overallStatus = "unhealthy";
    } else if (statuses.includes("degraded")) {
      overallStatus = "degraded";
    }

    const report: HealthReport = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      checks,
      system: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: process.env["npm_package_version"] || "unknown",
      },
    };

    const statusCode = overallStatus === "healthy" ? 200 : overallStatus === "degraded" ? 200 : 503;

    return NextResponse.json(report, { status: statusCode });
  } catch (error) {
    return NextResponse.json(
      {
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        error: "Health check failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 503 }
    );
  }
}
