import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

// Force Node.js runtime (not Edge)
export const runtime = 'nodejs';

// In production, store these in a database
const authorizationCodes = new Map();

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const clientId = searchParams.get('client_id');
  const redirectUri = searchParams.get('redirect_uri');
  const state = searchParams.get('state');
  const codeChallenge = searchParams.get('code_challenge');
  const codeChallengeMethod = searchParams.get('code_challenge_method');
  const scope = searchParams.get('scope') || 'read';

  // For development, auto-approve without login
  // In production, you'd show a login/consent page here
  
  if (!clientId || !redirectUri) {
    return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
  }

  // Generate authorization code
  const code = crypto.randomBytes(32).toString('hex');
  
  // Store code with metadata (expires in 10 minutes)
  authorizationCodes.set(code, {
    clientId,
    redirectUri,
    codeChallenge,
    codeChallengeMethod,
    scope,
    expiresAt: Date.now() + 10 * 60 * 1000
  });

  // Redirect back to Claude.ai with the code
  const redirectUrl = new URL(redirectUri);
  redirectUrl.searchParams.set('code', code);
  if (state) {
    redirectUrl.searchParams.set('state', state);
  }

  return NextResponse.redirect(redirectUrl);
}

// Export for use in token endpoint
export { authorizationCodes };