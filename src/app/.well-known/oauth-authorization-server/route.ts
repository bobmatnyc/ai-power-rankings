import { NextRequest, NextResponse } from 'next/server';

// Force Node.js runtime (not Edge)
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const isDevelopment = process.env.NODE_ENV === 'development' || process.env.ENABLE_DEV_MODE === 'true';
  
  // If in dev mode, return a minimal response indicating no auth
  if (isDevelopment) {
    return NextResponse.json({
      issuer: "https://aipowerranking.com",
      service_documentation: "https://aipowerranking.com/api/mcp"
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600'
      }
    });
  }
  
  // Production OAuth configuration
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `https://${request.headers.get('host')}`;
  
  return NextResponse.json({
    issuer: baseUrl,
    authorization_endpoint: `${baseUrl}/api/mcp/oauth/authorize`,
    token_endpoint: `${baseUrl}/api/mcp/oauth/token`,
    registration_endpoint: `${baseUrl}/api/mcp/register`,
    token_endpoint_auth_methods_supported: ["client_secret_post"],
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    scopes_supported: ["read", "write"],
    service_documentation: `${baseUrl}/api/mcp`
  }, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600'
    }
  });
}