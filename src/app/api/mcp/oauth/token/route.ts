import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

// Force Node.js runtime (not Edge)
export const runtime = 'nodejs';

// In production, store these in a database
const accessTokens = new Map();
const refreshTokens = new Map();

// Import from authorize endpoint (in production, use a shared store)
const authorizationCodes = new Map();

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const grantType = formData.get('grant_type');
  const code = formData.get('code') as string;
  const refreshToken = formData.get('refresh_token') as string;
  const clientId = formData.get('client_id');
  const clientSecret = formData.get('client_secret');
  const redirectUri = formData.get('redirect_uri');
  const codeVerifier = formData.get('code_verifier');

  // For development, accept any client credentials
  // In production, validate client_id and client_secret

  if (grantType === 'authorization_code') {
    if (!code) {
      return NextResponse.json({ error: 'Missing authorization code' }, { status: 400 });
    }

    // In production, retrieve from shared store
    const codeData = authorizationCodes.get(code);
    
    if (!codeData || codeData.expiresAt < Date.now()) {
      return NextResponse.json({ error: 'Invalid or expired code' }, { status: 400 });
    }

    // Validate code verifier if PKCE was used
    if (codeData.codeChallenge && codeVerifier) {
      const challenge = crypto
        .createHash('sha256')
        .update(codeVerifier)
        .digest('base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');
      
      if (challenge !== codeData.codeChallenge) {
        return NextResponse.json({ error: 'Invalid code verifier' }, { status: 400 });
      }
    }

    // Generate tokens
    const accessToken = crypto.randomBytes(32).toString('hex');
    const newRefreshToken = crypto.randomBytes(32).toString('hex');

    // Store tokens
    accessTokens.set(accessToken, {
      clientId: codeData.clientId,
      scope: codeData.scope,
      expiresAt: Date.now() + 3600 * 1000 // 1 hour
    });

    refreshTokens.set(newRefreshToken, {
      clientId: codeData.clientId,
      scope: codeData.scope
    });

    // Clean up used code
    authorizationCodes.delete(code);

    return NextResponse.json({
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 3600,
      refresh_token: newRefreshToken,
      scope: codeData.scope
    });
  } 
  
  else if (grantType === 'refresh_token') {
    if (!refreshToken) {
      return NextResponse.json({ error: 'Missing refresh token' }, { status: 400 });
    }

    const tokenData = refreshTokens.get(refreshToken);
    if (!tokenData) {
      return NextResponse.json({ error: 'Invalid refresh token' }, { status: 400 });
    }

    // Generate new access token
    const accessToken = crypto.randomBytes(32).toString('hex');
    
    accessTokens.set(accessToken, {
      clientId: tokenData.clientId,
      scope: tokenData.scope,
      expiresAt: Date.now() + 3600 * 1000
    });

    return NextResponse.json({
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 3600,
      scope: tokenData.scope
    });
  }

  return NextResponse.json({ error: 'Unsupported grant type' }, { status: 400 });
}

// Export for use in API endpoints
export { accessTokens };