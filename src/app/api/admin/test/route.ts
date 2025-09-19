import { type NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/clerk-auth";

interface DebugResponse {
  success: boolean;
  debug?: {
    method: string;
    url: string;
    headers: Record<string, string>;
    bodyText: string;
    bodyJson: unknown;
    error: string | null;
    hasBody: boolean;
    bodyReadable: boolean | undefined;
  };
  error?: string;
}

export async function GET(_request: NextRequest) {
  return withAuth(async () => {
    return NextResponse.json({
      success: true,
      message: "Admin authentication is working correctly",
      timestamp: new Date().toISOString(),
    });
  });
}

export async function POST(request: NextRequest) {
  return withAuth(async () => {
    try {
      // Get headers
      const headers = Object.fromEntries(request.headers.entries());

      // Try to get body in different ways
      let bodyText = "";
      let bodyJson: unknown = null;
      let error: string | null = null;

      try {
        // Clone request to preserve it
        const clonedRequest = request.clone();
        bodyText = await clonedRequest.text();
      } catch (e) {
        error = `text() failed: ${e}`;
      }

      try {
        bodyJson = await request.json();
      } catch (e) {
        error = `json() failed: ${e}`;
      }

      const response: DebugResponse = {
        success: true,
        debug: {
          method: request.method,
          url: request.url,
          headers,
          bodyText,
          bodyJson,
          error,
          hasBody: !!request.body,
          bodyReadable: request.body
            ? (request.body as ReadableStream).locked !== undefined
            : undefined,
        },
      };

      return NextResponse.json(response);
    } catch (error) {
      const errorResponse: DebugResponse = {
        success: false,
        error: String(error),
      };
      return NextResponse.json(errorResponse, { status: 500 });
    }
  });
}
