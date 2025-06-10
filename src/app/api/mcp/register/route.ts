import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

// Force Node.js runtime (not Edge)
export const runtime = 'nodejs';

// In production, store these in a database
const registeredClients = new Map();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      client_name,
      redirect_uris,
      grant_types = ['authorization_code'],
      response_types = ['code'],
      scope = 'read write',
      token_endpoint_auth_method = 'client_secret_post'
    } = body;

    if (!client_name || !redirect_uris || !Array.isArray(redirect_uris)) {
      return NextResponse.json(
        { error: 'client_name and redirect_uris are required' },
        { status: 400 }
      );
    }

    // Generate client credentials
    const clientId = crypto.randomBytes(16).toString('hex');
    const clientSecret = crypto.randomBytes(32).toString('hex');
    
    // Store client registration
    registeredClients.set(clientId, {
      client_id: clientId,
      client_secret: clientSecret,
      client_name,
      redirect_uris,
      grant_types,
      response_types,
      scope,
      token_endpoint_auth_method,
      created_at: new Date().toISOString()
    });

    // Return client information
    return NextResponse.json({
      client_id: clientId,
      client_secret: clientSecret,
      client_name,
      redirect_uris,
      grant_types,
      response_types,
      scope,
      token_endpoint_auth_method,
      client_id_issued_at: Math.floor(Date.now() / 1000),
      client_secret_expires_at: 0 // Never expires in this implementation
    }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }
}

// Export for use in other endpoints
export { registeredClients };