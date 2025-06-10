import { NextRequest, NextResponse } from 'next/server';

export async function HEAD(request: NextRequest) {
  // Return same as GET but without body
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Content-Type': 'text/html',
    },
  });
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Allow': 'GET, POST, HEAD, OPTIONS',
      'Access-Control-Allow-Methods': 'GET, POST, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

export async function GET(request: NextRequest) {
  const isDevelopment = process.env.NODE_ENV === 'development' || process.env.ENABLE_DEV_MODE === 'true';
  
  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get('client_id');
  const redirectUri = searchParams.get('redirect_uri');
  const state = searchParams.get('state');
  const responseType = searchParams.get('response_type');
  
  if (!redirectUri) {
    return NextResponse.json({ 
      error: 'invalid_request',
      error_description: 'Missing redirect_uri parameter'
    }, { status: 400 });
  }
  
  // Return HTML authorization page
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Authorize AI Power Rankings</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          margin: 0;
          background: #f5f5f5;
        }
        .auth-container {
          background: white;
          padding: 2rem;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          max-width: 400px;
          width: 100%;
        }
        h1 {
          margin: 0 0 1rem 0;
          font-size: 1.5rem;
        }
        p {
          color: #666;
          margin: 1rem 0;
        }
        .permissions {
          background: #f8f9fa;
          padding: 1rem;
          border-radius: 4px;
          margin: 1rem 0;
        }
        .permissions h3 {
          margin: 0 0 0.5rem 0;
          font-size: 1rem;
        }
        .permissions ul {
          margin: 0;
          padding-left: 1.5rem;
        }
        .buttons {
          display: flex;
          gap: 1rem;
          margin-top: 2rem;
        }
        button {
          flex: 1;
          padding: 0.75rem 1.5rem;
          border: none;
          border-radius: 4px;
          font-size: 1rem;
          cursor: pointer;
          font-weight: 500;
        }
        .approve {
          background: #0066cc;
          color: white;
        }
        .approve:hover {
          background: #0052a3;
        }
        .deny {
          background: #e0e0e0;
          color: #333;
        }
        .deny:hover {
          background: #d0d0d0;
        }
      </style>
    </head>
    <body>
      <div class="auth-container">
        <h1>Authorize AI Power Rankings</h1>
        <p>Claude.ai wants to access AI Power Rankings data on your behalf.</p>
        
        <div class="permissions">
          <h3>This will allow Claude.ai to:</h3>
          <ul>
            <li>View current AI tool rankings</li>
            <li>Access tool details and metrics</li>
            <li>Search and filter tools</li>
            <li>Analyze ranking trends</li>
          </ul>
        </div>
        
        <div class="buttons">
          <form method="get" action="${redirectUri}" style="display: inline;">
            <input type="hidden" name="code" value="dev-auth-code" />
            ${state ? `<input type="hidden" name="state" value="${state}" />` : ''}
            <button type="submit" class="approve">Allow</button>
          </form>
          
          <form method="get" action="${redirectUri}" style="display: inline;">
            <input type="hidden" name="error" value="access_denied" />
            <input type="hidden" name="error_description" value="User denied access" />
            ${state ? `<input type="hidden" name="state" value="${state}" />` : ''}
            <button type="submit" class="deny">Deny</button>
          </form>
        </div>
      </div>
    </body>
    </html>
  `;
  
  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html',
    },
  });
}

