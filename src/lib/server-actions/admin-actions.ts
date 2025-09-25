/**
 * Server Actions for admin operations
 * This approach completely bypasses API routes and Clerk's middleware interference
 * Server Actions run in the same process as the page and don't go through middleware
 */

"use server";

import { isAuthenticatedManual, getUserInfoManual } from "@/lib/manual-auth";
import { getDb, testConnection } from "@/lib/db/connection";

/**
 * Server Action to get database status
 * This runs directly in the server component context, avoiding API route middleware
 */
export async function getDatabaseStatus() {
  try {
    console.log("[server-action] getDatabaseStatus called");

    // Check authentication
    const isAuth = await isAuthenticatedManual();
    console.log("[server-action] Authentication result:", isAuth);

    if (!isAuth) {
      return {
        success: false,
        error: "Unauthorized - Admin session required",
        authenticated: false,
      };
    }

    // Get database configuration
    const databaseUrl = process.env["DATABASE_URL"];
    const useDatabase = process.env["USE_DATABASE"] === "true";
    const nodeEnv = process.env["NODE_ENV"] || "development";

    // Test connection
    let isConnected = false;
    let connectionError = null;
    try {
      isConnected = await testConnection();
    } catch (error) {
      connectionError = error instanceof Error ? error.message : "Connection failed";
    }

    // Get instance status
    let hasActiveInstance = false;
    try {
      const db = getDb();
      hasActiveInstance = db !== null;
    } catch (error) {
      console.error("[server-action] Error getting database instance:", error);
    }

    return {
      success: true,
      data: {
        connected: isConnected,
        enabled: useDatabase,
        configured: Boolean(databaseUrl && !databaseUrl.includes("YOUR_PASSWORD")),
        hasActiveInstance,
        connectionError,
        environment: nodeEnv === "development" ? "development" : "production",
        nodeEnv,
        timestamp: new Date().toISOString(),
        status: isConnected ? "connected" : "disconnected",
        type: useDatabase ? "postgresql" : "json",
        authMethod: "server-action",
      },
    };
  } catch (error) {
    console.error("[server-action] Error in getDatabaseStatus:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      authenticated: false,
    };
  }
}

/**
 * Server Action to get articles
 */
export async function getArticles() {
  try {
    console.log("[server-action] getArticles called");

    // Check authentication
    const isAuth = await isAuthenticatedManual();
    if (!isAuth) {
      return {
        success: false,
        error: "Unauthorized - Admin session required",
        authenticated: false,
      };
    }

    // Mock articles data (in real implementation, query database)
    const articles = [
      {
        id: 1,
        title: "AI Power Rankings Update (Server Action)",
        excerpt: "Latest updates via server action",
        created_at: new Date().toISOString(),
        status: "published",
      },
      {
        id: 2,
        title: "Server Actions Test",
        excerpt: "Testing server actions as API alternative",
        created_at: new Date().toISOString(),
        status: "draft",
      },
    ];

    return {
      success: true,
      data: {
        articles,
        total: articles.length,
        timestamp: new Date().toISOString(),
        authMethod: "server-action",
      },
    };
  } catch (error) {
    console.error("[server-action] Error in getArticles:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      authenticated: false,
    };
  }
}

/**
 * Server Action to test authentication
 */
export async function testAuthentication() {
  try {
    console.log("[server-action] testAuthentication called");

    const isAuth = await isAuthenticatedManual();
    let userInfo = null;

    if (isAuth) {
      userInfo = await getUserInfoManual();
    }

    return {
      success: true,
      data: {
        authenticated: isAuth,
        user: userInfo,
        timestamp: new Date().toISOString(),
        authMethod: "server-action",
        authDisabled: process.env["NEXT_PUBLIC_DISABLE_AUTH"] === "true",
        nodeEnv: process.env["NODE_ENV"],
      },
    };
  } catch (error) {
    console.error("[server-action] Error in testAuthentication:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      authenticated: false,
    };
  }
}