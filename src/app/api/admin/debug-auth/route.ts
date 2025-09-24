import { currentUser, auth as getAuth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getDb, testConnection } from "@/lib/db/connection";
import { ArticlesRepository } from "@/lib/db/repositories/articles.repository";

/**
 * GET /api/admin/debug-auth
 * Comprehensive authentication debugging endpoint
 *
 * This endpoint provides detailed information about:
 * - Current user authentication state
 * - Environment variables
 * - Database connection status
 * - Articles repository test
 *
 * IMPORTANT: This endpoint should be removed or secured in production
 */
export async function GET() {
  console.log("[DEBUG-AUTH] Starting comprehensive authentication debug");

  const debugInfo: Record<string, any> = {
    timestamp: new Date().toISOString(),
    environment: process.env["NODE_ENV"] || "unknown",
    vercelEnv: process.env["VERCEL_ENV"] || "not-vercel",
  };

  try {
    // 1. Check Clerk authentication
    console.log("[DEBUG-AUTH] Checking Clerk authentication...");
    debugInfo.authentication = {};

    try {
      // Get current user
      const user = await currentUser();
      debugInfo.authentication.currentUser = user
        ? {
            id: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            emailAddresses: user.emailAddresses?.map((email) => ({
              emailAddress: email.emailAddress,
              id: email.id,
            })),
            publicMetadata: user.publicMetadata,
            privateMetadata: user.privateMetadata,
            unsafeMetadata: user.unsafeMetadata,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
          }
        : null;

      // Get auth session
      const authResult = await getAuth();
      debugInfo.authentication.session = authResult
        ? {
            userId: authResult.userId,
            sessionId: authResult.sessionId,
            sessionClaims: authResult.sessionClaims,
            orgId: authResult.orgId,
            orgRole: authResult.orgRole,
            orgSlug: authResult.orgSlug,
          }
        : null;

      // Check admin status
      const isAdmin = user?.publicMetadata?.isAdmin === true;
      debugInfo.authentication.isAdmin = isAdmin;
      debugInfo.authentication.adminCheckDetails = {
        hasUser: !!user,
        hasPublicMetadata: !!user?.publicMetadata,
        isAdminValue: user?.publicMetadata?.isAdmin,
        isAdminType: typeof user?.publicMetadata?.isAdmin,
        evaluatesToTrue: isAdmin,
      };
    } catch (authError) {
      console.error("[DEBUG-AUTH] Auth error:", authError);
      debugInfo.authentication.error = {
        message: authError instanceof Error ? authError.message : "Unknown auth error",
        stack: authError instanceof Error ? authError.stack?.split("\n").slice(0, 5) : undefined,
      };
    }

    // 2. Check environment variables (sanitized)
    console.log("[DEBUG-AUTH] Checking environment variables...");
    debugInfo.environmentVariables = {
      auth: {
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"]
          ? "✅ Set"
          : "❌ Not set",
        CLERK_SECRET_KEY: process.env["CLERK_SECRET_KEY"] ? "✅ Set" : "❌ Not set",
        NEXT_PUBLIC_DISABLE_AUTH: process.env["NEXT_PUBLIC_DISABLE_AUTH"] || "not set",
        NEXT_PUBLIC_CLERK_SIGN_IN_URL: process.env["NEXT_PUBLIC_CLERK_SIGN_IN_URL"] || "/sign-in",
        NEXT_PUBLIC_CLERK_SIGN_UP_URL: process.env["NEXT_PUBLIC_CLERK_SIGN_UP_URL"] || "/sign-up",
        NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL:
          process.env["NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL"] || "/",
        NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL:
          process.env["NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL"] || "/",
      },
      database: {
        USE_DATABASE: process.env["USE_DATABASE"] || "not set",
        DATABASE_URL: process.env["DATABASE_URL"] ? "✅ Set" : "❌ Not set",
        DATABASE_URL_DEVELOPMENT: process.env["DATABASE_URL_DEVELOPMENT"] ? "✅ Set" : "❌ Not set",
        DATABASE_URL_STAGING: process.env["DATABASE_URL_STAGING"] ? "✅ Set" : "❌ Not set",
      },
      general: {
        NODE_ENV: process.env["NODE_ENV"] || "not set",
        VERCEL_ENV: process.env["VERCEL_ENV"] || "not set",
        VERCEL_URL: process.env["VERCEL_URL"] || "not set",
        VERCEL_PRODUCTION_URL: process.env["VERCEL_PRODUCTION_URL"] || "not set",
        NEXT_PUBLIC_BASE_URL: process.env["NEXT_PUBLIC_BASE_URL"] || "not set",
      },
    };

    // 3. Test database connection
    console.log("[DEBUG-AUTH] Testing database connection...");
    debugInfo.database = {
      status: "checking",
    };

    try {
      const db = getDb();
      debugInfo.database.hasConnection = !!db;

      if (db) {
        // Test the connection
        const connectionTest = await testConnection();
        debugInfo.database.connectionTestResult = connectionTest;

        // Try to run a simple query
        try {
          const result = await db.execute(
            "SELECT version() as version, current_database() as database, current_user as user"
          );
          debugInfo.database.queryTest = {
            success: true,
            result: result.rows?.[0] || "No result",
          };
        } catch (queryError) {
          debugInfo.database.queryTest = {
            success: false,
            error: queryError instanceof Error ? queryError.message : "Query failed",
          };
        }
      } else {
        debugInfo.database.status = "No database connection available";
      }
    } catch (dbError) {
      console.error("[DEBUG-AUTH] Database error:", dbError);
      debugInfo.database.error = {
        message: dbError instanceof Error ? dbError.message : "Unknown database error",
        stack: dbError instanceof Error ? dbError.stack?.split("\n").slice(0, 5) : undefined,
      };
    }

    // 4. Test ArticlesRepository
    console.log("[DEBUG-AUTH] Testing ArticlesRepository...");
    debugInfo.articlesRepository = {
      status: "checking",
    };

    try {
      const db = getDb();
      if (db) {
        const articlesRepo = new ArticlesRepository();

        // Try to get article count
        try {
          const stats = await articlesRepo.getArticleStats();
          debugInfo.articlesRepository.stats = stats;
          debugInfo.articlesRepository.success = true;
        } catch (repoError) {
          debugInfo.articlesRepository.error = {
            message: repoError instanceof Error ? repoError.message : "Repository operation failed",
            stack:
              repoError instanceof Error ? repoError.stack?.split("\n").slice(0, 5) : undefined,
          };
        }

        // Try to get a few articles
        try {
          const articles = await articlesRepo.getArticles({
            status: "active",
            limit: 3,
            offset: 0,
          });
          debugInfo.articlesRepository.sampleArticles = {
            count: articles.length,
            firstArticle: articles[0]
              ? {
                  id: articles[0].id,
                  title: articles[0].title,
                  status: articles[0].status,
                  createdAt: articles[0].createdAt,
                }
              : null,
          };
        } catch (articlesError) {
          debugInfo.articlesRepository.articlesError = {
            message:
              articlesError instanceof Error ? articlesError.message : "Failed to fetch articles",
          };
        }
      } else {
        debugInfo.articlesRepository.status = "No database connection available";
      }
    } catch (repoError) {
      console.error("[DEBUG-AUTH] Repository error:", repoError);
      debugInfo.articlesRepository.error = {
        message: repoError instanceof Error ? repoError.message : "Unknown repository error",
        stack: repoError instanceof Error ? repoError.stack?.split("\n").slice(0, 5) : undefined,
      };
    }

    // 5. Test what the admin articles endpoint would return
    console.log("[DEBUG-AUTH] Simulating admin articles endpoint logic...");
    debugInfo.adminEndpointSimulation = {
      wouldAuthenticate: false,
      wouldAuthorize: false,
      wouldFetchArticles: false,
      details: {},
    };

    const isAuthDisabled = process.env["NEXT_PUBLIC_DISABLE_AUTH"] === "true";
    debugInfo.adminEndpointSimulation.isAuthDisabled = isAuthDisabled;

    if (!isAuthDisabled) {
      const user = debugInfo.authentication.currentUser;
      if (!user) {
        debugInfo.adminEndpointSimulation.details.reason = "No authenticated user";
        debugInfo.adminEndpointSimulation.details.wouldReturn = "401 Unauthorized";
      } else {
        debugInfo.adminEndpointSimulation.wouldAuthenticate = true;
        const isAdmin = user.publicMetadata?.isAdmin === true;
        if (!isAdmin) {
          debugInfo.adminEndpointSimulation.details.reason = "User is not admin";
          debugInfo.adminEndpointSimulation.details.wouldReturn = "403 Forbidden";
          debugInfo.adminEndpointSimulation.details.userMetadata = user.publicMetadata;
        } else {
          debugInfo.adminEndpointSimulation.wouldAuthorize = true;
          debugInfo.adminEndpointSimulation.wouldFetchArticles = !!debugInfo.database.hasConnection;
          debugInfo.adminEndpointSimulation.details.wouldReturn = debugInfo.database.hasConnection
            ? "200 OK with articles"
            : "503 Service Unavailable (no database)";
        }
      }
    } else {
      debugInfo.adminEndpointSimulation.wouldAuthenticate = true;
      debugInfo.adminEndpointSimulation.wouldAuthorize = true;
      debugInfo.adminEndpointSimulation.wouldFetchArticles = !!debugInfo.database.hasConnection;
      debugInfo.adminEndpointSimulation.details.reason = "Auth is disabled";
      debugInfo.adminEndpointSimulation.details.wouldReturn = debugInfo.database.hasConnection
        ? "200 OK with articles"
        : "503 Service Unavailable (no database)";
    }

    // 6. Summary and recommendations
    console.log("[DEBUG-AUTH] Generating summary...");
    debugInfo.summary = {
      authenticationStatus: debugInfo.authentication.currentUser
        ? "✅ Authenticated"
        : "❌ Not authenticated",
      adminStatus: debugInfo.authentication.isAdmin ? "✅ Is admin" : "❌ Not admin",
      databaseStatus: debugInfo.database.hasConnection ? "✅ Connected" : "❌ Not connected",
      expectedBehavior: debugInfo.adminEndpointSimulation.details.wouldReturn,
      recommendations: [],
    };

    // Generate recommendations based on findings
    if (!debugInfo.authentication.currentUser) {
      debugInfo.summary.recommendations.push("User is not authenticated. Ensure you're signed in.");
    }
    if (debugInfo.authentication.currentUser && !debugInfo.authentication.isAdmin) {
      debugInfo.summary.recommendations.push(
        "User is authenticated but not admin. Update Clerk user metadata with { isAdmin: true }"
      );
    }
    if (!debugInfo.database.hasConnection) {
      debugInfo.summary.recommendations.push(
        "Database is not connected. Check DATABASE_URL environment variable and USE_DATABASE setting."
      );
    }
    if (!process.env["CLERK_SECRET_KEY"]) {
      debugInfo.summary.recommendations.push(
        "CLERK_SECRET_KEY is not set. This is required for server-side authentication."
      );
    }

    console.log("[DEBUG-AUTH] Debug info generated successfully");

    return NextResponse.json(debugInfo, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  } catch (error) {
    console.error("[DEBUG-AUTH] Fatal error:", error);
    return NextResponse.json(
      {
        error: "Fatal error in debug endpoint",
        message: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack?.split("\n").slice(0, 10) : undefined,
        debugInfo,
      },
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }
}

/**
 * OPTIONS /api/admin/debug-auth
 * Handle preflight requests
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
